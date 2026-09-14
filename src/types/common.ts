/**
 * PQM 3.0 - Các kiểu dữ liệu trạng thái chung, AI & Giám sát chất lượng
 */

import { Product, ProductFormula, RawMaterial } from './product';
import { TCCS, CriteriaAlias } from './tccs';
import { Batch } from './batch';
import { TestResult } from './testResult';
import { TestingLaboratory } from './laboratory';

export type SyncStatus = 'IDLE' | 'SAVED' | 'SAVING' | 'ERROR' | 'OFFLINE';

export interface AILearnedMapping {
  id: string;
  originalName: string; // Tên gốc do AI trích xuất (ví dụ: Moisture)
  systemName: string; // Tên tiêu chuẩn trong hệ thống (ví dụ: Độ ẩm)
  frequency: number; // Số lần ánh xạ này được người dùng xác nhận
  autoLearned?: boolean; // true nếu do AI tự học (OCR high-confidence), không phải user xác nhận
  createdAt?: string;
  updatedAt?: string;
}

/**
 * AIInsight — Phân tích chủ động do AI sinh ra (không cần user hỏi).
 * Lưu tạm trong localStorage để hiển thị Morning Briefing khi mở Chat.
 */
export interface AIInsight {
  id: string;
  type:
    | 'DRIFT_RISK'
    | 'HIGH_FAIL_RATE'
    | 'EXPIRY_RISK'
    | 'OCR_PATTERN'
    | 'QUALITY_TREND'
    | 'DATA_COMPLETENESS';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string; // Tiêu đề ngắn gọn (hiển thị đậm)
  detail: string; // Nội dung chi tiết (markdown)
  productId?: string;
  productName?: string;
  criteriaName?: string;
  generatedAt: string; // ISO timestamp
  isRead?: boolean;
}

/**
 * AISessionMemory — Bộ nhớ liên phiên cho từng người dùng.
 * Lưu tóm tắt các cuộc trò chuyện gần nhất trong localStorage.
 */
export interface AISessionSummary {
  summary: string; // Tóm tắt nội dung phiên (tối đa 300 token)
  timestamp: string; // ISO timestamp khi tóm tắt
  modelUsed?: string; // Model đã dùng
}

export interface QualityAnomaly {
  id?: string;
  type:
    | 'DRIFT'
    | 'EXPIRY'
    | 'HIGH_FAIL_RATE'
    | 'MISSING_DATA'
    | 'OOT_NEAR_LIMIT'
    | 'OOT_SIGMA_SHIFT';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  detail: string;
  productName?: string;
  batchNo?: string;
  criteriaName?: string;
  recommendation?: string;
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
  testingLaboratories?: TestingLaboratory[];
}
