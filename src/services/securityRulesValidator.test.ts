import { describe, it, expect } from 'vitest';
import { SecurityRulesValidator, SecurityUserContext } from './securityRulesValidator';

describe('TASK-005: Security Rules Verification Suite', () => {
  const adminUser: SecurityUserContext = { uid: 'u-admin', email: 'admin@pqm.com', role: 'ADMIN', isAdmin: true };
  const qaUser: SecurityUserContext = { uid: 'u-qa', email: 'qa@pqm.com', role: 'QA', isAdmin: false };
  const qcUser: SecurityUserContext = { uid: 'u-qc', email: 'qc@pqm.com', role: 'QC', isAdmin: false };
  const prodUser: SecurityUserContext = { uid: 'u-prod', email: 'prod@pqm.com', role: 'PRODUCTION', isAdmin: false };
  const guestUser: SecurityUserContext = { uid: 'u-guest', email: 'guest@pqm.com', role: 'GUEST', isAdmin: false };

  describe('1. Unauthorized Access Protection', () => {
    it('chặn truy cập đối với người dùng chưa đăng nhập', () => {
      const result = SecurityRulesValidator.evaluate(null, 'READ', 'products');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Chưa xác thực');
    });

    it('GUEST không được sửa đổi dữ liệu sản phẩm hoặc công thức', () => {
      const result = SecurityRulesValidator.evaluate(guestUser, 'CREATE', 'products/p1', { name: 'Hack' });
      expect(result.allowed).toBe(false);
    });
  });

  describe('2. Role-Based Enforcement & Privilege Escalation Prevention', () => {
    it('ngăn chặn người dùng thường tự gán role hoặc quyền Admin khi cập nhật profile', () => {
      const result = SecurityRulesValidator.evaluate(qcUser, 'UPDATE', `users/${qcUser.uid}`, { role: 'ADMIN' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Role Escalation Prevention');
    });

    it('cho phép ADMIN cập nhật quyền của người dùng', () => {
      const result = SecurityRulesValidator.evaluate(adminUser, 'UPDATE', `users/${qcUser.uid}`, { role: 'QA' });
      expect(result.allowed).toBe(true);
    });
  });

  describe('3. Immutable Audit Trail (ALCOA+ Compliance)', () => {
    it('cho phép thêm mới audit log có timestamp hợp lệ', () => {
      const result = SecurityRulesValidator.evaluate(qcUser, 'CREATE', 'audit_logs/log_1', {
        action: 'UPDATE',
        timestamp: new Date().toISOString()
      });
      expect(result.allowed).toBe(true);
    });

    it('chặn hoàn toàn việc chỉnh sửa (UPDATE) audit log, ngay cả với ADMIN', () => {
      const result = SecurityRulesValidator.evaluate(adminUser, 'UPDATE', 'audit_logs/log_1', { action: 'ALTERED' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('ALCOA+ Violation');
    });

    it('chặn hoàn toàn việc xóa (DELETE) audit log, ngay cả với ADMIN', () => {
      const result = SecurityRulesValidator.evaluate(adminUser, 'DELETE', 'audit_logs/log_1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('ALCOA+ Violation');
    });
  });

  describe('4. Locked Document Protection', () => {
    it('chặn LAB/QC sửa đổi phiếu kiểm nghiệm đã APPROVED hoặc LOCKED', () => {
      const currentDoc = { id: 'tr_1', overallStatus: 'APPROVED', status: 'LOCKED' };
      const result = SecurityRulesValidator.evaluate(qcUser, 'UPDATE', 'testResults/tr_1', { overallStatus: 'FAIL' }, currentDoc);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('đã được khóa/duyệt');
    });

    it('cho phép QA xem xét phiếu đã duyệt khi có thẩm quyền', () => {
      const currentDoc = { id: 'tr_1', overallStatus: 'APPROVED', status: 'LOCKED' };
      const result = SecurityRulesValidator.evaluate(qaUser, 'UPDATE', 'testResults/tr_1', { notes: 'QA review' }, currentDoc);
      expect(result.allowed).toBe(true);
    });
  });

  describe('5. Batch Release Anti-Tampering', () => {
    it('chặn nhân viên Sản xuất hoặc QC tự ý duyệt xuất xưởng RELEASED lô hàng', () => {
      const result = SecurityRulesValidator.evaluate(prodUser, 'UPDATE', 'batches/b1', { status: 'RELEASED' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Chỉ QA mới có thẩm quyền');
    });

    it('cho phép QA phê duyệt xuất xưởng lô sản xuất', () => {
      const result = SecurityRulesValidator.evaluate(qaUser, 'UPDATE', 'batches/b1', { status: 'RELEASED' });
      expect(result.allowed).toBe(true);
    });
  });

  describe('6. Firebase Storage Access & Security Constraints', () => {
    it('chặn tải CoA điện tử bởi nhân sự không phải QA', () => {
      const result = SecurityRulesValidator.validateStorageUpload(qcUser, 'coas', { size: 1024, type: 'application/pdf' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Chỉ QA');
    });

    it('chặn tệp đính kèm kiểm nghiệm có định dạng thực thi nguy hại (.exe / .sh)', () => {
      const result = SecurityRulesValidator.validateStorageUpload(qcUser, 'test_attachments', { size: 1024, type: 'application/x-msdownload' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('PDF hoặc hình ảnh');
    });

    it('chặn tệp đính kèm kiểm nghiệm vượt quá giới hạn 20MB', () => {
      const result = SecurityRulesValidator.validateStorageUpload(qcUser, 'test_attachments', { size: 25 * 1024 * 1024, type: 'application/pdf' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('không được vượt quá 20MB');
    });

    it('cho phép QA tải lên ảnh mẫu sản phẩm hợp lệ dưới 5MB', () => {
      const result = SecurityRulesValidator.validateStorageUpload(qaUser, 'product_images', { size: 2 * 1024 * 1024, type: 'image/jpeg' });
      expect(result.allowed).toBe(true);
    });
  });
});
