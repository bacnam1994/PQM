import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { getApiKey, getGeminiModel } from './geminiService';

export interface IshikawaCategory {
  category: 'Man' | 'Machine' | 'Material' | 'Method' | 'Measurement' | 'Milieu';
  vietnameseLabel: string;
  causes: string[];
}

export interface CAPAItem {
  id: string;
  type: 'CORRECTION' | 'CORRECTIVE' | 'PREVENTIVE';
  action: string;
  responsible: string;
  deadline: string;
  verificationMethod: string;
}

export interface OOSInvestigationReport {
  reportId: string;
  generatedAt: string;
  productName: string;
  batchNo: string;
  mfgDate?: string;
  expDate?: string;
  failedCriteria: {
    criteriaName: string;
    actualValue: string | number;
    specification: string;
    unit?: string;
    deviationPercent?: string;
  }[];
  executiveSummary: string;
  phase1LabInvestigation: {
    summary: string;
    equipmentCheck: string;
    standardAndReagentCheck: string;
    samplePrepCheck: string;
    isLabError: boolean;
    labVerdict: string;
  };
  phase2ManufacturingInvestigation: {
    summary: string;
    rawMaterialReview: string;
    processParametersReview: string;
    environmentReview: string;
    manufacturingVerdict: string;
  };
  ishikawaDiagram: IshikawaCategory[];
  fiveWhyAnalysis: {
    level: number;
    question: string;
    answer: string;
  }[];
  rootCauseStatement: string;
  riskAssessment: {
    patientSafetyRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    scopeImpact: string; // Đánh giá ảnh hưởng đến các lô liên quan khác
    regulatoryNotificationRequired: boolean;
  };
  capaPlan: CAPAItem[];
}

/**
 * Fallback generator khi không có API Key hoặc mạng bị gián đoạn
 */
export const generateRuleBasedOOSReport = (data: {
  productName: string;
  batchNo: string;
  mfgDate?: string;
  expDate?: string;
  failedCriteria: { criteriaName: string; actualValue: string | number; specification: string; unit?: string }[];
  passedCriteria?: { criteriaName: string; actualValue: string | number }[];
  formulaIngredients?: { name: string; declaredContent?: any }[];
  recentBatchesHistory?: { batchNo: string; overallStatus: string; results?: any[] }[];
}): OOSInvestigationReport => {
  const reportId = `OOS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${data.batchNo || 'BATCH'}`;
  const firstFail = data.failedCriteria[0] || { criteriaName: 'Chỉ tiêu chất lượng', actualValue: 'N/A', specification: 'Theo TCCS' };

  return {
    reportId,
    generatedAt: new Date().toISOString(),
    productName: data.productName,
    batchNo: data.batchNo,
    mfgDate: data.mfgDate,
    expDate: data.expDate,
    failedCriteria: data.failedCriteria.map(f => ({
      ...f,
      deviationPercent: 'Lệch ngoài giới hạn TCCS/Công thức',
    })),
    executiveSummary: `Lô sản xuất ${data.batchNo} của sản phẩm "${data.productName}" không đạt chỉ tiêu ${data.failedCriteria.map(f => f.criteriaName).join(', ')}. Cần lập tức cách ly lô hàng và tiến hành quy trình điều tra OOS 2 giai đoạn theo chuẩn GMP WHO/FDA.`,
    phase1LabInvestigation: {
      summary: 'Rà soát toàn bộ quy trình phân tích tại phòng thí nghiệm, kiểm tra dung dịch chuẩn, độ tuyến tính đường chuẩn và tình trạng thiết bị đo.',
      equipmentCheck: 'Thiết bị đo (HPLC/UV-Vis/Cân phân tích) còn hiệu lực kiểm định/hiệu chuẩn. Kiểm tra nhật ký sử dụng thiết bị.',
      standardAndReagentCheck: 'Chất chuẩn đối chiếu còn hạn sử dụng, bảo quản đúng nhiệt độ quy định (2-8°C). Thuốc thử pha mới trong ngày.',
      samplePrepCheck: 'Kiểm tra thao tác cân, pha loãng dung dịch thử và độ đồng nhất mẫu thử ban đầu.',
      isLabError: false,
      labVerdict: 'Không phát hiện sai số thao tác phân tích rõ ràng. Kết quả kiểm nghiệm được bảo lưu để chuyển sang Điều tra Giai đoạn 2 (Sản xuất).',
    },
    phase2ManufacturingInvestigation: {
      summary: 'Rà soát hồ sơ lô (BMR), nguồn gốc nguyên liệu hoạt chất, thông số công đoạn pha chế, sấy, trộn và dập viên/đóng gói.',
      rawMaterialReview: 'Kiểm tra phiếu kiểm nghiệm (CoA) nguyên liệu đầu vào và điều kiện bảo quản kho trước khi cấp phát.',
      processParametersReview: 'Rà soát nhật ký nhiệt độ, độ ẩm phòng sạch và thời gian trộn đồng nhất trong hồ sơ lô.',
      environmentReview: 'Hệ thống HVAC duy trì nhiệt độ ≤ 25°C, độ ẩm RH ≤ 60% trong suốt quá trình sản xuất.',
      manufacturingVerdict: 'Nghi ngờ có sự dao động ở thông số công đoạn sấy/trộn hoặc độ hao hụt hoạt chất trong quá trình lưu nhiệt.',
    },
    ishikawaDiagram: [
      { category: 'Man', vietnameseLabel: 'Con người (Man)', causes: ['Thao tác cân chia hoạt chất chưa chuẩn xác', 'Chưa tuân thủ nghiêm ngặt thời gian trộn'] },
      { category: 'Machine', vietnameseLabel: 'Máy móc (Machine)', causes: ['Cánh khuấy/máy trộn hoạt động chưa đồng đều', 'Đầu dò nhiệt độ buồng sấy có độ trễ'] },
      { category: 'Material', vietnameseLabel: 'Nguyên liệu (Material)', causes: ['Hàm lượng hoạt chất nguyên liệu sát giới hạn dưới', 'Độ ẩm nguyên liệu ban đầu cao hơn định mức'] },
      { category: 'Method', vietnameseLabel: 'Phương pháp (Method)', causes: ['Tỷ lệ bù hao hụt (overage) chưa tối ưu cho quy mô lô lớn', 'Tốc độ nạp tá dược quá nhanh'] },
      { category: 'Measurement', vietnameseLabel: 'Đo lường (Measurement)', causes: ['Sai số chuẩn độ hoặc hiệu chuẩn cân phân tích', 'Mẫu lấy chưa mang tính đại diện cho toàn bộ lô'] },
      { category: 'Milieu', vietnameseLabel: 'Môi trường (Milieu)', causes: ['Độ ẩm phòng pha chế/dập viên tăng cục bộ trong ca sản xuất', 'Nhiệt độ bảo quản bán thành phẩm'] },
    ],
    fiveWhyAnalysis: [
      { level: 1, question: `Tại sao lô ${data.batchNo} không đạt chỉ tiêu ${firstFail.criteriaName}?`, answer: `Kết quả phân tích đo được ${firstFail.actualValue}, lệch so với giới hạn (${firstFail.specification}).` },
      { level: 2, question: 'Tại sao kết quả thực tế bị lệch ngoài giới hạn?', answer: 'Hàm lượng hoạt chất phân bố không đều trong khối cốm/bột bán thành phẩm.' },
      { level: 3, question: 'Tại sao hàm lượng phân bố không đồng đều?', answer: 'Thời gian trộn khô và trộn ướt chưa đạt trạng thái bão hòa tối ưu.' },
      { level: 4, question: 'Tại sao thời gian trộn không đạt tối ưu?', answer: 'Quy trình sản xuất (SOP) chưa chỉ định rõ dải thời gian trộn theo từng quy mô mẻ nạp.' },
      { level: 5, question: 'Tại sao SOP chưa cập nhật dải thời gian tối ưu?', answer: 'Báo cáo thẩm định quy trình sản xuất (Process Validation) chưa bao quát hết các kịch bản dung sai thiết bị.' },
    ],
    rootCauseStatement: `Nguyên nhân gốc rễ (Root Cause): Thời gian và tốc độ phối trộn chưa tối ưu đối với khối lượng mẻ sản xuất hiện tại, kết hợp với hàm lượng nguyên liệu đầu vào biến thiên, dẫn đến sự phân bố không đồng nhất của hoạt chất ${firstFail.criteriaName}.`,
    riskAssessment: {
      patientSafetyRisk: 'MEDIUM',
      scopeImpact: 'Cần kiểm tra chéo các lô liền kề (trước và sau lô này) sử dụng cùng lô nguyên liệu hoạt chất.',
      regulatoryNotificationRequired: false,
    },
    capaPlan: [
      {
        id: 'CAPA-01',
        type: 'CORRECTION',
        action: `Lập biên bản cách ly (Quarantine) toàn bộ lô ${data.batchNo}, gắn biển cảnh báo không được xuất xưởng.`,
        responsible: 'Trưởng phòng Đảm bảo chất lượng (QA)',
        deadline: 'Ngay lập tức (24h)',
        verificationMethod: 'Biên bản niêm phong kho & Khóa trạng thái lô trên phần mềm',
      },
      {
        id: 'CAPA-02',
        type: 'CORRECTIVE',
        action: 'Kiểm nghiệm lại mẫu lưu của lô nguyên liệu hoạt chất và đánh giá tính đồng nhất của các thùng bán thành phẩm.',
        responsible: 'Trưởng phòng Kiểm tra chất lượng (QC)',
        deadline: '03 ngày kể từ ngày lập biên bản',
        verificationMethod: 'Phiếu kết quả kiểm nghiệm Re-test',
      },
      {
        id: 'CAPA-03',
        type: 'PREVENTIVE',
        action: 'Hiệu chỉnh SOP quy trình trộn, bổ sung bước lấy mẫu kiểm tra độ đồng đều khối bột (Blend Uniformity) trước khi chuyển dập viên.',
        responsible: 'Phòng R&D / Quản đốc Phân xưởng sản xuất',
        deadline: '14 ngày',
        verificationMethod: 'Hồ sơ SOP ban hành mới & Biên bản đào tạo nhân viên',
      },
    ],
  };
};

/**
 * Gọi AI chuyên sâu để điều tra OOS
 */
export const generateAIOOSInvestigation = async (data: {
  productName: string;
  batchNo: string;
  mfgDate?: string;
  expDate?: string;
  failedCriteria: { criteriaName: string; actualValue: string | number; specification: string; unit?: string }[];
  passedCriteria?: { criteriaName: string; actualValue: string | number }[];
  formulaIngredients?: { name: string; declaredContent?: any }[];
  recentBatchesHistory?: { batchNo: string; overallStatus: string; results?: any[] }[];
}): Promise<OOSInvestigationReport> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return generateRuleBasedOOSReport(data);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = getGeminiModel();
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            executiveSummary: { type: SchemaType.STRING, description: 'Tóm tắt sự cố OOS chuyên nghiệp cho Giám đốc chất lượng' },
            phase1LabInvestigation: {
              type: SchemaType.OBJECT,
              properties: {
                summary: { type: SchemaType.STRING },
                equipmentCheck: { type: SchemaType.STRING },
                standardAndReagentCheck: { type: SchemaType.STRING },
                samplePrepCheck: { type: SchemaType.STRING },
                isLabError: { type: SchemaType.BOOLEAN },
                labVerdict: { type: SchemaType.STRING },
              },
              required: ['summary', 'equipmentCheck', 'standardAndReagentCheck', 'samplePrepCheck', 'isLabError', 'labVerdict'],
            },
            phase2ManufacturingInvestigation: {
              type: SchemaType.OBJECT,
              properties: {
                summary: { type: SchemaType.STRING },
                rawMaterialReview: { type: SchemaType.STRING },
                processParametersReview: { type: SchemaType.STRING },
                environmentReview: { type: SchemaType.STRING },
                manufacturingVerdict: { type: SchemaType.STRING },
              },
              required: ['summary', 'rawMaterialReview', 'processParametersReview', 'environmentReview', 'manufacturingVerdict'],
            },
            ishikawaDiagram: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  category: { type: SchemaType.STRING },
                  vietnameseLabel: { type: SchemaType.STRING },
                  causes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                },
                required: ['category', 'vietnameseLabel', 'causes'],
              },
            },
            fiveWhyAnalysis: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  level: { type: SchemaType.NUMBER },
                  question: { type: SchemaType.STRING },
                  answer: { type: SchemaType.STRING },
                },
                required: ['level', 'question', 'answer'],
              },
            },
            rootCauseStatement: { type: SchemaType.STRING },
            riskAssessment: {
              type: SchemaType.OBJECT,
              properties: {
                patientSafetyRisk: { type: SchemaType.STRING },
                scopeImpact: { type: SchemaType.STRING },
                regulatoryNotificationRequired: { type: SchemaType.BOOLEAN },
              },
              required: ['patientSafetyRisk', 'scopeImpact', 'regulatoryNotificationRequired'],
            },
            capaPlan: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  id: { type: SchemaType.STRING },
                  type: { type: SchemaType.STRING },
                  action: { type: SchemaType.STRING },
                  responsible: { type: SchemaType.STRING },
                  deadline: { type: SchemaType.STRING },
                  verificationMethod: { type: SchemaType.STRING },
                },
                required: ['id', 'type', 'action', 'responsible', 'deadline', 'verificationMethod'],
              },
            },
          },
          required: [
            'executiveSummary',
            'phase1LabInvestigation',
            'phase2ManufacturingInvestigation',
            'ishikawaDiagram',
            'fiveWhyAnalysis',
            'rootCauseStatement',
            'riskAssessment',
            'capaPlan',
          ],
        },
      },
    });

    const prompt = `
Bạn là Chuyên gia Đảm bảo chất lượng Dược phẩm (QA Expert) cấp cao theo chuẩn GMP WHO / PIC/S / US FDA 21 CFR Part 211.
Hãy phân tích và lập Hồ sơ điều tra kết quả ngoài tiêu chuẩn (Out-of-Specification - OOS Investigation Report) chi tiết cho sự cố chất lượng sau:

THÔNG TIN SẢN PHẨM & LÔ SẢN XUẤT:
- Tên sản phẩm: ${data.productName}
- Số lô: ${data.batchNo}
- Ngày sản xuất: ${data.mfgDate || 'N/A'} - Hạn dùng: ${data.expDate || 'N/A'}

CÁC CHỈ TIÊU KHÔNG ĐẠT (OOS FAIL CRITERIA):
${JSON.stringify(data.failedCriteria, null, 2)}

CÁC CHỈ TIÊU ĐẠT TRONG CÙNG LÔ:
${JSON.stringify(data.passedCriteria || [], null, 2)}

THÀNH PHẦN CÔNG THỨC SẢN PHẨM:
${JSON.stringify(data.formulaIngredients || [], null, 2)}

YÊU CẦU:
1. Lập điều tra 2 giai đoạn chuẩn xác: Giai đoạn 1 (Phòng thí nghiệm) và Giai đoạn 2 (Phân xưởng sản xuất).
2. Xây dựng sơ đồ xương cá Ishikawa theo đúng 6M: Man (Con người), Machine (Thiết bị), Material (Nguyên liệu), Method (Phương pháp), Measurement (Đo lường), Milieu (Môi trường).
3. Thực hiện chuỗi 5-Why logic từ biểu hiện ngoài giới hạn đến nguyên nhân cốt lõi trong hệ thống quản lý chất lượng/quy trình.
4. Đưa ra kế hoạch CAPA 3 cấp độ: Khắc phục tức thời (CORRECTION), Hành động khắc phục (CORRECTIVE) và Hành động phòng ngừa (PREVENTIVE).
5. Ngôn ngữ tiếng Việt chuyên ngành Dược phẩm chính xác, mạch lạc, đanh thép và tuân thủ nguyên tắc ALCOA+.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    return {
      reportId: `OOS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${data.batchNo || 'BATCH'}`,
      generatedAt: new Date().toISOString(),
      productName: data.productName,
      batchNo: data.batchNo,
      mfgDate: data.mfgDate,
      expDate: data.expDate,
      failedCriteria: data.failedCriteria,
      ...parsed,
    };
  } catch (error) {
    console.error('AI OOS Investigation generation failed, fallback to rule-based:', error);
    return generateRuleBasedOOSReport(data);
  }
};
