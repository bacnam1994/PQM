/**
 * PQM 3.0 - Tiêu chuẩn cơ sở (TCCS) & Chỉ tiêu kiểm nghiệm
 */

export enum CriterionType {
  NUMBER = 'NUMBER',
  TEXT = 'TEXT',
}

export interface Criterion {
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
}

export interface SensoryCharacteristics {
  dosageForm: string;
  appearance: string;
  color: string;
  smellTaste: string;
}

export interface AlternateRule {
  main: string;
  alt: string;
  type?: 'FAIL_RETRY' | 'CONDITIONAL_CHECK';
  conditionValue?: string;
}

export interface TCCS {
  id: string;
  productId: string;
  code: string;
  issueDate: string;
  isActive: boolean;
  sensory?: SensoryCharacteristics;
  packaging?: string;
  /** @deprecated Thành phần đã được chuẩn hóa chuyển sang ProductFormula */
  composition?: string;
  storage?: string;
  shelfLife?: string;
  standardRefs?: string;
  mainQualityCriteria: Criterion[];
  safetyCriteria: Criterion[];
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
