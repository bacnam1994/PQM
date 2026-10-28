/**
 * src/services/signatureService.test.ts
 * Unit tests for client-side SignatureService
 * Verifies HTTP dispatch to Server Authority and CRITICAL REGRESSION: No client fallback
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignatureService, computeSignatureChecksum } from './signatureService';
import { ElectronicSignature } from '../types/signature';
import { calculateCanonicalSignatureChecksum } from '@pqm/release-engine';

vi.mock('../firebase', () => ({
  db: {},
}));

const { mockSet } = vi.hoisted(() => ({
  mockSet: vi.fn(),
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  get: vi.fn().mockResolvedValue({ exists: () => false, val: () => ({}) }),
  set: mockSet,
  query: vi.fn((r) => r),
  orderByChild: vi.fn(),
  equalTo: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn().mockReturnValue({ currentUser: null }),
  EmailAuthProvider: { credential: vi.fn() },
  reauthenticateWithCredential: vi.fn().mockResolvedValue(undefined),
}));

describe('SignatureService - Server-Authoritative (No Client Fallback)', () => {
  let service: SignatureService;

  const qaUser = {
    uid: 'u_qa',
    email: 'qa@pqm.com',
    role: 'QA' as const,
    displayName: 'Dược sĩ QA',
  };
  const labUser = {
    uid: 'u_lab',
    email: 'lab@pqm.com',
    role: 'LAB' as const,
    displayName: 'Kiểm nghiệm viên',
  };
  const adminUser = {
    uid: 'u_admin',
    email: 'admin@pqm.com',
    role: 'ADMIN' as const,
    displayName: 'Admin',
    isAdmin: true,
  };

  beforeEach(() => {
    service = new SignatureService();
    mockSet.mockClear();
    vi.restoreAllMocks();
  });

  describe('createElectronicSignature', () => {
    it('should reject unauthenticated caller', async () => {
      await expect(
        service.createElectronicSignature(null, {
          documentType: 'BATCH_RELEASE',
          documentId: 'batch-001',
        })
      ).rejects.toThrow(/Yêu cầu người dùng đăng nhập/);
    });

    it('should reject missing documentId or documentType', async () => {
      await expect(
        service.createElectronicSignature(qaUser, {
          documentType: 'BATCH_RELEASE',
          documentId: '',
        })
      ).rejects.toThrow(/Mã tài liệu/);
    });

    it('should block non-QA/Admin users from signing BATCH_RELEASE', async () => {
      await expect(
        service.createElectronicSignature(labUser, {
          documentType: 'BATCH_RELEASE',
          documentId: 'batch-001',
        })
      ).rejects.toThrow(/Chỉ bộ phận QA hoặc Quản trị viên/);
    });

    it('should call external backend API and return server-created signature', async () => {
      const mockServerSignature: ElectronicSignature = {
        id: 'sig_srv_123',
        documentType: 'BATCH_RELEASE',
        documentId: 'batch-001',
        documentVersion: 1,
        signerUid: qaUser.uid,
        signerName: qaUser.displayName,
        signerEmail: qaUser.email,
        role: qaUser.role,
        meaning: 'Xác nhận phê duyệt điện tử.',
        signedAt: '2026-10-06T12:00:00Z',
        checksum: 'abc123canonicalhash64chars000000000000000000000000000000000000000000',
        status: 'CREATED',
        comments: 'Đã kiểm tra chất lượng đạt chuẩn',
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            success: true,
            signature: mockServerSignature,
          }),
        })
      );

      const sig = await service.createElectronicSignature(qaUser, {
        documentType: 'BATCH_RELEASE',
        documentId: 'batch-001',
        documentVersion: 1,
        comments: 'Đã kiểm tra chất lượng đạt chuẩn',
      });

      expect(sig).toEqual(mockServerSignature);
      // Ensure client NEVER writes to RTDB directly
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('CRITICAL REGRESSION: should throw error and NEVER create signature in RTDB when backend request fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({
            success: false,
            error: {
              code: 'INTERNAL',
              message: 'Lỗi máy chủ khi tạo chữ ký điện tử',
            },
          }),
        })
      );

      await expect(
        service.createElectronicSignature(qaUser, {
          documentType: 'BATCH_RELEASE',
          documentId: 'batch-001',
        })
      ).rejects.toThrow(/Lỗi máy chủ khi tạo chữ ký điện tử/);

      // Absolutely ZERO writes to RTDB from client
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('should allow ADMIN to sign COA_ISSUE via backend', async () => {
      const mockAdminSig: ElectronicSignature = {
        id: 'sig_srv_admin',
        documentType: 'COA_ISSUE',
        documentId: 'coa-001',
        signerUid: adminUser.uid,
        signerName: adminUser.displayName || 'Admin',
        signerEmail: adminUser.email,
        role: 'ADMIN',
        meaning: 'Ban hành chứng nhận phân tích CoA',
        signedAt: '2026-10-06T12:00:00Z',
        checksum: 'hash64chars00000000000000000000000000000000000000000000000000000000',
        status: 'CREATED',
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            success: true,
            signature: mockAdminSig,
          }),
        })
      );

      const sig = await service.createElectronicSignature(adminUser, {
        documentType: 'COA_ISSUE',
        documentId: 'coa-001',
      });

      expect(sig.documentType).toBe('COA_ISSUE');
      expect(sig.signerEmail).toBe(adminUser.email);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('PHASE 4: should catch network failure (Failed to fetch) and provide informative error with correlationId', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

      const correlationId = 'SIG-CORR-NETWORK-ERR';
      try {
        await service.createElectronicSignature(qaUser, {
          documentType: 'BATCH_RELEASE',
          documentId: 'batch-001',
          correlationId,
        });
        expect.unreachable('Should have thrown network error');
      } catch (err: any) {
        expect(err.message).toContain('Không thể kết nối đến Máy chủ Ký duyệt');
        expect(err.message).toContain('Failed to fetch');
        expect(err.message).toContain('CHƯA XÁC NHẬN chữ ký');
        expect(err.isNetworkError).toBe(true);
        expect(err.correlationId).toBe(correlationId);
      }

      // Zero writes to RTDB
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('PHASE 4: should handle non-JSON / HTML response (e.g. 502 Bad Gateway) gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
          json: async () => {
            throw new Error('Unexpected token < in JSON at position 0');
          },
        })
      );

      const correlationId = 'SIG-CORR-HTML-502';
      await expect(
        service.createElectronicSignature(qaUser, {
          documentType: 'BATCH_RELEASE',
          documentId: 'batch-001',
          correlationId,
        })
      ).rejects.toThrow(/không đúng định dạng JSON/);

      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe('checkBackendHealth', () => {
    it('returns healthy status when backend /health responds with 200 and healthy JSON', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            status: 'healthy',
            service: 'pqm-backend-authority',
            version: '1.0.0',
          }),
        })
      );

      const health = await service.checkBackendHealth();
      expect(health.healthy).toBe(true);
      expect(health.service).toBe('pqm-backend-authority');
      expect(health.version).toBe('1.0.0');
    });

    it('returns unhealthy status when backend returns non-ok status', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({}),
        })
      );

      const health = await service.checkBackendHealth();
      expect(health.healthy).toBe(false);
      expect(health.error).toContain('HTTP 404');
    });

    it('returns cold-start / timeout warning when fetch aborts', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

      const health = await service.checkBackendHealth(100);
      expect(health.healthy).toBe(false);
      expect(health.isColdStart).toBe(true);
      expect(health.error).toContain('Cold Start');
    });
  });

  describe('verifySignatureIntegrity', () => {
    it('should verify genuine signature as valid', async () => {
      const unsigned = {
        documentType: 'BATCH_RELEASE' as const,
        documentId: 'batch-001',
        signerUid: qaUser.uid,
        signerName: qaUser.displayName,
        signerEmail: qaUser.email,
        role: qaUser.role,
        meaning: 'Xác nhận phê duyệt điện tử.',
        signedAt: '2026-10-06T12:00:00Z',
      };
      const checksum = calculateCanonicalSignatureChecksum(unsigned);
      const sig: ElectronicSignature = {
        id: 'sig-gen-01',
        ...unsigned,
        checksum,
        status: 'CREATED',
      };

      const isValid = await service.verifySignatureIntegrity(sig);
      expect(isValid).toBe(true);
    });

    it('should detect tampering if signature content was altered', async () => {
      const unsigned = {
        documentType: 'BATCH_RELEASE' as const,
        documentId: 'batch-001',
        signerUid: qaUser.uid,
        signerName: qaUser.displayName,
        signerEmail: qaUser.email,
        role: qaUser.role,
        meaning: 'Xác nhận phê duyệt điện tử.',
        signedAt: '2026-10-06T12:00:00Z',
      };
      const checksum = calculateCanonicalSignatureChecksum(unsigned);
      const tampered: ElectronicSignature = {
        id: 'sig-gen-01',
        ...unsigned,
        meaning: 'Ý nghĩa giả mạo bị chỉnh sửa trái phép',
        checksum,
        status: 'CREATED',
      };

      const isValid = await service.verifySignatureIntegrity(tampered);
      expect(isValid).toBe(false);
    });
  });
});
