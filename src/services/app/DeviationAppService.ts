/**
 * PQM 3.0 - Quality Deviation & CAPA Application Service
 * ======================================================
 * Điều phối luồng nghiệp vụ Quản lý Sai lệch Chất lượng theo chuẩn GMP-WHO và FDA 21 CFR Part 211.
 * Triển khai State Machine: LOGGED -> UNDER_INVESTIGATION -> CAPA_PLANNED -> EFFECTIVENESS_REVIEW -> CLOSED
 */

import { QualityDeviation, DeviationStatus, CreateDeviationInput, CAPAActionItem } from '../../types/deviation';
import { IDeviationRepository } from '../../repositories/IDeviationRepository';
import { firebaseDeviationRepository } from '../../repositories/firebase/FirebaseDeviationRepository';
import { logAuditAction } from '../auditService';
import { generateId } from '../../utils';
import { nextVersion, validateOptimisticLock } from '../../utils/concurrency';
import { TestResult, Batch } from '../../types';

export class DeviationAppService {
  constructor(private repo: IDeviationRepository = firebaseDeviationRepository) {}

  /**
   * Tạo mới một sai lệch chất lượng
   */
  async createDeviation(input: CreateDeviationInput, currentUser: any): Promise<QualityDeviation> {
    const id = generateId('dev');
    const now = new Date();
    const year = now.getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const deviationNo = `DEV-${year}-${randomSuffix}`;

    const newDeviation: QualityDeviation = {
      id,
      deviationNo,
      title: input.title,
      source: input.source,
      status: 'LOGGED',
      severity: input.severity,
      batchId: input.batchId,
      batchNo: input.batchNo,
      productId: input.productId,
      productName: input.productName,
      testResultId: input.testResultId,
      failedCriteria: input.failedCriteria,
      description: input.description,
      immediateAction: input.immediateAction,
      loggedBy: currentUser?.email || 'SYSTEM_AUTO',
      loggedAt: now.toISOString(),
      version: 1,
      updatedAt: now.toISOString()
    };

    await this.repo.save(newDeviation);

    logAuditAction({
      action: 'CREATE',
      collection: 'DEVIATIONS',
      documentId: id,
      details: `Khởi tạo hồ sơ sai lệch chất lượng: ${deviationNo} (${newDeviation.severity}) - Nguồn: ${newDeviation.source}`,
      performedBy: currentUser?.email || 'SYSTEM_AUTO'
    });

    return newDeviation;
  }

  /**
   * Tự động khởi tạo Sai lệch khi phát hiện kết quả kiểm nghiệm OOS (FAIL)
   */
  async autoLogFromOOS(
    testResult: TestResult,
    batch?: Batch,
    currentUser?: any
  ): Promise<QualityDeviation | null> {
    if (testResult.overallStatus !== 'FAIL') return null;

    // Kiểm tra xem đã có sai lệch cho phiếu kiểm nghiệm này chưa để tránh tạo trùng
    const existing = await this.repo.findAll();
    const duplicate = existing.find(d => d.testResultId === testResult.id);
    if (duplicate) return duplicate;

    const failedCriteria = (testResult.results || [])
      .filter(r => !r.isPass)
      .map(r => ({
        name: r.criteriaName,
        actualValue: r.value,
        specification: r.limit || 'Theo TCCS'
      }));

    const isCritical = failedCriteria.some(c =>
      c.name.toLowerCase().includes('vi sinh') ||
      c.name.toLowerCase().includes('kim loại') ||
      c.name.toLowerCase().includes('độc tính') ||
      c.name.toLowerCase().includes('vô trùng')
    );

    return this.createDeviation({
      title: `Sự cố OOS: Lô ${batch?.batchNo || testResult.batchId} không đạt ${failedCriteria.length} chỉ tiêu`,
      source: 'OOS_TEST_RESULT',
      severity: isCritical ? 'CRITICAL' : 'MAJOR',
      description: `Phiếu kiểm nghiệm ${testResult.id} phát hiện ${failedCriteria.length} chỉ tiêu không đạt tiêu chuẩn chất lượng.`,
      batchId: testResult.batchId,
      batchNo: batch?.batchNo,
      productId: batch?.productId,
      testResultId: testResult.id,
      failedCriteria,
      immediateAction: 'Biệt trữ lô sản xuất (Quarantine), ngưng phân phối và khởi động điều tra OOS Phase 1.'
    }, currentUser);
  }

  /**
   * Chuyển trạng thái sai lệch theo State Machine
   */
  async updateStatus(
    id: string,
    newStatus: DeviationStatus,
    currentUser: any,
    options?: { notes?: string; investigator?: string }
  ): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Không tìm thấy hồ sơ sai lệch: ${id}`);
    }

    // 1. Kiểm tra thẩm quyền đóng sai lệch (Chỉ QA/Admin mới được CLOSE)
    if (newStatus === 'CLOSED') {
      const isQAOrAdmin = currentUser?.role === 'QA' || currentUser?.role === 'ADMIN';
      if (!isQAOrAdmin) {
        throw new Error('Từ chối quyền: Chỉ Trưởng phòng QA hoặc Quản trị viên mới có quyền Đóng (Close) hồ sơ sai lệch.');
      }
      if (!options?.notes && !existing.closureNotes) {
        throw new Error('Quy chuẩn GMP: Bắt buộc phải ghi nhận ý kiến thẩm định và kết luận trước khi đóng sai lệch.');
      }
    }

    // 2. Chuyển trạng thái
    await this.repo.updateStatus(id, newStatus, options?.notes);

    logAuditAction({
      action: 'UPDATE',
      collection: 'DEVIATIONS',
      documentId: id,
      details: `Chuyển trạng thái sai lệch ${existing.deviationNo}: ${existing.status} -> ${newStatus}${options?.notes ? ` (Ghi chú: ${options.notes})` : ''}`,
      performedBy: currentUser?.email || 'unknown'
    });
  }

  /**
   * Bổ sung / Cập nhật hành động CAPA vào hồ sơ sai lệch
   */
  async addCAPAItem(
    id: string,
    actionItem: Omit<CAPAActionItem, 'id'>,
    currentUser: any
  ): Promise<QualityDeviation> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Không tìm thấy hồ sơ sai lệch: ${id}`);
    }

    const newItem: CAPAActionItem = {
      ...actionItem,
      id: generateId('capa'),
    };

    const updatedCAPAs = [...(existing.capaItems || []), newItem];
    const newVersion = nextVersion(existing.version);

    const updatedDeviation: QualityDeviation = {
      ...existing,
      capaItems: updatedCAPAs,
      // Tự động chuyển sang CAPA_PLANNED nếu đang ở UNDER_INVESTIGATION
      status: existing.status === 'UNDER_INVESTIGATION' ? 'CAPA_PLANNED' : existing.status,
      version: newVersion,
      updatedAt: new Date().toISOString()
    };

    await this.repo.save(updatedDeviation);

    logAuditAction({
      action: 'UPDATE',
      collection: 'DEVIATIONS',
      documentId: id,
      details: `Bổ sung hành động CAPA [${newItem.type}]: ${newItem.action} (Phụ trách: ${newItem.responsible})`,
      performedBy: currentUser?.email || 'unknown'
    });

    return updatedDeviation;
  }

  /**
   * Đánh dấu hoàn tất hành động CAPA
   */
  async completeCAPAItem(
    id: string,
    capaId: string,
    currentUser: any
  ): Promise<QualityDeviation> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Không tìm thấy hồ sơ sai lệch: ${id}`);
    }

    const updatedCAPAs = (existing.capaItems || []).map(item => {
      if (item.id === capaId) {
        return {
          ...item,
          status: 'COMPLETED' as const,
          completedAt: new Date().toISOString()
        };
      }
      return item;
    });

    const newVersion = nextVersion(existing.version);
    const updatedDeviation: QualityDeviation = {
      ...existing,
      capaItems: updatedCAPAs,
      version: newVersion,
      updatedAt: new Date().toISOString()
    };

    await this.repo.save(updatedDeviation);

    logAuditAction({
      action: 'UPDATE',
      collection: 'DEVIATIONS',
      documentId: id,
      details: `Hoàn tất hành động CAPA ${capaId} trong hồ sơ ${existing.deviationNo}`,
      performedBy: currentUser?.email || 'unknown'
    });

    return updatedDeviation;
  }
}

export const deviationAppService = new DeviationAppService();
