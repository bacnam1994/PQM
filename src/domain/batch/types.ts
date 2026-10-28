/**
 * src/domain/batch/types.ts
 * =========================
 * Khế ước kiểu dữ liệu cho Batch Integrity, Data Freshness & Quality Decisions.
 * Tách biệt để khử circular dependency giữa batchIntegrityValidator và canonicalBatchQualityDecision.
 */

import { Batch, TestResult } from '../../types';
import { BatchTestResolutionResult } from './batchTestResultResolver';

export type BatchIntegrityStatus =
  | 'PASS'
  | 'MISSING_TEST_RESULT'
  | 'RELATIONSHIP_ERROR'
  | 'TEST_RESULT_INVALID_STATUS'
  | 'DATA_UNAVAILABLE'
  | 'NOT_APPLICABLE';

export type CollectionLoadState =
  | 'NOT_STARTED'
  | 'LOADING'
  | 'LOADED'
  | 'PARTIAL'
  | 'ERROR'
  | 'OFFLINE';

export interface DataFreshnessState {
  isBatchesLoading?: boolean;
  isTestResultsLoading?: boolean;
  testResultsLoaded?: boolean;
  loadState?: CollectionLoadState;
  isOffline?: boolean;
  isError?: boolean;
}

export interface BatchIntegrityEvaluation {
  batchId: string;
  batchNo: string;
  releaseStatus: Batch['status'];
  integrityStatus: BatchIntegrityStatus;
  candidateCount: number;
  primaryCount: number;
  legacyCount: number;
  validPassCount: number;
  matchedTestIds: string[];
  relationshipType: 'PRIMARY' | 'LEGACY' | 'INVALID' | 'NONE';
  summaryMessage: string;
  shouldAlert: boolean;
  alertType?: 'CRITICAL' | 'WARNING' | 'INFO';
  suggestedAction?: string;
  debugInfo: {
    resolution: BatchTestResolutionResult;
    freshness: DataFreshnessState;
    authoritativeResults?: TestResult[];
  };
}
