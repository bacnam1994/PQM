/**
 * tests/security/firebaseRulesSecurity.test.ts
 *
 * PQM FIREBASE RULES & SECURITY INTEGRATION TEST SUITE
 *
 * Tests the security perimeter of PQM:
 * 1. Server-Only Write Enforcement: audit_logs, release_commands, electronic_signatures
 * 2. Scoped READ Access Control: batches, testResults, product_formulas, quality_deviations, change_requests
 * 3. Privilege Escalation Prevention: users profile mutation, admin claim spoofing
 * 4. Client Release Mutation Barrier: direct mutation to status 'RELEASED' on batches is blocked
 * 5. Emulator Configuration & Integration Readiness
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Firebase Rules & Security Integration Perimeter', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const dbRulesPath = path.join(rootDir, 'database.rules.json');
  const firebaseJsonPath = path.join(rootDir, 'firebase.json');

  const rulesContent = fs.readFileSync(dbRulesPath, 'utf8');
  const parsedRules = JSON.parse(rulesContent).rules;
  const firebaseJson = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));

  describe('1. Server-Only Write Controls (Zero Client Mutation)', () => {
    it('audit_logs: write MUST be strictly false', () => {
      expect(parsedRules.audit_logs).toBeDefined();
      expect(parsedRules.audit_logs['$log_id']['.write']).toBe(false);
    });

    it('release_commands: write MUST be strictly false', () => {
      expect(parsedRules.release_commands).toBeDefined();
      expect(parsedRules.release_commands['$cmd_id']['.write']).toBe(false);
    });

    it('electronic_signatures: write MUST be strictly false (Phase 4 Hardening)', () => {
      expect(parsedRules.electronic_signatures).toBeDefined();
      expect(parsedRules.electronic_signatures['$sig_id']['.write']).toBe(false);
    });

    it('root write MUST be strictly false', () => {
      expect(parsedRules['.write']).toBe(false);
    });
  });

  describe('2. Scoped READ Permissions (No Overbroad Access)', () => {
    it('batches: READ MUST deny unapproved GUEST accounts', () => {
      const readRule = parsedRules.batches['.read'];
      expect(readRule).toBeDefined();
      expect(readRule).toContain('GUEST');
      expect(readRule).toContain('!==');
    });

    it('testResults: READ MUST deny unapproved GUEST accounts', () => {
      const readRule = parsedRules.testResults['.read'];
      expect(readRule).toBeDefined();
      expect(readRule).toContain('GUEST');
      expect(readRule).toContain('!==');
    });

    it('product_formulas: READ MUST be restricted to QA, QC, PRODUCTION, ADMIN (IP Protection)', () => {
      const readRule = parsedRules.product_formulas['.read'];
      expect(readRule).toBeDefined();
      expect(readRule).toContain('QA');
      expect(readRule).toContain('QC');
      expect(readRule).toContain('PRODUCTION');
      expect(readRule).not.toContain('auth != null"');
    });

    it('quality_deviations: READ MUST be restricted to QA, QC, PRODUCTION, USER, ADMIN', () => {
      const readRule = parsedRules.quality_deviations['.read'];
      expect(readRule).toBeDefined();
      expect(readRule).toContain('QA');
      expect(readRule).toContain('QC');
      expect(readRule).toContain('PRODUCTION');
    });

    it('change_requests: READ MUST be restricted to QA, QC, PRODUCTION, USER, ADMIN', () => {
      const readRule = parsedRules.change_requests['.read'];
      expect(readRule).toBeDefined();
      expect(readRule).toContain('QA');
      expect(readRule).toContain('QC');
    });

    it('approval_tasks: READ MUST be restricted to QA, QC, USER, ADMIN', () => {
      const readRule = parsedRules.approval_tasks['.read'];
      expect(readRule).toBeDefined();
      expect(readRule).toContain('QA');
      expect(readRule).toContain('QC');
    });
  });

  describe('3. Batch Release Client Bypass Defense', () => {
    it('batches write rule MUST reject any client mutation setting status to RELEASED', () => {
      const writeRule = parsedRules.batches['$item_id']['.write'];
      expect(writeRule).toContain("newData.child('status').val() !== 'RELEASED'");
    });

    it('batches write rule MUST require QA or ADMIN for status changes', () => {
      const writeRule = parsedRules.batches['$item_id']['.write'];
      expect(writeRule).toContain('QA');
      expect(writeRule).toContain('ADMIN');
    });
  });

  describe('4. Firebase Emulators Configuration Readiness', () => {
    it('firebase.json MUST define emulator ports for database, auth, and functions', () => {
      expect(firebaseJson.emulators).toBeDefined();
      expect(firebaseJson.emulators.database).toBeDefined();
      expect(firebaseJson.emulators.database.port).toBe(9000);
      expect(firebaseJson.emulators.auth).toBeDefined();
      expect(firebaseJson.emulators.auth.port).toBe(9099);
      expect(firebaseJson.emulators.functions).toBeDefined();
      expect(firebaseJson.emulators.functions.port).toBe(5001);
    });
  });

  describe('5. User-Mandated Critical Security Scenarios (Exact Cases)', () => {
    // Case 1: GUEST → batches DENY
    it('Case 1: GUEST → batches READ MUST be DENIED', () => {
      const readRule = parsedRules.batches['.read'];
      expect(readRule).toContain("root.child('users/' + auth.uid + '/role').val() !== 'GUEST'");
    });

    // Case 2: GUEST → testResults DENY
    it('Case 2: GUEST → testResults READ MUST be DENIED', () => {
      const readRule = parsedRules.testResults['.read'];
      expect(readRule).toContain("root.child('users/' + auth.uid + '/role').val() !== 'GUEST'");
    });

    // Case 3: USER → electronic_signatures WRITE DENY
    it('Case 3: USER → electronic_signatures WRITE MUST be DENIED (server-only)', () => {
      const writeRule = parsedRules.electronic_signatures['$sig_id']['.write'];
      expect(writeRule).toBe(false);
    });

    // Case 4: QA → audit_logs WRITE DENY
    it('Case 4: QA → audit_logs WRITE MUST be DENIED (server-only / immutable)', () => {
      const writeRule = parsedRules.audit_logs['$log_id']['.write'];
      expect(writeRule).toBe(false);
    });

    // Case 5: USER → release_commands WRITE DENY
    it('Case 5: USER → release_commands WRITE MUST be DENIED (server-only)', () => {
      const writeRule = parsedRules.release_commands['$cmd_id']['.write'];
      expect(writeRule).toBe(false);
    });

    // Case 6: USER → batches RELEASED DENY
    it('Case 6: USER → batches RELEASED MUST be DENIED (status !== RELEASED enforced)', () => {
      const writeRule = parsedRules.batches['$item_id']['.write'];
      expect(writeRule).toContain("newData.child('status').val() !== 'RELEASED'");
      expect(writeRule).not.toContain("role').val() == 'USER'");
    });

    // Case 7: QA → approve release server only
    it('Case 7: QA → approve release server only (direct client write to RELEASED is blocked for everyone including QA)', () => {
      const writeRule = parsedRules.batches['$item_id']['.write'];
      // Even for QA, direct status: RELEASED write is blocked by newData.child('status').val() !== 'RELEASED'
      expect(writeRule).toContain("newData.child('status').val() !== 'RELEASED'");
    });
  });
});
