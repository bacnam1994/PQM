import { ref, get, set as firebaseSet, update as firebaseUpdate, remove as firebaseRemove } from 'firebase/database';
import { db } from '../firebase';
import { initDB } from './offlineCache';
import { nextVersion } from './concurrency';
import { resolveMutationConflict } from '../services/conflictResolutionService';

export interface OfflineMutation {
  id: string;
  path: string;
  operation: 'SET' | 'UPDATE' | 'REMOVE';
  data?: any;
  expectedVersion?: number;
  status?: 'PENDING' | 'REPLAYING' | 'CONFLICT' | 'RESOLVED';
  conflictDetails?: any;
  timestamp: number;
  retryCount: number;
}

const STORE_NAME = 'offlineMutations';

/**
 * Đảm bảo store offlineMutations tồn tại trong IndexedDB
 */
const getMutationStore = async (mode: IDBTransactionMode = 'readonly'): Promise<{ db: IDBDatabase; tx: IDBTransaction; store: IDBObjectStore }> => {
  const database = await initDB();
  if (!database.objectStoreNames.contains(STORE_NAME)) {
    // Nếu store chưa có (do version cũ), đóng db và nâng version
    database.close();
    const newVersion = database.version + 1;
    const upgradeDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('QA_Manager_DB', newVersion);
      req.onupgradeneeded = (e: any) => {
        const d = e.target.result as IDBDatabase;
        if (!d.objectStoreNames.contains(STORE_NAME)) {
          d.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = upgradeDb.transaction(STORE_NAME, mode);
    return { db: upgradeDb, tx, store: tx.objectStore(STORE_NAME) };
  }
  const tx = database.transaction(STORE_NAME, mode);
  return { db: database, tx, store: tx.objectStore(STORE_NAME) };
};

/**
 * Thêm một thao tác ghi vào hàng đợi ngoại tuyến
 */
export const enqueueOfflineMutation = async (
  mutation: Omit<OfflineMutation, 'id' | 'timestamp' | 'retryCount'>
): Promise<string> => {
  const id = `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const item: OfflineMutation = {
    ...mutation,
    id,
    status: mutation.status || 'PENDING',
    timestamp: Date.now(),
    retryCount: 0
  };

  try {
    const { store, tx } = await getMutationStore('readwrite');
    store.put(item);
    await new Promise((resolve) => { tx.oncomplete = resolve; });
    return id;
  } catch (error) {
    console.warn('[OfflineQueue] Không thể enqueue mutation:', error);
    return id;
  }
};

/**
 * Xóa một thao tác khỏi hàng đợi sau khi đã đồng bộ thành công
 */
export const dequeueOfflineMutation = async (id: string): Promise<void> => {
  try {
    const { store, tx } = await getMutationStore('readwrite');
    store.delete(id);
    await new Promise((resolve) => { tx.oncomplete = resolve; });
  } catch (error) {
    console.warn(`[OfflineQueue] Không thể xóa mutation ${id}:`, error);
  }
};

/**
 * Lấy toàn bộ danh sách các thao tác đang chờ phát lại
 */
export const getPendingOfflineMutations = async (): Promise<OfflineMutation[]> => {
  try {
    const { store } = await getMutationStore('readonly');
    const req = store.getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const list = (req.result || []) as OfflineMutation[];
        list.sort((a, b) => a.timestamp - b.timestamp);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('[OfflineQueue] Lỗi đọc pending mutations:', error);
    return [];
  }
};

/**
 * Lấy số lượng thao tác đang chờ xử lý
 */
export const getPendingMutationsCount = async (): Promise<number> => {
  try {
    const { store } = await getMutationStore('readonly');
    const req = store.count();
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch (error) {
    return 0;
  }
};

/**
 * Thống kê chi tiết trạng thái hàng đợi ngoại tuyến
 */
export const getOfflineQueueStats = async (): Promise<{
  total: number;
  pending: number;
  conflict: number;
  failed: number;
}> => {
  try {
    const mutations = await getPendingOfflineMutations();
    let pending = 0;
    let conflict = 0;
    let failed = 0;

    for (const m of mutations) {
      if (m.status === 'CONFLICT') {
        conflict++;
      } else if ((m.retryCount || 0) >= 3) {
        failed++;
      } else {
        pending++;
      }
    }

    return {
      total: mutations.length,
      pending,
      conflict,
      failed
    };
  } catch (error) {
    console.warn('[OfflineQueue] Lỗi thống kê hàng đợi:', error);
    return { total: 0, pending: 0, conflict: 0, failed: 0 };
  }
};

/**
 * Dọn dẹp các mutation cũ quá hạn hoặc lỗi quá số lần thử lại (Cache Hygiene)
 */
export const pruneOfflineQueue = async (options: {
  maxAgeDays?: number;
  maxRetries?: number;
} = {}): Promise<{ prunedCount: number }> => {
  const { maxAgeDays = 7, maxRetries = 5 } = options;
  const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let prunedCount = 0;

  try {
    const mutations = await getPendingOfflineMutations();
    const { store, tx } = await getMutationStore('readwrite');

    for (const m of mutations) {
      const isExpired = m.timestamp < cutoffTime;
      const isMaxRetried = (m.retryCount || 0) >= maxRetries;
      const isResolved = m.status === 'RESOLVED';

      if (isExpired || isMaxRetried || isResolved) {
        store.delete(m.id);
        prunedCount++;
      }
    }

    await new Promise((resolve) => { tx.oncomplete = resolve; });
  } catch (error) {
    console.warn('[OfflineQueue] Lỗi dọn dẹp hàng đợi:', error);
  }

  return { prunedCount };
};

/**
 * Xóa sạch toàn bộ hàng đợi ngoại tuyến (sử dụng khi kiểm thử hoặc reset dữ liệu)
 */
export const clearAllOfflineMutations = async (): Promise<void> => {
  try {
    const { store, tx } = await getMutationStore('readwrite');
    store.clear();
    await new Promise((resolve) => { tx.oncomplete = resolve; });
  } catch (error) {
    console.warn('[OfflineQueue] Lỗi xóa sạch hàng đợi:', error);
  }
};

let isReplaying = false;

/**
 * Tự động phát lại (Replay) toàn bộ hàng đợi ngoại tuyến lên Firebase
 * Có tích hợp kiểm tra phiên bản OCC và Phân giải Xung đột An toàn (Conflict Resolution)
 */
export const replayOfflineMutations = async (
  onProgress?: (remainingCount: number) => void
): Promise<{ success: number; failed: number; conflicts: number }> => {
  if (isReplaying) return { success: 0, failed: 0, conflicts: 0 };
  isReplaying = true;

  let successCount = 0;
  let failedCount = 0;
  let conflictCount = 0;

  try {
    const mutations = await getPendingOfflineMutations();
    if (mutations.length === 0) {
      isReplaying = false;
      return { success: 0, failed: 0, conflicts: 0 };
    }

    for (let i = 0; i < mutations.length; i++) {
      const mut = mutations[i];

      // Bỏ qua các mutation đã xác nhận là CONFLICT trực tiếp (chờ QA can thiệp)
      if (mut.status === 'CONFLICT') {
        conflictCount++;
        continue;
      }

      try {
        const targetRef = mut.path ? ref(db, mut.path) : ref(db);

        if (mut.operation === 'REMOVE') {
          await firebaseRemove(targetRef);
          await dequeueOfflineMutation(mut.id);
          successCount++;
        } else if (mut.operation === 'SET' || mut.operation === 'UPDATE') {
          // 1. Đọc dữ liệu hiện tại từ máy chủ để kiểm tra phiên bản OCC
          let serverSnapshot: any = null;
          try {
            serverSnapshot = await get(targetRef);
          } catch (fetchErr) {
            console.warn(`[OfflineQueue] Không thể đọc snapshot ${mut.path}:`, fetchErr);
          }

          if (serverSnapshot && serverSnapshot.exists()) {
            const serverData = serverSnapshot.val();
            const serverVersion = typeof serverData?.version === 'number' ? serverData.version : 1;
            const expectedVersion = mut.expectedVersion ?? (typeof mut.data?.version === 'number' ? mut.data.version : undefined);

            // 2. Kiểm tra xung đột phiên bản: serverVersion > expectedVersion
            if (expectedVersion !== undefined && serverVersion > expectedVersion) {
              const conflictResult = await resolveMutationConflict(
                mut.path,
                mut.data,
                serverData,
                expectedVersion
              );

              if (conflictResult.canAutoResolve && conflictResult.resolvedData) {
                // Tự động hợp nhất thành công các trường an toàn
                await firebaseSet(targetRef, conflictResult.resolvedData);
                await dequeueOfflineMutation(mut.id);
                successCount++;
              } else {
                // Xung đột trực tiếp trên các trường dữ liệu -> Không ghi đè, chuyển trạng thái CONFLICT
                const { store, tx } = await getMutationStore('readwrite');
                mut.status = 'CONFLICT';
                mut.conflictDetails = conflictResult.report;
                store.put(mut);
                await new Promise((resolve) => { tx.oncomplete = resolve; });
                conflictCount++;
                failedCount++;
              }
            } else {
              // Khớp phiên bản hoặc server chưa thay đổi: Tăng phiên bản mới và ghi
              const dataToWrite = { ...mut.data };
              if (typeof dataToWrite === 'object' && dataToWrite !== null) {
                dataToWrite.version = nextVersion(serverVersion);
                dataToWrite.updatedAt = Date.now();
              }

              if (mut.operation === 'SET') {
                await firebaseSet(targetRef, dataToWrite);
              } else {
                await firebaseUpdate(targetRef, dataToWrite);
              }
              await dequeueOfflineMutation(mut.id);
              successCount++;
            }
          } else {
            // Bản ghi mới hoàn toàn trên server -> Ghi trực tiếp
            if (mut.operation === 'SET') {
              await firebaseSet(targetRef, mut.data);
            } else {
              await firebaseUpdate(targetRef, mut.data);
            }
            await dequeueOfflineMutation(mut.id);
            successCount++;
          }
        }

        if (onProgress) onProgress(mutations.length - (i + 1));
      } catch (err: any) {
        console.warn(`[OfflineQueue] Lỗi replay mutation ${mut.id}:`, err);
        failedCount++;
        // Tăng số lần thử lại
        try {
          const { store, tx } = await getMutationStore('readwrite');
          mut.retryCount = (mut.retryCount || 0) + 1;
          store.put(mut);
          await new Promise((resolve) => { tx.oncomplete = resolve; });
        } catch (_) {}
      }
    }
  } finally {
    isReplaying = false;
  }

  return { success: successCount, failed: failedCount, conflicts: conflictCount };
};
