/**
 * AI BOUNDARY DOMAIN: AI ACTION GUARD (VS-15)
 * ============================================
 * Chốt chặn an ninh ngăn chặn AI Copilot tự ý thực thi các hành động Regulated.
 * Tuân thủ nguyên tắc: AI đề xuất -> Kiểm tra quyền -> Xác thực bằng chứng -> Người dùng phê duyệt -> Ghi vết Audit.
 */

import { can, normalizeUser } from '../../system/application/permissionService';
import { PermissionAction, ResourceContext } from '../../../types/permissions';
import { AIBoundaryRules } from '../domain/rules';
import { GuardValidationResult, AIActionProposal } from '../domain/types';

/**
 * Danh sách các hành động nhạy cảm trong ngành Dược (Regulated Actions)
 * Bắt buộc phải có sự xác nhận của người có thẩm quyền trước khi thực thi
 */
export const REGULATED_ACTIONS: Record<
  string,
  { permission: PermissionAction; isStrict: boolean }
> = {
  // Xuất xưởng lô
  'batch:release': { permission: 'batch:release', isStrict: true },
  'batch:reject': { permission: 'batch:reject', isStrict: true },
  'batch:update': { permission: 'batch:update', isStrict: false },
  'batch:create': { permission: 'batch:create', isStrict: false },

  // Phiếu kiểm nghiệm
  'test_result:approve': { permission: 'test_result:approve', isStrict: true },
  'test_result:create': { permission: 'test_result:create', isStrict: false },
  'test_result:update': { permission: 'test_result:update', isStrict: false },

  // Danh mục và chuẩn
  'material:harmonize': { permission: 'material:update', isStrict: true },
  'data:auto_heal': { permission: 'settings:update', isStrict: true },
};

export class AIActionGuard {
  /**
   * Chốt chặn xác thực hành động AI (AI Action Guard)
   */
  static validateAIAction(
    toolName: string,
    payload: any,
    user: any,
    evidence: string = '',
    resource?: ResourceContext
  ): GuardValidationResult {
    const identity = normalizeUser(user);
    const requiredPermission = AIBoundaryRules.resolveToolPermission(toolName, payload);
    const isRegulated = AIBoundaryRules.isRegulatedToolAction(toolName, payload);

    // 1. Kiểm tra xác thực người dùng
    if (!identity) {
      return {
        allowed: false,
        requiresUserApproval: false,
        requiredPermission,
        reason: 'Yêu cầu đăng nhập trước khi thực thi công cụ AI.',
      };
    }

    // 2. Kiểm tra thẩm quyền RBAC
    const hasPermission = can(identity, requiredPermission, resource);
    if (!hasPermission) {
      return {
        allowed: false,
        requiresUserApproval: false,
        requiredPermission,
        reason: `Từ chối: Tài khoản vai trò ${identity.role} không có quyền thực hiện [${requiredPermission}].`,
      };
    }

    // 3. Nếu là hành động Regulated, bắt buộc chuyển thành Proposal để người dùng xác nhận
    const proposal: AIActionProposal = {
      id: `prop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      toolName,
      targetEntity: resource?.id || payload?.batchId || payload?.id || 'GLOBAL',
      requiredPermission,
      isRegulated,
      requiresConfirmation: isRegulated,
      payload,
      evidence: evidence || 'Khuyến nghị được tạo tự động bởi AI Copilot.',
      rationale:
        payload?.rationale || payload?.reason || 'Thực thi theo yêu cầu của phiên hỗ trợ AI.',
      proposedAt: new Date().toISOString(),
      status: isRegulated ? 'PENDING_APPROVAL' : 'APPROVED',
    };

    return {
      allowed: true,
      requiresUserApproval: isRegulated,
      requiredPermission,
      proposal,
    };
  }

  static resolveToolPermission = AIBoundaryRules.resolveToolPermission;
  static isRegulatedToolAction = AIBoundaryRules.isRegulatedToolAction;
}

export const validateAIAction = AIActionGuard.validateAIAction;
export const resolveToolPermission = AIActionGuard.resolveToolPermission;
export const isRegulatedToolAction = AIActionGuard.isRegulatedToolAction;

export const aiActionGuard = {
  validateAIAction: AIActionGuard.validateAIAction,
  resolveToolPermission: AIActionGuard.resolveToolPermission,
  isRegulatedToolAction: AIActionGuard.isRegulatedToolAction,
};
