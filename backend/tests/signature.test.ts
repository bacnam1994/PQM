/**
 * backend/tests/signature.test.ts
 * Unit & Integration tests for Server-Authoritative Electronic Signature API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { setCustomAdminInstances } from '../src/config/firebaseAdmin';
import { createStrictMockDatabase, createMockAuth } from './mockDb';
import { verifyCanonicalSignatureChecksum } from '@pqm/release-engine';

describe('Server-Authoritative Electronic Signature API (POST /api/signatures)', () => {
  let mockDb: any;
  let mockAuth: any;

  beforeEach(() => {
    mockDb = createStrictMockDatabase();
    mockAuth = createMockAuth();
    setCustomAdminInstances({ db: mockDb, auth: mockAuth });
  });

  it('should reject requests missing Authorization header with 401 UNAUTHENTICATED', async () => {
    const res = await request(app).post('/api/signatures').send({
      documentType: 'BATCH_RELEASE',
      documentId: 'batch-101',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('should reject invalid or expired tokens with 401 UNAUTHENTICATED', async () => {
    const res = await request(app)
      .post('/api/signatures')
      .set('Authorization', 'Bearer invalid-token')
      .send({
        documentType: 'BATCH_RELEASE',
        documentId: 'batch-101',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('should reject signatures when auth_time > 300 seconds with 401 AUTH_REQUIRED', async () => {
    const staleAuthTime = Math.floor(Date.now() / 1000) - 360; // 6 minutes ago
    const token = JSON.stringify({
      uid: 'user-qa-1',
      email: 'qa@vbiotech.com',
      auth_time: staleAuthTime,
      role: 'QA',
    });

    mockDb._storage['users/user-qa-1'] = {
      uid: 'user-qa-1',
      email: 'qa@vbiotech.com',
      role: 'QA',
    };

    const res = await request(app)
      .post('/api/signatures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        documentType: 'BATCH_RELEASE',
        documentId: 'batch-101',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
    expect(res.body.error.message).toContain('Phiên xác thực đã hết hạn');
  });

  it('should allow QA users to sign BATCH_RELEASE when session is fresh', async () => {
    const freshAuthTime = Math.floor(Date.now() / 1000) - 30; // 30 seconds ago
    const token = JSON.stringify({
      uid: 'user-qa-1',
      email: 'qa@vbiotech.com',
      displayName: 'QA Pharmacist',
      auth_time: freshAuthTime,
      role: 'QA',
    });

    mockDb._storage['users/user-qa-1'] = {
      uid: 'user-qa-1',
      email: 'qa@vbiotech.com',
      displayName: 'QA Pharmacist',
      role: 'QA',
    };

    const res = await request(app)
      .post('/api/signatures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        documentType: 'BATCH_RELEASE',
        documentId: 'batch-101',
        meaning: 'Phê duyệt xuất xưởng lô thuốc đạt chuẩn GMP',
        correlationId: 'SIG-20261006-test001',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.signature).toBeDefined();
    expect(res.body.signature.id).toMatch(/^sig_/);
    expect(res.body.signature.signerUid).toBe('user-qa-1');
    expect(res.body.signature.signerEmail).toBe('qa@vbiotech.com');
    expect(res.body.signature.status).toBe('CREATED');
    expect(res.body.signature.checksum).toHaveLength(64);

    // Verify stored in RTDB
    const storedSig = mockDb._storage[`electronic_signatures/${res.body.signature.id}`];
    expect(storedSig).toBeDefined();
    expect(storedSig.checksum).toBe(res.body.signature.checksum);

    // Verify audit log created
    const auditKeys = Object.keys(mockDb._storage).filter((k) => k.startsWith('audit_logs/'));
    expect(auditKeys.length).toBeGreaterThanOrEqual(1);

    // Verify cryptographic integrity
    const isValid = verifyCanonicalSignatureChecksum(res.body.signature);
    expect(isValid).toBe(true);
  });

  it('should allow ADMIN users to sign BATCH_RELEASE', async () => {
    const freshAuthTime = Math.floor(Date.now() / 1000) - 10;
    const token = JSON.stringify({
      uid: 'user-admin-1',
      email: 'admin@vbiotech.com',
      auth_time: freshAuthTime,
      isAdmin: true,
    });

    mockDb._storage['users/user-admin-1'] = {
      uid: 'user-admin-1',
      email: 'admin@vbiotech.com',
      role: 'ADMIN',
    };
    mockDb._storage['users/admins/user-admin-1'] = true;

    const res = await request(app)
      .post('/api/signatures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        documentType: 'BATCH_RELEASE',
        documentId: 'batch-202',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.signature.role).toBe('ADMIN');
  });

  it('should deny QC users for BATCH_RELEASE with 403 PERMISSION_DENIED', async () => {
    const freshAuthTime = Math.floor(Date.now() / 1000) - 10;
    const token = JSON.stringify({
      uid: 'user-qc-1',
      email: 'qc@vbiotech.com',
      auth_time: freshAuthTime,
      role: 'QC',
    });

    mockDb._storage['users/user-qc-1'] = {
      uid: 'user-qc-1',
      email: 'qc@vbiotech.com',
      role: 'QC',
    };

    const res = await request(app)
      .post('/api/signatures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        documentType: 'BATCH_RELEASE',
        documentId: 'batch-303',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('should strip undefined properties and never crash RTDB set()', async () => {
    const freshAuthTime = Math.floor(Date.now() / 1000) - 20;
    const token = JSON.stringify({
      uid: 'user-qa-2',
      email: 'qa2@vbiotech.com',
      auth_time: freshAuthTime,
      role: 'QA',
    });

    mockDb._storage['users/user-qa-2'] = {
      uid: 'user-qa-2',
      email: 'qa2@vbiotech.com',
      role: 'QA',
    };

    // Body with undefined / missing optional fields
    const res = await request(app)
      .post('/api/signatures')
      .set('Authorization', `Bearer ${token}`)
      .send({
        documentType: 'BATCH_RELEASE',
        documentId: 'batch-404',
        documentVersion: undefined,
        comments: undefined,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect('documentVersion' in res.body.signature).toBe(false);
    expect('comments' in res.body.signature).toBe(false);
  });
});
