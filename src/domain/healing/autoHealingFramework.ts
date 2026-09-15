/**
 * PQM Domain - Auto-Healing Framework (Model 8)
 * Sửa sai dữ liệu có kiểm soát theo chuẩn GMP.
 *
 * Quy trình 8 bước:
 * Detect
 *  ↓
 * Classify
 *  ↓
 * Evaluate confidence
 *  ↓
 * Determine healing strategy
 *  ↓
 * Preview
 *  ↓
 * Approve / Auto-heal
 *  ↓
 * Audit
 *  ↓
 * Verify
 */

import { HealingStrategyType, CanonicalConsistencyIssue } from '../consistency/consistencyModel';

export interface HealingPlanPreview {
  issueId: string;
  strategy: HealingStrategyType;
  entityType: string;
  entityId: string;
  field: string;
  currentValue: any;
  proposedValue: any;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  impactAnalysis: string;
  requiresManualApproval: boolean;
}

export interface HealingExecutionResult {
  success: boolean;
  issueId: string;
  healedAt: string;
  healedBy: string;
  auditRecordId?: string;
  error?: string;
}

export class AutoHealingFramework {
  /**
   * Phân loại chiến lược hàn gắn an toàn dựa trên thuộc tính và bản chất của lỗi
   */
  public static determineHealingStrategy(
    entityType: string,
    field: string,
    issueType: string
  ): HealingStrategyType {
    // 1. NEVER AUTO-HEAL: Tuyệt đối không bao giờ tự động sửa kết quả gốc phòng lab, chữ ký số, audit trail
    if (
      field === 'results' ||
      field === 'value' ||
      field === 'rawMeasurement' ||
      field === 'signature' ||
      field === 'electronicSignature' ||
      entityType === 'AUDIT_LOG' ||
      entityType === 'ELECTRONIC_SIGNATURE'
    ) {
      return 'NEVER_AUTO_HEAL';
    }

    // 2. SAFE AUTO-HEAL: Các trường phái sinh, chuẩn hóa format chuỗi ("Đạt" -> "PASS"), index, alias mồ côi
    if (
      field === 'overallStatusFormat' ||
      field === 'searchIndex' ||
      issueType === 'UNNORMALIZED_TEST_LAB' ||
      issueType === 'ORPHAN_ALIAS' ||
      issueType === 'STALE_DERIVED_DATA'
    ) {
      return 'SAFE_AUTO_HEAL';
    }

    // 3. CONTROLLED HEAL: Sửa khóa ngoại trỏ bằng số lô, liên kết nguyên liệu, cập nhật trạng thái Lô
    return 'CONTROLLED_HEAL';
  }

  /**
   * Tạo bản xem trước kế hoạch hàn gắn (Preview Step)
   */
  public static previewHealing(issue: CanonicalConsistencyIssue): HealingPlanPreview {
    const strategy =
      issue.healingStrategy ||
      this.determineHealingStrategy(issue.entityType, issue.field || '', issue.type);

    const requiresManualApproval = strategy === 'CONTROLLED_HEAL';
    const confidence =
      strategy === 'SAFE_AUTO_HEAL' ? 'HIGH' : strategy === 'CONTROLLED_HEAL' ? 'MEDIUM' : 'LOW';

    let impact = 'Tác động thấp: Chỉ chuẩn hóa dữ liệu phái sinh hoặc định dạng hiển thị.';
    if (strategy === 'CONTROLLED_HEAL') {
      impact = 'Tác động trung bình: Cập nhật khóa ngoại hoặc thuộc tính nghiệp vụ chính.';
    } else if (strategy === 'NEVER_AUTO_HEAL') {
      impact =
        'CẤM TỰ ĐỘNG SỬA: Vi phạm tính toàn vẹn dữ liệu gốc GMP (ALCOA+). Yêu cầu thẩm định thủ công.';
    }

    return {
      issueId: issue.id,
      strategy,
      entityType: issue.entityType,
      entityId: issue.entityId,
      field: issue.field || 'unknown',
      currentValue: issue.actual,
      proposedValue: issue.expected,
      confidence,
      impactAnalysis: impact,
      requiresManualApproval,
    };
  }
}
