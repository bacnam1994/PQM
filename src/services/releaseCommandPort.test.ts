/**
 * src/services/releaseCommandPort.test.ts
 * Unit tests for HttpReleaseCommandAdapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpReleaseCommandAdapter } from './releaseCommandPort';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn().mockReturnValue({
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('mock-test-id-token'),
    },
  }),
}));

describe('HttpReleaseCommandAdapter', () => {
  let adapter: HttpReleaseCommandAdapter;

  beforeEach(() => {
    adapter = new HttpReleaseCommandAdapter('http://localhost:4000');
    vi.restoreAllMocks();
  });

  it('successfully calls POST /api/batch-release/approve and returns response', async () => {
    const mockOutput = {
      success: true,
      batchId: 'batch-001',
      newVersion: 2,
      status: 'RELEASED' as const,
      releasedAt: '2026-10-13T10:00:00Z',
      correlationId: 'REL-12345',
      commandId: 'IDEM-KEY-001',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockOutput,
      })
    );

    const result = await adapter.executeRelease({
      batchId: 'batch-001',
      expectedVersion: 1,
      signatureId: 'sig_123',
      idempotencyKey: 'IDEM-KEY-001',
      correlationId: 'REL-12345',
    });

    expect(result).toEqual(mockOutput);
  });

  it('catches network error and throws informative error without losing idempotencyKey', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    try {
      await adapter.executeRelease({
        batchId: 'batch-001',
        expectedVersion: 1,
        signatureId: 'sig_123',
        idempotencyKey: 'IDEM-KEY-002',
        correlationId: 'REL-NET-ERR',
      });
      expect.unreachable('Should have thrown network error');
    } catch (err: any) {
      expect(err.message).toContain('Không thể kết nối đến Máy chủ Phê duyệt Xuất xưởng');
      expect(err.message).toContain('Failed to fetch');
      expect(err.message).toContain('CHƯA XÁC NHẬN trạng thái xuất xưởng');
      expect(err.message).toContain('IDEM-KEY-002');
      expect(err.isNetworkError).toBe(true);
      expect(err.correlationId).toBe('REL-NET-ERR');
      expect(err.idempotencyKey).toBe('IDEM-KEY-002');
    }
  });

  it('handles server HTTP error response with code and message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: {
            code: 'VERSION_CONFLICT',
            message: 'Phiên bản Lô không khớp.',
            correlationId: 'REL-CONF-01',
          },
        }),
      })
    );

    await expect(
      adapter.executeRelease({
        batchId: 'batch-001',
        expectedVersion: 1,
        signatureId: 'sig_123',
        idempotencyKey: 'IDEM-KEY-003',
        correlationId: 'REL-CONF-01',
      })
    ).rejects.toThrow(/\[VERSION_CONFLICT\] Phiên bản Lô không khớp/);
  });
});
