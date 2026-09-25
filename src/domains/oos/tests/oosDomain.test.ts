import { describe, it, expect, vi } from 'vitest';
import { OOSRules, OOSStateMachine, OOS_ACTIONS, OOSQueries } from '../index';
import type { IDeviationRepository } from '../index';
import type { QualityDeviation } from '../domain/types';

describe('OOS Domain - Vertical Slice 8', () => {
  describe('OOSRules', () => {
    it('validates phase 1 lab investigation input correctly', () => {
      const invalidNoAnalyst = OOSRules.validatePhase1({
        instrumentCheck: 'PASS',
        standardSolutionCheck: 'PASS',
        calculationCheck: 'PASS',
        operatorInterview: 'Kiểm tra bình thường',
        labErrorFound: false,
        assignedAnalyst: '',
      });
      expect(invalidNoAnalyst.isValid).toBe(false);
      expect(invalidNoAnalyst.error).toContain('Kiểm nghiệm viên phụ trách');

      const invalidNoDetails = OOSRules.validatePhase1({
        instrumentCheck: 'FAIL',
        standardSolutionCheck: 'PASS',
        calculationCheck: 'PASS',
        operatorInterview: 'Nghi ngờ bọt khí',
        labErrorFound: true,
        labErrorDetails: '',
        assignedAnalyst: 'Analyst Nguyen',
      });
      expect(invalidNoDetails.isValid).toBe(false);
      expect(invalidNoDetails.error).toContain('mô tả chi tiết lỗi');

      const validPhase1 = OOSRules.validatePhase1({
        instrumentCheck: 'PASS',
        standardSolutionCheck: 'PASS',
        calculationCheck: 'PASS',
        operatorInterview: 'Không có lỗi thao tác',
        labErrorFound: false,
        assignedAnalyst: 'Analyst Tran',
      });
      expect(validPhase1.isValid).toBe(true);
    });

    it('validates phase 2 manufacturing investigation input', () => {
      const invalidNoRootCause = OOSRules.validatePhase2({
        manufacturingProcessCheck: 'PASS',
        rawMaterialCheck: 'PASS',
        environmentalConditionsCheck: 'PASS',
        rootCauseIdentified: '',
        capaPlanRequired: false,
      });
      expect(invalidNoRootCause.isValid).toBe(false);
      expect(invalidNoRootCause.error).toContain('Nguyên nhân gốc rễ');

      const validPhase2 = OOSRules.validatePhase2({
        manufacturingProcessCheck: 'FAIL',
        rawMaterialCheck: 'PASS',
        environmentalConditionsCheck: 'PASS',
        rootCauseIdentified: 'Bộ điều nhiệt buồng sấy bị trôi nhiệt độ 5 độ C',
        capaPlanRequired: true,
      });
      expect(validPhase2.isValid).toBe(true);
    });

    it('enforces QA / Admin authority for concluding OOS', () => {
      const operatorUser = { role: 'OPERATOR' };
      const nonQA = OOSRules.canConclude(operatorUser);
      expect(nonQA.allowed).toBe(false);

      const qaUser = { role: 'QA' };
      const qaAllowed = OOSRules.canConclude(qaUser);
      expect(qaAllowed.allowed).toBe(true);
    });
  });

  describe('OOSStateMachine', () => {
    it('handles phase transitions strictly', () => {
      const nextFromTriggered = OOSStateMachine.getValidNextStates('TRIGGERED');
      expect(nextFromTriggered).toContain('PHASE1_LAB_INVESTIGATION');

      const nextFromPhase1 = OOSStateMachine.getValidNextStates('PHASE1_LAB_INVESTIGATION');
      expect(nextFromPhase1).toContain('PHASE2_MFG_INVESTIGATION');
      expect(nextFromPhase1).toContain('CONCLUDED');
    });

    it('blocks concluding transition if user is not QA/Admin', () => {
      const checkOperator = OOSStateMachine.canTransition('PHASE2_MFG_INVESTIGATION', 'CONCLUDED', {
        actorRole: 'OPERATOR',
      });
      expect(checkOperator.allowed).toBe(false);

      const checkQA = OOSStateMachine.canTransition('PHASE2_MFG_INVESTIGATION', 'CONCLUDED', {
        actorRole: 'QA',
      });
      expect(checkQA.allowed).toBe(true);
    });
  });

  describe('Workflow Definitions', () => {
    it('defines canonical actions for OOS', () => {
      expect(OOS_ACTIONS.CREATE).toBe('OOS_CREATE');
      expect(OOS_ACTIONS.PHASE1_LAB_INVESTIGATE).toBe('OOS_PHASE1_LAB_INVESTIGATE');
      expect(OOS_ACTIONS.PHASE2_MFG_INVESTIGATE).toBe('OOS_PHASE2_MFG_INVESTIGATE');
      expect(OOS_ACTIONS.CONCLUDE).toBe('OOS_CONCLUDE');
    });
  });

  describe('OOSQueries', () => {
    it('filters deviations to only return OOS records', async () => {
      const mockList: QualityDeviation[] = [
        {
          id: 'dev_01',
          deviationNo: 'DEV-01',
          title: 'Lệch nhiệt độ',
          source: 'STORAGE_ENVIRONMENT',
          status: 'CLOSED',
          severity: 'MINOR',
          description: 'Nhiệt độ phòng',
          loggedBy: 'op',
          loggedAt: '2026-03-30',
          version: 1,
          updatedAt: '2026-03-30',
        },
        {
          id: 'dev_02',
          deviationNo: 'DEV-02',
          title: 'OOS Định lượng',
          source: 'OOS_TEST_RESULT',
          status: 'UNDER_INVESTIGATION',
          severity: 'MAJOR',
          description: 'Hàm lượng hoạt chất 88% < 90%',
          batchId: 'batch_01',
          loggedBy: 'qc',
          loggedAt: '2026-03-30',
          version: 1,
          updatedAt: '2026-03-30',
        },
      ];

      const mockRepo: Partial<IDeviationRepository> = {
        findAll: vi.fn().mockResolvedValue(mockList),
        findById: vi
          .fn()
          .mockImplementation(async (id) => mockList.find((x) => x.id === id) || null),
        findByBatchId: vi
          .fn()
          .mockImplementation(async (bId) => mockList.filter((x) => x.batchId === bId)),
      };

      const queries = new OOSQueries(mockRepo as IDeviationRepository);

      const allOOS = await queries.getAllOOS();
      expect(allOOS.length).toBe(1);
      expect(allOOS[0].id).toBe('dev_02');

      const oosById = await queries.getOOSById('dev_02');
      expect(oosById?.id).toBe('dev_02');

      const nonOOSById = await queries.getOOSById('dev_01');
      expect(nonOOSById).toBeNull();

      const oosByBatch = await queries.getOOSByBatchId('batch_01');
      expect(oosByBatch.length).toBe(1);
    });
  });
});
