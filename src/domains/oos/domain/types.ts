/**
 * OOS DOMAIN: TYPES
 */

import { TestResult, Batch, QualityDeviation } from '../../../types';

export interface OOSInvestigationPhase1 {
  instrumentCheck: 'PASS' | 'FAIL';
  standardSolutionCheck: 'PASS' | 'FAIL';
  calculationCheck: 'PASS' | 'FAIL';
  operatorInterview: string;
  labErrorFound: boolean;
  labErrorDetails?: string;
  assignedAnalyst: string;
  completedAt?: string;
}

export interface OOSInvestigationPhase2 {
  manufacturingProcessCheck: 'PASS' | 'FAIL';
  rawMaterialCheck: 'PASS' | 'FAIL';
  environmentalConditionsCheck: 'PASS' | 'FAIL';
  rootCauseIdentified: string;
  capaPlanRequired: boolean;
  completedAt?: string;
}

export type OOSInvestigationStatus =
  | 'TRIGGERED'
  | 'PHASE1_LAB_INVESTIGATION'
  | 'PHASE2_MFG_INVESTIGATION'
  | 'CONCLUDED';

export type { TestResult, Batch, QualityDeviation };
