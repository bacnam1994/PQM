/**
 * PQM V4 Platform - Change Control Application Service
 * Quản lý vòng đời Yêu cầu Thay đổi (Change Control) chuẩn GMP-WHO và ICH Q10
 */

import { 
  ChangeRequest, CreateChangeRequestInput, ChangeStatus, 
  FMEARiskAssessment, ChangeActionItem 
} from '../../types/changeControl';
import { generateId } from '../../utils';
import { nextVersion } from '../../utils/concurrency';
import { logAuditAction } from '../auditService';
import { ApprovalWorkflowService } from './ApprovalWorkflowService';

const STORAGE_KEY = 'PQM_CHANGE_CONTROL_RECORDS';

export class ChangeControlAppService {
  private records: ChangeRequest[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.records = JSON.parse(raw);
      } else {
        this.records = this.getInitialSampleData();
        this.saveToStorage();
      }
    } catch {
      this.records = this.getInitialSampleData();
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch {
      // Bỏ qua nếu lỗi quota
    }
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
        justification: 'Rút ngắn thời gian sấy tầng sôi từ 45 phút xuống 30 phút nhằm tối ưu hóa nhiệt phân hủy hoạt chất.',
        description: 'Thay đổi thông số nhiệt độ khí vào từ 60°C lên 65°C và tăng lưu lượng gió 10%.',
        targetImplementationDate: '2026-06-30',
        proposedBy: 'production_lead@pqm.com',
        proposedAt: now,
        riskAssessment: {
          severity: 3,
          probability: 2,
          detectability: 2,
          rpn: 12,
          riskLevel: 'LOW',
          mitigationPlan: 'Sản xuất thử nghiệm 03 lô pilot và kiểm nghiệm độ hòa tan tại phút thứ 15 và 30.'
        },
        actionItems: [
          {
            id: 'act_1',
            title: 'Soạn thảo phụ lục quy trình sản xuất cập nhật',
            responsible: 'qa_tech@pqm.com',
            deadline: '2026-03-01',
            status: 'COMPLETED',
            completedAt: now
          },
          {
            id: 'act_2',
            title: 'Sản xuất và theo dõi độ ổn định 03 lô thẩm định',
            responsible: 'prod_lead@pqm.com',
            deadline: '2026-05-15',
            status: 'IN_PROGRESS'
          }
        ],
        version: 1,
        updatedAt: now
      }
    ];
  }

  /**
   * Lấy toàn bộ danh sách Change Requests
   */
  async getAll(): Promise<ChangeRequest[]> {
    return [...this.records].sort((a, b) => (b.proposedAt || '').localeCompare(a.proposedAt || ''));
  }

  /**
   * Lấy chi tiết một Change Request theo ID
   */
  async getById(id: string): Promise<ChangeRequest | null> {
    return this.records.find(r => r.id === id) || null;
  }

  /**
   * Khởi tạo Change Request mới
   */
  async createChangeRequest(
    input: CreateChangeRequestInput, 
    currentUser: { email?: string }
  ): Promise<ChangeRequest> {
    const id = generateId('cr');
    const now = new Date();
    const year = now.getFullYear();
    const count = this.records.length + 1;
    const crNo = `CR-${year}-${count.toString().padStart(4, '0')}`;

    const newCR: ChangeRequest = {
      id,
      crNo,
      title: input.title,
      category: input.category,
      changeType: input.changeType,
      status: 'DRAFT',
      productId: input.productId,
      productName: input.productName,
      tccsId: input.tccsId,
      tccsCode: input.tccsCode,
      justification: input.justification,
      description: input.description,
      targetImplementationDate: input.targetImplementationDate,
      proposedBy: currentUser?.email || 'SYSTEM',
      proposedAt: now.toISOString(),
      actionItems: [],
      version: 1,
      updatedAt: now.toISOString()
    };

    this.records.unshift(newCR);
    this.saveToStorage();

    logAuditAction({
      action: 'CREATE',
      collection: 'DEVIATIONS',
      documentId: id,
      details: `Khởi tạo Yêu cầu Thay đổi GMP: ${crNo} (${input.changeType}) - Nhóm: ${input.category}`,
      performedBy: currentUser?.email || 'SYSTEM'
    });

    return newCR;
  }

  /**
   * Cập nhật đánh giá rủi ro FMEA
   */
  async assessFMEARisk(
    id: string,
    fmea: Omit<FMEARiskAssessment, 'rpn' | 'riskLevel'>,
    currentUser: { email?: string }
  ): Promise<ChangeRequest> {
    const cr = await this.getById(id);
    if (!cr) throw new Error(`Không tìm thấy Change Request: ${id}`);

    const rpn = fmea.severity * fmea.probability * fmea.detectability;
    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 
      rpn >= 60 ? 'HIGH' : rpn >= 25 ? 'MEDIUM' : 'LOW';

    const updatedAssessment: FMEARiskAssessment = {
      ...fmea,
      rpn,
      riskLevel
    };

    cr.riskAssessment = updatedAssessment;
    cr.status = cr.status === 'DRAFT' ? 'IMPACT_ASSESSMENT' : cr.status;
    cr.version = nextVersion(cr.version);
    cr.updatedAt = new Date().toISOString();

    this.saveToStorage();

    logAuditAction({
      action: 'UPDATE',
      collection: 'DEVIATIONS',
      documentId: id,
      details: `Cập nhật FMEA Risk Assessment cho ${cr.crNo}: RPN=${rpn} (${riskLevel})`,
      performedBy: currentUser?.email || 'SYSTEM'
    });

    return cr;
  }

  /**
   * Thêm hành động triển khai vào kế hoạch thay đổi
   */
  async addActionItem(
    id: string,
    item: Omit<ChangeActionItem, 'id' | 'status'> & { status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' },
    currentUser: { email?: string }
  ): Promise<ChangeRequest> {
    const cr = await this.getById(id);
    if (!cr) throw new Error(`Không tìm thấy Change Request: ${id}`);

    const newItem: ChangeActionItem = {
      ...item,
      id: generateId('cr_act'),
      status: item.status || 'PENDING'
    };

    cr.actionItems = [...(cr.actionItems || []), newItem];
    cr.version = nextVersion(cr.version);
    cr.updatedAt = new Date().toISOString();

    this.saveToStorage();

    logAuditAction({
      action: 'UPDATE',
      collection: 'DEVIATIONS',
      documentId: id,
      details: `Thêm hành động thay đổi vào ${cr.crNo}: ${newItem.title} (Phụ trách: ${newItem.responsible})`,
      performedBy: currentUser?.email || 'SYSTEM'
    });

    return cr;
  }

  /**
   * Hoàn thành một hành động thay đổi
   */
  async completeActionItem(
    id: string,
    actionId: string,
    currentUser: { email?: string }
  ): Promise<ChangeRequest> {
    const cr = await this.getById(id);
    if (!cr) throw new Error(`Không tìm thấy Change Request: ${id}`);

    cr.actionItems = (cr.actionItems || []).map(act => {
      if (act.id === actionId) {
        return {
          ...act,
          status: 'COMPLETED' as const,
          completedAt: new Date().toISOString()
        };
      }
      return act;
    });

    cr.version = nextVersion(cr.version);
    cr.updatedAt = new Date().toISOString();

    this.saveToStorage();

    logAuditAction({
      action: 'UPDATE',
      collection: 'DEVIATIONS',
      documentId: id,
      details: `Hoàn tất hành động ${actionId} trong ${cr.crNo}`,
      performedBy: currentUser?.email || 'SYSTEM'
    });

    return cr;
  }

  /**
   * Chuyển trạng thái quy trình thay đổi chuẩn GMP
   */
  async updateStatus(
    id: string,
    newStatus: ChangeStatus,
    currentUser: { email?: string; role?: string | null; isAdmin?: boolean },
    notes?: string
  ): Promise<ChangeRequest> {
    const cr = await this.getById(id);
    if (!cr) throw new Error(`Không tìm thấy Change Request: ${id}`);

    // Kiểm tra quy định khi đóng thay đổi
    if (newStatus === 'CLOSED') {
      const isAuthorized = currentUser?.isAdmin || currentUser?.role === 'QA' || currentUser?.role === 'ADMIN';
      if (!isAuthorized) {
        throw new Error('Từ chối quyền: Chỉ Quản lý QA hoặc Quản trị viên mới có thẩm quyền Đóng (Close) Change Request.');
      }

      // Kiểm tra tất cả hành động đã hoàn tất chưa
      const hasUnfinished = (cr.actionItems || []).some(a => a.status !== 'COMPLETED');
      if (hasUnfinished) {
        throw new Error('Không thể đóng thay đổi: Vẫn còn các hành động trong kế hoạch chưa hoàn thành.');
      }

      cr.closedBy = currentUser?.email || 'QA_ADMIN';
      cr.closedAt = new Date().toISOString();
      cr.closureNotes = notes || 'Đã thẩm tra tính hiệu quả và đóng thay đổi theo chuẩn GMP.';
    }

    if (newStatus === 'APPROVED') {
      cr.approvedBy = currentUser?.email || 'QA_MANAGER';
      cr.approvedAt = new Date().toISOString();
    }

    cr.status = newStatus;
    cr.version = nextVersion(cr.version);
    cr.updatedAt = new Date().toISOString();

    this.saveToStorage();

    logAuditAction({
      action: 'UPDATE',
      collection: 'DEVIATIONS',
      documentId: id,
      details: `Chuyển trạng thái Change Request ${cr.crNo}: -> ${newStatus}${notes ? ` (${notes})` : ''}`,
      performedBy: currentUser?.email || 'SYSTEM'
    });

    return cr;
  }
}

export const changeControlAppService = new ChangeControlAppService();
