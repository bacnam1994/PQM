/**
 * src/services/ai/__tests__/aiBackendClient.test.ts
 * Unit tests for Frontend AI Backend Client (Phases 15, 18, 19)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AIBackendClient } from '../aiBackendClient';

describe('AIBackendClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    AIBackendClient.setApiUrl('http://mock-backend:4000');
    // Set simulated test token on window
    (window as any).__TEST_AI_TOKEN__ = 'test-firebase-id-token-xyz';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete (window as any).__TEST_AI_TOKEN__;
    vi.restoreAllMocks();
  });

  it('successfully calls /api/ai/health', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          service: 'pqm-ai-backend',
          model: 'gemini-2.5-flash',
          isConfigured: true,
          supportedTypes: ['batch_analysis'],
        },
        correlationId: 'AI-123',
      }),
    } as any);

    const res = await AIBackendClient.checkHealth();
    expect(res.success).toBe(true);
    expect(res.data.service).toBe('pqm-ai-backend');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://mock-backend:4000/api/ai/health',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('successfully calls /api/ai/analyze for batch_analysis with Bearer token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          summary: 'Lô đạt tiêu chuẩn.',
          riskLevel: 'LOW',
          findings: [],
          recommendations: [],
          limitations: ['Hỗ trợ QA.'],
        },
        metadata: {
          aiAnalysisId: 'AI-ANL-1',
          uid: 'user-qa-1',
          userEmail: 'qa@vbiotech.com',
          timestamp: '2026-10-08T00:00:00Z',
          model: 'gemini-2.5-flash',
          promptVersion: 'BATCH_ANALYSIS_V1',
          analysisType: 'batch_analysis',
          contextHash: 'hash123',
          inputRecordIds: ['BATCH-001'],
          correlationId: 'REQ-1',
        },
      }),
    } as any);

    const res = await AIBackendClient.analyzeBatch('BATCH-001');
    expect(res.data.riskLevel).toBe('LOW');
    expect(res.metadata.aiAnalysisId).toBe('AI-ANL-1');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://mock-backend:4000/api/ai/analyze',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-firebase-id-token-xyz',
        },
        body: JSON.stringify({
          type: 'batch_analysis',
          batchId: 'BATCH-001',
          promptOverride: undefined,
        }),
      })
    );
  });

  it('surfaces permission denied errors with friendly prefix', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        error: {
          code: 'AI_PERMISSION_DENIED',
          message: 'Từ chối quyền: Vai trò QC không có quyền.',
        },
      }),
    } as any);

    await expect(AIBackendClient.analyzeBatch('BATCH-001')).rejects.toThrow(
      '[Quyền hạn] Từ chối quyền: Vai trò QC không có quyền.'
    );
  });

  it('surfaces rate limit errors with friendly prefix', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        success: false,
        error: {
          code: 'AI_RATE_LIMITED',
          message: 'Tần suất yêu cầu vượt quá giới hạn.',
        },
      }),
    } as any);

    await expect(AIBackendClient.analyzeBatch('BATCH-001')).rejects.toThrow(
      '[Hạn mức] Tần suất yêu cầu vượt quá giới hạn.'
    );
  });
});
