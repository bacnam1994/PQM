import { describe, it, expect, vi } from 'vitest';
import {
  TestResultRules,
  TestResultWorkflowStateMachine,
  QualityWorkflowMatrixGuard,
  TEST_RESULT_ACTIONS,
  TestResultQueries,
} from '../index';
import type { ITestResultRepository } from '../index';
import type { TestResult } from '../domain/types';

describe('Test Result Domain', () => {
  describe('TestResultRules', () => {
    it('validates test result input correctly', () => {
      const invalidNoBatch = TestResultRules.validateTestResult({
        labName: 'Lab QC',
        testDate: '2026-03-30',
      });
      expect(invalidNoBatch.isValid).toBe(false);
      expect(invalidNoBatch.error).toContain('Lô sản xuất');

      const invalidNoLab = TestResultRules.validateTestResult({
        batchId: 'batch_01',
        testDate: '2026-03-30',
      });
      expect(invalidNoLab.isValid).toBe(false);
      expect(invalidNoLab.error).toContain('Tên phòng kiểm nghiệm');

      const invalidNoDate = TestResultRules.validateTestResult({
        batchId: 'batch_01',
        labName: 'Lab QC',
      });
      expect(invalidNoDate.isValid).toBe(false);
      expect(invalidNoDate.error).toContain('Ngày kiểm nghiệm');

      const valid = TestResultRules.validateTestResult({
        batchId: 'batch_01',
        labName: 'Lab QC',
        testDate: '2026-03-30',
      });
      expect(valid.isValid).toBe(true);
    });

    it('correctly evaluates canEdit and isTerminal', () => {
      expect(TestResultRules.canEdit('DRAFT')).toBe(true);
      expect(TestResultRules.canEdit('SUBMITTED')).toBe(true);
      expect(TestResultRules.canEdit('APPROVED')).toBe(false);
      expect(TestResultRules.canEdit('SUPERSEDED')).toBe(false);

      expect(TestResultRules.isTerminal('SUPERSEDED')).toBe(true);
      expect(TestResultRules.isTerminal('CANCELLED')).toBe(true);
      expect(TestResultRules.isTerminal('DRAFT')).toBe(false);
      expect(TestResultRules.isTerminal('APPROVED')).toBe(false);
    });
  });

  describe('TestResultWorkflowStateMachine & Guard', () => {
    it('validates transitions according to document lifecycle', () => {
      const validFromDraft = TestResultWorkflowStateMachine.getValidNextStates('DRAFT');
      expect(validFromDraft).toContain('SUBMITTED');

      const checkDraftToSub = TestResultWorkflowStateMachine.canTransition('DRAFT', 'SUBMITTED', {
        actorRole: 'QC',
      });
      expect(checkDraftToSub.allowed).toBe(true);
    });

    it('blocks illegal transitions from terminal states', () => {
      const nextFromSuperseded = TestResultWorkflowStateMachine.getValidNextStates('SUPERSEDED');
      expect(nextFromSuperseded.length).toBe(0);

      const invalidCheck = TestResultWorkflowStateMachine.canTransition('SUPERSEDED', 'DRAFT', {
        actorRole: 'ADMIN',
      });
      expect(invalidCheck.allowed).toBe(false);
    });

    it('QualityWorkflowMatrixGuard enforces GMP matrix invariants', () => {
      // RELEASED + FAIL must be forbidden
      const guardReleasedFail = QualityWorkflowMatrixGuard.validate('RELEASED', 'FAIL');
      expect(guardReleasedFail.allowed).toBe(false);

      // SUBMITTED + UNKNOWN must be forbidden
      const guardSubmittedUnknown = QualityWorkflowMatrixGuard.validate('SUBMITTED', 'UNKNOWN');
      expect(guardSubmittedUnknown.allowed).toBe(false);

      // APPROVED + PASS must be allowed
      const guardApprovedPass = QualityWorkflowMatrixGuard.validate('APPROVED', 'PASS');
      expect(guardApprovedPass.allowed).toBe(true);
    });
  });

  describe('Workflow Definitions', () => {
    it('defines canonical actions for Test Result', () => {
      expect(TEST_RESULT_ACTIONS.CREATE).toBe('TEST_RESULT_CREATE');
      expect(TEST_RESULT_ACTIONS.SUBMIT).toBe('TEST_RESULT_SUBMIT');
      expect(TEST_RESULT_ACTIONS.APPROVE).toBe('TEST_RESULT_APPROVE');
      expect(TEST_RESULT_ACTIONS.REJECT).toBe('TEST_RESULT_REJECT');
    });
  });

  describe('TestResultQueries', () => {
    it('queries test results through repository boundary', async () => {
      const mockResults: TestResult[] = [
        {
          id: 'tr_01',
          batchId: 'batch_01',
          labName: 'Lab QC',
          testDate: '2026-03-30',
          status: 'APPROVED',
          results: [],
        } as unknown as TestResult,
      ];

      const mockRepo: Partial<ITestResultRepository> = {
        findAll: vi.fn().mockResolvedValue(mockResults),
        findById: vi
          .fn()
          .mockImplementation(async (id) => (id === 'tr_01' ? mockResults[0] : null)),
        findByBatchId: vi
          .fn()
          .mockImplementation(async (bId) => (bId === 'batch_01' ? mockResults : [])),
      };

      const queries = new TestResultQueries(mockRepo as ITestResultRepository);

      const all = await queries.getAll();
      expect(all.length).toBe(1);

      const byId = await queries.getById('tr_01');
      expect(byId?.id).toBe('tr_01');

      const byBatch = await queries.getByBatchId('batch_01');
      expect(byBatch.length).toBe(1);
    });
  });
});
