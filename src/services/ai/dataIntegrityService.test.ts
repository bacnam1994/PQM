import { describe, it, expect } from 'vitest';
import { isOffHours, auditDataIntegrity, AuditLogEntry } from './dataIntegrityService';
import { TestResult } from '../../types';

describe('dataIntegrityService - ALCOA+ Watchdog', () => {
  describe('isOffHours', () => {
    it('should detect off-hours timestamp (22:00)', () => {
      expect(isOffHours('2026-08-26T22:30:00Z')).toBe(true);
    });

    it('should detect regular hours timestamp (10:00)', () => {
      // 10:00 local time
      const d = new Date();
      d.setHours(10, 0, 0, 0);
      expect(isOffHours(d.toISOString())).toBe(false);
    });
  });

  describe('auditDataIntegrity', () => {
    it('should detect repeated edits and missing attachments', () => {
      const mockLogs: AuditLogEntry[] = [
        { id: '1', userEmail: 'qc1@vbiotech.com', action: 'UPDATE_TEST_RESULT', entityType: 'TEST_RESULT', entityId: 'tr_01', timestamp: new Date().toISOString() },
        { id: '2', userEmail: 'qc1@vbiotech.com', action: 'UPDATE_TEST_RESULT', entityType: 'TEST_RESULT', entityId: 'tr_01', timestamp: new Date().toISOString() },
        { id: '3', userEmail: 'qc1@vbiotech.com', action: 'UPDATE_TEST_RESULT', entityType: 'TEST_RESULT', entityId: 'tr_01', timestamp: new Date().toISOString() }
      ];

      const mockTestResults: TestResult[] = [
        { id: 'tr_01', batchId: 'b1', labName: 'QC', testDate: '2026-08-26', overallStatus: 'PASS', results: [], createdAt: '', attachments: [] }
      ];

      const report = auditDataIntegrity(mockLogs, mockTestResults, []);
      expect(report.findings.length).toBeGreaterThanOrEqual(2);
      
      const multiEdit = report.findings.find(f => f.id.includes('multiedit'));
      expect(multiEdit).toBeDefined();
      expect(multiEdit?.severity).toBe('HIGH');

      const origFinding = report.findings.find(f => f.id.includes('orig'));
      expect(origFinding).toBeDefined();
      expect(report.overallScore).toBeLessThan(100);
    });
  });
});
