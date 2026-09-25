/**
 * CHANGE REQUEST DOMAIN: WORKFLOW DEFINITIONS
 */

import { WorkflowActionId } from '../../../workflow/contracts/actions';
import { ChangeCategory, ChangeStatus, ChangeType } from '../domain/types';

export const CHANGE_REQUEST_ACTIONS: Record<string, WorkflowActionId> = {
  CREATE: 'CHANGE_REQUEST_CREATE',
  FMEA_ASSESS: 'CHANGE_REQUEST_FMEA_ASSESS',
  ADD_ACTION: 'CHANGE_REQUEST_ADD_ACTION',
  COMPLETE_ACTION: 'CHANGE_REQUEST_COMPLETE_ACTION',
  REVIEW: 'CHANGE_REQUEST_REVIEW',
  APPROVE: 'CHANGE_REQUEST_APPROVE',
  REJECT: 'CHANGE_REQUEST_REJECT',
  IMPLEMENT: 'CHANGE_REQUEST_IMPLEMENT',
  CLOSE: 'CHANGE_REQUEST_CLOSE',
} as const;

export const CHANGE_STATUS_LABELS: Record<ChangeStatus, string> = {
  DRAFT: 'Bản nháp',
  IMPACT_ASSESSMENT: 'Đánh giá tác động',
  QA_REVIEW: 'QA xem xét',
  APPROVED: 'Đã phê duyệt',
  IMPLEMENTATION: 'Đang triển khai',
  EFFECTIVENESS_VERIFICATION: 'Thẩm tra hiệu quả',
  CLOSED: 'Đã đóng',
  REJECTED: 'Đã từ chối',
};

export const CHANGE_CATEGORY_LABELS: Record<ChangeCategory, string> = {
  FORMULA: 'Công thức sản phẩm',
  RAW_MATERIAL: 'Nguyên liệu / Nhà cung cấp',
  MANUFACTURING_PROCESS: 'Quy trình sản xuất',
  ANALYTICAL_METHOD: 'Phương pháp thử kiểm nghiệm',
  EQUIPMENT: 'Thiết bị sản xuất / Phân tích',
  PACKAGING: 'Bao bì đóng gói',
  SPECIFICATION: 'Tiêu chuẩn cơ sở (TCCS)',
};

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  MINOR: 'Nhỏ (Minor)',
  MAJOR: 'Lớn (Major)',
  CRITICAL: 'Nghiêm trọng (Critical)',
  EMERGENCY: 'Khẩn cấp (Emergency)',
};
