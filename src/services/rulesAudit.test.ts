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
      expect(userWriteRule).toContain('!newData.hasChild(\'role\')');
      expect(userWriteRule).toContain('!newData.hasChild(\'isAdmin\')');
    });

    it('should enforce QA/Admin constraint when changing batch status to RELEASED', () => {
      const content = fs.readFileSync(dbRulesPath, 'utf8');
      const rules = JSON.parse(content).rules;
      const batchWriteRule = rules.batches['$item_id']['.write'];

      expect(batchWriteRule).toBeDefined();
      // Phải kiểm tra role QA hoặc ADMIN cho RELEASED
      expect(batchWriteRule).toContain('RELEASED');
      expect(batchWriteRule).toContain('QA');
      expect(batchWriteRule).toContain('newData.child(\'status\').val() !== \'RELEASED\'');
    });

    it('should enforce actor verification and timestamp on audit_logs', () => {
      const content = fs.readFileSync(dbRulesPath, 'utf8');
      const rules = JSON.parse(content).rules;
      const auditWriteRule = rules.audit_logs['$log_id']['.write'];

      expect(auditWriteRule).toBeDefined();
      expect(auditWriteRule).toContain('!data.exists() && newData.exists()');
      expect(auditWriteRule).toContain('actorId');
      expect(auditWriteRule).toContain('timestamp');
    });

    it('should restrict testResults approval and locking from unauthorized alteration', () => {
      const content = fs.readFileSync(dbRulesPath, 'utf8');
      const rules = JSON.parse(content).rules;
      const testResultWriteRule = rules.testResults['$item_id']['.write'];

      expect(testResultWriteRule).toBeDefined();
      expect(testResultWriteRule).toContain('QA');
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
