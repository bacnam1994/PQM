import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parsePathToEntity,
  analyzeFieldDiffs,
  resolveMutationConflict
} from './conflictResolutionService';
import * as auditService from './auditService';

vi.mock('./auditService', () => ({
  logAuditAction: vi.fn().mockResolvedValue(undefined)
}));

describe('PQM 3.0 - ConflictResolutionService (ALCOA+ Conflict Engine)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parsePathToEntity', () => {
    it('should parse batch paths correctly', () => {
      const result = parsePathToEntity('batches/batch-123');
      expect(result.collection).toBe('BATCHES');
      expect(result.id).toBe('batch-123');
    });

    it('should parse test result paths correctly', () => {
      const result = parsePathToEntity('/testResults/tr-456/');
      expect(result.collection).toBe('TEST_RESULTS');
      expect(result.id).toBe('tr-456');
    });

    it('should parse deviations paths correctly', () => {
      const result = parsePathToEntity('quality_deviations/DEV-2026-001');
      expect(result.collection).toBe('DEVIATIONS');
      expect(result.id).toBe('DEV-2026-001');
    });

    it('should fallback to SYSTEM for unknown collections', () => {
      const result = parsePathToEntity('unknown_folder/item-999');
      expect(result.collection).toBe('SYSTEM');
      expect(result.id).toBe('item-999');
    });
  });

  describe('analyzeFieldDiffs', () => {
    it('should ignore system metadata fields (version, updatedAt, id)', () => {
      const client = { id: 'b1', version: 1, updatedAt: 1000, notes: 'New Note' };
      const server = { id: 'b1', version: 2, updatedAt: 2000, notes: 'New Note' };

      const result = analyzeFieldDiffs(client, server);
      expect(result.conflictingFields).toHaveLength(0);
      expect(result.nonConflictingFields).toHaveLength(0);
      expect(result.diffs).toHaveLength(0);
    });

    it('should detect non-conflicting fields when server does not have that field yet', () => {
      const client = { packaging: 'Box of 100 tablets' };
      const server = { batchNo: 'LO-001' };

      const result = analyzeFieldDiffs(client, server);
      expect(result.conflictingFields).toHaveLength(0);
      expect(result.nonConflictingFields).toContain('packaging');
    });

    it('should detect direct conflict when both have differing values for the same field', () => {
      const client = { status: 'RELEASED', actualYield: 1050 };
      const server = { status: 'TESTING', actualYield: 1050 };

      const result = analyzeFieldDiffs(client, server);
      expect(result.conflictingFields).toEqual(['status']);
      expect(result.nonConflictingFields).toHaveLength(0);
      expect(result.diffs[0].fieldName).toBe('status');
      expect(result.diffs[0].isConflicting).toBe(true);
    });
  });

  describe('resolveMutationConflict', () => {
    it('should perform SAFE_MERGE when fields are non-conflicting', async () => {
      const clientPayload = { packaging: 'Chai 500ml', notes: 'Ghi chú offline' };
      const serverData = { id: 'batch-01', batchNo: 'B2026-01', status: 'TESTING', version: 2 };

      const result = await resolveMutationConflict(
        'batches/batch-01',
        clientPayload,
        serverData,
        1,
        'qa@vbiotech.com'
      );

      expect(result.canAutoResolve).toBe(true);
      expect(result.strategy).toBe('SAFE_MERGE');
      expect(result.resolvedData.id).toBe('batch-01');
      expect(result.resolvedData.batchNo).toBe('B2026-01');
      expect(result.resolvedData.packaging).toBe('Chai 500ml');
      expect(result.resolvedData.notes).toBe('Ghi chú offline');
      expect(result.resolvedData.version).toBe(3); // Next version
      expect(result.resolvedData.updatedBy).toBe('qa@vbiotech.com');

      expect(auditService.logAuditAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SYNC_MERGE',
          collection: 'BATCHES',
          documentId: 'batch-01'
        })
      );
    });

    it('should apply SERVER_WINS when direct conflicting fields exist', async () => {
      const clientPayload = { status: 'RELEASED', rejectReason: null };
      const serverData = { id: 'batch-01', status: 'REJECTED', rejectReason: 'OOS Vi sinh', version: 3 };

      const result = await resolveMutationConflict(
        'batches/batch-01',
        clientPayload,
        serverData,
        1,
        'operator@vbiotech.com'
      );

      expect(result.canAutoResolve).toBe(false);
      expect(result.strategy).toBe('SERVER_WINS');
      expect(result.resolvedData.status).toBe('REJECTED'); // Server state preserved
      expect(result.conflictingFields).toEqual(['status', 'rejectReason']);

      expect(auditService.logAuditAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SYNC_CONFLICT',
          collection: 'BATCHES',
          documentId: 'batch-01'
        })
      );
    });
  });
});
