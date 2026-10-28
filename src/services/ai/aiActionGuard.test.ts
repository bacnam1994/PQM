import { describe, it, expect } from 'vitest';
import { 
  validateAIAction, 
  resolveToolPermission, 
  isRegulatedToolAction 
} from './aiActionGuard';
import { UserIdentity } from '../../types/permissions';

describe('aiActionGuard - PQM 3.0 AI Governance', () => {
  const adminUser: UserIdentity = { uid: 'u-admin', role: 'ADMIN', isAdmin: true };
  const qaUser: UserIdentity = { uid: 'u-qa', role: 'QA' };
  const qcUser: UserIdentity = { uid: 'u-qc', role: 'QC' };
  const prodUser: UserIdentity = { uid: 'u-prod', role: 'PRODUCTION' };
  const viewerUser: UserIdentity = { uid: 'u-viewer', role: 'VIEWER' };

  describe('1. Permission Mapping & Regulated Action Detection', () => {
    it('should resolve updateBatchStatus with RELEASED to batch:release', () => {
      expect(resolveToolPermission('updateBatchStatus', { status: 'RELEASED' })).toBe('batch:release');
      expect(isRegulatedToolAction('updateBatchStatus', { status: 'RELEASED' })).toBe(true);
    });

    it('should resolve updateBatchStatus with TESTING to batch:update', () => {
      expect(resolveToolPermission('updateBatchStatus', { status: 'TESTING' })).toBe('batch:update');
      expect(isRegulatedToolAction('updateBatchStatus', { status: 'TESTING' })).toBe(false);
    });

    it('should identify autoHealInconsistencies and harmonizeMaterials as strictly regulated', () => {
      expect(isRegulatedToolAction('autoHealInconsistencies', {})).toBe(true);
      expect(isRegulatedToolAction('harmonizeMaterials', {})).toBe(true);
    });
  });

  describe('2. Authorization Enforcement', () => {
    it('should reject execution when user is not logged in', () => {
      const res = validateAIAction('updateBatchStatus', { status: 'RELEASED' }, null);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Yêu cầu đăng nhập');
    });

    it('should deny QC user from executing batch release via AI', () => {
      const res = validateAIAction('updateBatchStatus', { status: 'RELEASED' }, qcUser);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('không có quyền thực hiện [batch:release]');
    });

    it('should deny VIEWER from creating batches or test results', () => {
      const res = validateAIAction('createBatch', { batchNo: 'L01' }, viewerUser);
      expect(res.allowed).toBe(false);
    });
  });

  describe('3. Regulated Actions & Human-In-The-Loop Proposal', () => {
    it('should allow QA user to release batch BUT flag as requiresUserApproval', () => {
      const res = validateAIAction(
        'updateBatchStatus', 
        { batchId: 'b-123', status: 'RELEASED' }, 
        qaUser, 
        'Phiếu kiểm nghiệm số PKN-01 đã đạt 100% chỉ tiêu.'
      );
      expect(res.allowed).toBe(true);
      expect(res.requiresUserApproval).toBe(true);
      expect(res.proposal).toBeDefined();
      expect(res.proposal?.status).toBe('PENDING_APPROVAL');
      expect(res.proposal?.evidence).toContain('PKN-01 đã đạt 100%');
    });

    it('should allow PRODUCTION user to create batch without requiring separate regulated dual-approval', () => {
      const res = validateAIAction(
        'createBatch', 
        { batchNo: 'B2026-001', productId: 'p1' }, 
        prodUser
      );
      expect(res.allowed).toBe(true);
      expect(res.requiresUserApproval).toBe(false);
      expect(res.proposal?.status).toBe('APPROVED');
    });

    it('should allow ADMIN to run autoHeal but still mark it as regulated for safety', () => {
      const res = validateAIAction('autoHealInconsistencies', {}, adminUser);
      expect(res.allowed).toBe(true);
      expect(res.requiresUserApproval).toBe(true);
      expect(res.proposal?.requiredPermission).toBe('settings:update');
    });
  });
});
