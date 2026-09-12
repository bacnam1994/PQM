import { auditDataIntegrity as _auditDataIntegrity, generateDataIntegrityAIAssessment } from '../dataIntegrityService';

/**
 * Kiểm tra tính toàn vẹn dữ liệu cơ bản theo ALCOA+
 */
export const validateDataIntegrity = (checkType: string, appContext: any) => {
  const results = appContext.testResults || [];
  const anomalies: string[] = [];

  const checkData = checkType === 'recent' ? results.slice(0, 20) : results;

  // Check 1: Phiếu không có kết quả chỉ tiêu
  const emptyResults = checkData.filter((r: any) => !r.results || r.results.length === 0);
  if (emptyResults.length > 0) {
    anomalies.push(`Phát hiện **${emptyResults.length} phiếu** không có kết quả chỉ tiêu (Completeness).`);
  }

  // Check 2: Phiếu không có ngày kiểm nghiệm
  const noDate = checkData.filter((r: any) => !r.testDate);
  if (noDate.length > 0) {
    anomalies.push(`Phát hiện **${noDate.length} phiếu** thiếu ngày kiểm nghiệm (Timeliness).`);
  }

  // Check 3: Phiếu không có tên đơn vị kiểm nghiệm
  const noLab = checkData.filter((r: any) => !r.labName || r.labName.trim() === '');
  if (noLab.length > 0) {
    anomalies.push(`Phát hiện **${noLab.length} phiếu** không có tên đơn vị kiểm nghiệm (Attributability).`);
  }

  return {
    status: anomalies.length > 0 ? "⚠️ WARNING" : "✅ VALID",
    totalChecked: checkData.length,
    checksPerformed: ["Completeness", "Timeliness", "Attributability"],
    anomalies,
    summary: anomalies.length === 0
      ? `Đã kiểm tra **${checkData.length} phiếu** — Dữ liệu nhất quán và tuân thủ nguyên tắc ALCOA+.`
      : `Đã kiểm tra **${checkData.length} phiếu** — Phát hiện ${anomalies.length} vấn đề cần xử lý.`
  };
};

/**
 * Rà soát toàn vẹn dữ liệu chuyên sâu kết hợp AI Assessment theo FDA 21 CFR Part 11
 */
export const auditDataIntegrity = async (args: { detailed?: boolean }, appContext: any) => {
  try {
    const testResults = appContext.testResults || [];
    const batches = appContext.batches || [];
    const auditLogs = appContext.auditLogs || [];

    const report = _auditDataIntegrity(auditLogs, testResults, batches);
    const enrichedReport = await generateDataIntegrityAIAssessment(report);

    const findingsLines = enrichedReport.findings.slice(0, 5).map(f => {
      const badge = f.severity === 'HIGH' ? '[CAO]' : f.severity === 'MEDIUM' ? '[TB]' : '[THAP]';
      return `- ${badge} **[${f.principle}]** ${f.title}: ${f.description}\n  *Hành động đề xuất:* ${f.suggestedAction}`;
    }).join('\n\n');

    return {
      success: true,
      overallScore: enrichedReport.overallScore,
      grade: enrichedReport.grade,
      message: `### 🛡️ BÁO CÁO GIÁM SÁT TOÀN VẸN DỮ LIỆU (ALCOA+ / FDA 21 CFR Part 11)\n\n- **Điểm toàn vẹn:** **${enrichedReport.overallScore}/100** (Hạng **${enrichedReport.grade.replace('_', ' ')}**)\n- **Tổng số nhật ký kiểm toán đã quét:** ${enrichedReport.totalLogsAnalyzed}\n\n**Nhận xét của Chuyên gia AI:**\n${enrichedReport.summary}\n\n${findingsLines ? `**Các điểm cần lưu ý:**\n${findingsLines}` : '✅ Không phát hiện vi phạm tính toàn vẹn dữ liệu.'}\n\n*Xem nhật ký chi tiết tại trang [Nhật ký kiểm toán](/audit-logs).*`,
      action: 'REDIRECT',
      path: '/audit-logs'
    };
  } catch (e: any) {
    return { error: e.message };
  }
};
