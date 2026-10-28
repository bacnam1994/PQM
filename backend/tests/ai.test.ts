/**
 * backend/tests/ai.test.ts
 * Unit & Integration tests for Server-Authoritative AI Intelligence Suite (Phases 1-14, 18, 19)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { setCustomAdminInstances } from '../src/config/firebaseAdmin';
import { createStrictMockDatabase, createMockAuth } from './mockDb';
import { setCustomModelCaller } from '../src/ai/aiService';
import { AIRateLimiter } from '../src/ai/aiRateLimit';

describe('Server-Authoritative AI Intelligence API (POST /api/ai/analyze)', () => {
  let mockDb: any;
  let mockAuth: any;

  beforeEach(() => {
    mockDb = createStrictMockDatabase();
    mockAuth = createMockAuth();
    setCustomAdminInstances({ db: mockDb, auth: mockAuth });
    AIRateLimiter.reset();

    // Default mock batch and test result in RTDB
    mockDb._storage['batches/BATCH-001'] = {
      id: 'BATCH-001',
      batchNo: 'LOT-2026-001',
      productId: 'PROD-01',
      tccsId: 'TCCS-01',
      status: 'TESTING',
    };

    mockDb._storage['testResults/TR-101'] = {
      id: 'TR-101',
      reportNumber: 'COA-2026-101',
      batchId: 'BATCH-001',
      tccsId: 'TCCS-01',
      overallStatus: 'PASSED',
    };

    mockDb._storage['tccsList/TCCS-01'] = {
      id: 'TCCS-01',
      code: 'TCCS-PROD-01-V1',
    };

    // User accounts
    mockDb._storage['users/user-qa-1'] = {
      uid: 'user-qa-1',
      email: 'qa@vbiotech.com',
      role: 'QA',
    };

    mockDb._storage['users/user-qc-1'] = {
      uid: 'user-qc-1',
      email: 'qc@vbiotech.com',
      role: 'QC',
    };

    mockDb._storage['users/user-admin-1'] = {
      uid: 'user-admin-1',
      email: 'admin@vbiotech.com',
      role: 'ADMIN',
    };
    mockDb._storage['users/admins/user-admin-1'] = true;
  });

  afterEach(() => {
    setCustomModelCaller(null);
  });

  // 1. Health check & configuration exposure
  describe('GET /api/ai/health', () => {
    it('returns service status and capabilities without leaking API secrets', async () => {
      const res = await request(app).get('/api/ai/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.service).toBe('pqm-ai-backend');
      expect(res.body.data.supportedTypes).toContain('batch_analysis');
      expect(res.body.data.apiKey).toBeUndefined();
    });
  });

  // 2. Authentication tests (Phase 2 & 19)
  describe('Authentication & Token Verification', () => {
    it('rejects unauthenticated requests with 401 UNAUTHENTICATED', async () => {
      const res = await request(app)
        .post('/api/ai/analyze')
        .send({ type: 'batch_analysis', batchId: 'BATCH-001' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects invalid token with 401 UNAUTHENTICATED', async () => {
      const res = await request(app)
        .post('/api/ai/analyze')
        .set('Authorization', 'Bearer invalid-token')
        .send({ type: 'batch_analysis', batchId: 'BATCH-001' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  // 3. RBAC Enforcement tests (Phase 3 & 19)
  describe('AI RBAC Authorization', () => {
    it('denies QC role for batch_analysis with 403 AI_PERMISSION_DENIED', async () => {
      const token = JSON.stringify({
        uid: 'user-qc-1',
        email: 'qc@vbiotech.com',
        auth_time: Math.floor(Date.now() / 1000),
      });

      const res = await request(app)
        .post('/api/ai/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'batch_analysis', batchId: 'BATCH-001' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AI_PERMISSION_DENIED');
    });

    it('allows QA role for batch_analysis with 200 OK', async () => {
      const token = JSON.stringify({
        uid: 'user-qa-1',
        email: 'qa@vbiotech.com',
        auth_time: Math.floor(Date.now() / 1000),
      });

      // Mock AI response
      setCustomModelCaller(async () => {
        return JSON.stringify({
          summary: 'Hồ sơ lô BATCH-001 đạt yêu cầu kiểm nghiệm sơ bộ.',
          riskLevel: 'LOW',
          findings: [
            {
              title: 'Kết quả kiểm nghiệm phù hợp',
              description: 'Chỉ tiêu đạt tiêu chuẩn TCCS-01',
              evidence: [
                {
                  sourceType: 'TEST_RESULT',
                  sourceId: 'TR-101',
                  quoteOrMetric: 'PASSED',
                },
              ],
            },
          ],
          recommendations: ['Tiếp tục theo dõi hồ sơ thẩm định'],
          limitations: ['Kết quả chỉ mang tính hỗ trợ ra quyết định cho QA.'],
        });
      });

      const res = await request(app)
        .post('/api/ai/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'batch_analysis', batchId: 'BATCH-001' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.riskLevel).toBe('LOW');
      expect(res.body.data.findings[0].evidence[0].sourceId).toBe('TR-101');
    });

    it('allows QC role for test_result_analysis with 200 OK', async () => {
      const token = JSON.stringify({
        uid: 'user-qc-1',
        email: 'qc@vbiotech.com',
        auth_time: Math.floor(Date.now() / 1000),
      });

      setCustomModelCaller(async () => {
        return JSON.stringify({
          summary: 'Phiếu kiểm nghiệm TR-101 đạt tiêu chuẩn.',
          riskLevel: 'LOW',
          findings: [],
          recommendations: [],
          limitations: [],
        });
      });

      const res = await request(app)
        .post('/api/ai/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'test_result_analysis', testResultId: 'TR-101' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // 4. Hallucination Guard & Evidence Verification (Phase 8, 9, 11)
  describe('Hallucination Guard & Evidence Verification', () => {
    it('discards hallucinated record IDs not present in the context', async () => {
      const token = JSON.stringify({
        uid: 'user-qa-1',
        email: 'qa@vbiotech.com',
        auth_time: Math.floor(Date.now() / 1000),
      });

      // Model hallucinates TR-999 and DEV-FAKE-01
      setCustomModelCaller(async () => {
        return JSON.stringify({
          summary: 'Phát hiện sai lệch bất thường.',
          riskLevel: 'HIGH',
          findings: [
            {
              title: 'Chỉ tiêu vi phạm',
              description: 'Sai lệch nặng',
              evidence: [
                {
                  sourceType: 'TEST_RESULT',
                  sourceId: 'TR-FAKE-999',
                  quoteOrMetric: 'Failed',
                },
                {
                  sourceType: 'TEST_RESULT',
                  sourceId: 'TR-101', // Real valid ID
                  quoteOrMetric: 'Passed',
                },
              ],
            },
          ],
          recommendations: ['Cần tái kiểm'],
          limitations: [],
        });
      });

      const res = await request(app)
        .post('/api/ai/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'batch_analysis', batchId: 'BATCH-001' });

      expect(res.status).toBe(200);
      const finding = res.body.data.findings[0];
      // Only TR-101 must remain; TR-FAKE-999 discarded!
      expect(finding.evidence).toHaveLength(1);
      expect(finding.evidence[0].sourceId).toBe('TR-101');
    });

    it('rejects malformed non-JSON responses with 502 AI_INVALID_RESPONSE', async () => {
      const token = JSON.stringify({
        uid: 'user-qa-1',
        email: 'qa@vbiotech.com',
        auth_time: Math.floor(Date.now() / 1000),
      });

      setCustomModelCaller(async () => {
        return 'Xin chào, tôi là AI và tôi nghĩ lô này bình thường.'; // Free text, not JSON
      });

      const res = await request(app)
        .post('/api/ai/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'batch_analysis', batchId: 'BATCH-001' });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AI_INVALID_RESPONSE');
    });

    it('automatically ensures mandatory QA/QC advisory limitation is present', async () => {
      const token = JSON.stringify({
        uid: 'user-qa-1',
        email: 'qa@vbiotech.com',
        auth_time: Math.floor(Date.now() / 1000),
      });

      setCustomModelCaller(async () => {
        return JSON.stringify({
          summary: 'Phân tích nhanh.',
          riskLevel: 'LOW',
          findings: [],
          recommendations: [],
          limitations: [], // Empty limitations provided by model
        });
      });

      const res = await request(app)
        .post('/api/ai/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'batch_analysis', batchId: 'BATCH-001' });

      expect(res.status).toBe(200);
      expect(res.body.data.limitations.length).toBeGreaterThan(0);
      expect(res.body.data.limitations[0]).toContain('không thay thế');
    });
  });

  // 5. Business Safety Tests (Phase 10 & 19)
  describe('Business Authority & Immutability', () => {
    it('guarantees that AI analysis NEVER modifies batch status or writes any business record', async () => {
      const token = JSON.stringify({
        uid: 'user-qa-1',
        email: 'qa@vbiotech.com',
        auth_time: Math.floor(Date.now() / 1000),
      });

      const initialBatch = JSON.parse(JSON.stringify(mockDb._storage['batches/BATCH-001']));

      setCustomModelCaller(async () => {
        return JSON.stringify({
          summary: 'Khuyến nghị: Lô nên được xuất xưởng ngay lập tức.',
          riskLevel: 'LOW',
          findings: [],
          recommendations: ['Xuất xưởng lô'],
          limitations: [],
        });
      });

      const res = await request(app)
        .post('/api/ai/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'batch_analysis', batchId: 'BATCH-001' });

      expect(res.status).toBe(200);

      // Verify batch in RTDB is 100% unchanged!
      const currentBatch = mockDb._storage['batches/BATCH-001'];
      expect(currentBatch.status).toBe('TESTING');
      expect(currentBatch).toEqual(initialBatch);
    });
  });

  // 6. Audit Trail Logging (Phase 12)
  describe('AI Audit Trail Logging', () => {
    it('records an ALCOA+ audit log in RTDB under ai_audit_logs/', async () => {
      const token = JSON.stringify({
        uid: 'user-qa-1',
        email: 'qa@vbiotech.com',
        auth_time: Math.floor(Date.now() / 1000),
      });

      setCustomModelCaller(async () => {
        return JSON.stringify({
          summary: 'Phân tích audit log.',
          riskLevel: 'MEDIUM',
          findings: [],
          recommendations: [],
          limitations: [],
        });
      });

      const res = await request(app)
        .post('/api/ai/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'batch_analysis', batchId: 'BATCH-001' });

      expect(res.status).toBe(200);
      const metadata = res.body.metadata;
      expect(metadata.aiAnalysisId).toBeDefined();
      expect(metadata.uid).toBe('user-qa-1');
      expect(metadata.contextHash).toBeDefined();
      expect(metadata.promptVersion).toBe('BATCH_ANALYSIS_V1');

      // Verify written to mockDb
      const auditLog = mockDb._storage[`ai_audit_logs/${metadata.aiAnalysisId}`];
      expect(auditLog).toBeDefined();
      expect(auditLog.aiAnalysisId).toBe(metadata.aiAnalysisId);
      expect(auditLog.riskLevel).toBe('MEDIUM');
      expect(auditLog.uid).toBe('user-qa-1');
    });
  });

  // 7. Rate Limiting (Phase 13)
  describe('Rate Limiting', () => {
    it('blocks excessive requests with 429 AI_RATE_LIMITED', async () => {
      const token = JSON.stringify({
        uid: 'user-qa-1',
        email: 'qa@vbiotech.com',
        auth_time: Math.floor(Date.now() / 1000),
      });

      setCustomModelCaller(async () => {
        return JSON.stringify({
          summary: 'OK',
          riskLevel: 'LOW',
          findings: [],
          recommendations: [],
          limitations: [],
        });
      });

      // Fire 20 requests (within quota)
      for (let i = 0; i < 20; i++) {
        AIRateLimiter.checkRateLimit('user-qa-1');
      }

      // The 21st request must trigger 429
      const res = await request(app)
        .post('/api/ai/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'batch_analysis', batchId: 'BATCH-001' });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AI_RATE_LIMITED');
    });
  });
});
