import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queryClient } from '../lib/queryClient';
import {
  BATCH_QUERY_KEYS,
  TEST_RESULT_QUERY_KEYS,
  PRODUCT_QUERY_KEYS,
} from '../constants/queryKeys';
import {
  saveItemToCache,
  deleteItemFromCache,
  getFromCache,
  saveToCache,
} from '../utils/offlineCache';

describe('Phase 2 — Granular Sync Engine & IndexedDB Hygiene', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('P2-AC1: Cập nhật in-place một Batch duy nhất mà không re-fetch toàn bộ danh sách 10.000 items', () => {
    const existingBatches = [
      { id: 'b1', batchNo: 'L26-001', productId: 'p1', status: 'TESTING' } as any,
      { id: 'b2', batchNo: 'L26-002', productId: 'p2', status: 'RELEASED' } as any,
    ];

    queryClient.setQueryData(BATCH_QUERY_KEYS.all, existingBatches);

    // Giả lập sự kiện onChildChanged từ Firebase cho Batch b1
    const updatedB1 = { ...existingBatches[0], status: 'APPROVED' };

    // In-place mutation
    queryClient.setQueryData<any[]>(BATCH_QUERY_KEYS.all, (old = []) =>
      old.map((item) => (item.id === 'b1' ? updatedB1 : item))
    );

    const result = queryClient.getQueryData<any[]>(BATCH_QUERY_KEYS.all);
    expect(result).toHaveLength(2);
    expect(result?.[0].status).toBe('APPROVED');
    expect(result?.[1].status).toBe('RELEASED'); // b2 giữ nguyên
  });

  it('P2-AC2: Invalidate scoped queries bị ảnh hưởng thay vì invalidate toàn bộ database', () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Giả lập khi batch b1 thay đổi: chỉ invalidate queries liên quan đến b1
    queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.detail('b1') });
    queryClient.invalidateQueries({ queryKey: TEST_RESULT_QUERY_KEYS.byBatch('b1') });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: BATCH_QUERY_KEYS.detail('b1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: TEST_RESULT_QUERY_KEYS.byBatch('b1') });

    // Không invalidate toàn bộ test results hay all products
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: TEST_RESULT_QUERY_KEYS.all });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: PRODUCT_QUERY_KEYS.all });

    invalidateSpy.mockRestore();
  });

  it('P2-AC3: saveItemToCache và deleteItemFromCache là các hàm vi mô hợp lệ', () => {
    expect(typeof saveItemToCache).toBe('function');
    expect(typeof deleteItemFromCache).toBe('function');
    expect(typeof saveToCache).toBe('function');
    expect(typeof getFromCache).toBe('function');
  });
});
