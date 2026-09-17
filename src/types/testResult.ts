/**
 * PQM 3.0 - Phiếu kiểm nghiệm (Test Result)
 */

import { Batch } from './batch';

export interface TestResultEntry {
  criteriaName: string;
  value: string | number;
  isPass: boolean | null; // Cho phép null với chỉ tiêu cảm quan/informational
  isExtra?: boolean;
  unit?: string;
  limit?: string;
}

export interface Attachment {
  name: string;
  url: string;
  source: 'google_drive' | 'firebase';
  uploadedAt: string;
}

export interface EvaluationSnapshotCriterionResult {
  criteriaName: string;
  value: any;
  normalizedValue?: any;
  isPass: boolean | null;
  ruleApplied?: string;
  usedAlternate?: boolean;
  note?: string;
}

export interface EvaluationSnapshot {
  engineVersion: string;
  tccsId?: string;
  tccsVersion?: string | number;
  evaluatedAt: string;
  evaluatedBy: string;
  overallStatus: 'PASS' | 'FAIL' | 'PENDING' | 'UNKNOWN';
  criterionResults: EvaluationSnapshotCriterionResult[];
  alternateUsed: boolean;
  reasons: string[];
  warnings: string[];
  evaluationHash: string;
}

export interface TestResult {
  id: string;
  batchId: string;
  /**
   * batch: Thuộc tính ảo (virtual join) phục vụ hiển thị trên UI và xuất phiếu CoA.
   * KHÔNG được lưu trực tiếp vào cơ sở dữ liệu Firebase.
   */
  batch?: Batch;
  labId?: string; // Khóa ngoại liên kết với TestingLaboratory (nếu đã chuẩn hóa)
  labName: string;
  testDate: string;
  results: TestResultEntry[];
  overallStatus: 'PASS' | 'FAIL' | 'PENDING' | 'UNKNOWN';
  evaluationSnapshot?: EvaluationSnapshot;
  notes?: string;
  attachments?: Attachment[];
  version?: number;
  createdAt: string;
  updatedAt?: string;
}
