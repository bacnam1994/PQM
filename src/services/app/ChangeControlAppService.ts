/**
 * PQM V4 Platform - Change Control Application Service
 * Quản lý vòng đời Yêu cầu Thay đổi (Change Control) chuẩn GMP-WHO và ICH Q10
 * Ủy quyền 100% các đột biến dữ liệu qua ChangeControlWorkflowHandlers & WorkflowFacade.
 * Lưu trữ bền vững thông qua IChangeControlRepository (Firebase RTDB).
 */

import {
  ChangeRequest,
  CreateChangeRequestInput,
  ChangeStatus,
  FMEARiskAssessment,
  ChangeActionItem,
} from '../../types/changeControl';
import { IChangeControlRepository } from '../../repositories/IChangeControlRepository';
import { firebaseChangeControlRepository } from '../../repositories/firebase/FirebaseChangeControlRepository';
import { ChangeControlWorkflowHandlers } from '../../workflow/handlers/changeControlWorkflowHandlers';

export class ChangeControlAppService {
  private records: ChangeRequest[] = [];
  private handlers: ChangeControlWorkflowHandlers;

  constructor(private repo: IChangeControlRepository = firebaseChangeControlRepository) {
    this.handlers = new ChangeControlWorkflowHandlers(this.repo);
    this.records = this.getInitialSampleData();
  }

  private getInitialSampleData(): ChangeRequest[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'cr_demo_01',
        crNo: 'CR-2026-0001',
        title: 'Nâng cấp quy trình hòa tan viên nén Paracetamol 500mg',
        category: 'MANUFACTURING_PROCESS',
        changeType: 'MAJOR',
        status: 'IMPLEMENTATION',
        productId: 'prod_para_500',
        productName: 'Viên nén Paracetamol 500mg',
        justification:
          'Rút ngắn thời gian sấy tầng sôi từ 45 phút xuống 30 phút nhằm tối ưu hóa nhiệt phân hủy hoạt chất.',
        description:
          'Thay đổi thông số nhiệt độ khí vào từ 60°C lên 65°C và tăng lưu lượng gió 10%.',
        targetImplementationDate: '2026-06-30',
        proposedBy: 'production_lead@pqm.com',
        proposedAt: now,
        riskAssessment: {
          severity: 3,
          probability: 2,
          detectability: 2,
          rpn: 12,
          riskLevel: 'LOW',
          mitigationPlan:
            'Sản xuất thử nghiệm 03 lô pilot và kiểm nghiệm độ hòa tan tại phút thứ 15 và 30.',
        },
        actionItems: [
          {
            id: 'act_1',
            title: 'Soạn thảo phụ lục quy trình sản xuất cập nhật',
            responsible: 'qa_tech@pqm.com',
            deadline: '2026-03-01',
            status: 'COMPLETED',
            completedAt: now,
          },
          {
            id: 'act_2',
            title: 'Sản xuất và theo dõi độ ổn định 03 lô thẩm định',
            responsible: 'prod_lead@pqm.com',
            deadline: '2026-05-15',
            status: 'IN_PROGRESS',
          },
        ],
        version: 1,
        updatedAt: now,
      },
    ];
  }

  /**
   * Lấy toàn bộ danh sách Change Requests từ Repository
   */
  async getAll(): Promise<ChangeRequest[]> {
    try {
      const items = await this.repo.findAll();
      if (items && items.length > 0) {
        this.records = items;
        return [...items].sort((a, b) => (b.proposedAt || '').localeCompare(a.proposedAt || ''));
      }
    } catch (e) {
      console.warn('[ChangeControlAppService] Lỗi tải từ repository, chuyển sang local cache:', e);
    }
    return [...this.records].sort((a, b) => (b.proposedAt || '').localeCompare(a.proposedAt || ''));
  }

  /**
   * Lấy chi tiết một Change Request theo ID
   */
  async getById(id: string): Promise<ChangeRequest | null> {
    try {
      const item = await this.repo.findById(id);
      if (item) return item;
    } catch (e) {
      console.warn('[ChangeControlAppService] Lỗi tìm theo ID trên repository:', e);
    }
    return this.records.find((r) => r.id === id) || null;
  }

  /**
   * Khởi tạo Change Request mới qua Workflow
   */
  async createChangeRequest(
    input: CreateChangeRequestInput,
    currentUser: { email?: string }
  ): Promise<ChangeRequest> {
    const newCR = await this.handlers.handleCreate(input, currentUser, this.records.length);
    this.records.unshift(newCR);
    return newCR;
  }

  /**
   * Cập nhật đánh giá rủi ro FMEA qua Workflow
   */
  async assessFMEARisk(
    id: string,
    fmea: Omit<FMEARiskAssessment, 'rpn' | 'riskLevel'>,
    currentUser: { email?: string }
  ): Promise<ChangeRequest> {
    const cachedCR = this.records.find((r) => r.id === id);
    const updatedCR = await this.handlers.handleAssessFMEARisk(id, fmea, currentUser, cachedCR);
    const index = this.records.findIndex((r) => r.id === id);
    if (index >= 0) {
      this.records[index] = updatedCR;
    }
    return updatedCR;
  }

  /**
   * Thêm hành động triển khai vào kế hoạch thay đổi qua Workflow
   */
  async addActionItem(
    id: string,
    item: Omit<ChangeActionItem, 'id' | 'status'> & {
      status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    },
    currentUser: { email?: string }
  ): Promise<ChangeRequest> {
    const cachedCR = this.records.find((r) => r.id === id);
    const updatedCR = await this.handlers.handleAddActionItem(id, item, currentUser, cachedCR);
    const index = this.records.findIndex((r) => r.id === id);
    if (index >= 0) {
      this.records[index] = updatedCR;
    }
    return updatedCR;
  }

  /**
   * Hoàn thành một hành động thay đổi qua Workflow
   */
  async completeActionItem(
    id: string,
    actionId: string,
    currentUser: { email?: string }
  ): Promise<ChangeRequest> {
    const cachedCR = this.records.find((r) => r.id === id);
    const updatedCR = await this.handlers.handleCompleteActionItem(
      id,
      actionId,
      currentUser,
      cachedCR
    );
    const index = this.records.findIndex((r) => r.id === id);
    if (index >= 0) {
      this.records[index] = updatedCR;
    }
    return updatedCR;
  }

  /**
   * Chuyển trạng thái quy trình thay đổi chuẩn GMP qua Workflow
   */
  async updateStatus(
    id: string,
    newStatus: ChangeStatus,
    currentUser: { email?: string; role?: string | null; isAdmin?: boolean },
    notes?: string
  ): Promise<ChangeRequest> {
    const cachedCR = this.records.find((r) => r.id === id);
    const updatedCR = await this.handlers.handleUpdateStatus(
      id,
      newStatus,
      currentUser,
      notes,
      cachedCR
    );
    const index = this.records.findIndex((r) => r.id === id);
    if (index >= 0) {
      this.records[index] = updatedCR;
    }
    return updatedCR;
  }
}

export const changeControlAppService = new ChangeControlAppService();
