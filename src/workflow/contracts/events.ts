/**
 * WORKFLOW CONTRACTS: EVENTS
 *
 * Định nghĩa các kiểu sự kiện phát sinh từ Workflow Engine:
 * - Audit Trail Events (ALCOA+)
 * - Telemetry & Metric Events
 * - Domain State Transition Events
 */

import { WorkflowActionId } from './actions';

export type WorkflowEventType =
  | 'WORKFLOW_STARTED'
  | 'WORKFLOW_COMPLETED'
  | 'WORKFLOW_FAILED'
  | 'AUDIT_EMITTED'
  | 'STATE_TRANSITIONED';

export interface WorkflowEvent<TPayload = any> {
  eventId: string;
  eventType: WorkflowEventType;
  actionId: WorkflowActionId;
  entityType: string;
  entityId: string;
  timestamp: string;
  executionId: string;
  correlationId?: string;
  actorId: string;
  actorRole: string;
  payload?: TPayload;
}

export interface AuditEventPayload {
  actionId: WorkflowActionId;
  collection: string;
  documentId: string;
  performedBy: string;
  details: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface TelemetryEventPayload {
  executionId: string;
  actionId: WorkflowActionId;
  entityType: string;
  entityId: string;
  actorRole: string;
  correlationId?: string;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED';
  errorCode?: string;
}
