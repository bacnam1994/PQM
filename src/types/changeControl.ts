/**
 * PQM V4 Platform - Change Control Data Models (GMP-WHO / ICH Q10)
 * Quản lý Yêu cầu Thay đổi (Change Request) trong sản xuất, kiểm nghiệm và tiêu chuẩn
 */

export type ChangeCategory =
  | 'FORMULA'                 // Thay đổi công thức sản phẩm
  | 'RAW_MATERIAL'            // Thay đổi nguyên liệu / nhà cung cấp
  | 'MANUFACTURING_PROCESS'   // Thay đổi quy trình sản xuất
  | 'ANALYTICAL_METHOD'       // Thay đổi phương pháp thử kiểm nghiệm
  | 'EQUIPMENT'               // Thay đổi thiết bị sản xuất / lab
  | 'PACKAGING'               // Thay đổi bao bì đóng gói
  | 'SPECIFICATION';          // Thay đổi Tiêu chuẩn cơ sở (TCCS)

export type ChangeType = 'MINOR' | 'MAJOR' | 'CRITICAL' | 'EMERGENCY';

export type ChangeStatus =
  | 'DRAFT'
  | 'IMPACT_ASSESSMENT'
  | 'QA_REVIEW'
  | 'APPROVED'
  | 'IMPLEMENTATION'
  | 'EFFECTIVENESS_VERIFICATION'
  | 'CLOSED'
  | 'REJECTED';

export interface FMEARiskAssessment {
  severity: number;      // 1 (Nhẹ) -> 5 (Rất nghiêm trọng)
  probability: number;   // 1 (Hiếm gặp) -> 5 (Thường xuyên)
  detectability: number; // 1 (Dễ phát hiện) -> 5 (Khó phát hiện)
  rpn: number;           // S * P * D (1 - 125)
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  mitigationPlan?: string;
}

export interface ChangeActionItem {
  id: string;
  title: string;
  responsible: string;
  deadline: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  completedAt?: string;
  notes?: string;
}

export interface ChangeRequest {
  id: string;
  crNo: string; // VD: "CR-2026-0001"
  title: string;
  category: ChangeCategory;
  changeType: ChangeType;
  status: ChangeStatus;

  // Đối tượng liên đới
  productId?: string;
  productName?: string;
  tccsId?: string;
  tccsCode?: string;

  // Diễn giải lý do & nội dung thay đổi
  justification: string;
  description: string;
  targetImplementationDate: string;

  // Đánh giá rủi ro FMEA
  riskAssessment?: FMEARiskAssessment;

  // Kế hoạch hành động triển khai
  actionItems?: ChangeActionItem[];

  // Audit & Phê duyệt
  proposedBy: string;
  proposedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  closureNotes?: string;
  closedBy?: string;
  closedAt?: string;

  version: number;
  updatedAt: string;
}

export interface CreateChangeRequestInput {
  title: string;
  category: ChangeCategory;
  changeType: ChangeType;
  justification: string;
  description: string;
  targetImplementationDate: string;
  productId?: string;
  productName?: string;
  tccsId?: string;
  tccsCode?: string;
}
