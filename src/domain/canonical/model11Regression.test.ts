import { describe, it, expect } from 'vitest';
import {
  ConcurrencyManager,
  ConcurrentModificationError,
  VersionedEntity,
} from '../concurrency/concurrencyModel';

describe('Model 11: Concurrency & Versioning Model Regression Suite', () => {
  // ===========================================================
  // 1. verifyVersion — OCC Guard
  // ===========================================================
  describe('verifyVersion — Optimistic Concurrency Control', () => {
    it('xác nhận phiên bản khớp thành công', () => {
      const entity = { id: 'batch-001', version: 5 };
      const check = ConcurrencyManager.verifyVersion(entity, 5);
      expect(check.isValid).toBe(true);
      expect(check.error).toBeUndefined();
    });

    it('báo lỗi CONCURRENT_MODIFICATION khi phiên bản thực tế lớn hơn dự kiến', () => {
      const entity = { id: 'batch-001', version: 7 };
      const check = ConcurrencyManager.verifyVersion(entity, 5);
      expect(check.isValid).toBe(false);
      expect(check.error).toBeInstanceOf(ConcurrentModificationError);
      expect(check.error?.expectedVersion).toBe(5);
      expect(check.error?.actualVersion).toBe(7);
      expect(check.error?.entityId).toBe('batch-001');
    });

    it('báo lỗi khi phiên bản dự kiến lớn hơn thực tế (stale client)', () => {
      const entity = { id: 'tr-001', version: 2 };
      const check = ConcurrencyManager.verifyVersion(entity, 4);
      expect(check.isValid).toBe(false);
      expect(check.error?.actualVersion).toBe(2);
    });

    it('cho phép nếu không truyền expectedVersion (tương thích ngược)', () => {
      const entity = { id: 'batch-001', version: 3 };
      const check = ConcurrencyManager.verifyVersion(entity);
      expect(check.isValid).toBe(true);
    });

    it('cho phép nếu entity chưa có version (backward compatibility)', () => {
      const entity = { id: 'old-entity-001' };
      const check = ConcurrencyManager.verifyVersion(entity, 1);
      expect(check.isValid).toBe(true);
    });
  });

  // ===========================================================
  // 2. initializeVersion & prepareNextVersion
  // ===========================================================
  describe('Quản lý vòng đời phiên bản', () => {
    it('khởi tạo phiên bản 1 cho thực thể mới tạo', () => {
      const entity = { id: 'batch-new', status: 'PENDING' };
      const initialized = ConcurrencyManager.initializeVersion(entity, 'user-admin');
      expect(initialized.version).toBe(1);
      expect(initialized.updatedBy).toBe('user-admin');
      expect(initialized.createdAt).toBeDefined();
      expect(initialized.updatedAt).toBeDefined();
    });

    it('tăng phiên bản tuần tự khi cập nhật dữ liệu', () => {
      const entity = { id: 'batch-001', version: 3, updatedAt: '2026-09-01T08:00:00.000Z' };
      const updated = ConcurrencyManager.prepareNextVersion(entity, 'user-qa');
      expect(updated.version).toBe(4);
      expect(updated.updatedBy).toBe('user-qa');
      expect(updated.updatedAt).not.toBe('2026-09-01T08:00:00.000Z');
    });

    it('tăng phiên bản từ 1 → 2 → 3 qua 3 lần ghi liên tiếp', () => {
      let entity: VersionedEntity = { id: 'tr-001' };
      entity = ConcurrencyManager.initializeVersion(entity, 'user-lab');
      expect(entity.version).toBe(1);

      entity = ConcurrencyManager.prepareNextVersion(entity, 'user-qa');
      expect(entity.version).toBe(2);

      entity = ConcurrencyManager.prepareNextVersion(entity, 'user-admin');
      expect(entity.version).toBe(3);
    });
  });

  // ===========================================================
  // 3. Conflict Reporting & Resolution
  // ===========================================================
  describe('Xử lý báo cáo xung đột phiên bản', () => {
    it('tạo báo cáo xung đột đầy đủ với danh sách chiến lược', () => {
      const report = ConcurrencyManager.createConflictReport('batch-001', 3, 5, [
        'REJECT',
        'SERVER_WINS',
      ]);
      expect(report.entityId).toBe('batch-001');
      expect(report.expectedVersion).toBe(3);
      expect(report.actualVersion).toBe(5);
      expect(report.availableStrategies).toContain('REJECT');
      expect(report.resolvedBy).toBeUndefined();
    });

    it('đánh dấu xung đột đã được giải quyết với chiến lược hợp lệ', () => {
      const report = ConcurrencyManager.createConflictReport('batch-001', 3, 5, [
        'REJECT',
        'SERVER_WINS',
      ]);
      const resolved = ConcurrencyManager.resolveConflict(report, 'SERVER_WINS', 'qa-admin');
      expect(resolved.resolvedBy).toBe('SERVER_WINS');
      expect(resolved.resolvedByUserId).toBe('qa-admin');
      expect(resolved.resolvedAt).toBeDefined();
    });

    it('ném lỗi khi chiến lược giải quyết xung đột không được phép', () => {
      const report = ConcurrencyManager.createConflictReport('tr-001', 1, 2, ['REJECT']);
      expect(() => ConcurrencyManager.resolveConflict(report, 'CLIENT_WINS', 'user-lab')).toThrow(
        'CLIENT_WINS'
      );
    });
  });

  // ===========================================================
  // 4. Utility — isNewer & assertMinimumVersion
  // ===========================================================
  describe('Tiện ích so sánh và kiểm tra phiên bản', () => {
    it('isNewer trả về true khi entity1 có phiên bản cao hơn entity2', () => {
      const entity1 = { id: 'e1', version: 5 };
      const entity2 = { id: 'e2', version: 3 };
      expect(ConcurrencyManager.isNewer(entity1, entity2)).toBe(true);
      expect(ConcurrencyManager.isNewer(entity2, entity1)).toBe(false);
    });

    it('assertMinimumVersion thành công khi đủ phiên bản yêu cầu', () => {
      const entity = { id: 'tr-001', version: 4 };
      const result = ConcurrencyManager.assertMinimumVersion(entity, 3);
      expect(result.passed).toBe(true);
      expect(result.actualVersion).toBe(4);
    });

    it('assertMinimumVersion thất bại khi phiên bản không đủ', () => {
      const entity = { id: 'tr-001', version: 1 };
      const result = ConcurrencyManager.assertMinimumVersion(entity, 3);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('yêu cầu phiên bản tối thiểu 3');
    });

    it('ConcurrentModificationError có đầy đủ properties cho ALCOA+ audit', () => {
      const err = new ConcurrentModificationError('batch-99', 4, 6);
      expect(err.name).toBe('ConcurrentModificationError');
      expect(err.entityId).toBe('batch-99');
      expect(err.expectedVersion).toBe(4);
      expect(err.actualVersion).toBe(6);
      expect(err.message).toContain('CONCURRENT_MODIFICATION');
    });
  });
});
