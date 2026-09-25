/**
 * CANONICAL WORKFLOW CONTRACTS & ACTION IDS
 *
 * SSoT theo quy định tại ADR-001 và docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md.
 * Khóa chặt 42 Canonical Action IDs, 15 Entities, 8 Roles và 7 Categories.
 */

export type CanonicalRole =
  | 'ADMIN'
  | 'QA'
  | 'QC'
  | 'LAB'
  | 'PRODUCTION'
  | 'USER'
  | 'VIEWER'
  | 'GUEST'
  | 'SYSTEM'
  | 'AI_ADVISORY';

export type EntityType =
  | 'PRODUCT'
  | 'MATERIAL'
  | 'TCCS'
  | 'FORMULA'
  | 'BATCH'
  | 'TEST_RESULT'
  | 'QUALITY_SNAPSHOT'
  | 'OOS'
  | 'DEVIATION'
  | 'CAPA'
  | 'CHANGE_REQUEST'
  | 'APPROVAL_TASK'
  | 'COA'
  | 'MASTER_DATA'
  | 'SYSTEM';

export type ActionCategory =
  | 'LIFECYCLE'
  | 'TRANSITION'
  | 'APPROVAL'
  | 'QUALITY'
  | 'DOCUMENT'
  | 'GOVERNANCE'
  | 'ADMIN';

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export type WorkflowActionId =
  // Batch
  | 'BATCH_CREATE'
  | 'BATCH_UPDATE_METADATA'
  | 'BATCH_DISPATCH_TESTING'
  | 'BATCH_EVALUATE_RELEASE'
  | 'BATCH_RELEASE_APPROVE'
  | 'BATCH_REJECT'
  | 'BATCH_HOLD'
  | 'BATCH_RECALL'
  | 'BATCH_DELETE'

  // Test Result
  | 'TEST_RESULT_CREATE'
  | 'TEST_RESULT_ENTRY_INPUT'
  | 'TEST_RESULT_CALCULATION_RUN'
  | 'TEST_RESULT_SUBMIT'
  | 'TEST_RESULT_APPROVE'
  | 'TEST_RESULT_REJECT'
  | 'TEST_RESULT_CANCEL'
  | 'TEST_RESULT_REVOKE'
  | 'TEST_RESULT_REEVALUATE'
  | 'TEST_RESULT_DELETE'

  // Deviation & OOS
  | 'DEVIATION_CREATE'
  | 'DEVIATION_INVESTIGATE'
  | 'DEVIATION_APPROVE'
  | 'DEVIATION_CLOSE'
  | 'DEVIATION_DELETE'
  | 'OOS_CREATE'
  | 'OOS_PHASE1_LAB_INVESTIGATE'
  | 'OOS_PHASE2_MFG_INVESTIGATE'
  | 'OOS_CONCLUDE'

  // CAPA
  | 'CAPA_CREATE'
  | 'CAPA_ASSIGN'
  | 'CAPA_EXECUTE'
  | 'CAPA_VERIFY'
  | 'CAPA_CLOSE'

  // Change Control
  | 'CHANGE_REQUEST_CREATE'
  | 'CHANGE_REQUEST_FMEA_ASSESS'
  | 'CHANGE_REQUEST_ADD_ACTION'
  | 'CHANGE_REQUEST_COMPLETE_ACTION'
  | 'CHANGE_REQUEST_REVIEW'
  | 'CHANGE_REQUEST_APPROVE'
  | 'CHANGE_REQUEST_REJECT'
  | 'CHANGE_REQUEST_IMPLEMENT'
  | 'CHANGE_REQUEST_CLOSE'

  // Approval, CoA & e-Signature
  | 'APPROVAL_TASK_CREATE'
  | 'APPROVAL_TASK_DECIDE'
  | 'APPROVAL_TASK_CANCEL'
  | 'COA_GENERATE'
  | 'COA_SIGN'
  | 'COA_REVOKE'
  | 'COA_VERIFY_PUBLIC'

  // Master Data
  | 'PRODUCT_CREATE'
  | 'PRODUCT_UPDATE'
  | 'PRODUCT_ARCHIVE'
  | 'MATERIAL_CREATE'
  | 'MATERIAL_UPDATE'
  | 'MATERIAL_DELETE'
  | 'TCCS_CREATE'
  | 'TCCS_UPDATE_DRAFT'
  | 'TCCS_SUBMIT'
  | 'TCCS_APPROVE'
  | 'TCCS_REVISE'
  | 'TCCS_OBSOLETE'
  | 'FORMULA_CREATE'
  | 'FORMULA_UPDATE'
  | 'FORMULA_ARCHIVE'
  | 'CRITERIA_MASTER_CREATE'
  | 'CRITERIA_MASTER_UPDATE'
  | 'CRITERIA_ALIAS_MAP'
  | 'LAB_MASTER_CREATE'
  | 'LAB_MASTER_UPDATE'
  | 'PHARMACOPOEIA_CREATE'
  | 'PHARMACOPOEIA_UPDATE'
  | 'PHARMACOPOEIA_DELETE'

  // System & Integration
  | 'SYSTEM_BACKUP_EXECUTE'
  | 'SYSTEM_RESTORE_EXECUTE'
  | 'SYSTEM_WIPE_DEMO_EXECUTE'
  | 'SYSTEM_AUTO_HEAL_PROPOSE'
  | 'SYSTEM_AUTO_HEAL_APPROVE'
  | 'SYSTEM_AUTO_HEAL_EXECUTE'
  | 'SYSTEM_CONFIG_UPDATE'
  | 'SYSTEM_USER_ROLE_ASSIGN'
  | 'FILE_STORAGE_UPLOAD'
  | 'FILE_STORAGE_DELETE'
  | 'EXCEL_DATA_EXPORT'
  | 'CLOUD_FUNCTION_INVOKE'

  // AI Advisory Proposals
  | 'AI_OCR_EXTRACT'
  | 'AI_MAPPING_PROPOSE'
  | 'AI_STABILITY_PREDICT'
  | 'AI_BATCH_CLEARANCE_PROPOSE'
  | 'AI_NATURAL_QUERY'
  | 'AI_VOICE_PARSE'
  | 'AI_LAB_COMPARE'
  | 'AI_DATA_INTEGRITY_SCAN';

export interface WorkflowActionMetadata {
  actionId: WorkflowActionId;
  entityType: EntityType;
  category: ActionCategory;
  description: string;
  allowedRoles: CanonicalRole[];
  risk: RiskLevel;
  requiresAudit: boolean;
  requiresReason: boolean;
  requiresSignature?: boolean;
  requiresTypedConfirmation?: boolean;
  expectedConfirmationToken?: string;
  targetFsm?: string;
}

export interface WorkflowActor {
  id: string;
  name: string;
  role: CanonicalRole | string;
  email?: string;
}

export interface WorkflowExecutionContext<TPayload = any> {
  actionId: WorkflowActionId | string;
  entityType: EntityType;
  entityId: string;
  actor: WorkflowActor;
  payload?: TPayload;
  reason?: string;
  signature?: any;
  confirmationToken?: string;
  expectedVersion?: number;
  currentState?: string;
  correlationId?: string;
  idempotencyKey?: string;
}

export interface WorkflowExecutionResult<TData = any> {
  success: boolean;
  executionId: string;
  actionId: string;
  entityType: EntityType;
  entityId: string;
  fromState?: string;
  toState?: string;
  version?: number;
  data?: TData;
  failureCode?: string;
  failureReason?: string;
  auditStatus?: 'COMMITTED' | 'AUDIT_FAILED' | 'SKIPPED';
  auditError?: string;
  timestamp: string;
  durationMs: number;
}
