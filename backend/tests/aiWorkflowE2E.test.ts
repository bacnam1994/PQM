/**
 * backend/tests/aiWorkflowE2E.test.ts
 * End-to-End Test for Server-Authoritative AI Intelligence Suite (Phase 20)
 *
 * Verifies complete flow:
 * Login -> Open Batch -> Request AI -> Firebase Token Verification -> Context Building ->
 * Gemini Mock -> Hallucination Guard -> Audit Trail -> Presentation -> Business Immutability.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { setCustomAdminInstances } from '../src/config/firebaseAdmin';
import { createStrictMockDatabase, createMockAuth } from './mockDb';
import { setCustomModelCaller } from '../src/ai/aiService';
import { AIRateLimiter } from '../src/ai/aiRateLimit';

describe('Phase 20: End-to-End AI Flow (Decision Support & Zero Business Mutation)', () => {
  let mockDb: any;
  let mockAuth: any;

  beforeEach(() => {
    mockDb = createStrictMockDatabase();
    mockAuth = createMockAuth();
    setCustomAdminInstances({ db: mockDb, auth: mockAuth });
    AIRateLimiter.reset();

    // 1. Seed production-like Batch record
    mockDb._storage['batches/BATCH-VBIOTECH-001'] = {
      id: 'BATCH-VBIOTECH-001',
      batchNo: 'LOT-2026-PARACETAMOL-01',
      productId: 'PROD-PARA-500',
      tccsId: 'TCCS-PARA-500',
      status: 'TESTING',
      version: 1,
      createdAt: '2026-10-01T08:00:00Z',
    };

    // 2. Seed Test Result
    mockDb._storage['testResults/TR-PARA-001'] = {
      id: 'TR-PARA-001',
      reportNumber: 'COA-2026-PARA-01',
      batchId: 'BATCH-VBIOTECH-001',
      tccsId: 'TCCS-PARA-500',
      overallStatus: 'PASSED',
      evaluatedAt: '2026-10-02T10:00:00Z',
    };

    // 3. Seed TCCS
    mockDb._storage['tccsList/TCCS-PARA-500'] = {
      id: 'TCCS-PARA-500',
      code: 'TCCS-PARA-500-V1',
      productName: 'Paracetamol 500mg',
    };

    // 4. Seed User Profiles in RTDB
    mockDb._storage['users/user-qa-lead'] = {
      uid: 'user-qa-lead',
      email: 'qa.lead@vbiotech.com',
      role: 'QA',
      displayName: 'Dược sĩ QA Trưởng',
    };

    mockDb._storage['users/user-qc-analyst'] = {
      uid: 'user-qc-analyst',
      email: 'qc.analyst@vbiotech.com',
      role: 'QC',
      displayName: 'Kỹ thuật viên QC',
    };
  });

  afterEach(() => {
    setCustomModelCaller(null);
  });

  it('thực thi trọn vẹn E2E luồng phân tích Lô sản xuất với Firebase ID Token, Hallucination Guard và Audit Log', async () => {
    // Bước 1: QA Đăng nhập và lấy Firebase ID Token
    const qaToken = JSON.stringify({
      uid: 'user-qa-lead',
      email: 'qa.lead@vbiotech.com',
      auth_time: Math.floor(Date.now() / 1000) - 20,
    });

    // Bước 2: Thiết lập phản hồi giả lập từ Gemini (Mô hình trả về cả bằng chứng thật và 1 ID bịa đặt)
    setCustomModelCaller(async (systemPrompt, userPrompt) => {
      expect(systemPrompt).toContain('NO WRITE AUTHORITY');
      expect(userPrompt).toContain('LOT-2026-PARACETAMOL-01');

      return JSON.stringify({
        summary: 'Hồ sơ lô BATCH-VBIOTECH-001 đạt yêu cầu kiểm nghiệm thành phẩm sơ bộ.',
        riskLevel: 'LOW',
        findings: [
          {
            title: 'Chỉ tiêu hóa lý và định lượng đạt',
            description:
              'Các chỉ tiêu kiểm nghiệm trên phiếu TR-PARA-001 đạt tiêu chuẩn TCCS-PARA-500.',
            evidence: [
              {
                sourceType: 'TEST_RESULT',
                sourceId: 'TR-PARA-001', // Real valid ID
                quoteOrMetric: 'PASSED',
              },
              {
                sourceType: 'TEST_RESULT',
                sourceId: 'TR-FABRICATED-999', // Hallucinated ID
                quoteOrMetric: 'INVALID_DATA',
              },
            ],
          },
        ],
        recommendations: [
          'Tiến hành đối chiếu hồ sơ lô sản xuất (BPR) trước khi QA ra quyết định xuất xưởng.',
        ],
        limitations: ['Phân tích chỉ mang tính chất tham vấn kỹ thuật cho QA.'],
      });
    });

    // Bước 3: Gửi yêu cầu phân tích Lô lên External AI Backend
    const response = await request(app)
      .post('/api/ai/analyze')
      .set('Authorization', `Bearer ${qaToken}`)
      .send({
        type: 'batch_analysis',
        batchId: 'BATCH-VBIOTECH-001',
      });

    // Bước 4: Kiểm tra kết quả trả về từ Backend
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const data = response.body.data;
    const metadata = response.body.metadata;

    // Xác thực cấu trúc dữ liệu
    expect(data.summary).toContain('BATCH-VBIOTECH-001');
    expect(data.riskLevel).toBe('LOW');

    // Xác thực Hallucination Guard: ID 'TR-FABRICATED-999' bị loại bỏ, chỉ còn 'TR-PARA-001'
    expect(data.findings[0].evidence).toHaveLength(1);
    expect(data.findings[0].evidence[0].sourceId).toBe('TR-PARA-001');

    // Xác thực Limitations bắt buộc được tự động đảm bảo
    expect(data.limitations.length).toBeGreaterThan(0);
    expect(data.limitations[0]).toContain('không thay thế');

    // Bước 5: Kiểm tra Audit Trail metadata
    expect(metadata.aiAnalysisId).toMatch(/^AI-ANL-/);
    expect(metadata.uid).toBe('user-qa-lead');
    expect(metadata.analysisType).toBe('batch_analysis');
    expect(metadata.contextHash).toHaveLength(64); // SHA-256 hex string

    // Kiểm tra vết kiểm toán ALCOA+ đã được ghi xuống RTDB
    const auditRecord = mockDb._storage[`ai_audit_logs/${metadata.aiAnalysisId}`];
    expect(auditRecord).toBeDefined();
    expect(auditRecord.aiAnalysisId).toBe(metadata.aiAnalysisId);
    expect(auditRecord.riskLevel).toBe('LOW');

    // Bước 6: QUY TẮC BẤT BIẾN NGHIỆP VỤ (Phase 10 & 20)
    // Đảm bảo AI KHÔNG BAO GIỜ tự ý đổi trạng thái Lô sang RELEASED!
    const batchInDb = mockDb._storage['batches/BATCH-VBIOTECH-001'];
    expect(batchInDb.status).toBe('TESTING'); // Trạng thái vẫn nguyên vẹn là TESTING
    expect(batchInDb.version).toBe(1); // Không có mutation hay tăng version
  });

  it('chặn người dùng QC không có thẩm quyền phân tích Lô với mã lỗi 403 AI_PERMISSION_DENIED', async () => {
    const qcToken = JSON.stringify({
      uid: 'user-qc-analyst',
      email: 'qc.analyst@vbiotech.com',
      auth_time: Math.floor(Date.now() / 1000) - 10,
    });

    const response = await request(app)
      .post('/api/ai/analyze')
      .set('Authorization', `Bearer ${qcToken}`)
      .send({
        type: 'batch_analysis',
        batchId: 'BATCH-VBIOTECH-001',
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('AI_PERMISSION_DENIED');
  });
});
