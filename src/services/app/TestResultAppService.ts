/**
 * PQM 3.0 - Test Result Application Service
 * Điều phối các nghiệp vụ quản lý Phiếu kiểm nghiệm: RBAC Authorization, Validation,
 * Tự động đánh giá Đạt/Không đạt, ALCOA+ Audit Trail & Optimistic Concurrency Control (OCC)
 */

import { TestResult, Batch, TestResultWorkflowStatus, ElectronicSignature } from '../../types';
import { ITestResultRepository } from '../../repositories/TestResultRepository';
import { testResultRepository as defaultTestResultRepo } from '../../repositories/firebase/FirebaseTestResultRepository';
import {
  DeviationAppService,
  deviationAppService as defaultDeviationAppService,
} from './DeviationAppService';
import { can } from '../permissionService';
import { TestResultWorkflowHandlers } from '../../workflow/handlers/testResultWorkflowHandlers';

export class TestResultAppService {
  private workflowHandlers: TestResultWorkflowHandlers;

  constructor(
    private repo: ITestResultRepository = defaultTestResultRepo,
    private deviationService: DeviationAppService = defaultDeviationAppService
  ) {
    this.workflowHandlers = new TestResultWorkflowHandlers(this.repo, this.deviationService);
  }

  /**
   * Tạo mới Phiếu kiểm nghiệm
   */
  async createTestResult(
    testResult: TestResult,
    currentUser: any,
    options?: { batch?: Batch }
  ): Promise<void> {
    if (!can(currentUser, 'test_result:create')) {
      throw new Error('Từ chối quyền: Bạn không có quyền lập phiếu kiểm nghiệm mới.');
    }
    await this.workflowHandlers.handleCreate(testResult, currentUser, options);
  }

  /**
   * Cập nhật Phiếu kiểm nghiệm có bảo vệ Optimistic Concurrency Control (OCC)
   */
  async updateTestResult(
    testResult: TestResult,
    currentUser: any,
    oldTestResult?: TestResult,
    options?: { batch?: Batch }
  ): Promise<void> {
    if (!can(currentUser, 'test_result:update', oldTestResult || testResult)) {
      throw new Error(
        'Từ chối quyền: Không thể chỉnh sửa phiếu kiểm nghiệm đã duyệt hoặc bị khóa.'
      );
    }
    await this.workflowHandlers.handleUpdate(testResult, currentUser, oldTestResult, options);
  }

  /**
   * Cập nhật trạng thái quy trình tài liệu (Workflow State Machine)
   * Kiểm soát: DRAFT -> SUBMITTED -> FINAL -> APPROVED -> RELEASED -> SUPERSEDED
   * Và đối chiếu Ma trận Chất lượng × Quy trình (Quality × Workflow Matrix)
   */
  async updateWorkflowStatus(
    id: string,
    newWorkflowStatus: TestResultWorkflowStatus,
    currentUser: any,
    options?: {
      reason?: string;
      oldTestResult?: TestResult;
      batch?: Batch;
      signature?: ElectronicSignature;
      requireSignature?: boolean;
    }
  ): Promise<void> {
    await this.workflowHandlers.handleWorkflowStatusTransition(
      id,
      newWorkflowStatus,
      currentUser,
      options
    );
  }

  /**
   * Xóa Phiếu kiểm nghiệm
   */
  async deleteTestResult(id: string, currentUser: any, oldTestResult?: TestResult): Promise<void> {
    const current = oldTestResult || (await this.repo.findById(id));
    if (!can(currentUser, 'test_result:delete', current)) {
      throw new Error('Từ chối quyền: Bạn không có quyền xóa phiếu kiểm nghiệm này.');
    }
    await this.workflowHandlers.handleDelete(id, currentUser, oldTestResult);
  }
}

export const testResultAppService = new TestResultAppService();
