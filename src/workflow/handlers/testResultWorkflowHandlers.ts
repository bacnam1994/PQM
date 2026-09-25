/**
 * TEST RESULT WORKFLOW HANDLERS
 *
 * Handler xử lý nghiệp vụ cho phân hệ Test Result qua WorkflowFacade:
 * - TEST_RESULT_CREATE
 * - TEST_RESULT_ENTRY_INPUT
 * - TEST_RESULT_SUBMIT
 * - TEST_RESULT_APPROVE
 * - TEST_RESULT_REJECT
 * - TEST_RESULT_CANCEL
 * - TEST_RESULT_REVOKE
 * - TEST_RESULT_DELETE
 */

import { TestResult, Batch, TestResultWorkflowStatus, ElectronicSignature } from '../../types';
import { ITestResultRepository } from '../../repositories/TestResultRepository';
import { testResultRepository as defaultRepo } from '../../repositories/firebase/FirebaseTestResultRepository';
import {
  DeviationAppService,
  deviationAppService as defaultDeviationService,
} from '../../services/app/DeviationAppService';
import { validateOptimisticLock, nextVersion } from '../../utils/concurrency';
import { signatureService } from '../../services/signatureService';
import { buildEvaluationSnapshot } from '../../domain/evaluation';
import {
  resolveTestResultStatus,
  calculateOverallStatusForTestResult,
} from '../../domain/test-result/testResultStatusResolver';
import {
  TestResultWorkflowStateMachine,
  QualityWorkflowMatrixGuard,
} from '../../domain/workflow/stateMachine';
import { WorkflowFacade } from '../WorkflowFacade';
import { WorkflowActor, WorkflowActionId } from '../contracts/actions';
import { getWorkflowFeatureFlags } from '../contracts/featureFlags';

export class TestResultWorkflowHandlers {
  constructor(
    private repo: ITestResultRepository = defaultRepo,
    private deviationService: DeviationAppService = defaultDeviationService
  ) {}

  private toActor(currentUser: any): WorkflowActor {
    const rawRole = (currentUser?.role || (currentUser?.isAdmin ? 'ADMIN' : 'USER')).toUpperCase();
    return {
      id: currentUser?.id || currentUser?.uid || 'usr_unknown',
      name: currentUser?.displayName || currentUser?.name || 'Unknown User',
      role: rawRole,
      email: currentUser?.email,
    };
  }

  /**
   * Tạo mới Phiếu kiểm nghiệm qua Workflow Kernel
   */
  async handleCreate(
    testResult: TestResult,
    currentUser: any,
    options?: { batch?: Batch }
  ): Promise<TestResult> {
    const flags = getWorkflowFeatureFlags();
    const actor = this.toActor(currentUser);

    // Chuẩn hóa Technical ID
    let effectiveBatchId = testResult.batchId?.trim();
    let effectiveTccsId = testResult.tccsId?.trim();

    if (options?.batch) {
      if (effectiveBatchId === options.batch.batchNo) {
        effectiveBatchId = options.batch.id;
      }
      if (!effectiveTccsId && options.batch.tccsId) {
        effectiveTccsId = options.batch.tccsId;
      }
    }

    if (!effectiveBatchId) {
      throw new Error('Phiếu kiểm nghiệm phải gắn liền với một Lô sản xuất cụ thể.');
    }
    if (!testResult.labName?.trim()) {
      throw new Error('Tên phòng kiểm nghiệm (Lab) không được để trống.');
    }
    if (!testDateValid(testResult.testDate)) {
      throw new Error('Ngày kiểm nghiệm không được để trống.');
    }

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
      batchId: effectiveBatchId,
      tccsId: effectiveTccsId,
      overallStatus: evaluatedStatus,
      evaluationSnapshot,
      version: testResult.version && testResult.version > 0 ? testResult.version : 1,
      createdAt: testResult.createdAt || new Date().toISOString(),
    };

    if (!flags.enableTestResultWorkflowFacade) {
      await this.repo.save(cleanResult);
      return cleanResult;
    }

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'TEST_RESULT_CREATE',
        entityType: 'TEST_RESULT',
        entityId: cleanResult.id,
        actor,
        payload: cleanResult,
      },
      async () => {
        await this.repo.save(cleanResult);

        // Tự động kích hoạt OOS nếu FAIL
        if (resolveTestResultStatus(cleanResult) === 'FAIL') {
          try {
            await this.deviationService.autoLogFromOOS(cleanResult, options?.batch, currentUser);
          } catch (err) {
            console.error('[TestResultWorkflow] Auto-log OOS failed:', err);
          }
        }

        return cleanResult;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi thực thi TEST_RESULT_CREATE qua Workflow.');
    }

    return execution.data!;
  }

  /**
   * Cập nhật kết quả đo lường (TEST_RESULT_ENTRY_INPUT)
   */
  async handleUpdate(
    testResult: TestResult,
    currentUser: any,
    oldTestResult?: TestResult,
    options?: { batch?: Batch }
  ): Promise<TestResult> {
    const flags = getWorkflowFeatureFlags();
    const actor = this.toActor(currentUser);

    // Kiểm tra OCC
    validateOptimisticLock(
      oldTestResult?.version,
      testResult.version,
      `Phiếu kiểm nghiệm ${testResult.id}`
    );

    let effectiveBatchId = testResult.batchId?.trim();
    let effectiveTccsId = testResult.tccsId?.trim();

    if (options?.batch) {
      if (effectiveBatchId === options.batch.batchNo) {
        effectiveBatchId = options.batch.id;
      }
      if (!effectiveTccsId && options.batch.tccsId) {
        effectiveTccsId = options.batch.tccsId;
      }
    }

    if (!effectiveBatchId) {
      throw new Error('Phiếu kiểm nghiệm phải gắn liền với một Lô sản xuất cụ thể.');
    }
    if (!testResult.labName?.trim()) {
      throw new Error('Tên phòng kiểm nghiệm (Lab) không được để trống.');
    }
    if (!testDateValid(testResult.testDate)) {
      throw new Error('Ngày kiểm nghiệm không được để trống.');
    }

    let evaluatedStatus: 'PASS' | 'FAIL' | 'PENDING' | 'UNKNOWN' =
      resolveTestResultStatus(testResult);
    if (testResult.results && testResult.results.length > 0) {
      const calc = calculateOverallStatusForTestResult(testResult);
      if (calc) evaluatedStatus = calc;
    }

    const newVersion = nextVersion(oldTestResult?.version ?? testResult.version);
    const shouldRebuildSnapshot =
      !testResult.evaluationSnapshot ||
      testResult.evaluationSnapshot.overallStatus !== evaluatedStatus;

    const evaluationSnapshot = shouldRebuildSnapshot
      ? buildEvaluationSnapshot({ ...testResult, overallStatus: evaluatedStatus }, currentUser, {
          batch: options?.batch,
        })
      : testResult.evaluationSnapshot;

    const cleanResult: TestResult = {
      ...testResult,
      batchId: effectiveBatchId,
      tccsId: effectiveTccsId,
      overallStatus: evaluatedStatus,
      evaluationSnapshot,
      version: newVersion,
      updatedAt: new Date().toISOString(),
    };

    if (!flags.enableTestResultWorkflowFacade) {
      await this.repo.update(cleanResult);
      return cleanResult;
    }

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'TEST_RESULT_ENTRY_INPUT',
        entityType: 'TEST_RESULT',
        entityId: cleanResult.id,
        actor,
        payload: cleanResult,
        expectedVersion: cleanResult.version,
      },
      async () => {
        await this.repo.update(cleanResult);

        if (resolveTestResultStatus(cleanResult) === 'FAIL') {
          try {
            await this.deviationService.autoLogFromOOS(cleanResult, options?.batch, currentUser);
          } catch (err) {
            console.error('[TestResultWorkflow] Auto-log OOS failed:', err);
          }
        }

        return cleanResult;
      }
    );

    if (!execution.success) {
      throw new Error(
        execution.failureReason || 'Lỗi thực thi TEST_RESULT_ENTRY_INPUT qua Workflow.'
      );
    }

    return execution.data!;
  }

  /**
   * Chuyển trạng thái quy trình phiếu kiểm nghiệm
   */
  async handleWorkflowStatusTransition(
    id: string,
    newStatus: TestResultWorkflowStatus,
    currentUser: any,
    options?: {
      reason?: string;
      oldTestResult?: TestResult;
      batch?: Batch;
      signature?: ElectronicSignature;
      requireSignature?: boolean;
    }
  ): Promise<TestResult> {
    const flags = getWorkflowFeatureFlags();
    const actor = this.toActor(currentUser);

    let current = await this.repo.findById(id);
    if (!current && options?.oldTestResult) {
      current = options.oldTestResult;
    }
    if (!current) {
      throw new Error(`Không tìm thấy Phiếu kiểm nghiệm với mã: ${id}`);
    }

    const currentWorkflowStatus: TestResultWorkflowStatus = current.workflowStatus || 'DRAFT';

    // 1. Thẩm tra FSM
    const transitionCheck = TestResultWorkflowStateMachine.canTransition(
      currentWorkflowStatus,
      newStatus,
      {
        actorRole: currentUser?.role,
        actorId: currentUser?.uid,
        reason: options?.reason,
      }
    );
    if (!transitionCheck.allowed) {
      throw new Error(`Quy chuẩn State Machine Phiếu KN: ${transitionCheck.reason}`);
    }

    // 2. Thẩm tra Ma trận Chất lượng x Quy trình
    const qualityStatus = resolveTestResultStatus(current);
    const matrixCheck = QualityWorkflowMatrixGuard.validate(newStatus, qualityStatus);
    if (!matrixCheck.allowed) {
      throw new Error(`Ma trận Chất lượng × Quy trình: ${matrixCheck.reason}`);
    }

    // 3. Yêu cầu lý do với SUPERSEDED
    if (newStatus === 'SUPERSEDED' && (!options?.reason || !options.reason.trim())) {
      throw new Error(
        'Đánh dấu thay thế phiếu kiểm nghiệm (SUPERSEDED) bắt buộc phải có lý do giải trình.'
      );
    }

    // 4. Ràng buộc Chữ ký số 21 CFR Part 11 khi APPROVE
    if (newStatus === 'APPROVED') {
      if (options?.requireSignature || options?.signature) {
        if (!options?.signature) {
          throw new Error(
            'Quy định 21 CFR Part 11: Yêu cầu chữ ký điện tử hợp lệ của QA/Admin trước khi phê duyệt phiếu kiểm nghiệm.'
          );
        }
        if (
          (options.signature.documentType !== 'TEST_RESULT_APPROVAL' &&
            (options.signature.documentType as string) !== 'TEST_RESULT') ||
          options.signature.documentId !== id
        ) {
          throw new Error('Chữ ký điện tử không khớp với Phiếu kiểm nghiệm đang phê duyệt.');
        }
        const isValid = await signatureService.verifySignatureIntegrity(options.signature);
        if (!isValid) {
          throw new Error('Chữ ký điện tử không hợp lệ hoặc đã bị can thiệp trái phép.');
        }
      }
    }

    const newVersion = nextVersion(current.version ?? 1);
    const cleanResult: TestResult = {
      ...current,
      workflowStatus: newStatus,
      version: newVersion,
      updatedAt: new Date().toISOString(),
    };

    if (!flags.enableTestResultWorkflowFacade) {
      await this.repo.update(cleanResult);
      return cleanResult;
    }

    // Map action ID tương ứng
    let actionId: WorkflowActionId = 'TEST_RESULT_SUBMIT';
    if (newStatus === 'APPROVED') actionId = 'TEST_RESULT_APPROVE';
    else if (newStatus === 'REJECTED') actionId = 'TEST_RESULT_REJECT';
    else if (newStatus === 'SUPERSEDED') actionId = 'TEST_RESULT_REVOKE';

    const execution = await WorkflowFacade.dispatch(
      {
        actionId,
        entityType: 'TEST_RESULT',
        entityId: id,
        actor,
        payload: cleanResult,
        reason: options?.reason,
        signature: options?.signature,
        currentState: currentWorkflowStatus,
      },
      async () => {
        await this.repo.update(cleanResult);
        return cleanResult;
      },
      undefined,
      () => ({ nextState: newStatus })
    );

    if (!execution.success) {
      throw new Error(
        execution.failureReason || `Lỗi chuyển trạng thái sang ${newStatus} qua Workflow.`
      );
    }

    return execution.data!;
  }

  /**
   * Xóa phiếu kiểm nghiệm
   */
  async handleDelete(id: string, currentUser: any, oldTestResult?: TestResult): Promise<void> {
    const flags = getWorkflowFeatureFlags();
    const actor = this.toActor(currentUser);

    const current = oldTestResult || (await this.repo.findById(id));
    if (current?.workflowStatus === 'APPROVED' || current?.workflowStatus === 'RELEASED') {
      throw new Error(
        'Từ chối thao tác: Không thể xóa Phiếu kiểm nghiệm đã được phê duyệt (APPROVED) hoặc xuất xưởng (RELEASED). Theo quy chuẩn ALCOA+ và Part 11, phiếu chỉ có thể được thay thế (SUPERSEDED) kèm biên bản CAPA/Deviation.'
      );
    }

    if (!flags.enableTestResultWorkflowFacade) {
      await this.repo.delete(id);
      return;
    }

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'TEST_RESULT_DELETE',
        entityType: 'TEST_RESULT',
        entityId: id,
        actor,
        payload: { id },
        reason: 'Xóa phiếu kiểm nghiệm nháp chưa duyệt',
      },
      async () => {
        await this.repo.delete(id);
        return { deleted: true };
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi xóa phiếu kiểm nghiệm qua Workflow.');
    }
  }
}

function testDateValid(date?: string): boolean {
  return typeof date === 'string' && date.trim().length > 0;
}

export const testResultWorkflowHandlers = new TestResultWorkflowHandlers();
