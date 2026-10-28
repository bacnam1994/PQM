/**
 * PQM 3.0 - Quality Deviation & CAPA Workflow Types (GMP-WHO / 21 CFR Part 211)
 * ============================================================================
 * Định nghĩa cấu trúc Quản lý Sai lệch Chất lượng và Hành động Khắc phục/Phòng ngừa (CAPA)
 */

export type DeviationStatus =
  | 'LOGGED'                 // Mới phát hiện & ghi nhận sự cố
  | 'UNDER_INVESTIGATION'    // Đang tiến hành điều tra nguyên nhân gốc (Phase 1 & Phase 2)
  | 'CAPA_PLANNED'           // Đã xây dựng và phê duyệt kế hoạch CAPA
  | 'EFFECTIVENESS_REVIEW'   // Đang theo dõi và đánh giá hiệu quả CAPA
  | 'CLOSED';                // Đã đóng sai lệch sau khi hoàn tất xác minh

export type DeviationSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';

export type DeviationSource =
  | 'OOS_TEST_RESULT'        // Kết quả kiểm nghiệm không đạt tiêu chuẩn (OOS)
  | 'OOT_TREND'              // Xu hướng trôi dạt cận biên (OOT)
  | 'MANUFACTURING'          // Sự cố phát sinh trong quá trình sản xuất
  | 'RAW_MATERIAL'           // Sự cố nguyên liệu, bao bì đầu vào
  | 'STORAGE_ENVIRONMENT'    // Sai lệch điều kiện bảo quản nhiệt độ/độ ẩm
  | 'INTERNAL_AUDIT';        // Phát hiện qua tự thanh tra chất lượng

export interface CAPAActionItem {
  id: string;
  type: 'CORRECTIVE' | 'PREVENTIVE' | 'IMMEDIATE';
  action: string;
  responsible: string;
  deadline: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
  verificationMethod?: string;
  completedAt?: string;
}

export interface QualityDeviation {
  id: string;
  deviationNo: string;       // Mã sai lệch, ví dụ: "DEV-2026-0001"
  title: string;
  source: DeviationSource;
  status: DeviationStatus;
  severity: DeviationSeverity;

  // Liên kết hồ sơ Lô & Kiểm nghiệm
  batchId?: string;
  batchNo?: string;
  productId?: string;
  productName?: string;
  testResultId?: string;
  failedCriteria?: {
    name: string;
    actualValue: string | number;
    specification: string;
  }[];

  // Chi tiết nội dung điều tra
  description: string;
  immediateAction?: string;
  rootCause?: string;
  ishikawaSummary?: string;
  fiveWhySummary?: string;

  // Kế hoạch CAPA
  capaItems?: CAPAActionItem[];

  // Người ghi nhận & Người phụ trách
  loggedBy: string;
  loggedAt: string;
  investigator?: string;
  investigatedAt?: string;
  closedBy?: string;
  closedAt?: string;
  closureNotes?: string;

  version: number;
  updatedAt: string;
}

export interface CreateDeviationInput {
  title: string;
  source: DeviationSource;
  severity: DeviationSeverity;
  description: string;
  batchId?: string;
  batchNo?: string;
  productId?: string;
  productName?: string;
  testResultId?: string;
  failedCriteria?: {
    name: string;
    actualValue: string | number;
    specification: string;
  }[];
  immediateAction?: string;
}
