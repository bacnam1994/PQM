/**
 * PQM 3.0 & V4 Platform - Firebase Batch Repository Implementation
 * Triển khai lưu trữ lô sản xuất trên Firebase Realtime Database có hỗ trợ Offline Queue
 * Kế thừa BaseFirebaseRepository: phân trang cursor/offset, lọc server-side & đếm số lượng.
 */

import { ref, update, get, runTransaction } from 'firebase/database';
import { db } from '../../firebase';
import { Batch, BatchReleaseStage, BatchReleaseGateProgress } from '../../types';
import { IBatchRepository } from '../BatchRepository';
import { BaseFirebaseRepository } from './BaseFirebaseRepository';
import { deleteBatchService } from '../../services/databaseService';
import { removeUndefined } from '../../utils';

export class FirebaseBatchRepository
  extends BaseFirebaseRepository<Batch>
  implements IBatchRepository
{
  protected readonly collectionPath = 'batches';

  async findByBatchNo(batchNo: string): Promise<Batch | null> {
    const target = batchNo.trim().toLowerCase();
    const results = await this.findByRelation('batchNo', target);
    return results[0] || null;
  }

  async findByProductId(productId: string): Promise<Batch[]> {
    return this.findByRelation('productId', productId);
  }

  async findByStatus(status: Batch['status']): Promise<Batch[]> {
    return this.findByRelation('status', status);
  }

  async findTestResultsByBatchId(batchId: string): Promise<import('../../types').TestResult[]> {
    const { testResultRepository } = await import('./FirebaseTestResultRepository');
    return testResultRepository.findByRelation('batchId', batchId);
  }

  async findRecent(limitCount: number): Promise<Batch[]> {
    const result = await this.findPaginated({
      pageSize: limitCount,
      orderBy: 'mfgDate',
      orderDirection: 'desc',
    });
    return result.items;
  }

  async updateStatus(
    batchId: string,
    status: Batch['status'],
    reason?: string,
    metadata?: Partial<Batch> & { expectedVersion?: number }
  ): Promise<void> {
    if (!batchId) throw new Error('Yêu cầu ID lô sản xuất');
    const targetPath = `${this.collectionPath}/${batchId}`;
    const batchRef = ref(db, targetPath);

    const now = new Date().toISOString();
    const expectedVersion = metadata?.expectedVersion;

    try {
      // OCC Atomic Transaction trên Firebase Realtime Database
      const txResult = await runTransaction(batchRef, (currentBatch) => {
        if (!currentBatch) {
          return currentBatch;
        }

        const currentVersion = currentBatch.version ?? 1;
        if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
          // Xung đột phiên bản: Version trên máy chủ khác với version mong đợi -> Abort
          return undefined;
        }

        const newVersion = currentVersion + 1;
        const updatedBatch: Record<string, any> = {
          ...currentBatch,
          status,
          version: newVersion,
          updatedAt: now,
        };

        if (status === 'RELEASED') {
          updatedBatch.releasedAt = metadata?.releasedAt || now;
          updatedBatch.releasedBy = metadata?.releasedBy || 'QA/Admin';
          updatedBatch.releaseStage = 'RELEASED';
          updatedBatch.releaseGateProgress = {
            completed: 7,
            total: 7,
            currentGate: 8,
            percentage: 100,
            evaluatedAt: now,
          };
          if (metadata?.releaseDecisionSnapshot !== undefined) {
            updatedBatch.releaseDecisionSnapshot = metadata.releaseDecisionSnapshot;
          }
        } else if (status === 'REJECTED') {
          updatedBatch.rejectReason =
            reason || metadata?.rejectReason || currentBatch.rejectReason || null;
          updatedBatch.rejectedAt = metadata?.rejectedAt || now;
          updatedBatch.rejectedBy = metadata?.rejectedBy || 'QA/Admin';
          updatedBatch.releaseStage = 'REJECTED';
        } else if (status === 'BLOCKED') {
          if (currentBatch.status === 'RELEASED') {
            updatedBatch.recallReason =
              reason || metadata?.recallReason || currentBatch.recallReason || null;
            updatedBatch.recalledAt = metadata?.recalledAt || now;
            updatedBatch.recalledBy = metadata?.recalledBy || 'QA/Admin';
          } else {
            updatedBatch.holdReason =
              reason || metadata?.holdReason || currentBatch.holdReason || null;
            updatedBatch.heldAt = metadata?.heldAt || now;
            updatedBatch.heldBy = metadata?.heldBy || 'QA/Admin';
          }
        } else if (status === 'TESTING' && currentBatch.status === 'BLOCKED') {
          updatedBatch.resumeReason =
            reason || metadata?.resumeReason || currentBatch.resumeReason || null;
          updatedBatch.resumedAt = metadata?.resumedAt || now;
          updatedBatch.resumedBy = metadata?.resumedBy || 'QA/Admin';
        }

        if (metadata) {
          const { expectedVersion: _, ...restMeta } = metadata;
          Object.assign(updatedBatch, restMeta);
          // Bảo toàn status và version đã tính qua OCC
          updatedBatch.status = status;
          updatedBatch.version = newVersion;
        }

        // BỘ LỌC CHUẨN HÓA: Loại bỏ toàn bộ undefined trước khi commit transaction
        return removeUndefined(updatedBatch);
      });

      if (!txResult || !txResult.committed) {
        throw new Error(
          `CONCURRENCY_CONFLICT: Xung đột phiên bản cập nhật Lô (${batchId}). Dữ liệu đã bị thay đổi bởi tác vụ khác.`
        );
      }
    } catch (err: any) {
      if (err.message && err.message.includes('CONCURRENCY_CONFLICT')) {
        throw err;
      }
      // P0 – FIREBASE OCC MUST FAIL CLOSED:
      // Tuyệt đối không fallback get()->update() khi gặp lỗi production (network, permission, abort, conflict...).
      // Chỉ cho phép fallback duy nhất trong môi trường test/mock rõ ràng khi mock framework không cài đặt runTransaction.
      const isExplicitMockEnv =
        (typeof process !== 'undefined' &&
          (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST))) ||
        (typeof window !== 'undefined' &&
          Boolean((window as any).__PQM_TEST_MOCK_NO_TRANSACTION__));

      const isTransactionUnsupported =
        typeof runTransaction !== 'function' ||
        (err?.message &&
          (err.message.includes('not a function') || err.message.includes('not implemented')));

      if (!isExplicitMockEnv || !isTransactionUnsupported) {
        throw err;
      }

      // Explicit test/mock fallback ONLY when runTransaction is not supported
      const snapshot = await get(batchRef);
      if (snapshot && typeof snapshot.exists === 'function' && snapshot.exists()) {
        const currentBatch = snapshot.val();
        const currentVersion = currentBatch?.version ?? 1;
        if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
          throw new Error(
            `CONCURRENCY_CONFLICT: Xung đột phiên bản cập nhật Lô (${batchId}). Phiên bản hiện tại là ${currentVersion}, kỳ vọng ${expectedVersion}.`
          );
        }
        const newVersion = currentVersion + 1;
        const rawUpdates: Record<string, any> = {
          status,
          version: newVersion,
          updatedAt: now,
          ...(status === 'RELEASED'
            ? {
                releasedAt: metadata?.releasedAt || now,
                releasedBy: metadata?.releasedBy || 'QA/Admin',
                releaseDecisionSnapshot: metadata?.releaseDecisionSnapshot || null,
                releaseStage: 'RELEASED',
                releaseGateProgress: {
                  completed: 7,
                  total: 7,
                  currentGate: 8,
                  percentage: 100,
                  evaluatedAt: now,
                },
              }
            : {}),
          ...(status === 'REJECTED'
            ? {
                rejectReason: reason || metadata?.rejectReason || currentBatch.rejectReason || null,
                rejectedAt: metadata?.rejectedAt || now,
                rejectedBy: metadata?.rejectedBy || 'QA/Admin',
                releaseStage: 'REJECTED',
              }
            : {}),
          ...(status === 'BLOCKED'
            ? currentBatch.status === 'RELEASED'
              ? {
                  recallReason:
                    reason || metadata?.recallReason || currentBatch.recallReason || null,
                  recalledAt: metadata?.recalledAt || now,
                  recalledBy: metadata?.recalledBy || 'QA/Admin',
                }
              : {
                  holdReason: reason || metadata?.holdReason || currentBatch.holdReason || null,
                  heldAt: metadata?.heldAt || now,
                  heldBy: metadata?.heldBy || 'QA/Admin',
                }
            : {}),
          ...(status === 'TESTING' && currentBatch.status === 'BLOCKED'
            ? {
                resumeReason: reason || metadata?.resumeReason || currentBatch.resumeReason || null,
                resumedAt: metadata?.resumedAt || now,
                resumedBy: metadata?.resumedBy || 'QA/Admin',
              }
            : {}),
        };
        if (metadata) {
          const { expectedVersion: _, ...rest } = metadata;
          Object.assign(rawUpdates, rest);
          rawUpdates.status = status;
          rawUpdates.version = newVersion;
        }
        const cleanUpdates = removeUndefined(rawUpdates);
        await update(batchRef, cleanUpdates);
        return;
      }

      // Trường hợp không đọc được snapshot trong mock environment
      throw new Error(
        `MOCK_TRANSACTION_FAILED: Không tìm thấy snapshot cho Lô (${batchId}) trong mock environment.`
      );
    }
  }

  async updateProgress(batchId: string, progressPercent: number): Promise<void> {
    if (!batchId) throw new Error('Yêu cầu ID lô sản xuất');
    const rawUpdates = { progressPercent };
    const cleanUpdates = removeUndefined(rawUpdates);
    const targetPath = `${this.collectionPath}/${batchId}`;
    await update(ref(db, targetPath), cleanUpdates);
  }

  async updateBprReview(
    batchId: string,
    bprReviewStatus: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED',
    metadata?: {
      bprReviewedAt?: string;
      bprReviewedBy?: string;
      bprReviewComment?: string;
      expectedVersion?: number;
    }
  ): Promise<Batch> {
    if (!batchId) throw new Error('Yêu cầu ID lô sản xuất');
    const batchRef = ref(db, `${this.collectionPath}/${batchId}`);
    const now = new Date().toISOString();
    let updatedBatchResult: Batch | null = null;

    try {
      const txResult = await runTransaction(batchRef, (currentBatch) => {
        if (!currentBatch) return currentBatch;

        const currentVersion = currentBatch.version ?? 1;
        if (
          metadata?.expectedVersion !== undefined &&
          currentVersion !== metadata.expectedVersion
        ) {
          return;
        }

        const newVersion = currentVersion + 1;
        const updatedBatch: Record<string, any> = {
          ...currentBatch,
          bprReviewStatus,
          version: newVersion,
          updatedAt: now,
        };

        if (metadata?.bprReviewedAt) updatedBatch.bprReviewedAt = metadata.bprReviewedAt;
        if (metadata?.bprReviewedBy) updatedBatch.bprReviewedBy = metadata.bprReviewedBy;
        if (metadata?.bprReviewComment !== undefined) {
          updatedBatch.bprReviewComment = metadata.bprReviewComment || null;
        }

        const cleanBatch = removeUndefined(updatedBatch);
        updatedBatchResult = cleanBatch as Batch;
        return cleanBatch;
      });

      if (!txResult || !txResult.committed) {
        throw new Error(
          `CONCURRENCY_CONFLICT: Xung đột phiên bản cập nhật BPR Lô (${batchId}). Dữ liệu đã bị thay đổi bởi tác vụ khác.`
        );
      }

      return updatedBatchResult!;
    } catch (err: any) {
      if (err.message && err.message.includes('CONCURRENCY_CONFLICT')) {
        throw err;
      }
      const isExplicitMockEnv =
        (typeof process !== 'undefined' &&
          (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST))) ||
        (typeof window !== 'undefined' &&
          Boolean((window as any).__PQM_TEST_MOCK_NO_TRANSACTION__));

      const isTransactionUnsupported =
        typeof runTransaction !== 'function' ||
        (err?.message &&
          (err.message.includes('not a function') || err.message.includes('not implemented')));

      if (!isExplicitMockEnv || !isTransactionUnsupported) {
        throw err;
      }

      const snapshot = await get(batchRef);
      if (snapshot && typeof snapshot.exists === 'function' && snapshot.exists()) {
        const currentBatch = snapshot.val();
        const currentVersion = currentBatch?.version ?? 1;
        if (
          metadata?.expectedVersion !== undefined &&
          currentVersion !== metadata.expectedVersion
        ) {
          throw new Error(`CONCURRENCY_CONFLICT: Xung đột phiên bản cập nhật BPR Lô (${batchId}).`);
        }
        const newVersion = currentVersion + 1;
        const updatedBatch: Batch = {
          ...currentBatch,
          bprReviewStatus,
          version: newVersion,
          updatedAt: now,
          ...(metadata?.bprReviewedAt ? { bprReviewedAt: metadata.bprReviewedAt } : {}),
          ...(metadata?.bprReviewedBy ? { bprReviewedBy: metadata.bprReviewedBy } : {}),
          ...(metadata?.bprReviewComment !== undefined
            ? { bprReviewComment: metadata.bprReviewComment || null }
            : {}),
        };
        const cleanBatch = removeUndefined(updatedBatch);
        await update(batchRef, cleanBatch);
        return cleanBatch;
      }
      throw new Error(`MOCK_TRANSACTION_FAILED: Không tìm thấy snapshot cho Lô (${batchId}).`);
    }
  }

  async updateReleaseProgress(
    batchId: string,
    releaseStage: BatchReleaseStage,
    releaseGateProgress: BatchReleaseGateProgress,
    options?: { expectedVersion?: number }
  ): Promise<Batch> {
    if (!batchId) throw new Error('Yêu cầu ID lô sản xuất');
    const batchRef = ref(db, `${this.collectionPath}/${batchId}`);
    const now = new Date().toISOString();
    let updatedBatchResult: Batch | null = null;

    try {
      const txResult = await runTransaction(batchRef, (currentBatch) => {
        if (!currentBatch) return currentBatch;

        // P0-2: Không cho phép progress writer ghi đè trạng thái RELEASED / REJECTED
        if (currentBatch.status === 'RELEASED' || currentBatch.releaseStage === 'RELEASED') {
          if (releaseStage !== 'RELEASED') {
            // Đã xuất xưởng -> Chặn đứng stale write (ví dụ 6/7 hoặc GATE_6 chạy sau)
            return; // Abort transaction
          }
        }

        if (currentBatch.status === 'REJECTED' || currentBatch.releaseStage === 'REJECTED') {
          if (releaseStage !== 'REJECTED') {
            return; // Abort transaction
          }
        }

        const currentVersion = currentBatch.version ?? 1;
        if (options?.expectedVersion !== undefined && currentVersion !== options.expectedVersion) {
          return; // Abort on version mismatch
        }

        // P0-1: Tăng version khi cập nhật releaseGateProgress để bảo toàn OCC
        const newVersion = currentVersion + 1;
        const updatedBatch: Batch = {
          ...currentBatch,
          releaseStage,
          releaseGateProgress,
          version: newVersion,
          updatedAt: now,
        };
        const cleanBatch = removeUndefined(updatedBatch);
        updatedBatchResult = cleanBatch;
        return cleanBatch;
      });

      if (!txResult || !txResult.committed) {
        // Kiểm tra xem có phải do lô đã RELEASED không
        const currentSnap = await get(batchRef);
        const latest = currentSnap.exists() ? currentSnap.val() : null;
        if (latest && (latest.status === 'RELEASED' || latest.releaseStage === 'RELEASED')) {
          return latest as Batch;
        }
        throw new Error(
          `CONCURRENCY_CONFLICT: Xung đột phiên bản cập nhật tiến trình Lô (${batchId}).`
        );
      }

      return updatedBatchResult || (txResult.snapshot.val() as Batch);
    } catch (err: any) {
      if (err.message && err.message.includes('CONCURRENCY_CONFLICT')) {
        throw err;
      }

      const isExplicitMockEnv =
        (typeof process !== 'undefined' &&
          (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST))) ||
        (typeof window !== 'undefined' &&
          Boolean((window as any).__PQM_TEST_MOCK_NO_TRANSACTION__));

      const isTransactionUnsupported =
        typeof runTransaction !== 'function' ||
        (err?.message &&
          (err.message.includes('not a function') || err.message.includes('not implemented')));

      if (!isExplicitMockEnv || !isTransactionUnsupported) {
        throw err;
      }

      // Explicit mock environment fallback
      const snapshot = await get(batchRef);
      if (snapshot && typeof snapshot.exists === 'function' && snapshot.exists()) {
        const currentBatch = snapshot.val();
        if (currentBatch.status === 'RELEASED' || currentBatch.releaseStage === 'RELEASED') {
          if (releaseStage !== 'RELEASED') {
            return currentBatch;
          }
        }
        const currentVersion = currentBatch?.version ?? 1;
        if (options?.expectedVersion !== undefined && currentVersion !== options.expectedVersion) {
          throw new Error(`CONCURRENCY_CONFLICT: Xung đột phiên bản (${batchId}).`);
        }
        const newVersion = currentVersion + 1;
        const updatedBatch: Batch = {
          ...currentBatch,
          releaseStage,
          releaseGateProgress,
          version: newVersion,
          updatedAt: now,
        };
        const cleanBatch = removeUndefined(updatedBatch);
        await update(batchRef, cleanBatch);
        return cleanBatch;
      }
      throw new Error(`MOCK_TRANSACTION_FAILED: Không tìm thấy snapshot cho Lô (${batchId}).`);
    }
  }

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Yêu cầu ID lô sản xuất để xóa.');
    await deleteBatchService(id);
  }
}

export const batchRepository = new FirebaseBatchRepository();
