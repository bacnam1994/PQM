/**
 * BATCH DOMAIN: APPLICATION SERVICE
 *
 * Điều phối các nghiệp vụ quản lý Lô sản xuất qua BatchWorkflowHandlers & WorkflowFacade:
 * RBAC Authorization, Validation, State Machine, Schema Snapshotting (TCCS & Formula) & OCC
 */

import { Batch, TestResult, ElectronicSignature, IBatchRepository } from '../domain/types';
import { defaultBatchRepo } from '../infrastructure/repository';
import { can } from '../../../services/permissionService';
import {
  BatchWorkflowHandlers,
  BatchCreationContext,
} from '../../../workflow/handlers/batchWorkflowHandlers';

export type { BatchCreationContext };

export class BatchAppService {
  private workflowHandlers: BatchWorkflowHandlers;

  constructor(private repo: IBatchRepository = defaultBatchRepo) {
    this.workflowHandlers = new BatchWorkflowHandlers(this.repo);
  }

  /**
   * Lấy chi tiết Lô sản xuất theo ID
   */
  async getBatchById(id: string): Promise<Batch | null> {
    return this.repo.findById(id);
  }

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
    await this.workflowHandlers.handleCreate(batch, currentUser, existingBatches, context);
  }

  /**
   * Cập nhật thông tin Lô sản xuất có bảo vệ Optimistic Concurrency Control (OCC)
   */
  async updateBatch(batch: Batch, currentUser: any, oldBatch?: Batch): Promise<void> {
    const old = oldBatch || (await this.repo.findById(batch.id));

    if (!can(currentUser, 'batch:update', old)) {
      throw new Error('Từ chối quyền: Bạn không có quyền cập nhật thông tin lô sản xuất này.');
    }

    if (old && batch.status && batch.status !== old.status) {
      throw new Error(
        'Không được thay đổi Workflow Status thông qua updateBatch(). Hãy sử dụng Workflow Action tương ứng.'
      );
    }

    await this.workflowHandlers.handleUpdate(batch, currentUser, oldBatch);
  }

  /**
   * Cập nhật trạng thái Lô sản xuất qua Workflow State Machine & Release Guard
   * Luôn thực hiện Fresh DB Read (WF-018), không phụ thuộc vào cache client
   */
  /**
   * Cập nhật trạng thái Lô sản xuất qua Workflow State Machine & Release Guard
   * Luôn thực hiện Fresh DB Read (WF-018), không phụ thuộc vào cache client
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
      expectedVersion?: number;
      idempotencyKey?: string;
    }
  ): Promise<void> {
    let currentBatch = await this.repo.findById(batchId);
    if (!currentBatch && options?.currentBatch) {
      currentBatch = options.currentBatch;
    }
    if (!currentBatch) {
      throw new Error(`Không tìm thấy Lô sản xuất với mã: ${batchId}`);
    }

    // 1. Phân quyền chuyển đổi trạng thái & P1-8 Deprecate updateStatus(..., 'RELEASED')
    if (status === 'RELEASED') {
      console.warn(
        '[DEPRECATION WARNING] updateStatus(id, "RELEASED") is deprecated. Use approveRelease() instead.'
      );
      if (!can(currentUser, 'batch:release', currentBatch)) {
        throw new Error(
          'Từ chối quyền: Chỉ bộ phận QA hoặc Quản trị viên mới có thẩm quyền xuất xưởng lô.'
        );
      }
      if (!options?.signature && !options?.batchTestResults && !options?.currentBatch) {
        throw new Error(
          'Deprecated API Violation (P1-8): Không được gọi trực tiếp updateStatus(..., "RELEASED"). Bắt buộc sử dụng canonical approveRelease() kèm chữ ký điện tử 21 CFR Part 11.'
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

    await this.workflowHandlers.handleStatusTransition(batchId, status, currentUser, {
      ...options,
      currentBatch,
    });
  }

  async dispatchTesting(
    batchId: string,
    currentUser: any,
    options?: { expectedVersion?: number; idempotencyKey?: string }
  ): Promise<Batch> {
    return this.workflowHandlers.dispatchTesting(batchId, currentUser, options);
  }

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
    return this.workflowHandlers.approveRelease(batchId, currentUser, options);
  }

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
    return this.workflowHandlers.rejectBatch(batchId, reason, currentUser, options);
  }

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
    return this.workflowHandlers.holdBatch(batchId, reason, currentUser, options);
  }

  async resumeBatch(
    batchId: string,
    reason: string,
    currentUser: any,
    options?: {
      expectedVersion?: number;
      idempotencyKey?: string;
    }
  ): Promise<Batch> {
    return this.workflowHandlers.resumeBatch(batchId, reason, currentUser, options);
  }

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
    return this.workflowHandlers.recallBatch(batchId, reason, currentUser, options);
  }

  // --- BPR REVIEW WORKFLOW (GATE 6) ---
  async submitBpr(
    batchId: string,
    currentUser: any,
    options?: { comment?: string; expectedVersion?: number; idempotencyKey?: string }
  ): Promise<Batch> {
    return this.workflowHandlers.submitBpr(batchId, currentUser, options);
  }

  async startBprReview(
    batchId: string,
    currentUser: any,
    options?: { comment?: string; expectedVersion?: number; idempotencyKey?: string }
  ): Promise<Batch> {
    return this.workflowHandlers.startBprReview(batchId, currentUser, options);
  }

  async approveBpr(
    batchId: string,
    currentUser: any,
    options?: { comment?: string; expectedVersion?: number; idempotencyKey?: string }
  ): Promise<Batch> {
    return this.workflowHandlers.approveBpr(batchId, currentUser, options);
  }

  async rejectBpr(
    batchId: string,
    reason: string,
    currentUser: any,
    options?: { expectedVersion?: number; idempotencyKey?: string }
  ): Promise<Batch> {
    return this.workflowHandlers.rejectBpr(batchId, reason, currentUser, options);
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

    await this.workflowHandlers.handleDelete(id, currentUser, batchNo);
  }
}

export const batchAppService = new BatchAppService();
