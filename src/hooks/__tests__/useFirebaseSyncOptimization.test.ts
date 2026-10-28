import { describe, it, expect, beforeEach } from 'vitest';
import { getSyncMetadata, updateCollectionSyncMeta } from '../useFirebaseSync';

describe('useFirebaseSync Optimization & Metadata (Phases 1-6)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getSyncMetadata nên trả về cấu trúc mặc định khi chưa có dữ liệu trong storage', () => {
    const meta = getSyncMetadata();
    expect(meta.version).toBe(1);
    expect(meta.lastSuccessfulSyncAt).toBe('');
    expect(meta.collections).toEqual({});
  });

  it('updateCollectionSyncMeta nên lưu timestamp và số lượng bản ghi chính xác', () => {
    updateCollectionSyncMeta('products', 45);
    const meta = getSyncMetadata();

    expect(meta.collections.products).toBeDefined();
    expect(meta.collections.products.count).toBe(45);
    expect(meta.collections.products.lastSyncedAt).toBeTruthy();
    expect(meta.lastSuccessfulSyncAt).toBeTruthy();
  });

  it('nhiều collections cập nhật metadata mà không làm mất dữ liệu của nhau', () => {
    updateCollectionSyncMeta('products', 10);
    updateCollectionSyncMeta('batches', 50);

    const meta = getSyncMetadata();
    expect(meta.collections.products.count).toBe(10);
    expect(meta.collections.batches.count).toBe(50);
  });
});
