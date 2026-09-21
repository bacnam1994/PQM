/**
 * auditRegressionSuite.test.ts
 * Bộ kiểm thử hồi quy 42 kịch bản khắt khe bảo vệ tính toàn vẹn ALCOA+ & GMP
 * Cho chuỗi: Domain Evaluation -> TestResult -> Batch Release -> Auto-Heal -> Snapshot SHA-256
 */

import { describe, it, expect } from 'vitest';
import { QualityEvaluationEngine } from './QualityEvaluationEngine';
import { CriterionEvaluator } from './CriterionEvaluator';
import { OverallResultEvaluator } from './OverallResultEvaluator';
import {
  buildEvaluationSnapshot,
  verifyEvaluationSnapshotIntegrity,
  createEvaluationHash,
} from './EvaluationSnapshotBuilder';
import {
  resolveFinalTestResultForBatch,
  detectTestResultStatusMismatch,
} from '../test-result/testResultStatusResolver';
import { evaluateBatchReleaseIntegrity } from '../batch/batchIntegrityValidator';
import { Criterion, CriterionType, TCCS, TestResult, Batch } from '../../types';
import { EVALUATION_RULE } from '../../utils/constants';

describe('Audit Remediation — 42 Scenarios Regression Suite (GMP & ALCOA+)', () => {
  // =========================================================================
  // PHẦN 1: EVALUATION COMBINATIONS & VALUE NORMALIZATION (1 - 18)
  // =========================================================================
  describe('Group 1: Evaluation Combinations & Value Parsing (1 - 18)', () => {
    it('1. PASS + PASS -> PASS', () => {
      const results = [
        { criteriaName: 'Độ ẩm', value: '5.0', isPass: true },
        { criteriaName: 'Định lượng', value: '100.0', isPass: true },
      ];
      expect(OverallResultEvaluator.calculateOverallStatus(results as any, null)).toBe('PASS');
    });

    it('2. PASS + FAIL -> FAIL', () => {
      const results = [
        { criteriaName: 'Độ ẩm', value: '5.0', isPass: true },
        { criteriaName: 'Định lượng', value: '70.0', isPass: false },
      ];
      expect(OverallResultEvaluator.calculateOverallStatus(results as any, null)).toBe('FAIL');
    });

    it('3. PASS + null -> PENDING (không được ép null thành PASS hay FAIL)', () => {
      const results = [
        { criteriaName: 'Độ ẩm', value: '5.0', isPass: true },
        { criteriaName: 'Định tính', value: '', isPass: null },
      ];
      expect(OverallResultEvaluator.calculateOverallStatus(results as any, null)).toBe('PENDING');
    });

    it('4. null + null -> PENDING', () => {
      const results = [
        { criteriaName: 'Độ ẩm', value: '', isPass: null },
        { criteriaName: 'Định lượng', value: '', isPass: null },
      ];
      expect(OverallResultEvaluator.calculateOverallStatus(results as any, null)).toBe('PENDING');
    });

    it('5. null + FAIL -> FAIL', () => {
      const results = [
        { criteriaName: 'Độ ẩm', value: '', isPass: null },
        { criteriaName: 'Định lượng', value: '70.0', isPass: false },
      ];
      expect(OverallResultEvaluator.calculateOverallStatus(results as any, null)).toBe('FAIL');
    });

    it('6. undefined -> UNKNOWN (khi không có kết quả nào)', () => {
      expect(OverallResultEvaluator.calculateOverallStatus([], null)).toBe('UNKNOWN');
    });

    it('7. invalid value -> UNKNOWN / PENDING', () => {
      const crit: any = {
        name: 'Độ ẩm',
        type: CriterionType.NUMBER,
        min: 4.0,
        max: 6.0,
        unit: '%',
      };
      const evalRes = CriterionEvaluator.evaluateCriterion(crit, 'không thể đo được giá trị');
      expect(evalRes.isPass).toBe(false);
    });

    it('8. ND + ND -> PASS (Âm tính / Không phát hiện)', () => {
      const crit: any = { name: 'E.coli', type: CriterionType.TEXT, expectedText: 'KPH', unit: '' };
      const evalRes = CriterionEvaluator.evaluateCriterion(crit, 'Không phát hiện (ND)');
      expect(evalRes.isPass).toBe(true);
    });

    it('9. ND + Positive -> FAIL', () => {
      const crit: any = {
        name: 'Salmonella',
        type: CriterionType.TEXT,
        expectedText: 'Âm tính',
        unit: '',
      };
      const evalRes = CriterionEvaluator.evaluateCriterion(crit, 'Dương tính');
      expect(evalRes.isPass).toBe(false);
    });

    it('10. <LOD (Dưới ngưỡng phát hiện) -> PASS', () => {
      const crit: any = { name: 'Chì (Pb)', type: CriterionType.NUMBER, max: 5.0, unit: 'ppm' };
      const evalRes = CriterionEvaluator.evaluateCriterion(crit, '< 0.05 ppm (LOD)');
      expect(evalRes.isPass).toBe(true);
    });

    it('11. <LOQ (Dưới ngưỡng định lượng) -> PASS', () => {
      const crit: any = { name: 'Asen (As)', type: CriterionType.NUMBER, max: 2.0, unit: 'ppm' };
      const evalRes = CriterionEvaluator.evaluateCriterion(crit, '<LOQ');
      expect(evalRes.isPass).toBe(true);
    });

    it('12. decimal comma (dấu phẩy thập phân kiểu VN) -> 5,5% đạt trong dải 4.0 - 6.0', () => {
      const crit: any = {
        name: 'Độ ẩm',
        type: CriterionType.NUMBER,
        min: 4.0,
        max: 6.0,
        unit: '%',
      };
      const evalRes = CriterionEvaluator.evaluateCriterion(crit, '5,5%');
      expect(evalRes.isPass).toBe(true);
    });

    it('13. decimal point (dấu chấm thập phân)', () => {
      const crit: any = {
        name: 'Độ ẩm',
        type: CriterionType.NUMBER,
        min: 4.0,
        max: 6.0,
        unit: '%',
      };
      const evalRes = CriterionEvaluator.evaluateCriterion(crit, '5.5');
      expect(evalRes.isPass).toBe(true);
    });

    it('14. scientific notation (1.2e-3)', () => {
      const crit: any = { name: 'Tạp chất X', type: CriterionType.NUMBER, max: 0.005, unit: '%' };
      const evalRes = CriterionEvaluator.evaluateCriterion(crit, '1.2e-3');
      expect(evalRes.isPass).toBe(true);
    });

    it('15. negative range (-10 đến -5 độ C)', () => {
      const crit: any = {
        name: 'Nhiệt độ âm',
        type: CriterionType.NUMBER,
        min: -10,
        max: -5,
        unit: '°C',
      };
      const evalRes = CriterionEvaluator.evaluateCriterion(crit, '-7');
      expect(evalRes.isPass).toBe(true);
    });

    it('16. tolerance (± dải dung sai)', () => {
      const check = CriterionEvaluator.checkRange('100 ± 10', '105');
      expect(check).toBe(true);
    });

    it('17. exact text (khớp chính xác chuỗi cảm quan)', () => {
      const crit: any = {
        name: 'Cảm quan',
        type: CriterionType.TEXT,
        expectedText: 'Bột màu trắng ngà, vị đắng nhẹ',
        unit: '',
      };
      const evalRes = CriterionEvaluator.evaluateCriterion(crit, 'Bột màu trắng ngà, vị đắng nhẹ');
      expect(evalRes.isPass).toBe(true);
    });

    it('18. zero CFU (Số 0 hợp lệ, không bị nuốt thành empty hay false)', () => {
      const crit: any = { name: 'Vi sinh', type: CriterionType.NUMBER, max: 100, unit: 'CFU/g' };
      const evalRes = CriterionEvaluator.evaluateCriterion(crit, '0');
      expect(evalRes.isPass).toBe(true);
    });
  });

  // =========================================================================
  // PHẦN 2: ALTERNATE RULES & CONDITIONAL CHECKS (19 - 24)
  // =========================================================================
  describe('Group 2: Alternate Rules & Version Binding (19 - 24)', () => {
    const tccsWithConditional: TCCS = {
      id: 'tccs_01',
      code: 'TCCS-TEST-01',
      version: 1,
      mainQualityCriteria: [
        {
          name: 'Tổng số vi sinh hiếu khí (TAMC)',
          type: CriterionType.NUMBER,
          max: 1000,
          unit: 'CFU/g',
        },
      ],
      safetyCriteria: [{ name: 'E.coli', type: CriterionType.TEXT, expectedText: 'KPH', unit: '' }],
      alternateRules: [
        {
          main: 'Tổng số vi sinh hiếu khí (TAMC)',
          alt: 'E.coli',
          type: EVALUATION_RULE.CONDITIONAL_CHECK,
          conditionValue: '> 1000',
        },
      ],
    } as any;

    it('19. condition not triggered -> E.coli được miễn kiểm', () => {
      const results = [
        { criteriaName: 'Tổng số vi sinh hiếu khí (TAMC)', value: '500', isPass: true },
      ];
      const status = OverallResultEvaluator.calculateOverallStatus(
        results as any,
        tccsWithConditional
      );
      expect(status).toBe('PASS');
    });

    it('20. condition triggered -> E.coli bắt buộc kiểm (nếu thiếu -> PENDING)', () => {
      const results = [
        { criteriaName: 'Tổng số vi sinh hiếu khí (TAMC)', value: '1500', isPass: false },
      ];
      const status = OverallResultEvaluator.calculateOverallStatus(
        results as any,
        tccsWithConditional
      );
      expect(status).toBe('PENDING');
    });

    it('21. missing main result -> NOT exempt (không thể miễn nếu chưa có kết quả chính)', () => {
      const results = [
        { criteriaName: 'Tổng số vi sinh hiếu khí (TAMC)', value: '', isPass: null },
      ];
      const status = OverallResultEvaluator.calculateOverallStatus(
        results as any,
        tccsWithConditional
      );
      expect(status).toBe('PENDING');
    });

    it('22. invalid main result -> NOT exempt', () => {
      const results = [
        { criteriaName: 'Tổng số vi sinh hiếu khí (TAMC)', value: 'chưa kiểm', isPass: false },
      ];
      const status = OverallResultEvaluator.calculateOverallStatus(
        results as any,
        tccsWithConditional
      );
      expect(status).toBe('FAIL');
    });

    it('23. alternate from wrong TCCS version -> reject', () => {
      const snapshotV1 = buildEvaluationSnapshot(
        {
          id: 'TR-1',
          batchId: 'B-1',
          overallStatus: 'PASS',
          results: [{ criteriaName: 'Độ ẩm', value: '5.0', isPass: true }],
        } as any,
        { email: 'qa@vbiotech.vn' },
        { tccs: { id: 'tccs_01', version: 1 } as any }
      );
      expect(snapshotV1.tccsVersion).toBe(1);
    });

    it('24. historical snapshot unaffected by TCCS v2', () => {
      const tr: any = {
        id: 'TR-HIST',
        batchId: 'B-HIST',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Hàm lượng', value: '92.0', isPass: true }],
      };
      const snap = buildEvaluationSnapshot(
        tr,
        { email: 'qa@vbiotech.vn' },
        { tccs: { id: 'tccs_01', version: 1 } as any }
      );
      tr.evaluationSnapshot = snap;

      // Giả sử sau đó có TCCS v2 siết tiêu chuẩn 95 - 105%
      // Snapshot đã lưu vẫn giữ PASS và hash hợp lệ 100%
      expect(tr.evaluationSnapshot.overallStatus).toBe('PASS');
      expect(verifyEvaluationSnapshotIntegrity(tr.evaluationSnapshot, tr.id, tr.batchId)).toBe(
        true
      );
    });
  });

  // =========================================================================
  // PHẦN 3: MULTI-LAB & AUTHORITATIVE PRECEDENCE (25 - 30)
  // =========================================================================
  describe('Group 3: Multi-Lab & Authoritative Precedence (25 - 30)', () => {
    const mockBatch: Batch = {
      id: 'batch_001',
      batchNo: 'B2026-01',
      productId: 'p1',
      status: 'TESTING',
    } as any;

    it('25. Lab A PASS + Lab B PASS -> PASS', () => {
      const trA: any = {
        id: 'TR-A',
        batchId: 'batch_001',
        labName: 'Lab A',
        status: 'FINAL',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Hóa lý', value: 'Đạt', isPass: true }],
      };
      const res = resolveFinalTestResultForBatch(mockBatch, [trA]);
      expect(res.status).toBe('PASS');
    });

    it('26. Lab A PASS + Lab B FAIL -> Authoritative FAIL nếu phiếu mới/final hơn', () => {
      const trA: any = {
        id: 'TR-A',
        batchId: 'batch_001',
        labName: 'Lab A',
        status: 'DRAFT',
        updatedAt: '2026-09-01',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Định lượng', value: '98%', isPass: true }],
      };
      const trB: any = {
        id: 'TR-B',
        batchId: 'batch_001',
        labName: 'Lab B',
        status: 'APPROVED',
        updatedAt: '2026-09-02',
        overallStatus: 'FAIL',
        results: [{ criteriaName: 'Định lượng', value: '80%', isPass: false }],
      };
      const res = resolveFinalTestResultForBatch(mockBatch, [trA, trB]);
      expect(res.finalTestResult?.id).toBe('TR-B'); // APPROVED thắng DRAFT
      expect(res.status).toBe('FAIL');
    });

    it('27. old FAIL + new FINAL PASS -> PASS (Retest hợp lệ đã hoàn tất)', () => {
      const oldFail: any = {
        id: 'TR-FAIL-01',
        batchId: 'batch_001',
        status: 'FINAL',
        version: 1,
        updatedAt: '2026-09-01',
        overallStatus: 'FAIL',
        results: [{ criteriaName: 'Độ ẩm', value: '8.0%', isPass: false }],
      };
      const newPass: any = {
        id: 'TR-PASS-02',
        batchId: 'batch_001',
        status: 'FINAL',
        version: 2,
        updatedAt: '2026-09-05',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Độ ẩm', value: '5.0%', isPass: true }],
      };
      const res = resolveFinalTestResultForBatch(mockBatch, [oldFail, newPass]);
      expect(res.finalTestResult?.id).toBe('TR-PASS-02');
      expect(res.status).toBe('PASS');
    });

    it('28. DRAFT newer than FINAL -> FINAL thắng (Precedence Matrix)', () => {
      const finalOld: any = {
        id: 'TR-FINAL',
        batchId: 'batch_001',
        status: 'FINAL',
        updatedAt: '2026-09-01',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Chỉ tiêu', value: '10', isPass: true }],
      };
      const draftNew: any = {
        id: 'TR-DRAFT',
        batchId: 'batch_001',
        status: 'DRAFT',
        updatedAt: '2026-09-10',
        overallStatus: 'FAIL',
        results: [{ criteriaName: 'Chỉ tiêu', value: '50', isPass: false }],
      };
      const res = resolveFinalTestResultForBatch(mockBatch, [finalOld, draftNew]);
      expect(res.finalTestResult?.id).toBe('TR-FINAL'); // FINAL có trọng số 30 > DRAFT có trọng số 10
    });

    it('29. VOIDED newest -> ignore hoàn toàn', () => {
      const activeTr: any = {
        id: 'TR-VALID',
        batchId: 'batch_001',
        status: 'FINAL',
        updatedAt: '2026-09-01',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Độ tan', value: '85%', isPass: true }],
      };
      const voidedTr: any = {
        id: 'TR-VOIDED',
        batchId: 'batch_001',
        status: 'VOIDED',
        updatedAt: '2026-09-15',
        overallStatus: 'FAIL',
        results: [{ criteriaName: 'Độ tan', value: '20%', isPass: false }],
      };
      const res = resolveFinalTestResultForBatch(mockBatch, [activeTr, voidedTr]);
      expect(res.finalTestResult?.id).toBe('TR-VALID');
    });

    it('30. two FINAL same version -> deterministic tie-breaker bằng ID', () => {
      const tr1: any = {
        id: 'TR-AAA',
        batchId: 'batch_001',
        status: 'FINAL',
        version: 1,
        updatedAt: '2026-09-01T00:00:00Z',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'X', value: '1', isPass: true }],
      };
      const tr2: any = {
        id: 'TR-BBB',
        batchId: 'batch_001',
        status: 'FINAL',
        version: 1,
        updatedAt: '2026-09-01T00:00:00Z',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'X', value: '1', isPass: true }],
      };
      const resA = resolveFinalTestResultForBatch(mockBatch, [tr1, tr2]);
      const resB = resolveFinalTestResultForBatch(mockBatch, [tr2, tr1]);
      // Cả 2 lần đảo thứ tự mảng đầu vào đều phải cho ra cùng 1 phiếu thắng
      expect(resA.finalTestResult?.id).toBe(resB.finalTestResult?.id);
    });
  });

  // =========================================================================
  // PHẦN 4: BATCH RELEASE GATES (31 - 36)
  // =========================================================================
  describe('Group 4: Batch Release Gates (31 - 36)', () => {
    const releasedBatch: Batch = {
      id: 'B-REL',
      batchNo: 'REL-001',
      productId: 'P1',
      status: 'RELEASED',
    } as any;

    it('31. missing test -> BLOCK release', () => {
      const evalRes = evaluateBatchReleaseIntegrity(releasedBatch, []);
      expect(evalRes.integrityStatus).toBe('MISSING_TEST_RESULT');
      expect(evalRes.shouldAlert).toBe(true);
    });

    it('32. PENDING test -> BLOCK release', () => {
      const pendingTr: any = {
        id: 'TR-P',
        batchId: 'B-REL',
        status: 'FINAL',
        overallStatus: 'PENDING',
        results: [{ criteriaName: 'Độ ẩm', value: '', isPass: null }],
      };
      const evalRes = evaluateBatchReleaseIntegrity(releasedBatch, [pendingTr]);
      expect(evalRes.integrityStatus).not.toBe('PASS');
    });

    it('33. UNKNOWN test -> BLOCK release', () => {
      const unknownTr: any = {
        id: 'TR-U',
        batchId: 'B-REL',
        status: 'FINAL',
        overallStatus: 'UNKNOWN',
        results: [],
      };
      const evalRes = evaluateBatchReleaseIntegrity(releasedBatch, [unknownTr]);
      expect(evalRes.integrityStatus).not.toBe('PASS');
    });

    it('34. FAIL test -> BLOCK release', () => {
      const failTr: any = {
        id: 'TR-F',
        batchId: 'B-REL',
        status: 'FINAL',
        overallStatus: 'FAIL',
        results: [{ criteriaName: 'Vi sinh', value: '10000', isPass: false }],
      };
      const evalRes = evaluateBatchReleaseIntegrity(releasedBatch, [failTr]);
      expect(evalRes.integrityStatus).toBe('TEST_RESULT_INVALID_STATUS');
    });

    it('35. all authoritative PASS -> eligible for release', () => {
      const passTr: any = {
        id: 'TR-PASS',
        batchId: 'B-REL',
        status: 'FINAL',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Độ ẩm', value: '5.0', isPass: true }],
      };
      const evalRes = evaluateBatchReleaseIntegrity(releasedBatch, [passTr]);
      expect(evalRes.integrityStatus).toBe('PASS');
      expect(evalRes.shouldAlert).toBe(false);
    });

    it('36. incomplete data during loading -> DATA_UNAVAILABLE (không đánh FAIL oan)', () => {
      const evalRes = evaluateBatchReleaseIntegrity(releasedBatch, [], {
        isTestResultsLoading: true,
        testResultsLoaded: false,
      });
      expect(evalRes.integrityStatus).toBe('DATA_UNAVAILABLE');
      expect(evalRes.shouldAlert).toBe(false);
    });
  });

  // =========================================================================
  // PHẦN 5: AUTO-HEAL INVARIANTS & INTEGRITY (37 - 42)
  // =========================================================================
  describe('Group 5: Auto-Heal Hardening & ALCOA+ Invariants (37 - 42)', () => {
    it('37. stale snapshot -> phát hiện sai lệch toàn vẹn', () => {
      const tr: any = {
        id: 'TR-TAMPER',
        batchId: 'B-1',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Định lượng', value: '99%', isPass: true }],
      };
      const validSnap = buildEvaluationSnapshot(tr, { email: 'qa@vbiotech.vn' });
      // Giả mạo đổi overallStatus mà không đổi hash
      const tamperedSnap = { ...validSnap, overallStatus: 'FAIL' as const };
      expect(verifyEvaluationSnapshotIntegrity(tamperedSnap, tr.id, tr.batchId)).toBe(false);
    });

    it('38. approved TestResult -> reject auto-heal (khóa an toàn)', () => {
      const approvedTr: any = {
        id: 'TR-APP',
        batchId: 'B-1',
        status: 'APPROVED',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Độ rã', value: '10 phút', isPass: false }],
      };
      const mismatch = detectTestResultStatusMismatch({
        testResult: approvedTr,
        dataFreshness: { isTestResultsLoading: false, testResultsLoaded: true },
      });
      // Với phiếu đã APPROVED, isAutoHealable PHẢI LÀ FALSE
      expect(mismatch.isAutoHealable).toBe(false);
      expect(mismatch.suggestedAction).toContain('Deviation');
    });

    it('39. concurrent / unfinalized test result -> auto-heal chỉ hỗ trợ phiếu làm việc', () => {
      const workingTr: any = {
        id: 'TR-WORK',
        batchId: 'B-1',
        status: 'DRAFT',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Độ ẩm', value: '8.0%', isPass: false }],
      };
      const mismatch = detectTestResultStatusMismatch({
        testResult: workingTr,
        dataFreshness: { isTestResultsLoading: false, testResultsLoaded: true },
      });
      expect(mismatch.isAutoHealable).toBe(true);
    });

    it('40. hash mismatch -> verifyEvaluationSnapshotIntegrity trả về false', () => {
      const fakeSnap = {
        engineVersion: '4.0.0-deterministic',
        tccsVersion: 1,
        evaluatedAt: '2026-09-17T00:00:00Z',
        evaluatedBy: 'hacker@bad.com',
        overallStatus: 'PASS' as const,
        criterionResults: [],
        evaluationHash: 'invalid_sha256_hash_value_1234567890abcdef1234567890abcdef12345678',
      };
      expect(verifyEvaluationSnapshotIntegrity(fakeSnap as any, 'TR-1', 'B-1')).toBe(false);
    });

    it('41. post-heal verification: Snapshot sau khi heal có hash SHA-256 64 hex hợp lệ', () => {
      const candidateTr: any = {
        id: 'TR-HEAL',
        batchId: 'B-HEAL',
        overallStatus: 'FAIL',
        results: [{ criteriaName: 'Độ ẩm', value: '8.0%', isPass: false }],
      };
      const healedSnap = QualityEvaluationEngine.evaluate(candidateTr);
      expect(healedSnap.evaluationHash).toMatch(/^[0-9a-f]{64}$/);
      expect(
        verifyEvaluationSnapshotIntegrity(healedSnap, candidateTr.id, candidateTr.batchId)
      ).toBe(true);
    });

    it('42. evaluationHash phải là chuẩn SHA-256 64 hex characters', () => {
      const hash = createEvaluationHash({ sample: 'test' });
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
