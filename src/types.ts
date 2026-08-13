
export enum CriterionType {
  NUMBER = 'NUMBER',
  TEXT = 'TEXT'
}

export type SyncStatus = 'IDLE' | 'SAVED' | 'SAVING' | 'ERROR' | 'OFFLINE';
export type ProductStatus = 'ACTIVE' | 'DISCONTINUED' | 'RECALLED';

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
  alternateRules?: { main: string; alt: string; type?: 'FAIL_RETRY' | 'CONDITIONAL_CHECK'; conditionValue?: string }[];
  createdAt: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  group: string;
  registrationNo: string;
  registrationDate: string;
  registrant: string;
  status: ProductStatus;
  description: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormulaIngredient {
  id: string;
  name: string;
  declaredContent: number;
  elementalContent?: number;
  materialId?: string; // Liên kết với RawMaterial để quản lý kho/nhóm
  unit: string;
}

export interface ProductFormula {
  id: string;
  productId: string;
  ingredients: FormulaIngredient[];
  excipients?: FormulaIngredient[];
  sensory?: SensoryCharacteristics;
  packaging?: string;
  storage?: string;
  shelfLife?: string;
  standardRefs?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RawMaterial {
  id: string;
  code?: string; // Mã nguyên liệu (nếu có)
  name: string; // Tên gốc/chuẩn
  aliases: string[]; // Các tên gọi khác
  category: 'ACTIVE' | 'EXCIPIENT' | 'OTHER'; // Phân loại: Hoạt chất, Tá dược, Khác
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: string;
  productId: string;
  tccsId: string;
  batchNo: string;
  mfgDate: string;
  expDate: string;
  theoreticalYield: number;
  actualYield: number;
  yieldUnit: string;
  packaging?: string;
  status: 'PENDING' | 'TESTING' | 'RELEASED' | 'REJECTED';
  rejectReason?: string;
  progressPercent?: number;
  createdAt: string;
  updatedAt?: string;
}

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
  createdAt: string;
}

export interface AILearnedMapping {
  id: string;
  originalName: string;   // Tên gốc do AI trích xuất (ví dụ: Moisture)
  systemName: string;     // Tên tiêu chuẩn trong hệ thống (ví dụ: Độ ẩm)
  frequency: number;      // Số lần ánh xạ này được người dùng xác nhận
  createdAt?: string;
  updatedAt?: string;
}

/**
 * CriteriaAlias — Bảng ánh xạ tên chỉ tiêu TCCS.
 * Lưu các tên cũ/alias của một chỉ tiêu để đảm bảo tương thích ngược
 * với phiếu kiểm nghiệm đã nhập trước khi TCCS được chỉnh sửa.
 */
export interface CriteriaAlias {
  id: string;
  tccsId: string;           // ID của TCCS chứa chỉ tiêu chuẩn
  canonicalName: string;    // Tên chuẩn HIỆN TẠI trong TCCS
  aliases: string[];        // Các tên cũ / biến thể (đã lowercase-trim)
  autoDetected: boolean;    // true nếu do hệ thống tự phát hiện khi updateTCCS
  confirmedByAdmin: boolean; // true nếu Admin đã xác nhận ánh xạ
  createdAt: string;
  updatedAt: string;
}

export interface QualityAnomaly {
  id?: string;
  type: 'DRIFT' | 'EXPIRY' | 'HIGH_FAIL_RATE' | 'MISSING_DATA';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  detail: string;
  productName?: string;
  batchNo?: string;
}

export interface AppState {
  products: Product[];
  tccsList: TCCS[];
  productFormulas: ProductFormula[];
  batches: Batch[];
  rawMaterials: RawMaterial[];
  /** testResults: Danh sách phiếu kiểm nghiệm phân trang theo testResultLimit (mặc định 50 phiếu gần nhất) */
  testResults: TestResult[];
  /** allTestResults: Toàn bộ phiếu kiểm nghiệm khi được tải riêng để phân tích Dashboard / Báo cáo */
  allTestResults?: TestResult[];
  lastSync: string | null;
  aiLearnedMappings: AILearnedMapping[];
  qualityAlerts: QualityAnomaly[];
  criteriaAliases: CriteriaAlias[];
}
