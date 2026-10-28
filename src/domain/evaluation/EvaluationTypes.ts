/**
 * EvaluationTypes.ts
 * Kiểu dữ liệu chuẩn mực cho Động cơ Thẩm định Chất lượng PQM Domain (Phase 3).
 * Độc lập 100% với AI, đảm bảo tính xác định (deterministic) và truy vết pháp lý (ALCOA+).
 */

export type EvaluationOutcome = 'PASS' | 'FAIL' | 'INCOMPLETE' | null;

export type SpecificationType =
  | 'RANGE'
  | 'TOLERANCE'
  | 'COMPARISON'
  | 'NOT_DETECTED'
  | 'POSITIVE'
  | 'EXACT_TEXT';

export interface ParsedSpecification {
  type: SpecificationType;
  raw: string;
  min?: number;
  max?: number;
  operator?: '<=' | '>=' | '<' | '>' | '==' | 'NMT' | 'NLT';
  targetValue?: number;
  baseValue?: number;
  toleranceValue?: number;
  isPercentageTolerance?: boolean;
  expectedText?: string;
  isLODCapable?: boolean;
}

export interface NormalizedValue {
  rawValue: any;
  stringValue: string;
  numericValue: number | null;
  isND: boolean;
  isPositive: boolean;
  isStrictLessThan: boolean;
  isStrictGreaterThan: boolean;
}

export interface SingleCriterionResult {
  criterionName: string;
  rawValue: any;
  normalizedValue: NormalizedValue;
  specification: ParsedSpecification;
  isPass: boolean | null;
  usedAlternate?: boolean;
  alternateNote?: string;
  reason?: string;
}

export interface AlternateEvaluationResult {
  isPass: boolean;
  usedAlternate: boolean;
  ruleApplied?: 'FAIL_RETRY' | 'CONDITIONAL_CHECK';
  alternateCriterionName?: string;
  alternateValue?: any;
  alternateNote?: string;
}

export interface OverallEvaluationResult {
  overallStatus: 'PASS' | 'FAIL';
  isComplete: boolean;
  totalCriteria: number;
  completedCriteria: number;
  passCount: number;
  failCount: number;
  progressPercent: number;
  results: SingleCriterionResult[];
  reasons: string[];
  warnings: string[];
}
