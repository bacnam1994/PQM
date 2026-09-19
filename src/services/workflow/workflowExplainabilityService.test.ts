import { describe, it, expect } from 'vitest';
import { WorkflowExplainabilityService } from './workflowExplainabilityService';
import { Batch } from '../../types/batch';
import { TestResult } from '../../types/testResult';
import { TCCS } from '../../types/tccs';

describe('WorkflowExplainabilityService (Structured Explainability Engine)', () => {
  const mockTccs = {
    id: 'TCCS-EXP-01',
    code: 'TC-01',
    productId: 'PROD-01',
    mainCriteria: [{ name: 'Chỉ tiêu A', limitText: '100%' }],
  } as unknown as TCCS;

  const qaUser = { uid: 'u-qa', role: 'QA', email: 'qa@vbiotech.com', isAdmin: false };
  const prodUser = {
    uid: 'u-prod',
    role: 'PRODUCTION',
    email: 'prod@vbiotech.com',
    isAdmin: false,
  };

  describe('explainBatchRelease', () => {
    it('giải trình rõ ràng tất cả các lý do khi Lô bị CHẶN xuất xưởng (Release BLOCKED)', () => {
      const testingBatch = {
        id: 'B-EXP-01',
        batchNo: 'L260901',
        productId: 'PROD-01',
        status: 'PENDING', // Chưa chuyển sang TESTING
        version: 1,
      } as unknown as Batch;

      const failTr = {
        id: 'TR-FAIL-01',
        batchId: 'B-EXP-01',
        labName: 'Lab QC',
        testDate: '2026-09-19',
        createdAt: '2026-09-19',
        overallStatus: 'FAIL',
        workflowStatus: 'FINAL', // Chưa được APPROVED
        results: [{ criteriaName: 'Chỉ tiêu A', isPass: false, value: '10' }],
      } as unknown as TestResult;

      const result = WorkflowExplainabilityService.explainBatchRelease({
        batch: testingBatch,
        testResults: [failTr],
        user: prodUser, // User không có quyền QA
        boundTccs: null, // Chưa có TCCS
      });

      expect(result.decision).toBe('BLOCKED');
      expect(result.isAllowed).toBe(false);

      // Thẩm tra các reason items có cấu trúc
      const authReason = result.reasons.find((r) => r.id === 'AUTH_ROLE');
      expect(authReason?.status).toBe('BLOCKED');
      expect(authReason?.blocking).toBe(true);
      expect(authReason?.message).toContain('không đủ thẩm quyền');

      const stateReason = result.reasons.find((r) => r.id === 'STATE_TRANSITION');
      expect(stateReason?.status).toBe('BLOCKED');
      expect(stateReason?.blocking).toBe(true);

      const trReason = result.reasons.find((r) => r.id === 'TR_STATUS_TR-FAIL-01');
      expect(trReason?.status).toBe('BLOCKED');
      expect(trReason?.blocking).toBe(true);
      expect(trReason?.message).toContain('FAIL');

      const tccsReason = result.reasons.find((r) => r.id === 'TCCS_LINK');
      expect(tccsReason?.status).toBe('BLOCKED');
      expect(tccsReason?.blocking).toBe(true);
    });

    it('giải trình rõ ràng khi Lô đủ điều kiện xuất xưởng (Release ALLOWED)', () => {
      const testingBatch = {
        id: 'B-EXP-02',
        batchNo: 'L260902',
        productId: 'PROD-01',
        tccsId: 'TCCS-EXP-01',
        status: 'TESTING',
        version: 1,
      } as unknown as Batch;

      const passTr = {
        id: 'TR-PASS-01',
        batchId: 'B-EXP-02',
        tccsId: 'TCCS-EXP-01',
        labName: 'Lab QC',
        testDate: '2026-09-19',
        createdAt: '2026-09-19',
        overallStatus: 'PASS',
        workflowStatus: 'APPROVED',
        results: [{ criteriaName: 'Chỉ tiêu A', isPass: true, value: '100' }],
      } as unknown as TestResult;

      const result = WorkflowExplainabilityService.explainBatchRelease({
        batch: testingBatch,
        testResults: [passTr],
        user: qaUser,
        boundTccs: mockTccs,
      });

      expect(result.decision).toBe('ALLOWED');
      expect(result.isAllowed).toBe(true);
      expect(result.reasons.every((r) => !r.blocking)).toBe(true);
      expect(result.summary).toContain('đủ điều kiện xuất xưởng');
    });
  });

  describe('explainTestResultApproval', () => {
    it('giải trình chi tiết khi phiếu kiểm nghiệm bị CHẶN duyệt (Approval BLOCKED)', () => {
      const draftTr = {
        id: 'TR-APP-01',
        batchId: 'B-01',
        labName: 'Lab QC',
        testDate: '2026-09-19',
        createdAt: '2026-09-19',
        overallStatus: 'PENDING',
        workflowStatus: 'DRAFT', // Chưa qua SUBMITTED -> FINAL
        results: [],
      } as unknown as TestResult;

      const result = WorkflowExplainabilityService.explainTestResultApproval({
        testResult: draftTr,
        user: prodUser, // Không có quyền
      });

      expect(result.decision).toBe('BLOCKED');
      expect(result.isAllowed).toBe(false);

      const auth = result.reasons.find((r) => r.id === 'APPROVAL_AUTH');
      expect(auth?.blocking).toBe(true);

      const transition = result.reasons.find((r) => r.id === 'APPROVAL_TRANSITION');
      expect(transition?.blocking).toBe(true);

      const matrix = result.reasons.find((r) => r.id === 'QUALITY_MATRIX');
      expect(matrix?.blocking).toBe(true);
    });

    it('giải trình rõ ràng khi phiếu kiểm nghiệm đủ điều kiện phê duyệt (Approval ALLOWED)', () => {
      const finalTr = {
        id: 'TR-APP-02',
        batchId: 'B-01',
        labName: 'Lab QC',
        testDate: '2026-09-19',
        createdAt: '2026-09-19',
        overallStatus: 'PASS',
        workflowStatus: 'FINAL',
        results: [{ criteriaName: 'A', isPass: true, value: '100' }],
      } as unknown as TestResult;

      const result = WorkflowExplainabilityService.explainTestResultApproval({
        testResult: finalTr,
        user: qaUser,
      });

      expect(result.decision).toBe('ALLOWED');
      expect(result.isAllowed).toBe(true);
      expect(result.summary).toContain('QA Approval Allowed');
    });
  });
});
