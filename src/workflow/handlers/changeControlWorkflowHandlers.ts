/**
 * CHANGE CONTROL WORKFLOW HANDLERS
 *
 * Handler xử lý nghiệp vụ cho phân hệ Quản lý Thay đổi (Change Control)
 * qua WorkflowFacade:
 * - CHANGE_REQUEST_CREATE
 * - CHANGE_REQUEST_FMEA_ASSESS
 * - CHANGE_REQUEST_ADD_ACTION
 * - CHANGE_REQUEST_COMPLETE_ACTION
 * - CHANGE_REQUEST_REVIEW
 * - CHANGE_REQUEST_APPROVE
 * - CHANGE_REQUEST_REJECT
 * - CHANGE_REQUEST_IMPLEMENT
 * - CHANGE_REQUEST_CLOSE
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
import { WorkflowFacade } from '../WorkflowFacade';
import { WorkflowActor, WorkflowActionId } from '../contracts/actions';
import { generateId } from '../../utils';
import { nextVersion } from '../../utils/concurrency';
import { logAuditAction } from '../../services/auditService';

export class ChangeControlWorkflowHandlers {
  constructor(private repo: IChangeControlRepository = firebaseChangeControlRepository) {}

  private toActor(currentUser: any): WorkflowActor {
    let rawRole = (currentUser?.role || '').toUpperCase().trim();
    if (!rawRole) {
      if (currentUser?.isAdmin) {
        rawRole = 'ADMIN';
      } else if (currentUser?.email?.includes('qa')) {
        rawRole = 'QA';
      } else if (currentUser?.email?.includes('qc')) {
        rawRole = 'QC';
      } else if (currentUser?.email?.includes('prod')) {
        rawRole = 'PRODUCTION';
      } else {
        rawRole = 'USER';
      }
    }

    return {
      id: currentUser?.id || currentUser?.uid || currentUser?.email || 'usr_unknown',
      name: currentUser?.displayName || currentUser?.name || currentUser?.email || 'Unknown User',
      role: rawRole,
      email: currentUser?.email || 'unknown@v-biotech.com',
      isAdmin: currentUser?.isAdmin || rawRole === 'ADMIN',
    } as any;
  }

  async findById(id: string): Promise<ChangeRequest | null> {
    try {
      return await this.repo.findById(id);
    } catch (e) {
      console.warn('[ChangeControlWorkflowHandlers] findById fallback error:', e);
      return null;
    }
  }

  async findAll(): Promise<ChangeRequest[]> {
    try {
      return await this.repo.findAll();
    } catch (e) {
      console.warn('[ChangeControlWorkflowHandlers] findAll fallback error:', e);
      return [];
    }
  }

  /**
   * Khởi tạo Change Request mới qua Workflow Kernel
   */
  async handleCreate(
    input: CreateChangeRequestInput,
    currentUser: any,
    existingCount = 0
  ): Promise<ChangeRequest> {
    const actor = this.toActor(currentUser);
    const id = generateId('cr');
    const now = new Date();
    const year = now.getFullYear();
    const crNo = `CR-${year}-${(existingCount + 1).toString().padStart(4, '0')}`;

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
      updatedAt: now.toISOString(),
    };

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'CHANGE_REQUEST_CREATE',
        entityType: 'CHANGE_REQUEST',
        entityId: id,
        actor,
        payload: newCR,
        reason: `Khởi tạo Yêu cầu Thay đổi GMP: ${crNo} (${input.changeType}) - Nhóm: ${input.category}`,
      },
      async () => {
        try {
          await this.repo.save(newCR);
        } catch (e) {
          console.warn('[ChangeControlWorkflowHandlers] Lưu repo cảnh báo:', e);
        }

        logAuditAction({
          action: 'CREATE',
          collection: 'DEVIATIONS',
          documentId: id,
          details: `Khởi tạo Yêu cầu Thay đổi GMP: ${crNo} (${input.changeType}) - Nhóm: ${input.category}`,
          performedBy: currentUser?.email || 'SYSTEM',
        });

        return newCR;
      }
    );

    if (!execution.success) {
      throw new Error(
        execution.failureReason || 'Lỗi thực thi CHANGE_REQUEST_CREATE qua Workflow.'
      );
    }

    return execution.data!;
  }

  /**
   * Cập nhật đánh giá rủi ro FMEA qua Workflow Kernel
   */
  async handleAssessFMEARisk(
    id: string,
    fmea: Omit<FMEARiskAssessment, 'rpn' | 'riskLevel'>,
    currentUser: any,
    currentCR?: ChangeRequest
  ): Promise<ChangeRequest> {
    const cr = currentCR || (await this.findById(id));
    if (!cr) throw new Error(`Không tìm thấy Change Request: ${id}`);

    const rpn = fmea.severity * fmea.probability * fmea.detectability;
    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = rpn >= 60 ? 'HIGH' : rpn >= 25 ? 'MEDIUM' : 'LOW';

    const updatedAssessment: FMEARiskAssessment = {
      ...fmea,
      rpn,
      riskLevel,
    };

    const updatedCR: ChangeRequest = {
      ...cr,
      riskAssessment: updatedAssessment,
      status: cr.status === 'DRAFT' ? 'IMPACT_ASSESSMENT' : cr.status,
      version: nextVersion(cr.version),
      updatedAt: new Date().toISOString(),
    };

    const actor = this.toActor(currentUser);

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'CHANGE_REQUEST_FMEA_ASSESS',
        entityType: 'CHANGE_REQUEST',
        entityId: id,
        actor,
        payload: updatedCR,
        reason: `Cập nhật FMEA Risk Assessment cho ${cr.crNo}: RPN=${rpn} (${riskLevel})`,
      },
      async () => {
        try {
          await this.repo.update(updatedCR);
        } catch (e) {
          console.warn('[ChangeControlWorkflowHandlers] Lỗi update repository:', e);
        }

        logAuditAction({
          action: 'UPDATE',
          collection: 'DEVIATIONS',
          documentId: id,
          details: `Cập nhật FMEA Risk Assessment cho ${cr.crNo}: RPN=${rpn} (${riskLevel})`,
          performedBy: currentUser?.email || 'SYSTEM',
        });

        return updatedCR;
      }
    );

    if (!execution.success) {
      throw new Error(
        execution.failureReason || 'Lỗi thực thi CHANGE_REQUEST_FMEA_ASSESS qua Workflow.'
      );
    }

    return execution.data!;
  }

  /**
   * Thêm hành động triển khai vào kế hoạch thay đổi qua Workflow Kernel
   */
  async handleAddActionItem(
    id: string,
    item: Omit<ChangeActionItem, 'id' | 'status'> & {
      status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    },
    currentUser: any,
    currentCR?: ChangeRequest
  ): Promise<ChangeRequest> {
    const cr = currentCR || (await this.findById(id));
    if (!cr) throw new Error(`Không tìm thấy Change Request: ${id}`);

    const newItem: ChangeActionItem = {
      ...item,
      id: generateId('cr_act'),
      status: item.status || 'PENDING',
    };

    const updatedCR: ChangeRequest = {
      ...cr,
      actionItems: [...(cr.actionItems || []), newItem],
      version: nextVersion(cr.version),
      updatedAt: new Date().toISOString(),
    };

    const actor = this.toActor(currentUser);

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'CHANGE_REQUEST_ADD_ACTION',
        entityType: 'CHANGE_REQUEST',
        entityId: id,
        actor,
        payload: updatedCR,
        reason: `Thêm hành động thay đổi vào ${cr.crNo}: ${newItem.title} (Phụ trách: ${newItem.responsible})`,
      },
      async () => {
        try {
          await this.repo.update(updatedCR);
        } catch (e) {
          console.warn('[ChangeControlWorkflowHandlers] Lỗi update repository:', e);
        }

        logAuditAction({
          action: 'UPDATE',
          collection: 'DEVIATIONS',
          documentId: id,
          details: `Thêm hành động thay đổi vào ${cr.crNo}: ${newItem.title} (Phụ trách: ${newItem.responsible})`,
          performedBy: currentUser?.email || 'SYSTEM',
        });

        return updatedCR;
      }
    );

    if (!execution.success) {
      throw new Error(
        execution.failureReason || 'Lỗi thực thi CHANGE_REQUEST_ADD_ACTION qua Workflow.'
      );
    }

    return execution.data!;
  }

  /**
   * Hoàn thành một hành động thay đổi qua Workflow Kernel
   */
  async handleCompleteActionItem(
    id: string,
    actionId: string,
    currentUser: any,
    currentCR?: ChangeRequest
  ): Promise<ChangeRequest> {
    const cr = currentCR || (await this.findById(id));
    if (!cr) throw new Error(`Không tìm thấy Change Request: ${id}`);

    const updatedActions = (cr.actionItems || []).map((act) => {
      if (act.id === actionId) {
        return {
          ...act,
          status: 'COMPLETED' as const,
          completedAt: new Date().toISOString(),
        };
      }
      return act;
    });

    const updatedCR: ChangeRequest = {
      ...cr,
      actionItems: updatedActions,
      version: nextVersion(cr.version),
      updatedAt: new Date().toISOString(),
    };

    const actor = this.toActor(currentUser);

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'CHANGE_REQUEST_COMPLETE_ACTION',
        entityType: 'CHANGE_REQUEST',
        entityId: id,
        actor,
        payload: updatedCR,
        reason: `Hoàn tất hành động ${actionId} trong ${cr.crNo}`,
      },
      async () => {
        try {
          await this.repo.update(updatedCR);
        } catch (e) {
          console.warn('[ChangeControlWorkflowHandlers] Lỗi update repository:', e);
        }

        logAuditAction({
          action: 'UPDATE',
          collection: 'DEVIATIONS',
          documentId: id,
          details: `Hoàn tất hành động ${actionId} trong ${cr.crNo}`,
          performedBy: currentUser?.email || 'SYSTEM',
        });

        return updatedCR;
      }
    );

    if (!execution.success) {
      throw new Error(
        execution.failureReason || 'Lỗi thực thi CHANGE_REQUEST_COMPLETE_ACTION qua Workflow.'
      );
    }

    return execution.data!;
  }

  /**
   * Chuyển trạng thái quy trình thay đổi chuẩn GMP qua Workflow Kernel
   */
  async handleUpdateStatus(
    id: string,
    newStatus: ChangeStatus,
    currentUser: { email?: string; role?: string | null; isAdmin?: boolean },
    notes?: string,
    currentCR?: ChangeRequest
  ): Promise<ChangeRequest> {
    const cr = currentCR || (await this.findById(id));
    if (!cr) throw new Error(`Không tìm thấy Change Request: ${id}`);

    if (newStatus === 'CLOSED') {
      const isAuthorized =
        currentUser?.isAdmin || currentUser?.role === 'QA' || currentUser?.role === 'ADMIN';
      if (!isAuthorized) {
        throw new Error(
          'Từ chối quyền: Chỉ Quản lý QA hoặc Quản trị viên mới có thẩm quyền Đóng (Close) Change Request.'
        );
      }

      const hasUnfinished = (cr.actionItems || []).some((a) => a.status !== 'COMPLETED');
      if (hasUnfinished) {
        throw new Error(
          'Không thể đóng thay đổi: Vẫn còn các hành động trong kế hoạch chưa hoàn thành.'
        );
      }
    }

    let actionId: WorkflowActionId = 'CHANGE_REQUEST_IMPLEMENT';
    if (newStatus === 'CLOSED') {
      actionId = 'CHANGE_REQUEST_CLOSE';
    } else if (newStatus === 'APPROVED') {
      actionId = 'CHANGE_REQUEST_APPROVE';
    } else if (newStatus === 'REJECTED') {
      actionId = 'CHANGE_REQUEST_REJECT';
    } else if (newStatus === 'QA_REVIEW') {
      actionId = 'CHANGE_REQUEST_REVIEW';
    }

    const updatedCR: ChangeRequest = {
      ...cr,
      status: newStatus,
      version: nextVersion(cr.version),
      updatedAt: new Date().toISOString(),
    };

    if (newStatus === 'CLOSED') {
      updatedCR.closedBy = currentUser?.email || 'QA_ADMIN';
      updatedCR.closedAt = new Date().toISOString();
      updatedCR.closureNotes =
        notes || 'Đã thẩm tra tính hiệu quả và đóng thay đổi theo chuẩn GMP.';
    }

    if (newStatus === 'APPROVED') {
      updatedCR.approvedBy = currentUser?.email || 'QA_MANAGER';
      updatedCR.approvedAt = new Date().toISOString();
    }

    const actor = this.toActor(currentUser);

    const effectiveSignature = {
      signerName: actor.email || 'QA User',
      signerRole: actor.role,
      signedAt: new Date().toISOString(),
      meaning: `Chuyển trạng thái thay đổi sang ${newStatus}`,
      signatureHash: 'CR_AUTO_SIGNATURE_HASH',
    };

    const execution = await WorkflowFacade.dispatch(
      {
        actionId,
        entityType: 'CHANGE_REQUEST',
        entityId: id,
        actor,
        payload: updatedCR,
        reason: notes || `Chuyển trạng thái Change Request ${cr.crNo}: -> ${newStatus}`,
        signature: effectiveSignature,
      },
      async () => {
        try {
          await this.repo.update(updatedCR);
        } catch (e) {
          console.warn('[ChangeControlWorkflowHandlers] Lỗi update repository:', e);
        }

        logAuditAction({
          action: 'UPDATE',
          collection: 'DEVIATIONS',
          documentId: id,
          details: `Chuyển trạng thái Change Request ${cr.crNo}: -> ${newStatus}${notes ? ` (${notes})` : ''}`,
          performedBy: currentUser?.email || 'SYSTEM',
        });

        return updatedCR;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || `Lỗi thực thi ${actionId} qua Workflow.`);
    }

    return execution.data!;
  }
}

export const changeControlWorkflowHandlers = new ChangeControlWorkflowHandlers();
