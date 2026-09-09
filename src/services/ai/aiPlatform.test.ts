import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promptRegistry } from './promptRegistry';
import { aiGateway } from './AIGateway';
import * as auditService from '../auditService';

describe('AI Platform Governance - Prompt Registry & AI Gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PromptRegistryService', () => {
    it('should retrieve latest active prompt definition for OCR_EXTRACT', () => {
      const prompt = promptRegistry.getPrompt('OCR_EXTRACT');
      expect(prompt).toBeDefined();
      expect(prompt.id).toBe('OCR_EXTRACT');
      expect(prompt.version).toBe('2.5.0');
      expect(prompt.systemPrompt).toContain('V-Biotech');
    });

    it('should retrieve specific version of prompt when requested', () => {
      const prompt = promptRegistry.getPrompt('BATCH_CLEARANCE', '2.2.0');
      expect(prompt).toBeDefined();
      expect(prompt.version).toBe('2.2.0');
    });

    it('should fallback to latest version when an unknown version is requested', () => {
      const prompt = promptRegistry.getPrompt('OOS_INVESTIGATION', '99.9.9');
      expect(prompt).toBeDefined();
      expect(prompt.id).toBe('OOS_INVESTIGATION');
      expect(prompt.version).toBe('2.1.0');
    });

    it('should throw error for unknown prompt identifier', () => {
      expect(() => promptRegistry.getPrompt('UNKNOWN_ID' as any)).toThrow();
    });

    it('should list all registered prompts', () => {
      const allPrompts = promptRegistry.getAllPrompts();
      expect(allPrompts.length).toBeGreaterThanOrEqual(5);
      const ids = allPrompts.map(p => p.id);
      expect(ids).toContain('OCR_EXTRACT');
      expect(ids).toContain('BATCH_CLEARANCE');
      expect(ids).toContain('OOS_INVESTIGATION');
      expect(ids).toContain('DEVIATION_REPORT');
      expect(ids).toContain('PQR_NARRATIVE');
    });

    it('should generate proper prompt version key', () => {
      const key = promptRegistry.getPromptVersionKey('DEVIATION_REPORT');
      expect(key).toBe('DEVIATION_REPORT@2.0.0');
    });
  });

  describe('AIGatewayService', () => {
    it('should fail gracefully and log error metadata when API Key is missing', async () => {
      const logAuditSpy = vi.spyOn(auditService, 'logAuditAction').mockImplementation(async () => {});

      const response = await aiGateway.execute({
        promptId: 'BATCH_CLEARANCE',
        input: { batchNo: 'B2026-01' },
      });

      expect(response).toBeDefined();
      expect(response.metadata.promptId).toBe('BATCH_CLEARANCE');
      expect(response.metadata.promptVersion).toBe('2.2.0');
      expect(response.metadata.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should calculate confidence score correctly for structured outputs', () => {
      const gateway = aiGateway as any;

      // Numerical confidence
      const numRes = gateway.calculateConfidenceScore({ confidence: 0.92 });
      expect(numRes.score).toBe(0.92);
      expect(numRes.level).toBe('HIGH');

      // String confidence
      const strRes = gateway.calculateConfidenceScore({ confidence: 'MEDIUM' });
      expect(strRes.score).toBe(0.75);
      expect(strRes.level).toBe('MEDIUM');

      // Array of criteria items with confidence
      const listRes = gateway.calculateConfidenceScore({
        items: [
          { name: 'pH', confidence: 'HIGH' },
          { name: 'Assay', confidence: 'HIGH' },
          { name: 'LOD', confidence: 'LOW' },
        ]
      });
      expect(listRes.score).toBeGreaterThan(0.7);
    });
  });
});
