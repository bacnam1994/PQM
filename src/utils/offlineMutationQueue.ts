import { ref, set as firebaseSet, update as firebaseUpdate, remove as firebaseRemove } from 'firebase/database';
import { db } from '../firebase';
import { initDB } from './offlineCache';

export interface OfflineMutation {
  id: string;
  path: string;
  operation: 'SET' | 'UPDATE' | 'REMOVE';
  data?: any;
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

let isReplaying = false;

/**
 * Tự động phát lại (Replay) toàn bộ hàng đợi ngoại tuyến lên Firebase
 */
export const replayOfflineMutations = async (
  onProgress?: (remainingCount: number) => void
): Promise<{ success: number; failed: number }> => {
  if (isReplaying) return { success: 0, failed: 0 };
  isReplaying = true;

  let successCount = 0;
  let failedCount = 0;

  try {
    const mutations = await getPendingOfflineMutations();
    if (mutations.length === 0) {
      isReplaying = false;
      return { success: 0, failed: 0 };
    }

    for (let i = 0; i < mutations.length; i++) {
      const mut = mutations[i];
      try {
        const targetRef = mut.path ? ref(db, mut.path) : ref(db);
        if (mut.operation === 'SET') {
          await firebaseSet(targetRef, mut.data);
        } else if (mut.operation === 'UPDATE') {
          await firebaseUpdate(targetRef, mut.data);
        } else if (mut.operation === 'REMOVE') {
          await firebaseRemove(targetRef);
        }
        await dequeueOfflineMutation(mut.id);
        successCount++;
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

  return { success: successCount, failed: failedCount };
};
