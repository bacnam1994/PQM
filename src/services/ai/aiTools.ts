import { TestResult } from '../../types';
import { generateQualityReport as _generateReport, detectQualityAnomalies as _detectAnomalies, QualityReportOptions } from '../reportService';
import { generateRuleBasedOOSReport } from './oosInvestigationService';
import { generateAIInsights } from './autoLearningService';
import { compareLabReports } from './labComparisonService';
import { predictProductStability, generateStabilityForecastWithAI } from './stabilityPredictionService';
import { auditDataIntegrity, generateDataIntegrityAIAssessment } from './dataIntegrityService';
import { executeNLQuery } from './nlQueryService';
import { generateRuleBasedDeviationReport } from './deviationReportService';

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
    description: "Sinh va tra ve danh sach phan tich chat luong chu dong (AI Insights). Su dung khi nguoi dung hoi ve tinh hinh chat luong, insights, hoac khoi dong buoi sang.",
    parameters: {
      type: "OBJECT",
      properties: {
        forceRefresh: {
          type: "BOOLEAN",
          description: "true neu muon tai phan tich, bo qua cache cu."
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

// ============================================================
// CƠ SỞ DỮ LIỆU DƯỢC ĐIỂN NỘI BỘ — MỞ RỘNG
// Có thể thêm tiêu chuẩn mới tại đây.
// ============================================================
interface PharmacoeiaEntry {
  keywords: string[];       // Từ khóa để nhận dạng câu hỏi
  standard: string;          // Nội dung tiêu chuẩn (markdown)
  source: string;            // Nguồn: DĐVN V / USP / BP / EP / ICH
  category: string;          // Phân loại chỉ tiêu
}

const PHARMACOPOEIA_DB: PharmacoeiaEntry[] = [
  // ─── LÝ HÓA ───────────────────────────────────────────────────
  {
    keywords: ['độ ẩm', 'hàm lượng nước', 'moisture', 'loss on drying', 'lod', 'water content', 'kf', 'karl fischer'],
    standard: `**Độ ẩm (Loss on Drying / Moisture):**\n- Viên nén thông thường: **NMT 5.0%** (trừ chỉ dẫn riêng)\n- Viên nang: **NMT 7.0%** (tùy thành phần vỏ nang)\n- Bột/Cốm: **NMT 2.0–5.0%** (theo TCCS từng sản phẩm)\n- Phương pháp Karl Fischer: áp dụng cho mẫu nhạy nhiệt`,
    source: 'DĐVN V, Phụ lục 9.6 / USP <731>',
    category: 'Lý hóa'
  },
  {
    keywords: ['độ rã', 'thời gian rã', 'disintegration', 'rã', 'tan rã'],
    standard: `**Độ rã (Disintegration):**\n- Viên nén thông thường: **NMT 15 phút** (nước, 37°C)\n- Viên bao phim: **NMT 30 phút** (HCl 0.1N hoặc nước, 37°C)\n- Viên bao tan trong ruột (enteric): **không rã trong HCl 0.1N sau 2 giờ**, rã trong đệm phosphate pH 6.8 trong **NMT 60 phút**\n- Viên ngậm dưới lưỡi: **NMT 3 phút**\n- Viên sủi bọt: **NMT 5 phút** trong nước 15–25°C`,
    source: 'DĐVN V, Phụ lục 11.6 / USP <701>',
    category: 'Lý hóa'
  },
  {
    keywords: ['độ hòa tan', 'dissolution', 'hòa tan', 'drug release', 'in-vitro'],
    standard: `**Độ hòa tan (Dissolution):**\n- Yêu cầu chung: **NLT Q+5% sau 45 phút** (Q thường = 70–80% theo chuyên luận)\n- Thiết bị: Rổ quay (USP 1) hoặc Cánh khuấy (USP 2)\n- Môi trường: theo chỉ dẫn chuyên luận (nước, HCl 0.1N, đệm phosphate pH 4.5/6.8)\n- Nhiệt độ chuẩn: **37 ± 0.5°C**\n- Lưu ý: Với thuốc giải phóng có kiểm soát, theo profile đa điểm thời gian`,
    source: 'DĐVN V, Phụ lục 11.4 / USP <711>',
    category: 'Lý hóa'
  },
  {
    keywords: ['độ cứng', 'hardness', 'crushing strength', 'tensile strength'],
    standard: `**Độ cứng viên nén:**\n- Yêu cầu: thường **30–200 N** (tùy kích thước và đường kính viên)\n- Không có quy định cứng trong dược điển — áp dụng theo TCCS sản phẩm\n- Viên 8mm đường kính: thường 60–100 N\n- Đo bằng máy đo độ cứng Schleuniger, Monsanto`,
    source: 'TCCS sản phẩm / Pharmatest internal specification',
    category: 'Lý hóa'
  },
  {
    keywords: ['độ mài mòn', 'friability', 'attrition', 'abrasion'],
    standard: `**Độ mài mòn (Friability):**\n- Yêu cầu: **NMT 1.0%** (viên nén không bao)\n- Phương pháp: quay 100 vòng ở 25 rpm, sàng lọc bụi sau quay\n- Áp dụng cho viên không bao có khối lượng ≥ 650 mg: **NMT 0.5%**`,
    source: 'DĐVN V, Phụ lục 11.3 / USP <1216>',
    category: 'Lý hóa'
  },
  {
    keywords: ['đồng đều khối lượng', 'weight variation', 'mass variation', 'uniformity of mass', 'uom', 'đồng đều'],
    standard: `**Đồng đều khối lượng (Weight Variation):**\n- Viên nén < 80 mg: sai số ≤ **±10%**, không viên nào vượt ±20%\n- Viên nén 80–250 mg: sai số ≤ **±7.5%**, không viên nào vượt ±15%\n- Viên nén > 250 mg: sai số ≤ **±5%**, không viên nào vượt ±10%\n- Mẫu: thử 20 viên, không hơn 2 viên được sai số vượt ngưỡng trên`,
    source: 'DĐVN V, Phụ lục 11.2 / USP <2091>',
    category: 'Lý hóa'
  },
  {
    keywords: ['đồng đều hàm lượng', 'content uniformity', 'uniformity of dosage', 'cu', 'uds'],
    standard: `**Đồng đều hàm lượng (Content Uniformity):**\n- AV (Acceptance Value) ≤ **L1 = 15.0** (thử lần 1 với 10 đơn vị)\n- Nếu không đạt: tiếp tục thử 20 đơn vị, AV ≤ **L2 = 25.0**\n- Áp dụng cho dạng bào chế chứa < 25 mg hoặc < 25% hoạt chất`,
    source: 'DĐVN V, Phụ lục 11.7 / USP <905> / ICH Q6A',
    category: 'Lý hóa'
  },
  {
    keywords: ['ph', 'hydrogen ion', 'độ acid', 'độ kiềm', 'acidity', 'alkalinity'],
    standard: `**Độ pH:**\n- Dung dịch tiêm: thường **4.0–8.5** (theo chuyên luận từng sản phẩm)\n- Sirô uống: **3.0–5.0** (phụ thuộc thành phần)\n- Nhỏ mắt: **6.0–8.0** (gần sinh lý)\n- Đo bằng máy đo pH đã hiệu chuẩn với dung dịch đệm chuẩn`,
    source: 'DĐVN V, Phụ lục 6.2 / USP <791>',
    category: 'Lý hóa'
  },
  {
    keywords: ['độ nhớt', 'viscosity', 'brookfield', 'kinematic'],
    standard: `**Độ nhớt (Viscosity):**\n- Gel/Kem/Mỡ: theo yêu cầu TCCS riêng, đo ở nhiệt độ xác định (thường 25°C)\n- Dung dịch tiêm: thường NMT 50 mPa·s\n- Phương pháp: Brookfield (rotational) hoặc Ostwald (kinematic)\n- Đơn vị: mPa·s (hoặc cP, 1 cP = 1 mPa·s)`,
    source: 'DĐVN V, Phụ lục 6.14 / USP <911>',
    category: 'Lý hóa'
  },
  {
    keywords: ['tỷ trọng', 'specific gravity', 'relative density', 'density'],
    standard: `**Tỷ trọng (Relative Density):**\n- Siro: thường **1.10–1.35**\n- Dung dịch tiêm: thường **0.9–1.1**\n- Đo bằng tỷ trọng kế (hydrometer) hoặc máy đo tỷ trọng điện tử (pycnometer)\n- Nhiệt độ đo tiêu chuẩn: **20°C**`,
    source: 'DĐVN V, Phụ lục 6.5 / USP <841>',
    category: 'Lý hóa'
  },
  {
    keywords: ['tro', 'residue on ignition', 'sulfated ash', 'sulphated ash', 'ash', 'tro sulfat'],
    standard: `**Tro sulfat (Sulfated Ash):**\n- Nguyên liệu: thường **NMT 0.1%** (tùy chuyên luận)\n- Thành phẩm viên: thường không quy định (trừ trường hợp đặc biệt)\n- Phương pháp: nung ở 600°C với H₂SO₄ đậm đặc`,
    source: 'DĐVN V, Phụ lục 9.8 / USP <281>',
    category: 'Lý hóa'
  },
  {
    keywords: ['cảm quan', 'hình thức', 'appearance', 'description', 'color', 'colour', 'màu sắc', 'clarity'],
    standard: `**Chỉ tiêu cảm quan (Appearance/Description):**\n- Thường là chỉ tiêu định tính: mô tả hình dạng, màu sắc, mùi, vị\n- Tiêu chuẩn: "Đúng như mô tả" — không có ngưỡng số\n- Ví dụ: "Viên nén tròn, bao phim màu trắng, hai mặt lồi, không có vết nứt vỡ"\n- Đánh giá: So sánh với mẫu chuẩn (reference standard) bằng mắt thường`,
    source: 'DĐVN V, Phụ lục 3 / USP <631>',
    category: 'Lý hóa'
  },
  {
    keywords: ['độ trong', 'clarity of solution', 'opalescence', 'turbidity', 'trong suốt'],
    standard: `**Độ trong của dung dịch (Clarity of Solution):**\n- So sánh với thang đục chuẩn (Formazin): RS1–RS4\n- Thường yêu cầu: **không đục hơn RS1** hoặc RS2 (tùy chuyên luận)\n- Đo bằng máy đo độ đục (Turbidimeter) hoặc so sánh mắt thường trên nền đen/trắng`,
    source: 'DĐVN V, Phụ lục 9.2 / USP <631>',
    category: 'Lý hóa'
  },
  {
    keywords: ['góc quay cực', 'optical rotation', 'specific rotation', 'polarimetry'],
    standard: `**Góc quay cực riêng [α] (Optical Rotation):**\n- Đo bằng máy phân cực (Polarimeter) ở 589 nm (đèn Natri D-line), 20°C\n- Giá trị theo từng chuyên luận nguyên liệu\n- Ví dụ: Glucose anhydrous: **[α] = +52.5° đến +53.3°**`,
    source: 'DĐVN V, Phụ lục 6.7 / USP <781>',
    category: 'Lý hóa'
  },
  {
    keywords: ['điểm chảy', 'melting point', 'mp', 'melting range'],
    standard: `**Điểm chảy (Melting Point):**\n- Giá trị theo từng chuyên luận nguyên liệu\n- Khoảng chảy: thường ≤ 2°C\n- Phương pháp: ống mao quản (capillary tube), máy đo điểm chảy tự động`,
    source: 'DĐVN V, Phụ lục 6.6 / USP <741>',
    category: 'Lý hóa'
  },

  // ─── ĐỊNH LƯỢNG (ASSAY) ───────────────────────────────────────
  {
    keywords: ['paracetamol', 'acetaminophen', 'panadol', 'tylenol'],
    standard: `**Định lượng Paracetamol (Acetaminophen):**\n- Hàm lượng: **95.0–105.0%** so với hàm lượng ghi trên nhãn\n- Phương pháp: HPLC (pha đảo, C18, detector UV 243 nm) hoặc UV-Vis (243 nm)\n- Nguyên liệu API: **98.0–101.0%** (tính theo dạng khan)`,
    source: 'DĐVN V, Chuyên luận Paracetamol / USP Acetaminophen / BP Paracetamol',
    category: 'Định lượng'
  },
  {
    keywords: ['amoxicillin', 'amoxil', 'trimox'],
    standard: `**Định lượng Amoxicillin:**\n- Thành phẩm viên/nang: **90.0–110.0%** so với hàm lượng ghi nhãn\n- Nguyên liệu: **95.0–102.0%** (tính theo dạng khan)\n- Phương pháp: HPLC pha đảo, detector UV 254 nm\n- Bảo quản lạnh, tránh ẩm; kiểm tra độ ổn định thường xuyên`,
    source: 'USP Amoxicillin / BP Amoxicillin / DĐVN V',
    category: 'Định lượng'
  },
  {
    keywords: ['vitamin c', 'ascorbic acid', 'acid ascorbic', 'vitaminc'],
    standard: `**Định lượng Vitamin C (Acid Ascorbic):**\n- Thành phẩm: **90.0–110.0%** so với hàm lượng ghi nhãn\n- Nguyên liệu: **99.0–100.5%**\n- Phương pháp: Chuẩn độ iod (iodimetry) hoặc HPLC\n- Lưu ý: Nhạy với nhiệt độ, ánh sáng và oxy — bảo quản kín, tránh sáng`,
    source: 'DĐVN V / USP Ascorbic Acid',
    category: 'Định lượng'
  },
  {
    keywords: ['vitamin d', 'cholecalciferol', 'ergocalciferol', 'd3', 'd2'],
    standard: `**Định lượng Vitamin D (Cholecalciferol/Ergocalciferol):**\n- Thành phẩm: **90.0–110.0%** so với hàm lượng ghi nhãn\n- Phương pháp: HPLC-UV (265 nm) hoặc LC-MS/MS (độ chính xác cao hơn)\n- Lưu ý: Nhạy sáng, bảo quản ở 2–8°C, tránh ánh sáng UV`,
    source: 'DĐVN V / USP Cholecalciferol Capsules / BP',
    category: 'Định lượng'
  },
  {
    keywords: ['ibuprofen', 'brufen', 'advil'],
    standard: `**Định lượng Ibuprofen:**\n- Thành phẩm: **90.0–110.0%** so với hàm lượng ghi nhãn\n- Nguyên liệu: **98.0–102.0%**\n- Phương pháp: HPLC pha đảo C18, UV 221 nm`,
    source: 'DĐVN V / USP Ibuprofen / BP',
    category: 'Định lượng'
  },
  {
    keywords: ['metformin', 'glucophage', 'tiểu đường'],
    standard: `**Định lượng Metformin HCl:**\n- Thành phẩm: **93.0–107.0%** so với hàm lượng ghi nhãn\n- Nguyên liệu: **98.5–101.5%**\n- Phương pháp: HPLC, detector UV 218 nm; hoặc chuẩn độ acid-base`,
    source: 'USP Metformin HCl / BP / DĐVN',
    category: 'Định lượng'
  },
  {
    keywords: ['định lượng', 'assay', 'hàm lượng', 'content', 'purity', 'potency', 'label claim'],
    standard: `**Định lượng (Assay) — Yêu cầu chung:**\n- Thành phẩm thuốc thông thường: **90.0–110.0%** so với hàm lượng ghi nhãn\n- Nguyên liệu dược dụng: thường **98.0–102.0%** (tính theo dạng khan)\n- Thuốc kháng sinh, vitamin: kiểm tra đặc biệt, thường **95.0–105.0%**\n- Phương pháp: HPLC (tiêu chuẩn vàng), UV-Vis, hoặc chuẩn độ hóa học`,
    source: 'ICH Q6A / DĐVN V / USP General Chapter <905>',
    category: 'Định lượng'
  },
  {
    keywords: ['tạp chất', 'related substances', 'impurities', 'rs', 'related compounds', 'organic impurities'],
    standard: `**Tạp chất liên quan (Related Substances):**\n- Tạp đã biết (known impurity): thường **NMT 0.2%** (mỗi chất) theo ICH Q3A/B\n- Tạp chưa biết (unknown): **NMT 0.10%** (mỗi chất)\n- Tổng tạp: **NMT 0.5–2.0%** (tùy chuyên luận sản phẩm)\n- Thành phẩm: tổng tạp phân hủy **NMT 2.0%** (thường)\n- Phương pháp: HPLC độ nhạy cao, detector DAD hoặc MS`,
    source: 'ICH Q3A/B/C / DĐVN V, Phụ lục 9.3 / USP <621>',
    category: 'Định lượng'
  },

  // ─── VI SINH VẬT ─────────────────────────────────────────────
  {
    keywords: ['vi sinh', 'microbial', 'tamc', 'tvkhk', 'tổng số vi khuẩn', 'total aerobic', 'tpc', 'apc', 'cfu'],
    standard: `**Giới hạn vi sinh vật (Microbial Limits) — Thuốc uống không yêu cầu vô khuẩn:**\n- TAMC (Tổng vi khuẩn hiếu khí): **NMT 10³ CFU/g hoặc mL**\n- TYMC (Nấm mốc + nấm men): **NMT 10² CFU/g hoặc mL**\n- E. coli: **Không được có** (trong 1g hoặc 1mL)\n- Salmonella, Staphylococcus aureus: **Không được có** (trong 1g)\n\n**Thuốc bôi ngoài da:**\n- TAMC: **NMT 10² CFU/g hoặc mL**\n- TYMC: **NMT 10¹ CFU/g hoặc mL**\n- P. aeruginosa, S. aureus: **Không được có** (trong 1g)`,
    source: 'DĐVN V, Phụ lục 13.6 / USP <61><62> / EP 5.1.4',
    category: 'Vi sinh vật'
  },
  {
    keywords: ['nấm mốc', 'nấm men', 'tymc', 'yeast', 'mold', 'mould', 'fungal'],
    standard: `**Tổng số nấm mốc và nấm men (TYMC):**\n- Thuốc uống: **NMT 10² CFU/g hoặc mL**\n- Thuốc bôi ngoài: **NMT 10¹ CFU/g hoặc mL**\n- Môi trường: Sabouraud Dextrose Agar (SDA), ủ 5 ngày ở 22–25°C\n- Nếu dùng mẫu lỏng: pha loãng theo hệ số 10, đếm đĩa 1:10 hoặc 1:100`,
    source: 'DĐVN V, Phụ lục 13.6 / USP <62>',
    category: 'Vi sinh vật'
  },
  {
    keywords: ['vô khuẩn', 'sterility', 'sterile', 'sterilization'],
    standard: `**Thử vô khuẩn (Sterility Test):**\n- Áp dụng: thuốc tiêm, thuốc nhỏ mắt, dịch truyền TM, implant\n- Phương pháp: Lọc màng (membrane filtration) — ưu tiên; hoặc nuôi cấy trực tiếp\n- Môi trường: Fluid Thioglycollate Medium (FTM) + Soybean Casein Digest Medium (SCDM)\n- Thời gian ủ: **14 ngày** ở 30–35°C (FTM) và 20–25°C (SCDM)\n- Kết quả: **Không có sự phát triển vi sinh vật**`,
    source: 'DĐVN V, Phụ lục 13.1 / USP <71> / EP 2.6.1',
    category: 'Vi sinh vật'
  },
  {
    keywords: ['nội độc tố', 'endotoxin', 'lal', 'pyrogen', 'bacterial endotoxin'],
    standard: `**Thử nội độc tố vi khuẩn (Bacterial Endotoxins Test — BET/LAL):**\n- Thuốc tiêm tĩnh mạch: **NMT 0.25 EU/mL** (hoặc theo giới hạn K)\n- Dịch truyền: thường **NMT 0.5 EU/mL**\n- Phương pháp: Gel-clot, Turbidimetric hoặc Chromogenic\n- Giới hạn K = 5 EU/kg/h (người lớn 70 kg, 1h, IV)\n- Công thức: Giới hạn = K / M (M = liều mg/kg/h)`,
    source: 'DĐVN V, Phụ lục 13.2 / USP <85> / EP 2.6.14',
    category: 'Vi sinh vật'
  },

  // ─── KIM LOẠI NẶNG ───────────────────────────────────────────
  {
    keywords: ['kim loại nặng', 'heavy metals', 'kln', 'arsenic', 'asen', 'chì', 'lead', 'thủy ngân', 'mercury', 'cadmium', 'cadmi'],
    standard: `**Giới hạn kim loại nặng (Heavy Metals) — Thuốc uống:**\n- Asen (As): **NMT 2 ppm** (2 µg/g)\n- Chì (Pb): **NMT 5 ppm** (5 µg/g)\n- Thủy ngân (Hg): **NMT 0.5 ppm** (0.5 µg/g)\n- Cadmi (Cd): **NMT 0.5 ppm** (0.5 µg/g)\n- Tổng kim loại nặng: **NMT 20 ppm** (theo giới hạn chung)\n- Phương pháp: ICP-MS (độ nhạy cao), ICP-OES, AAS\n\n**Thuốc bôi ngoài:**\n- Pb: NMT 10 ppm; Cd: NMT 1 ppm; Hg: NMT 1 ppm`,
    source: 'DĐVN V, Phụ lục 9.4 / USP <232><233> / ICH Q3D',
    category: 'Kim loại nặng'
  },

  // ─── BAO BÌ & BẢO QUẢN ──────────────────────────────────────
  {
    keywords: ['độ kín', 'container closure', 'seal', 'closure integrity', 'leak test'],
    standard: `**Kiểm tra độ kín bao bì (Container Closure Integrity):**\n- Màng bao blister/vỉ nhôm: ngâm nước màu xanh hoặc test áp suất\n- Lọ PE/HDPE: test rò rỉ dưới chân không\n- Lọ thủy tinh tiêm: kiểm tra bằng áp suất hoặc màu sắc\n- Tiêu chuẩn: **không rò rỉ**, không phát hiện màu thâm nhập`,
    source: 'DĐVN V, Phụ lục 1.3 / USP <1207>',
    category: 'Bao bì'
  },
  {
    keywords: ['độ ẩm bao bì', 'water vapor transmission', 'wvtr', 'moisture permeation'],
    standard: `**Độ thấm hơi nước bao bì (WVTR):**\n- Blister PVC/PVDC: thường **NMT 0.5 g/m²/ngày** ở 23°C, 85%RH\n- Blister Cold-form (Alu-Alu): **NMT 0.05 g/m²/ngày** (hầu như không thấm)\n- Lọ HDPE: **NMT 20 mg/day** (Class A: tighter packaging)`,
    source: 'USP <661> / ASTM F1249',
    category: 'Bao bì'
  },

  // ─── ĐỘ ỔN ĐỊNH ─────────────────────────────────────────────
  {
    keywords: ['độ ổn định', 'stability', 'shelf life', 'accelerated', 'long-term', 'real-time', 'ict'],
    standard: `**Nghiên cứu độ ổn định (Stability Study):**\n- **Dài hạn (Long-term):** 25°C ± 2°C / 60%RH ± 5% — thường 12–36 tháng\n- **Lão hóa cấp tốc (Accelerated):** 40°C ± 2°C / 75%RH ± 5% — 6 tháng\n- **Vùng khí hậu Việt Nam (Zone IVb):** 30°C ± 2°C / 75%RH ± 5%\n- Tiêu chí đánh giá: nằm trong giới hạn chỉ tiêu tại mỗi điểm kiểm tra\n- Điểm lấy mẫu dài hạn: T=0, 3, 6, 9, 12, 18, 24, 36 tháng`,
    source: 'ICH Q1A(R2) / ASEAN Guideline / WHO TRS 953',
    category: 'Độ ổn định'
  },
];

/**
 * Tính điểm relevance giữa câu hỏi và từ khóa của entry
 */
const calcRelevanceScore = (query: string, entry: PharmacoeiaEntry): number => {
  const q = query.toLowerCase().trim();
  let score = 0;
  for (const kw of entry.keywords) {
    if (q === kw) { score += 10; continue; }
    if (q.includes(kw)) { score += 5; continue; }
    if (kw.includes(q)) { score += 3; continue; }
    // Partial word match (từng từ)
    const qWords = q.split(/\s+/);
    const kwWords = kw.split(/\s+/);
    const matched = qWords.filter(w => w.length > 2 && kwWords.some(kw2 => kw2.includes(w) || w.includes(kw2)));
    score += matched.length * 2;
  }
  return score;
};

export const lookupPharmacoeiaStandard = (query: string) => {
  // Tính relevance score cho mỗi entry
  const scored = PHARMACOPOEIA_DB.map(entry => ({
    entry,
    score: calcRelevanceScore(query, entry)
  })).filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      query,
      found: false,
      message: `Chưa có dữ liệu chính xác cho **"${query}"** trong cơ sở kiến thức dược điển nội bộ (${PHARMACOPOEIA_DB.length} tiêu chuẩn đã lập chỉ mục).\n\n**Gợi ý:** Vui lòng kiểm tra trực tiếp tại:\n- Dược điển Việt Nam V (DĐVN V)\n- USP Online: https://www.uspnf.com\n- British Pharmacopoeia (BP)\n- Hoặc chuyên luận kỹ thuật của sản phẩm`
    };
  }

  // Trả về kết quả tốt nhất (và tối đa 2 kết quả liên quan nếu có)
  const best = scored[0].entry;
  const related = scored.slice(1, 3).map(s => s.entry.keywords[0]);

  return {
    query,
    found: true,
    category: best.category,
    source: best.source,
    content: best.standard,
    relatedTopics: related.length > 0 ? related : undefined,
    note: `Thông tin tham khảo từ cơ sở kiến thức nội bộ. Luôn xác minh với phiên bản dược điển mới nhất và TCCS của sản phẩm cụ thể.`
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

    case 'generateOOSInvestigation': {
      const batches = appContext.batches || [];
      const testResults = appContext.testResults || [];
      const products = appContext.products || [];
      const productFormulas = appContext.productFormulas || [];
      const targetBatch = batches.find((b: any) => b.batchNo === args.batchNo || b.id === args.batchNo);
      if (!targetBatch) {
        return { error: `Không tìm thấy thông tin lô hàng "${args.batchNo}" trong hệ thống.` };
      }
      const product = products.find((p: any) => p.id === targetBatch.productId);
      const resultsForBatch = testResults.filter((r: any) => r.batchId === targetBatch.id);
      const allEntries = resultsForBatch.flatMap((r: any) => r.results || []);
      const failed = allEntries.filter((e: any) => e.isPass === false);
      const passed = allEntries.filter((e: any) => e.isPass === true);
      const formula = productFormulas.find((f: any) => f.productId === targetBatch.productId);

      const oosReport = generateRuleBasedOOSReport({
        productName: product?.name || 'Sản phẩm',
        batchNo: targetBatch.batchNo,
        mfgDate: targetBatch.mfgDate,
        expDate: targetBatch.expDate,
        failedCriteria: failed.length > 0 ? failed.map((f: any) => ({
          criteriaName: f.criteriaName,
          actualValue: f.value,
          specification: f.limit || 'TCCS',
          unit: f.unit,
        })) : [{ criteriaName: args.criteriaName || 'Chỉ tiêu chất lượng', actualValue: 'Không đạt', specification: 'TCCS' }],
        passedCriteria: passed.map((p: any) => ({ criteriaName: p.criteriaName, actualValue: p.value })),
        formulaIngredients: formula?.ingredients || [],
      });

      const capaList = oosReport.capaPlan.map(c => `- **[${c.type}]** ${c.action} *(Phụ trách: ${c.responsible}, Hạn: ${c.deadline})*`).join('\n');
      const ishikawaCauses = oosReport.ishikawaDiagram.map(cat => `  • **${cat.vietnameseLabel}**: ${cat.causes.join('; ')}`).join('\n');

      return {
        success: true,
        reportId: oosReport.reportId,
        productName: oosReport.productName,
        batchNo: oosReport.batchNo,
        message: `### 🚨 HỒ SƠ ĐIỀU TRA OOS (GMP): Lô **${oosReport.batchNo}** - ${oosReport.productName}\n\n**1. Tóm tắt sự cố:**\n${oosReport.executiveSummary}\n\n**2. Đánh giá nguyên nhân gốc rễ (Root Cause):**\n${oosReport.rootCauseStatement}\n\n**3. Sơ đồ xương cá Ishikawa 6M:**\n${ishikawaCauses}\n\n**4. Kế hoạch hành động khắc phục & phòng ngừa (CAPA):**\n${capaList}\n\n*Bạn có thể xem đầy đủ và in biên bản OOS trực tiếp tại trang [Chi tiết Lô hàng](/batches/${targetBatch.id}).*`,
        action: 'REDIRECT',
        path: `/batches/${targetBatch.id}`
      };
    }

    case 'getAIInsights': {
      try {
        const { clearInsightCache } = await import('./autoLearningService');
        if (args.forceRefresh) clearInsightCache();
        const insights = await generateAIInsights(appContext, generateText || (async () => ''));
        if (insights.length === 0) {
          return { count: 0, message: 'He thong hoat dong tot. Khong phat hien van de chat luong nao dang chu y.' };
        }
        const insightLines = insights.map(i => {
          const badge = i.severity === 'HIGH' ? '[CAO]' : i.severity === 'MEDIUM' ? '[TB]' : '[THAP]';
          return badge + ' **' + i.title + '**\n' + i.detail;
        }).join('\n\n---\n\n');
        return { count: insights.length, message: '### AI Insights\n\n' + insightLines, insights };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'compareLabResults': {
      try {
        const testResults: TestResult[] = appContext.testResults || [];
        const batches = appContext.batches || [];
        const learned = appContext.aiLearnedMappings || [];

        const targetBatch = batches.find((b: any) => b.batchNo === args.batchNo || b.id === args.batchNo);
        if (!targetBatch) {
          return { error: `Không tìm thấy thông tin lô hàng "${args.batchNo}" trong hệ thống.` };
        }

        const batchResults = testResults.filter((r: any) => r.batchId === targetBatch.id);
        if (batchResults.length < 2) {
          return {
            error: `Lô "${targetBatch.batchNo}" hiện chỉ có ${batchResults.length} phiếu kiểm nghiệm. Cần ít nhất 2 phiếu kiểm nghiệm để thực hiện đối chiếu chéo.`
          };
        }

        let r1 = batchResults[0];
        let r2 = batchResults[1];

        if (args.lab1Name) {
          const found = batchResults.find(r => r.labName?.toLowerCase().includes(args.lab1Name.toLowerCase()));
          if (found) r1 = found;
        }
        if (args.lab2Name) {
          const found = batchResults.find(r => r !== r1 && r.labName?.toLowerCase().includes(args.lab2Name.toLowerCase()));
          if (found) r2 = found;
        }

        const comparison = await compareLabReports(
          { title: `Phiếu 1 (${r1.labName || 'Nội bộ'})`, labName: r1.labName || 'Nội bộ', testDate: r1.testDate, batchNo: targetBatch.batchNo, overallStatus: r1.overallStatus, results: r1.results || [] },
          { title: `Phiếu 2 (${r2.labName || 'Ngoại kiểm'})`, labName: r2.labName || 'Ngoại kiểm', testDate: r2.testDate, batchNo: targetBatch.batchNo, overallStatus: r2.overallStatus, results: r2.results || [] },
          learned
        );

        const entryLines = comparison.entries
          .filter(e => e.deviationLevel !== 'SINGLE_SOURCE')
          .map(e => `| ${e.criteriaName} | ${e.source1Value} ${e.source1Unit || ''} | ${e.source2Value} ${e.source2Unit || ''} | ${e.rpd !== undefined ? `${e.rpd}%` : '---'} | **${e.deviationLevel}** |`)
          .join('\n');

        const mdTable = `| Chỉ tiêu | ${comparison.report1.labName} | ${comparison.report2.labName} | Độ lệch (%RPD) | Đánh giá |\n| --- | --- | --- | --- | --- |\n${entryLines}`;

        return {
          success: true,
          comparisonId: comparison.comparisonId,
          metrics: comparison.metrics,
          message: `### 🔬 ĐỐI CHIẾU KẾT QUẢ KIỂM NGHIỆM: Lô **${targetBatch.batchNo}**\n\n- **Đơn vị 1:** ${comparison.report1.labName} (${comparison.report1.testDate || 'N/A'})\n- **Đơn vị 2:** ${comparison.report2.labName} (${comparison.report2.testDate || 'N/A'})\n- **Tỷ lệ đồng thuận:** **${comparison.metrics.agreementRatePercent}%** (Độ lệch TB: **${comparison.metrics.avgRpdPercent}%**)\n\n${mdTable}\n\n**Nhận định chuyên môn:**\n${comparison.aiAnalysis.summary}\n\n**Đánh giá sai số hệ thống (Lab Bias):**\n${comparison.aiAnalysis.systematicBiasAssessment}`
        };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'predictQualityStability': {
      try {
        const products = appContext.products || [];
        const batches = appContext.batches || [];
        const testResults = appContext.testResults || [];
        const tccsList = appContext.tccsList || [];

        const targetProduct = products.find((p: any) => p.id === args.productId || p.name?.toLowerCase().includes(String(args.productId).toLowerCase()));
        if (!targetProduct) {
          return { error: `Không tìm thấy sản phẩm "${args.productId}" trong hệ thống.` };
        }

        const tccs = tccsList.find((t: any) => t.productId === targetProduct.id && t.isActive) || tccsList.find((t: any) => t.productId === targetProduct.id);
        const report = predictProductStability(targetProduct, batches, testResults, tccs, args.shelfLifeMonths || 24);
        const enrichedReport = await generateStabilityForecastWithAI(report);

        const forecastLines = enrichedReport.forecasts.map(f => {
          const icon = f.riskLevel === 'HIGH_EXPIRY_RISK' ? '🚨' : f.riskLevel === 'MODERATE_RISK' ? '⚠️' : '✅';
          return `- ${icon} **${f.criteriaName}**: Ban đầu: ${f.initialValue}${f.unit} → Mới nhất: ${f.latestValue}${f.unit} (Giảm: ${(f.decayRatePerMonth * 12).toFixed(1)}${f.unit}/năm, R²=${f.rSquared}). ${f.projectedMonthToMinLimit ? `Dự kiến chạm Min (${f.minLimit}${f.unit}) sau **${f.projectedMonthToMinLimit} tháng**.` : 'Duy trì ổn định.'}`;
        }).join('\n');

        return {
          success: true,
          productId: targetProduct.id,
          productName: targetProduct.name,
          forecasts: enrichedReport.forecasts,
          message: `### 📈 BÁO CÁO DỰ BÁO ĐỘ ỔN ĐỊNH & HẠN DÙNG: **${targetProduct.name}**\n\n**1. Tóm tắt chuyên môn:**\n${enrichedReport.executiveSummary}\n\n**2. Chi tiết động học suy giảm theo chỉ tiêu:**\n${forecastLines}\n\n*Xem biểu đồ xu hướng trực quan tại trang [Phân tích Xu hướng](/trend-analysis).*`,
          action: 'REDIRECT',
          path: '/trend-analysis'
        };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    case 'auditDataIntegrity': {
      try {
        const testResults = appContext.testResults || [];
        const batches = appContext.batches || [];
        const auditLogs = appContext.auditLogs || [];

        const report = auditDataIntegrity(auditLogs, testResults, batches);
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
    }

    case 'queryDataNaturalLanguage': {
      return queryDataNaturalLanguage(args.query, appContext);
    }

    case 'generateDeviationReport': {
      return generateDeviationReport(args.batchNo, appContext);
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

// ============================================================
// TOOL: queryDataNaturalLanguage
// Thực thi NL Query trên dữ liệu hệ thống PQM
// ============================================================

export const queryDataNaturalLanguage = (query: string, appContext: any) => {
  return executeNLQuery(query, {
    products: appContext.products || [],
    batches: appContext.batches || [],
    testResults: appContext.testResults || [],
    tccsList: appContext.tccsList || [],
    productFormulas: appContext.productFormulas || [],
  });
};

// ============================================================
// TOOL: generateDeviationReport
// Tạo Deviation Report cho lô không đạt
// ============================================================

export const generateDeviationReport = (batchNo: string, appContext: any) => {
  const batches = appContext.batches || [];
  const products = appContext.products || [];
  const testResults = appContext.testResults || [];
  const productFormulas = appContext.productFormulas || [];

  const batch = batches.find((b: any) => b.batchNo?.toLowerCase() === batchNo?.toLowerCase() || b.id === batchNo);
  if (!batch) {
    return { error: `Không tìm thấy lô "${batchNo}" trong hệ thống.` };
  }

  const product = products.find((p: any) => p.id === batch.productId);
  const batchResults = testResults.filter((r: any) => r.batchId === batch.id);
  const latestResult = batchResults.sort((a: any, b: any) => (b.testDate || '').localeCompare(a.testDate || ''))[0];
  const formula = productFormulas.find((f: any) => f.productId === batch.productId);

  if (!latestResult) {
    return { error: `Lô "${batchNo}" chưa có kết quả kiểm nghiệm.` };
  }

  const failedCriteria = (latestResult.results || [])
    .filter((r: any) => r.isPass === false)
    .map((r: any) => ({
      name: r.criteriaName,
      actualValue: r.value,
      unit: r.unit,
      specification: 'Theo TCCS',
    }));

  if (failedCriteria.length === 0) {
    return { message: `Lô "${batchNo}" không có chỉ tiêu nào không đạt trong phiếu kiểm nghiệm gần nhất.` };
  }

  const report = generateRuleBasedDeviationReport({
    productName: product?.name || batch.productId,
    batchNo: batch.batchNo,
    mfgDate: batch.mfgDate,
    expDate: batch.expDate,
    labName: latestResult.labName,
    testDate: latestResult.testDate,
    failedCriteria,
    formulaIngredients: formula?.ingredients || [],
  });

  return {
    reportId: report.reportId,
    decision: report.decision,
    decisionLabel: {
      RELEASE_WITH_NOTE: 'Xuất với điều kiện',
      REPROCESS: 'Tái chế',
      REJECT: 'Từ chối / Tiêu hủy',
      PENDING_INVESTIGATION: 'Chờ điều tra',
    }[report.decision] || report.decision,
    executiveSummary: report.executiveSummary,
    rootCause: report.rootCauseStatement,
    immediateActions: report.capaItems.filter(c => c.type === 'IMMEDIATE').map(c => c.action),
    patientSafetyRisk: report.immediateImpact.patientSafetyRisk,
    capaCount: report.capaItems.length,
    note: `Để xem báo cáo đầy đủ, hãy vào trang Chi tiết lô ${batchNo} → click nút "Deviation Report" bên cạnh phiếu kiểm nghiệm KHÔNG ĐẠT.`,
  };
};

