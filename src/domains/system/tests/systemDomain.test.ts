/**
 * SYSTEM DOMAIN UNIT TESTS (VS-14)
 * ================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemRules } from '../domain/rules';
import { SystemAppService } from '../application/systemAppService';
import { ISystemRepository } from '../infrastructure/repository';
import { SystemActionContext } from '../domain/types';
import {
  can,
  canAny,
  canAll,
  hasRole,
  isAdmin,
  normalizeUser,
  canReleaseBatch,
  canApproveTestResult,
  canIssueCoA,
} from '../application/permissionService';

describe('System Domain: Canonical Unit Tests (VS-14)', () => {
  describe('1. SystemRules Enforcement', () => {
    it('validateAdminAuthorization: chấp thuận ADMIN và chặn các vai trò khác', () => {
      const adminCtx: SystemActionContext = { actorId: 'u1', actorRole: 'ADMIN' };
      const qaCtx: SystemActionContext = { actorId: 'u2', actorRole: 'QA' };

      expect(() => SystemRules.validateAdminAuthorization(adminCtx, 'TEST_ACTION')).not.toThrow();

      expect(() => SystemRules.validateAdminAuthorization(qaCtx, 'TEST_ACTION')).toThrow(
        /Thao tác TEST_ACTION bắt buộc quyền Quản trị viên/
      );
    });

    it('validateConfirmationToken: kiểm tra chính xác từng token theo action', () => {
      expect(() =>
        SystemRules.validateConfirmationToken('DATABASE_RESTORE', 'CONFIRM_RESTORE')
      ).not.toThrow();
      expect(() => SystemRules.validateConfirmationToken('DATABASE_RESTORE', 'WRONG')).toThrow(
        /Mã xác nhận khôi phục không hợp lệ/
      );

      expect(() =>
        SystemRules.validateConfirmationToken('DATABASE_WIPE', 'CONFIRM_WIPE')
      ).not.toThrow();
      expect(() => SystemRules.validateConfirmationToken('DATABASE_WIPE', 'WRONG')).toThrow(
        /Mã xác nhận xóa dữ liệu không hợp lệ/
      );

      expect(() =>
        SystemRules.validateConfirmationToken('DATABASE_RESET_DEMO', 'CONFIRM_RESET_DEMO')
      ).not.toThrow();
      expect(() => SystemRules.validateConfirmationToken('DATABASE_RESET_DEMO', 'WRONG')).toThrow(
        /Mã xác nhận nạp dữ liệu mẫu không hợp lệ/
      );
    });

    it('validateReason: bắt buộc có lý do giải trình không rỗng', () => {
      expect(() =>
        SystemRules.validateReason('DATABASE_RESTORE', 'Khôi phục từ backup sự cố')
      ).not.toThrow();
      expect(() => SystemRules.validateReason('DATABASE_RESTORE', '')).toThrow(
        /bắt buộc phải có lý do giải trình/
      );
      expect(() => SystemRules.validateReason('DATABASE_WIPE', '   ')).toThrow(
        /bắt buộc phải có lý do giải trình/
      );
    });

    it('validateDataPayload: kiểm tra dữ liệu đối tượng không rỗng', () => {
      expect(() =>
        SystemRules.validateDataPayload('DATABASE_RESTORE', { test: true })
      ).not.toThrow();
      expect(() => SystemRules.validateDataPayload('DATABASE_RESTORE', {})).toThrow(
        /Dữ liệu khôi phục không hợp lệ hoặc rỗng/
      );
      expect(() => SystemRules.validateDataPayload('DATABASE_RESTORE', null)).toThrow(
        /Dữ liệu khôi phục không hợp lệ hoặc rỗng/
      );
    });

    it('validateRoleAssignment: chỉ cho phép ADMIN phân bổ vai trò', () => {
      expect(() => SystemRules.validateRoleAssignment('QA', 'ADMIN')).not.toThrow();
      expect(() => SystemRules.validateRoleAssignment('QA', 'QC')).toThrow(
        /Chỉ có Quản trị viên \(ADMIN\) mới có quyền/
      );
    });
  });

  describe('2. SystemAppService Operations', () => {
    let mockRepo: ISystemRepository;
    let service: SystemAppService;

    const adminContext: SystemActionContext = {
      actorId: 'admin-01',
      actorRole: 'ADMIN',
      actorEmail: 'admin@vbiotech.vn',
      reason: 'Bảo trì máy chủ',
    };

    const nonAdminContext: SystemActionContext = {
      actorId: 'user-02',
      actorRole: 'QC',
      actorEmail: 'qc@vbiotech.vn',
      reason: 'Test',
    };

    beforeEach(() => {
      mockRepo = {
        backupDatabase: vi.fn().mockResolvedValue({ products: { p1: 'test' } }),
        restoreDatabase: vi.fn().mockResolvedValue(undefined),
        wipeDatabase: vi.fn().mockResolvedValue(undefined),
        resetDemoData: vi.fn().mockResolvedValue(undefined),
      };
      service = new SystemAppService(mockRepo);
    });

    it('backupDatabase: ADMIN sao lưu thành công', async () => {
      const res = await service.backupDatabase(adminContext);
      expect(res.success).toBe(true);
      expect(res.action).toBe('DATABASE_BACKUP');
      expect(mockRepo.backupDatabase).toHaveBeenCalledTimes(1);
    });

    it('backupDatabase: chặn non-ADMIN', async () => {
      await expect(service.backupDatabase(nonAdminContext)).rejects.toThrow(
        /Thao tác DATABASE_BACKUP bắt buộc quyền Quản trị viên/
      );
    });

    it('restoreDatabase: yêu cầu ADMIN, lý do và confirmationToken CONFIRM_RESTORE', async () => {
      // Sai token
      await expect(
        service.restoreDatabase(
          { products: { p1: 'data' } },
          { ...adminContext, confirmationToken: 'INVALID' }
        )
      ).rejects.toThrow(/Mã xác nhận khôi phục không hợp lệ/);

      // Đúng token và dữ liệu
      const res = await service.restoreDatabase(
        { products: { p1: 'data' } },
        { ...adminContext, confirmationToken: 'CONFIRM_RESTORE' }
      );
      expect(res.success).toBe(true);
      expect(mockRepo.restoreDatabase).toHaveBeenCalledTimes(1);
    });

    it('wipeDatabase: yêu cầu ADMIN, lý do và confirmationToken CONFIRM_WIPE', async () => {
      const res = await service.wipeDatabase({
        ...adminContext,
        confirmationToken: 'CONFIRM_WIPE',
      });
      expect(res.success).toBe(true);
      expect(mockRepo.wipeDatabase).toHaveBeenCalledTimes(1);
    });

    it('resetDemoData: yêu cầu ADMIN, lý do và confirmationToken CONFIRM_RESET_DEMO', async () => {
      const res = await service.resetDemoData(
        { demo: true },
        { ...adminContext, confirmationToken: 'CONFIRM_RESET_DEMO' }
      );
      expect(res.success).toBe(true);
      expect(mockRepo.resetDemoData).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. PermissionService & Capabilities', () => {
    it('normalizeUser: xử lý đúng identity từ user object', () => {
      const user = { uid: 'u1', email: 'test@vbiotech.vn', role: 'QA' };
      const normalized = normalizeUser(user);
      expect(normalized).toEqual({
        uid: 'u1',
        email: 'test@vbiotech.vn',
        displayName: null,
        role: 'QA',
        isAdmin: false,
      });
    });

    it('can: ADMIN có toàn quyền với mọi action', () => {
      const admin = { uid: 'u_admin', role: 'ADMIN', isAdmin: true };
      expect(can(admin, 'batch:release')).toBe(true);
      expect(can(admin, 'coa:issue')).toBe(true);
      expect(can(admin, 'test_result:approve')).toBe(true);
      expect(can(admin, 'product:delete')).toBe(true);
    });

    it('can: QA có quyền release batch và issue CoA, nhưng không xóa product', () => {
      const qa = { uid: 'u_qa', role: 'QA' };
      expect(canReleaseBatch(qa)).toBe(true);
      expect(canIssueCoA(qa)).toBe(true);
      expect(canApproveTestResult(qa)).toBe(true);
      expect(can(qa, 'product:delete')).toBe(false);
    });

    it('can: QC và LAB không có quyền release batch hoặc issue CoA', () => {
      const qc = { uid: 'u_qc', role: 'QC' };
      const lab = { uid: 'u_lab', role: 'LAB' };

      expect(canReleaseBatch(qc)).toBe(false);
      expect(canReleaseBatch(lab)).toBe(false);
      expect(canIssueCoA(qc)).toBe(false);
      expect(canIssueCoA(lab)).toBe(false);
    });

    it('can: kiểm soát Resource-Level Context', () => {
      const qc = { uid: 'u_qc', role: 'QC' };

      // QC sửa test_result ở trạng thái DRAFT
      expect(can(qc, 'test_result:update', { status: 'DRAFT' })).toBe(true);

      // QC bị chặn sửa test_result khi đã APPROVED hoặc LOCKED
      expect(can(qc, 'test_result:update', { status: 'APPROVED' })).toBe(false);
      expect(can(qc, 'test_result:update', { status: 'LOCKED' })).toBe(false);
    });

    it('canAny, canAll, hasRole, isAdmin hoạt động chính xác', () => {
      const qa = { uid: 'u_qa', role: 'QA' };
      expect(canAny(qa, ['batch:release', 'product:delete'])).toBe(true);
      expect(canAll(qa, ['batch:release', 'coa:issue'])).toBe(true);
      expect(canAll(qa, ['batch:release', 'product:delete'])).toBe(false);
      expect(hasRole(qa, ['QA', 'ADMIN'])).toBe(true);
      expect(hasRole(qa, 'ADMIN')).toBe(false);
      expect(isAdmin(qa)).toBe(false);
    });
  });
});
