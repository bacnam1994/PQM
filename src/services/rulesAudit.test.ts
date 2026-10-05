import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Security Rules Static Audit - PQM 3.0', () => {
  const dbRulesPath = path.resolve(__dirname, '../../database.rules.json');
  const storageRulesPath = path.resolve(__dirname, '../../storage.rules');

  describe('1. Realtime Database Rules Validation', () => {
    it('should parse database.rules.json as valid JSON without syntax errors', () => {
      const content = fs.readFileSync(dbRulesPath, 'utf8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should enforce strict privilege escalation protection on /users/$uid', () => {
      const content = fs.readFileSync(dbRulesPath, 'utf8');
      const rules = JSON.parse(content).rules;
      const userWriteRule = rules.users['$uid']['.write'];

      expect(userWriteRule).toBeDefined();
      // Phải chặn tự gán role hoặc isAdmin nếu không phải admin
      expect(userWriteRule).toContain("!newData.hasChild('role')");
      expect(userWriteRule).toContain("!newData.hasChild('isAdmin')");
    });

    it('should enforce QA/Admin constraint when changing batch status to RELEASED', () => {
      const content = fs.readFileSync(dbRulesPath, 'utf8');
      const rules = JSON.parse(content).rules;
      const batchWriteRule = rules.batches['$item_id']['.write'];

      expect(batchWriteRule).toBeDefined();
      // Phải kiểm tra role QA hoặc ADMIN cho RELEASED
      expect(batchWriteRule).toContain('RELEASED');
      expect(batchWriteRule).toContain('QA');
      expect(batchWriteRule).toContain("newData.child('status').val() !== 'RELEASED'");
    });

    it('should enforce server-only write protection on audit_logs (Phase 2.2)', () => {
      const content = fs.readFileSync(dbRulesPath, 'utf8');
      const rules = JSON.parse(content).rules;
      const auditWriteRule = rules.audit_logs['$log_id']['.write'];

      expect(auditWriteRule).toBe(false);
    });

    it('should restrict testResults approval and locking from unauthorized alteration', () => {
      const content = fs.readFileSync(dbRulesPath, 'utf8');
      const rules = JSON.parse(content).rules;
      const testResultWriteRule = rules.testResults['$item_id']['.write'];

      expect(testResultWriteRule).toBeDefined();
      expect(testResultWriteRule).toContain('QA');
    });

    it('should enforce server-only write protection on electronic_signatures (Phase 4 Hardening)', () => {
      const content = fs.readFileSync(dbRulesPath, 'utf8');
      const rules = JSON.parse(content).rules;
      const sigWriteRule = rules.electronic_signatures['$sig_id']['.write'];

      expect(sigWriteRule).toBe(false);
    });

    it('should enforce server-only write protection on release_commands', () => {
      const content = fs.readFileSync(dbRulesPath, 'utf8');
      const rules = JSON.parse(content).rules;
      const cmdWriteRule = rules.release_commands['$cmd_id']['.write'];

      expect(cmdWriteRule).toBe(false);
    });

    it('should restrict READ rules on batches and product_formulas to prevent GUEST / unauthorized access', () => {
      const content = fs.readFileSync(dbRulesPath, 'utf8');
      const rules = JSON.parse(content).rules;

      expect(rules.batches['.read']).toContain('GUEST');
      expect(rules.testResults['.read']).toContain('GUEST');
      expect(rules.product_formulas['.read']).toContain('PRODUCTION');
      expect(rules.quality_deviations['.read']).toContain('PRODUCTION');
    });
  });

  describe('2. Firebase Storage Rules Validation', () => {
    it('should contain QA and size limits for certificates and attachments', () => {
      const content = fs.readFileSync(storageRulesPath, 'utf8');
      expect(content).toContain('match /coas/{allPaths=**}');
      expect(content).toContain('match /test_attachments/{allPaths=**}');
      expect(content).toContain('request.resource.size < 20 * 1024 * 1024');
      expect(content).toContain('isQA()');
    });
  });
});
