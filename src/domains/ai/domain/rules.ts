/**
 * AI BOUNDARY DOMAIN: RULES (VS-15)
 * =================================
 * Rào chắn an ninh & ranh giới pháp lý cho AI:
 * 1. ZERO DIRECT MUTATION: AI không được phép trực tiếp ghi database hoặc thay đổi trạng thái nghiệp vụ.
 * 2. PROPOSAL ONLY: Mọi hành động can thiệp đều phải xuất ra dưới dạng Proposal.
 * 3. HUMAN CONFIRMATION: Bắt buộc con người xác nhận trước khi đưa vào Canonical Workflow.
 * 4. CONFIDENCE THRESHOLD: Kiểm soát độ tin cậy của suy luận AI.
 */

import { PermissionAction } from '../../../types/permissions';
import { AIConfidenceLevel } from './types';

export class AIBoundaryRules {
  /**
   * Khẳng định ranh giới tư vấn (Advisory Boundary)
   * Chặn đứng mọi nỗ lực trực tiếp gọi đột biến nghiệp vụ từ AI role
   */
  static assertAdvisoryBoundary(actionId: string, actorRole?: string): void {
    const role = (actorRole || '').toUpperCase();
    if (role === 'AI_ADVISORY' || role === 'AI' || role === 'COPILOT') {
      const forbiddenPrefixes = [
        'BATCH_RELEASE',
        'BATCH_RECALL',
        'TEST_RESULT_APPROVE',
        'SYSTEM_WIPE',
        'SYSTEM_RESTORE',
      ];
      if (forbiddenPrefixes.some((prefix) => actionId.startsWith(prefix))) {
        throw new Error(
          `[AI BOUNDARY VIOLATION] AI không được phép thực thi trực tiếp hành động ${actionId}. Thao tác bắt buộc phải thông qua Human-in-the-Loop Confirmation.`
        );
      }
    }
  }

  /**
   * Ánh xạ công cụ AI sang Quyền hạn RBAC tương ứng
   */
  static resolveToolPermission(toolName: string, payload: any): PermissionAction {
    switch (toolName) {
      case 'updateBatchStatus':
      case 'updateBatchStatusAction':
        if (payload?.status === 'RELEASED') return 'batch:release';
        if (payload?.status === 'REJECTED') return 'batch:reject';
        return 'batch:update';

      case 'createBatch':
      case 'createBatchAction':
        return 'batch:create';

      case 'createTestResult':
      case 'createTestResultAction':
        return 'test_result:create';

      case 'harmonizeMaterials':
        return 'material:update';

      case 'autoHealInconsistencies':
      case 'triggerAutoHealingAction':
        return 'settings:update';

      case 'queryDataNaturalLanguage':
      default:
        return 'ai:query';
    }
  }

  /**
   * Kiểm tra xem công cụ và payload có phải hành động Regulated bắt buộc phê duyệt không
   */
  static isRegulatedToolAction(toolName: string, payload: any): boolean {
    if (toolName === 'updateBatchStatus' || toolName === 'updateBatchStatusAction') {
      return payload?.status === 'RELEASED' || payload?.status === 'REJECTED';
    }
    if (
      toolName === 'autoHealInconsistencies' ||
      toolName === 'triggerAutoHealingAction' ||
      toolName === 'harmonizeMaterials'
    ) {
      return true;
    }
    return false;
  }

  /**
   * Tính toán điểm tin cậy chuẩn hóa (0.0 -> 1.0)
   */
  static calculateConfidenceScore(data: any): { score: number; level: AIConfidenceLevel } {
    if (!data) return { score: 0.5, level: 'MEDIUM' };

    // 1. Nếu có trường confidence trực tiếp
    if (typeof data.confidence === 'number') {
      const score = Math.max(0, Math.min(1, data.confidence));
      return {
        score,
        level: score >= 0.85 ? 'HIGH' : score >= 0.65 ? 'MEDIUM' : 'LOW',
      };
    }

    if (typeof data.confidence === 'string') {
      const upper = data.confidence.toUpperCase();
      if (upper === 'HIGH') return { score: 0.95, level: 'HIGH' };
      if (upper === 'MEDIUM') return { score: 0.75, level: 'MEDIUM' };
      if (upper === 'LOW') return { score: 0.5, level: 'LOW' };
    }

    // 2. Nếu có danh sách items/criteria có confidence
    if (Array.isArray(data.items) || Array.isArray(data.criteria) || Array.isArray(data.results)) {
      const list = (data.items || data.criteria || data.results) as any[];
      if (list.length > 0) {
        let totalScore = 0;
        let count = 0;
        for (const item of list) {
          if (typeof item.confidence === 'string') {
            const u = item.confidence.toUpperCase();
            totalScore += u === 'HIGH' ? 0.95 : u === 'LOW' ? 0.5 : 0.75;
            count++;
          } else if (typeof item.confidence === 'number') {
            totalScore += item.confidence;
            count++;
          }
        }
        if (count > 0) {
          const avg = totalScore / count;
          return {
            score: Number(avg.toFixed(2)),
            level: avg >= 0.85 ? 'HIGH' : avg >= 0.65 ? 'MEDIUM' : 'LOW',
          };
        }
      }
    }

    return { score: 0.7, level: 'MEDIUM' };
  }
}
