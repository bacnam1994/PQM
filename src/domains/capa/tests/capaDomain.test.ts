import { describe, it, expect, vi } from 'vitest';
import { CAPARules, CAPAStateMachine, CAPA_ACTIONS, CAPAQueries } from '../index';
import type { IDeviationRepository } from '../index';
import type { QualityDeviation } from '../domain/types';

describe('CAPA Domain - Vertical Slice 9', () => {
  describe('CAPARules', () => {
    it('validates CAPA plan input correctly', () => {
      const invalidNoDesc = CAPARules.validatePlanDto({
        deviationId: 'dev_01',
        actionType: 'CORRECTIVE',
        description: '',
        assignedTo: 'Engineer Pham',
        dueDate: '2026-04-15',
      });
      expect(invalidNoDesc.isValid).toBe(false);
      expect(invalidNoDesc.error).toContain('Nội dung hành động CAPA');

      const invalidNoAssignee = CAPARules.validatePlanDto({
        deviationId: 'dev_01',
        actionType: 'PREVENTIVE',
        description: 'Bảo trì định kỳ máy đo pH',
        assignedTo: '',
        dueDate: '2026-04-15',
      });
      expect(invalidNoAssignee.isValid).toBe(false);
      expect(invalidNoAssignee.error).toContain('Người chịu trách nhiệm');

      const invalidNoDate = CAPARules.validatePlanDto({
        deviationId: 'dev_01',
        actionType: 'PREVENTIVE',
        description: 'Bảo trì định kỳ máy đo pH',
        assignedTo: 'Engineer Pham',
        dueDate: '',
      });
      expect(invalidNoDate.isValid).toBe(false);
      expect(invalidNoDate.error).toContain('Hạn chót hoàn thành');

      const valid = CAPARules.validatePlanDto({
        deviationId: 'dev_01',
        actionType: 'PREVENTIVE',
        description: 'Hiệu chuẩn lại nhiệt kế buồng sấy',
        assignedTo: 'Engineer Pham',
        dueDate: '2026-04-15',
      });
      expect(valid.isValid).toBe(true);
    });

    it('enforces closed-loop verification constraints on canCloseCAPA', () => {
      const baseDeviation: QualityDeviation = {
        id: 'dev_01',
        deviationNo: 'DEV-2026-0001',
        title: 'OOS Hàm lượng',
        source: 'OOS_TEST_RESULT',
        status: 'UNDER_INVESTIGATION',
        severity: 'MAJOR',
        description: 'Hàm lượng giảm',
        loggedBy: 'tester',
        loggedAt: '2026-03-30',
        version: 1,
        updatedAt: '2026-03-30',
        capaItems: [],
      };

      const qaUser = { role: 'QA' };
      const nonQAUser = { role: 'OPERATOR' };

      // Non-QA user
      const checkNonQA = CAPARules.canCloseCAPA(
        baseDeviation,
        'Báo cáo thẩm định hiệu quả đã vượt qua 3 lô liên tiếp',
        nonQAUser
      );
      expect(checkNonQA.allowed).toBe(false);
      expect(checkNonQA.reason).toContain('Chỉ Trưởng phòng QA hoặc Quản trị viên');

      // Short evidence (< 20 chars)
      const checkShortEvidence = CAPARules.canCloseCAPA(baseDeviation, 'Đã xong tốt.', qaUser);
      expect(checkShortEvidence.allowed).toBe(false);
      expect(checkShortEvidence.reason).toContain('tối thiểu 20 ký tự');

      // No capa items
      const checkNoItems = CAPARules.canCloseCAPA(
        baseDeviation,
        'Báo cáo thẩm định hiệu quả đã vượt qua 3 lô liên tiếp đạt yêu cầu.',
        qaUser
      );
      expect(checkNoItems.allowed).toBe(false);
      expect(checkNoItems.reason).toContain('chưa có hành động khắc phục/phòng ngừa nào');

      // Incomplete items
      const devWithPending: QualityDeviation = {
        ...baseDeviation,
        capaItems: [
          {
            id: 'capa_01',
            type: 'CORRECTIVE',
            action: 'Hiệu chuẩn cảm biến',
            responsible: 'Pham',
            deadline: '2026-04-10',
            status: 'PENDING',
          },
        ],
      };
      const checkPending = CAPARules.canCloseCAPA(
        devWithPending,
        'Báo cáo thẩm định hiệu quả đã vượt qua 3 lô liên tiếp đạt yêu cầu.',
        qaUser
      );
      expect(checkPending.allowed).toBe(false);
      expect(checkPending.reason).toContain(
        'vẫn còn hành động khắc phục/phòng ngừa chưa hoàn thành'
      );

      // Valid closed-loop CAPA
      const devCompleted: QualityDeviation = {
        ...baseDeviation,
        capaItems: [
          {
            id: 'capa_01',
            type: 'CORRECTIVE',
            action: 'Hiệu chuẩn cảm biến',
            responsible: 'Pham',
            deadline: '2026-04-10',
            status: 'COMPLETED',
          },
        ],
      };
      const checkValid = CAPARules.canCloseCAPA(
        devCompleted,
        'Báo cáo thẩm định hiệu quả đã vượt qua 3 lô liên tiếp đạt yêu cầu chất lượng 100%.',
        qaUser
      );
      expect(checkValid.allowed).toBe(true);
    });
  });

  describe('CAPAStateMachine', () => {
    it('manages action item lifecycle states', () => {
      const nextFromPending = CAPAStateMachine.getValidNextStates('PENDING');
      expect(nextFromPending).toContain('IN_PROGRESS');
      expect(nextFromPending).toContain('COMPLETED');

      const nextFromCompleted = CAPAStateMachine.getValidNextStates('COMPLETED');
      expect(nextFromCompleted).toContain('VERIFIED');

      const checkValid = CAPAStateMachine.canTransition('PENDING', 'IN_PROGRESS');
      expect(checkValid.allowed).toBe(true);

      const checkInvalid = CAPAStateMachine.canTransition('PENDING', 'VERIFIED');
      expect(checkInvalid.allowed).toBe(false);
    });
  });

  describe('Workflow Definitions', () => {
    it('defines canonical actions for CAPA', () => {
      expect(CAPA_ACTIONS.CREATE).toBe('CAPA_CREATE');
      expect(CAPA_ACTIONS.EXECUTE).toBe('CAPA_EXECUTE');
      expect(CAPA_ACTIONS.VERIFY).toBe('CAPA_VERIFY');
      expect(CAPA_ACTIONS.CLOSE).toBe('CAPA_CLOSE');
    });
  });

  describe('CAPAQueries', () => {
    it('queries and filters CAPA items across deviations', async () => {
      const mockDeviations: QualityDeviation[] = [
        {
          id: 'dev_01',
          deviationNo: 'DEV-01',
          title: 'Sự cố máy dập viên',
          source: 'MANUFACTURING',
          status: 'UNDER_INVESTIGATION',
          severity: 'MAJOR',
          description: 'Lệch khối lượng viên',
          loggedBy: 'op',
          loggedAt: '2026-03-30',
          version: 1,
          updatedAt: '2026-03-30',
          capaItems: [
            {
              id: 'c_01',
              type: 'CORRECTIVE',
              action: 'Thay bộ chày cối',
              responsible: 'Tech 1',
              deadline: '2026-04-05',
              status: 'PENDING',
            },
            {
              id: 'c_02',
              type: 'PREVENTIVE',
              action: 'Đào tạo lại thao tác máy dập',
              responsible: 'Lead 1',
              deadline: '2026-04-10',
              status: 'COMPLETED',
            },
          ],
        },
      ];

      const mockRepo: Partial<IDeviationRepository> = {
        findAll: vi.fn().mockResolvedValue(mockDeviations),
        findById: vi
          .fn()
          .mockImplementation(async (id) => (id === 'dev_01' ? mockDeviations[0] : null)),
      };

      const queries = new CAPAQueries(mockRepo as IDeviationRepository);

      const allItems = await queries.getAllCAPAItems();
      expect(allItems.length).toBe(2);
      expect(allItems[0].deviationNo).toBe('DEV-01');

      const byDev = await queries.getCAPAItemsByDeviationId('dev_01');
      expect(byDev.length).toBe(2);

      const pendingItems = await queries.getPendingCAPAItems();
      expect(pendingItems.length).toBe(1);
      expect(pendingItems[0].id).toBe('c_01');
    });
  });
});
