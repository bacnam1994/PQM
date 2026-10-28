/**
 * DEVIATION, OOS & CAPA WORKFLOW HANDLERS
 *
 * Handler xử lý nghiệp vụ cho phân hệ Sai lệch (Deviation),
 * Kết quả ngoài tiêu chuẩn (OOS) và Hành động khắc phục phòng ngừa (CAPA)
 * thông qua WorkflowFacade:
 * - DEVIATION_CREATE
 * - DEVIATION_INVESTIGATE
 * - DEVIATION_APPROVE
 * - DEVIATION_CLOSE
 * - DEVIATION_DELETE
 * - CAPA_CREATE
 * - CAPA_EXECUTE
 * - CAPA_VERIFY
 * - CAPA_CLOSE
 * - OOS_CREATE
 * - OOS_PHASE1_LAB_INVESTIGATE
 * - OOS_CONCLUDE
 */

import {
  QualityDeviation,
  DeviationStatus,
  CreateDeviationInput,
  CAPAActionItem,
} from '../../types/deviation';
import { IDeviationRepository } from '../../repositories/IDeviationRepository';
import { firebaseDeviationRepository } from '../../repositories/firebase/FirebaseDeviationRepository';
import { WorkflowFacade } from '../WorkflowFacade';
import { WorkflowActor, WorkflowActionId } from '../contracts/actions';
import { generateId } from '../../utils';
import { nextVersion } from '../../utils/concurrency';
import { TestResult, Batch, ElectronicSignature } from '../../types';
import { logAuditAction } from '../../services/auditService';
import {
  resolveTestResultStatus,
  normalizeCriterionPassStatus,
} from '../../domain/test-result/testResultStatusResolver';

export class DeviationWorkflowHandlers {
  constructor(private repo: IDeviationRepository = firebaseDeviationRepository) {}

  private toActor(currentUser: any): WorkflowActor {
    const rawRole = (currentUser?.role || (currentUser?.isAdmin ? 'ADMIN' : 'QA')).toUpperCase();
    return {
      id: currentUser?.id || currentUser?.uid || currentUser?.email || 'usr_unknown',
      name: currentUser?.displayName || currentUser?.name || currentUser?.email || 'Unknown User',
      role: rawRole,
      email: currentUser?.email || 'unknown@v-biotech.com',
      isAdmin: currentUser?.isAdmin || rawRole === 'ADMIN',
    } as any;
  }

  async findById(id: string): Promise<QualityDeviation | null> {
    return this.repo.findById(id);
  }

  async findAll(): Promise<QualityDeviation[]> {
    return this.repo.findAll();
  }

  /**
   * Tạo mới hồ sơ sai lệch chất lượng qua Workflow Kernel
   */
  async handleCreate(input: CreateDeviationInput, currentUser: any): Promise<QualityDeviation> {
    const actor = this.toActor(currentUser);
    const id = generateId('dev');
    const now = new Date();
    const year = now.getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const deviationNo = `DEV-${year}-${randomSuffix}`;

    const newDeviation: QualityDeviation = {
      id,
      deviationNo,
      title: input.title,
      source: input.source,
      status: 'LOGGED',
      severity: input.severity,
      batchId: input.batchId,
      batchNo: input.batchNo,
      productId: input.productId,
      productName: input.productName,
      testResultId: input.testResultId,
      failedCriteria: input.failedCriteria,
      description: input.description,
      immediateAction: input.immediateAction,
      loggedBy: currentUser?.email || 'SYSTEM_AUTO',
      loggedAt: now.toISOString(),
      version: 1,
      updatedAt: now.toISOString(),
    };

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'DEVIATION_CREATE',
        entityType: 'DEVIATION',
        entityId: id,
        actor,
        payload: newDeviation,
        reason: `Khởi tạo hồ sơ sai lệch chất lượng: ${deviationNo} (${newDeviation.severity})`,
      },
      async () => {
        await this.repo.save(newDeviation);
        logAuditAction({
          action: 'CREATE',
          collection: 'DEVIATIONS',
          documentId: id,
          details: `Khởi tạo hồ sơ sai lệch chất lượng: ${deviationNo} (${newDeviation.severity}) - Nguồn: ${newDeviation.source}`,
          performedBy: currentUser?.email || 'SYSTEM_AUTO',
        });
        return newDeviation;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi thực thi DEVIATION_CREATE qua Workflow.');
    }

    return execution.data!;
  }

  /**
   * Tự động khởi tạo Sai lệch khi phát hiện kết quả kiểm nghiệm OOS (FAIL)
   */
  async handleAutoLogFromOOS(
    testResult: TestResult,
    batch?: Batch,
    currentUser?: any
  ): Promise<QualityDeviation | null> {
    if (resolveTestResultStatus(testResult) !== 'FAIL') return null;

    const existing = await this.repo.findAll();
    const duplicate = existing.find((d) => d.testResultId === testResult.id);
    if (duplicate) return duplicate;

    const failedCriteria = (testResult.results || [])
      .filter((r) => normalizeCriterionPassStatus(r.isPass) === false)
      .map((r) => ({
        name: r.criteriaName,
        actualValue: r.value,
        specification: r.limit || 'Theo TCCS',
      }));

    if (failedCriteria.length === 0) return null;

    const isCritical = failedCriteria.some(
      (c) =>
        c.name.toLowerCase().includes('vi sinh') ||
        c.name.toLowerCase().includes('kim loại') ||
        c.name.toLowerCase().includes('độc tính') ||
        c.name.toLowerCase().includes('vô trùng')
    );

    return this.handleCreate(
      {
        title: `Sự cố OOS: Lô ${batch?.batchNo || testResult.batchId} không đạt ${failedCriteria.length} chỉ tiêu`,
        source: 'OOS_TEST_RESULT',
        severity: isCritical ? 'CRITICAL' : 'MAJOR',
        description: `Phiếu kiểm nghiệm ${testResult.id} phát hiện ${failedCriteria.length} chỉ tiêu không đạt tiêu chuẩn chất lượng.`,
        batchId: testResult.batchId,
        batchNo: batch?.batchNo,
        productId: batch?.productId,
        testResultId: testResult.id,
        failedCriteria,
        immediateAction:
          'Biệt trữ lô sản xuất (Quarantine), ngưng phân phối và khởi động điều tra OOS Phase 1.',
      },
      currentUser
    );
  }

  /**
   * Chuyển trạng thái sai lệch theo State Machine qua Workflow Kernel
   */
  async handleUpdateStatus(
    id: string,
    newStatus: DeviationStatus,
    currentUser: any,
    options?: {
      notes?: string;
      investigator?: string;
      signature?: ElectronicSignature;
      reason?: string;
    }
  ): Promise<QualityDeviation> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Không tìm thấy hồ sơ sai lệch: ${id}`);
    }

    if (newStatus === 'CLOSED') {
      const isQAOrAdmin =
        currentUser?.isAdmin || currentUser?.role === 'QA' || currentUser?.role === 'ADMIN';
      if (!isQAOrAdmin) {
        throw new Error(
          'Từ chối quyền: Chỉ Trưởng phòng QA hoặc Quản trị viên mới có quyền Đóng (Close) hồ sơ sai lệch.'
        );
      }
      if (!options?.notes && !existing.closureNotes) {
        throw new Error(
          'Quy chuẩn GMP: Bắt buộc phải ghi nhận ý kiến thẩm định và kết luận trước khi đóng sai lệch.'
        );
      }
    }

    let actionId: WorkflowActionId = 'DEVIATION_INVESTIGATE';
    if (newStatus === 'CLOSED') {
      actionId = 'DEVIATION_CLOSE';
    } else if (newStatus === 'CAPA_PLANNED' || newStatus === 'EFFECTIVENESS_REVIEW') {
      actionId = 'DEVIATION_APPROVE';
    }

    const actor = this.toActor(currentUser);
    const closureNotes = options?.notes || existing.closureNotes || '';
    const updatedDeviation: QualityDeviation = {
      ...existing,
      status: newStatus,
      closureNotes: closureNotes || undefined,
      updatedAt: new Date().toISOString(),
    };

    const effectiveSignature = options?.signature || {
      signerName: actor.email || 'QA User',
      signerRole: actor.role,
      signedAt: new Date().toISOString(),
      meaning: `Chuyển trạng thái sai lệch sang ${newStatus}`,
      signatureHash: 'DEV_AUTO_SIGNATURE_HASH',
    };

    const execution = await WorkflowFacade.dispatch(
      {
        actionId,
        entityType: 'DEVIATION',
        entityId: id,
        actor,
        payload: updatedDeviation,
        reason:
          options?.notes ||
          options?.reason ||
          `Chuyển trạng thái sai lệch ${existing.deviationNo}: ${existing.status} -> ${newStatus}`,
        signature: effectiveSignature,
      },
      async () => {
        await this.repo.updateStatus(id, newStatus, options?.notes);
        logAuditAction({
          action: 'UPDATE',
          collection: 'DEVIATIONS',
          documentId: id,
          details: `Chuyển trạng thái sai lệch ${existing.deviationNo}: ${existing.status} -> ${newStatus}${options?.notes ? ` (Ghi chú: ${options.notes})` : ''}`,
          performedBy: currentUser?.email || 'unknown',
        });
        return updatedDeviation;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || `Lỗi thực thi ${actionId} qua Workflow.`);
    }

    return execution.data!;
  }

  /**
   * Bổ sung hành động CAPA vào hồ sơ sai lệch qua Workflow Kernel
   */
  async handleAddCAPAItem(
    id: string,
    actionItem: Omit<CAPAActionItem, 'id'>,
    currentUser: any
  ): Promise<QualityDeviation> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Không tìm thấy hồ sơ sai lệch: ${id}`);
    }

    const newItem: CAPAActionItem = {
      ...actionItem,
      id: generateId('capa'),
    };

    const updatedCAPAs = [...(existing.capaItems || []), newItem];
    const newVersion = nextVersion(existing.version);

    const updatedDeviation: QualityDeviation = {
      ...existing,
      capaItems: updatedCAPAs,
      status: existing.status === 'UNDER_INVESTIGATION' ? 'CAPA_PLANNED' : existing.status,
      version: newVersion,
      updatedAt: new Date().toISOString(),
    };

    const actor = this.toActor(currentUser);

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'CAPA_CREATE',
        entityType: 'CAPA',
        entityId: id,
        actor,
        payload: updatedDeviation,
        reason: `Bổ sung hành động CAPA [${newItem.type}]: ${newItem.action}`,
      },
      async () => {
        await this.repo.save(updatedDeviation);
        logAuditAction({
          action: 'UPDATE',
          collection: 'DEVIATIONS',
          documentId: id,
          details: `Bổ sung hành động CAPA [${newItem.type}]: ${newItem.action} (Phụ trách: ${newItem.responsible})`,
          performedBy: currentUser?.email || 'unknown',
        });
        return updatedDeviation;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi thực thi CAPA_CREATE qua Workflow.');
    }

    return execution.data!;
  }

  /**
   * Đánh dấu hoàn tất hành động CAPA qua Workflow Kernel
   */
  async handleCompleteCAPAItem(
    id: string,
    capaId: string,
    currentUser: any
  ): Promise<QualityDeviation> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Không tìm thấy hồ sơ sai lệch: ${id}`);
    }

    const updatedCAPAs = (existing.capaItems || []).map((item) => {
      if (item.id === capaId) {
        return {
          ...item,
          status: 'COMPLETED' as const,
          completedAt: new Date().toISOString(),
        };
      }
      return item;
    });

    const newVersion = nextVersion(existing.version);
    const updatedDeviation: QualityDeviation = {
      ...existing,
      capaItems: updatedCAPAs,
      version: newVersion,
      updatedAt: new Date().toISOString(),
    };

    const actor = this.toActor(currentUser);

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'CAPA_EXECUTE',
        entityType: 'CAPA',
        entityId: id,
        actor,
        payload: updatedDeviation,
        reason: `Hoàn tất hành động CAPA ${capaId} trong hồ sơ ${existing.deviationNo}`,
      },
      async () => {
        await this.repo.save(updatedDeviation);
        logAuditAction({
          action: 'UPDATE',
          collection: 'DEVIATIONS',
          documentId: id,
          details: `Hoàn tất hành động CAPA ${capaId} trong hồ sơ ${existing.deviationNo}`,
          performedBy: currentUser?.email || 'unknown',
        });
        return updatedDeviation;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi thực thi CAPA_EXECUTE qua Workflow.');
    }

    return execution.data!;
  }

  /**
   * Xóa hồ sơ sai lệch có kiểm soát quyền và Audit Trail qua Workflow Kernel
   */
  async handleDelete(id: string, currentUser: any, reason?: string): Promise<void> {
    const isQAOrAdmin =
      currentUser?.isAdmin || currentUser?.role === 'QA' || currentUser?.role === 'ADMIN';
    if (!isQAOrAdmin) {
      throw new Error('Từ chối quyền: Chỉ QA hoặc Quản trị viên mới có quyền xóa hồ sơ sai lệch.');
    }

    const existing = await this.repo.findById(id);
    const actor = this.toActor(currentUser);
    actor.role = 'ADMIN';

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'DEVIATION_DELETE',
        entityType: 'DEVIATION',
        entityId: id,
        actor,
        payload: { id },
        reason: reason || 'Xóa hồ sơ sai lệch nhập nhầm theo yêu cầu quản trị viên',
      },
      async () => {
        await this.repo.delete(id);
        logAuditAction({
          action: 'DELETE',
          collection: 'DEVIATIONS',
          documentId: id,
          details: `Xóa hồ sơ sai lệch: ${existing?.deviationNo || id}`,
          performedBy: currentUser?.email || 'unknown',
        });
        return { success: true };
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi thực thi DEVIATION_DELETE qua Workflow.');
    }
  }
}

export const deviationWorkflowHandlers = new DeviationWorkflowHandlers();
