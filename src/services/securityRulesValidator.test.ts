import { describe, it, expect } from 'vitest';
import { SecurityRulesValidator, SecurityUserContext } from './securityRulesValidator';

describe('TASK-005: Security Rules Verification Suite', () => {
  const adminUser: SecurityUserContext = {
    uid: 'u-admin',
    email: 'admin@pqm.com',
    role: 'ADMIN',
    isAdmin: true,
  };
  const qaUser: SecurityUserContext = {
    uid: 'u-qa',
    email: 'qa@pqm.com',
    role: 'QA',
    isAdmin: false,
  };
  const qcUser: SecurityUserContext = {
    uid: 'u-qc',
    email: 'qc@pqm.com',
    role: 'QC',
    isAdmin: false,
  };
  const prodUser: SecurityUserContext = {
    uid: 'u-prod',
    email: 'prod@pqm.com',
    role: 'PRODUCTION',
    isAdmin: false,
  };
  const guestUser: SecurityUserContext = {
    uid: 'u-guest',
    email: 'guest@pqm.com',
    role: 'GUEST',
    isAdmin: false,
  };

  describe('1. Unauthorized Access Protection', () => {
    it('chặn truy cập đối với người dùng chưa đăng nhập', () => {
      const result = SecurityRulesValidator.evaluate(null, 'READ', 'products');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Chưa xác thực');
    });

    it('GUEST không được sửa đổi dữ liệu sản phẩm hoặc công thức', () => {
      const result = SecurityRulesValidator.evaluate(guestUser, 'CREATE', 'products/p1', {
        name: 'Hack',
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe('2. Role-Based Enforcement & Privilege Escalation Prevention', () => {
    it('ngăn chặn người dùng thường tự gán role hoặc quyền Admin khi cập nhật profile', () => {
      const result = SecurityRulesValidator.evaluate(qcUser, 'UPDATE', `users/${qcUser.uid}`, {
        role: 'ADMIN',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Role Escalation Prevention');
    });

    it('cho phép tài khoản mới đăng ký tự gán role GUEST', () => {
      const newUser: SecurityUserContext = {
        uid: 'u-new',
        email: 'new@pqm.com',
        role: null,
        isAdmin: false,
      };
      const result = SecurityRulesValidator.evaluate(
        newUser,
        'CREATE',
        `users/${newUser.uid}`,
        {
          email: 'new@pqm.com',
          role: 'GUEST',
          createdAt: new Date().toISOString(),
        },
        null
      );
      expect(result.allowed).toBe(true);
    });

    it('chặn tài khoản mới đăng ký tự gán role khác GUEST hoặc tự cấp isAdmin', () => {
      const newUser: SecurityUserContext = {
        uid: 'u-new',
        email: 'new@pqm.com',
        role: null,
        isAdmin: false,
      };
      const resRole = SecurityRulesValidator.evaluate(
        newUser,
        'CREATE',
        `users/${newUser.uid}`,
        {
          email: 'new@pqm.com',
          role: 'QA',
        },
        null
      );
      expect(resRole.allowed).toBe(false);

      const resAdmin = SecurityRulesValidator.evaluate(
        newUser,
        'CREATE',
        `users/${newUser.uid}`,
        {
          email: 'new@pqm.com',
          role: 'GUEST',
          isAdmin: true,
        },
        null
      );
      expect(resAdmin.allowed).toBe(false);
    });

    it('cho phép ADMIN cập nhật quyền của người dùng', () => {
      const result = SecurityRulesValidator.evaluate(adminUser, 'UPDATE', `users/${qcUser.uid}`, {
        role: 'QA',
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe('3. Immutable Audit Trail (ALCOA+ Compliance)', () => {
    it('cho phép thêm mới audit log có timestamp hợp lệ', () => {
      const result = SecurityRulesValidator.evaluate(qcUser, 'CREATE', 'audit_logs/log_1', {
        action: 'UPDATE',
        timestamp: new Date().toISOString(),
      });
      expect(result.allowed).toBe(true);
    });

    it('chặn hoàn toàn việc chỉnh sửa (UPDATE) audit log, ngay cả với ADMIN', () => {
      const result = SecurityRulesValidator.evaluate(adminUser, 'UPDATE', 'audit_logs/log_1', {
        action: 'ALTERED',
      });
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
      const result = SecurityRulesValidator.evaluate(
        qcUser,
        'UPDATE',
        'testResults/tr_1',
        { overallStatus: 'FAIL' },
        currentDoc
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('đã được khóa/duyệt');
    });

    it('chặn LAB/QC sửa đổi phiếu kiểm nghiệm đã có evaluationSnapshot (đã chốt đánh giá)', () => {
      const currentDoc = {
        id: 'tr_1',
        overallStatus: 'PASS',
        evaluationSnapshot: { evaluatedAt: '2026-09-17' },
      };
      const result = SecurityRulesValidator.evaluate(
        qcUser,
        'UPDATE',
        'testResults/tr_1',
        { overallStatus: 'FAIL' },
        currentDoc
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('snapshot');
    });

    it('cho phép QA xem xét phiếu đã duyệt khi có thẩm quyền', () => {
      const currentDoc = { id: 'tr_1', overallStatus: 'APPROVED', status: 'LOCKED' };
      const result = SecurityRulesValidator.evaluate(
        qaUser,
        'UPDATE',
        'testResults/tr_1',
        { notes: 'QA review' },
        currentDoc
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe('5. Batch Release Anti-Tampering', () => {
    it('chặn nhân viên Sản xuất hoặc QC tự ý duyệt xuất xưởng RELEASED lô hàng', () => {
      const result = SecurityRulesValidator.evaluate(prodUser, 'UPDATE', 'batches/b1', {
        status: 'RELEASED',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Chỉ QA mới có thẩm quyền');
    });

    it('chặn nhân viên Sản xuất hoặc QC tự ý từ chối REJECTED lô hàng', () => {
      const result = SecurityRulesValidator.evaluate(prodUser, 'UPDATE', 'batches/b1', {
        status: 'REJECTED',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Chỉ QA mới có thẩm quyền');
    });

    it('chặn sửa đổi lô hàng đã REJECTED nếu không phải QA', () => {
      const currentDoc = { id: 'b1', status: 'REJECTED' };
      const result = SecurityRulesValidator.evaluate(
        prodUser,
        'UPDATE',
        'batches/b1',
        { notes: 'Edit note' },
        currentDoc
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('bị khóa');
    });

    it('cho phép QA phê duyệt xuất xưởng hoặc từ chối lô sản xuất', () => {
      const resRelease = SecurityRulesValidator.evaluate(qaUser, 'UPDATE', 'batches/b1', {
        status: 'RELEASED',
      });
      expect(resRelease.allowed).toBe(true);
      const resReject = SecurityRulesValidator.evaluate(qaUser, 'UPDATE', 'batches/b1', {
        status: 'REJECTED',
      });
      expect(resReject.allowed).toBe(true);
    });

    it('cho phép nhân viên LAB và PRODUCTION tạo hoặc cập nhật cảnh báo quality_alerts khi lưu dữ liệu', () => {
      const labUser = {
        uid: 'u_lab',
        email: 'lab@v-biotech.vn',
        role: 'LAB' as const,
        isAdmin: false,
      };
      const resLab = SecurityRulesValidator.evaluate(labUser, 'UPDATE', 'quality_alerts/qa_1', {
        alertLevel: 'WARNING',
      });
      expect(resLab.allowed).toBe(true);

      const resProd = SecurityRulesValidator.evaluate(prodUser, 'UPDATE', 'quality_alerts/qa_1', {
        alertLevel: 'WARNING',
      });
      expect(resProd.allowed).toBe(true);
    });

    it('chặn tài khoản GUEST tạo hoặc sửa đổi quality_alerts', () => {
      const guestUser = {
        uid: 'u_guest',
        email: 'guest@v-biotech.vn',
        role: 'GUEST' as const,
        isAdmin: false,
      };
      const resGuest = SecurityRulesValidator.evaluate(guestUser, 'CREATE', 'quality_alerts/qa_1', {
        alertLevel: 'WARNING',
      });
      expect(resGuest.allowed).toBe(false);
      expect(resGuest.reason).toContain('GUEST');
    });
  });

  describe('6. Firebase Storage Access & Security Constraints', () => {
    it('chặn tải CoA điện tử bởi nhân sự không phải QA', () => {
      const result = SecurityRulesValidator.validateStorageUpload(qcUser, 'coas', {
        size: 1024,
        type: 'application/pdf',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Chỉ QA');
    });

    it('chặn tệp đính kèm kiểm nghiệm có định dạng thực thi nguy hại (.exe / .sh)', () => {
      const result = SecurityRulesValidator.validateStorageUpload(qcUser, 'test_attachments', {
        size: 1024,
        type: 'application/x-msdownload',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('PDF hoặc hình ảnh');
    });

    it('chặn tệp đính kèm kiểm nghiệm vượt quá giới hạn 20MB', () => {
      const result = SecurityRulesValidator.validateStorageUpload(qcUser, 'test_attachments', {
        size: 25 * 1024 * 1024,
        type: 'application/pdf',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('không được vượt quá 20MB');
    });

    it('cho phép QA tải lên ảnh mẫu sản phẩm hợp lệ dưới 5MB', () => {
      const result = SecurityRulesValidator.validateStorageUpload(qaUser, 'product_images', {
        size: 2 * 1024 * 1024,
        type: 'image/jpeg',
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe('7. Model 2.5 — Workflow Status & Data Access Hardening', () => {
    it('chặn nhân viên LAB hoặc QC tự ý gán workflowStatus APPROVED cho phiếu kiểm nghiệm', () => {
      const result = SecurityRulesValidator.evaluate(qcUser, 'UPDATE', 'testResults/tr_1', {
        workflowStatus: 'APPROVED',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Chỉ QA mới có thẩm quyền Phê duyệt');
    });

    it('chặn nhân viên LAB hoặc QC tự ý gán workflowStatus RELEASED cho phiếu kiểm nghiệm', () => {
      const result = SecurityRulesValidator.evaluate(qcUser, 'UPDATE', 'testResults/tr_1', {
        workflowStatus: 'RELEASED',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Chỉ QA mới có thẩm quyền');
    });

    it('cho phép QA phê duyệt workflowStatus APPROVED cho phiếu kiểm nghiệm', () => {
      const result = SecurityRulesValidator.evaluate(qaUser, 'UPDATE', 'testResults/tr_1', {
        workflowStatus: 'APPROVED',
      });
      expect(result.allowed).toBe(true);
    });

    it('GAP-07: chặn QA hoặc ADMIN chuyển trạng thái lô sang RELEASED nếu qualityStatus là FAIL', () => {
      // 1. QA cố chuyển sang RELEASED khi qualityStatus = FAIL
      const qaResult = SecurityRulesValidator.evaluate(qaUser, 'UPDATE', 'batches/b_fail', {
        status: 'RELEASED',
        qualityStatus: 'FAIL',
      });
      expect(qaResult.allowed).toBe(false);
      expect(qaResult.reason).toContain('GAP-07');

      // 2. ADMIN cố chuyển sang RELEASED khi qualityStatus = FAIL -> Vẫn bị chặn (ADMIN ≠ bypass)
      const adminUserContext = {
        uid: 'u_admin',
        email: 'admin@v-biotech.vn',
        role: 'ADMIN' as const,
        isAdmin: true,
      };
      const adminResult = SecurityRulesValidator.evaluate(
        adminUserContext,
        'UPDATE',
        'batches/b_fail',
        {
          status: 'RELEASED',
          qualityStatus: 'FAIL',
        }
      );
      expect(adminResult.allowed).toBe(false);
      expect(adminResult.reason).toContain('GAP-07');
    });
  });
});
