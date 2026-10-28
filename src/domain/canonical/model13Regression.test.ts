import { describe, it, expect } from 'vitest';
import { SecurityRulesValidator, SecurityUserContext } from '../../services/securityRulesValidator';
import { aiActionGuard } from '../../services/ai/aiActionGuard';
import { AlcoaAuditManager } from '../audit/alcoaAuditModel';
import { ConcurrencyManager } from '../concurrency/concurrencyModel';
import { AutoHealingFramework, HealingPlan } from '../healing/autoHealingFramework';
import { calculateSha256 } from '../../utils/cryptoUtils';

describe('Model 13: Integration / Security Gate Suite', () => {
  const qaUser: SecurityUserContext = { uid: 'u-qa', role: 'QA', isAdmin: false };
  const qcUser: SecurityUserContext = { uid: 'u-qc', role: 'QC', isAdmin: false };
  const labUser: SecurityUserContext = { uid: 'u-lab', role: 'LAB', isAdmin: false };
  const adminUser: SecurityUserContext = { uid: 'u-admin', role: 'ADMIN', isAdmin: true };

  // ============================================================
  // 1. Client Bypass: Không gọi aiActionGuard -> Thử sửa regulated entity -> DENY
  // ============================================================
  describe('Gate 1: Client Bypass & Role-based Authorization', () => {
    it('chặn client LAB cố tình sửa trực tiếp trạng thái batch sang RELEASED', () => {
      const result = SecurityRulesValidator.evaluate(
        labUser,
        'UPDATE',
        'batches/b-101',
        { status: 'RELEASED' },
        { status: 'TESTING' }
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Chỉ QA mới có thẩm quyền');
    });

    it('chặn client QC cố tình duyệt phiếu kiểm nghiệm (workflowStatus: APPROVED)', () => {
      const result = SecurityRulesValidator.evaluate(
        qcUser,
        'UPDATE',
        'testResults/tr-101',
        { workflowStatus: 'APPROVED' },
        { workflowStatus: 'DRAFT' }
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Chỉ QA mới có thẩm quyền Phê duyệt');
    });

    it('cho phép QA thực hiện phê duyệt phiếu kiểm nghiệm và xuất xưởng lô', () => {
      const batchRes = SecurityRulesValidator.evaluate(
        qaUser,
        'UPDATE',
        'batches/b-101',
        { status: 'RELEASED' },
        { status: 'TESTING' }
      );
      expect(batchRes.allowed).toBe(true);

      const trRes = SecurityRulesValidator.evaluate(
        qaUser,
        'UPDATE',
        'testResults/tr-101',
        { workflowStatus: 'APPROVED' },
        { workflowStatus: 'DRAFT' }
      );
      expect(trRes.allowed).toBe(true);
    });

    it('aiActionGuard biến hành động nhạy cảm của AI thành proposal yêu cầu Human Approval', () => {
      const guardResult = aiActionGuard.validateAIAction(
        'updateBatchStatus',
        { batchId: 'b-101', status: 'RELEASED' },
        { id: 'u-qa', role: 'QA' },
        'Tất cả 12 chỉ tiêu đạt 100%'
      );

      expect(guardResult.allowed).toBe(true);
      expect(guardResult.requiresUserApproval).toBe(true);
      expect(guardResult.proposal?.status).toBe('PENDING_APPROVAL');
      expect(guardResult.proposal?.isRegulated).toBe(true);
    });

    it('aiActionGuard từ chối khi tài khoản AI gọi không có quyền RBAC', () => {
      const guardResult = aiActionGuard.validateAIAction(
        'updateBatchStatus',
        { batchId: 'b-101', status: 'RELEASED' },
        { id: 'u-lab', role: 'LAB' },
        'AI đề xuất xuất xưởng'
      );

      expect(guardResult.allowed).toBe(false);
      expect(guardResult.reason).toContain('Từ chối: Tài khoản vai trò LAB không có quyền');
    });
  });

  // ============================================================
  // 2. Snapshot & Hash Tampering
  // ============================================================
  describe('Gate 2: Snapshot & Cryptographic Hash Tampering', () => {
    it('chặn sửa trực tiếp phiếu đã chốt evaluationSnapshot bởi người dùng thông thường', () => {
      const lockedData = {
        id: 'tr-001',
        overallStatus: 'PASS',
        evaluationSnapshot: {
          evaluatedAt: '2026-09-01T00:00:00Z',
          hash: 'hash-abc',
        },
      };

      const result = SecurityRulesValidator.evaluate(
        qcUser,
        'UPDATE',
        'testResults/tr-001',
        { overallStatus: 'FAIL' },
        lockedData
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('đã có snapshot đánh giá');
    });

    it('phát hiện khi evaluationHash hoặc payload bị giả mạo', async () => {
      const originalPayload = 'tr-001|BATCH-01|PASS|{"eval":true}';
      const validHash = await calculateSha256(originalPayload);

      // Kẻ tấn công sửa nội dung nhưng giữ nguyên hash
      const tamperedPayload = 'tr-001|BATCH-01|FAIL|{"eval":true}';
      const recalculated = await calculateSha256(tamperedPayload);

      expect(recalculated).not.toBe(validHash);
    });
  });

  // ============================================================
  // 3. Audit Tampering: Không cho phép UPDATE / DELETE nhật ký kiểm toán
  // ============================================================
  describe('Gate 3: Audit Trail Tampering Defense', () => {
    it('chặn người dùng thông thường xóa nhật ký kiểm toán', () => {
      const result = SecurityRulesValidator.evaluate(qaUser, 'DELETE', 'audit_logs/AUDIT-001');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Append-only');
    });

    it('chặn ngay cả ADMIN cố tình xóa hoặc sửa nhật ký kiểm toán (ALCOA+ Invariant)', () => {
      const updateResult = SecurityRulesValidator.evaluate(
        adminUser,
        'UPDATE',
        'audit_logs/AUDIT-001',
        { reason: 'Đã sửa' }
      );
      expect(updateResult.allowed).toBe(false);
      expect(updateResult.reason).toContain('ALCOA+ Violation: Nhật ký kiểm toán là bất biến');

      const deleteResult = SecurityRulesValidator.evaluate(
        adminUser,
        'DELETE',
        'audit_logs/AUDIT-001'
      );
      expect(deleteResult.allowed).toBe(false);
      expect(deleteResult.reason).toContain('ALCOA+ Violation: Nhật ký kiểm toán là bất biến');
    });

    it('AlcoaAuditManager phát hiện can thiệp sửa đổi trên chuỗi audit', async () => {
      const genesis = await AlcoaAuditManager.createGenesisRecord({
        entityType: 'TEST_RESULT',
        entityId: 'tr-001',
        userId: 'admin',
        reason: 'Khởi tạo',
      });

      const tampered = { ...genesis, reason: 'Nội dung bị sửa trộm' };
      const verify = await AlcoaAuditManager.verifyChainIntegrity([tampered]);
      expect(verify.isValid).toBe(false);
      expect(verify.violations[0].type).toBe('HASH_MISMATCH');
    });
  });

  // ============================================================
  // 4. Stale Version & Optimistic Concurrency Conflict
  // ============================================================
  describe('Gate 4: Stale Version Conflict Rejection', () => {
    it('từ chối ghi khi client gửi version lỗi thời (client gửi version 8, DB đang là 10)', () => {
      const entityInDb = { id: 'batch-001', version: 10 };
      const check = ConcurrencyManager.verifyVersion(entityInDb, 8);

      expect(check.isValid).toBe(false);
      expect(check.error?.expectedVersion).toBe(8);
      expect(check.error?.actualVersion).toBe(10);
      expect(check.error?.message).toContain('CONCURRENT_MODIFICATION');
    });
  });

  // ============================================================
  // 5. Transaction Failure & Atomic Rollback
  // ============================================================
  describe('Gate 5: Atomic Transaction Failure & Full Rollback', () => {
    it('rollback toàn bộ khi 1 mutation thất bại trong chuỗi nhiều mutation', async () => {
      const dbState: Record<string, any> = {
        'e-1': { id: 'e-1', val: 100 },
        'e-2': { id: 'e-2', val: 200 },
        'e-3': { id: 'e-3', val: 300 },
      };

      const plan: HealingPlan = {
        planId: 'plan-atomic-gate',
        correlationId: 'c-gate',
        actions: [
          {
            actionId: 'act-1',
            issueId: 'iss-gate',
            planId: 'plan-atomic-gate',
            entityId: 'e-1',
            actor: 'qa-user',
            approvedBy: 'qa-lead',
            oldValue: 100,
            newValue: 110,
            reason: 'Step 1',
            timestamp: new Date().toISOString(),
            result: 'SUCCESS',
            correlationId: 'c-gate',
          },
          {
            actionId: 'act-2',
            issueId: 'iss-gate',
            planId: 'plan-atomic-gate',
            entityId: 'e-2',
            actor: 'qa-user',
            approvedBy: 'qa-lead',
            oldValue: 200,
            newValue: 220,
            reason: 'Step 2',
            timestamp: new Date().toISOString(),
            result: 'SUCCESS',
            correlationId: 'c-gate',
          },
          {
            actionId: 'act-3',
            issueId: 'iss-gate',
            planId: 'plan-atomic-gate',
            entityId: 'e-3',
            actor: 'qa-user',
            approvedBy: 'qa-lead',
            oldValue: 300,
            newValue: 330,
            reason: 'Step 3 fails',
            timestamp: new Date().toISOString(),
            result: 'SUCCESS',
            correlationId: 'c-gate',
          },
        ],
        status: 'APPROVED',
      };

      const applyMutation = async (entityId: string, val: any) => {
        if (entityId === 'e-3') {
          throw new Error('Cố tình mô phỏng lỗi ghi DB tại mutation 3');
        }
        dbState[entityId] = { id: entityId, val };
      };

      const rollbackMutation = async (entityId: string, oldVal: any) => {
        dbState[entityId] = { id: entityId, val: oldVal };
      };

      const outcome = await AutoHealingFramework.executeAtomicHealingPlan({
        plan,
        actor: 'qa-user',
        actorRole: 'QA',
        atomicCommit: async () => {
          for (const act of plan.actions) {
            await applyMutation(act.entityId, act.newValue);
          }
          return true;
        },
        rollbackHandler: async () => {
          for (const act of plan.actions) {
            await rollbackMutation(act.entityId, act.oldValue);
          }
        },
      });

      expect(outcome.success).toBe(false);
      expect(outcome.error).toContain('Cố tình mô phỏng lỗi ghi DB');
      // Toàn bộ trạng thái trong dbState phải được hoàn nguyên về ban đầu
      expect(dbState['e-1'].val).toBe(100);
      expect(dbState['e-2'].val).toBe(200);
      expect(dbState['e-3'].val).toBe(300);
    });
  });
});
