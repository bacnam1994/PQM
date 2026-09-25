/**
 * PQM 3.0 - Quality Deviation & CAPA Application Service
 * ======================================================
 * Điều phối luồng nghiệp vụ Quản lý Sai lệch Chất lượng theo chuẩn GMP-WHO và FDA 21 CFR Part 211.
 * Ủy quyền 100% các đột biến dữ liệu qua DeviationWorkflowHandlers & WorkflowFacade.
 * Triển khai State Machine: LOGGED -> UNDER_INVESTIGATION -> CAPA_PLANNED -> EFFECTIVENESS_REVIEW -> CLOSED
 */

import {
  QualityDeviation,
  DeviationStatus,
  CreateDeviationInput,
  CAPAActionItem,
} from '../../types/deviation';
import { IDeviationRepository } from '../../repositories/IDeviationRepository';
import { firebaseDeviationRepository } from '../../repositories/firebase/FirebaseDeviationRepository';
import { TestResult, Batch } from '../../types';
import { DeviationWorkflowHandlers } from '../../workflow/handlers/deviationWorkflowHandlers';

export class DeviationAppService {
  private handlers: DeviationWorkflowHandlers;

  constructor(private repo: IDeviationRepository = firebaseDeviationRepository) {
    this.handlers = new DeviationWorkflowHandlers(this.repo);
  }

  /**
   * Tìm kiếm hồ sơ sai lệch theo ID
   */
  async findById(id: string): Promise<QualityDeviation | null> {
    return this.handlers.findById(id);
  }

  /**
   * Lấy danh sách toàn bộ hồ sơ sai lệch
   */
  async findAll(): Promise<QualityDeviation[]> {
    return this.handlers.findAll();
  }

  /**
   * Tạo mới một sai lệch chất lượng qua Workflow
   */
  async createDeviation(input: CreateDeviationInput, currentUser: any): Promise<QualityDeviation> {
    return this.handlers.handleCreate(input, currentUser);
  }

  /**
   * Tự động khởi tạo Sai lệch khi phát hiện kết quả kiểm nghiệm OOS (FAIL)
   */
  async autoLogFromOOS(
    testResult: TestResult,
    batch?: Batch,
    currentUser?: any
  ): Promise<QualityDeviation | null> {
    return this.handlers.handleAutoLogFromOOS(testResult, batch, currentUser);
  }

  /**
   * Chuyển trạng thái sai lệch theo State Machine
   */
  async updateStatus(
    id: string,
    newStatus: DeviationStatus,
    currentUser: any,
    options?: { notes?: string; investigator?: string }
  ): Promise<void> {
    await this.handlers.handleUpdateStatus(id, newStatus, currentUser, options);
  }

  /**
   * Bổ sung / Cập nhật hành động CAPA vào hồ sơ sai lệch
   */
  async addCAPAItem(
    id: string,
    actionItem: Omit<CAPAActionItem, 'id'>,
    currentUser: any
  ): Promise<QualityDeviation> {
    return this.handlers.handleAddCAPAItem(id, actionItem, currentUser);
  }

  /**
   * Đánh dấu hoàn tất hành động CAPA
   */
  async completeCAPAItem(id: string, capaId: string, currentUser: any): Promise<QualityDeviation> {
    return this.handlers.handleCompleteCAPAItem(id, capaId, currentUser);
  }

  /**
   * Xóa hồ sơ sai lệch có kiểm soát quyền và Audit Trail
   */
  async deleteDeviation(id: string, currentUser: any): Promise<void> {
    return this.handlers.handleDelete(id, currentUser);
  }
}

export const deviationAppService = new DeviationAppService();
