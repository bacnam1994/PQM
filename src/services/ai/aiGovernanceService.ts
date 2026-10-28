/**
 * PQM V4 Platform - AI Governance & Risk Management Engine
 * Kiểm soát và giám sát mọi hoạt động của AI trong ngành Dược phẩm/Biotech
 * Tuân thủ nguyên tắc "Human-in-the-Loop", Phân cấp rủi ro & Tiêu chuẩn Độ tin cậy.
 */

export type AIRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type ConfidenceDecision = 'AUTO_ACCEPT' | 'REQUIRE_REVIEW' | 'FORCE_MANUAL';

export interface AIRunAuditRecord {
  runId: string;
  feature: string;
  riskLevel: AIRiskLevel;
  model: string;
  promptVersion: string;
  confidence: number;
  inputSummary: string;
  outputRecommendation: string;
  humanDecision?: 'ACCEPTED' | 'MODIFIED' | 'REJECTED';
  overrideReason?: string;
  decidedBy?: string;
  timestamp: string;
}

export interface RiskEvaluationResult {
  riskLevel: AIRiskLevel;
  reason: string;
  requiresHumanSignoff: boolean;
}

export interface ConfidencePolicyResult {
  decision: ConfidenceDecision;
  confidence: number;
  message: string;
}

export class AIGovernanceService {
  /**
   * Phân cấp mức độ rủi ro theo loại nghiệp vụ (Phân cấp theo GMP & GAMP 5)
   */
  static classifyRisk(feature: string, payload?: any): RiskEvaluationResult {
    // 1. Rủi ro CAO (HIGH RISK): Tác động trực tiếp đến an toàn bệnh nhân & xuất xưởng sản phẩm
    const highRiskFeatures = [
      'BATCH_CLEARANCE',
      'OOS_INVESTIGATION',
      'RELEASE_DOSSIER',
      'DEVIATION_CLOSURE',
      'AUTO_HEAL_DATABASE'
    ];

    if (highRiskFeatures.includes(feature) || payload?.status === 'RELEASED') {
      return {
        riskLevel: 'HIGH',
        reason: 'Nghiệp vụ ảnh hưởng trực tiếp đến trạng thái Lô sản xuất và an toàn Dược phẩm. Bắt buộc phê duyệt có chữ ký số của QA.',
        requiresHumanSignoff: true
      };
    }

    // 2. Rủi ro TRUNG BÌNH (MEDIUM RISK): Tác động đến phân tích, dự báo, so sánh Lab
    const mediumRiskFeatures = [
      'STABILITY_PREDICTION',
      'LAB_COMPARISON',
      'TREND_ANALYSIS',
      'TCCS_FORMULATION',
      'MATERIAL_HARMONIZATION'
    ];

    if (mediumRiskFeatures.includes(feature)) {
      return {
        riskLevel: 'MEDIUM',
        reason: 'Nghiệp vụ dự báo hoặc chuẩn hóa dữ liệu. Cần nhân sự chuyên môn xem xét trước khi áp dụng.',
        requiresHumanSignoff: true
      };
    }

    // 3. Rủi ro THẤP (LOW RISK): Tìm kiếm, tóm tắt, OCR trích xuất
    return {
      riskLevel: 'LOW',
      reason: 'Nghiệp vụ tra cứu thông tin hoặc trợ giúp nhập liệu. Không tự ý thay đổi dữ liệu hệ thống.',
      requiresHumanSignoff: false
    };
  }

  /**
   * Đánh giá chính sách độ tin cậy của AI (Confidence Threshold Policy)
   */
  static evaluateConfidence(confidenceScore: number): ConfidencePolicyResult {
    const score = Math.max(0, Math.min(100, confidenceScore));

    // >= 95%: Độ tin cậy cao, hỗ trợ tự điền nháp (Auto-fill Draft)
    if (score >= 95) {
      return {
        decision: 'AUTO_ACCEPT',
        confidence: score,
        message: `Độ tin cậy rất cao (${score}%). Khuyến nghị sử dụng làm bản nháp ưu tiên.`
      };
    }

    // 70% - 94%: Cần kiểm tra kỹ lưỡng (Review Required)
    if (score >= 70) {
      return {
        decision: 'REQUIRE_REVIEW',
        confidence: score,
        message: `Độ tin cậy mức khá (${score}%). Bắt buộc người dùng phải kiểm tra đối chiếu trước khi lưu.`
      };
    }

    // < 70%: Độ tin cậy thấp, bắt buộc nhập liệu thủ công
    return {
      decision: 'FORCE_MANUAL',
      confidence: score,
      message: `Độ tin cậy thấp (${score}% < 70%). Bắt buộc nhập liệu thủ công để đảm bảo toàn vẹn dữ liệu.`
    };
  }

  /**
   * Tạo bản ghi kiểm toán cuộc chạy AI (AIRunAuditRecord)
   */
  static createRunRecord(
    feature: string,
    model: string,
    promptVersion: string,
    confidence: number,
    inputSummary: string,
    outputRecommendation: string,
    payload?: any
  ): AIRunAuditRecord {
    const riskEval = this.classifyRisk(feature, payload);

    return {
      runId: `airun_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      feature,
      riskLevel: riskEval.riskLevel,
      model,
      promptVersion,
      confidence,
      inputSummary,
      outputRecommendation,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Ghi nhận quyết định của con người (Human-in-the-Loop decision)
   */
  static recordHumanSignoff(
    record: AIRunAuditRecord,
    decision: 'ACCEPTED' | 'MODIFIED' | 'REJECTED',
    userEmail: string,
    overrideReason?: string
  ): AIRunAuditRecord {
    return {
      ...record,
      humanDecision: decision,
      decidedBy: userEmail,
      overrideReason: decision !== 'ACCEPTED' ? (overrideReason || 'Người dùng điều chỉnh hoặc từ chối kết quả AI') : undefined
    };
  }
}
