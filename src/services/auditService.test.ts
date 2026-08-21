import { describe, it, expect, vi } from 'vitest';
import { logAuditAction, fetchAuditLogs } from './auditService';

// Mock Firebase functions
vi.mock('../firebase', () => ({
  db: {}
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  push: vi.fn().mockResolvedValue({ key: 'mock_log_id' }),
  serverTimestamp: vi.fn().mockReturnValue({ '.sv': 'timestamp' }),
  query: vi.fn(),
  orderByChild: vi.fn(),
  limitToLast: vi.fn(),
  get: vi.fn().mockResolvedValue({
    exists: () => true,
    val: () => ({
      log_1: {
        action: 'CREATE',
        collection: 'PRODUCTS',
        documentId: 'p_101',
        details: 'Tạo mới sản phẩm Vitamin C',
        performedBy: 'admin@vbiotech.vn',
        timestamp: 1700000000000
      },
      log_2: {
        action: 'UPDATE',
        collection: 'BATCHES',
        documentId: 'b_202',
        details: 'Cập nhật trạng thái lô hàng',
        performedBy: 'qa@vbiotech.vn',
        timestamp: 1700000050000
      }
    })
  }),
  onValue: vi.fn()
}));

describe('auditService', () => {
  it('logAuditAction hoàn thành mà không gây ngoại lệ', async () => {
    await expect(logAuditAction({
      action: 'CREATE',
      collection: 'PRODUCTS',
      details: 'Test audit log action',
      performedBy: 'tester@vbiotech.vn'
    })).resolves.not.toThrow();
  });

  it('fetchAuditLogs trả về danh sách được sắp xếp mới nhất lên đầu', async () => {
    const logs = await fetchAuditLogs(50);
    expect(logs).toHaveLength(2);
    expect(logs[0].id).toBe('log_2');
    expect(logs[0].action).toBe('UPDATE');
    expect(logs[1].id).toBe('log_1');
    expect(logs[1].action).toBe('CREATE');
  });
});
