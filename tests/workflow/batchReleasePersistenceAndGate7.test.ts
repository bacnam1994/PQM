/**
 * batchReleasePersistenceAndGate7.test.ts
 * =======================================
 * Kiểm thử toàn diện 2 lớp vấn đề:
 * 1. Batch.status ↔ 7 Gate Progress (chống race condition / stale write)
 * 2. Signature đã ký ↔ Gate 7 evaluation (chống mất chữ ký sau reload / background sync)
 *
 * Đảm bảo trạng thái cuối cùng tuyệt đối:
 * - Status: RELEASED
 * - Release Progress: 7/7 (100%)
 * - Gate 1..6: ✓
 * - Gate 7: ✓ PASS
 * - Signature: ĐÃ KÝ
 * - Không còn ERR_SIGNATURE_MISSING sau reload hoặc background synchronization.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BatchReleaseDecisionService } from '../../src/domain/batch/BatchReleaseDecisionService';
import { BatchReleaseProgressService } from '../../src/domain/batch/BatchReleaseProgressService';
import { BatchReleaseWorkflowSynchronizer } from '../../src/domain/batch/BatchReleaseWorkflowSynchronizer';
import { Batch, TestResult, ElectronicSignature } from '../../src/types';
import { calculateSha256Sync } from '../../src/utils/cryptoUtils';

describe('Batch Release Persistence & Gate 7 Evaluation Test Suite', () => {
  let mockBatch: Batch;
  let mockTestResults: TestResult[];
  let validReleaseSignature: ElectronicSignature;

  beforeEach(() => {
    const now = new Date().toISOString();
    const batchId = 'batch_persist_001';

    mockBatch = {
      id: batchId,
      productId: 'prod_001',
      batchNo: 'LOT-2026-PERSIST-01',
      mfgDate: '2026-01-01',
      expDate: '2027-01-01',
      status: 'TESTING',
      version: 1,
      createdAt: now,
      bprReviewStatus: 'APPROVED',
      bprReviewedBy: 'qa_reviewer@company.com',
      bprReviewedAt: now,
      theoreticalYield: 1000,
      actualYield: 980,
      yieldUnit: 'Hộp',
    } as Batch;

    mockTestResults = [
      {
        id: 'tr_001',
        batchId,
        batchNo: 'LOT-2026-PERSIST-01',
        name: 'Định lượng hoạt chất',
        value: 100,
        unit: '%',
        minVal: 95,
        maxVal: 105,
        status: 'PASSED',
        approvalStatus: 'APPROVED',
        isComplete: true,
        testedAt: now,
      },
    ] as any[];

    // Sinh chữ ký điện tử hợp lệ 21 CFR Part 11
    const sigPayload = [
      'BATCH_RELEASE',
      batchId,
      1,
      'uid_qa_001',
      'qa_manager@company.com',
      'QA',
      'Tôi xác nhận lô sản xuất đạt chuẩn GMP và phê duyệt xuất xưởng.',
      now,
    ].join('|');
    const checksum = calculateSha256Sync(sigPayload);

    validReleaseSignature = {
      signatureId: 'sig_rel_001',
      documentType: 'BATCH_RELEASE',
      documentId: batchId,
      documentVersion: 1,
      signerUid: 'uid_qa_001',
      signerEmail: 'qa_manager@company.com',
      signerName: 'Trưởng phòng QA',
      role: 'QA',
      meaning: 'Tôi xác nhận lô sản xuất đạt chuẩn GMP và phê duyệt xuất xưởng.',
      signedAt: now,
      checksum,
    };
  });

  describe('Lớp 2: Signature đã ký ↔ Gate 7 evaluation (Persistence & Reload)', () => {
    it('Lô đã ký và RELEASED: reload trang với userSignature = undefined vẫn phải PASS Gate 7 và 7/7 gates', () => {
      // Giả lập Lô đã được xuất xưởng thành công và lưu chữ ký trên DB
      const releasedBatch: Batch = {
        ...mockBatch,
        status: 'RELEASED',
        version: 2, // version đã tăng sau khi release
        releasedAt: new Date().toISOString(),
        releasedBy: 'qa_manager@company.com',
        releaseStage: 'RELEASED',
        releaseGateProgress: {
          completed: 7,
          total: 7,
          currentGate: 8,
          percentage: 100,
          evaluatedAt: new Date().toISOString(),
        },
        releaseSignatures: [validReleaseSignature],
      };

      // Đánh giá quyết định xuất xưởng khi reload (userSignature = undefined)
      const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch: releasedBatch,
        testResults: mockTestResults,
        userRole: 'QA',
        userSignature: undefined, // người dùng reload trang, không truyền lại chữ ký
      });

      expect(decision.eligible).toBe(true);
      expect(decision.blockers).toHaveLength(0);
      expect(decision.blockers.some((b) => b.includes('ERR_SIGNATURE_MISSING'))).toBe(false);

      const gate7 = decision.gates.find((g) => g.gateIndex === 7);
      expect(gate7).toBeDefined();
      expect(gate7!.passed).toBe(true);
      expect(gate7!.status).toBe('PASS');
      expect(gate7!.blockers).toHaveLength(0);
      expect(gate7!.details).toContain('Đã ký số phê duyệt xuất xưởng');
    });

    it('Lô đã RELEASED có batch.version = 2 (tăng sau release), chữ ký ký ở version 1: KHÔNG bị lỗi ERR_SIGNATURE_VERSION_MISMATCH', () => {
      const releasedBatch: Batch = {
        ...mockBatch,
        status: 'RELEASED',
        version: 3, // Version tăng do nhiều thao tác
        releaseSignatures: [validReleaseSignature], // chữ ký ký ở version 1
      };

      const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch: releasedBatch,
        testResults: mockTestResults,
        userRole: 'QA',
        userSignature: undefined,
      });

      expect(decision.blockers.some((b) => b.includes('ERR_SIGNATURE_VERSION_MISMATCH'))).toBe(
        false
      );
      const gate7 = decision.gates.find((g) => g.gateIndex === 7);
      expect(gate7!.passed).toBe(true);
      expect(gate7!.status).toBe('PASS');
    });

    it('Người dùng với vai trò khác (ANALYST / TECHNICIAN) mở xem Lô đã RELEASED: Gate 7 vẫn PASS, không bị ERR_ROLE_UNAUTHORIZED', () => {
      const releasedBatch: Batch = {
        ...mockBatch,
        status: 'RELEASED',
        version: 2,
        releaseSignatures: [validReleaseSignature],
      };

      const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch: releasedBatch,
        testResults: mockTestResults,
        userRole: 'ANALYST', // Người xem không phải QA/ADMIN
        userSignature: undefined,
      });

      expect(decision.blockers.some((b) => b.includes('ERR_ROLE_UNAUTHORIZED'))).toBe(false);
      const gate7 = decision.gates.find((g) => g.gateIndex === 7);
      expect(gate7!.passed).toBe(true);
      expect(gate7!.status).toBe('PASS');
    });

    it('Lô chưa RELEASED và thiếu chữ ký: Gate 7 bắt buộc FAIL và báo ERR_SIGNATURE_MISSING (Fail-Closed)', () => {
      const pendingBatch: Batch = {
        ...mockBatch,
        status: 'TESTING',
        releaseSignatures: undefined,
      };

      const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch: pendingBatch,
        testResults: mockTestResults,
        userRole: 'QA',
        userSignature: undefined,
      });

      expect(decision.eligible).toBe(false);
      const gate7 = decision.gates.find((g) => g.gateIndex === 7);
      expect(gate7!.passed).toBe(false);
      expect(gate7!.blockers?.[0]).toContain('ERR_SIGNATURE_MISSING');
    });
  });

  describe('Lớp 1: Batch.status ↔ 7 Gate Progress & Synchronizer (Stale Write Guard)', () => {
    it('BatchReleaseProgressService.resolveReleaseProgress trên Lô RELEASED: bảo toàn 7 gate results đầy đủ (không rỗng)', () => {
      const releasedBatch: Batch = {
        ...mockBatch,
        status: 'RELEASED',
        version: 2,
        releaseSignatures: [validReleaseSignature],
      };

      const progress = BatchReleaseProgressService.resolveReleaseProgress({
        batch: releasedBatch,
        testResults: mockTestResults,
        userRole: 'QA',
        userSignature: undefined,
      });

      expect(progress.releaseStage).toBe('RELEASED');
      expect(progress.releaseGateProgress.completed).toBe(7);
      expect(progress.releaseGateProgress.total).toBe(7);
      expect(progress.releaseGateProgress.percentage).toBe(100);
      expect(progress.readyForRelease).toBe(false); // Lô đã RELEASED -> readyForRelease = false
      expect(progress.readyForSignature).toBe(false);

      // KHÔNG ĐƯỢC RỖNG: gateResults phải có đủ 7 gates
      expect(progress.gateResults).toHaveLength(7);
      expect(progress.gateResults.every((g) => g.passed)).toBe(true);
      const gate7 = progress.gateResults.find((g) => g.gateIndex === 7);
      expect(gate7!.passed).toBe(true);
      expect(gate7!.status).toBe('PASS');
    });

    it('evaluateReleasePreview: Gate 7 ở trạng thái WAITING và KHÔNG ném blocker ERR_SIGNATURE_MISSING làm đỏ giao diện', () => {
      const previewDecision = BatchReleaseDecisionService.evaluateReleasePreview({
        batch: mockBatch,
        testResults: mockTestResults,
        userRole: 'QA',
      });

      const gate7 = previewDecision.gates.find((g) => g.gateIndex === 7);
      expect(gate7).toBeDefined();
      expect(gate7!.status).toBe('WAITING');
      expect(gate7!.passed).toBe(false);
      expect(gate7!.details).toContain('Chờ ký điện tử xuất xưởng');
      // Không được chứa blocker đỏ ERR_SIGNATURE_MISSING trên preview
      expect(gate7!.blockers || []).toHaveLength(0);
    });

    it('Chữ ký thiếu documentId hoặc documentId không khớp: Gate 7 bắt buộc FAIL với ERR_SIGNATURE_MISMATCH', () => {
      const invalidDocIdSig = {
        ...validReleaseSignature,
        documentId: '', // Thiếu documentId
      };

      const decision = BatchReleaseDecisionService.evaluateReleaseEligibility({
        batch: mockBatch,
        testResults: mockTestResults,
        userRole: 'QA',
        userSignature: invalidDocIdSig as any,
      });

      expect(decision.eligible).toBe(false);
      const gate7 = decision.gates.find((g) => g.gateIndex === 7);
      expect(gate7!.passed).toBe(false);
      expect(gate7!.blockers?.some((b) => b.includes('ERR_SIGNATURE_MISMATCH'))).toBe(true);
    });

    it('getReleasedCanonicalSnapshot: bảo toàn 100% 7/7 PASS lịch sử kể cả khi dữ liệu hiện tại có thay đổi sau release', () => {
      const releasedBatch: Batch = {
        ...mockBatch,
        status: 'RELEASED',
        version: 5,
        releasedAt: new Date().toISOString(),
        releasedBy: 'qa_lead@company.com',
        releaseSignatures: [validReleaseSignature],
      };

      // Dữ liệu giả lập có deviation mở phát sinh sau release
      const currentDeviations = [
        {
          id: 'dev_post_release',
          batchId: mockBatch.id,
          severity: 'CRITICAL',
          status: 'OPEN',
        },
      ];

      const snapshot = BatchReleaseDecisionService.getReleasedCanonicalSnapshot(releasedBatch);
      expect(snapshot.eligible).toBe(true);
      expect(snapshot.gates).toHaveLength(7);
      expect(snapshot.gates.every((g) => g.passed)).toBe(true);
      expect(snapshot.currentStatus).toBe('RELEASED');
      expect(snapshot.blockers).toHaveLength(0);
    });

    it('BatchReleaseWorkflowSynchronizer: sync background trên Lô RELEASED không bị thụt lùi xuống 6/7 hoặc GATE_7', async () => {
      const mockRepo = {
        findById: async () => ({
          ...mockBatch,
          status: 'RELEASED',
          version: 2,
          releaseStage: 'RELEASED',
          releaseGateProgress: {
            completed: 7,
            total: 7,
            currentGate: 8,
            percentage: 100,
            evaluatedAt: new Date().toISOString(),
          },
          releaseSignatures: [validReleaseSignature],
        }),
        updateReleaseProgress: async (_id: string, stage: string, gateProgress: any) => ({
          ...mockBatch,
          status: 'RELEASED',
          releaseStage: stage,
          releaseGateProgress: gateProgress,
          version: 3,
        }),
      } as any;

      const synchronizer = new BatchReleaseWorkflowSynchronizer(mockRepo);

      // Chạy background sync với userSignature = undefined (mô phỏng worker hoặc event sync sau release)
      const syncedProgress = await synchronizer.syncBatchReleaseProgress({
        batchId: mockBatch.id,
        userSignature: undefined,
      });

      expect(syncedProgress.releaseStage).toBe('RELEASED');
      expect(syncedProgress.releaseGateProgress.completed).toBe(7);
      expect(syncedProgress.releaseGateProgress.percentage).toBe(100);
      expect(syncedProgress.gateResults.every((g) => g.passed)).toBe(true);
    });
  });
});
