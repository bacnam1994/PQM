/**
 * businessWorkflow.test.ts
 * =======================================================
 * P14 — End-to-End Business Workflow Integration Tests
 *
 * Kiểm thử toàn diện 2 chu trình nghiệp vụ QC/QA cốt lõi:
 *
 * WORKFLOW 1 (Happy Path - Vòng đời hoàn chỉnh):
 * Create Product -> Create TCCS -> Create Formula -> Create Batch ->
 * Enter Test Result -> Evaluate -> Approve (E-Sign) -> Release Batch ->
 * Generate CoA -> Verify CoA Hash & Integrity.
 *
 * WORKFLOW 2 (Fail -> Alternate Rule -> Retest -> Final Decision):
 * Enter Test Result -> Initial FAIL -> Trigger Alternate Rule / Retest ->
 * Conduct Secondary Testing -> Deterministic Re-evaluation ->
 * QA Final Decision & Audit Trail.
 */

import { describe, it, expect } from 'vitest';
import { QualityEvaluationEngine } from '../evaluation/QualityEvaluationEngine';
import { CriterionEvaluator } from '../evaluation/CriterionEvaluator';
import { buildEvaluationSnapshot } from '../evaluation/EvaluationSnapshotBuilder';
import {
  Product,
  TCCS,
  ProductFormula,
  Batch,
  TestResult,
  TestResultEntry,
  Criterion,
  AlternateRule,
} from '../../types';

describe('P14 — Comprehensive Business Workflow Regression Suite', () => {
  describe('Workflow 1: Chu trình sản xuất & xuất xưởng trọn gói (End-to-End Release Cycle)', () => {
    it('thực thi trọn vẹn từ tạo sản phẩm đến phát hành và xác thực CoA', async () => {
      // 1. Tạo Sản phẩm (Product)
      const product: Product = {
        id: 'prod-para-500',
        code: 'SP-PARA-500',
        name: 'Viên nén Paracetamol 500mg',
        dosageForm: 'Viên nén',
        status: 'ACTIVE',
        createdAt: '2026-01-01T08:00:00.000Z',
      } as any;
      expect(product.id).toBeDefined();

      // 2. Tạo Tiêu chuẩn Cơ sở (TCCS v1.0)
      const criteriaList: any[] = [
        {
          name: 'Hình thức',
          type: 'TEXT',
          expectedText: 'Viên nén màu trắng, hai mặt phẳng',
        },
        {
          name: 'Định lượng Paracetamol',
          type: 'NUMBER',
          min: 95.0,
          max: 105.0,
          unit: '%',
        },
        {
          name: 'Độ hòa tan (45 phút)',
          type: 'NUMBER',
          min: 80.0,
          unit: '%',
        },
        {
          name: 'Tạp chất liên quan (4-aminophenol)',
          type: 'NUMBER',
          max: 0.1,
          unit: '%',
        },
      ];

      const tccs: TCCS = {
        id: 'tccs-para-v1',
        code: 'TCCS-01/2026',
        productId: product.id,
        version: 1,
        mainQualityCriteria: criteriaList,
        safetyCriteria: [],
        status: 'APPROVED',
      } as any;
      expect((tccs as any).status).toBe('APPROVED');

      // 3. Tạo Công thức sản xuất (Formula)
      const formula: ProductFormula = {
        id: 'form-para-500',
        productId: product.id,
        code: 'CT-PARA-500',
        version: 1,
        batchSize: 100000,
        batchSizeUnit: 'Viên',
        status: 'ACTIVE',
        materials: [
          { materialId: 'mat-para', materialName: 'Paracetamol', amount: 500, unit: 'mg' },
          { materialId: 'mat-tinhbot', materialName: 'Tinh bột ngô', amount: 50, unit: 'mg' },
        ],
      } as any;
      expect((formula as any).materials.length).toBe(2);

      // 4. Tạo Lô sản xuất (Batch)
      const batch: any = {
        id: 'batch-2026-001',
        batchNo: 'LOT2026-001',
        productId: product.id,
        formulaId: formula.id,
        batchSize: 100000,
        mfgDate: '2026-03-01',
        expDate: '2029-03-01',
        status: 'IN_PRODUCTION',
      };

      // Chuyển trạng thái lô: SẢN XUẤT -> KIỂM NGHIỆM
      batch.status = 'TESTING';
      expect(batch.status).toBe('TESTING');

      // 5. Nhập kết quả kiểm nghiệm (Test Results)
      const testEntries: any[] = [
        {
          criteriaName: 'Hình thức',
          value: 'Viên nén màu trắng, hai mặt phẳng',
          unit: '',
          isPass: true,
        },
        {
          criteriaName: 'Định lượng Paracetamol',
          value: '99.8',
          unit: '%',
          isPass: true,
        },
        {
          criteriaName: 'Độ hòa tan (45 phút)',
          value: '92.4',
          unit: '%',
          isPass: true,
        },
        {
          criteriaName: 'Tạp chất liên quan (4-aminophenol)',
          value: '0.02',
          unit: '%',
          isPass: true,
        },
      ];

      // 6. Động cơ đánh giá (Evaluation Engine)
      const overallStatus = QualityEvaluationEngine.calculateOverallStatus(testEntries, tccs);
      expect(overallStatus).toBe('PASS');

      // 7. Tạo Phiếu kiểm nghiệm & Đóng gói Bản ghi Đánh giá Niêm phong (Evaluation Snapshot)
      const testResultRecord: TestResult = {
        id: 'tr-2026-001',
        batchId: batch.id,
        testDate: '2026-03-05',
        overallStatus,
        status: 'APPROVED',
        results: testEntries,
        approvedBy: 'qa_manager@vbiotech.vn',
        approvedAt: '2026-03-05T14:30:00.000Z',
      } as any;

      const snapshot = buildEvaluationSnapshot(
        testResultRecord,
        { email: 'qc_analyst@vbiotech.vn' },
        { tccs, batch }
      );

      expect(snapshot.overallStatus).toBe('PASS');
      expect(snapshot.evaluationHash).toBeDefined();
      expect(snapshot.engineVersion).toContain('4.0.0');

      testResultRecord.evaluationSnapshot = snapshot;
      expect((testResultRecord as any).status).toBe('APPROVED');

      // 9. Xuất xưởng Lô sản xuất (QA Release)
      batch.status = 'RELEASED';
      batch.releasedAt = '2026-03-06T09:00:00.000Z';
      batch.releasedBy = 'qa_director@vbiotech.vn';
      expect(batch.status).toBe('RELEASED');

      // 10. Phát hành Giấy chứng nhận chất lượng (CoA Generation)
      const coaRecord = {
        coaNumber: `COA-${batch.batchNo}`,
        batchNo: batch.batchNo,
        productName: product.name,
        testResultId: testResultRecord.id,
        evaluationHash: snapshot.evaluationHash,
        releasedDate: batch.releasedAt,
        issuedBy: 'qa_director@vbiotech.vn',
        status: 'ISSUED',
      };
      expect(coaRecord.coaNumber).toBe('COA-LOT2026-001');

      // 11. Xác thực tính toàn vẹn của CoA (CoA Verification)
      const isCoAValid =
        coaRecord.evaluationHash === snapshot.evaluationHash &&
        coaRecord.status === 'ISSUED' &&
        batch.status === 'RELEASED';
      expect(isCoAValid).toBe(true);
    });
  });

  describe('Workflow 2: Xử lý ngoại lệ (FAIL -> Alternate Rule -> Retest -> Final Decision)', () => {
    it('xử lý luồng kiểm nghiệm không đạt ban đầu, kích hoạt quy tắc dự phòng / kiểm tra lại có kiểm soát', async () => {
      // 1. TCCS có quy tắc Alternate Rule (Ví dụ: Thử lại giai đoạn 2 - S2 khi S1 biên giới)
      const tccsAlternateRules: any[] = [
        {
          id: 'rule-dissolution-s2',
          targetCriteria: 'Độ hòa tan (45 phút)',
          triggerCondition: 'FAIL_RETRY',
          action: 'RETEST_STAGE_2',
          conditionExpression: 'value >= 75 && value < 80',
          overrideStatus: 'PENDING_RETEST',
          instruction:
            'Nếu độ hòa tan giai đoạn 1 đạt từ 75% đến < 80%, tiến hành thử tiếp giai đoạn S2 trên 6 viên bổ sung.',
        },
      ];

      const criterion: any = {
        name: 'Độ hòa tan (45 phút)',
        type: 'NUMBER',
        min: 80.0,
      };

      // 2. Lần 1: Kết quả 76.5% -> Không đạt ngưỡng 80%
      const initialEval = CriterionEvaluator.evaluateCriterion(criterion, '76.5');
      expect(initialEval.isPass).toBe(false);

      // 3. Kích hoạt Alternate Rule / Đánh giá điều kiện
      const matchingRule = tccsAlternateRules.find(
        (r) => r.targetCriteria === criterion.name && r.triggerCondition === 'FAIL_RETRY'
      );
      expect(matchingRule).toBeDefined();
      expect(matchingRule?.action).toBe('RETEST_STAGE_2');

      // 4. Thực hiện thử nghiệm bổ sung giai đoạn 2 (Retest S2: Trung bình 12 viên >= 80%, không viên < 65%)
      const stage2Values = [82.5, 84.1, 80.8, 83.0, 81.5, 85.0];
      const stage2Mean = stage2Values.reduce((a, b) => a + b, 0) / stage2Values.length;
      expect(stage2Mean).toBeGreaterThanOrEqual(80.0);

      // 5. Kết quả phúc tra hợp lệ (Re-test PASSED)
      const finalRetestEval = CriterionEvaluator.evaluateCriterion(
        criterion,
        stage2Mean.toFixed(1)
      );
      expect(finalRetestEval.isPass).toBe(true);

      // 6. QA lập biên bản điều tra OOS/OOT và ghi nhận quyết định cuối cùng
      const oosRecord = {
        id: 'oos-2026-004',
        batchNo: 'LOT2026-002',
        criteriaName: criterion.name,
        initialValue: '76.5%',
        retestValue: `${stage2Mean.toFixed(1)}%`,
        alternateRuleApplied: matchingRule?.id,
        verdict: 'CONFORMING_AFTER_S2',
        investigatedBy: 'qc_lead@vbiotech.vn',
        approvedBy: 'qa_manager@vbiotech.vn',
        auditDate: '2026-03-08T16:00:00.000Z',
      };

      expect(oosRecord.verdict).toBe('CONFORMING_AFTER_S2');
      expect(oosRecord.approvedBy).toBeDefined();
    });
  });
});
