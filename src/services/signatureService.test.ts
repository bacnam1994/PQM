import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignatureService, computeSignatureChecksum } from './signatureService';
import { ElectronicSignature } from '../types/signature';

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  get: vi.fn().mockResolvedValue({ exists: () => false, val: () => ({}) }),
  set: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn().mockReturnValue({ currentUser: null }),
  EmailAuthProvider: { credential: vi.fn() },
  reauthenticateWithCredential: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./auditService', () => ({
  logAuditAction: vi.fn(),
}));

describe('SignatureService - FDA 21 CFR Part 11', () => {
  let service: SignatureService;

  const qaUser = { uid: 'u_qa', email: 'qa@pqm.com', role: 'QA', displayName: 'Dược sĩ QA' };
  const labUser = { uid: 'u_lab', email: 'lab@pqm.com', role: 'LAB', displayName: 'Kiểm nghiệm viên' };
  const adminUser = { uid: 'u_admin', email: 'admin@pqm.com', role: 'ADMIN', isAdmin: true };

  beforeEach(() => {
    service = new SignatureService();
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

    it('should allow QA to successfully sign BATCH_RELEASE', async () => {
      const sig = await service.createElectronicSignature(qaUser, {
        documentType: 'BATCH_RELEASE',
        documentId: 'batch-001',
        documentVersion: 1,
      });

      expect(sig).toBeDefined();
      expect(sig.id).toMatch(/^sig_/);
      expect(sig.signerEmail).toBe('qa@pqm.com');
      expect(sig.role).toBe('QA');
      expect(sig.meaning).toContain('phê duyệt xuất xưởng');
      expect(sig.checksum).toBeDefined();
    });

    it('should allow ADMIN to sign COA_ISSUE', async () => {
      const sig = await service.createElectronicSignature(adminUser, {
        documentType: 'COA_ISSUE',
        documentId: 'coa-batch-001',
      });

      expect(sig.documentType).toBe('COA_ISSUE');
      expect(sig.signerEmail).toBe('admin@pqm.com');
    });
  });

  describe('verifySignatureIntegrity', () => {
    it('should verify genuine signature as valid', async () => {
      const sig = await service.createElectronicSignature(qaUser, {
        documentType: 'BATCH_RELEASE',
        documentId: 'batch-001',
      });

      const isValid = await service.verifySignatureIntegrity(sig);
      expect(isValid).toBe(true);
    });

    it('should detect tampering if signature content was altered', async () => {
      const sig = await service.createElectronicSignature(qaUser, {
        documentType: 'BATCH_RELEASE',
        documentId: 'batch-001',
      });

      // Tamper with meaning or signer
      const tampered: ElectronicSignature = {
        ...sig,
        meaning: 'Ý nghĩa giả mạo bị chỉnh sửa trái phép',
      };

      const isValid = await service.verifySignatureIntegrity(tampered);
      expect(isValid).toBe(false);
    });
  });
});
