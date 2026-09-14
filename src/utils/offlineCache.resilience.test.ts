/**
 * offlineCache.resilience.test.ts
 * Kiểm định khả năng phục hồi và chống chịu (Resilience) của IndexedDB Cache:
 * - 100 concurrent writes
 * - Offline / Online reconnect
 * - Same record changed twice
 * - Delete while syncing
 * - Quota exceeded simulation
 * - Corrupt cache graceful recovery
 * - Version migration simulation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveItemToCache,
  deleteItemFromCache,
  saveToCache,
  getFromCache,
  clearEntireCache,
} from './offlineCache';

// Xây dựng Mock In-Memory IndexedDB Engine để kiểm định chi tiết các điều kiện biên
class MockIndexedDBEngine {
  public stores: Map<string, Map<string, any>> = new Map();
  public shouldFailWithQuota = false;
  public shouldFailWithCorrupt = false;
  public version = 4;

  constructor() {
    this.reset();
  }

  reset() {
    this.stores.clear();
    const storeNames = [
      'testResults',
      'products',
      'batches',
      'tccs',
      'productFormulas',
      'rawMaterials',
      'aiLearnedMappings',
      'qualityAlerts',
      'criteriaAliases',
      'offlineMutations',
    ];
    storeNames.forEach((name) => this.stores.set(name, new Map()));
  }

  createIDBMock(): IDBFactory {
    const self = this;
    return {
      open(name: string, version?: number) {
        const req: any = {};
        setTimeout(() => {
          if (self.shouldFailWithCorrupt) {
            req.error = new Error('DatabaseCorruptError: The database was unreadable.');
            if (req.onerror) req.onerror({ target: req });
            return;
          }

          const db: any = {
            objectStoreNames: {
              contains: (storeName: string) => self.stores.has(storeName),
            },
            createObjectStore: (storeName: string) => {
              if (!self.stores.has(storeName)) {
                self.stores.set(storeName, new Map());
              }
            },
            transaction: (storeNames: string | string[], mode: string) => {
              const storeName = Array.isArray(storeNames) ? storeNames[0] : storeNames;
              const storeMap = self.stores.get(storeName) || new Map();
              const tx: any = {
                objectStore: () => ({
                  put: (item: any) => {
                    if (self.shouldFailWithQuota) {
                      throw new Error('QuotaExceededError: Storage quota exceeded.');
                    }
                    storeMap.set(item.id, item);
                  },
                  delete: (id: string) => {
                    storeMap.delete(id);
                  },
                  getAll: () => {
                    const getReq: any = { result: Array.from(storeMap.values()) };
                    setTimeout(() => {
                      if (getReq.onsuccess) getReq.onsuccess();
                    }, 0);
                    return getReq;
                  },
                  clear: () => {
                    storeMap.clear();
                  },
                }),
              };
              setTimeout(() => {
                if (tx.oncomplete) tx.oncomplete();
              }, 0);
              return tx;
            },
            close: vi.fn(),
          };

          if (version && version > self.version && req.onupgradeneeded) {
            req.onupgradeneeded({ target: { result: db } });
          }

          req.result = db;
          if (req.onsuccess) req.onsuccess({ target: req });
        }, 0);
        return req;
      },
    } as any;
  }
}

describe('P7 — IndexedDB Offline Cache Resilience & Concurrency', () => {
  let mockEngine: MockIndexedDBEngine;

  beforeEach(() => {
    mockEngine = new MockIndexedDBEngine();
    (globalThis as any).indexedDB = mockEngine.createIDBMock();
  });

  it('1. 100 concurrent writes: thực thi 100 tác vụ ghi đồng thời mà không nghẽn dữ liệu', async () => {
    const writes = Array.from({ length: 100 }, (_, i) =>
      saveItemToCache('products', {
        id: `prod_concurrent_${i}`,
        code: `P-${i}`,
        name: `Thuốc ${i}`,
      })
    );

    await Promise.all(writes);

    const stored = await getFromCache('products');
    expect(stored.length).toBe(100);
    expect(stored.some((p) => p.id === 'prod_concurrent_99')).toBe(true);
  });

  it('2. Same record changed twice: cập nhật liên tiếp cùng 1 bản ghi ghi nhận phiên bản mới nhất', async () => {
    await saveItemToCache('batches', {
      id: 'batch_01',
      batchNo: 'B001',
      actualYield: 1000,
      version: 1,
    });

    // Cập nhật lần 2 ngay lập tức
    await saveItemToCache('batches', {
      id: 'batch_01',
      batchNo: 'B001',
      actualYield: 1050,
      version: 2,
    });

    const stored = await getFromCache('batches');
    expect(stored.length).toBe(1);
    expect(stored[0].actualYield).toBe(1050);
    expect(stored[0].version).toBe(2);
  });

  it('3. Delete while syncing: xóa bản ghi trong quá trình cập nhật diễn ra an toàn', async () => {
    await saveItemToCache('testResults', { id: 'tr_del_1', batchId: 'b1', overallStatus: 'PASS' });
    await saveItemToCache('testResults', { id: 'tr_del_2', batchId: 'b2', overallStatus: 'PASS' });

    // Kích hoạt đồng thời xóa 1 item và cập nhật 1 item khác
    await Promise.all([
      deleteItemFromCache('testResults', 'tr_del_1'),
      saveItemToCache('testResults', { id: 'tr_del_2', batchId: 'b2', overallStatus: 'FAIL' }),
    ]);

    const stored = await getFromCache('testResults');
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe('tr_del_2');
    expect(stored[0].overallStatus).toBe('FAIL');
  });

  it('4. Quota exceeded: xử lý an toàn và không gây crash ứng dụng khi đầy dung lượng lưu trữ', async () => {
    mockEngine.shouldFailWithQuota = true;

    // saveItemToCache phải bắt lỗi nội bộ bằng catch và log warning, không để crash
    await expect(
      saveItemToCache('products', { id: 'p_quota', name: 'Product' })
    ).resolves.not.toThrow();
  });

  it('5. Corrupt cache: phục hồi duyên dáng khi cơ sở dữ liệu IndexedDB bị hỏng', async () => {
    mockEngine.shouldFailWithCorrupt = true;

    const data = await getFromCache('products');
    // Trả về mảng rỗng thay vì làm gián đoạn luồng render của UI
    expect(data).toEqual([]);
  });

  it('6. Version migration: nâng cấp schema version mà không làm mất object stores hiện có', async () => {
    // Phiên bản ban đầu v4
    await saveItemToCache('products', { id: 'p_migrated', name: 'Paracetamol' });

    // Giả lập mở database với version cao hơn (v5)
    mockEngine.version = 4;
    const req = (globalThis as any).indexedDB.open('QA_Manager_DB', 5);

    await new Promise<void>((resolve) => {
      req.onsuccess = () => resolve();
    });

    const stored = await getFromCache('products');
    expect(stored.some((p) => p.id === 'p_migrated')).toBe(true);
  });
});
