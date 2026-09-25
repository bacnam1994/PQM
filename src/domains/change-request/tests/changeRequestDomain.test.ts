import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ChangeRequestRules,
  ChangeRequestStateMachine,
  ChangeControlAppService,
  ChangeControlQueries,
  CHANGE_REQUEST_ACTIONS,
  CHANGE_STATUS_LABELS,
  ChangeRequest,
  IChangeControlRepository,
} from '../index';

describe('VS-10: Change Request Domain (ICH Q10 & GMP-WHO)', () => {
  describe('ChangeRequestRules & FMEA Risk Matrix', () => {
    it('xác thực thông tin đầu vào khi khởi tạo Change Request', () => {
      const valid = ChangeRequestRules.validateCreateInput({
        title: 'Thay đổi bao bì sơ cấp chai HDPE',
        category: 'PACKAGING',
        changeType: 'MINOR',
        justification: 'Cải tiến độ kín khít',
        description: 'Thay đổi nhà cung ứng nắp vặn có đệm seal',
        targetImplementationDate: '2026-10-01',
      });
      expect(valid.isValid).toBe(true);

      const invalidTitle = ChangeRequestRules.validateCreateInput({
        title: '',
        category: 'PACKAGING',
        changeType: 'MINOR',
        justification: 'Lý do',
        description: 'Mô tả',
        targetImplementationDate: '2026-10-01',
      });
      expect(invalidTitle.isValid).toBe(false);
      expect(invalidTitle.error).toContain('Tiêu đề');

      const invalidDesc = ChangeRequestRules.validateCreateInput({
        title: 'Thay đổi',
        category: 'PACKAGING',
        changeType: 'MINOR',
        justification: 'Lý do',
        description: '   ',
        targetImplementationDate: '2026-10-01',
      });
      expect(invalidDesc.isValid).toBe(false);
      expect(invalidDesc.error).toContain('Mô tả chi tiết');
    });

    it('tính toán điểm RPN và phân loại cấp độ rủi ro FMEA chính xác', () => {
      // LOW: RPN < 25
      const lowRisk = ChangeRequestRules.calculateFMEARisk({
        severity: 2,
        probability: 2,
        detectability: 3,
      });
      expect(lowRisk.rpn).toBe(12);
      expect(lowRisk.riskLevel).toBe('LOW');

      // MEDIUM: 25 <= RPN < 60
      const medRisk = ChangeRequestRules.calculateFMEARisk({
        severity: 3,
        probability: 3,
        detectability: 3,
      });
      expect(medRisk.rpn).toBe(27);
      expect(medRisk.riskLevel).toBe('MEDIUM');

      // HIGH: RPN >= 60
      const highRisk = ChangeRequestRules.calculateFMEARisk({
        severity: 4,
        probability: 4,
        detectability: 4,
        mitigationPlan: 'Thực hiện thẩm định 03 lô',
      });
      expect(highRisk.rpn).toBe(64);
      expect(highRisk.riskLevel).toBe('HIGH');
      expect(highRisk.mitigationPlan).toBe('Thực hiện thẩm định 03 lô');
    });

    it('kiểm tra điều kiện đóng Change Request (thẩm quyền và hoàn thành action)', () => {
      const mockCR: ChangeRequest = {
        id: 'cr_001',
        crNo: 'CR-2026-0001',
        title: 'Thay đổi thiết bị dập viên',
        category: 'EQUIPMENT',
        changeType: 'MAJOR',
        status: 'IMPLEMENTATION',
        justification: 'Tăng công suất',
        description: 'Lắp máy dập viên 37 chày',
        targetImplementationDate: '2026-11-01',
        proposedBy: 'prod@v-biotech.com',
        proposedAt: new Date().toISOString(),
        actionItems: [
          {
            id: 'act_1',
            title: 'IQ/OQ/PQ máy dập viên',
            responsible: 'qa@v-biotech.com',
            deadline: '2026-10-15',
            status: 'PENDING',
          },
        ],
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      // 1. Không phải QA hoặc Admin -> Bị từ chối
      const nonQaCheck = ChangeRequestRules.canCloseChangeRequest(mockCR, { role: 'OPERATOR' });
      expect(nonQaCheck.allowed).toBe(false);
      expect(nonQaCheck.reason).toContain('Từ chối quyền');

      // 2. QA nhưng còn hành động chưa hoàn thành -> Bị từ chối
      const pendingActionCheck = ChangeRequestRules.canCloseChangeRequest(mockCR, { role: 'QA' });
      expect(pendingActionCheck.allowed).toBe(false);
      expect(pendingActionCheck.reason).toContain('Vẫn còn các hành động');

      // 3. QA và tất cả hành động đã hoàn thành -> Hợp lệ
      mockCR.actionItems![0].status = 'COMPLETED';
      const validCheck = ChangeRequestRules.canCloseChangeRequest(mockCR, { role: 'QA' });
      expect(validCheck.allowed).toBe(true);
    });
  });

  describe('ChangeRequestStateMachine', () => {
    it('cho phép các chuyển đổi trạng thái hợp lệ', () => {
      expect(ChangeRequestStateMachine.canTransition('DRAFT', 'IMPACT_ASSESSMENT').allowed).toBe(
        true
      );
      expect(ChangeRequestStateMachine.canTransition('DRAFT', 'REJECTED').allowed).toBe(true);
      expect(
        ChangeRequestStateMachine.canTransition('IMPACT_ASSESSMENT', 'QA_REVIEW').allowed
      ).toBe(true);
      expect(ChangeRequestStateMachine.canTransition('QA_REVIEW', 'APPROVED').allowed).toBe(true);
      expect(ChangeRequestStateMachine.canTransition('APPROVED', 'IMPLEMENTATION').allowed).toBe(
        true
      );
      expect(ChangeRequestStateMachine.canTransition('IMPLEMENTATION', 'CLOSED').allowed).toBe(
        true
      );
    });

    it('từ chối chuyển đổi trạng thái không hợp lệ', () => {
      const res = ChangeRequestStateMachine.canTransition('CLOSED', 'DRAFT');
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('không hợp lệ');
    });

    it('trả về danh sách trạng thái tiếp theo hợp lệ', () => {
      const nextStates = ChangeRequestStateMachine.getValidNextStates('DRAFT');
      expect(nextStates).toContain('IMPACT_ASSESSMENT');
      expect(nextStates).toContain('QA_REVIEW');
    });
  });

  describe('ChangeControlAppService & Workflow Integration', () => {
    let service: ChangeControlAppService;

    beforeEach(() => {
      localStorage.clear();
      service = new ChangeControlAppService();
    });

    it('tạo Change Request mới thành công và sinh mã CR-YYYY-XXXX', async () => {
      const cr = await service.createChangeRequest(
        {
          title: 'Thay đổi nhà cung ứng tá dược dính PVP K30',
          category: 'RAW_MATERIAL',
          changeType: 'MINOR',
          justification: 'Đảm bảo nguồn cung ứng ổn định',
          description: 'Bổ sung nhà cung cấp BASF',
          targetImplementationDate: '2026-08-01',
        },
        { email: 'qa@v-biotech.com' }
      );

      expect(cr.crNo).toMatch(/^CR-\d{4}-\d{4}$/);
      expect(cr.status).toBe('DRAFT');
      expect(cr.category).toBe('RAW_MATERIAL');
      expect(cr.version).toBe(1);
    });

    it('đánh giá rủi ro FMEA cập nhật điểm RPN và chuyển trạng thái sang IMPACT_ASSESSMENT', async () => {
      const cr = await service.createChangeRequest(
        {
          title: 'Thay đổi quy trình bao phim',
          category: 'MANUFACTURING_PROCESS',
          changeType: 'MAJOR',
          justification: 'Khắc phục hiện tượng dính viên',
          description: 'Tăng nhiệt độ khí thổi vào nồi bao',
          targetImplementationDate: '2026-09-01',
        },
        { email: 'prod@v-biotech.com' }
      );

      const updated = await service.assessFMEARisk(
        cr.id,
        {
          severity: 3,
          probability: 4,
          detectability: 3,
          mitigationPlan: 'Bao thử nghiệm 01 lô pilot',
        },
        { email: 'qa@v-biotech.com' }
      );

      expect(updated.riskAssessment?.rpn).toBe(36);
      expect(updated.riskAssessment?.riskLevel).toBe('MEDIUM');
      expect(updated.status).toBe('IMPACT_ASSESSMENT');
    });

    it('thêm action item và đánh dấu hoàn thành', async () => {
      const cr = await service.createChangeRequest(
        {
          title: 'Thay đổi thông số đóng nang',
          category: 'MANUFACTURING_PROCESS',
          changeType: 'MINOR',
          justification: 'Ổn định khối lượng trung bình',
          description: 'Chỉnh độ sâu chày đầm',
          targetImplementationDate: '2026-07-01',
        },
        { email: 'prod@v-biotech.com' }
      );

      const withAction = await service.addActionItem(
        cr.id,
        {
          title: 'Kiểm tra khối lượng 20 viên sau chỉnh máy',
          responsible: 'qc@v-biotech.com',
          deadline: '2026-06-25',
        },
        { email: 'prod@v-biotech.com' }
      );

      expect(withAction.actionItems).toHaveLength(1);
      const actionId = withAction.actionItems![0].id;
      expect(withAction.actionItems![0].status).toBe('PENDING');

      const completed = await service.completeActionItem(cr.id, actionId, {
        email: 'qc@v-biotech.com',
      });
      expect(completed.actionItems![0].status).toBe('COMPLETED');
      expect(completed.actionItems![0].completedAt).toBeDefined();
    });

    it('cho phép QA đóng Change Request sau khi hoàn tất các hành động', async () => {
      const cr = await service.createChangeRequest(
        {
          title: 'Cập nhật tiêu chuẩn kiểm nghiệm',
          category: 'SPECIFICATION',
          changeType: 'MINOR',
          justification: 'Cập nhật theo Dược điển Việt Nam V',
          description: 'Điều chỉnh giới hạn tro toàn phần',
          targetImplementationDate: '2026-08-01',
        },
        { email: 'qc@v-biotech.com' }
      );

      const withAction = await service.addActionItem(
        cr.id,
        {
          title: 'Ban hành TCCS phiên bản mới',
          responsible: 'qa@v-biotech.com',
          deadline: '2026-07-15',
        },
        { email: 'qa@v-biotech.com' }
      );

      await service.completeActionItem(cr.id, withAction.actionItems![0].id, {
        email: 'qa@v-biotech.com',
      });

      const closed = await service.updateStatus(
        cr.id,
        'CLOSED',
        { email: 'qa_manager@v-biotech.com', role: 'QA' },
        'Đã ban hành TCCS và đào tạo nhân sự'
      );

      expect(closed.status).toBe('CLOSED');
      expect(closed.closedBy).toBe('qa_manager@v-biotech.com');
      expect(closed.closureNotes).toContain('Đã ban hành TCCS');
    });
  });

  describe('ChangeControlQueries', () => {
    let mockRepo: IChangeControlRepository;
    let queries: ChangeControlQueries;

    const mockRecords: ChangeRequest[] = [
      {
        id: 'cr_1',
        crNo: 'CR-2026-0001',
        title: 'Thay đổi 1',
        category: 'FORMULA',
        changeType: 'MAJOR',
        status: 'DRAFT',
        productId: 'prod_1',
        justification: 'Lý do 1',
        description: 'Mô tả 1',
        targetImplementationDate: '2026-10-01',
        proposedBy: 'qa@v-biotech.com',
        proposedAt: '2026-01-01T00:00:00Z',
        version: 1,
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'cr_2',
        crNo: 'CR-2026-0002',
        title: 'Thay đổi 2',
        category: 'PACKAGING',
        changeType: 'MINOR',
        status: 'APPROVED',
        productId: 'prod_2',
        justification: 'Lý do 2',
        description: 'Mô tả 2',
        targetImplementationDate: '2026-11-01',
        proposedBy: 'qc@v-biotech.com',
        proposedAt: '2026-02-01T00:00:00Z',
        version: 1,
        updatedAt: '2026-02-01T00:00:00Z',
      },
    ];

    beforeEach(() => {
      mockRepo = {
        findAll: vi.fn().mockResolvedValue(mockRecords),
        findById: vi
          .fn()
          .mockImplementation((id: string) =>
            Promise.resolve(mockRecords.find((r) => r.id === id) || null)
          ),
        findByStatus: vi
          .fn()
          .mockImplementation((status: string) =>
            Promise.resolve(mockRecords.filter((r) => r.status === status))
          ),
        findByProductId: vi
          .fn()
          .mockImplementation((prodId: string) =>
            Promise.resolve(mockRecords.filter((r) => r.productId === prodId))
          ),
        save: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      } as any;
      queries = new ChangeControlQueries(mockRepo);
    });

    it('lấy toàn bộ danh sách sắp xếp theo ngày đề xuất mới nhất', async () => {
      const all = await queries.getAll();
      expect(all).toHaveLength(2);
      expect(all[0].id).toBe('cr_2'); // 2026-02-01 mới hơn 2026-01-01
    });

    it('lấy chi tiết theo ID', async () => {
      const cr = await queries.getById('cr_1');
      expect(cr?.crNo).toBe('CR-2026-0001');
    });

    it('lấy theo trạng thái', async () => {
      const approved = await queries.getByStatus('APPROVED');
      expect(approved).toHaveLength(1);
      expect(approved[0].id).toBe('cr_2');
    });

    it('lấy theo productId', async () => {
      const prod1 = await queries.getByProductId('prod_1');
      expect(prod1).toHaveLength(1);
      expect(prod1[0].id).toBe('cr_1');
    });
  });

  describe('Workflow & Constants Metadata', () => {
    it('định nghĩa đầy đủ mã action cho Change Request workflow', () => {
      expect(CHANGE_REQUEST_ACTIONS.CREATE).toBe('CHANGE_REQUEST_CREATE');
      expect(CHANGE_REQUEST_ACTIONS.FMEA_ASSESS).toBe('CHANGE_REQUEST_FMEA_ASSESS');
      expect(CHANGE_REQUEST_ACTIONS.CLOSE).toBe('CHANGE_REQUEST_CLOSE');
    });

    it('định nghĩa nhãn trạng thái chính xác', () => {
      expect(CHANGE_STATUS_LABELS.DRAFT).toBe('Bản nháp');
      expect(CHANGE_STATUS_LABELS.CLOSED).toBe('Đã đóng');
    });
  });
});
