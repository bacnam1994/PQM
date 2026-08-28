/**
 * deviationReportService.ts
 * ==========================
 * AI Smart Deviation Report Generator — chuẩn GMP WHO/FDA.
 * 
 * Khi lô FAIL hoặc có chỉ tiêu vượt giới hạn, AI tự soạn thảo
 * toàn bộ Báo cáo Sai lệch (Deviation Report) gồm 6 phần:
 * 1. Mô tả sự cố
 * 2. Đánh giá tác động ngay lập tức
 * 3. Phân tích nguyên nhân gốc rễ (RCA) — Fishbone 6M + 5-Why
 * 4. Kế hoạch CAPA
 * 5. Đánh giá tái diễn
 * 6. Quyết định xử lý lô
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiKey, getGeminiModel } from './geminiService';

export type DeviationDecision = 'RELEASE_WITH_NOTE' | 'REPROCESS' | 'REJECT' | 'PENDING_INVESTIGATION';

export interface DeviationFishboneCategory {
  category: 'Man' | 'Machine' | 'Material' | 'Method' | 'Measurement' | 'Milieu';
  label: string;
  causes: string[];
}

export interface DeviationCAPAItem {
  id: string;
  type: 'IMMEDIATE' | 'CORRECTIVE' | 'PREVENTIVE';
  typeLabel: string;
  action: string;
  responsible: string;
  deadline: string;   // e.g. "7 ngày", "30 ngày", "Ngay lập tức"
  verification: string;
}

export interface DevFiveWhy {
  level: number;
  question: string;
  answer: string;
}

export interface DeviationReport {
  reportId: string;
  generatedAt: string;
  generatedBy: 'AI' | 'RULE_BASED';

  // ── Phần 1: Thông tin sự cố ──
  batchNo: string;
  productName: string;
  mfgDate?: string;
  expDate?: string;
  labName?: string;
  testDate?: string;
  deviationDate: string;
  failedCriteria: {
    name: string;
    actualValue: string | number;
    unit?: string;
    specification: string;
    deviationPercent?: string;
    severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  }[];

  // ── Phần 2: Đánh giá tác động ──
  immediateImpact: {
    patientSafetyRisk: 'NEGLIGIBLE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    marketImpactScope: string;
    quarantineRequired: boolean;
    quarantineReason?: string;
    notificationRequired: boolean;   // Báo cáo cơ quan quản lý
    notificationScope?: string;
  };

  // ── Phần 3: RCA ──
  executiveSummary: string;
  fishbone: DeviationFishboneCategory[];
  fiveWhy: DevFiveWhy[];
  rootCauseStatement: string;

  // ── Phần 4: CAPA ──
  capaItems: DeviationCAPAItem[];

  // ── Phần 5: Đánh giá tái diễn ──
  recurrenceRisk: {
    likelihood: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH';
    likelihoodReason: string;
    preventionMeasures: string[];
  };

  // ── Phần 6: Quyết định ──
  decision: DeviationDecision;
  decisionRationale: string;
  conditions?: string[];     // Điều kiện kèm theo (nếu RELEASE_WITH_NOTE)
  approvalRequired?: string; // Cấp duyệt cần thiết
}

export interface DeviationReportInput {
  productName: string;
  batchNo: string;
  mfgDate?: string;
  expDate?: string;
  labName?: string;
  testDate?: string;
  failedCriteria: {
    name: string;
    actualValue: string | number;
    unit?: string;
    specification: string;
  }[];
  passedCriteria?: { name: string; actualValue: string | number }[];
  formulaIngredients?: { name: string; declaredContent?: any }[];
  batchHistory?: { batchNo: string; status: string }[];
}

// ─────────────────────────────────────────────
// Rule-Based Fallback Generator
// ─────────────────────────────────────────────

export const generateRuleBasedDeviationReport = (input: DeviationReportInput): DeviationReport => {
  const reportId = `DEV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${input.batchNo}`;
  const now = new Date().toISOString();
  const firstFail = input.failedCriteria[0];

  const classifyDeviation = (criteria: typeof input.failedCriteria) => {
    return criteria.map(c => {
      const actual = parseFloat(String(c.actualValue).replace(',', '.'));
      const specParts = c.specification?.match(/[\d.]+/g) || [];
      let deviationPercent: string | undefined;
      let severity: 'MINOR' | 'MAJOR' | 'CRITICAL' = 'MAJOR';

      if (!isNaN(actual) && specParts.length > 0) {
        const specVal = parseFloat(specParts[0]);
        if (!isNaN(specVal) && specVal > 0) {
          const pct = Math.abs((actual - specVal) / specVal * 100);
          deviationPercent = `${pct.toFixed(1)}%`;
          severity = pct > 20 ? 'CRITICAL' : pct > 10 ? 'MAJOR' : 'MINOR';
        }
      }

      return { ...c, deviationPercent, severity };
    });
  };

  const hasCritical = input.failedCriteria.some(c => {
    const lowerName = (c.name || '').toLowerCase();
    return lowerName.includes('vi sinh') || lowerName.includes('vô khuẩn') || 
           lowerName.includes('chí nhiệt tố') || lowerName.includes('nội độc tố') ||
           lowerName.includes('arsenic') || lowerName.includes('mercury') || 
           lowerName.includes('lead') || lowerName.includes('chì') || lowerName.includes('thủy ngân');
  });

  const decision: DeviationDecision = hasCritical ? 'REJECT' : 
    input.failedCriteria.length > 2 ? 'REPROCESS' : 'PENDING_INVESTIGATION';

  return {
    reportId,
    generatedAt: now,
    generatedBy: 'RULE_BASED',
    batchNo: input.batchNo,
    productName: input.productName,
    mfgDate: input.mfgDate,
    expDate: input.expDate,
    labName: input.labName,
    testDate: input.testDate,
    deviationDate: now.slice(0, 10),
    failedCriteria: classifyDeviation(input.failedCriteria),

    immediateImpact: {
      patientSafetyRisk: hasCritical ? 'HIGH' : 'MEDIUM',
      marketImpactScope: `Lô ${input.batchNo} — ${input.productName}. Cần cách ly và đánh giá toàn bộ lô.`,
      quarantineRequired: true,
      quarantineReason: `Lô có ${input.failedCriteria.length} chỉ tiêu không đạt, cần kiểm tra lại trước khi quyết định xử lý.`,
      notificationRequired: hasCritical,
      notificationScope: hasCritical ? 'Báo cáo Sở Y tế / Cục Quản lý Dược theo quy định' : undefined,
    },

    executiveSummary: `Lô ${input.batchNo} của sản phẩm "${input.productName}" không đạt ${input.failedCriteria.length} chỉ tiêu kiểm nghiệm: ${input.failedCriteria.map(c => `${c.name} (thực tế: ${c.actualValue}${c.unit || ''}, yêu cầu: ${c.specification})`).join('; ')}. ${hasCritical ? 'Phát hiện vi phạm chỉ tiêu an toàn nghiêm trọng — yêu cầu hành động khẩn cấp.' : 'Sai lệch cần điều tra kỹ nguyên nhân và xem xét khả năng tái chế/xử lý.'}`,

    fishbone: [
      { category: 'Man', label: 'Con người', causes: ['Kỹ năng thao tác chưa đạt yêu cầu', 'Thiếu giám sát trong quá trình sản xuất', 'Không tuân thủ quy trình đã được phê duyệt'] },
      { category: 'Machine', label: 'Máy móc/Thiết bị', causes: ['Thiết bị chưa được hiệu chỉnh đúng hạn', 'Hư hỏng thiết bị không được phát hiện kịp thời', 'Thay đổi thiết bị không qua quy trình change control'] },
      { category: 'Material', label: 'Nguyên vật liệu', causes: [`Chất lượng nguyên liệu ${firstFail?.name || 'chính'} không đạt tiêu chuẩn nhập kho`, 'Nguyên liệu bảo quản không đúng điều kiện', 'Nguyên liệu hết hạn hoặc bị ô nhiễm'] },
      { category: 'Method', label: 'Phương pháp', causes: ['Quy trình sản xuất chưa tối ưu', 'Thông số quy trình sai lệch so với validation', 'Phương pháp kiểm tra chưa được validation đầy đủ'] },
      { category: 'Measurement', label: 'Đo lường', causes: ['Phương pháp phân tích không phù hợp', 'Thiết bị đo không được hiệu chỉnh', 'Sai số trong quá trình lấy mẫu'] },
      { category: 'Milieu', label: 'Môi trường', causes: ['Điều kiện nhiệt độ/độ ẩm bảo quản không phù hợp', 'Ô nhiễm chéo từ dây chuyền khác', 'Vệ sinh phòng sản xuất không đạt tiêu chuẩn'] },
    ],

    fiveWhy: [
      { level: 1, question: `Tại sao ${firstFail?.name || 'chỉ tiêu'} không đạt?`, answer: `Kết quả thực tế (${firstFail?.actualValue}${firstFail?.unit || ''}) vượt ra ngoài giới hạn quy định (${firstFail?.specification}).` },
      { level: 2, question: 'Tại sao có sự chênh lệch so với giới hạn?', answer: 'Cần điều tra thêm: có thể do sai số quy trình sản xuất hoặc chất lượng nguyên liệu đầu vào.' },
      { level: 3, question: 'Tại sao quy trình/nguyên liệu không được kiểm soát?', answer: 'Cần xem xét hồ sơ lô, biểu đồ kiểm soát và tài liệu nguyên liệu đầu vào.' },
      { level: 4, question: 'Tại sao hệ thống kiểm soát không phát hiện sớm?', answer: 'Cần đánh giá lại tần suất và phương pháp kiểm tra trong quá trình (IPC).'},
      { level: 5, question: 'Tại sao không có biện pháp phòng ngừa hiệu quả?', answer: 'Nguyên nhân gốc rễ cuối cùng cần được xác nhận qua điều tra đầy đủ.' },
    ],

    rootCauseStatement: `Nguyên nhân gốc rễ sơ bộ: sai lệch chỉ tiêu "${firstFail?.name}" có thể xuất phát từ vấn đề nguyên liệu đầu vào, thông số quy trình sản xuất hoặc phương pháp phân tích kiểm nghiệm. Cần điều tra đầy đủ theo Giai đoạn 1 (Phòng kiểm nghiệm) và Giai đoạn 2 (Sản xuất) theo quy trình OOS.`,

    capaItems: [
      { id: 'CAPA-001', type: 'IMMEDIATE', typeLabel: 'Khắc phục ngay', action: `Cách ly toàn bộ lô ${input.batchNo}. Không xuất xưởng cho đến khi có kết quả điều tra.`, responsible: 'QA Manager', deadline: 'Ngay lập tức', verification: 'Biên bản cách ly lô, cập nhật trạng thái trong hệ thống PQM' },
      { id: 'CAPA-002', type: 'IMMEDIATE', typeLabel: 'Khắc phục ngay', action: 'Kiểm tra lại mẫu lưu (retained sample) tại phòng kiểm nghiệm nội bộ để xác nhận kết quả.', responsible: 'QC Manager', deadline: '3 ngày', verification: 'Biên bản kiểm tra lại, kết quả phân tích mẫu lưu' },
      { id: 'CAPA-003', type: 'CORRECTIVE', typeLabel: 'Hành động khắc phục', action: `Xem xét lô nguyên liệu "${firstFail?.name || 'liên quan'}" đang tồn kho — giữ lại và kiểm tra lại nếu cùng số lô nhà cung cấp.`, responsible: 'Warehouse Manager', deadline: '7 ngày', verification: 'Kết quả kiểm tra nguyên liệu, biên bản đánh giá nhà cung cấp' },
      { id: 'CAPA-004', type: 'CORRECTIVE', typeLabel: 'Hành động khắc phục', action: 'Rà soát và cập nhật các điểm kiểm soát trong quy trình SOP liên quan. Tăng tần suất kiểm tra IPC nếu cần.', responsible: 'Production Manager', deadline: '14 ngày', verification: 'Phiên bản SOP mới được phê duyệt, hồ sơ training nhân viên' },
      { id: 'CAPA-005', type: 'PREVENTIVE', typeLabel: 'Hành động phòng ngừa', action: 'Thiết lập biểu đồ kiểm soát (Control Chart) cho chỉ tiêu này để phát hiện xu hướng trước khi vượt giới hạn.', responsible: 'QA Team', deadline: '30 ngày', verification: 'Biểu đồ SPC được thiết lập và vận hành trong hệ thống PQM' },
      { id: 'CAPA-006', type: 'PREVENTIVE', typeLabel: 'Hành động phòng ngừa', action: 'Rà soát kế hoạch tái thẩm định quy trình sản xuất, đảm bảo thực hiện đúng hạn theo lịch revalidation.', responsible: 'Validation Team', deadline: '60 ngày', verification: 'Kế hoạch tái thẩm định được phê duyệt và lên lịch thực hiện' },
    ],

    recurrenceRisk: {
      likelihood: input.batchHistory && input.batchHistory.filter(b => b.status === 'REJECTED').length > 1 ? 'HIGH' : 'MEDIUM',
      likelihoodReason: 'Dựa trên lịch sử lô và tính chất của sai lệch, nguy cơ tái diễn ở mức trung bình nếu không có hành động CAPA kịp thời.',
      preventionMeasures: [
        'Tăng cường giám sát trong quá trình sản xuất (IPC) cho chỉ tiêu liên quan',
        'Xem xét lại tiêu chí chấp nhận nguyên liệu đầu vào từ nhà cung cấp',
        'Thiết lập cảnh báo sớm (Early Warning) trong hệ thống PQM khi chỉ tiêu tiệm cận 90% giới hạn',
        'Đánh giá lại năng lực phân tích của phòng kiểm nghiệm nội bộ',
      ],
    },

    decision,
    decisionRationale: hasCritical
      ? `Lô bị TỪ CHỐI (REJECT) do vi phạm chỉ tiêu an toàn nghiêm trọng. Không được phép tái chế hoặc xuất xưởng dưới bất kỳ hình thức nào. Cần tiêu hủy theo quy định.`
      : input.failedCriteria.length > 2
        ? `Lô cần XEM XÉT TÁI CHẾ (REPROCESS) do có ${input.failedCriteria.length} chỉ tiêu không đạt. Đánh giá khả năng tái chế dựa trên SOP reprocess được phê duyệt.`
        : `Đang chờ điều tra thêm (PENDING). Cần hoàn thành điều tra OOS đầy đủ trước khi đưa ra quyết định cuối cùng.`,
    conditions: hasCritical ? undefined : ['Hoàn thành điều tra OOS Giai đoạn 1 và 2', 'Xác nhận nguyên nhân gốc rễ', 'Được QA Director phê duyệt'],
    approvalRequired: 'QA Director',
  };
};

// ─────────────────────────────────────────────
// AI-Powered Generator (Gemini)
// ─────────────────────────────────────────────

export const generateAIDeviationReport = async (
  input: DeviationReportInput,
  onProgress?: (step: string, percent: number) => void
): Promise<DeviationReport> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return generateRuleBasedDeviationReport(input);
  }

  try {
    onProgress?.('Phân tích sự cố và xây dựng cấu trúc báo cáo...', 10);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: getGeminiModel(),
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    });

    onProgress?.('AI đang phân tích nguyên nhân gốc rễ (RCA)...', 30);

    const prompt = `Bạn là chuyên gia GMP/QA dược phẩm cấp cao với 20 năm kinh nghiệm. Hãy viết Báo cáo Sai lệch (Deviation Report) chuẩn GMP-WHO/FDA cho trường hợp sau:

THÔNG TIN LÔ:
- Sản phẩm: ${input.productName}
- Số lô: ${input.batchNo}
- Ngày sản xuất: ${input.mfgDate || 'N/A'}
- Hạn dùng: ${input.expDate || 'N/A'}
- Đơn vị kiểm nghiệm: ${input.labName || 'N/A'}
- Ngày kiểm nghiệm: ${input.testDate || 'N/A'}

CHỈ TIÊU KHÔNG ĐẠT:
${input.failedCriteria.map(c => `- ${c.name}: Thực tế = ${c.actualValue}${c.unit || ''}, Yêu cầu = ${c.specification}`).join('\n')}

CHỈ TIÊU ĐẠT:
${(input.passedCriteria || []).map(c => `- ${c.name}: ${c.actualValue}`).join('\n') || 'Không có thông tin'}

CÔNG THỨC SẢN PHẨM:
${(input.formulaIngredients || []).map(i => `- ${i.name}: ${i.declaredContent}`).join('\n') || 'Không có thông tin'}

LỊCH SỬ LÔ GẦN ĐÂY (3 LÔ GẦN NHẤT):
${(input.batchHistory || []).slice(-3).map(b => `- Lô ${b.batchNo}: ${b.status}`).join('\n') || 'Không có thông tin'}

Hãy trả về JSON với cấu trúc sau (viết bằng tiếng Việt, chuyên nghiệp, cụ thể):
{
  "executiveSummary": "Tóm tắt điều hành 2-3 câu",
  "immediateImpact": {
    "patientSafetyRisk": "NEGLIGIBLE|LOW|MEDIUM|HIGH|CRITICAL",
    "marketImpactScope": "Mô tả phạm vi ảnh hưởng",
    "quarantineRequired": true/false,
    "quarantineReason": "Lý do",
    "notificationRequired": true/false,
    "notificationScope": "Phạm vi thông báo nếu cần"
  },
  "fishbone": [
    {"category": "Man", "label": "Con người", "causes": ["cause1", "cause2", "cause3"]},
    {"category": "Machine", "label": "Máy móc", "causes": ["cause1", "cause2"]},
    {"category": "Material", "label": "Nguyên vật liệu", "causes": ["cause1", "cause2"]},
    {"category": "Method", "label": "Phương pháp", "causes": ["cause1", "cause2"]},
    {"category": "Measurement", "label": "Đo lường", "causes": ["cause1", "cause2"]},
    {"category": "Milieu", "label": "Môi trường", "causes": ["cause1", "cause2"]}
  ],
  "fiveWhy": [
    {"level": 1, "question": "Câu hỏi tại sao 1", "answer": "Trả lời cụ thể"},
    {"level": 2, "question": "Câu hỏi tại sao 2", "answer": "Trả lời cụ thể"},
    {"level": 3, "question": "Câu hỏi tại sao 3", "answer": "Trả lời cụ thể"},
    {"level": 4, "question": "Câu hỏi tại sao 4", "answer": "Trả lời cụ thể"},
    {"level": 5, "question": "Câu hỏi tại sao 5 (nguyên nhân gốc rễ)", "answer": "Kết luận nguyên nhân gốc rễ"}
  ],
  "rootCauseStatement": "Phát biểu nguyên nhân gốc rễ rõ ràng 1-2 câu",
  "capaItems": [
    {"id": "CAPA-001", "type": "IMMEDIATE", "typeLabel": "Khắc phục ngay", "action": "Hành động cụ thể", "responsible": "Người/bộ phận chịu trách nhiệm", "deadline": "Thời hạn", "verification": "Cách xác nhận hoàn thành"},
    {"id": "CAPA-002", "type": "CORRECTIVE", "typeLabel": "Hành động khắc phục", "action": "...", "responsible": "...", "deadline": "...", "verification": "..."},
    {"id": "CAPA-003", "type": "PREVENTIVE", "typeLabel": "Hành động phòng ngừa", "action": "...", "responsible": "...", "deadline": "...", "verification": "..."}
  ],
  "recurrenceRisk": {
    "likelihood": "VERY_LOW|LOW|MEDIUM|HIGH",
    "likelihoodReason": "Giải thích",
    "preventionMeasures": ["Biện pháp 1", "Biện pháp 2", "Biện pháp 3"]
  },
  "decision": "RELEASE_WITH_NOTE|REPROCESS|REJECT|PENDING_INVESTIGATION",
  "decisionRationale": "Giải thích quyết định",
  "conditions": ["Điều kiện 1", "Điều kiện 2"],
  "approvalRequired": "Cấp duyệt cần thiết"
}`;

    onProgress?.('AI đang soạn thảo kế hoạch CAPA và quyết định xử lý...', 60);

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const aiData = JSON.parse(cleanJson);

    onProgress?.('Hoàn thiện báo cáo...', 90);

    const reportId = `DEV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${input.batchNo}`;
    const firstFail = input.failedCriteria[0];
    const hasCritical = (input.failedCriteria || []).some(c => {
      const n = (c.name || '').toLowerCase();
      return n.includes('vi sinh') || n.includes('nội độc tố') || n.includes('arsenic') || n.includes('chì');
    });

    return {
      reportId,
      generatedAt: new Date().toISOString(),
      generatedBy: 'AI',
      batchNo: input.batchNo,
      productName: input.productName,
      mfgDate: input.mfgDate,
      expDate: input.expDate,
      labName: input.labName,
      testDate: input.testDate,
      deviationDate: new Date().toISOString().slice(0, 10),
      failedCriteria: input.failedCriteria.map(c => {
        const actual = parseFloat(String(c.actualValue).replace(',', '.'));
        const specMatch = c.specification?.match(/[\d.]+/);
        const specVal = specMatch ? parseFloat(specMatch[0]) : NaN;
        const pct = (!isNaN(actual) && !isNaN(specVal) && specVal > 0)
          ? `${Math.abs((actual - specVal) / specVal * 100).toFixed(1)}%`
          : undefined;
        const lowerName = (c.name || '').toLowerCase();
        const isCrit = lowerName.includes('vi sinh') || lowerName.includes('nội độc tố');
        return { ...c, deviationPercent: pct, severity: isCrit ? 'CRITICAL' as const : 'MAJOR' as const };
      }),
      immediateImpact: aiData.immediateImpact || {
        patientSafetyRisk: hasCritical ? 'HIGH' : 'MEDIUM',
        marketImpactScope: `Lô ${input.batchNo}`,
        quarantineRequired: true,
        notificationRequired: hasCritical,
      },
      executiveSummary: aiData.executiveSummary || '',
      fishbone: aiData.fishbone || [],
      fiveWhy: aiData.fiveWhy || [],
      rootCauseStatement: aiData.rootCauseStatement || '',
      capaItems: (aiData.capaItems || []).map((item: any, idx: number) => ({
        ...item,
        id: item.id || `CAPA-${String(idx + 1).padStart(3, '0')}`,
      })),
      recurrenceRisk: aiData.recurrenceRisk || {
        likelihood: 'MEDIUM',
        likelihoodReason: 'Cần điều tra thêm',
        preventionMeasures: [],
      },
      decision: aiData.decision || 'PENDING_INVESTIGATION',
      decisionRationale: aiData.decisionRationale || '',
      conditions: aiData.conditions,
      approvalRequired: aiData.approvalRequired || 'QA Director',
    };

  } catch (error) {
    console.warn('[DeviationReport] AI failed, using rule-based fallback:', error);
    return generateRuleBasedDeviationReport(input);
  }
};
