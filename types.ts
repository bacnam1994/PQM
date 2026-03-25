
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
  composition?: string; // Đã chuyển sang ProductFormula, không còn sử dụng
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
  createdAt: string;
  updatedAt?: string;
}

/**
 * Module Nhập kho (Inventory In)
 */
export interface InventoryIn {
  id: string;
  batchId: string;
  quantity: number;
  inDate: string;
  note?: string;
  createdAt: string;
}

/**
 * Module Xuất kho (Inventory Out)
 */
export interface InventoryOut {
  id: string;
  batchId: string;
  quantity: number;
  outDate: string;
  receiver?: string;
  note?: string;
  createdAt: string;
}

export interface TestResultEntry {
  criteriaName: string;
  value: string | number;
  isPass: boolean;
  isExtra?: boolean;
  unit?: string;
}

export interface FishboneData {
  man: string;
  machine: string;
  material: string;
  method: string;
  measurement: string;
  environment: string;
}

export interface TestResult {
  id: string;
  batchId: string;
  batch?: Batch;
  labName: string;
  testDate: string;
  results: TestResultEntry[];
  overallStatus: 'PASS' | 'FAIL';
  notes?: string;
  createdAt: string;
  fishbone?: FishboneData;
}

export interface AppState {
  products: Product[];
  tccsList: TCCS[];
  productFormulas: ProductFormula[];
  batches: Batch[];
  rawMaterials: RawMaterial[];
  testResults: TestResult[];
  inventoryIn: InventoryIn[]; // Mới
  inventoryOut: InventoryOut[];
  lastSync: string | null;
}
