/**
 * PQM 3.0 - Phiếu kiểm nghiệm (Test Result)
 */

import { Batch } from './batch';

export interface TestResultEntry {
  criteriaName: string;
  value: string | number;
  isPass: boolean;
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

export interface TestResult {
  id: string;
  batchId: string;
  /**
   * batch: Thuộc tính ảo (virtual join) phục vụ hiển thị trên UI và xuất phiếu CoA.
   * KHÔNG được lưu trực tiếp vào cơ sở dữ liệu Firebase.
   */
  batch?: Batch;
  labName: string;
  testDate: string;
  results: TestResultEntry[];
  overallStatus: 'PASS' | 'FAIL';
  notes?: string;
  attachments?: Attachment[];
  version?: number;
  createdAt: string;
  updatedAt?: string;
}
