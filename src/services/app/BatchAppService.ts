/**
 * PQM 3.0 - Batch Application Service
 * Điều phối các nghiệp vụ quản lý Lô sản xuất: RBAC Authorization, Validation,
 * State Machine, Schema Snapshotting (TCCS & Formula) & Optimistic Concurrency Control (OCC)
 */

import { Batch, TestResult, TCCS, ProductFormula, ElectronicSignature } from '../../types';
import { IBatchRepository } from '../../repositories/BatchRepository';
import { batchRepository as defaultBatchRepo } from '../../repositories/firebase/FirebaseBatchRepository';
import { can } from '../permissionService';
import { logAuditAction } from '../auditService';
import { validateOptimisticLock, nextVersion } from '../../utils/concurrency';
import { signatureService } from '../signatureService';
import { BatchRules } from '../../domain/rules';
import { BatchStateMachine } from '../../domain/workflow/stateMachine';

export interface BatchCreationContext {
  activeTCCS?: TCCS;
  tccsList?: TCCS[];
  productFormula?: ProductFormula;
  productFormulas?: ProductFormula[];
}

export class BatchAppService {
  constructor(private repo: IBatchRepository = defaultBatchRepo) {}

  /**
   * Tạo mới Lô sản xuất có chụp phiên bản Schema Snapshotting (TCCS & Formula)
   */
  async createBatch(
    batch: Batch,
    currentUser: any,
    existingBatches?: Batch[],
    context?: BatchCreationContext
  ): Promise<void> {
    if (!can(currentUser, 'batch:create')) {
      throw new Error('Từ chối quyền: Bạn không có quyền tạo lô sản xuất mới.');
    }

    if (!batch.batchNo?.trim()) {
      throw new Error('Số lô sản xuất không được để trống.');
    }
    if (!batch.productId?.trim()) {
      throw new Error('Vui lòng chọn sản phẩm liên kết cho lô sản xuất.');
    }

    if (existingBatches && existingBatches.length > 0) {
      const cleanNo = batch.batchNo.trim().toLowerCase();
      const duplicate = existingBatches.find(
        (b) => b.id !== batch.id && b.batchNo?.trim().toLowerCase() === cleanNo
      );
      if (duplicate) {
        throw new Error(`Số lô "${batch.batchNo}" đã tồn tại trên hệ thống.`);
      }
    }

    if (batch.mfgDate && batch.expDate && batch.expDate < batch.mfgDate) {
      throw new Error('Hạn dùng không được trước ngày sản xuất.');
    }

    if (batch.theoreticalYield != null && batch.theoreticalYield < 0) {
      throw new Error('Sản lượng lý thuyết không thể là số âm.');
    }
    if (batch.actualYield != null && batch.actualYield < 0) {
      throw new Error('Sản lượng thực tế không thể là số âm.');
    }

    // --- SCHEMA SNAPSHOTTING (Đóng băng tiêu chuẩn & công thức tại thời điểm tạo lô) ---
    let tccsSnapshot = batch.tccsSnapshot;
    if (!tccsSnapshot && context) {
      tccsSnapshot = context.activeTCCS || context.tccsList?.find((t) => t.id === batch.tccsId);
    }

    let formulaSnapshot = batch.formulaSnapshot;
    if (!formulaSnapshot && context) {
      formulaSnapshot =
        context.productFormula ||
        context.productFormulas?.find((f) => f.productId === batch.productId);
    }

    const cleanBatch: Batch = {
      ...batch,
      status: batch.status || 'PENDING',
      version: batch.version && batch.version > 0 ? batch.version : 1,
      tccsSnapshot,
      formulaSnapshot,
      createdAt: batch.createdAt || new Date().toISOString(),
    };

    await this.repo.save(cleanBatch);

    logAuditAction({
      action: 'CREATE',
      collection: 'BATCHES',
      documentId: cleanBatch.id,
      details: `Tạo lô hàng: ${cleanBatch.batchNo} (${cleanBatch.status}) v${cleanBatch.version}${tccsSnapshot ? ` [Frozen TCCS: ${tccsSnapshot.code}]` : ''}`,
      performedBy: currentUser?.email || 'unknown',
    });
  }

  /**
   * Cập nhật thông tin Lô sản xuất có bảo vệ Optimistic Concurrency Control (OCC)
   */
  async updateBatch(batch: Batch, currentUser: any, oldBatch?: Batch): Promise<void> {
    if (!can(currentUser, 'batch:update', oldBatch || batch)) {
      throw new Error(
        'Từ chối quyền: Không thể cập nhật lô sản xuất (có thể do quyền hạn hoặc lô đã đóng/xuất xưởng).'
      );
    }

    // Kiểm tra xung đột khóa lạc quan (OCC)
    validateOptimisticLock(
      oldBatch?.version,
      batch.version,
      `Lô sản xuất ${batch.batchNo || batch.id}`
    );

    if (!batch.batchNo?.trim()) {
      throw new Error('Số lô sản xuất không được để trống.');
    }
    if (!batch.productId?.trim()) {
      throw new Error('Vui lòng chọn sản phẩm liên kết cho lô sản xuất.');
    }

    if (batch.mfgDate && batch.expDate && batch.expDate < batch.mfgDate) {
      throw new Error('Hạn dùng không được trước ngày sản xuất.');
    }

    if (batch.theoreticalYield != null && batch.theoreticalYield < 0) {
      throw new Error('Sản lượng lý thuyết không thể là số âm.');
    }
    if (batch.actualYield != null && batch.actualYield < 0) {
      throw new Error('Sản lượng thực tế không thể là số âm.');
    }

    const newVersion = nextVersion(oldBatch?.version ?? batch.version);

    const cleanBatch: Batch = {
      ...batch,
      // Bảo toàn các bản chụp đã có
      tccsSnapshot: batch.tccsSnapshot || oldBatch?.tccsSnapshot,
      formulaSnapshot: batch.formulaSnapshot || oldBatch?.formulaSnapshot,
      version: newVersion,
      updatedAt: new Date().toISOString(),
    };

    await this.repo.update(cleanBatch);

    logAuditAction({
      action: 'UPDATE',
      collection: 'BATCHES',
      documentId: cleanBatch.id,
      details: `Cập nhật lô hàng: ${cleanBatch.batchNo} -> trạng thái: ${cleanBatch.status} (v${cleanBatch.version})`,
      performedBy: currentUser?.email || 'unknown',
    });
  }

  /**
   * Chuyển trạng thái Lô sản xuất (State Machine & Release Guard)
   */
  async updateStatus(
    batchId: string,
    status: Batch['status'],
    currentUser: any,
    options?: {
      reason?: string;
      currentBatch?: Batch;
      batchTestResults?: TestResult[];
      signature?: ElectronicSignature;
      requireSignature?: boolean;
    }
  ): Promise<void> {
    const currentBatch = options?.currentBatch || (await this.repo.findById(batchId));
    if (!currentBatch) {
      throw new Error(`Không tìm thấy Lô sản xuất với mã: ${batchId}`);
    }

    // 1. Phân quyền chuyển đổi trạng thái
    if (status === 'RELEASED') {
      if (!can(currentUser, 'batch:release', currentBatch)) {
        throw new Error(
          'Từ chối quyền: Chỉ bộ phận QA hoặc Quản trị viên mới có thẩm quyền phê duyệt xuất xưởng (Release) lô.'
        );
      }
    } else if (status === 'REJECTED') {
      if (!can(currentUser, 'batch:reject', currentBatch)) {
        throw new Error('Từ chối quyền: Bạn không có quyền từ chối (Reject) lô sản xuất.');
      }
    } else {
      if (!can(currentUser, 'batch:update', currentBatch)) {
        throw new Error('Từ chối quyền: Bạn không có quyền cập nhật trạng thái lô sản xuất.');
      }
    }

    // 2. Thẩm tra quy tắc chuyển trạng thái FSM (BatchStateMachine)
    // Cấm nhảy cóc trạng thái hoặc chuyển đổi trái phép (vd: PENDING -> RELEASED, RELEASED -> PENDING)
    const transitionCheck = BatchStateMachine.canTransition(currentBatch.status, status, {
      actorRole: currentUser?.role,
      actorId: currentUser?.uid,
      reason: options?.reason,
      conditionsMet: status === 'RELEASED' ? true : undefined,
    });
    if (!transitionCheck.allowed) {
      throw new Error(`Quy chuẩn State Machine: ${transitionCheck.reason}`);
    }

    // 3. Kiểm tra chữ ký điện tử (FDA 21 CFR Part 11 Compliance)
    if (status === 'RELEASED') {
      if (options?.requireSignature && !options?.signature) {
        throw new Error(
          'Quy định 21 CFR Part 11: Yêu cầu chữ ký điện tử hợp lệ của QA/Admin trước khi xuất xưởng Lô.'
        );
      }
      if (options?.signature) {
        if (
          options.signature.documentType !== 'BATCH_RELEASE' ||
          options.signature.documentId !== batchId
        ) {
          throw new Error('Chữ ký điện tử không khớp với Lô sản xuất đang phê duyệt.');
        }
        const isValid = await signatureService.verifySignatureIntegrity(options.signature);
        if (!isValid) {
          throw new Error('Chữ ký điện tử không hợp lệ hoặc đã bị can thiệp trái phép.');
        }
      }
    }

    // 4. Ràng buộc bảo toàn dữ liệu & GMP Release Guard:
    // Thẩm định qua Domain BatchRules & Canonical Quality Resolver
    if (status === 'RELEASED') {
      const releaseDecision = BatchRules.canRelease(
        currentBatch,
        options?.batchTestResults || [],
        currentUser?.role,
        (currentBatch as any)?.tccs
      );
      if (!releaseDecision.allowed) {
        throw new Error(
          `Quy chuẩn GMP & Release Guard: ${releaseDecision.reason || 'Lô không đủ điều kiện xuất xưởng.'}`
        );
      }
    }

    await this.repo.updateStatus(batchId, status, options?.reason);

    logAuditAction({
      action: 'UPDATE',
      collection: 'BATCHES',
      documentId: batchId,
      details: `Chuyển trạng thái lô: ${currentBatch.batchNo || batchId} -> ${status}${options?.reason ? ` (Lý do: ${options.reason})` : ''}${options?.signature ? ` [Đã ký điện tử: ${options.signature.signerEmail}]` : ''}`,
      performedBy: currentUser?.email || 'unknown',
    });
  }

  /**
   * Cập nhật tiến độ kiểm nghiệm lô (%)
   */
  async updateProgress(batchId: string, progressPercent: number, currentUser?: any): Promise<void> {
    if (currentUser && !can(currentUser, 'batch:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền cập nhật tiến độ lô.');
    }
    await this.repo.updateProgress(batchId, progressPercent);
  }

  /**
   * Xóa Lô sản xuất
   */
  async deleteBatch(id: string, currentUser: any, batchNo?: string): Promise<void> {
    if (!can(currentUser, 'batch:delete')) {
      throw new Error('Từ chối quyền: Chỉ Quản trị viên mới có quyền xóa dữ liệu lô sản xuất.');
    }

    const targetBatch = await this.repo.findById(id);
    if (targetBatch?.status === 'RELEASED') {
      throw new Error(
        'Từ chối thao tác: Không thể xóa Lô đã xuất xưởng (RELEASED). Chỉ có thể thu hồi (Recall/Blocked) theo quy định GMP.'
      );
    }

    await this.repo.delete(id);

    logAuditAction({
      action: 'DELETE',
      collection: 'BATCHES',
      documentId: id,
      details: `Xóa lô hàng: ${batchNo || id}`,
      performedBy: currentUser?.email || 'unknown',
    });
  }
}

export const batchAppService = new BatchAppService();
