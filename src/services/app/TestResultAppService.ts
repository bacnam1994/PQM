/**
 * PQM 3.0 - Test Result Application Service
 * Điều phối các nghiệp vụ quản lý Phiếu kiểm nghiệm: RBAC Authorization, Validation,
 * Tự động đánh giá Đạt/Không đạt, ALCOA+ Audit Trail & Optimistic Concurrency Control (OCC)
 */

import { TestResult, Batch } from '../../types';
import { ITestResultRepository } from '../../repositories/TestResultRepository';
import { testResultRepository as defaultTestResultRepo } from '../../repositories/firebase/FirebaseTestResultRepository';
import {
  DeviationAppService,
  deviationAppService as defaultDeviationAppService,
} from './DeviationAppService';
import { can } from '../permissionService';
import { logAuditAction } from '../auditService';
import { validateOptimisticLock, nextVersion } from '../../utils/concurrency';
import { buildEvaluationSnapshot } from '../../domain/evaluation';
import {
  resolveTestResultStatus,
  calculateOverallStatusForTestResult,
} from '../../domain/test-result/testResultStatusResolver';

export class TestResultAppService {
  constructor(
    private repo: ITestResultRepository = defaultTestResultRepo,
    private deviationService: DeviationAppService = defaultDeviationAppService
  ) {}

  /**
   * Tạo mới Phiếu kiểm nghiệm
   */
  async createTestResult(
    testResult: TestResult,
    currentUser: any,
    options?: { batch?: Batch }
  ): Promise<void> {
    if (!can(currentUser, 'test_result:create')) {
      throw new Error('Từ chối quyền: Bạn không có quyền lập phiếu kiểm nghiệm mới.');
    }

    if (!testResult.batchId?.trim()) {
      throw new Error('Phiếu kiểm nghiệm phải gắn liền với một Lô sản xuất cụ thể.');
    }
    if (!testResult.labName?.trim()) {
      throw new Error('Tên phòng kiểm nghiệm (Lab) không được để trống.');
    }
    if (!testResult.testDate?.trim()) {
      throw new Error('Ngày kiểm nghiệm không được để trống.');
    }

    // Tự động kiểm tra tính toán tổng hợp PASS / FAIL / PENDING / UNKNOWN dựa trên các chỉ tiêu chi tiết
    let evaluatedStatus: 'PASS' | 'FAIL' | 'PENDING' | 'UNKNOWN' =
      resolveTestResultStatus(testResult);
    if (testResult.results && testResult.results.length > 0) {
      const calc = calculateOverallStatusForTestResult(testResult);
      if (calc) evaluatedStatus = calc;
    }

    const evaluationSnapshot =
      testResult.evaluationSnapshot ||
      buildEvaluationSnapshot({ ...testResult, overallStatus: evaluatedStatus }, currentUser, {
        batch: options?.batch,
      });

    const cleanResult: TestResult = {
      ...testResult,
      overallStatus: evaluatedStatus,
      evaluationSnapshot,
      version: testResult.version && testResult.version > 0 ? testResult.version : 1,
      createdAt: testResult.createdAt || new Date().toISOString(),
    };

    await this.repo.save(cleanResult);

    // Chuẩn GMP: Tự động ghi nhận Hồ sơ Sai lệch (Deviation/OOS) khi kết quả kiểm nghiệm không đạt (FAIL)
    if (resolveTestResultStatus(cleanResult) === 'FAIL') {
      try {
        await this.deviationService.autoLogFromOOS(cleanResult, options?.batch, currentUser);
      } catch (err) {
        console.error('[TestResultAppService] Tự động tạo hồ sơ sai lệch OOS thất bại:', err);
      }
    }

    logAuditAction({
      action: 'CREATE',
      collection: 'TEST_RESULTS',
      documentId: cleanResult.id,
      details: `Thêm phiếu KN: Lô ${options?.batch?.batchNo || cleanResult.batchId}, Lab: ${cleanResult.labName}, Kết quả: ${cleanResult.overallStatus} (v${cleanResult.version})`,
      performedBy: currentUser?.email || 'unknown',
    });
  }

  /**
   * Cập nhật Phiếu kiểm nghiệm có bảo vệ Optimistic Concurrency Control (OCC)
   */
  async updateTestResult(
    testResult: TestResult,
    currentUser: any,
    oldTestResult?: TestResult
  ): Promise<void> {
    if (!can(currentUser, 'test_result:update', oldTestResult || testResult)) {
      throw new Error(
        'Từ chối quyền: Không thể chỉnh sửa phiếu kiểm nghiệm đã duyệt hoặc bị khóa.'
      );
    }

    // Kiểm tra xung đột khóa lạc quan (OCC)
    validateOptimisticLock(
      oldTestResult?.version,
      testResult.version,
      `Phiếu kiểm nghiệm ${testResult.id}`
    );

    if (!testResult.batchId?.trim()) {
      throw new Error('Phiếu kiểm nghiệm phải gắn liền với một Lô sản xuất cụ thể.');
    }
    if (!testResult.labName?.trim()) {
      throw new Error('Tên phòng kiểm nghiệm (Lab) không được để trống.');
    }
    if (!testResult.testDate?.trim()) {
      throw new Error('Ngày kiểm nghiệm không được để trống.');
    }

    let evaluatedStatus: 'PASS' | 'FAIL' | 'PENDING' | 'UNKNOWN' =
      resolveTestResultStatus(testResult);
    if (testResult.results && testResult.results.length > 0) {
      const calc = calculateOverallStatusForTestResult(testResult);
      if (calc) evaluatedStatus = calc;
    }

    const newVersion = nextVersion(oldTestResult?.version ?? testResult.version);

    // ALCOA+: Tái tạo snapshot nếu chưa có snapshot hoặc snapshot cũ có overallStatus lệch với evaluatedStatus
    const shouldRebuildSnapshot =
      !testResult.evaluationSnapshot ||
      testResult.evaluationSnapshot.overallStatus !== evaluatedStatus;

    const evaluationSnapshot = shouldRebuildSnapshot
      ? buildEvaluationSnapshot({ ...testResult, overallStatus: evaluatedStatus }, currentUser)
      : testResult.evaluationSnapshot;

    const cleanResult: TestResult = {
      ...testResult,
      overallStatus: evaluatedStatus,
      evaluationSnapshot,
      version: newVersion,
      updatedAt: new Date().toISOString(),
    };

    await this.repo.update(cleanResult);

    // Chuẩn GMP: Tự động ghi nhận Hồ sơ Sai lệch (Deviation/OOS) khi kết quả kiểm nghiệm cập nhật thành FAIL
    if (resolveTestResultStatus(cleanResult) === 'FAIL') {
      try {
        await this.deviationService.autoLogFromOOS(cleanResult, undefined, currentUser);
      } catch (err) {
        console.error('[TestResultAppService] Tự động tạo hồ sơ sai lệch OOS thất bại:', err);
      }
    }

    logAuditAction({
      action: 'UPDATE',
      collection: 'TEST_RESULTS',
      documentId: cleanResult.id,
      details: `Cập nhật phiếu KN: ${cleanResult.id}, Kết quả: ${cleanResult.overallStatus} (v${cleanResult.version})`,
      performedBy: currentUser?.email || 'unknown',
    });
  }

  /**
   * Xóa Phiếu kiểm nghiệm
   */
  async deleteTestResult(id: string, currentUser: any, oldTestResult?: TestResult): Promise<void> {
    if (!can(currentUser, 'test_result:delete', oldTestResult)) {
      throw new Error('Từ chối quyền: Bạn không có quyền xóa phiếu kiểm nghiệm này.');
    }

    await this.repo.delete(id);

    logAuditAction({
      action: 'DELETE',
      collection: 'TEST_RESULTS',
      documentId: id,
      details: `Xóa phiếu KN: ${id}`,
      performedBy: currentUser?.email || 'unknown',
    });
  }
}

export const testResultAppService = new TestResultAppService();
