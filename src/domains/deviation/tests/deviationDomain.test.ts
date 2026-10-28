import { describe, it, expect, vi } from 'vitest';
import {
  DeviationRules,
  DeviationStateMachine,
  DEVIATION_ACTIONS,
  DeviationQueries,
} from '../index';
import type { IDeviationRepository } from '../index';
import type { QualityDeviation } from '../domain/types';

describe('Deviation Domain - Vertical Slice 7', () => {
  describe('DeviationRules', () => {
    it('validates deviation create input properly', () => {
      const invalidNoTitle = DeviationRules.validateCreateInput({
        title: '',
        source: 'MANUFACTURING',
        severity: 'MAJOR',
        description: 'Mô tả sự cố',
      });
      expect(invalidNoTitle.isValid).toBe(false);
      expect(invalidNoTitle.error).toContain('Tiêu đề');

      const invalidNoDesc = DeviationRules.validateCreateInput({
        title: 'Lệch nhiệt độ',
        source: 'STORAGE_ENVIRONMENT',
        severity: 'MINOR',
        description: '',
      });
      expect(invalidNoDesc.isValid).toBe(false);
      expect(invalidNoDesc.error).toContain('Mô tả');

      const valid = DeviationRules.validateCreateInput({
        title: 'Lệch nhiệt độ kho',
        source: 'STORAGE_ENVIRONMENT',
        severity: 'MINOR',
        description: 'Nhiệt độ phòng bảo quản tăng lên 32 độ C trong 15 phút.',
      });
      expect(valid.isValid).toBe(true);
    });

    it('enforces canClose authorization and closure notes', () => {
      const sampleDeviation: QualityDeviation = {
        id: 'dev_01',
        deviationNo: 'DEV-2026-0001',
        title: 'Lỗi bao bì',
        source: 'RAW_MATERIAL',
        status: 'UNDER_INVESTIGATION',
        severity: 'MINOR',
        description: 'Bao bì rách',
        loggedBy: 'operator',
        loggedAt: '2026-03-30',
        version: 1,
        updatedAt: '2026-03-30',
      };

      // Non QA user
      const userOperator = { role: 'OPERATOR' };
      const nonQACheck = DeviationRules.canClose(sampleDeviation, userOperator, 'Đã xử lý');
      expect(nonQACheck.allowed).toBe(false);
      expect(nonQACheck.reason).toContain('Chỉ Trưởng phòng QA hoặc Quản trị viên');

      // QA user without notes
      const userQA = { role: 'QA' };
      const noNotesCheck = DeviationRules.canClose(sampleDeviation, userQA, '');
      expect(noNotesCheck.allowed).toBe(false);
      expect(noNotesCheck.reason).toContain('ghi nhận ý kiến thẩm định');

      // QA user with notes
      const validClose = DeviationRules.canClose(
        sampleDeviation,
        userQA,
        'Đã điều tra và tiêu hủy lô bao bì hỏng.'
      );
      expect(validClose.allowed).toBe(true);
    });
  });

  describe('DeviationStateMachine', () => {
    it('returns valid next states according to lifecycle', () => {
      const nextFromLogged = DeviationStateMachine.getValidNextStates('LOGGED');
      expect(nextFromLogged).toContain('UNDER_INVESTIGATION');
      expect(nextFromLogged).toContain('CLOSED');

      const nextFromUnderInv = DeviationStateMachine.getValidNextStates('UNDER_INVESTIGATION');
      expect(nextFromUnderInv).toContain('CAPA_PLANNED');
    });

    it('guards closing transitions with role and reason', () => {
      // Non-QA closing attempt
      const attemptNonQA = DeviationStateMachine.canTransition('UNDER_INVESTIGATION', 'CLOSED', {
        actorRole: 'USER',
        reason: 'Xong rồi',
      });
      expect(attemptNonQA.allowed).toBe(false);

      // QA closing without reason
      const attemptNoReason = DeviationStateMachine.canTransition('UNDER_INVESTIGATION', 'CLOSED', {
        actorRole: 'QA',
        reason: '',
      });
      expect(attemptNoReason.allowed).toBe(false);

      // Valid QA closing with reason
      const validClose = DeviationStateMachine.canTransition('UNDER_INVESTIGATION', 'CLOSED', {
        actorRole: 'QA',
        reason: 'Kết luận sự cố không ảnh hưởng chất lượng sản phẩm.',
      });
      expect(validClose.allowed).toBe(true);
    });
  });

  describe('Workflow Definitions', () => {
    it('defines canonical action IDs for deviations', () => {
      expect(DEVIATION_ACTIONS.CREATE).toBe('DEVIATION_CREATE');
      expect(DEVIATION_ACTIONS.INVESTIGATE).toBe('DEVIATION_INVESTIGATE');
      expect(DEVIATION_ACTIONS.APPROVE).toBe('DEVIATION_APPROVE');
      expect(DEVIATION_ACTIONS.CLOSE).toBe('DEVIATION_CLOSE');
    });
  });

  describe('DeviationQueries', () => {
    it('queries deviations correctly through repository interface', async () => {
      const mockDeviations: QualityDeviation[] = [
        {
          id: 'dev_01',
          deviationNo: 'DEV-2026-0001',
          title: 'Lỗi bao bì',
          source: 'RAW_MATERIAL',
          status: 'CLOSED',
          severity: 'MINOR',
          description: 'Bao bì rách',
          batchId: 'batch_01',
          loggedBy: 'operator',
          loggedAt: '2026-03-30',
          version: 1,
          updatedAt: '2026-03-30',
        },
      ];

      const mockRepo: Partial<IDeviationRepository> = {
        findAll: vi.fn().mockResolvedValue(mockDeviations),
        findById: vi
          .fn()
          .mockImplementation(async (id) => (id === 'dev_01' ? mockDeviations[0] : null)),
        findByBatchId: vi
          .fn()
          .mockImplementation(async (bId) => (bId === 'batch_01' ? mockDeviations : [])),
      };

      const queries = new DeviationQueries(mockRepo as IDeviationRepository);

      const all = await queries.getAll();
      expect(all.length).toBe(1);

      const byId = await queries.getById('dev_01');
      expect(byId?.id).toBe('dev_01');

      const byBatch = await queries.getByBatchId('batch_01');
      expect(byBatch.length).toBe(1);

      const closed = await queries.getByStatus('CLOSED');
      expect(closed.length).toBe(1);
    });
  });
});
