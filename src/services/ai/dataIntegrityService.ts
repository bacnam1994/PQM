/**
 * dataIntegrityService.ts
 * =======================
 * Dịch vụ AI Giám sát Toàn vẹn Dữ liệu (ALCOA+ Data Integrity Watchdog).
 * Tự động rà soát Audit Trail và tính điểm tuân thủ theo tiêu chuẩn GMP WHO & FDA 21 CFR Part 11.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiKey, getGeminiModel } from './geminiService';
import { TestResult, Batch } from '../../types';

export interface AuditLogEntry {
  id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  action: string;
  entityType: 'TEST_RESULT' | 'BATCH' | 'PRODUCT' | 'TCCS' | 'SYSTEM';
  entityId: string;
  details?: any;
  timestamp: string;
  ipAddress?: string;
}

export interface IntegrityFinding {
  id: string;
  principle: 'ATTRIBUTABLE' | 'LEGIBLE' | 'CONTEMPORANEOUS' | 'ORIGINAL' | 'ACCURATE' | 'COMPLETE_CONSISTENT';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  entityId?: string;
  entityName?: string;
  timestamp?: string;
  suggestedAction: string;
}

export interface DataIntegrityAuditReport {
  overallScore: number; // 0 - 100
  grade: 'A_EXCELLENT' | 'B_GOOD' | 'C_NEEDS_IMPROVEMENT' | 'D_CRITICAL_NON_COMPLIANCE';
  summary: string;
  totalLogsAnalyzed: number;
  findings: IntegrityFinding[];
  scoreBreakdown: {
    attributable: number;
    legible: number;
    contemporaneous: number;
    original: number;
    accurate: number;
    complete: number;
  };
  generatedAt: string;
}

/**
 * Kiểm tra xem một mốc thời gian có phải ngoài giờ hành chính không (21h - 6h sáng)
 */
export const isOffHours = (isoTimestamp: string): boolean => {
  try {
    const d = new Date(isoTimestamp);
    const hour = d.getHours();
    return hour >= 21 || hour < 6;
  } catch {
    return false;
  }
};

/**
 * Rà soát nhật ký kiểm toán và dữ liệu kiểm nghiệm để sinh báo cáo ALCOA+
 */
export const auditDataIntegrity = (
  auditLogs: AuditLogEntry[] = [],
  testResults: TestResult[] = [],
  batches: Batch[] = []
): DataIntegrityAuditReport => {
  const findings: IntegrityFinding[] = [];
  let scoreAttributable = 100;
  let scoreLegible = 100;
  let scoreContemporaneous = 100;
  let scoreOriginal = 100;
  let scoreAccurate = 100;
  let scoreComplete = 100;

  // 1. Kiểm tra Attributable: Các log thiếu User Email hoặc thực hiện bởi Guest
  auditLogs.forEach(log => {
    if (!log.userEmail || log.userEmail === 'unknown') {
      findings.push({
        id: `finding_attr_${log.id}`,
        principle: 'ATTRIBUTABLE',
        severity: 'MEDIUM',
        title: 'Hành động không xác định danh tính người thao tác',
        description: `Bản ghi thao tác "${log.action}" trên ${log.entityType} (${log.entityId}) thiếu định danh người dùng.`,
        entityId: log.entityId,
        timestamp: log.timestamp,
        suggestedAction: 'Bắt buộc xác thực tài khoản trước khi thực hiện mọi thao tác ghi dữ liệu.'
      });
      scoreAttributable = Math.max(0, scoreAttributable - 5);
    }
  });

  // 2. Kiểm tra Contemporaneous: Thao tác ngoài giờ hoặc cách xa ngày kiểm nghiệm thực tế
  auditLogs.forEach(log => {
    if (isOffHours(log.timestamp)) {
      findings.push({
        id: `finding_time_${log.id}`,
        principle: 'CONTEMPORANEOUS',
        severity: 'LOW',
        title: 'Thao tác dữ liệu ngoài giờ hành chính',
        description: `Người dùng ${log.userEmail || 'N/A'} thực hiện "${log.action}" vào thời gian ${new Date(log.timestamp).toLocaleString('vi-VN')}.`,
        entityId: log.entityId,
        timestamp: log.timestamp,
        suggestedAction: 'Xác minh sự phù hợp ca làm việc và lý do thao tác ngoài giờ.'
      });
      scoreContemporaneous = Math.max(0, scoreContemporaneous - 3);
    }
  });

  // 3. Kiểm tra Original: Phiếu kiểm nghiệm không đính kèm file gốc (PDF/Ảnh)
  testResults.forEach(tr => {
    if (!tr.attachments || tr.attachments.length === 0) {
      findings.push({
        id: `finding_orig_${tr.id}`,
        principle: 'ORIGINAL',
        severity: 'LOW',
        title: 'Phiếu kiểm nghiệm thiếu tài liệu đính kèm gốc',
        description: `Phiếu kiểm nghiệm (Lô: ${tr.batchId}) được lưu nhưng không có file quét hoặc ảnh chụp đính kèm để đối chiếu.`,
        entityId: tr.id,
        suggestedAction: 'Tải lên bản sao PDF/Ảnh chụp có chữ ký và đóng dấu của phòng kiểm nghiệm.'
      });
      scoreOriginal = Math.max(0, scoreOriginal - 4);
    }
  });

  // 4. Kiểm tra Complete & Consistent: Sửa đổi nhiều lần trên cùng 1 phiếu
  const entityEditCounts = new Map<string, number>();
  auditLogs.forEach(log => {
    if (log.action.toLowerCase().includes('update') || log.action.toLowerCase().includes('edit') || log.action.toLowerCase().includes('modify')) {
      const count = (entityEditCounts.get(log.entityId) || 0) + 1;
      entityEditCounts.set(log.entityId, count);
    }
  });

  entityEditCounts.forEach((count, entityId) => {
    if (count >= 3) {
      findings.push({
        id: `finding_multiedit_${entityId}`,
        principle: 'COMPLETE_CONSISTENT',
        severity: 'HIGH',
        title: 'Chỉnh sửa dữ liệu lặp lại nhiều lần',
        description: `Thực thể ${entityId} đã bị chỉnh sửa ${count} lần trong hệ thống. Cần kiểm tra giải trình lý do sửa đổi.`,
        entityId,
        suggestedAction: 'Yêu cầu nhân viên ghi rõ lý do sửa đổi (Reason for Change) và có chữ ký phê duyệt của QA.'
      });
      scoreComplete = Math.max(0, scoreComplete - 10);
      scoreAccurate = Math.max(0, scoreAccurate - 5);
    }
  });

  const overallScore = Math.round(
    (scoreAttributable * 0.2) +
    (scoreLegible * 0.15) +
    (scoreContemporaneous * 0.15) +
    (scoreOriginal * 0.15) +
    (scoreAccurate * 0.2) +
    (scoreComplete * 0.15)
  );

  let grade: DataIntegrityAuditReport['grade'] = 'A_EXCELLENT';
  if (overallScore >= 90) grade = 'A_EXCELLENT';
  else if (overallScore >= 75) grade = 'B_GOOD';
  else if (overallScore >= 60) grade = 'C_NEEDS_IMPROVEMENT';
  else grade = 'D_CRITICAL_NON_COMPLIANCE';

  let summary = `Đã phân tích ${auditLogs.length} bản ghi Audit Log và ${testResults.length} phiếu kiểm nghiệm. Điểm toàn vẹn dữ liệu ALCOA+: ${overallScore}/100 (Hạng ${grade.replace('_', ' ')}). `;
  if (findings.length > 0) {
    summary += `Phát hiện ${findings.filter(f => f.severity === 'HIGH').length} cảnh báo mức cao, ${findings.filter(f => f.severity === 'MEDIUM').length} cảnh báo mức trung bình.`;
  } else {
    summary += `Không phát hiện vi phạm nào về tính toàn vẹn dữ liệu. Hệ thống hoàn toàn sẵn sàng cho thanh tra GMP.`;
  }

  return {
    overallScore,
    grade,
    summary,
    totalLogsAnalyzed: auditLogs.length,
    findings,
    scoreBreakdown: {
      attributable: scoreAttributable,
      legible: scoreLegible,
      contemporaneous: scoreContemporaneous,
      original: scoreOriginal,
      accurate: scoreAccurate,
      complete: scoreComplete
    },
    generatedAt: new Date().toISOString()
  };
};

/**
 * Gọi AI để phân tích và đánh giá sâu toàn vẹn dữ liệu
 */
export const generateDataIntegrityAIAssessment = async (
  report: DataIntegrityAuditReport
): Promise<DataIntegrityAuditReport> => {
  const apiKey = getApiKey();
  if (!apiKey) return report;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: getGeminiModel() });

    const prompt = `
Bạn là Chuyên gia Thanh tra Toàn vẹn Dữ liệu Dược phẩm (Data Integrity Auditor) theo chuẩn ALCOA+ và US FDA 21 CFR Part 11.
Hãy phân tích kết quả rà soát dữ liệu sau:

ĐIỂM TỔNG THỂ: ${report.overallScore}/100 (Hạng ${report.grade})
BẢN GHI PHÁT HIỆN:
${JSON.stringify(report.findings, null, 2)}

YÊU CẦU:
1. Đánh giá rủi ro thanh tra đối với các phát hiện trên.
2. Đưa ra 3 khuyến nghị hành động khắc phục trọng yếu nhất để doanh nghiệp duy trì hồ sơ dữ liệu sạch (Audit-Ready).
3. Trả về nội dung dạng văn bản Markdown chuyên nghiệp (2-3 đoạn văn).
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (text) {
      report.summary = text.trim();
    }
  } catch (err) {
    console.warn('AI Data Integrity assessment fallback:', err);
  }

  return report;
};
