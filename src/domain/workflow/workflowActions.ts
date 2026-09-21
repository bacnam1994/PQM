/**
 * PQM Domain - Workflow Actions Contract (Model 00 / Model 10)
 * Khế ước hành động quy trình chuẩn hóa toàn hệ thống.
 *
 * Bất biến:
 * Mọi yêu cầu thay đổi Workflow Status từ UI, AI, hay Services đều phải thông qua
 * một Workflow Action tường minh, tuyệt đối không được truyền trạng thái thô (raw status).
 */

import { BatchStatus } from '../canonical/canonicalStatus';
import { TestResultWorkflowStatus } from '../../types/testResult';
import { Role } from '../../types/permissions';

// ─── BATCH WORKFLOW ACTIONS ───────────────────────────────────────────────

export const BATCH_WORKFLOW_ACTIONS = {
  START_TESTING: 'START_TESTING',
  RELEASE_BATCH: 'RELEASE_BATCH',
  REJECT_BATCH: 'REJECT_BATCH',
  BLOCK_BATCH: 'BLOCK_BATCH',
  REOPEN_BATCH: 'REOPEN_BATCH',
} as const;

export type BatchWorkflowActionType =
  (typeof BATCH_WORKFLOW_ACTIONS)[keyof typeof BATCH_WORKFLOW_ACTIONS];

export interface BatchWorkflowActionDefinition {
  action: BatchWorkflowActionType;
  allowedFromStates: BatchStatus[];
  targetState: BatchStatus;
  allowedRoles: Role[];
  isReasonRequired: boolean;
  isSignatureRequired: boolean;
  description: string;
}

export const BATCH_ACTION_DEFINITIONS: Record<
  BatchWorkflowActionType,
  BatchWorkflowActionDefinition
> = {
  START_TESTING: {
    action: 'START_TESTING',
    allowedFromStates: ['PENDING', 'BLOCKED'],
    targetState: 'TESTING',
    allowedRoles: ['LAB', 'PRODUCTION', 'QA', 'ADMIN'],
    isReasonRequired: false,
    isSignatureRequired: false,
    description: 'Bắt đầu quá trình kiểm nghiệm mẫu lô sản xuất.',
  },
  RELEASE_BATCH: {
    action: 'RELEASE_BATCH',
    allowedFromStates: ['TESTING'],
    targetState: 'RELEASED',
    allowedRoles: ['QA', 'ADMIN'],
    isReasonRequired: false,
    isSignatureRequired: true,
    description:
      'Phê duyệt xuất xưởng chính thức lô sản xuất (yêu cầu chữ ký điện tử và đạt 7 Release Gates).',
  },
  REJECT_BATCH: {
    action: 'REJECT_BATCH',
    allowedFromStates: ['PENDING', 'TESTING', 'BLOCKED'],
    targetState: 'REJECTED',
    allowedRoles: ['QA', 'ADMIN'],
    isReasonRequired: true,
    isSignatureRequired: true,
    description:
      'Từ chối lô sản xuất không đạt yêu cầu chất lượng (bắt buộc nêu lý do và chữ ký điện tử).',
  },
  BLOCK_BATCH: {
    action: 'BLOCK_BATCH',
    allowedFromStates: ['TESTING', 'RELEASED'],
    targetState: 'BLOCKED',
    allowedRoles: ['QA', 'ADMIN'],
    isReasonRequired: true,
    isSignatureRequired: true,
    description:
      'Khóa hoặc thu hồi lô sản xuất khi phát hiện nguy cơ chất lượng (bắt buộc lý do và chữ ký số nếu là thu hồi).',
  },
  REOPEN_BATCH: {
    action: 'REOPEN_BATCH',
    allowedFromStates: ['REJECTED'],
    targetState: 'PENDING',
    allowedRoles: ['QA', 'ADMIN'],
    isReasonRequired: true,
    isSignatureRequired: true,
    description: 'Mở lại lô đã bị từ chối dựa trên phê duyệt hồ sơ CAPA đặc biệt.',
  },
};

// ─── TEST RESULT WORKFLOW ACTIONS ─────────────────────────────────────────

export const TEST_RESULT_WORKFLOW_ACTIONS = {
  SUBMIT_FOR_REVIEW: 'SUBMIT_FOR_REVIEW',
  REVISE_DRAFT: 'REVISE_DRAFT',
  FINALIZE_RESULT: 'FINALIZE_RESULT',
  APPROVE_RESULT: 'APPROVE_RESULT',
  SUPERSEDE_RESULT: 'SUPERSEDE_RESULT',
} as const;

export type TestResultWorkflowActionType =
  (typeof TEST_RESULT_WORKFLOW_ACTIONS)[keyof typeof TEST_RESULT_WORKFLOW_ACTIONS];

export interface TestResultWorkflowActionDefinition {
  action: TestResultWorkflowActionType;
  allowedFromStates: TestResultWorkflowStatus[];
  targetState: TestResultWorkflowStatus;
  allowedRoles: Role[];
  isReasonRequired: boolean;
  isSignatureRequired: boolean;
  description: string;
}

export const TEST_RESULT_ACTION_DEFINITIONS: Record<
  TestResultWorkflowActionType,
  TestResultWorkflowActionDefinition
> = {
  SUBMIT_FOR_REVIEW: {
    action: 'SUBMIT_FOR_REVIEW',
    allowedFromStates: ['DRAFT'],
    targetState: 'SUBMITTED',
    allowedRoles: ['LAB', 'QC', 'QA', 'ADMIN'],
    isReasonRequired: false,
    isSignatureRequired: false,
    description: 'Nộp phiếu kiểm nghiệm sau khi đã nhập đủ số liệu ban đầu để soát xét.',
  },
  REVISE_DRAFT: {
    action: 'REVISE_DRAFT',
    allowedFromStates: ['SUBMITTED'],
    targetState: 'DRAFT',
    allowedRoles: ['LAB', 'QC', 'QA', 'ADMIN'],
    isReasonRequired: false,
    isSignatureRequired: false,
    description: 'Trả phiếu về trạng thái nháp để điều chỉnh số liệu.',
  },
  FINALIZE_RESULT: {
    action: 'FINALIZE_RESULT',
    allowedFromStates: ['SUBMITTED'],
    targetState: 'FINAL',
    allowedRoles: ['QC', 'QA', 'ADMIN'],
    isReasonRequired: false,
    isSignatureRequired: false,
    description: 'Chốt kỹ thuật kết quả kiểm nghiệm (yêu cầu không còn chỉ tiêu PENDING).',
  },
  APPROVE_RESULT: {
    action: 'APPROVE_RESULT',
    allowedFromStates: ['FINAL'],
    targetState: 'APPROVED',
    allowedRoles: ['QA', 'ADMIN'],
    isReasonRequired: false,
    isSignatureRequired: true,
    description: 'Trưởng phòng QA duyệt chính thức phiếu kiểm nghiệm có chữ ký số.',
  },
  SUPERSEDE_RESULT: {
    action: 'SUPERSEDE_RESULT',
    allowedFromStates: ['DRAFT', 'SUBMITTED', 'FINAL', 'APPROVED'],
    targetState: 'SUPERSEDED',
    allowedRoles: ['QA', 'ADMIN'],
    isReasonRequired: true,
    isSignatureRequired: false,
    description: 'Đánh dấu thay thế phiếu kiểm nghiệm cũ khi có phiếu kiểm lại hợp lệ.',
  },
};
