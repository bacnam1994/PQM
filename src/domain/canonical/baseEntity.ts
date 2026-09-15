/**
 * PQM Domain - Canonical Base Entity (Model 1)
 * Định nghĩa cấu trúc thống nhất cho tất cả thực thể trong hệ thống.
 *
 * Entity
 *  ├── id
 *  ├── createdAt
 *  ├── createdBy
 *  ├── updatedAt
 *  ├── updatedBy
 *  ├── version
 *  ├── status
 *  └── metadata
 */

export interface EntityMetadata {
  source?: string;
  correlationId?: string;
  notes?: string;
  tags?: string[];
  [key: string]: any;
}

export interface BaseEntity {
  id: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  version?: number;
  status?: string;
  metadata?: EntityMetadata;
}

/**
 * Kiểu thực thể cốt lõi trong chuỗi phả hệ sản xuất:
 * Product -> TCCS -> Formula -> Batch -> TestResult -> Criteria -> Release
 */
export type CanonicalEntityType =
  | 'PRODUCT'
  | 'TCCS'
  | 'FORMULA'
  | 'RAW_MATERIAL'
  | 'BATCH'
  | 'TEST_RESULT'
  | 'CRITERIA_RESULT'
  | 'DEVIATION'
  | 'CHANGE_CONTROL'
  | 'APPROVAL'
  | 'RELEASE';
