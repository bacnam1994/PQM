import { TestResult } from '../../types';
import { generateQualityReport as _generateReport, detectQualityAnomalies as _detectAnomalies, QualityReportOptions } from '../reportService';

// ============================================================
// GEMINI TOOL DECLARATIONS
// Định nghĩa các tool mà Gemini có thể gọi trong cuộc trò chuyện.
// Tên function phải khớp với tên hàm trong TOOL_HANDLERS bên dưới.
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
  }
];

// ============================================================
// TOOL HANDLER IMPLEMENTATIONS
// ============================================================

export const analyzeQualityTrends = (productId: string, appContext: any) => {
  const allResults: TestResult[] = appContext.testResults || [];
  const allBatches = appContext.batches || [];

  const productResults = allResults.filter(tr => {
    const batch = allBatches.find((b: any) => b.id === tr.batchId);
    return batch && batch.productId === productId;
  });

  if (productResults.length === 0) {
    return { message: "Không tìm thấy dữ liệu kiểm nghiệm cho sản phẩm này để phân tích xu hướng." };
  }

  const total = productResults.length;
  const passCount = productResults.filter(r => r.overallStatus === 'PASS').length;
  const failCount = total - passCount;
  const passRate = ((passCount / total) * 100).toFixed(1);

  const criteriaStats: Record<string, any> = {};
  productResults.forEach(res => {
    res.results.forEach(entry => {
      if (typeof entry.value === 'string') {
        const numValue = parseFloat(entry.value.replace(',', '.'));
        if (!isNaN(numValue)) {
          if (!criteriaStats[entry.criteriaName]) {
            criteriaStats[entry.criteriaName] = { values: [], unit: entry.unit };
          }
          criteriaStats[entry.criteriaName].values.push(numValue);
        }
      }
    });
  });

  const trends = Object.entries(criteriaStats).map(([name, stats]: [string, any]) => {
    const values = stats.values;
    const avg = (values.reduce((a: number, b: number) => a + b, 0) / values.length).toFixed(3);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { criteriaName: name, average: avg, min, max, unit: stats.unit, sampleSize: values.length };
  });

  const productName = (() => {
    const batch = allBatches.find((b: any) => b.productId === productId);
    const prod = batch?.product;
    return typeof prod === 'string' ? prod : (prod?.name || "Sản phẩm");
  })();

  return {
    productName,
    totalBatchesAnalyzed: total,
    passCount,
    failCount,
    passRate: `${passRate}%`,
    trends,
    summary: `Sản phẩm **${productName}** có tỷ lệ đạt **${passRate}%** trên ${total} phiếu kiểm nghiệm (${passCount} đạt, ${failCount} không đạt).`
  };
};

export const lookupPharmacoeiaStandard = (query: string) => {
  const standards: Record<string, string> = {
    "độ ẩm viên nén": "Theo Dược điển Việt Nam V, độ ẩm của viên nén thường **NMT 5.0%** trừ khi có chỉ dẫn khác trong chuyên luận riêng.",
    "định lượng paracetamol": "Hàm lượng Paracetamol trong viên nén phải từ **95.0% đến 105.0%** so với hàm lượng ghi trên nhãn (USP, BP, DĐVN V).",
    "vi sinh vật": "Tổng số VKHK **NMT 10³ CFU/g**, nấm mốc-nấm men **NMT 10² CFU/g** (thuốc uống không yêu cầu vô khuẩn - DĐVN V, Phụ lục 13.6).",
    "độ rã": "Viên nén thông thường: **NMT 15 phút**. Viên bao phim: **NMT 30 phút**. Đo trong nước hoặc HCl 0.1N ở 37°C (DĐVN V).",
    "độ hòa tan": "Thường yêu cầu **NLT 75% (Q)** sau 45 phút hoặc theo chỉ dẫn chuyên luận riêng của từng hoạt chất.",
    "kim loại nặng": "Asen **NMT 2 ppm**, Chì **NMT 5 ppm**, Thủy ngân **NMT 0.5 ppm**, Cadmi **NMT 0.5 ppm** (thuốc uống, DĐVN V).",
    "đồng đều khối lượng": "Không quá 2 viên sai số ±7.5% và không có viên nào sai số vượt ±15% (viên nén 250mg-1g, DĐVN V).",
  };

  const lowerQuery = query.toLowerCase();
  const matchedKey = Object.keys(standards).find(key => lowerQuery.includes(key));

  if (matchedKey) {
    return { query, source: "Dược điển Việt Nam V (Tham khảo — Cần xác minh với chuyên luận chính thức)", content: standards[matchedKey] };
  }

  return {
    query,
    message: `Chưa có dữ liệu chính xác cho **"${query}"** trong cơ sở kiến thức nội bộ. Vui lòng kiểm tra trực tiếp tại Dược điển Việt Nam V hoặc tài liệu kỹ thuật của sản phẩm.`
  };
};

export const performRootCauseAnalysis = async (
  issueDescription: string,
  appContext: any,
  generateText?: (prompt: string, systemPrompt?: string) => Promise<string>
) => {
  if (!generateText) {
    return {
      methodology: "5-Why & Fishbone (Ishikawa)",
      issue: issueDescription,
      steps: [
        { why: `Tại sao xảy ra: "${issueDescription}"?`, answer: "Cần cấu hình API để gọi phân tích RCA động từ AI." }
      ],
      recommendation: "Vui lòng cấu hình VITE_GEMINI_API_KEY để phân tích."
    };
  }

  const systemPrompt = `Bạn là chuyên gia quản lý và kiểm soát chất lượng (QA/QC) chuyên nghiệp trong nhà máy dược phẩm đạt chuẩn GMP.
Nhiệm vụ: Phân tích nguyên nhân gốc rễ (RCA) cho sai lệch chất lượng bằng phương pháp 5-Why và Sơ đồ xương cá (Fishbone - Ishikawa).
Trả về một đối tượng JSON có cấu trúc chính xác như sau:
{
  "methodology": "5-Why & Fishbone (Ishikawa)",
  "issue": "mô tả lỗi hoặc sự cố chất lượng",
  "steps": [
    {"why": "Câu hỏi Why 1?", "answer": "Giải thích Why 1"},
    {"why": "Câu hỏi Why 2?", "answer": "Giải thích Why 2"},
    {"why": "Câu hỏi Why 3?", "answer": "Giải thích Why 3"},
    {"why": "Câu hỏi Why 4?", "answer": "Giải thích Why 4"},
    {"why": "Câu hỏi Why 5?", "answer": "Giải thích Why 5"}
  ],
  "fishboneCategories": {
    "Manpower": "Phân tích yếu tố con người (thao tác, đào tạo, SOP...)",
    "Machine": "Phân tích yếu tố máy móc (thiết bị, hiệu chuẩn, bảo dưỡng...)",
    "Method": "Phân tích yếu tố quy trình (công thức, IPC, SOP...)",
    "Material": "Phân tích yếu tố nguyên vật liệu (chất lượng, nhà cung cấp, CoA...)",
    "Environment": "Phân tích yếu tố môi trường (nhiệt độ, độ ẩm, áp suất, độ sạch...)"
  },
  "recommendation": "Đề xuất hành động khắc phục và phòng ngừa (CAPA) cụ thể, thực tế"
}
Lưu ý: Chỉ trả về chuỗi JSON thô, không định dạng markdown (không sử dụng \`\`\`json).`;

  const productsContext = (appContext.products || []).slice(0, 10).map((p: any) => ({ name: p.name, code: p.code }));
  const prompt = `Yêu cầu phân tích sự cố: "${issueDescription}".
Thông tin một số sản phẩm trong hệ thống: ${JSON.stringify(productsContext)}.
Hãy kết hợp bối cảnh GMP và kiến thức chuyên ngành để đưa ra phân tích phù hợp nhất.`;

  try {
    const responseText = await generateText(prompt, systemPrompt);
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("RCA AI Error:", error);
    return {
      methodology: "5-Why & Fishbone (Ishikawa) - Fallback do lỗi kết nối AI",
      issue: issueDescription,
      error: error.message,
      recommendation: "Vui lòng kiểm tra lại kết nối mạng hoặc API Key của bạn."
    };
  }
};

export const assessQualityRisk = async (
  processStep: string,
  potentialFailure: string,
  appContext: any,
  generateText?: (prompt: string, systemPrompt?: string) => Promise<string>
) => {
  if (!generateText) {
    return {
      processStep,
      potentialFailure,
      riskScores: { severity: 5, occurrence: 3, detection: 3, rpn: 45 },
      riskLevel: "MEDIUM 🟡",
      mitigationStrategy: "Cần cấu hình API để gọi đánh giá rủi ro động."
    };
  }

  const systemPrompt = `Bạn là chuyên gia Quản lý rủi ro chất lượng (QRM) theo hướng dẫn ICH Q9 trong sản xuất dược phẩm đạt chuẩn GMP.
Nhiệm vụ: Đánh giá rủi ro chất lượng (FMEA) cho một bước quy trình sản xuất và lỗi tiềm ẩn đi kèm.
Hãy cho điểm từ 1-10 cho:
- Severity (S: Mức độ nghiêm trọng)
- Occurrence (O: Tần suất xuất hiện)
- Detection (D: Khả năng phát hiện nhờ IPC/kiểm soát)
Tính điểm RPN = S * O * D.
Xác định mức độ rủi ro (Risk Level): HIGH (nếu RPN >= 100), MEDIUM (nếu RPN từ 50-99), LOW (nếu RPN < 50).
Trả về một đối tượng JSON có cấu trúc chính xác như sau:
{
  "processStep": "tên bước quy trình",
  "potentialFailure": "tên lỗi tiềm ẩn",
  "riskScores": {
    "severity": số S từ 1-10,
    "occurrence": số O từ 1-10,
    "detection": số D từ 1-10,
    "rpn": điểm RPN (S * O * D)
  },
  "riskLevel": "Ví dụ: 'HIGH 🔴', 'MEDIUM 🟡', 'LOW 🟢'",
  "mitigationStrategy": "Đề xuất biện pháp kiểm soát và giảm thiểu rủi ro (ví dụ: in-process control, kiểm tra bổ sung, đào tạo...)"
}
Lưu ý: Chỉ trả về chuỗi JSON thô, không định dạng markdown (không sử dụng \`\`\`json).`;

  const prompt = `Đánh giá rủi ro cho bước quy trình: "${processStep}" với lỗi tiềm ẩn có thể xảy ra: "${potentialFailure}".`;

  try {
    const responseText = await generateText(prompt, systemPrompt);
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("FMEA AI Error:", error);
    return {
      processStep,
      potentialFailure,
      riskScores: { severity: 5, occurrence: 5, detection: 5, rpn: 125 },
      riskLevel: "UNKNOWN",
      mitigationStrategy: "Lỗi kết nối AI khi đánh giá rủi ro. Vui lòng thử lại sau."
    };
  }
};

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

export const getBatchSummary = (filter: string, appContext: any) => {
  const batches = appContext.batches || [];
  const testResults = appContext.testResults || [];
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let filteredBatches = batches;

  if (filter === 'expiring') {
    filteredBatches = batches.filter((b: any) => {
      if (!b.expDate) return false;
      const exp = new Date(b.expDate);
      return exp <= in30Days && exp >= now;
    });
  } else if (filter === 'failing') {
    const failBatchIds = new Set(
      testResults.filter((r: any) => r.overallStatus === 'FAIL').map((r: any) => r.batchId)
    );
    filteredBatches = batches.filter((b: any) => failBatchIds.has(b.id));
  }

  const statusCount = filteredBatches.reduce((acc: any, b: any) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  return {
    filter,
    total: filteredBatches.length,
    statusBreakdown: statusCount,
    batches: filteredBatches.slice(0, 10).map((b: any) => ({
      batchNo: b.batchNo,
      product: b.product?.name || b.productId,
      status: b.status,
      expDate: b.expDate
    })),
    summary: filter === 'expiring'
      ? `Có **${filteredBatches.length} lô** sắp hết hạn trong 30 ngày tới.`
      : filter === 'failing'
        ? `Có **${filteredBatches.length} lô** có kết quả kiểm nghiệm KHÔNG ĐẠT.`
        : `Tổng cộng **${filteredBatches.length} lô** trong hệ thống.`
  };
};

/**
 * Dispatcher: Nhận tên function và arguments từ Gemini, gọi hàm tương ứng.
 * @param toolName Tên hàm Gemini muốn gọi
 * @param args Arguments từ Gemini
 * @param appContext Toàn bộ dữ liệu ứng dụng
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

    case 'generateQualityReport': {
      const opts: QualityReportOptions = {
        period: (args.period as any) || 'all',
        year: args.year ? Number(args.year) : undefined,
        month: args.month ? Number(args.month) : undefined,
        quarter: args.quarter ? Number(args.quarter) : undefined,
        productId: args.productId || undefined,
      };
      try {
        const result = _generateReport(appContext, opts);
        return {
          success: true,
          filename: result.filename,
          message: `✅ Đã xuất báo cáo Excel **${result.summary.periodLabel}** với **${result.rowCount} phiếu kiểm nghiệm**.\n- Tỷ lệ đạt: **${result.summary.passRate}**\n- Đạt: ${result.summary.pass} | Không đạt: ${result.summary.fail}\n- File **.xlsx** (4 sheet): Tóm tắt · Tất cả phiếu · Đạt · Không đạt\n- File \`${result.filename}\` đã được tải về máy.`
        };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }

    case 'detectQualityAnomalies': {
      const anomalies = _detectAnomalies(appContext, args.daysAhead || 30);
      if (anomalies.length === 0) {
        return {
          count: 0,
          message: '✅ Không phát hiện bất thường chất lượng nào trong dữ liệu hiện tại.',
          anomalies: []
        };
      }
      const highCount = anomalies.filter(a => a.severity === 'HIGH').length;
      const summary = anomalies.map(a => `**[${a.severity}]** ${a.title}: ${a.detail}`).join('\n\n');
      return {
        count: anomalies.length,
        highPriorityCount: highCount,
        message: `⚠️ Phát hiện **${anomalies.length} bất thường chất lượng** (${highCount} mức HIGH).\n\n${summary}`,
        anomalies
      };
    }

    case 'generateProductionSynthesisReport': {
      try {
        const result = generateProductionSynthesisReport(args.productId, args.startDate, args.endDate, appContext);
        if (result.error) {
          return { error: result.error };
        }
        
        // Build markdown summary for the chatbot
        const markdownHeaders = ['Số Lô', 'Ngày SX', 'Hạn dùng', ...result.mainCriteria, 'Kết luận'];
        const mdHeaderRow = `| ${markdownHeaders.join(' | ')} |`;
        const mdDividerRow = `| ${markdownHeaders.map(() => '---').join(' | ')} |`;
        const mdDataRows = result.batches.map((b: any) => {
          const criteriaVals = result.mainCriteria.map((cName: string) => b.criteria[cName] || '---');
          return `| ${b.batchNo} | ${formatDate(b.mfgDate)} | ${formatDate(b.expDate)} | ${criteriaVals.join(' | ')} | **${b.overallStatus}** |`;
        }).join('\n');

        const tableMarkdown = `${mdHeaderRow}\n${mdDividerRow}\n${mdDataRows}`;
        
        return {
          success: true,
          productName: result.productName,
          productCode: result.productCode,
          tccsCode: result.tccsCode,
          totalBatches: result.totalBatches,
          message: `### Báo cáo tổng hợp chất lượng: **${result.productName} (${result.productCode})**\n- Tiêu chuẩn cơ sở: **${result.tccsCode}**\n- Tổng số lô sản xuất: **${result.totalBatches}**\n\n${tableMarkdown}\n\n*Bạn có thể xem chi tiết biểu đồ xu hướng và xuất file Excel đầy đủ tại trang [Báo cáo tổng hợp chất lượng](/reports/quality-summary).*`,
          action: 'REDIRECT',
          path: '/reports/quality-summary'
        };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    default:
      return { error: `Không tìm thấy tool "${toolName}"` };
  }
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '---';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
};

export const generateProductionSynthesisReport = (
  productId: string, 
  startDate: string | undefined, 
  endDate: string | undefined, 
  appContext: any
) => {
  const products = appContext.products || [];
  const batches = appContext.batches || [];
  const tccsList = appContext.tccsList || [];
  const productFormulas = appContext.productFormulas || [];
  const testResults = appContext.testResults || [];

  const product = products.find((p: any) => p.id === productId);
  if (!product) {
    return { error: `Không tìm thấy sản phẩm có ID: ${productId}` };
  }

  const pTccs = tccsList.filter((t: any) => t.productId === productId);
  const activeTccs = pTccs.find((t: any) => t.isActive) || [...pTccs].sort((a, b) => b.issueDate.localeCompare(a.issueDate))[0];
  if (!activeTccs) {
    return { error: `Sản phẩm ${product.name} chưa cấu hình tiêu chuẩn cơ sở (TCCS).` };
  }

  const mainCriteria = activeTccs.mainQualityCriteria || [];
  const formula = productFormulas.find((f: any) => f.productId === productId);

  let filteredBatches = batches.filter((b: any) => b.productId === productId);
  if (startDate) {
    const startStr = startDate.includes('/') ? startDate.split('/').reverse().join('-') : startDate;
    filteredBatches = filteredBatches.filter((b: any) => b.mfgDate && b.mfgDate >= startStr);
  }
  if (endDate) {
    const endStr = endDate.includes('/') ? endDate.split('/').reverse().join('-') : endDate;
    filteredBatches = filteredBatches.filter((b: any) => b.mfgDate && b.mfgDate <= endStr);
  }

  filteredBatches.sort((a: any, b: any) => (a.mfgDate || '').localeCompare(b.mfgDate || ''));

  const parseNumber = (val: any): number => {
    if (val === null || val === undefined) return NaN;
    const str = String(val).trim().replace(/[–—]/g, '-').replace(/,/g, '');
    const match = str.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
    return match ? parseFloat(match[0]) : NaN;
  };

  const rows = filteredBatches.map((batch: any) => {
    const batchResults = testResults.filter((r: any) => r.batchId === batch.id);
    
    const consolidatedMap = new Map<string, any>();
    [...batchResults]
      .sort((a, b) => a.testDate.localeCompare(b.testDate))
      .forEach(r => {
        (r.results || []).forEach((entry: any) => {
          if (entry && entry.criteriaName) {
            consolidatedMap.set(entry.criteriaName.trim().toLowerCase(), entry);
          }
        });
      });

    let overallStatus = 'PENDING';
    if (batchResults.length > 0) {
      const latestResult = [...batchResults].sort((a, b) => b.testDate.localeCompare(a.testDate))[0];
      overallStatus = latestResult.overallStatus;
    }

    const criteriaData: Record<string, string> = {};
    mainCriteria.forEach((criterion: any) => {
      const key = criterion.name.trim().toLowerCase();
      const entry = consolidatedMap.get(key);
      
      if (!entry || entry.value === undefined || entry.value === null || String(entry.value).trim() === '') {
        criteriaData[criterion.name] = '---';
        return;
      }

      const valText = String(entry.value).trim();
      if (valText === 'Miễn kiểm' || valText.includes('Đạt')) {
        criteriaData[criterion.name] = valText;
        return;
      }

      let basis: number | undefined = undefined;
      if (criterion.declaredContent != null && criterion.declaredContent !== '') {
        basis = typeof criterion.declaredContent === 'string' ? parseNumber(criterion.declaredContent) : Number(criterion.declaredContent);
      } else if (formula) {
        let formulaItem = formula.ingredients?.find((i: any) => i.name.trim().toLowerCase() === key) ||
                          formula.excipients?.find((e: any) => e.name.trim().toLowerCase() === key);
        if (criterion.formulaIngredientId) {
          const linkedName = criterion.formulaIngredientId.trim().toLowerCase();
          const linkedItem = formula.ingredients?.find((i: any) => i.name.trim().toLowerCase() === linkedName) ||
                             formula.excipients?.find((e: any) => e.name.trim().toLowerCase() === linkedName);
          if (linkedItem) formulaItem = linkedItem;
        }

        if (formulaItem) {
          const dc = typeof formulaItem.declaredContent === 'string' ? parseNumber(formulaItem.declaredContent) : formulaItem.declaredContent;
          const ec = formulaItem.elementalContent != null ? (typeof formulaItem.elementalContent === 'string' ? parseNumber(formulaItem.elementalContent) : formulaItem.elementalContent) : undefined;
          if (criterion.calculationBasis === 'ELEMENTAL' && ec != null && ec > 0) basis = ec;
          else basis = dc;
        }
      }

      const actualVal = parseNumber(valText);
      if (!isNaN(actualVal) && basis && basis > 0 && actualVal > 0) {
        const percent = (actualVal / basis) * 100;
        criteriaData[criterion.name] = `${valText} (${percent.toFixed(1)}%)`;
      } else {
        criteriaData[criterion.name] = valText;
      }
    });

    return {
      batchNo: batch.batchNo,
      mfgDate: batch.mfgDate,
      expDate: batch.expDate,
      overallStatus: overallStatus === 'PASS' ? 'ĐẠT' : overallStatus === 'FAIL' ? 'KHÔNG ĐẠT' : 'CHƯA HOÀN THIỆN',
      criteria: criteriaData
    };
  });

  return {
    productName: product.name,
    productCode: product.code,
    tccsCode: activeTccs.code,
    totalBatches: rows.length,
    batches: rows,
    mainCriteria: mainCriteria.map((c: any) => c.name)
  };
};
