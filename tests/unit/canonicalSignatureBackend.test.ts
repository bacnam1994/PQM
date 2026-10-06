/**
 * tests/unit/canonicalSignatureBackend.test.ts
 *
 * CANONICAL SERVER-SIDE ELECTRONIC SIGNATURE TESTS
 *
 * Specifically verifies:
 * 1. RTDB Sanitization: No `undefined` fields are ever passed to `db.ref().set()`.
 *    If an undefined property exists, real Firebase RTDB throws "set failed: contains undefined".
 * 2. Production scenario with optional fields omitted:
 *    - documentVersion = undefined
 *    - comments = undefined
 *    - QA caller
 *    - Successfully writes signature to electronic_signatures/
 *    - Successfully writes audit log to audit_logs/
 *    - Generates valid NIST SHA-256 canonical checksum matching Release Engine.
 * 3. Release Engine compatibility:
 *    The generated signature passes all signature verification checks during batch release.
 * 4. Error boundaries & RBAC:
 *    - Session freshness (<= 300s)
 *    - Role enforcement (QA/Admin for BATCH_RELEASE)
 *    - Sanitized logging with correlationId
 */

import { describe, it, expect, vi } from 'vitest';
import {
  executeCreateElectronicSignatureBackend,
  removeUndefinedFields,
} from '../../functions/src/signatureFunction';
import {
  verifyCanonicalSignatureChecksum,
  calculateCanonicalSignatureChecksum,
} from '@pqm/release-engine';
import { HttpsError } from 'firebase-functions/v2/https';

describe('Canonical Server-Side Electronic Signature Backend', () => {
  // Helper to simulate strict Realtime Database SDK behavior that rejects undefined
  function createStrictMockDatabase() {
    const storage: Record<string, any> = {};

    function validateNoUndefined(obj: any, path = '') {
      if (obj === undefined) {
        throw new Error(`Firebase RTDB Admin SDK Error: value at ${path} contains undefined`);
      }
      if (obj !== null && typeof obj === 'object') {
        for (const [key, val] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          if (val === undefined) {
            throw new Error(
              `Firebase RTDB Admin SDK Error: value at ${currentPath} contains undefined in property '${key}'`
            );
          }
          validateNoUndefined(val, currentPath);
        }
      }
    }

    const db = {
      _storage: storage,
      ref: (path: string) => ({
        once: vi.fn().mockImplementation(async (event: string) => {
          const val = storage[path] ?? null;
          return {
            exists: () => val !== null,
            val: () => val,
          };
        }),
        set: vi.fn().mockImplementation(async (data: any) => {
          // Strictly validate no undefined properties (mimics RTDB Admin SDK)
          validateNoUndefined(data, path);
          storage[path] = JSON.parse(JSON.stringify(data));
        }),
      }),
    };

    return db;
  }

  describe('removeUndefinedFields utility', () => {
    it('should strip undefined properties recursively', () => {
      const input = {
        name: 'Batch-01',
        version: undefined,
        comments: undefined,
        nested: {
          flag: true,
          extra: undefined,
        },
      };

      const cleaned = removeUndefinedFields(input);

      expect(cleaned).toEqual({
        name: 'Batch-01',
        nested: { flag: true },
      });
      expect('version' in cleaned).toBe(false);
      expect('comments' in cleaned).toBe(false);
      expect('extra' in (cleaned as any).nested).toBe(false);
    });

    it('should preserve null, false, 0, and empty strings', () => {
      const input = {
        zero: 0,
        empty: '',
        falsy: false,
        nullable: null,
        undef: undefined,
      };

      const cleaned = removeUndefinedFields(input);

      expect(cleaned).toEqual({
        zero: 0,
        empty: '',
        falsy: false,
        nullable: null,
      });
      expect('undef' in cleaned).toBe(false);
    });
  });

  describe('Production-Like Signature Creation (documentVersion = undefined, comments = undefined)', () => {
    it('should successfully create electronic signature and write to RTDB without throwing internal errors', async () => {
      const strictDb = createStrictMockDatabase();
      const qaUid = 'u_qa_001';
      const nowSeconds = Math.floor(Date.now() / 1000);

      // Seed user in mock DB
      strictDb._storage[`users/${qaUid}`] = {
        uid: qaUid,
        email: 'qa.lead@v-biotech.com',
        displayName: 'Dược sĩ QA Trưởng',
        role: 'QA',
      };

      const authContext = {
        uid: qaUid,
        token: {
          auth_time: nowSeconds - 30, // 30 seconds ago (fresh session)
          email: 'qa.lead@v-biotech.com',
          role: 'QA',
        },
      };

      // Exact production payload when user leaves comments blank and no version is passed
      const requestData = {
        documentType: 'BATCH_RELEASE' as const,
        documentId: 'batch-prod-777',
        documentVersion: undefined,
        comments: undefined,
        correlationId: 'CORR-TEST-001',
      };

      // Calling executeCreateElectronicSignatureBackend
      const response = await executeCreateElectronicSignatureBackend(
        requestData,
        authContext,
        strictDb as any
      );

      expect(response.success).toBe(true);
      expect(response.signature).toBeDefined();

      const signature = response.signature;
      expect(signature.documentType).toBe('BATCH_RELEASE');
      expect(signature.documentId).toBe('batch-prod-777');
      expect(signature.signerUid).toBe(qaUid);
      expect(signature.signerEmail).toBe('qa.lead@v-biotech.com');
      expect(signature.role).toBe('QA');
      expect(signature.status).toBe('CREATED');
      expect(signature.checksum).toBeDefined();

      // Check that optional undefined properties DO NOT exist as keys
      expect(Object.prototype.hasOwnProperty.call(signature, 'documentVersion')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(signature, 'comments')).toBe(false);

      // Check that the signature in RTDB was actually written and contains no undefined
      const savedSigKey = `electronic_signatures/${signature.id}`;
      expect(strictDb._storage[savedSigKey]).toBeDefined();
      expect(strictDb._storage[savedSigKey].id).toBe(signature.id);
      expect(
        Object.prototype.hasOwnProperty.call(strictDb._storage[savedSigKey], 'documentVersion')
      ).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(strictDb._storage[savedSigKey], 'comments')).toBe(
        false
      );

      // Check that audit_logs was also written without undefined
      const auditEntries = Object.entries(strictDb._storage).filter(([k]) =>
        k.startsWith('audit_logs/')
      );
      expect(auditEntries.length).toBe(1);
      const auditPayload = auditEntries[0][1];
      expect(auditPayload.actorUid).toBe(qaUid);
      expect(auditPayload.correlationId).toBe('CORR-TEST-001');

      // Canonical Checksum verification
      const isValid = verifyCanonicalSignatureChecksum(signature);
      expect(isValid).toBe(true);
    });

    it('should include documentVersion and comments when provided and verify checksum', async () => {
      const strictDb = createStrictMockDatabase();
      const qaUid = 'u_qa_002';
      const nowSeconds = Math.floor(Date.now() / 1000);

      strictDb._storage[`users/${qaUid}`] = {
        uid: qaUid,
        email: 'qa.specialist@v-biotech.com',
        displayName: 'Chuyên viên QA',
        role: 'QA',
      };

      const authContext = {
        uid: qaUid,
        token: {
          auth_time: nowSeconds - 10,
          email: 'qa.specialist@v-biotech.com',
          role: 'QA',
        },
      };

      const requestData = {
        documentType: 'BATCH_RELEASE' as const,
        documentId: 'batch-prod-888',
        documentVersion: 3,
        meaning: 'Phê duyệt xuất xưởng lô thành phẩm.',
        comments: 'Đã kiểm tra đầy đủ 7 release gates và hồ sơ BPR.',
        correlationId: 'CORR-TEST-002',
      };

      const response = await executeCreateElectronicSignatureBackend(
        requestData,
        authContext,
        strictDb as any
      );

      const sig = response.signature;
      expect(sig.documentVersion).toBe(3);
      expect(sig.comments).toBe('Đã kiểm tra đầy đủ 7 release gates và hồ sơ BPR.');
      expect(sig.meaning).toBe('Phê duyệt xuất xưởng lô thành phẩm.');

      const isValid = verifyCanonicalSignatureChecksum(sig);
      expect(isValid).toBe(true);
    });
  });

  describe('Post-Signing Release Gate Flow Compatibility', () => {
    it('should verify that a signature created without optional fields passes Release Engine gates', async () => {
      const strictDb = createStrictMockDatabase();
      const qaUid = 'u_qa_release_lead';
      const nowSeconds = Math.floor(Date.now() / 1000);
      const batchId = 'batch-gmp-2026-99';

      strictDb._storage[`users/${qaUid}`] = {
        uid: qaUid,
        email: 'qa.lead@v-biotech.com',
        role: 'QA',
      };

      const authContext = {
        uid: qaUid,
        token: {
          auth_time: nowSeconds - 5,
          email: 'qa.lead@v-biotech.com',
          role: 'QA',
        },
      };

      // 1. Create signature on backend
      const response = await executeCreateElectronicSignatureBackend(
        {
          documentType: 'BATCH_RELEASE',
          documentId: batchId,
          // Omitting documentVersion & comments completely
        },
        authContext,
        strictDb as any
      );

      const signature = response.signature;

      // 2. Simulate Release Engine checks in releaseFunction.ts
      expect(signature.documentId).toBe(batchId);
      expect(signature.signerUid).toBe(qaUid);
      expect(signature.status).toBe('CREATED');

      const isChecksumValid = verifyCanonicalSignatureChecksum(signature);
      expect(isChecksumValid).toBe(true);

      // Verify that calculateCanonicalSignatureChecksum produces identical result
      const expectedChecksum = calculateCanonicalSignatureChecksum(signature);
      expect(signature.checksum).toBe(expectedChecksum);
    });
  });

  describe('Security Boundaries & RBAC', () => {
    it('should block non-QA caller from signing BATCH_RELEASE', async () => {
      const strictDb = createStrictMockDatabase();
      const labUid = 'u_lab_analyst';
      const nowSeconds = Math.floor(Date.now() / 1000);

      strictDb._storage[`users/${labUid}`] = {
        uid: labUid,
        role: 'LAB',
      };

      const authContext = {
        uid: labUid,
        token: {
          auth_time: nowSeconds - 10,
          role: 'LAB',
        },
      };

      await expect(
        executeCreateElectronicSignatureBackend(
          {
            documentType: 'BATCH_RELEASE',
            documentId: 'batch-001',
          },
          authContext,
          strictDb as any
        )
      ).rejects.toThrow(HttpsError);
    });

    it('should reject stale session (> 300s)', async () => {
      const strictDb = createStrictMockDatabase();
      const qaUid = 'u_qa_stale';
      const nowSeconds = Math.floor(Date.now() / 1000);

      const authContext = {
        uid: qaUid,
        token: {
          auth_time: nowSeconds - 301, // 301 seconds ago -> stale
          role: 'QA',
        },
      };

      await expect(
        executeCreateElectronicSignatureBackend(
          {
            documentType: 'BATCH_RELEASE',
            documentId: 'batch-001',
          },
          authContext,
          strictDb as any
        )
      ).rejects.toThrow(/Phiên xác thực đã hết hạn/);
    });

    it('should reject empty documentId', async () => {
      const strictDb = createStrictMockDatabase();
      const qaUid = 'u_qa_001';
      const nowSeconds = Math.floor(Date.now() / 1000);

      const authContext = {
        uid: qaUid,
        token: {
          auth_time: nowSeconds - 10,
          role: 'QA',
        },
      };

      await expect(
        executeCreateElectronicSignatureBackend(
          {
            documentType: 'BATCH_RELEASE',
            documentId: '   ',
          },
          authContext,
          strictDb as any
        )
      ).rejects.toThrow(/Mã tài liệu/);
    });
  });
});
