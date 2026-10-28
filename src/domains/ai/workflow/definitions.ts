/**
 * AI BOUNDARY DOMAIN: WORKFLOW DEFINITIONS (VS-15)
 * ================================================
 * Định danh Canonical Action IDs và phân định mức độ rủi ro (Risk Levels).
 * Toàn bộ các AI Canonical Actions đều ở mức rủi ro LOW hoặc NONE và KHÔNG tự động đột biến dữ liệu.
 */

import { WorkflowActionId } from '../../../workflow/contracts/actions';

export const AI_WORKFLOW_ACTIONS = {
  OCR_EXTRACT: 'AI_OCR_EXTRACT' as WorkflowActionId,
  MAPPING_PROPOSE: 'AI_MAPPING_PROPOSE' as WorkflowActionId,
  STABILITY_PREDICT: 'AI_STABILITY_PREDICT' as WorkflowActionId,
  BATCH_CLEARANCE_PROPOSE: 'AI_BATCH_CLEARANCE_PROPOSE' as WorkflowActionId,
  NATURAL_QUERY: 'AI_NATURAL_QUERY' as WorkflowActionId,
  VOICE_PARSE: 'AI_VOICE_PARSE' as WorkflowActionId,
  LAB_COMPARE: 'AI_LAB_COMPARE' as WorkflowActionId,
  DATA_INTEGRITY_SCAN: 'AI_DATA_INTEGRITY_SCAN' as WorkflowActionId,
  AUTO_HEAL_PROPOSE: 'SYSTEM_AUTO_HEAL_PROPOSE' as WorkflowActionId,
} as const;

export const AI_ACTION_LABELS: Record<string, string> = {
  AI_OCR_EXTRACT: 'Trích xuất dữ liệu phiếu kiểm nghiệm qua OCR/Vision',
  AI_MAPPING_PROPOSE: 'Đề xuất ánh xạ chỉ tiêu phiếu kiểm nghiệm với TCCS',
  AI_STABILITY_PREDICT: 'Dự báo độ ổn định và xu hướng chất lượng sản phẩm',
  AI_BATCH_CLEARANCE_PROPOSE: 'Đề xuất danh mục điều kiện xuất xưởng lô',
  AI_NATURAL_QUERY: 'Truy vấn cơ sở dữ liệu chất lượng bằng ngôn ngữ tự nhiên',
  AI_VOICE_PARSE: 'Chuyển đổi khẩu lệnh / giọng nói thành thông số kiểm nghiệm',
  AI_LAB_COMPARE: 'So sánh kết quả phân tích giữa các phòng kiểm nghiệm',
  AI_DATA_INTEGRITY_SCAN: 'Quét và phát hiện bất thường toàn vẹn dữ liệu chất lượng',
  SYSTEM_AUTO_HEAL_PROPOSE: 'Đề xuất giải pháp tự động khắc phục bất thường dữ liệu',
};
