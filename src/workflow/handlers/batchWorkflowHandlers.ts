/**
 * BATCH WORKFLOW HANDLERS
 *
 * Handler xử lý nghiệp vụ cho phân hệ Batch qua WorkflowFacade:
 * - BATCH_CREATE
 * - BATCH_UPDATE_METADATA
 * - BATCH_DISPATCH_TESTING
 * - BATCH_RELEASE_APPROVE (7 Release Gates + 21 CFR Part 11)
 * - BATCH_REJECT
 * - BATCH_HOLD
 * - BATCH_RECALL
 * - BATCH_DELETE (Typed confirmation token)
 */

import { Batch, TestResult, TCCS, ProductFormula, ElectronicSignature } from '../../types';
import { IBatchRepository } from '../../repositories/BatchRepository';
import { batchRepository as defaultRepo } from '../../repositories/firebase/FirebaseBatchRepository';
import { validateOptimisticLock, nextVersion } from '../../utils/concurrency';
import { signatureService } from '../../services/signatureService';
import { BatchRules } from '../../domain/rules';
import { BatchReleaseDecisionService } from '../../domain/batch/BatchReleaseDecisionService';
import { BatchStateMachine } from '../../domain/workflow/stateMachine';
import { WorkflowFacade } from '../WorkflowFacade';
import { WorkflowActor, WorkflowActionId } from '../contracts/actions';
import { getWorkflowFeatureFlags } from '../contracts/featureFlags';

export interface BatchCreationContext {
  activeTCCS?: TCCS;
  tccsList?: TCCS[];
  productFormula?: ProductFormula;
  productFormulas?: ProductFormula[];
}

export class BatchWorkflowHandlers {
  constructor(private repo: IBatchRepository = defaultRepo) {}

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
   * Tạo mới Lô sản xuất qua Workflow Kernel
   */
  async handleCreate(
    batch: Batch,
    currentUser: any,
    existingBatches?: Batch[],
    context?: BatchCreationContext
  ): Promise<Batch> {
    const flags = getWorkflowFeatureFlags();
    const actor = this.toActor(currentUser);

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

    // Đóng băng tiêu chuẩn & công thức tại thời điểm tạo lô (Schema Snapshotting)
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
      status: 'PENDING', // Luôn khởi tạo ở PENDING
      version: batch.version && batch.version > 0 ? batch.version : 1,
      tccsSnapshot,
      formulaSnapshot,
      createdAt: batch.createdAt || new Date().toISOString(),
    };

    if (!flags.enableBatchWorkflowFacade) {
      await this.repo.save(cleanBatch);
      return cleanBatch;
    }

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'BATCH_CREATE',
        entityType: 'BATCH',
        entityId: cleanBatch.id,
        actor,
        payload: cleanBatch,
      },
      async () => {
        await this.repo.save(cleanBatch);
        return cleanBatch;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi tạo Lô sản xuất qua Workflow.');
    }

    return execution.data!;
  }

  /**
   * Cập nhật thông tin Lô sản xuất (BATCH_UPDATE_METADATA)
   */
  async handleUpdate(batch: Batch, currentUser: any, oldBatch?: Batch): Promise<Batch> {
    const flags = getWorkflowFeatureFlags();
    const actor = this.toActor(currentUser);

    const old = oldBatch || (await this.repo.findById(batch.id));
    if (old && batch.status && batch.status !== old.status) {
      throw new Error(
        'Không được thay đổi Workflow Status thông qua updateBatch(). Hãy sử dụng Workflow Action tương ứng.'
      );
    }

    validateOptimisticLock(old?.version, batch.version, `Lô sản xuất ${batch.batchNo || batch.id}`);

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

    const newVersion = nextVersion(old?.version ?? batch.version);
    const cleanBatch: Batch = {
      ...batch,
      status: old?.status || batch.status || 'PENDING',
      releasedAt: old?.releasedAt,
      releasedBy: old?.releasedBy,
      rejectReason: old?.rejectReason,
      tccsSnapshot: batch.tccsSnapshot || old?.tccsSnapshot,
      formulaSnapshot: batch.formulaSnapshot || old?.formulaSnapshot,
      version: newVersion,
      updatedAt: new Date().toISOString(),
    };

    if (!flags.enableBatchWorkflowFacade) {
      await this.repo.update(cleanBatch);
      return cleanBatch;
    }

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'BATCH_UPDATE_METADATA',
        entityType: 'BATCH',
        entityId: cleanBatch.id,
        actor,
        payload: cleanBatch,
        expectedVersion: cleanBatch.version,
      },
      async () => {
        await this.repo.update(cleanBatch);
        return cleanBatch;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi cập nhật Lô qua Workflow.');
    }

    return execution.data!;
  }

  /**
   * Chuyển trạng thái Lô sản xuất qua Workflow Kernel
   */
  async handleStatusTransition(
    batchId: string,
    status: Batch['status'],
    currentUser: any,
    options?: {
      reason?: string;
      currentBatch?: Batch;
      batchTestResults?: TestResult[];
      signature?: ElectronicSignature;
      requireSignature?: boolean;
      expectedVersion?: number;
    }
  ): Promise<Batch> {
    const flags = getWorkflowFeatureFlags();
    const actor = this.toActor(currentUser);

    let currentBatch = await this.repo.findById(batchId);
    if (!currentBatch && options?.currentBatch) {
      currentBatch = options.currentBatch;
    }
    if (!currentBatch) {
      throw new Error(`Không tìm thấy Lô sản xuất với mã: ${batchId}`);
    }

    // Rào chắn lý do giải trình
    const isActorAdmin = currentUser?.role === 'ADMIN' || currentUser?.isAdmin === true;
    let effectiveReason = options?.reason;
    if (isActorAdmin && (!effectiveReason || !effectiveReason.trim())) {
      effectiveReason = `Quản trị viên (ADMIN) điều chỉnh trạng thái Lô sang ${status}.`;
    }

    if (status === 'REJECTED') {
      if (!effectiveReason || !effectiveReason.trim()) {
        throw new Error('Từ chối (Reject) lô sản xuất bắt buộc phải có lý do giải trình rõ ràng.');
      }
    }

    // 1. Rào chắn State Machine FSM - Topology & User Permissions (Không dùng cờ bypass conditionsMet)
    const currentStatus = currentBatch.status || 'PENDING';
    const transitionCheck = BatchStateMachine.canTransition(currentStatus, status, {
      actorRole: currentUser?.role,
      actorId: currentUser?.uid,
      reason: effectiveReason,
    });
    if (!transitionCheck.allowed) {
      throw new Error(`Quy chuẩn State Machine: ${transitionCheck.reason}`);
    }

    // 2. Tính toán Canonical Release Decision nếu chuyển sang RELEASED (SSoT Gate Check)
    let releaseDecision: any = undefined;
    if (status === 'RELEASED') {
      let freshTestResults: TestResult[] = options?.batchTestResults || [];
      if (this.repo && typeof (this.repo as any).findTestResultsByBatchId === 'function') {
        freshTestResults = await (this.repo as any).findTestResultsByBatchId(batchId);
      }

      releaseDecision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch: currentBatch,
        testResults: freshTestResults,
        userRole: currentUser?.role,
        userSignature: options?.signature,
        asOfDate: new Date(),
        boundTccs: currentBatch.tccsSnapshot || (currentBatch as any)?.tccs,
      });

      if (!releaseDecision.eligible) {
        throw new Error(
          `Quy chuẩn GMP & Release Guard: ${releaseDecision.blockers[0] || 'Lô không đủ điều kiện xuất xưởng.'}`
        );
      }
    }

    // 3. Rào chắn Chữ ký số 21 CFR Part 11 đối với REJECTED
    if (status === 'REJECTED') {
      if (options?.requireSignature || options?.signature) {
        if (!options?.signature) {
          throw new Error(
            'Quy định 21 CFR Part 11: Yêu cầu chữ ký điện tử hợp lệ của QA/Admin trước khi từ chối Lô.'
          );
        }
        if (
          (options.signature.documentType !== 'BATCH_REJECT' &&
            (options.signature.documentType as string) !== 'BATCH') ||
          options.signature.documentId !== batchId
        ) {
          throw new Error('Chữ ký điện tử không khớp với Lô sản xuất đang từ chối.');
        }
        const isValid = await signatureService.verifySignatureIntegrity(options.signature);
        if (!isValid) {
          throw new Error('Chữ ký điện tử không hợp lệ hoặc đã bị can thiệp trái phép.');
        }
      }
    }

    const newVersion = nextVersion(currentBatch.version ?? 1);
    const cleanBatch: Batch = {
      ...currentBatch,
      status,
      version: newVersion,
      updatedAt: new Date().toISOString(),
      ...(status === 'RELEASED'
        ? {
            releasedAt: new Date().toISOString(),
            releasedBy: currentUser?.email || 'unknown',
            releaseDecisionSnapshot: releaseDecision,
          }
        : {}),
      ...(status === 'REJECTED' ? { rejectReason: effectiveReason } : {}),
    };

    if (!flags.enableBatchWorkflowFacade) {
      if (typeof this.repo.updateStatus === 'function') {
        await this.repo.updateStatus(batchId, status, effectiveReason, {
          expectedVersion: options?.expectedVersion ?? currentBatch.version ?? 1,
          releasedAt: cleanBatch.releasedAt,
          releasedBy: cleanBatch.releasedBy,
          rejectReason: cleanBatch.rejectReason,
          releaseDecisionSnapshot: status === 'RELEASED' ? releaseDecision : undefined,
        });
      } else {
        await this.repo.update(cleanBatch);
      }
      return cleanBatch;
    }

    let actionId: WorkflowActionId = 'BATCH_DISPATCH_TESTING';
    if (status === 'RELEASED') actionId = 'BATCH_RELEASE_APPROVE';
    else if (status === 'REJECTED') actionId = 'BATCH_REJECT';
    else if (status === 'BLOCKED') {
      actionId = currentStatus === 'RELEASED' ? 'BATCH_RECALL' : 'BATCH_HOLD';
    }

    const execution = await WorkflowFacade.dispatch(
      {
        actionId,
        entityType: 'BATCH',
        entityId: batchId,
        actor,
        payload: { ...cleanBatch, currentVersion: currentBatch.version ?? 1 },
        reason: effectiveReason,
        signature: options?.signature,
        expectedVersion: options?.expectedVersion ?? currentBatch.version,
        currentState: currentStatus,
      },
      async () => {
        if (typeof this.repo.updateStatus === 'function') {
          await this.repo.updateStatus(batchId, status, effectiveReason, {
            expectedVersion: options?.expectedVersion ?? currentBatch.version ?? 1,
            releasedAt: cleanBatch.releasedAt,
            releasedBy: cleanBatch.releasedBy,
            rejectReason: cleanBatch.rejectReason,
            releaseDecisionSnapshot: status === 'RELEASED' ? releaseDecision : undefined,
          });
        } else {
          await this.repo.update(cleanBatch);
        }
        return cleanBatch;
      },
      undefined,
      () => ({ nextState: status })
    );

    if (!execution.success) {
      const prefix = execution.failureCode ? `${execution.failureCode}: ` : '';
      throw new Error(
        execution.failureReason
          ? `${prefix}${execution.failureReason}`
          : `Lỗi chuyển trạng thái Lô sang ${status} qua Workflow.`
      );
    }

    return execution.data!;
  }

  /**
   * Xóa Lô sản xuất (BATCH_DELETE)
   */
  async handleDelete(batchId: string, currentUser: any, batchNo?: string): Promise<void> {
    const flags = getWorkflowFeatureFlags();
    const actor = this.toActor(currentUser);

    const currentBatch = await this.repo.findById(batchId);
    if (currentBatch && (currentBatch.status === 'RELEASED' || currentBatch.status === 'TESTING')) {
      throw new Error(
        'Từ chối thao tác: Không thể xóa Lô sản xuất đang kiểm nghiệm (TESTING) hoặc đã xuất xưởng (RELEASED). Theo quy chuẩn ALCOA+ và Part 11, hồ sơ lô phải được bảo lưu toàn vẹn.'
      );
    }

    if (!flags.enableBatchWorkflowFacade) {
      await this.repo.delete(batchId);
      return;
    }

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'BATCH_DELETE',
        entityType: 'BATCH',
        entityId: batchId,
        actor,
        payload: { batchId, batchNo },
        reason: `Xóa hồ sơ Lô ${batchNo || batchId}`,
        confirmationToken: 'CONFIRM-DELETE-BATCH',
      },
      async () => {
        await this.repo.delete(batchId);
        return { deleted: true };
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi xóa Lô qua Workflow.');
    }
  }
}

export const batchWorkflowHandlers = new BatchWorkflowHandlers();
