/**
 * tests/domain/testResultWorkflowRegression.test.ts
 * ===================================================
 * TEST RESULT WORKFLOW REGRESSION TEST SUITE
 *
 * Kiểm tra toàn bộ vòng đời TestResult:
 * 1. DRAFT -> SUBMITTED (LAB / QC / QA)
 * 2. SUBMITTED -> FINAL (QC / QA / ADMIN)
 * 3. FINAL -> APPROVED (Chỉ QA/ADMIN + Bắt buộc E-Signature 21 CFR Part 11)
 * 4. APPROVED -> SUPERSEDED (Chỉ QA/ADMIN + Lý do kiểm nghiệm lại)
 * 5. SUPERSEDED -> ANY = Bị cấm hoàn toàn
 * 6. Không dùng TestResult.RELEASED để thay thế cho Batch.RELEASED (WF-013/WF-021)
 */

import { describe, it, expect } from 'vitest';
import { TestResultWorkflowStateMachine } from '../../src/domain/workflow/stateMachine';
import { computeSignatureChecksum } from '../../src/services/signatureService';

describe('TestResult Workflow Regression Tests', () => {
  const lab = { actorRole: 'LAB' as const, actorId: 'u-lab' };
  const qc = { actorRole: 'QC' as const, actorId: 'u-qc' };
  const qa = { actorRole: 'QA' as const, actorId: 'u-qa' };
  const admin = { actorRole: 'ADMIN' as const, actorId: 'u-admin' };

  describe('Lifecycle State Machine Transitions', () => {
    it('DRAFT -> SUBMITTED cho phép LAB, QC, QA, ADMIN', () => {
      expect(TestResultWorkflowStateMachine.canTransition('DRAFT', 'SUBMITTED', lab).allowed).toBe(
        true
      );
      expect(TestResultWorkflowStateMachine.canTransition('DRAFT', 'SUBMITTED', qc).allowed).toBe(
        true
      );
      expect(TestResultWorkflowStateMachine.canTransition('DRAFT', 'SUBMITTED', qa).allowed).toBe(
        true
      );
      expect(
        TestResultWorkflowStateMachine.canTransition('DRAFT', 'SUBMITTED', admin).allowed
      ).toBe(true);
    });

    it('SUBMITTED -> FINAL cho phép QC, QA, ADMIN (LAB bị từ chối)', () => {
      expect(TestResultWorkflowStateMachine.canTransition('SUBMITTED', 'FINAL', lab).allowed).toBe(
        false
      );
      expect(TestResultWorkflowStateMachine.canTransition('SUBMITTED', 'FINAL', qc).allowed).toBe(
        true
      );
      expect(TestResultWorkflowStateMachine.canTransition('SUBMITTED', 'FINAL', qa).allowed).toBe(
        true
      );
      expect(
        TestResultWorkflowStateMachine.canTransition('SUBMITTED', 'FINAL', admin).allowed
      ).toBe(true);
    });

    it('FINAL -> APPROVED chỉ cho phép QA hoặc ADMIN (LAB và QC bị từ chối)', () => {
      expect(TestResultWorkflowStateMachine.canTransition('FINAL', 'APPROVED', lab).allowed).toBe(
        false
      );
      expect(TestResultWorkflowStateMachine.canTransition('FINAL', 'APPROVED', qc).allowed).toBe(
        false
      );
      expect(TestResultWorkflowStateMachine.canTransition('FINAL', 'APPROVED', qa).allowed).toBe(
        true
      );
      expect(TestResultWorkflowStateMachine.canTransition('FINAL', 'APPROVED', admin).allowed).toBe(
        true
      );
    });

    it('APPROVED -> SUPERSEDED bắt buộc có reason và chỉ cho phép QA hoặc ADMIN', () => {
      expect(
        TestResultWorkflowStateMachine.canTransition('APPROVED', 'SUPERSEDED', {
          ...qc,
          reason: 'Retest',
        }).allowed
      ).toBe(false);
      expect(
        TestResultWorkflowStateMachine.canTransition('APPROVED', 'SUPERSEDED', {
          ...qa,
          reason: '',
        }).allowed
      ).toBe(false);
      expect(
        TestResultWorkflowStateMachine.canTransition('APPROVED', 'SUPERSEDED', {
          ...qa,
          reason: 'Kiểm nghiệm lại mẫu lưu do nghi ngờ sai số',
        }).allowed
      ).toBe(true);
    });

    it('SUPERSEDED là trạng thái kết thúc (Terminal State): Cấm chuyển sang bất kỳ trạng thái nào khác', () => {
      expect(
        TestResultWorkflowStateMachine.canTransition('SUPERSEDED', 'DRAFT', admin).allowed
      ).toBe(false);
      expect(
        TestResultWorkflowStateMachine.canTransition('SUPERSEDED', 'SUBMITTED', admin).allowed
      ).toBe(false);
      expect(
        TestResultWorkflowStateMachine.canTransition('SUPERSEDED', 'FINAL', admin).allowed
      ).toBe(false);
      expect(
        TestResultWorkflowStateMachine.canTransition('SUPERSEDED', 'APPROVED', admin).allowed
      ).toBe(false);
    });

    it('DRAFT -> APPROVED bị cấm (phải tuần tự qua SUBMITTED và FINAL)', () => {
      expect(TestResultWorkflowStateMachine.canTransition('DRAFT', 'APPROVED', qa).allowed).toBe(
        false
      );
    });

    it('SUBMITTED -> DRAFT cho phép (Trả lại để chỉnh sửa) với lý do', () => {
      expect(TestResultWorkflowStateMachine.canTransition('SUBMITTED', 'DRAFT', qc).allowed).toBe(
        true
      );
    });
  });

  describe('21 CFR Part 11 Electronic Signature Verification', () => {
    it('tính toán mã băm toàn vẹn checksum cho chữ ký điện tử', async () => {
      const unsignedSig = {
        documentType: 'TEST_RESULT_APPROVAL' as const,
        documentId: 'TR-702601',
        documentVersion: 1,
        signerUid: 'u-qa',
        signerEmail: 'qa@vbiotech.vn',
        role: 'QA' as const,
        meaning: 'Phê duyệt kết quả kiểm nghiệm' as const,
        signedAt: '2026-09-21T10:00:00.000Z',
      };

      const checksum = await computeSignatureChecksum(unsignedSig as any);
      expect(checksum).toBeDefined();
      expect(typeof checksum).toBe('string');
      expect(checksum.length).toBeGreaterThan(10);

      // Mã băm phải nhất quán nếu payload không đổi
      const checksum2 = await computeSignatureChecksum(unsignedSig as any);
      expect(checksum).toBe(checksum2);

      // Thay đổi payload phải sinh ra mã băm khác
      const checksum3 = await computeSignatureChecksum({
        ...unsignedSig,
        signedAt: '2026-09-21T10:00:01.000Z',
      } as any);
      expect(checksum).not.toBe(checksum3);
    });
  });
});
