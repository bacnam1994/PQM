/**
 * aiTools.ts - Gateway & Barrel File for Gemini AI Tools
 * ========================================================
 * File này đóng vai trò là "Gateway/Barrel file", chứa:
 * 1. Danh sách khai báo tools tinh gọn (GEMINI_TOOL_DECLARATIONS)
 * 2. Bộ định tuyến dispatcher (executeTool)
 * 3. Re-export toàn bộ các công cụ đã được phân rã vào src/services/ai/tools/
 */

import {
  analyzeQualityTrends,
  lookupPharmacoeiaStandard,
  performRootCauseAnalysis,
  assessQualityRisk,
  validateDataIntegrity,
  auditDataIntegrity,
  getBatchSummary,
  generateQualityReport,
  detectQualityAnomalies,
  generateProductionSynthesisReport,
  handleProductionSynthesisReport,
  generateOOSInvestigation,
  getAIInsights,
  compareLabResults,
  predictQualityStability,
  queryDataNaturalLanguage,
  generateDeviationReport,
  createBatchAction,
  exportCoAReportAction,
  navigateToAction,
  triggerAutoHealingAction,
  updateBatchStatusAction,
  predictBatchRiskAction,
} from './tools';

// Re-export toàn bộ tools từ thư mục phân rã
export * from './tools';

// ============================================================
// GEMINI TOOL DECLARATIONS (TẬP TRUNG VÀO 3 TRỤ CỘT THỰC CHIẾN)
// Đã tinh giản các tool lý thuyết (FMEA, Kinetics, ALCOA scoring...)
// ============================================================
export const GEMINI_TOOL_DECLARATIONS = [
  {
    name: 'queryDataNaturalLanguage',
    description:
      'Tìm kiếm, lọc và thống kê dữ liệu thực tế trong hệ thống PQM bằng tiếng Việt tự nhiên: danh sách lô, phiếu kiểm nghiệm, sản phẩm, TCCS, công thức. Sử dụng khi người dùng hỏi các câu hỏi tra cứu dữ liệu thực trong app.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description:
            "Câu hỏi hoặc yêu cầu tra cứu dữ liệu (ví dụ: 'tìm lô sản xuất tháng 10', 'sản phẩm nào có kết quả không đạt', 'danh sách phiếu kiểm nghiệm gần nhất')",
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'getBatchSummary',
    description:
      "Lấy tóm tắt nhanh tình hình các lô sản xuất trong hệ thống theo trạng thái nghiệp vụ. Hỗ trợ lọc theo: 'pending' (chờ duyệt), 'testing' (đang kiểm nghiệm), 'released' (đã xuất xưởng), 'expiring' (sắp hết hạn trong 30 ngày), 'failing' (có chỉ tiêu không đạt), hoặc 'all' (toàn bộ).",
    parameters: {
      type: 'OBJECT',
      properties: {
        filter: {
          type: 'STRING',
          description:
            "Bộ lọc trạng thái lô: 'all', 'pending', 'testing', 'released', 'expiring', 'failing'",
        },
      },
      required: ['filter'],
    },
  },
  {
    name: 'generateQualityReport',
    description:
      'Xuất báo cáo tổng hợp chất lượng ra file Excel (.xlsx) đa trang tải trực tiếp về máy người dùng theo tháng, quý hoặc toàn bộ sản phẩm.',
    parameters: {
      type: 'OBJECT',
      properties: {
        period: {
          type: 'STRING',
          description: "Kỳ báo cáo: 'month' (tháng), 'quarter' (quý), 'all' (toàn bộ)",
        },
        year: {
          type: 'NUMBER',
          description: 'Năm báo cáo (ví dụ: 2026). Mặc định là năm hiện tại nếu không chỉ định.',
        },
        month: {
          type: 'NUMBER',
          description: "Tháng báo cáo (1-12). Chỉ dùng khi period='month'.",
        },
        quarter: {
          type: 'NUMBER',
          description: "Quý báo cáo (1-4). Chỉ dùng khi period='quarter'.",
        },
        productId: {
          type: 'STRING',
          description: 'ID sản phẩm để lọc theo sản phẩm cụ thể. Bỏ qua nếu báo cáo toàn bộ.',
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'compareLabResults',
    description:
      'So sánh đối chiếu kết quả giữa 2 phiếu kiểm nghiệm (ví dụ: Lab Nội bộ vs Quatest 3, Eurofins) cho cùng một số lô, tính % sai lệch RPD và đưa ra kết luận nhanh bằng tiếng Việt.',
    parameters: {
      type: 'OBJECT',
      properties: {
        batchNo: {
          type: 'STRING',
          description: 'Số lô cần đối chiếu phiếu kiểm nghiệm.',
        },
        lab1Name: {
          type: 'STRING',
          description: "Tên phòng kiểm nghiệm thứ nhất (ví dụ: 'Nội bộ', 'QC').",
        },
        lab2Name: {
          type: 'STRING',
          description: "Tên phòng kiểm nghiệm thứ hai (ví dụ: 'Quatest 3', 'Eurofins').",
        },
      },
      required: ['batchNo'],
    },
  },
  {
    name: 'analyzeQualityTrends',
    description:
      'Phân tích xu hướng chất lượng của một sản phẩm dựa trên lịch sử kiểm nghiệm thực tế: tỷ lệ đạt/không đạt, các chỉ tiêu hay gặp vấn đề.',
    parameters: {
      type: 'OBJECT',
      properties: {
        productId: {
          type: 'STRING',
          description: 'ID hoặc mã của sản phẩm cần phân tích xu hướng.',
        },
      },
      required: ['productId'],
    },
  },
  {
    name: 'detectQualityAnomalies',
    description:
      'Quét nhanh các bất thường chất lượng thực tế: lô sắp hết hạn, lô kiểm nghiệm không đạt, sản phẩm có tỷ lệ lỗi gia tăng.',
    parameters: {
      type: 'OBJECT',
      properties: {
        daysAhead: {
          type: 'NUMBER',
          description: 'Số ngày tới để kiểm tra lô cận hạn (mặc định 30 ngày).',
        },
      },
      required: [],
    },
  },
  {
    name: 'navigateToAction',
    description:
      "Cung cấp đường dẫn điều hướng nhanh hoặc mở thẳng màn hình chức năng trong ứng dụng PQM: 'batches' (Lô hàng), 'test-results' (Phiếu kiểm nghiệm), 'products' (Sản phẩm), 'tccs' (Tiêu chuẩn cơ sở), 'alerts' (Cảnh báo), 'pqr' (Báo cáo chất lượng), 'comparison' (Đối chiếu Lab).",
    parameters: {
      type: 'OBJECT',
      properties: {
        destination: {
          type: 'STRING',
          description:
            "Tên trang đích: 'batches', 'test-results', 'products', 'tccs', 'alerts', 'pqr', 'comparison', 'settings'",
        },
        identifier: {
          type: 'STRING',
          description: 'Mã hoặc ID của lô/sản phẩm/TCCS cụ thể nếu có để mở chi tiết.',
        },
      },
      required: ['destination'],
    },
  },
];

/**
 * Dispatcher: Nhận tên function và arguments từ Gemini, định tuyến sang tool module tương ứng.
 * @param toolName Tên hàm Gemini muốn gọi
 * @param args Arguments từ Gemini
 * @param appContext Toàn bộ dữ liệu ứng dụng
 * @param generateText Hàm gọi Gemini API phụ trợ nếu tool yêu cầu
 */
export const executeTool = async (
  toolName: string,
  args: Record<string, any>,
  appContext: any,
  generateText?: (prompt: string, systemPrompt?: string) => Promise<string>
): Promise<any> => {
  console.log(`[AI TOOL CALL] ${toolName}`, args);

  switch (toolName) {
    // 7 Core Focused Tools
    case 'queryDataNaturalLanguage':
      return queryDataNaturalLanguage(args.query, appContext);

    case 'getBatchSummary':
      return getBatchSummary(args.filter || 'all', appContext);

    case 'generateQualityReport':
      return generateQualityReport(args, appContext);

    case 'compareLabResults':
      return await compareLabResults(args as any, appContext);

    case 'analyzeQualityTrends':
      return analyzeQualityTrends(args.productId, appContext);

    case 'detectQualityAnomalies':
      return detectQualityAnomalies(args.daysAhead, appContext);

    case 'navigateToAction':
      return navigateToAction(args as any, appContext);

    // Fallback handlers for backward compatibility & direct invocation
    case 'exportCoAReport':
    case 'exportCoAReportAction':
      return exportCoAReportAction(args as any, appContext);

    case 'generateProductionSynthesisReport':
      return handleProductionSynthesisReport(args, appContext);

    case 'generateOOSInvestigation':
      return generateOOSInvestigation(args as any, appContext);

    case 'generateDeviationReport':
      return generateDeviationReport(args.batchNo, appContext);

    case 'getAIInsights':
      return await getAIInsights(args, appContext, generateText);

    case 'performRootCauseAnalysis':
      return await performRootCauseAnalysis(args.issueDescription, appContext, generateText);

    case 'assessQualityRisk':
      return await assessQualityRisk(
        args.processStep,
        args.potentialFailure,
        appContext,
        generateText
      );

    case 'validateDataIntegrity':
      return validateDataIntegrity(args.checkType || 'all', appContext);

    case 'predictQualityStability':
      return await predictQualityStability(args as any, appContext);

    case 'auditDataIntegrity':
      return await auditDataIntegrity(args, appContext);

    case 'createBatch':
    case 'createBatchAction':
      return await createBatchAction(args as any, appContext);

    case 'triggerAutoHealing':
    case 'triggerAutoHealingAction':
    case 'autoHealInconsistencies':
      return await triggerAutoHealingAction();

    case 'updateBatchStatus':
    case 'updateBatchStatusAction':
      return await updateBatchStatusAction(args as any, appContext);

    case 'predictBatchRiskAction':
      return predictBatchRiskAction(args as any, appContext);

    case 'lookupPharmacoeiaStandard':
      return lookupPharmacoeiaStandard(args.query);

    default:
      return { error: `Không tìm thấy tool "${toolName}"` };
  }
};
