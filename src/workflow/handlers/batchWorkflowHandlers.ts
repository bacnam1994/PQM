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
import {
  batchRepository as defaultRepo,
  FirebaseBatchRepository,
} from '../../repositories/firebase/FirebaseBatchRepository';
import { validateOptimisticLock, nextVersion } from '../../utils/concurrency';
import { signatureService } from '../../services/signatureService';
import { getReleaseCommandPort } from '../../services/releaseCommandPort';
import { BatchRules } from '../../domain/rules';
import { BatchReleaseDecisionService } from '../../domain/batch/BatchReleaseDecisionService';
import { BatchStateMachine } from '../../domain/workflow/stateMachine';
import { BprStateMachine, BprReviewStatus } from '../../domain/workflow/bprStateMachine';
import { WorkflowFacade } from '../WorkflowFacade';
import { WorkflowActor, WorkflowActionId } from '../contracts/actions';
import { getWorkflowFeatureFlags } from '../contracts/featureFlags';
import { BatchReleaseWorkflowSynchronizer } from '../../domain/batch/BatchReleaseWorkflowSynchronizer';

export interface BatchCreationContext {
  activeTCCS?: TCCS;
  tccsList?: TCCS[];
  productFormula?: ProductFormula;
  productFormulas?: ProductFormula[];
}

export class BatchWorkflowHandlers {
  private synchronizer: BatchReleaseWorkflowSynchronizer;

  constructor(private repo: IBatchRepository = defaultRepo) {
    this.synchronizer = new BatchReleaseWorkflowSynchronizer(repo);
  }

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
   * CORE ACTION RUNNER: Chuyển trạng thái Lô sản xuất qua Workflow Kernel
   * Caller KHÔNG tự quyết định nextState!
   * nextState = BatchStateMachine.resolveNextState(actionId, currentBatch.status)
   */
  async executeBatchAction(
    actionId: WorkflowActionId,
    batchId: string,
    currentUser: any,
    options?: {
      reason?: string;
      currentBatch?: Batch;
      batchTestResults?: TestResult[];
      signature?: ElectronicSignature;
      requireSignature?: boolean;
      expectedVersion?: number;
      idempotencyKey?: string;
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

    // 0. Idempotency Short-Circuit Check
    if (options?.idempotencyKey) {
      const cached = WorkflowFacade.getIdempotencyResult<Batch>(options.idempotencyKey);
      if (cached && cached.success && cached.data) {
        return cached.data;
      }
    }

    let currentStatus = currentBatch.status || 'PENDING';

    // 1. Tự động tính toán nextState từ State Machine SSoT (Caller không được ép nextState)
    const calculatedNextState = BatchStateMachine.resolveNextState(actionId, currentStatus);

    if (!calculatedNextState) {
      if (actionId === 'BATCH_RELEASE_APPROVE' && currentStatus === 'PENDING') {
        throw new Error(
          `State Machine Violation / Quy chuẩn State Machine: Không thể chuyển từ PENDING sang RELEASED. Lô cần phải được đưa vào kiểm nghiệm (TESTING) trước.`
        );
      }
      const targetState =
        actionId === 'BATCH_RELEASE_APPROVE'
          ? 'RELEASED'
          : actionId === 'BATCH_DISPATCH_TESTING'
            ? 'TESTING'
            : actionId === 'BATCH_REJECT'
              ? 'REJECTED'
              : actionId === 'BATCH_HOLD' || actionId === 'BATCH_RECALL'
                ? 'BLOCKED'
                : actionId === 'BATCH_RESUME'
                  ? 'TESTING'
                  : 'khác';
      throw new Error(
        `State Machine Violation / Quy chuẩn State Machine: Hành động ${actionId} không hợp lệ từ trạng thái hiện tại '${currentStatus}'. Không thể chuyển từ ${currentStatus} sang ${targetState}.`
      );
    }

    // 2. Rào chắn lý do giải trình & Phân tách ngữ nghĩa
    const isActorAdmin = currentUser?.role === 'ADMIN' || currentUser?.isAdmin === true;
    let effectiveReason = options?.reason;
    if (isActorAdmin && (!effectiveReason || !effectiveReason.trim())) {
      effectiveReason = `Quản trị viên (ADMIN) thực hiện hành động ${actionId} cho Lô.`;
    }

    if (actionId === 'BATCH_REJECT' && (!effectiveReason || !effectiveReason.trim())) {
      throw new Error('Từ chối (Reject) lô sản xuất bắt buộc phải có lý do giải trình rõ ràng.');
    }
    if (actionId === 'BATCH_HOLD' && (!effectiveReason || !effectiveReason.trim())) {
      throw new Error('Tạm đình chỉ / Giữ lô (Hold) bắt buộc phải có lý do giải trình rõ ràng.');
    }
    if (actionId === 'BATCH_RESUME' && (!effectiveReason || !effectiveReason.trim())) {
      throw new Error(
        'Mở lại kiểm nghiệm (Resume) bắt buộc phải có kế hoạch kiểm tra hoặc lý do giải trình.'
      );
    }
    if (actionId === 'BATCH_RECALL' && (!effectiveReason || !effectiveReason.trim())) {
      throw new Error('Thu hồi lô (Recall) bắt buộc phải có lý do thu hồi rõ ràng.');
    }

    // 3. Đánh giá Release Decision trước đối với BATCH_RELEASE_APPROVE (SSoT trước khi gọi FSM)
    let releaseDecision: any = undefined;
    if (actionId === 'BATCH_RELEASE_APPROVE') {
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
        isPreview: false,
      });

      if (!releaseDecision.eligible) {
        throw new Error(
          `Quy chuẩn GMP & Release Guard: ${releaseDecision.blockers[0] || 'Lô không đủ điều kiện xuất xưởng.'}`
        );
      }
    }

    // 4. Topology & Perms check từ BatchStateMachine với conditionsMet xác thực từ Release Decision
    const transitionCheck = BatchStateMachine.canTransition(currentStatus, calculatedNextState, {
      actorRole: currentUser?.role,
      actorId: currentUser?.uid,
      reason: effectiveReason,
      conditionsMet: actionId === 'BATCH_RELEASE_APPROVE' ? releaseDecision?.eligible : undefined,
    });
    if (!transitionCheck.allowed) {
      throw new Error(`Quy chuẩn State Machine: ${transitionCheck.reason}`);
    }

    // 5. Chữ ký số 21 CFR Part 11 đối với BATCH_REJECT & BATCH_RECALL
    if (actionId === 'BATCH_REJECT' || actionId === 'BATCH_RECALL') {
      if (options?.requireSignature || options?.signature) {
        if (!options?.signature) {
          throw new Error(
            `Quy định 21 CFR Part 11: Yêu cầu chữ ký điện tử hợp lệ của QA/Admin trước khi thực hiện ${actionId}.`
          );
        }
        if (options.signature.documentId !== batchId) {
          throw new Error('Chữ ký điện tử không khớp với Lô sản xuất đang thao tác.');
        }
        const isValid = await signatureService.verifySignatureIntegrity(options.signature);
        if (!isValid) {
          throw new Error('Chữ ký điện tử không hợp lệ hoặc đã bị can thiệp trái phép.');
        }
      }
    }

    const newVersion = nextVersion(currentBatch.version ?? 1);
    const now = new Date().toISOString();
    const cleanBatch: Batch = {
      ...currentBatch,
      status: calculatedNextState,
      version: newVersion,
      updatedAt: now,
      ...(actionId === 'BATCH_RELEASE_APPROVE'
        ? {
            releasedAt: now,
            releasedBy: currentUser?.email || 'unknown',
            releaseDecisionSnapshot: releaseDecision,
            releaseStage: 'RELEASED' as const,
            releaseGateProgress: {
              completed: 7,
              total: 7 as const,
              currentGate: 8,
              percentage: 100,
              evaluatedAt: now,
            },
            releaseSignatures: options?.signature
              ? [
                  options.signature,
                  ...(Array.isArray(currentBatch.releaseSignatures)
                    ? currentBatch.releaseSignatures.filter(
                        (s: any) =>
                          ((s as any)?.id || (s as any)?.signatureId) !==
                          ((options.signature as any)?.id ||
                            (options.signature as any)?.signatureId)
                      )
                    : []),
                ]
              : currentBatch.releaseSignatures,
            qualityStatus: 'PASS' as const,
          }
        : {}),
      ...(actionId === 'BATCH_REJECT'
        ? {
            rejectReason: effectiveReason,
            rejectedAt: now,
            rejectedBy: currentUser?.email || 'unknown',
            releaseStage: 'REJECTED' as const,
            releaseGateProgress: {
              completed: 0,
              total: 7 as const,
              currentGate: 0,
              percentage: 0,
              evaluatedAt: now,
            },
          }
        : {}),
      ...(actionId === 'BATCH_HOLD'
        ? {
            holdReason: effectiveReason,
            heldAt: now,
            heldBy: currentUser?.email || 'unknown',
          }
        : {}),
      ...(actionId === 'BATCH_RESUME'
        ? {
            resumeReason: effectiveReason,
            resumedAt: now,
            resumedBy: currentUser?.email || 'unknown',
          }
        : {}),
      ...(actionId === 'BATCH_RECALL'
        ? {
            recallReason: effectiveReason,
            recalledAt: now,
            recalledBy: currentUser?.email || 'unknown',
            releaseStage: 'BLOCKED' as const,
          }
        : {}),
    };

    const repoMetadata: Partial<Batch> & { expectedVersion?: number } = {
      expectedVersion: options?.expectedVersion ?? currentBatch.version ?? 1,
      releasedAt: cleanBatch.releasedAt,
      releasedBy: cleanBatch.releasedBy,
      rejectReason: cleanBatch.rejectReason,
      rejectedAt: cleanBatch.rejectedAt,
      rejectedBy: cleanBatch.rejectedBy,
      holdReason: cleanBatch.holdReason,
      heldAt: cleanBatch.heldAt,
      heldBy: cleanBatch.heldBy,
      resumeReason: cleanBatch.resumeReason,
      resumedAt: cleanBatch.resumedAt,
      resumedBy: cleanBatch.resumedBy,
      recallReason: cleanBatch.recallReason,
      recalledAt: cleanBatch.recalledAt,
      recalledBy: cleanBatch.recalledBy,
      releaseDecisionSnapshot: cleanBatch.releaseDecisionSnapshot,
      releaseStage: cleanBatch.releaseStage,
      releaseGateProgress: cleanBatch.releaseGateProgress,
      releaseSignatures: cleanBatch.releaseSignatures,
      qualityStatus: cleanBatch.qualityStatus,
    };

    if (!flags.enableBatchWorkflowFacade) {
      if (actionId === 'BATCH_RELEASE_APPROVE' && this.repo instanceof FirebaseBatchRepository) {
        const releasePort = getReleaseCommandPort();
        const signatureId =
          options?.signature?.id || (options?.signature as any)?.signatureId || '';
        const idempotencyKey =
          options?.idempotencyKey ||
          `REL-CMD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const serverResult = await releasePort.executeRelease({
          batchId,
          expectedVersion: options?.expectedVersion ?? currentBatch.version ?? 1,
          signatureId,
          idempotencyKey,
        });
        cleanBatch.version = serverResult.newVersion;
        cleanBatch.status = 'RELEASED';
        cleanBatch.releasedAt = serverResult.releasedAt;
        return cleanBatch;
      }
      if (typeof this.repo.updateStatus === 'function') {
        await this.repo.updateStatus(batchId, calculatedNextState, effectiveReason, repoMetadata);
      } else {
        await this.repo.update(cleanBatch);
      }
      return cleanBatch;
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
        idempotencyKey: options?.idempotencyKey,
      },
      async () => {
        if (actionId === 'BATCH_RELEASE_APPROVE' && this.repo instanceof FirebaseBatchRepository) {
          const releasePort = getReleaseCommandPort();
          const signatureId =
            options?.signature?.id || (options?.signature as any)?.signatureId || '';
          const idempotencyKey =
            options?.idempotencyKey ||
            `REL-CMD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const serverResult = await releasePort.executeRelease({
            batchId,
            expectedVersion: options?.expectedVersion ?? currentBatch.version ?? 1,
            signatureId,
            idempotencyKey,
          });
          cleanBatch.version = serverResult.newVersion;
          cleanBatch.status = 'RELEASED';
          cleanBatch.releasedAt = serverResult.releasedAt;
          return cleanBatch;
        }

        if (typeof this.repo.updateStatus === 'function') {
          await this.repo.updateStatus(batchId, calculatedNextState, effectiveReason, repoMetadata);
        } else {
          await this.repo.update(cleanBatch);
        }
        return cleanBatch;
      },
      undefined,
      () => ({ nextState: calculatedNextState })
    );

    if (!execution.success) {
      const prefix = execution.failureCode ? `${execution.failureCode}: ` : '';
      throw new Error(
        execution.failureReason
          ? `${prefix}${execution.failureReason}`
          : `Lỗi chuyển trạng thái Lô sang ${calculatedNextState} qua Workflow.`
      );
    }

    return execution.data!;
  }

  /**
   * Intent API 1: Dispatch Testing
   * Sau khi dispatch thành công → sync release progress (gate 1-6 được tính lại)
   */
  async dispatchTesting(
    batchId: string,
    currentUser: any,
    options?: { expectedVersion?: number; idempotencyKey?: string }
  ): Promise<Batch> {
    const result = await this.executeBatchAction(
      'BATCH_DISPATCH_TESTING',
      batchId,
      currentUser,
      options
    );
    const progress = await this.synchronizer.syncBatchReleaseProgress({ batchId, batch: result });
    if (progress) {
      result.releaseStage = progress.releaseStage;
      result.releaseGateProgress = progress.releaseGateProgress;
    }
    return result;
  }

  /**
   * Intent API 2: Approve Release
   * Sau khi RELEASED thành công → sync stage = RELEASED
   */
  async approveRelease(
    batchId: string,
    currentUser: any,
    options?: {
      reason?: string;
      batchTestResults?: TestResult[];
      signature?: ElectronicSignature;
      expectedVersion?: number;
      idempotencyKey?: string;
    }
  ): Promise<Batch> {
    // Phase 10: Atomic RELEASED transaction đã ghi nhận status=RELEASED, releaseStage=RELEASED,
    // releaseGateProgress=7/7 và releaseSignatures cùng snapshot trong cùng một giao dịch nguyên tử.
    // Trả về trực tiếp canonical result, không gọi synchronizer lặp lại và không nuốt lỗi.
    const result = await this.executeBatchAction(
      'BATCH_RELEASE_APPROVE',
      batchId,
      currentUser,
      options
    );
    return result;
  }

  /**
   * Intent API 3: Reject Batch
   */
  async rejectBatch(
    batchId: string,
    reason: string,
    currentUser: any,
    options?: {
      signature?: ElectronicSignature;
      requireSignature?: boolean;
      expectedVersion?: number;
      idempotencyKey?: string;
    }
  ): Promise<Batch> {
    return this.executeBatchAction('BATCH_REJECT', batchId, currentUser, {
      ...options,
      reason,
    });
  }

  /**
   * Intent API 4: Hold Batch
   */
  async holdBatch(
    batchId: string,
    reason: string,
    currentUser: any,
    options?: {
      signature?: ElectronicSignature;
      expectedVersion?: number;
      idempotencyKey?: string;
    }
  ): Promise<Batch> {
    return this.executeBatchAction('BATCH_HOLD', batchId, currentUser, {
      ...options,
      reason,
    });
  }

  /**
   * Intent API 5: Resume Batch
   */
  async resumeBatch(
    batchId: string,
    reason: string,
    currentUser: any,
    options?: {
      expectedVersion?: number;
      idempotencyKey?: string;
    }
  ): Promise<Batch> {
    return this.executeBatchAction('BATCH_RESUME', batchId, currentUser, {
      ...options,
      reason,
    });
  }

  /**
   * Intent API 6: Recall Batch
   */
  async recallBatch(
    batchId: string,
    reason: string,
    currentUser: any,
    options?: {
      signature?: ElectronicSignature;
      requireSignature?: boolean;
      expectedVersion?: number;
      idempotencyKey?: string;
    }
  ): Promise<Batch> {
    return this.executeBatchAction('BATCH_RECALL', batchId, currentUser, {
      ...options,
      reason,
    });
  }

  /**
   * Tương thích ngược: Chuyển trạng thái Lô sản xuất qua Workflow Kernel
   * Tự động ánh xạ trạng thái sang Intent Action tương ứng
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
      idempotencyKey?: string;
    }
  ): Promise<Batch> {
    let currentBatch = options?.currentBatch || (await this.repo.findById(batchId));
    const currentStatus = currentBatch?.status || 'PENDING';

    let actionId: WorkflowActionId = 'BATCH_DISPATCH_TESTING';
    if (status === 'RELEASED') {
      actionId = 'BATCH_RELEASE_APPROVE';
    } else if (status === 'REJECTED') {
      actionId = 'BATCH_REJECT';
    } else if (status === 'BLOCKED') {
      actionId = currentStatus === 'RELEASED' ? 'BATCH_RECALL' : 'BATCH_HOLD';
    } else if (status === 'TESTING') {
      actionId = currentStatus === 'BLOCKED' ? 'BATCH_RESUME' : 'BATCH_DISPATCH_TESTING';
    }

    return this.executeBatchAction(actionId, batchId, currentUser, {
      ...options,
      currentBatch,
    });
  }

  /**
   * CORE BPR ACTION RUNNER: Chuyển trạng thái BPR qua Workflow Kernel
   */
  async executeBprAction(
    actionId: 'BPR_SUBMIT' | 'BPR_START_REVIEW' | 'BPR_APPROVE' | 'BPR_REJECT',
    batchId: string,
    currentUser: any,
    options?: {
      comment?: string;
      currentBatch?: Batch;
      expectedVersion?: number;
      idempotencyKey?: string;
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

    // 0. Idempotency Short-Circuit Check
    if (options?.idempotencyKey) {
      const cached = WorkflowFacade.getIdempotencyResult<Batch>(options.idempotencyKey);
      if (cached && cached.success && cached.data) {
        return cached.data;
      }
    }

    // 1. Phân quyền vai trò (Role check)
    BprStateMachine.verifyRole(actionId, actor.role);

    // 2. Tính toán trạng thái BPR tiếp theo qua BprStateMachine (SSoT)
    const nextBprStatus = BprStateMachine.resolveNextBprStatus(
      actionId,
      currentBatch.bprReviewStatus
    );

    // 3. Kiểm tra lý do bắt buộc với BPR_REJECT
    if (actionId === 'BPR_REJECT' && (!options?.comment || !options.comment.trim())) {
      throw new Error('Quy chuẩn GMP: Yêu cầu nhập lý do từ chối Hồ sơ sản xuất (BPR REJECT).');
    }

    const now = new Date().toISOString();
    const newVersion = nextVersion(currentBatch.version ?? 1);
    const updatedBatch: Batch = {
      ...currentBatch,
      bprReviewStatus: nextBprStatus,
      version: newVersion,
      updatedAt: now,
      ...(actionId === 'BPR_APPROVE'
        ? {
            bprReviewedAt: now,
            bprReviewedBy: actor.email || actor.name || actor.id,
            bprReviewComment: options?.comment || 'QA phê duyệt Hồ sơ sản xuất (BPR đạt chuẩn)',
          }
        : {}),
      ...(actionId === 'BPR_REJECT'
        ? {
            bprReviewedAt: now,
            bprReviewedBy: actor.email || actor.name || actor.id,
            bprReviewComment: options?.comment,
          }
        : {}),
      ...(actionId === 'BPR_START_REVIEW'
        ? {
            bprReviewComment: options?.comment,
          }
        : {}),
    };

    if (!flags.enableBatchWorkflowFacade) {
      if (typeof this.repo.updateBprReview === 'function') {
        return await this.repo.updateBprReview(batchId, nextBprStatus, {
          bprReviewedAt: updatedBatch.bprReviewedAt,
          bprReviewedBy: updatedBatch.bprReviewedBy,
          bprReviewComment: updatedBatch.bprReviewComment,
          expectedVersion: options?.expectedVersion ?? currentBatch.version ?? 1,
        });
      }
      await this.repo.update(updatedBatch);
      return updatedBatch;
    }

    const execution = await WorkflowFacade.dispatch<any, Batch>(
      {
        actionId,
        entityType: 'BATCH',
        entityId: batchId,
        actor,
        payload: { ...updatedBatch, currentVersion: currentBatch.version ?? 1 },
        expectedVersion: options?.expectedVersion ?? currentBatch.version ?? 1,
        idempotencyKey: options?.idempotencyKey,
        reason: options?.comment,
      },
      async () => {
        if (typeof this.repo.updateBprReview === 'function') {
          return await this.repo.updateBprReview(batchId, nextBprStatus, {
            bprReviewedAt: updatedBatch.bprReviewedAt,
            bprReviewedBy: updatedBatch.bprReviewedBy,
            bprReviewComment: updatedBatch.bprReviewComment,
            expectedVersion: options?.expectedVersion ?? currentBatch.version ?? 1,
          });
        }
        await this.repo.update(updatedBatch);
        return updatedBatch;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi xử lý BPR qua Workflow.');
    }

    const resultBatch = execution.data!;
    // Phase 14 & 19: Sau khi BPR status thay đổi (đặc biệt BPR_APPROVE qua Gate 6),
    // đồng bộ hóa tiến trình 7 Gate. Không được nuốt lỗi (fire-and-forget).
    const progress = await this.synchronizer.syncBatchReleaseProgress({
      batchId,
      batch: resultBatch,
      userRole: currentUser?.role,
    });
    if (progress) {
      resultBatch.releaseStage = progress.releaseStage;
      resultBatch.releaseGateProgress = progress.releaseGateProgress;
    }
    return resultBatch;
  }

  async submitBpr(
    batchId: string,
    currentUser: any,
    options?: { comment?: string; expectedVersion?: number; idempotencyKey?: string }
  ): Promise<Batch> {
    return this.executeBprAction('BPR_SUBMIT', batchId, currentUser, options);
  }

  async startBprReview(
    batchId: string,
    currentUser: any,
    options?: { comment?: string; expectedVersion?: number; idempotencyKey?: string }
  ): Promise<Batch> {
    return this.executeBprAction('BPR_START_REVIEW', batchId, currentUser, options);
  }

  async approveBpr(
    batchId: string,
    currentUser: any,
    options?: { comment?: string; expectedVersion?: number; idempotencyKey?: string }
  ): Promise<Batch> {
    return this.executeBprAction('BPR_APPROVE', batchId, currentUser, options);
  }

  async rejectBpr(
    batchId: string,
    reason: string,
    currentUser: any,
    options?: { expectedVersion?: number; idempotencyKey?: string }
  ): Promise<Batch> {
    return this.executeBprAction('BPR_REJECT', batchId, currentUser, {
      ...options,
      comment: reason,
    });
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
