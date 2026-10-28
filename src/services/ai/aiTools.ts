/**
 * aiTools.ts - Gateway & Barrel File for Gemini AI Tools
 * ========================================================
 * File này đóng vai trò là "Gateway/Barrel file", chứa:
 * 1. Danh sách khai báo tools (GEMINI_TOOL_DECLARATIONS)
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
// GEMINI TOOL DECLARATIONS
// Định nghĩa các tool mà Gemini có thể gọi trong cuộc trò chuyện.
// Tên function phải khớp với tên hàm trong router bên dưới.
// ============================================================
export const GEMINI_TOOL_DECLARATIONS = [
  {
    name: "analyzeQualityTrends",
    description: "Phân tích xu hướng chất lượng của một sản phẩm dựa trên lịch sử kết quả kiểm nghiệm. Sử dụng khi người dùng hỏi về xu hướng, thống kê, tỷ lệ đạt/không đạt của sản phẩm.",
    parameters: {
      type: "OBJECT",
      properties: {
        productId: {
          type: "STRING",
          description: "ID của sản phẩm cần phân tích. Lấy từ danh sách sản phẩm trong context."
        }
      },
      required: ["productId"]
    }
  },
  {
    name: "lookupPharmacoeiaStandard",
    description: "Tra cứu tiêu chuẩn dược điển cho một chỉ tiêu cụ thể. Sử dụng khi người dùng hỏi về giới hạn, yêu cầu chuẩn cho một chỉ tiêu.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Tên chỉ tiêu hoặc thuật ngữ cần tra cứu (ví dụ: 'độ ẩm viên nén', 'định lượng paracetamol')"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "performRootCauseAnalysis",
    description: "Phân tích nguyên nhân gốc rễ (RCA) của một vấn đề chất lượng sử dụng phương pháp 5-Why và Fishbone. Sử dụng khi người dùng hỏi tại sao lô không đạt hoặc cần tìm nguyên nhân.",
    parameters: {
      type: "OBJECT",
      properties: {
        issueDescription: {
          type: "STRING",
          description: "Mô tả vấn đề chất lượng cần phân tích (ví dụ: 'Lô số 001 không đạt chỉ tiêu độ ẩm')"
        }
      },
      required: ["issueDescription"]
    }
  },
  {
    name: "assessQualityRisk",
    description: "Đánh giá rủi ro chất lượng (FMEA/RPN) cho một bước quy trình sản xuất. Dùng khi người dùng hỏi về mức độ rủi ro.",
    parameters: {
      type: "OBJECT",
      properties: {
        processStep: {
          type: "STRING",
          description: "Bước quy trình sản xuất (ví dụ: 'Sấy tầng sôi', 'Pha chế dung dịch')"
        },
        potentialFailure: {
          type: "STRING",
          description: "Lỗi tiềm ẩn có thể xảy ra (ví dụ: 'Độ ẩm vượt giới hạn', 'Hàm lượng không đồng đều')"
        }
      },
      required: ["processStep", "potentialFailure"]
    }
  },
  {
    name: "validateDataIntegrity",
    description: "Kiểm tra tính toàn vẹn dữ liệu (Data Integrity) theo nguyên tắc ALCOA+. Dùng khi người dùng hỏi về chất lượng dữ liệu trong hệ thống.",
    parameters: {
      type: "OBJECT",
      properties: {
        checkType: {
          type: "STRING",
          description: "Loại kiểm tra: 'all' (kiểm tra toàn bộ), 'recent' (chỉ dữ liệu gần nhất)"
        }
      },
      required: ["checkType"]
    }
  },
  {
    name: "getBatchSummary",
    description: "Lấy tóm tắt thông tin về các lô hàng: số lượng, trạng thái, lô sắp hết hạn. Dùng khi người dùng hỏi tổng quan về lô hàng.",
    parameters: {
      type: "OBJECT",
      properties: {
        filter: {
          type: "STRING",
          description: "Bộ lọc: 'all' (tất cả), 'expiring' (sắp hết hạn trong 30 ngày), 'failing' (có kết quả không đạt)"
        }
      },
      required: ["filter"]
    }
  },
  {
    name: "generateQualityReport",
    description: "Xuất báo cáo chất lượng tổng hợp ra file Excel (.xlsx) đa sheet (Tóm tắt, Toàn bộ, Đạt, Không đạt). Tự động tải file về máy người dùng. Dùng khi người dùng yêu cầu xuất báo cáo tháng, quý hoặc toàn bộ.",
    parameters: {
      type: "OBJECT",
      properties: {
        period: {
          type: "STRING",
          description: "Kỳ báo cáo: 'month' (tháng), 'quarter' (quý), 'all' (toàn bộ)"
        },
        year: {
          type: "NUMBER",
          description: "Năm báo cáo (ví dụ: 2026). Mặc định là năm hiện tại nếu không chỉ định."
        },
        month: {
          type: "NUMBER",
          description: "Tháng báo cáo (1-12). Chỉ dùng khi period='month'."
        },
        quarter: {
          type: "NUMBER",
          description: "Quý báo cáo (1-4). Chỉ dùng khi period='quarter'."
        },
        productId: {
          type: "STRING",
          description: "ID sản phẩm để lọc báo cáo theo sản phẩm cụ thể. Bỏ qua nếu muốn báo cáo toàn bộ sản phẩm."
        }
      },
      required: ["period"]
    }
  },
  {
    name: "detectQualityAnomalies",
    description: "Phát hiện bất thường chất lượng: lô sắp hết hạn, xu hướng trôi chỉ tiêu (drift), tỷ lệ thất bại cao. Dùng khi người dùng hỏi về cảnh báo chất lượng, rủi ro tiềm ẩn.",
    parameters: {
      type: "OBJECT",
      properties: {
        daysAhead: {
          type: "NUMBER",
          description: "Số ngày tới để kiểm tra lô sắp hết hạn. Mặc định 30 ngày."
        }
      },
      required: []
    }
  },
  {
    name: "generateProductionSynthesisReport",
    description: "Lập báo cáo tổng hợp chất lượng theo ngày sản xuất. Trả về thông tin: tên sản phẩm, số lô, ngày sản xuất (NSX), hạn sử dụng (HSD) và tỷ lệ % hàm lượng thực tế/công bố của các chỉ tiêu chất lượng chính. Dùng khi người dùng yêu cầu báo cáo tổng hợp theo ngày sản xuất, theo dõi hàm lượng hoạt chất chính qua các lô, hoặc lập báo cáo chất lượng nâng cao.",
    parameters: {
      type: "OBJECT",
      properties: {
        productId: {
          type: "STRING",
          description: "ID của sản phẩm cần lập báo cáo tổng hợp."
        },
        startDate: {
          type: "STRING",
          description: "Ngày bắt đầu lọc ngày sản xuất (định dạng YYYY-MM-DD hoặc DD/MM/YYYY)."
        },
        endDate: {
          type: "STRING",
          description: "Ngày kết thúc lọc ngày sản xuất (định dạng YYYY-MM-DD hoặc DD/MM/YYYY)."
        }
      },
      required: ["productId"]
    }
  },
  {
    name: "generateOOSInvestigation",
    description: "Khởi tạo hồ sơ điều tra sự cố chất lượng Out-of-Specification (OOS) 2 giai đoạn (Phòng kiểm nghiệm vs Sản xuất), sơ đồ xương cá Ishikawa 6M, chuỗi 5-Why và kế hoạch CAPA theo chuẩn GMP WHO/FDA khi người dùng hỏi về xử lý sự cố lô không đạt.",
    parameters: {
      type: "OBJECT",
      properties: {
        batchNo: {
          type: "STRING",
          description: "Số lô sản xuất bị lỗi hoặc có chỉ tiêu không đạt cần lập hồ sơ điều tra OOS."
        },
        criteriaName: {
          type: "STRING",
          description: "Tên chỉ tiêu vi phạm hoặc cần chú trọng điều tra."
        }
      },
      required: ["batchNo"]
    }
  },
  {
    name: "getAIInsights",
    description: "Sinh và trả về danh sách phân tích chất lượng chủ động (AI Insights). Sử dụng khi người dùng hỏi về tình hình chất lượng, insights, hoặc khởi động buổi sáng.",
    parameters: {
      type: "OBJECT",
      properties: {
        forceRefresh: {
          type: "BOOLEAN",
          description: "true nếu muốn tải lại phân tích, bỏ qua cache cũ."
        }
      },
      required: []
    }
  },
  {
    name: "compareLabResults",
    description: "Đối chiếu kết quả giữa 2 phiếu kiểm nghiệm (ví dụ: Nội bộ vs Quatest 3, Eurofins, hoặc CoA Nhà cung cấp), tính %RPD sai lệch và đánh giá sai số hệ thống Lab Bias.",
    parameters: {
      type: "OBJECT",
      properties: {
        batchNo: {
          type: "STRING",
          description: "Số lô cần đối chiếu phiếu kiểm nghiệm."
        },
        lab1Name: {
          type: "STRING",
          description: "Tên phòng kiểm nghiệm thứ nhất (ví dụ: 'Nội bộ', 'QC', 'Quatest 3')."
        },
        lab2Name: {
          type: "STRING",
          description: "Tên phòng kiểm nghiệm thứ hai (ví dụ: 'Quatest 3', 'Eurofins', 'CASE')."
        }
      },
      required: ["batchNo"]
    }
  },
  {
    name: "predictQualityStability",
    description: "Dự báo động học suy giảm hàm lượng và độ ổn định chất lượng theo thời gian (Stability & Shelf-Life Forecasting) cho sản phẩm, tính tốc độ suy giảm k và hạn dùng dự kiến t90.",
    parameters: {
      type: "OBJECT",
      properties: {
        productId: {
          type: "STRING",
          description: "ID hoặc tên của sản phẩm cần dự báo độ ổn định."
        },
        shelfLifeMonths: {
          type: "NUMBER",
          description: "Hạn dùng thiết kế tính theo tháng (mặc định 24 hoặc 36 tháng)."
        }
      },
      required: ["productId"]
    }
  },
  {
    name: "auditDataIntegrity",
    description: "Rà soát toàn vẹn dữ liệu (Data Integrity Audit Trail) theo nguyên tắc ALCOA+ và US FDA 21 CFR Part 11, phát hiện các sửa đổi bất thường và tính điểm tuân thủ.",
    parameters: {
      type: "OBJECT",
      properties: {
        detailed: {
          type: "BOOLEAN",
          description: "true nếu muốn báo cáo phân tích chi tiết từng phát hiện."
        }
      },
      required: []
    }
  },
  {
    name: "queryDataNaturalLanguage",
    description: "Tìm kiếm và thống kê dữ liệu trong hệ thống PQM bằng ngôn ngữ tự nhiên tiếng Việt. Dùng khi người dùng hỏi: 'lô nào hết hạn trong 30 ngày', 'sản phẩm nào tỷ lệ lỗi cao nhất', 'phiếu kiểm nghiệm tháng 7', 'so sánh lô A vs B', 'thống kê tổng quan hệ thống', v.v. Tool này tự phân tích ý định, thực hiện query và trả kết quả dạng bảng/thống kê.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Câu hỏi/yêu cầu tìm kiếm bằng tiếng Việt tự nhiên (ví dụ: 'tìm lô hết hạn trong 60 ngày', 'sản phẩm nào fail nhiều nhất', 'phiếu kiểm tháng 7/2026')"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "generateDeviationReport",
    description: "Tạo Báo cáo Sai lệch (Deviation Report) chuẩn GMP-WHO/FDA đầy đủ 6 phần cho lô KHÔNG ĐẠT: mô tả sự cố, đánh giá tác động, phân tích nguyên nhân gốc rễ (Fishbone 6M + 5-Why), kế hoạch CAPA, đánh giá tái diễn và quyết định xử lý lô. Dùng khi người dùng hỏi về xử lý lô không đạt hoặc cần lập hồ sơ sai lệch.",
    parameters: {
      type: "OBJECT",
      properties: {
        batchNo: {
          type: "STRING",
          description: "Số lô sản xuất cần lập báo cáo sai lệch."
        }
      },
      required: ["batchNo"]
    }
  },
  {
    name: "createBatchAction",
    description: "Tạo mới một lô sản xuất trực tiếp vào hệ thống PQM. Dùng khi người dùng yêu cầu: 'tạo lô mới...', 'thêm lô...', 'đăng ký lô [số lô] cho sản phẩm [tên/mã SP]'. Tool sẽ tự động tìm sản phẩm, tìm TCCS hiệu lực, tạo bản ghi lô và lưu trữ an toàn.",
    parameters: {
      type: "OBJECT",
      properties: {
        productIdentifier: {
          type: "STRING",
          description: "Tên hoặc mã sản phẩm cần tạo lô (ví dụ: 'Siro Ho', 'SP001')."
        },
        batchNo: {
          type: "STRING",
          description: "Số lô sản xuất (ví dụ: '010926', 'SH-260901')."
        },
        mfgDate: {
          type: "STRING",
          description: "Ngày sản xuất (định dạng YYYY-MM-DD hoặc DD/MM/YYYY)."
        },
        expDate: {
          type: "STRING",
          description: "Hạn sử dụng (định dạng YYYY-MM-DD hoặc DD/MM/YYYY)."
        },
        theoreticalYield: {
          type: "NUMBER",
          description: "Cỡ lô lý thuyết (tùy chọn, ví dụ: 5000)."
        },
        yieldUnit: {
          type: "STRING",
          description: "Đơn vị tính cỡ lô (ví dụ: 'chai', 'hộp', 'viên', 'kg'). Mặc định là 'chai'."
        }
      },
      required: ["productIdentifier", "batchNo", "mfgDate", "expDate"]
    }
  },
  {
    name: "exportCoAReportAction",
    description: "Tìm và trả về đường dẫn trực tiếp để xem/in Certificate of Analysis (CoA) chuẩn GMP cho một lô sản xuất. Dùng khi người dùng yêu cầu 'xuất CoA cho lô X', 'in phiếu CoA lô X', 'xem CoA lô X'.",
    parameters: {
      type: "OBJECT",
      properties: {
        batchNo: {
          type: "STRING",
          description: "Số lô cần xuất hoặc xem Certificate of Analysis (CoA)."
        }
      },
      required: ["batchNo"]
    }
  },
  {
    name: "navigateToAction",
    description: "Chuyển hướng màn hình ứng dụng đến trang chức năng cụ thể theo yêu cầu của người dùng. Dùng khi người dùng bảo: 'mở trang sản phẩm...', 'dẫn tôi đến trang TCCS...', 'xem lô X', 'mở báo cáo PQR', 'mở kiểm soát SPC'.",
    parameters: {
      type: "OBJECT",
      properties: {
        destination: {
          type: "STRING",
          description: "Trang cần chuyển đến: 'products' (Danh mục SP), 'batches' (Danh mục Lô), 'tccs' (Danh mục TCCS), 'product-formulas' (Công thức), 'test-results' (Phiếu kiểm nghiệm), 'pqr' (Báo cáo PQR), 'spc' (Phân tích xu hướng SPC), 'alerts' (Cảnh báo chất lượng), 'data-consistency' (Trung tâm toàn vẹn dữ liệu), 'audit-logs' (Kiểm toán ALCOA+)."
        },
        identifier: {
          type: "STRING",
          description: "Mã hoặc ID của thực thể cụ thể (ví dụ ID hoặc mã số của sản phẩm, lô hàng, TCCS) để mở thẳng trang chi tiết nếu có."
        }
      },
      required: ["destination"]
    }
  },
  {
    name: "triggerAutoHealingAction",
    description: "Tự động kích hoạt bộ máy rà soát và hàn gắn toàn vẹn dữ liệu (Data Consistency Auto-Healing) 360 độ trên toàn hệ thống. Sửa chữa tự động các lỗi mồ côi, đồng bộ cờ hiệu lực TCCS, liên kết nguyên liệu vào công thức và sửa trạng thái kết quả kiểm nghiệm.",
    parameters: {
      type: "OBJECT",
      properties: {},
      required: []
    }
  },
  {
    name: "updateBatchStatusAction",
    description: "Cập nhật trạng thái của lô sản xuất (RELEASED: Xuất xưởng, REJECTED: Từ chối, TESTING: Đang kiểm nghiệm) kèm lý do thẩm định chất lượng và ghi log kiểm toán ALCOA+.",
    parameters: {
      type: "OBJECT",
      properties: {
        batchNo: {
          type: "STRING",
          description: "Số lô cần cập nhật trạng thái."
        },
        newStatus: {
          type: "STRING",
          description: "Trạng thái mới: 'RELEASED' (Cho phép xuất xưởng), 'REJECTED' (Từ chối xuất xưởng), 'TESTING' (Đang kiểm nghiệm)."
        },
        reason: {
          type: "STRING",
          description: "Lý do cập nhật trạng thái hoặc ghi chú thẩm định chất lượng."
        }
      },
      required: ["batchNo", "newStatus"]
    }
  },
  {
    name: "predictBatchRiskAction",
    description: "Dự báo rủi ro chất lượng của một lô sản xuất TRƯỚC KHI có kết quả kiểm nghiệm (xác suất đạt %, rủi ro phòng lab, rủi ro mùa vụ, các chỉ tiêu nguy cơ cao). Dùng khi người dùng hỏi: 'lô X có nguy cơ gì không?', 'dự báo rủi ro lô X', 'kiểm tra nguy cơ lô X'.",
    parameters: {
      type: "OBJECT",
      properties: {
        batchNo: {
          type: "STRING",
          description: "Số lô cần dự báo rủi ro trước kiểm nghiệm."
        }
      },
      required: ["batchNo"]
    }
  }
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
    case 'analyzeQualityTrends':
      return analyzeQualityTrends(args.productId, appContext);

    case 'lookupPharmacoeiaStandard':
      return lookupPharmacoeiaStandard(args.query);

    case 'performRootCauseAnalysis':
      return await performRootCauseAnalysis(args.issueDescription, appContext, generateText);

    case 'assessQualityRisk':
      return await assessQualityRisk(args.processStep, args.potentialFailure, appContext, generateText);

    case 'validateDataIntegrity':
      return validateDataIntegrity(args.checkType || 'all', appContext);

    case 'getBatchSummary':
      return getBatchSummary(args.filter || 'all', appContext);

    case 'generateQualityReport':
      return generateQualityReport(args, appContext);

    case 'detectQualityAnomalies':
      return detectQualityAnomalies(args.daysAhead, appContext);

    case 'generateProductionSynthesisReport':
      return handleProductionSynthesisReport(args, appContext);

    case 'generateOOSInvestigation':
      return generateOOSInvestigation(args as any, appContext);

    case 'getAIInsights':
      return await getAIInsights(args, appContext, generateText);

    case 'compareLabResults':
      return await compareLabResults(args as any, appContext);

    case 'predictQualityStability':
      return await predictQualityStability(args as any, appContext);

    case 'auditDataIntegrity':
      return await auditDataIntegrity(args, appContext);

    case 'queryDataNaturalLanguage':
      return queryDataNaturalLanguage(args.query, appContext);

    case 'generateDeviationReport':
      return generateDeviationReport(args.batchNo, appContext);

    case 'createBatch':
    case 'createBatchAction':
      return await createBatchAction(args as any, appContext);

    case 'exportCoAReport':
    case 'exportCoAReportAction':
      return exportCoAReportAction(args as any, appContext);

    case 'navigateToAction':
      return navigateToAction(args as any, appContext);

    case 'triggerAutoHealing':
    case 'triggerAutoHealingAction':
    case 'autoHealInconsistencies':
      return await triggerAutoHealingAction();

    case 'updateBatchStatus':
    case 'updateBatchStatusAction':
      return await updateBatchStatusAction(args as any, appContext);

    case 'predictBatchRiskAction':
      return predictBatchRiskAction(args as any, appContext);

    default:
      return { error: `Không tìm thấy tool "${toolName}"` };
  }
};
