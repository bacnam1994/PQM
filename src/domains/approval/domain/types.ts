/**
 * APPROVAL DOMAIN: TYPES & CONTRACTS
 * Chuẩn hóa các thực thể & hợp đồng quy trình phê duyệt nhiều cấp (Multi-stage Approval Workflow)
 * Tuân thủ 21 CFR Part 11, Phụ lục 11 EU GMP và ALCOA+ Data Integrity.
 */

import { Role, ElectronicSignature, Batch } from '../../../types';
import {
  ApprovalTask,
  ApprovalStep,
  ApprovalLogEntry,
  ApprovalEntityType,
  ApprovalOverallStatus,
  StepDecision,
} from '../../../types/approvalWorkflow';

export type {
  ApprovalTask,
  ApprovalStep,
  ApprovalLogEntry,
  ApprovalEntityType,
  ApprovalOverallStatus,
  StepDecision,
};

export interface InitiatePipelineInput {
  entityType: ApprovalEntityType;
  entityId: string;
  originatorId: string;
  title?: string;
  customSteps?: ApprovalStep[];
  enforceSoD?: boolean;
}

export interface ProcessStepDecisionInput {
  task: ApprovalTask;
  user: {
    uid?: string;
    email: string;
    role: Role | null;
    isAdmin?: boolean;
  };
  decision: StepDecision;
  reason?: string;
  signature?: ElectronicSignature;
  options?: {
    enforceSoD?: boolean;
  };
}

export interface RevokeApprovalInput {
  task: ApprovalTask;
  user: {
    uid?: string;
    email: string;
    role: Role | null;
    isAdmin?: boolean;
  };
  reason: string;
  relatedBatch?: Batch;
  signature?: ElectronicSignature;
}

export interface ApprovalTaskFilter {
  entityType?: ApprovalEntityType;
  entityId?: string;
  status?: ApprovalOverallStatus;
  assigneeRole?: string;
}
