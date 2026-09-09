/**
 * PQM V4 Platform - Approval Workflow Engine Data Models
 * Chuẩn hóa quy trình xét duyệt nhiều bước (Multi-stage Approval) với Chữ ký số (21 CFR Part 11).
 */

import { Role, ElectronicSignature } from '../types';

export type ApprovalEntityType = 'TEST_RESULT' | 'BATCH' | 'TCCS' | 'DEVIATION' | 'CHANGE_CONTROL';

export type ApprovalOverallStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type StepDecision = 'APPROVE' | 'REJECT';

export interface ApprovalStep {
  stepOrder: number;
  stepName: string;
  roleRequired: Role | 'HEAD_OF_QA';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
  assignedToEmail?: string;
  decision?: StepDecision;
  reason?: string;
  signature?: ElectronicSignature;
  decidedAt?: string;
  decidedBy?: string;
}

export interface ApprovalLogEntry {
  timestamp: string;
  actorEmail: string;
  actorRole: string;
  action: 'INITIATED' | 'STEP_APPROVED' | 'STEP_REJECTED' | 'CANCELLED' | 'AUTO_ESCALATED';
  stepOrder: number;
  comments?: string;
}

export interface ApprovalTask {
  id: string;
  entityType: ApprovalEntityType;
  entityId: string;
  title: string;
  version: number;
  status: ApprovalOverallStatus;
  currentStepIndex: number;
  steps: ApprovalStep[];
  history: ApprovalLogEntry[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  metadata?: Record<string, any>;
}
