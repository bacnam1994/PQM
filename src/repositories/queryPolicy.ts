/**
 * PQM Repository Architecture - Query Policy & Fail-Closed Enforcement
 * Tuân thủ PRINCIPLE-010 (Fail Closed) và Model 00 System Workflow Master.
 *
 * Quy tắc cốt lõi:
 * 1. REGULATED DATA (batches, testResults, products, tccsList, productFormulas, rawMaterials, audit_logs):
 *    - requireIndexedQuery = true
 *    - noFullScanFallback = true
 *    - failClosed = true
 *    Tuyệt đối cấm fallback quét cạn toàn bộ database (findAll / full scan) khi truy vấn có chỉ mục hoặc phân trang thất bại.
 * 2. NON-REGULATED DATA (master_criteria, criteria_aliases, aiLearnedMappings, pharmacopoeia_standards):
 *    - fallbackAllowed = true
 */

export type DataClassification = 'REGULATED' | 'NON_REGULATED';

export interface QueryPolicy {
  collectionPath: string;
  classification: DataClassification;
  requireIndexedQuery: boolean;
  noFullScanFallback: boolean;
  failClosed: boolean;
}

/**
 * Danh sách collection bắt buộc quản lý theo chuẩn Regulated (GMP & ALCOA+)
 */
export const REGULATED_COLLECTIONS: ReadonlySet<string> = new Set([
  'batches',
  'testResults',
  'products',
  'tccs',
  'tccsList',
  'product_formulas',
  'productFormulas',
  'rawMaterials',
  'raw_materials',
  'audit_logs',
  'deviations',
  'change_controls',
  'signatures',
]);

/**
 * Lỗi từ chối truy vấn do vi phạm chính sách Fail-Closed
 */
export class FailClosedQueryError extends Error {
  public readonly code = 'FAIL_CLOSED_QUERY_REJECTED';
  public readonly collection: string;

  constructor(collection: string, operation: string, originalError?: any) {
    super(
      `[FAIL-CLOSED POLICY] Truy vấn trên collection dữ liệu kiểm soát '${collection}' (thao tác: ${operation}) bị từ chối do lỗi index/kết nối. Cấm fallback quét toàn bộ cơ sở dữ liệu (Full Scan Forbidden). Chi tiết: ${originalError?.message || String(originalError)}`
    );
    this.name = 'FailClosedQueryError';
    this.collection = collection;
  }
}

/**
 * Trích xuất QueryPolicy cho một collection cụ thể
 */
export function getQueryPolicy(collectionPath: string): QueryPolicy {
  const isRegulated = REGULATED_COLLECTIONS.has(collectionPath);

  if (isRegulated) {
    return {
      collectionPath,
      classification: 'REGULATED',
      requireIndexedQuery: true,
      noFullScanFallback: true,
      failClosed: true,
    };
  }

  return {
    collectionPath,
    classification: 'NON_REGULATED',
    requireIndexedQuery: false,
    noFullScanFallback: false,
    failClosed: false,
  };
}
