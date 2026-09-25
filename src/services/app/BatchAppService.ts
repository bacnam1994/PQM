/**
 * PQM 3.0 - Batch Application Service
 * Điều phối các nghiệp vụ quản lý Lô sản xuất qua BatchWorkflowHandlers & WorkflowFacade:
 * RBAC Authorization, Validation, State Machine, Schema Snapshotting (TCCS & Formula) & OCC
 */

import { Batch, TestResult, TCCS, ProductFormula, ElectronicSignature } from '../../types';
import { IBatchRepository } from '../../repositories/BatchRepository';
import { batchRepository as defaultBatchRepo } from '../../repositories/firebase/FirebaseBatchRepository';
import { can } from '../permissionService';
import {
  BatchWorkflowHandlers,
  BatchCreationContext,
} from '../../workflow/handlers/batchWorkflowHandlers';

export type { BatchCreationContext };

export class BatchAppService {
  private workflowHandlers: BatchWorkflowHandlers;

  constructor(private repo: IBatchRepository = defaultBatchRepo) {
    this.workflowHandlers = new BatchWorkflowHandlers(this.repo);
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
    let currentBatch = await this.repo.findById(batchId);
    if (!currentBatch && options?.currentBatch) {
      currentBatch = options.currentBatch;
    }
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

    await this.workflowHandlers.handleStatusTransition(batchId, status, currentUser, {
      ...options,
      currentBatch,
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

    await this.workflowHandlers.handleDelete(id, currentUser, batchNo);
  }
}

export const batchAppService = new BatchAppService();
