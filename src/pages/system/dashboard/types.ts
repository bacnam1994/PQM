/**
 * Types & Interfaces for PQM System Dashboard
 */

import { Batch, Product, TestResult } from '../../../types';

export type DateRangeFilter = 'ALL' | '30D' | '90D' | 'YTD';

export type PipelineStageKey =
  | 'ALL'
  | 'NOT_TESTED'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'PASS'
  | 'FAIL'
  | 'RELEASED'
  | 'REJECTED'
  | 'PENDING'
  | 'TESTING'
  | 'REVIEW';

export interface DashboardStats {
  totalBatches: number;
  notTestedBatches: number;
  testingBatches: number; // IN_PROGRESS
  reviewBatches: number; // PENDING_REVIEW
  releasedBatches: number; // RELEASED
  rejectedBatches: number; // REJECTED or FAIL
  passBatches: number; // PASS
  totalResults: number;
  passResults: number;
  failResults: number;
  pendingResults: number;
  passRate: number | null;
  totalProducts: number;
  activeProducts: number;
  totalTCCS: number;
  activeTCCS: number;
  totalMaterials: number;
  expiringBatchesCount: number;
}

export interface PipelineStageInfo {
  key: PipelineStageKey;
  title: string;
  count: number;
  description: string;
  percentage: number;
  colorClass: string;
  badgeBg: string;
  iconName: string;
}

export interface MonthlyTestTrend {
  month: string;
  pass: number;
  fail: number;
  pending: number;
  total: number;
}

export interface LabDistributionStat {
  labName: string;
  totalTests: number;
  passCount: number;
  failCount: number;
  passRate: number;
  percentageOfAll: number;
}

export interface ExpiringBatchItem {
  batch: Batch;
  product?: Product;
  daysRemaining: number;
  isExpired: boolean;
  urgency: 'EXPIRED' | 'CRITICAL' | 'WARNING';
}
