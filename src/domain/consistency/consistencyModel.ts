/**
 * PQM Domain - Data Consistency & Reconciliation Model (Model 7)
 * Phân loại và cấu trúc chuẩn hóa sai lệch dữ liệu giữa các nguồn.
 */

export type StandardConsistencyIssueType =
  | 'MISSING_REFERENCE'
  | 'INVALID_REFERENCE'
  | 'DUPLICATE_ENTITY'
  | 'STATUS_MISMATCH'
  | 'CRITERIA_MISMATCH'
  | 'AGGREGATION_MISMATCH'
  | 'STALE_DERIVED_DATA'
  | 'ORPHAN_RECORD'
  | 'INVALID_SCHEMA'
  | 'INVALID_BUSINESS_RULE'
  | 'UNKNOWN';

export type IssueSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type HealingStrategyType = 'SAFE_AUTO_HEAL' | 'CONTROLLED_HEAL' | 'NEVER_AUTO_HEAL';

export interface CanonicalConsistencyIssue {
  id: string;
  type: StandardConsistencyIssueType;
  severity: IssueSeverity;
  entityType: string;
  entityId: string;
  field?: string;
  expected?: any;
  actual?: any;
  source: string;
  detectedAt: string;
  detectedBy: string;
  canAutoHeal: boolean;
  healingStrategy: HealingStrategyType;
  status: 'DETECTED' | 'PREVIEWED' | 'HEALED' | 'IGNORED';
  details?: Record<string, any>;
}

export class ConsistencyIssueFactory {
  public static createIssue(params: {
    type: StandardConsistencyIssueType;
    severity: IssueSeverity;
    entityType: string;
    entityId: string;
    field?: string;
    expected?: any;
    actual?: any;
    source: string;
    healingStrategy: HealingStrategyType;
    detectedBy?: string;
    details?: Record<string, any>;
  }): CanonicalConsistencyIssue {
    const canAutoHeal =
      params.healingStrategy === 'SAFE_AUTO_HEAL' || params.healingStrategy === 'CONTROLLED_HEAL';
    return {
      id: `ISSUE-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      type: params.type,
      severity: params.severity,
      entityType: params.entityType,
      entityId: params.entityId,
      field: params.field,
      expected: params.expected,
      actual: params.actual,
      source: params.source,
      detectedAt: new Date().toISOString(),
      detectedBy: params.detectedBy || 'CanonicalConsistencyEngine',
      canAutoHeal,
      healingStrategy: params.healingStrategy,
      status: 'DETECTED',
      details: params.details,
    };
  }
}
