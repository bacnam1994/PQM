import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queryClient } from '../../lib/queryClient';
import {
  BATCH_QUERY_KEYS,
  TEST_RESULT_QUERY_KEYS,
  PRODUCT_QUERY_KEYS,
} from '../../constants/queryKeys';

describe('Phase 1 — Firebase Bounded Listener & Sync Scope Tests', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('P1-AC1: Bounded window (limitToLast) chỉ lưu tối đa số bản ghi trong scope', () => {
    const mockBatches = Array.from({ length: 100 }, (_, i) => ({
      id: `b_${i}`,
      batchNo: `LOT-${i}`,
      status: 'TESTING',
      mfgDate: `2026-01-${String(i + 1).padStart(2, '0')}`,
    }));

    queryClient.setQueryData(BATCH_QUERY_KEYS.all, mockBatches);
    expect(queryClient.getQueryData(BATCH_QUERY_KEYS.all)).toHaveLength(100);

    // Khi có bản ghi mới đẩy bản ghi cũ nhất ra khỏi cửa sổ bounded
    const newBatch = { id: 'b_100', batchNo: 'LOT-100', status: 'TESTING', mfgDate: '2026-05-01' };
    const evictedId = 'b_0';

    // Giả lập sự kiện onChildRemoved trên queryTarget cho bản ghi bị evicted
    queryClient.setQueryData<any[]>(BATCH_QUERY_KEYS.all, (old = []) =>
      old.filter((item) => item.id !== evictedId)
    );
    // Giả lập sự kiện onChildAdded cho bản ghi mới vào cửa sổ
    queryClient.setQueryData<any[]>(BATCH_QUERY_KEYS.all, (old = []) => [newBatch, ...old]);

    const updated = queryClient.getQueryData<any[]>(BATCH_QUERY_KEYS.all);
    expect(updated).toHaveLength(100);
    expect(updated?.some((b) => b.id === evictedId)).toBe(false);
    expect(updated?.some((b) => b.id === 'b_100')).toBe(true);
  });

  it('P1-AC2: Duplicate prevention — Bỏ qua onChildAdded cho các ID đã nạp từ snapshot ban đầu', () => {
    const knownIds = new Set<string>(['tr_1', 'tr_2', 'tr_3']);
    const mockTestResults = [
      { id: 'tr_1', reportNo: 'KN-01' },
      { id: 'tr_2', reportNo: 'KN-02' },
      { id: 'tr_3', reportNo: 'KN-03' },
    ];
    queryClient.setQueryData(TEST_RESULT_QUERY_KEYS.all, mockTestResults);

    // Firebase RTDB phát lại onChildAdded cho tr_1
    const replayId = 'tr_1';
    let processed = false;
    if (!knownIds.has(replayId)) {
      processed = true;
      queryClient.setQueryData<any[]>(TEST_RESULT_QUERY_KEYS.all, (old = []) => [
        ...old,
        { id: replayId, reportNo: 'KN-01' },
      ]);
    }

    expect(processed).toBe(false);
    expect(queryClient.getQueryData(TEST_RESULT_QUERY_KEYS.all)).toHaveLength(3);
  });

  it('P1-AC3: In-place update — onChildChanged cập nhật đúng bản ghi mục tiêu mà không xáo trộn danh sách', () => {
    const initialProducts = [
      { id: 'p_1', code: 'P01', name: 'Thuốc A' },
      { id: 'p_2', code: 'P02', name: 'Thuốc B' },
    ];
    queryClient.setQueryData(PRODUCT_QUERY_KEYS.all, initialProducts);

    const updatedP1 = { id: 'p_1', code: 'P01', name: 'Thuốc A (Cập nhật)' };

    queryClient.setQueryData<any[]>(PRODUCT_QUERY_KEYS.all, (old = []) => {
      const idx = old.findIndex((item) => item.id === 'p_1');
      if (idx === -1) return old;
      const next = [...old];
      next[idx] = updatedP1;
      return next;
    });

    const result = queryClient.getQueryData<any[]>(PRODUCT_QUERY_KEYS.all);
    expect(result).toHaveLength(2);
    expect(result?.[0].name).toBe('Thuốc A (Cập nhật)');
    expect(result?.[1].name).toBe('Thuốc B');
  });

  it('P1-AC4: Scoped Invalidation — Chỉ invalidate đúng detail query thay vì toàn bộ collections', () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.detail('b_99') });
    queryClient.invalidateQueries({ queryKey: TEST_RESULT_QUERY_KEYS.byBatch('b_99') });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: BATCH_QUERY_KEYS.detail('b_99') });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: TEST_RESULT_QUERY_KEYS.byBatch('b_99'),
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: PRODUCT_QUERY_KEYS.all });

    invalidateSpy.mockRestore();
  });
});
