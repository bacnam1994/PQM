/**
 * PQM 3.0 - Tiêu chuẩn cơ sở (TCCS) & Chỉ tiêu kiểm nghiệm
 */

export enum CriterionType {
  NUMBER = 'NUMBER',
  TEXT = 'TEXT',
}

export type ConditionOperator = 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS' | 'CONTAINS' | 'BETWEEN';

export interface StructuredCondition {
  operator: ConditionOperator;
  thresholdValue: number | string;
  thresholdValueMax?: number;
}

export interface Criterion {
  /** Định danh bất biến toàn hệ thống (UUID v4 hoặc NanoID) */
  id?: string;
  /** Mã ngắn chỉ tiêu dùng cho phân tích (VD: CRIT_DO_AM) */
  code?: string;
  name: string;
  unit: string;
  min?: number;
  max?: number;
  expectedText?: string;
  type: CriterionType;
  category?: string;
  declaredContent?: string | number;
  formulaIngredientId?: string;
  calculationBasis?: 'DECLARED' | 'ELEMENTAL';
  /** Đánh dấu chỉ tiêu bắt buộc phải có kết quả */
  isRequired?: boolean;
  /** Thứ tự hiển thị */
  orderIndex?: number;
  /**
   * Khóa ngoại liên kết về MasterCriterion (`master_criteria/`).
   * Optional — tương thích ngược với dữ liệu TCCS cũ không có liên kết.
   * Khi có, Analytics sẽ Group By ID này thay vì chuỗi `name`.
   */
  masterCriterionId?: string;
  /** Phương pháp thử nghiệm (VD: DĐVN V, HPLC, TCVN...) */
  analysisMethod?: string;
}

export interface SensoryCharacteristics {
  dosageForm: string;
  appearance: string;
  color: string;
  smellTaste: string;
}

export interface AlternateRule {
  id?: string;
  /** ID chỉ tiêu chính (Tham chiếu về Criterion.id) */
  mainCriterionId?: string;
  /** ID chỉ tiêu phụ thuộc/thay thế (Tham chiếu về Criterion.id) */
  altCriterionId?: string;
  /** Tên chỉ tiêu chính (Tương thích ngược) */
  main: string;
  /** Tên chỉ tiêu thay thế (Tương thích ngược) */
  alt: string;
  type?: 'FAIL_RETRY' | 'CONDITIONAL_CHECK';
  /** Điều kiện có cấu trúc chuẩn */
  condition?: StructuredCondition;
  /** Chuỗi điều kiện cũ (Tương thích ngược) */
  conditionValue?: string;
  enabled?: boolean;
  note?: string;
  displayNote?: string;
}

export interface TCCS {
  id: string;
  productId: string;
  /** Tên sản phẩm gắn với TCCS (cache/de-normalized để tiện hiển thị) */
  productName?: string;
  code: string;
  issueDate?: string;
  isActive: boolean;
  sensory?: SensoryCharacteristics;
  packaging?: string;
  /** @deprecated Thành phần đã được chuẩn hóa chuyển sang ProductFormula */
  composition?: string;
  storage?: string;
  shelfLife?: string;
  standardRefs?: string;
  mainQualityCriteria: Criterion[];
  safetyCriteria?: Criterion[];
  alternateRules?: AlternateRule[];
  version?: number;
  createdAt: string;
  updatedAt?: string;
}

/**
 * CriteriaAlias — Bảng ánh xạ tên chỉ tiêu TCCS.
 * Lưu các tên cũ/alias của một chỉ tiêu để đảm bảo tương thích ngược
 * với phiếu kiểm nghiệm đã nhập trước khi TCCS được chỉnh sửa.
 */
export interface CriteriaAlias {
  id: string;
  tccsId: string; // ID của TCCS chứa chỉ tiêu chuẩn
  canonicalName: string; // Tên chuẩn HIỆN TẠI trong TCCS
  aliases: string[]; // Các tên cũ / biến thể (đã lowercase-trim)
  autoDetected: boolean; // true nếu do hệ thống tự phát hiện khi updateTCCS
  confirmedByAdmin: boolean; // true nếu Admin đã xác nhận ánh xạ
  createdAt: string;
  updatedAt: string;
}
