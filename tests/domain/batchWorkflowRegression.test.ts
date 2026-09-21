/**
 * tests/domain/batchWorkflowRegression.test.ts
 * =============================================
 * BATCH WORKFLOW REGRESSION TEST SUITE
 *
 * Kiểm tra toàn bộ vòng đời Batch:
 * 1. CREATE -> PENDING (bắt buộc)
 * 2. START_TESTING -> PENDING to TESTING (LAB, PRODUCTION, QA)
 * 3. RELEASE_BATCH -> TESTING to RELEASED (QA/Admin + 7 Release Gates + E-Sign)
 * 4. REJECT_BATCH -> TESTING to REJECTED (QA/Admin + mandatory Reason)
 * 5. BLOCK_BATCH -> TESTING/RELEASED to BLOCKED (QA/Admin + mandatory Reason/Recall)
 * 6. REOPEN_BATCH -> REJECTED to PENDING (QA/Admin + CAPA evidence)
 * 7. UNBLOCK_BATCH -> BLOCKED to TESTING (QA/Admin + Retest plan)
 * 8. Chặn các transition bất hợp pháp: PENDING->RELEASED, TESTING->PENDING, RELEASED->TESTING/PENDING, REJECTED->TESTING/RELEASED
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BatchStateMachine } from '../../src/domain/workflow/stateMachine';
import { BatchRules } from '../../src/domain/rules/BatchRules';
import { Batch } from '../../src/types/batch';

describe('Batch Workflow Regression Tests', () => {
  const qa = { actorRole: 'QA' as const, actorId: 'u-qa' };
  const admin = { actorRole: 'ADMIN' as const, actorId: 'u-admin' };
  const lab = { actorRole: 'LAB' as const, actorId: 'u-lab' };
  const prod = { actorRole: 'PRODUCTION' as const, actorId: 'u-prod' };

  describe('Lifecycle State Machine Transitions', () => {
    it('cho phép PENDING -> TESTING đối với các vai trò thực thi (LAB, PRODUCTION, QA)', () => {
      expect(BatchStateMachine.canTransition('PENDING', 'TESTING', lab).allowed).toBe(true);
      expect(BatchStateMachine.canTransition('PENDING', 'TESTING', prod).allowed).toBe(true);
      expect(BatchStateMachine.canTransition('PENDING', 'TESTING', qa).allowed).toBe(true);
      expect(BatchStateMachine.canTransition('PENDING', 'TESTING', admin).allowed).toBe(true);
    });

    it('chặn PENDING -> RELEASED đối với mọi vai trò (phải qua TESTING)', () => {
      expect(BatchStateMachine.canTransition('PENDING', 'RELEASED', qa).allowed).toBe(false);
      expect(BatchStateMachine.canTransition('PENDING', 'RELEASED', admin).allowed).toBe(false);
      expect(BatchStateMachine.canTransition('PENDING', 'RELEASED', lab).allowed).toBe(false);
    });

    it('chặn TESTING -> PENDING đối với mọi vai trò (không thể đảo ngược về PENDING)', () => {
      expect(BatchStateMachine.canTransition('TESTING', 'PENDING', qa).allowed).toBe(false);
      expect(BatchStateMachine.canTransition('TESTING', 'PENDING', admin).allowed).toBe(false);
      expect(BatchStateMachine.canTransition('TESTING', 'PENDING', prod).allowed).toBe(false);
    });

    it('TESTING -> RELEASED chỉ cho phép QA hoặc ADMIN', () => {
      expect(BatchStateMachine.canTransition('TESTING', 'RELEASED', prod).allowed).toBe(false);
      expect(BatchStateMachine.canTransition('TESTING', 'RELEASED', lab).allowed).toBe(false);
      expect(BatchStateMachine.canTransition('TESTING', 'RELEASED', qa).allowed).toBe(true);
      expect(BatchStateMachine.canTransition('TESTING', 'RELEASED', admin).allowed).toBe(true);
    });

    it('TESTING -> REJECTED bắt buộc có reason và chỉ QA/ADMIN', () => {
      expect(
        BatchStateMachine.canTransition('TESTING', 'REJECTED', { ...qa, reason: '' }).allowed
      ).toBe(false);
      expect(
        BatchStateMachine.canTransition('TESTING', 'REJECTED', { ...lab, reason: 'OOS' }).allowed
      ).toBe(false);
      expect(
        BatchStateMachine.canTransition('TESTING', 'REJECTED', {
          ...qa,
          reason: 'Không đạt chỉ tiêu độ ẩm TCCS',
        }).allowed
      ).toBe(true);
      expect(
        BatchStateMachine.canTransition('TESTING', 'REJECTED', {
          ...admin,
          reason: 'Không đạt tiêu chuẩn',
        }).allowed
      ).toBe(true);
    });

    it('TESTING -> BLOCKED bắt buộc có reason và chỉ QA/ADMIN', () => {
      expect(
        BatchStateMachine.canTransition('TESTING', 'BLOCKED', { ...qa, reason: '' }).allowed
      ).toBe(false);
      expect(
        BatchStateMachine.canTransition('TESTING', 'BLOCKED', { ...prod, reason: 'Nghi vấn' })
          .allowed
      ).toBe(false);
      expect(
        BatchStateMachine.canTransition('TESTING', 'BLOCKED', {
          ...qa,
          reason: 'Nghi ngờ nhiễm chéo vi sinh',
        }).allowed
      ).toBe(true);
    });

    it('BLOCKED -> TESTING bắt buộc có reason (retest plan) và chỉ QA/ADMIN', () => {
      expect(
        BatchStateMachine.canTransition('BLOCKED', 'TESTING', { ...lab, reason: 'Kiểm nghiệm lại' })
          .allowed
      ).toBe(false);
      expect(
        BatchStateMachine.canTransition('BLOCKED', 'TESTING', { ...qa, reason: '' }).allowed
      ).toBe(false);
      expect(
        BatchStateMachine.canTransition('BLOCKED', 'TESTING', {
          ...qa,
          reason: 'Kế hoạch tái kiểm tra số 02/KH',
        }).allowed
      ).toBe(true);
    });

    it('BLOCKED -> REJECTED bắt buộc có reason và chỉ QA/ADMIN', () => {
      expect(
        BatchStateMachine.canTransition('BLOCKED', 'REJECTED', { ...prod, reason: 'Hủy' }).allowed
      ).toBe(false);
      expect(
        BatchStateMachine.canTransition('BLOCKED', 'REJECTED', {
          ...qa,
          reason: 'Kết luận điều tra: không thể khắc phục',
        }).allowed
      ).toBe(true);
    });

    it('RELEASED -> BLOCKED (Recall / Khóa khẩn cấp) bắt buộc có reason và chỉ QA/ADMIN', () => {
      expect(
        BatchStateMachine.canTransition('RELEASED', 'BLOCKED', { ...qa, reason: '' }).allowed
      ).toBe(false);
      expect(
        BatchStateMachine.canTransition('RELEASED', 'BLOCKED', { ...lab, reason: 'Thu hồi' })
          .allowed
      ).toBe(false);
      expect(
        BatchStateMachine.canTransition('RELEASED', 'BLOCKED', {
          ...qa,
          reason: 'Thu hồi lô khẩn cấp theo quyết định số 12/QĐ',
        }).allowed
      ).toBe(true);
    });

    it('REJECTED -> PENDING (CAPA Reopen) bắt buộc có reason và chỉ QA/ADMIN', () => {
      expect(
        BatchStateMachine.canTransition('REJECTED', 'PENDING', { ...prod, reason: 'Mở lại' })
          .allowed
      ).toBe(false);
      expect(
        BatchStateMachine.canTransition('REJECTED', 'PENDING', { ...qa, reason: '' }).allowed
      ).toBe(false);
      expect(
        BatchStateMachine.canTransition('REJECTED', 'PENDING', {
          ...qa,
          reason: 'Hồ sơ CAPA-2026-01: Tái chế/xử lý lại nguyên liệu',
        }).allowed
      ).toBe(true);
    });

    it('cấm tuyệt đối chuyển đổi từ RELEASED sang PENDING, TESTING hoặc REJECTED', () => {
      expect(BatchStateMachine.canTransition('RELEASED', 'PENDING', admin).allowed).toBe(false);
      expect(BatchStateMachine.canTransition('RELEASED', 'TESTING', admin).allowed).toBe(false);
      expect(BatchStateMachine.canTransition('RELEASED', 'REJECTED', admin).allowed).toBe(false);
    });

    it('REJECTED sang TESTING hoặc RELEASED bị cấm đối với QA/nhân viên, nhưng ADMIN được trao quyền tối đa phục hồi Lô', () => {
      // QA không thể nhảy cóc từ REJECTED sang TESTING (bắt buộc mở lại PENDING qua CAPA)
      expect(BatchStateMachine.canTransition('REJECTED', 'TESTING', qa).allowed).toBe(false);
      // REJECTED sang RELEASED khi chưa kiểm nghiệm đạt bị chặn
      expect(
        BatchStateMachine.canTransition('REJECTED', 'RELEASED', { ...admin, conditionsMet: false })
          .allowed
      ).toBe(false);
      // ADMIN có thẩm quyền tối cao được phép phục hồi Lô từ REJECTED sang TESTING và PENDING
      expect(BatchStateMachine.canTransition('REJECTED', 'TESTING', admin).allowed).toBe(true);
      expect(BatchStateMachine.canTransition('REJECTED', 'PENDING', admin).allowed).toBe(true);
    });
  });
});
