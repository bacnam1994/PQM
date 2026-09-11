import { describe, it, expect } from 'vitest';
import { 
  permissionService, 
  can, 
  canAny, 
  canAll, 
  hasRole, 
  isAdmin 
} from './permissionService';
import { UserIdentity } from '../types/permissions';

describe('permissionService - PQM 3.0 RBAC Engine', () => {
  const adminUser: UserIdentity = { uid: 'u-admin', email: 'admin@vbiotech.vn', role: 'ADMIN', isAdmin: true };
  const qaUser: UserIdentity = { uid: 'u-qa', email: 'qa@vbiotech.vn', role: 'QA' };
  const qcUser: UserIdentity = { uid: 'u-qc', email: 'qc@vbiotech.vn', role: 'QC' };
  const labUser: UserIdentity = { uid: 'u-lab', email: 'lab@vbiotech.vn', role: 'LAB' };
  const prodUser: UserIdentity = { uid: 'u-prod', email: 'prod@vbiotech.vn', role: 'PRODUCTION' };
  const viewerUser: UserIdentity = { uid: 'u-viewer', email: 'viewer@vbiotech.vn', role: 'VIEWER' };
  const legacyUser: UserIdentity = { uid: 'u-user', email: 'user@vbiotech.vn', role: 'USER' };
  const guestUser: UserIdentity = { uid: 'u-guest', email: 'guest@vbiotech.vn', role: 'GUEST' };

  describe('1. ADMIN Capabilities', () => {
    it('should allow ADMIN to perform any operational action', () => {
      expect(can(adminUser, 'product:delete')).toBe(true);
      expect(can(adminUser, 'batch:release')).toBe(true);
      expect(can(adminUser, 'coa:issue')).toBe(true);
      expect(can(adminUser, 'user:manage')).toBe(true);
      expect(can(adminUser, 'ai:execute_action')).toBe(true);
      expect(isAdmin(adminUser)).toBe(true);
    });

    it('should recognize dual Admin flags (isAdmin flag or role ADMIN)', () => {
      const adminOnlyFlag = { uid: 'u-flag', email: 'flag@vbiotech.vn', isAdmin: true };
      const roleOnlyAdmin = { uid: 'u-role', email: 'role@vbiotech.vn', role: 'ADMIN' as const };

      expect(isAdmin(adminOnlyFlag)).toBe(true);
      expect(isAdmin(roleOnlyAdmin)).toBe(true);
      expect(can(adminOnlyFlag, 'user:manage')).toBe(true);
      expect(can(roleOnlyAdmin, 'batch:release')).toBe(true);
    });

    it('should allow ADMIN to bypass locked states for emergency correction', () => {
      expect(can(adminUser, 'batch:update', { status: 'RELEASED' })).toBe(true);
      expect(can(adminUser, 'batch:update', { status: 'REJECTED' })).toBe(true);
      expect(can(adminUser, 'test_result:update', { status: 'APPROVED' })).toBe(true);
      expect(can(adminUser, 'test_result:update', { status: 'LOCKED' })).toBe(true);
      expect(can(adminUser, 'test_result:delete', { status: 'APPROVED' })).toBe(true);
    });
  });

  describe('2. QA (Quality Assurance) Capabilities', () => {
    it('should allow QA to release batches, approve test results and issue CoA', () => {
      expect(can(qaUser, 'batch:release')).toBe(true);
      expect(can(qaUser, 'test_result:approve')).toBe(true);
      expect(can(qaUser, 'coa:issue')).toBe(true);
      expect(can(qaUser, 'tccs:publish')).toBe(true);
    });

    it('should deny QA from deleting master catalog products or managing system users', () => {
      expect(can(qaUser, 'product:delete')).toBe(false);
      expect(can(qaUser, 'user:manage')).toBe(false);
      expect(can(qaUser, 'batch:delete')).toBe(false);
    });
  });

  describe('3. QC (Quality Control) Capabilities', () => {
    it('should allow QC to review test results and create quality alerts', () => {
      expect(can(qcUser, 'test_result:create')).toBe(true);
      expect(can(qcUser, 'test_result:review')).toBe(true);
      expect(can(qcUser, 'quality_alert:create')).toBe(true);
      expect(can(qcUser, 'coa:print')).toBe(true);
    });

    it('should strictly deny QC from releasing batches or issuing CoA', () => {
      expect(can(qcUser, 'batch:release')).toBe(false);
      expect(can(qcUser, 'coa:issue')).toBe(false);
      expect(can(qcUser, 'tccs:publish')).toBe(false);
    });
  });

  describe('4. LAB (Analyst) Capabilities', () => {
    it('should allow LAB to enter test results and submit them for review', () => {
      expect(can(labUser, 'test_result:create')).toBe(true);
      expect(can(labUser, 'test_result:submit')).toBe(true);
      expect(can(labUser, 'product:read')).toBe(true);
    });

    it('should strictly deny LAB from approving test results or modifying standards', () => {
      expect(can(labUser, 'test_result:approve')).toBe(false);
      expect(can(labUser, 'test_result:review')).toBe(false);
      expect(can(labUser, 'tccs:update')).toBe(false);
      expect(can(labUser, 'batch:release')).toBe(false);
    });
  });

  describe('5. PRODUCTION Capabilities', () => {
    it('should allow PRODUCTION to create and update batches in draft', () => {
      expect(can(prodUser, 'batch:create')).toBe(true);
      expect(can(prodUser, 'batch:update', { status: 'PENDING' })).toBe(true);
    });

    it('should deny PRODUCTION from altering test results or releasing batches', () => {
      expect(can(prodUser, 'test_result:create')).toBe(false);
      expect(can(prodUser, 'test_result:update')).toBe(false);
      expect(can(prodUser, 'batch:release')).toBe(false);
    });
  });

  describe('6. VIEWER & GUEST Restrictions', () => {
    it('should allow VIEWER read-only access and reject all mutations', () => {
      expect(can(viewerUser, 'product:read')).toBe(true);
      expect(can(viewerUser, 'batch:read')).toBe(true);
      expect(can(viewerUser, 'batch:create')).toBe(false);
      expect(can(viewerUser, 'test_result:create')).toBe(false);
    });

    it('should reject all actions for GUEST', () => {
      expect(can(guestUser, 'product:read')).toBe(false);
      expect(can(guestUser, 'batch:create')).toBe(false);
    });

    it('should safely return false when user is null or undefined', () => {
      expect(can(null, 'product:read')).toBe(false);
      expect(can(undefined, 'product:read')).toBe(false);
    });
  });

  describe('7. Resource-Level Authorization Rules', () => {
    it('should prevent modifying a batch once it is RELEASED or REJECTED', () => {
      expect(can(prodUser, 'batch:update', { status: 'PENDING' })).toBe(true);
      expect(can(prodUser, 'batch:update', { status: 'RELEASED' })).toBe(false);
      expect(can(prodUser, 'batch:update', { status: 'REJECTED' })).toBe(false);
      // Admin bypasses for emergency correction
      expect(can(adminUser, 'batch:update', { status: 'RELEASED' })).toBe(true);
    });

    it('should prevent modifying a test result once it is APPROVED or LOCKED', () => {
      expect(can(labUser, 'test_result:update', { status: 'DRAFT' })).toBe(true);
      expect(can(labUser, 'test_result:update', { status: 'APPROVED' })).toBe(false);
      expect(can(labUser, 'test_result:update', { status: 'LOCKED' })).toBe(false);
    });
  });

  describe('8. Compound Queries & Helper Utilities', () => {
    it('should evaluate canAny correctly', () => {
      expect(canAny(labUser, ['batch:release', 'test_result:create'])).toBe(true);
      expect(canAny(labUser, ['batch:release', 'coa:issue'])).toBe(false);
    });

    it('should evaluate canAll correctly', () => {
      expect(canAll(qaUser, ['batch:release', 'test_result:approve'])).toBe(true);
      expect(canAll(qaUser, ['batch:release', 'product:delete'])).toBe(false);
    });

    it('should evaluate hasRole correctly', () => {
      expect(hasRole(qaUser, 'QA')).toBe(true);
      expect(hasRole(qaUser, ['QA', 'ADMIN'])).toBe(true);
      expect(hasRole(qaUser, 'QC')).toBe(false);
    });

    it('should maintain backward compatibility for legacy USER role', () => {
      expect(can(legacyUser, 'batch:create')).toBe(true);
      expect(can(legacyUser, 'test_result:create')).toBe(true);
      expect(can(legacyUser, 'batch:release')).toBe(false);
    });
  });
});
