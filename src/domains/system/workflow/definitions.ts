/**
 * SYSTEM DOMAIN: WORKFLOW DEFINITIONS (VS-14)
 * ===========================================
 * Định danh Canonical Action IDs và metadata quy trình cho Hệ thống.
 */

import { WorkflowActionId } from '../../../workflow/contracts/actions';

export const SYSTEM_WORKFLOW_ACTIONS = {
  BACKUP: 'SYSTEM_BACKUP_EXECUTE' as WorkflowActionId,
  RESTORE: 'SYSTEM_RESTORE_EXECUTE' as WorkflowActionId,
  WIPE: 'SYSTEM_WIPE_DEMO_EXECUTE' as WorkflowActionId,
  RESET_DEMO: 'SYSTEM_WIPE_DEMO_EXECUTE' as WorkflowActionId,
  CONFIG_UPDATE: 'SYSTEM_CONFIG_UPDATE' as WorkflowActionId,
  USER_ROLE_ASSIGN: 'SYSTEM_USER_ROLE_ASSIGN' as WorkflowActionId,
  AUTO_HEAL_PROPOSE: 'SYSTEM_AUTO_HEAL_PROPOSE' as WorkflowActionId,
  AUTO_HEAL_APPROVE: 'SYSTEM_AUTO_HEAL_APPROVE' as WorkflowActionId,
  AUTO_HEAL_EXECUTE: 'SYSTEM_AUTO_HEAL_EXECUTE' as WorkflowActionId,
} as const;

export const SYSTEM_ACTION_LABELS: Record<string, string> = {
  SYSTEM_BACKUP_EXECUTE: 'Sao lưu toàn bộ cơ sở dữ liệu hệ thống',
  SYSTEM_RESTORE_EXECUTE: 'Khôi phục cơ sở dữ liệu hệ thống từ snapshot',
  SYSTEM_WIPE_DEMO_EXECUTE: 'Dọn sạch hoặc thiết lập lại cơ sở dữ liệu hệ thống',
  SYSTEM_CONFIG_UPDATE: 'Cập nhật tham số cấu hình hệ thống',
  SYSTEM_USER_ROLE_ASSIGN: 'Phân bổ hoặc cập nhật vai trò người dùng',
  SYSTEM_AUTO_HEAL_PROPOSE: 'Đề xuất giải pháp tự phục hồi hệ thống',
  SYSTEM_AUTO_HEAL_APPROVE: 'Phê duyệt giải pháp tự phục hồi hệ thống',
  SYSTEM_AUTO_HEAL_EXECUTE: 'Thực thi quy trình tự phục hồi hệ thống',
};
