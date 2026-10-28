import { describe, it, expect } from 'vitest';
import {
  classifyAuditEvent,
  createHardenedAuditRecord,
  verifyAuditChainIntegrity,
  TamperProofAuditRecord
} from './auditHardeningService';

describe('TASK-007: ALCOA+ Audit Hardening Service', () => {
  describe('1. Classification', () => {
    it('phân loại chính xác các sự kiện regulated (GMP critical)', () => {
      expect(classifyAuditEvent('TEST_RESULTS', 'CREATE')).toBe('REGULATED');
      expect(classifyAuditEvent('BATCHES', 'UPDATE')).toBe('REGULATED');
      expect(classifyAuditEvent('TCCS', 'UPDATE')).toBe('REGULATED');
      expect(classifyAuditEvent('PRODUCTS', 'DELETE')).toBe('REGULATED');
    });

    it('phân loại các sự kiện informational thông thường', () => {
      expect(classifyAuditEvent('SYSTEM', 'LOGIN')).toBe('INFORMATIONAL');
      expect(classifyAuditEvent('PRODUCTS', 'VIEW')).toBe('INFORMATIONAL');
    });
  });

  describe('2. Hash Chaining & Tamper Detection', () => {
    it('tạo chuỗi audit trail 3 bản ghi và xác minh tính toàn vẹn thành công', async () => {
      const log1 = await createHardenedAuditRecord({
        action: 'CREATE',
        collection: 'BATCHES',
        documentId: 'b-01',
        details: 'Tạo lô sản xuất B01',
        performedBy: 'qa1@pqm.com',
        timestamp: '2026-03-01T08:00:00Z'
      });

      const log2 = await createHardenedAuditRecord({
        action: 'CREATE',
        collection: 'TEST_RESULTS',
        documentId: 'tr-01',
        details: 'Nhập kết quả kiểm nghiệm lô B01',
        performedBy: 'lab1@pqm.com',
        timestamp: '2026-03-01T09:00:00Z'
      }, log1.entryHash);

      const log3 = await createHardenedAuditRecord({
        action: 'UPDATE',
        collection: 'BATCHES',
        documentId: 'b-01',
        details: 'Phê duyệt xuất xưởng lô B01',
        performedBy: 'qa_head@pqm.com',
        timestamp: '2026-03-01T10:00:00Z'
      }, log2.entryHash);

      const chain: TamperProofAuditRecord[] = [log1, log2, log3];
      const verification = await verifyAuditChainIntegrity(chain);

      expect(verification.isValid).toBe(true);
    });

    it('phát hiện can thiệp khi nội dung chi tiết của bản ghi bị sửa đổi (Tampered Content)', async () => {
      const log1 = await createHardenedAuditRecord({
        action: 'CREATE',
        collection: 'TEST_RESULTS',
        details: 'Kết quả đạt yêu cầu: 99.5%',
        performedBy: 'qc@pqm.com',
        timestamp: '2026-03-01T08:00:00Z'
      });

      const log2 = await createHardenedAuditRecord({
        action: 'UPDATE',
        collection: 'TEST_RESULTS',
        details: 'QA duyệt phiếu',
        performedBy: 'qa@pqm.com',
        timestamp: '2026-03-01T09:00:00Z'
      }, log1.entryHash);

      const tamperedChain: TamperProofAuditRecord[] = [
        log1,
        { ...log2, details: 'QA duyệt phiếu (ĐÃ BỊ HACK SỬA SỐ LIỆU)' }
      ];

      const verification = await verifyAuditChainIntegrity(tamperedChain);

      expect(verification.isValid).toBe(false);
      expect(verification.brokenAtIndex).toBe(1);
      expect(verification.reason).toContain('đã bị can thiệp');
    });

    it('phát hiện khi một bản ghi bị xóa khỏi chuỗi (Broken Link in Chain)', async () => {
      const log1 = await createHardenedAuditRecord({ action: 'C1', collection: 'TCCS', details: 'D1', performedBy: 'u1' });
      const log2 = await createHardenedAuditRecord({ action: 'C2', collection: 'TCCS', details: 'D2', performedBy: 'u2' }, log1.entryHash);
      const log3 = await createHardenedAuditRecord({ action: 'C3', collection: 'TCCS', details: 'D3', performedBy: 'u3' }, log2.entryHash);

      // Kẻ gian xóa log2 hòng che giấu hành vi
      const brokenChain = [log1, log3];
      const verification = await verifyAuditChainIntegrity(brokenChain);

      expect(verification.isValid).toBe(false);
      expect(verification.brokenAtIndex).toBe(1);
      expect(verification.reason).toContain('Mối nối băm bị gãy');
    });
  });
});
