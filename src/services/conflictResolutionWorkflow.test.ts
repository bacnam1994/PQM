/**
 * conflictResolutionWorkflow.test.ts
 * Kiểm định luồng thực tế Phân giải Xung đột Đồng bộ Ngoại tuyến (Phase 8):
 * ONLINE -> Edit Batch -> OFFLINE -> Edit Batch -> Save -> ONLINE -> Server changed same record -> Conflict Resolver -> Audit -> Resolution
 * Đảm bảo 100% tuân thủ ALCOA+ và CLIENT_WINS KHÔNG BAO GIỜ là mặc định.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveMutationConflict } from './conflictResolutionService';
import * as auditModule from './auditService';

vi.mock('./auditService', () => ({
  logAuditAction: vi.fn(() => Promise.resolve()),
}));

describe('P8 — Offline Sync & Conflict Resolution Real-World Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Trùng lặp trường sửa đổi (Direct Overlap): Áp dụng SERVER_WINS mặc định, ghi vết SYNC_CONFLICT', async () => {
    // 1. Máy chủ có bản ghi Lô B001 đã nâng lên version 2
    const serverRecord = {
      id: 'batch_b001',
      batchNo: 'B25001',
      actualYield: 1050, // Người khác đã sửa trên server thành 1050
      status: 'TESTING',
      version: 2,
      updatedAt: Date.now() - 1000,
    };

    // 2. Thiết bị ngoại tuyến lưu đề xuất sửa đổi dựa trên version 1
    const offlineClientPayload = {
      actualYield: 1100, // Client ngoại tuyến sửa thành 1100
    };

    // 3. Khi có mạng trở lại, kích hoạt bộ giải quyết xung đột
    const result = await resolveMutationConflict(
      'batches/batch_b001',
      offlineClientPayload,
      serverRecord,
      1, // expectedVersion = 1
      'operator.qa@v-biotech.com'
    );

    // KIỂM ĐỊNH QUY TẮC BẢO VỆ:
    // a. CLIENT_WINS tuyệt đối KHÔNG được là mặc định khi có xung đột trực tiếp
    expect(result.strategy).not.toBe('CLIENT_WINS');
    expect(result.strategy).toBe('SERVER_WINS');
    expect(result.canAutoResolve).toBe(false);

    // b. Dữ liệu giải quyết giữ nguyên giá trị máy chủ (1050)
    expect(result.resolvedData.actualYield).toBe(1050);
    expect(result.conflictingFields).toContain('actualYield');

    // c. Ghi vết Audit Trail ALCOA+ cảnh báo xung đột dữ liệu
    expect(auditModule.logAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SYNC_CONFLICT',
        collection: 'BATCHES',
        documentId: 'batch_b001',
        performedBy: 'operator.qa@v-biotech.com',
      })
    );
  });

  it('2. Sửa các trường độc lập không giao thoa (Non-conflicting): Tự động SAFE_MERGE an toàn', async () => {
    // Máy chủ sửa actualYield (version 2)
    const serverRecord = {
      id: 'batch_b002',
      batchNo: 'B25002',
      actualYield: 2000,
      version: 2,
    };

    // Client ngoại tuyến cập nhật các trường mới (packaging, notes) mà server chưa có
    const offlineClientPayload = {
      packaging: 'Chai 100 viên',
      notes: 'Bổ sung ghi chú đóng gói',
    };

    const result = await resolveMutationConflict(
      'batches/batch_b002',
      offlineClientPayload,
      serverRecord,
      1,
      'packager@v-biotech.com'
    );

    // SAFE_MERGE được áp dụng tự động
    expect(result.strategy).toBe('SAFE_MERGE');
    expect(result.canAutoResolve).toBe(true);
    expect(result.conflictingFields).toHaveLength(0);

    // Kết quả hợp nhất chứa cả actualYield mới của server và packaging mới của client
    expect(result.resolvedData.actualYield).toBe(2000);
    expect(result.resolvedData.packaging).toBe('Chai 100 viên');
    expect(result.resolvedData.version).toBe(3); // Nâng lên version 3

    // Ghi vết SYNC_MERGE
    expect(auditModule.logAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SYNC_MERGE',
        collection: 'BATCHES',
        documentId: 'batch_b002',
      })
    );
  });
});
