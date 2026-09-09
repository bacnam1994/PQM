import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enqueueOfflineMutation,
  dequeueOfflineMutation,
  getPendingOfflineMutations,
  getOfflineQueueStats,
  pruneOfflineQueue,
  replayOfflineMutations,
  OfflineMutation
} from './offlineMutationQueue';
import * as conflictService from '../services/conflictResolutionService';
import * as firebaseDb from 'firebase/database';

// Giả lập In-Memory Store cho IndexedDB
const mockStoreMap = new Map<string, any>();

vi.mock('./offlineCache', () => ({
  initDB: vi.fn().mockImplementation(async () => {
    return {
      version: 4,
      objectStoreNames: {
        contains: (name: string) => true
      },
      transaction: (storeName: string, mode: string) => {
        const tx: any = {
          _oncomplete: null,
          set oncomplete(cb: any) {
            this._oncomplete = cb;
            if (cb) queueMicrotask(cb);
          },
          get oncomplete() {
            return this._oncomplete;
          },
          objectStore: (name: string) => ({
            put: (item: any) => mockStoreMap.set(item.id, item),
            delete: (id: string) => mockStoreMap.delete(id),
            get: (id: string) => {
              const req: any = {
                result: mockStoreMap.get(id),
                set onsuccess(cb: any) {
                  if (cb) queueMicrotask(cb);
                }
              };
              return req;
            },
            getAll: () => {
              const req: any = {
                result: Array.from(mockStoreMap.values()),
                set onsuccess(cb: any) {
                  if (cb) queueMicrotask(cb);
                }
              };
              return req;
            },
            count: () => {
              const req: any = {
                result: mockStoreMap.size,
                set onsuccess(cb: any) {
                  if (cb) queueMicrotask(cb);
                }
              };
              return req;
            },
            clear: () => mockStoreMap.clear()
          })
        };
        return tx;
      }
    };
  })
}));

vi.mock('../firebase', () => ({
  db: {}
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn((db, path) => ({ path })),
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../services/conflictResolutionService', () => ({
  resolveMutationConflict: vi.fn()
}));

describe('PQM 3.0 - Offline Mutation Queue & OCC Conflict Replay', () => {
  beforeEach(() => {
    mockStoreMap.clear();
    vi.clearAllMocks();
  });

  it('should enqueue and retrieve pending mutations with initial status PENDING', async () => {
    const id = await enqueueOfflineMutation({
      path: 'batches/b-101',
      operation: 'SET',
      data: { batchNo: 'B101', version: 1 },
      expectedVersion: 1
    });

    expect(id).toMatch(/^mut_/);
    const pending = await getPendingOfflineMutations();
    expect(pending).toHaveLength(1);
    expect(pending[0].path).toBe('batches/b-101');
    expect(pending[0].status).toBe('PENDING');
    expect(pending[0].expectedVersion).toBe(1);
  });

  it('should dequeue mutation correctly by id', async () => {
    const id = await enqueueOfflineMutation({
      path: 'batches/b-102',
      operation: 'UPDATE',
      data: { status: 'TESTING' }
    });

    expect((await getPendingOfflineMutations())).toHaveLength(1);
    await dequeueOfflineMutation(id);
    expect((await getPendingOfflineMutations())).toHaveLength(0);
  });

  it('should calculate accurate queue statistics (total, pending, conflict, failed)', async () => {
    // 1 Pending
    await enqueueOfflineMutation({ path: 'p1', operation: 'SET', data: {} });
    
    // 1 Conflict
    const mutConflict: OfflineMutation = {
      id: 'mut_conflict_1',
      path: 'p2',
      operation: 'UPDATE',
      status: 'CONFLICT',
      timestamp: Date.now(),
      retryCount: 0
    };
    mockStoreMap.set(mutConflict.id, mutConflict);

    // 1 Failed (retry >= 3)
    const mutFailed: OfflineMutation = {
      id: 'mut_failed_1',
      path: 'p3',
      operation: 'SET',
      status: 'PENDING',
      timestamp: Date.now(),
      retryCount: 3
    };
    mockStoreMap.set(mutFailed.id, mutFailed);

    const stats = await getOfflineQueueStats();
    expect(stats.total).toBe(3);
    expect(stats.pending).toBe(1);
    expect(stats.conflict).toBe(1);
    expect(stats.failed).toBe(1);
  });

  it('should prune expired or excessively retried mutations', async () => {
    // Bản ghi cũ 10 ngày trước (> maxAgeDays = 7)
    const oldMut: OfflineMutation = {
      id: 'mut_old',
      path: 'p_old',
      operation: 'SET',
      status: 'PENDING',
      timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000,
      retryCount: 0
    };
    mockStoreMap.set(oldMut.id, oldMut);

    // Bản ghi retry 6 lần (>= maxRetries = 5)
    const retriedMut: OfflineMutation = {
      id: 'mut_retried',
      path: 'p_retried',
      operation: 'UPDATE',
      status: 'PENDING',
      timestamp: Date.now(),
      retryCount: 6
    };
    mockStoreMap.set(retriedMut.id, retriedMut);

    // Bản ghi hợp lệ
    await enqueueOfflineMutation({ path: 'valid', operation: 'SET', data: {} });

    expect(mockStoreMap.size).toBe(3);
    const { prunedCount } = await pruneOfflineQueue({ maxAgeDays: 7, maxRetries: 5 });
    expect(prunedCount).toBe(2);
    expect(mockStoreMap.size).toBe(1);
    expect(mockStoreMap.has('mut_old')).toBe(false);
    expect(mockStoreMap.has('mut_retried')).toBe(false);
  });

  describe('replayOfflineMutations with OCC', () => {
    it('should replay normally when version matches (serverVersion <= expectedVersion)', async () => {
      await enqueueOfflineMutation({
        path: 'batches/b-200',
        operation: 'UPDATE',
        data: { packaging: 'Hộp 20 gói', version: 1 },
        expectedVersion: 1
      });

      // Mock server hiện tại có version = 1
      vi.mocked(firebaseDb.get).mockResolvedValue({
        exists: () => true,
        val: () => ({ id: 'b-200', version: 1, status: 'PENDING' })
      } as any);

      const result = await replayOfflineMutations();

      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.conflicts).toBe(0);
      expect(firebaseDb.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          packaging: 'Hộp 20 gói',
          version: 2 // Next version incremented
        })
      );
      expect(mockStoreMap.size).toBe(0); // Dequeued
    });

    it('should trigger Safe Merge when serverVersion > expectedVersion and fields do not conflict', async () => {
      await enqueueOfflineMutation({
        path: 'batches/b-300',
        operation: 'UPDATE',
        data: { notes: 'Offline remark' },
        expectedVersion: 1
      });

      // Server có version = 2 (đã được user khác update)
      vi.mocked(firebaseDb.get).mockResolvedValue({
        exists: () => true,
        val: () => ({ id: 'b-300', version: 2, status: 'TESTING' })
      } as any);

      // Conflict service giải quyết Safe Merge thành công
      vi.mocked(conflictService.resolveMutationConflict).mockResolvedValue({
        canAutoResolve: true,
        strategy: 'SAFE_MERGE',
        resolvedData: { id: 'b-300', status: 'TESTING', notes: 'Offline remark', version: 3 },
        conflictingFields: [],
        report: {} as any
      });

      const result = await replayOfflineMutations();

      expect(conflictService.resolveMutationConflict).toHaveBeenCalled();
      expect(result.success).toBe(1);
      expect(firebaseDb.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ notes: 'Offline remark', version: 3 })
      );
      expect(mockStoreMap.size).toBe(0); // Dequeued sau khi merge thành công
    });

    it('should mark mutation as CONFLICT and NOT overwrite server when direct field overlap occurs', async () => {
      await enqueueOfflineMutation({
        path: 'batches/b-400',
        operation: 'UPDATE',
        data: { status: 'RELEASED' },
        expectedVersion: 1
      });

      // Server có version = 2 (đã chuyển REJECTED)
      vi.mocked(firebaseDb.get).mockResolvedValue({
        exists: () => true,
        val: () => ({ id: 'b-400', version: 2, status: 'REJECTED' })
      } as any);

      // Conflict service báo không thể tự động giải quyết (Server Wins)
      vi.mocked(conflictService.resolveMutationConflict).mockResolvedValue({
        canAutoResolve: false,
        strategy: 'SERVER_WINS',
        resolvedData: { id: 'b-400', version: 2, status: 'REJECTED' },
        conflictingFields: ['status'],
        report: { id: 'rep_1' } as any
      });

      const result = await replayOfflineMutations();

      expect(result.conflicts).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.success).toBe(0);

      // Mutation vẫn nằm trong store nhưng có status = 'CONFLICT'
      const pending = Array.from(mockStoreMap.values());
      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe('CONFLICT');
      expect(pending[0].conflictDetails).toBeDefined();
    });
  });
});
