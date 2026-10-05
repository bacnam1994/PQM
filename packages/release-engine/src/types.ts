/**
 * packages/release-engine/src/types.ts
 * CANONICAL TYPES FOR PQM RELEASE ENGINE (Single Source of Truth)
 */

export type ReleaseGateKey =
  | 'GATE_1_TEST_COMPLETION'
  | 'GATE_2_CANONICAL_QUALITY'
  | 'GATE_3_NO_OPEN_OOS'
  | 'GATE_4_NO_OPEN_CRITICAL_DEVIATION'
  | 'GATE_5_CAPA_FULFILLED'
  | 'GATE_6_BPR_QA_APPROVED'
  | 'GATE_7_AUTHORITY_AND_SIGNATURE';

export type ReleaseGateStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'WAITING';

export interface ReleaseGateResult {
  gateIndex: number; // 1 to 7
  gateKey: ReleaseGateKey;
  gateName: string;
  passed: boolean;
  status: ReleaseGateStatus;
  details: string;
  blockers?: string[];
}

export type SignatureDocumentType =
  | 'BATCH'
  | 'BATCH_RELEASE'
  | 'BATCH_REJECT'
  | 'TEST_RESULT'
  | 'TEST_RESULT_APPROVAL'
  | 'COA_ISSUE'
  | 'TCCS'
  | 'DEVIATION'
  | 'CHANGE_CONTROL';

export type SignatureStatus = 'CREATED' | 'CONSUMED' | 'REJECTED' | 'REVOKED' | 'SUPERSEDED';

export interface CanonicalElectronicSignature {
  id: string;
  documentType: SignatureDocumentType;
  documentId: string;
  documentVersion?: number;
  signerUid: string;
  signerName: string;
  signerEmail: string;
  role: string;
  meaning: string;
  signedAt: string;
  checksum: string;
  status?: SignatureStatus;
  consumedAt?: string;
  consumedBy?: string;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
  comments?: string;
}

export type ReleaseCommandState = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ReleaseCommandRecord {
  idempotencyKey: string;
  commandId: string;
  batchId: string;
  signatureId?: string;
  actorUid: string;
  actorEmail?: string;
  expectedVersion: number;
  actualVersion?: number;
  state: ReleaseCommandState;
  gates?: ReleaseGateResult[];
  failureCode?: string;
  failureReason?: string;
  createdAt: string;
  completedAt?: string;
  correlationId?: string;
}

export interface CanonicalReleaseDecision {
  eligible: boolean;
  batchId: string;
  batchNo: string;
  currentStatus: string;
  nextStatus: string;
  gates: ReleaseGateResult[];
  blockers: string[];
  warnings: string[];
  requiredSignature: boolean;
  requiredRole: string[];
  decisionTrace: string[];
  evaluatedAt: string;
}

export type ElectronicSignature = CanonicalElectronicSignature;
export type Batch = any;
export type TestResult = any;
export type QualityDeviation = any;
