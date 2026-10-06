/**
 * backend/tests/release.test.ts
 * Unit & Integration tests for Server-Authoritative Batch Release API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { setCustomAdminInstances } from '../src/config/firebaseAdmin';
import { createStrictMockDatabase, createMockAuth } from './mockDb';
import { calculateCanonicalSignatureChecksum } from '@pqm/release-engine';

describe('Server-Authoritative Batch Release API (POST /api/batch-release/approve)', () => {
  let mockDb: any;
  let mockAuth: any;

  const validBatchId = 'BATCH-2026-001';
  const qaUid = 'user-qa-1';
  const qaEmail = 'qa@vbiotech.com';

  function setupValidBatchAndSignature() {
    // 1. Setup User
    mockDb._storage[`users/${qaUid}`] = {
      uid: qaUid,
      email: qaEmail,
      displayName: 'QA Lead',
      role: 'QA',
    };

    // 2. Setup Batch
    mockDb._storage[`batches/${validBatchId}`] = {
      id: validBatchId,
      batchNo: 'LOT-2026-001',
      productId: 'PROD-01',
      tccsId: 'TCCS-01',
      status: 'TESTING',
      version: 1,
      bprReviewStatus: 'APPROVED',
      bprReviewedBy: qaUid,
      createdAt: '2026-10-01T00:00:00Z',
    };

    // 3. Setup Test Results (Gate 1 & 2 pass)
    mockDb._storage[`testResults/TR-01`] = {
      id: 'TR-01',
      batchId: validBatchId,
      overallStatus: 'PASS',
      results: [{ criteriaName: 'Định lượng', isPass: true, value: 99 }],
    };

    // 4. Setup Valid Electronic Signature
    const unsignedSig = {
      documentType: 'BATCH_RELEASE' as const,
      documentId: validBatchId,
      signerUid: qaUid,
      signerName: 'QA Lead',
      signerEmail: qaEmail,
      role: 'QA',
      meaning: 'Phê duyệt xuất xưởng Lô',
      signedAt: '2026-10-06T12:00:00Z',
    };
    const checksum = calculateCanonicalSignatureChecksum(unsignedSig);
    const sigId = 'sig_test_valid_01';

    mockDb._storage[`electronic_signatures/${sigId}`] = {
      id: sigId,
      ...unsignedSig,
      checksum,
      status: 'CREATED',
    };

    return { sigId, checksum };
  }

  beforeEach(() => {
    mockDb = createStrictMockDatabase();
    mockAuth = createMockAuth();
    setCustomAdminInstances({ db: mockDb, auth: mockAuth });
  });

  it('should successfully release batch, consume signature, and complete command in atomic commit', async () => {
    const { sigId } = setupValidBatchAndSignature();

    const token = JSON.stringify({
      uid: qaUid,
      email: qaEmail,
      role: 'QA',
      auth_time: Math.floor(Date.now() / 1000) - 20,
    });

    const idempotencyKey = 'IDEMP-TEST-RELEASE-001';

    const res = await request(app)
      .post('/api/batch-release/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchId: validBatchId,
        signatureId: sigId,
        expectedVersion: 1,
        idempotencyKey,
        correlationId: 'REL-20261006-001',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.batchId).toBe(validBatchId);
    expect(res.body.status).toBe('RELEASED');
    expect(res.body.newVersion).toBe(2);
    expect(res.body.commandId).toBe(idempotencyKey);

    // Verify RTDB Batch state
    const updatedBatch = mockDb._storage[`batches/${validBatchId}`];
    expect(updatedBatch.status).toBe('RELEASED');
    expect(updatedBatch.version).toBe(2);
    expect(updatedBatch.releaseSnapshot).toBeDefined();

    // Verify RTDB Signature consumed
    const updatedSig = mockDb._storage[`electronic_signatures/${sigId}`];
    expect(updatedSig.status).toBe('CONSUMED');
    expect(updatedSig.consumedBy).toBe(qaUid);

    // Verify RTDB Release Command completed
    const updatedCmd = mockDb._storage[`release_commands/${idempotencyKey}`];
    expect(updatedCmd.status).toBe('COMPLETED');

    // Verify Audit Log written
    const auditLogs = Object.keys(mockDb._storage).filter((k) => k.startsWith('audit_logs/'));
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle idempotency replay: same idempotencyKey returns cached result without duplicate writes', async () => {
    const { sigId } = setupValidBatchAndSignature();

    const token = JSON.stringify({
      uid: qaUid,
      email: qaEmail,
      role: 'QA',
      auth_time: Math.floor(Date.now() / 1000) - 20,
    });

    const idempotencyKey = 'IDEMP-TEST-REPLAY-001';

    // First Call
    const res1 = await request(app)
      .post('/api/batch-release/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchId: validBatchId,
        signatureId: sigId,
        expectedVersion: 1,
        idempotencyKey,
      });

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.newVersion).toBe(2);

    // Second Call with same idempotencyKey
    const res2 = await request(app)
      .post('/api/batch-release/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchId: validBatchId,
        signatureId: sigId,
        expectedVersion: 1,
        idempotencyKey,
      });

    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
    expect(res2.body.idempotencyReplayed).toBe(true);
    expect(res2.body.newVersion).toBe(2);
  });

  it('should reject stale expectedVersion with 409 VERSION_CONFLICT (OCC)', async () => {
    const { sigId } = setupValidBatchAndSignature();

    const token = JSON.stringify({
      uid: qaUid,
      email: qaEmail,
      role: 'QA',
      auth_time: Math.floor(Date.now() / 1000) - 20,
    });

    const res = await request(app)
      .post('/api/batch-release/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchId: validBatchId,
        signatureId: sigId,
        expectedVersion: 99, // Stale! Current is 1
        idempotencyKey: 'IDEMP-OCC-FAIL-001',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VERSION_CONFLICT');
  });

  it('should reject when signature is already CONSUMED with 400 SIGNATURE_CONSUMED', async () => {
    const { sigId } = setupValidBatchAndSignature();
    // Mark signature as CONSUMED
    mockDb._storage[`electronic_signatures/${sigId}`].status = 'CONSUMED';

    const token = JSON.stringify({
      uid: qaUid,
      email: qaEmail,
      role: 'QA',
      auth_time: Math.floor(Date.now() / 1000) - 20,
    });

    const res = await request(app)
      .post('/api/batch-release/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchId: validBatchId,
        signatureId: sigId,
        expectedVersion: 1,
        idempotencyKey: 'IDEMP-SIG-CONSUMED-001',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SIGNATURE_CONSUMED');
  });

  it('should reject when signature actor does not match caller with 403 PERMISSION_DENIED', async () => {
    const { sigId } = setupValidBatchAndSignature();

    // A different QA user calls the endpoint
    const otherQaUid = 'user-qa-2';
    mockDb._storage[`users/${otherQaUid}`] = {
      uid: otherQaUid,
      email: 'qa2@vbiotech.com',
      role: 'QA',
    };

    const token = JSON.stringify({
      uid: otherQaUid,
      email: 'qa2@vbiotech.com',
      role: 'QA',
      auth_time: Math.floor(Date.now() / 1000) - 20,
    });

    const res = await request(app)
      .post('/api/batch-release/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchId: validBatchId,
        signatureId: sigId,
        expectedVersion: 1,
        idempotencyKey: 'IDEMP-ACTOR-MISMATCH-001',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('should reject when signature checksum is tampered with 400 CHECKSUM_MISMATCH', async () => {
    const { sigId } = setupValidBatchAndSignature();
    // Tamper with checksum
    mockDb._storage[`electronic_signatures/${sigId}`].checksum =
      'deadbeef00000000000000000000000000000000000000000000000000000000';

    const token = JSON.stringify({
      uid: qaUid,
      email: qaEmail,
      role: 'QA',
      auth_time: Math.floor(Date.now() / 1000) - 20,
    });

    const res = await request(app)
      .post('/api/batch-release/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchId: validBatchId,
        signatureId: sigId,
        expectedVersion: 1,
        idempotencyKey: 'IDEMP-TAMPER-001',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CHECKSUM_MISMATCH');
  });

  it('should reject non-QA/ADMIN user with 403 PERMISSION_DENIED', async () => {
    const { sigId } = setupValidBatchAndSignature();

    const qcUid = 'user-qc-1';
    mockDb._storage[`users/${qcUid}`] = {
      uid: qcUid,
      email: 'qc@vbiotech.com',
      role: 'QC',
    };

    const token = JSON.stringify({
      uid: qcUid,
      email: 'qc@vbiotech.com',
      role: 'QC',
      auth_time: Math.floor(Date.now() / 1000) - 20,
    });

    const res = await request(app)
      .post('/api/batch-release/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchId: validBatchId,
        signatureId: sigId,
        expectedVersion: 1,
        idempotencyKey: 'IDEMP-QC-DENY-001',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });
});
