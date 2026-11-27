/**
 * PQM — TCCS Hardcopy Document OCR & AI Vision Extraction Service
 * ================================================================
 * Cho phép quét bản cứng Tiêu chuẩn cơ sở (TCCS) từ file PDF (scan nhiều trang hoặc PDF điện tử)
 * hoặc nhiều ảnh chụp (JPG/PNG/WEBP/HEIC) để tự động điền toàn bộ biểu mẫu Xây dựng TCCS:
 * 1. Thông tin chung: Mã TCCS, Sản phẩm áp dụng, Ngày ban hành, Quy cách đóng gói, Bảo quản, Hạn dùng, Tài liệu tham khảo.
 * 2. Chỉ tiêu Chất lượng chính: Cảm quan, Lý hóa, Định tính, Định lượng hoạt chất (Min, Max, Công bố, ĐVT, Phương pháp thử).
 * 3. Giới hạn Vi sinh vật, Kim loại nặng, Độc tố vi nấm & An toàn khác (bảo toàn số mũ 10³, 2×10³, Không phát hiện).
 * 4. Quy tắc thay thế / Điều kiện miễn kiểm (Alternate Rules).
 */

import { createGoogleGenerativeAI, SchemaType } from './geminiClientLoader';
import {
  getApiKey,
  getGeminiModel,
  getValidGeminiModel,
  FALLBACK_GEMINI_MODEL,
  getThinkingConfigForModel,
  formatGeminiError,
} from './aiConfig';
import { validateOCRFile } from './geminiService';
import { Criterion, CriterionType, AlternateRule, Product } from '../../types';
import { ensureArray, normalizeSearch, parseNumberFromText } from '../../utils';

export interface ExtractedTccsCriterionRaw {
  name: string;
  type?: 'NUMBER' | 'TEXT' | string;
  unit?: string;
  min?: string | number;
  max?: string | number;
  expectedText?: string;
  declaredContent?: string | number;
  notes?: string;
  category?: 'MAIN' | 'MICROBIO' | 'HEAVY_METAL' | 'MYCOTOXIN' | string;
}

export interface ExtractedTccsDocumentRaw {
  code?: string;
  productName?: string;
  productCode?: string;
  issueDate?: string;
  packaging?: string;
  storage?: string;
  shelfLife?: string;
  standardRefs?: string[];
  mainCriteria?: ExtractedTccsCriterionRaw[];
  microbiologicalCriteria?: ExtractedTccsCriterionRaw[];
  heavyMetalCriteria?: ExtractedTccsCriterionRaw[];
  mycotoxinCriteria?: ExtractedTccsCriterionRaw[];
  alternateRules?: Array<{
    main: string;
    alt: string;
    type?: 'FAIL_RETRY' | 'CONDITIONAL_CHECK' | string;
    conditionValue?: string;
  }>;
  pageCount?: number;
}

export interface NormalizedTccsExtractionResult {
  code: string;
  productName: string;
  productCode: string;
  matchedProduct?: Product;
  issueDate: string;
  packaging: string;
  storage: string;
  shelfLife: string;
  standardRefs: string[];
  mainCriteria: (Criterion & { notes?: string })[];
  microbiologicalCriteria: (Criterion & { notes?: string })[];
  heavyMetalCriteria: (Criterion & { notes?: string })[];
  mycotoxinCriteria: (Criterion & { notes?: string })[];
  alternateRules: AlternateRule[];
  pageCount: number;
  fileCount: number;
}

const TCCS_CRITERION_ITEM_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    name: {
      type: SchemaType.STRING,
      description:
        'Tên chỉ tiêu kỹ thuật chính xác như trên bản TCCS (VD: Cảm quan, Độ ẩm, Định lượng Vitamin C, Tổng số vi sinh vật hiếu khí, Chì (Pb)...)',
    },
    type: {
      type: SchemaType.STRING,
      description:
        'NUMBER nếu mức yêu cầu là con số / khoảng số / bất đẳng thức (≤, ≥, ~, -); TEXT nếu mức yêu cầu là mô tả chữ hoặc Không phát hiện / Không được có / Âm tính / Đạt yêu cầu',
    },
    unit: {
      type: SchemaType.STRING,
      description:
        'Đơn vị tính (VD: %, mg/viên, CFU/g, /1g, /25g, mg/kg, ppm, ppb, ml, phút). Để rỗng nếu không có.',
    },
    min: {
      type: SchemaType.STRING,
      description:
        'Giới hạn dưới (Min) nếu có (VD: "90", "4.5", "10⁸", "2×10⁸"). Nếu chỉ có "≥ X" hoặc "Không nhỏ hơn X" thì điền X vào min. Để rỗng nếu không có giới hạn dưới.',
    },
    max: {
      type: SchemaType.STRING,
      description:
        'Giới hạn trên (Max) nếu có (VD: "110", "5.0", "2×10³", "100", "3.0"). Nếu có "≤ Y" hoặc "Không lớn hơn Y" hoặc "Không quá Y" thì điền Y vào max. Để rỗng nếu không có giới hạn trên.',
    },
    expectedText: {
      type: SchemaType.STRING,
      description:
        'Mô tả mức chất lượng chấp nhận bằng chữ (cho chỉ tiêu TEXT như Cảm quan, Định tính, hoặc "Không được có", "Không phát hiện"). Với chỉ tiêu NUMBER đã tách được min/max thì để rỗng hoặc giữ nguyên chuỗi gốc nếu là dung sai phức tạp.',
    },
    declaredContent: {
      type: SchemaType.STRING,
      description:
        'Hàm lượng công bố trên nhãn của hoạt chất nếu có ghi trong TCCS (VD: "500", "100", "10⁸"). Để rỗng nếu không có.',
    },
    notes: {
      type: SchemaType.STRING,
      description:
        'Phương pháp thử hoặc ghi chú kỹ thuật của chỉ tiêu (VD: "DĐVN V", "HPLC", "TCVN 4884", "Thường quy"). Để rỗng nếu không có.',
    },
  },
  required: ['name', 'type', 'unit', 'min', 'max', 'expectedText'],
};

const TCCS_OCR_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    code: {
      type: SchemaType.STRING,
      description:
        'Số hiệu / Mã hiệu TCCS đọc từ bản cứng (VD: "TCCS 01:2024/V-BIOTECH"). Để rỗng nếu không thấy.',
    },
    productName: {
      type: SchemaType.STRING,
      description: 'Tên sản phẩm áp dụng bản TCCS này.',
    },
    productCode: {
      type: SchemaType.STRING,
      description: 'Mã sản phẩm / Mã hàng hóa nếu có ghi trên TCCS.',
    },
    issueDate: {
      type: SchemaType.STRING,
      description:
        'Ngày ban hành / Ngày ký duyệt TCCS, chuẩn hóa về định dạng YYYY-MM-DD (VD: "2024-08-15"). Để rỗng nếu không có.',
    },
    packaging: {
      type: SchemaType.STRING,
      description: 'Quy cách đóng gói và chất liệu bao bì (VD: "Hộp 3 vỉ x 10 viên nang cứng").',
    },
    storage: {
      type: SchemaType.STRING,
      description:
        'Điều kiện bảo quản (VD: "Nơi khô mát, tránh ánh sáng trực tiếp, nhiệt độ dưới 30°C").',
    },
    shelfLife: {
      type: SchemaType.STRING,
      description: 'Thời hạn sử dụng / Hạn dùng (VD: "36 tháng kể từ ngày sản xuất").',
    },
    standardRefs: {
      type: SchemaType.ARRAY,
      description:
        'Danh sách các tiêu chuẩn / quy chuẩn tham chiếu (VD: ["DĐVN V", "QCVN 8-2:2011/BYT", "QCVN 8-3:2012/BYT", "46/2007/QĐ-BYT"]).',
      items: { type: SchemaType.STRING },
    },
    mainCriteria: {
      type: SchemaType.ARRAY,
      description:
        'Danh sách Chỉ tiêu Chất lượng chính (Cảm quan, Lý hóa, Độ ẩm, Độ đồng đều khối lượng/thể tích, Độ rã, pH, Định tính, Định lượng các hoạt chất, Lợi khuẩn probiotic...).',
      items: TCCS_CRITERION_ITEM_SCHEMA,
    },
    microbiologicalCriteria: {
      type: SchemaType.ARRAY,
      description:
        'Danh sách Chỉ tiêu Giới hạn Vi sinh vật (Tổng số vi sinh vật hiếu khí, Tổng số bào tử nấm men nấm mốc, E. coli, Salmonella, S. aureus, P. aeruginosa, Coliforms, Cl. perfringens...).',
      items: TCCS_CRITERION_ITEM_SCHEMA,
    },
    heavyMetalCriteria: {
      type: SchemaType.ARRAY,
      description:
        'Danh sách Chỉ tiêu Giới hạn Kim loại nặng (Chì Pb, Cadmi Cd, Thủy ngân Hg, Arsen/Asen As tổng số, Arsen vô cơ...).',
      items: TCCS_CRITERION_ITEM_SCHEMA,
    },
    mycotoxinCriteria: {
      type: SchemaType.ARRAY,
      description:
        'Danh sách Chỉ tiêu Độc tố vi nấm & An toàn khác (Aflatoxin B1, Aflatoxin tổng số, Ochratoxin A, Dư lượng thuốc BVTV...).',
      items: TCCS_CRITERION_ITEM_SCHEMA,
    },
    alternateRules: {
      type: SchemaType.ARRAY,
      description:
        'Các quy tắc kiểm nghiệm thay thế / có điều kiện nếu có ghi chú trên TCCS (VD: Chỉ kiểm tra Arsen vô cơ khi Arsen tổng số vượt quá giới hạn -> main: "Arsen (As) tổng số", alt: "Arsen vô cơ", type: "FAIL_RETRY").',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          main: { type: SchemaType.STRING, description: 'Tên chỉ tiêu chính (TC1)' },
          alt: { type: SchemaType.STRING, description: 'Tên chỉ tiêu phụ thuộc / thay thế (TC2)' },
          type: {
            type: SchemaType.STRING,
            description: 'FAIL_RETRY (nếu TC1 vượt ngưỡng/rớt mới kiểm TC2) hoặc CONDITIONAL_CHECK',
          },
          conditionValue: {
            type: SchemaType.STRING,
            description: 'Ngưỡng điều kiện nếu type là CONDITIONAL_CHECK',
          },
        },
        required: ['main', 'alt', 'type'],
      },
    },
  },
  required: [
    'code',
    'productName',
    'issueDate',
    'packaging',
    'storage',
    'shelfLife',
    'mainCriteria',
    'microbiologicalCriteria',
    'heavyMetalCriteria',
    'mycotoxinCriteria',
  ],
};

const TCCS_OCR_SYSTEM_PROMPT = `Bạn là Chuyên gia AI Thẩm định Hồ sơ Tiêu chuẩn Cơ sở (TCCS) Dược phẩm & Thực phẩm Bảo vệ Sức khỏe của hệ thống V-BIOTECH PQM.
Nhiệm vụ: Đọc toàn bộ các trang của bản cứng Tiêu chuẩn Cơ sở (TCCS) và bóc tách ĐẦY ĐỦ 100% thông tin hành chính cùng tất cả các bảng chỉ tiêu kỹ thuật sang cấu trúc JSON chuẩn.

QUY TẮC BẤT BIẾN (TUÂN THỦ TUYỆT ĐỐI):
1. KHÔNG BỎ SÓT BẤT KỲ CHỈ TIÊU NÀO:
   - Quét kỹ tất cả các mục: Chỉ tiêu cảm quan, Chỉ tiêu lý học / hóa học, Định tính, Định lượng / Hàm lượng hoạt chất, Chỉ tiêu vi sinh vật, Chỉ tiêu kim loại nặng, Độc tố vi nấm.
   - Nếu mục "Chỉ tiêu cảm quan" trên văn bản TCCS tách thành các dòng nhỏ (Hình thức, Màu sắc, Mùi vị...) hoặc gộp chung 1 dòng "Cảm quan", hãy trích xuất đầy đủ.
2. TÁCH MIN / MAX & KIỂU SỐ (NUMBER) VS CHỮ (TEXT) CHUẨN XÁC:
   - Nếu mức yêu cầu là một khoảng số: VD "90,0 - 110,0%", "450 - 550 mg", "5.0 ~ 7.0" -> Đặt type = "NUMBER", min = "90.0", max = "110.0", unit = "%".
   - Nếu mức yêu cầu là dung sai quanh hàm lượng công bố: VD "500 mg ± 10%" hoặc "100 mg ± 7.5%" -> Tính luôn min = "450", max = "550", declaredContent = "500", unit = "mg/viên" (hoặc đơn vị tương ứng), type = "NUMBER".
   - Nếu mức yêu cầu là giới hạn trên: VD "≤ 5,0%", "Không quá 2000", "≤ 2 x 10³", "≤ 10⁴", "Không lớn hơn 3,0" -> Đặt type = "NUMBER", min = "", max = "5.0" (hoặc "2×10³", "10⁴", "3.0").
   - Nếu mức yêu cầu là giới hạn dưới: VD "≥ 10⁸ CFU/g", "Không thấp hơn 80%", "≥ 1,5 x 10⁹" -> Đặt type = "NUMBER", min = "10⁸" (hoặc "80", "1.5×10⁹"), max = "".
   - Nếu mức yêu cầu là chữ định tính: VD "Không phát hiện", "Không được có", "Âm tính", "Đạt yêu cầu", "Viên nang cứng, màu xanh..." -> Đặt type = "TEXT", expectedText = nguyên văn mức yêu cầu, min = "", max = "".
3. BẢO TOÀN SỐ MŨ LŨY THỪA & SỐ THẬP PHÂN:
   - Giữ nguyên ký hiệu lũy thừa Unicode chuẩn như "10²", "10³", "2×10³", "10⁴", "10⁵", "10⁶", "10⁸", "10⁹" (chuyển "10^3" hoặc "10 3" trong vi sinh/lợi khuẩn thành "10³").
   - Đổi dấu phẩy thập phân tiếng Việt ("0,5", "1,5", "5,0") thành dấu chấm ("0.5", "1.5", "5.0").
4. PHÂN NHÓM CHÍNH XÁC:
   - Lợi khuẩn có ích là thành phần hoạt chất của sản phẩm (VD: Bacillus clausii, Bacillus subtilis, Lactobacillus, Bifidobacterium, Saccharomyces boulardii) -> Đưa vào "mainCriteria" (Chỉ tiêu chất lượng chính).
   - Vi sinh vật tạp nhiễm / gây bệnh (Tổng số vi sinh vật hiếu khí, Tổng số bào tử nấm men nấm mốc, E. coli, Salmonella, S. aureus, P. aeruginosa, Coliforms, Cl. perfringens) -> Đưa vào "microbiologicalCriteria".
   - Kim loại nặng (Chì Pb, Cadmi Cd, Thủy ngân Hg, Arsen/Asen As tổng số, Arsen vô cơ) -> Đưa vào "heavyMetalCriteria".
   - Độc tố vi nấm (Aflatoxin B1, Aflatoxin tổng số, Ochratoxin A...) -> Đưa vào "mycotoxinCriteria".
5. NHẬN DIỆN QUY TẮC THAY THẾ (alternateRules):
   - Nếu trong TCCS có câu ghi chú dạng: "Chỉ kiểm tra Arsen vô cơ khi Arsen tổng số vượt quá giới hạn cho phép" -> Thêm vào alternateRules: { main: "Arsen (As) tổng số", alt: "Arsen vô cơ", type: "FAIL_RETRY" }.`;

const PROBIOTIC_ACTIVE_KEYWORDS = [
  'bacillus',
  'lactobacillus',
  'bifidobacterium',
  'saccharomyces',
  'streptococcus thermophilus',
  'enterococcus faecium',
  'lợi khuẩn',
  'probiotic',
];
const HEAVY_METAL_KEYWORDS = [
  'asen',
  'arsen',
  'chì',
  'thủy ngân',
  'cadmi',
  'pb',
  'cd',
  'hg',
  'kim loại nặng',
];
const MYCOTOXIN_KEYWORDS = [
  'aflatoxin',
  'ochratoxin',
  'patulin',
  'zearalenone',
  'độc tố vi nấm',
  'mycotoxin',
];
const MICROBIO_KEYWORDS = [
  'vi sinh vật hiếu khí',
  'hiếu khí',
  'nấm men',
  'nấm mốc',
  'e. coli',
  'e.coli',
  'escherichia',
  'salmonella',
  'staphylococcus',
  'pseudomonas',
  'coliform',
  'clostridium',
  'enterobacteriaceae',
  'tsvsvhk',
  'tamc',
  'tymc',
];

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
};

/**
 * Chuẩn hóa chuỗi số / lũy thừa từ OCR (VD: "2 x 10^3" -> "2×10³", "0,5" -> "0.5")
 */
export function normalizeOcrLimitNumber(
  raw: string | number | undefined | null
): string | number | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'number') return isNaN(raw) ? undefined : raw;

  let s = String(raw).trim();
  if (!s) return undefined;

  // Bỏ các tiền tố bất đẳng thức nếu AI lỡ đặt vào ô min/max
  s = s
    .replace(/^(<=|>=|≤|≥|<|>|không quá|không lớn hơn|không nhỏ hơn|không ít hơn|nmt|nlt)\s*/i, '')
    .trim();
  if (!s) return undefined;

  // Đổi dấu phẩy thập phân đơn lẻ sang dấu chấm ("0,5" -> "0.5")
  s = s.replace(/(\d+),(\d+)/g, '$1.$2');

  // Chuyển "10^3" hoặc "2 x 10^3" sang Unicode superscript "10³", "2×10³"
  s = s.replace(/(\d+(?:\.\d+)?)\s*[xX*×]\s*10\s*\^\s*([+-]?\d+)/g, (_, coef, exp) => {
    const sup = String(exp)
      .split('')
      .map((c) => SUPERSCRIPT_MAP[c] || c)
      .join('');
    return `${coef}×10${sup}`;
  });
  s = s.replace(/10\s*\^\s*([+-]?\d+)/g, (_, exp) => {
    const sup = String(exp)
      .split('')
      .map((c) => SUPERSCRIPT_MAP[c] || c)
      .join('');
    return `10${sup}`;
  });
  s = s.replace(/(\d+(?:\.\d+)?)\s*[xX*×]\s*10([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/g, '$1×10$2');

  // Nếu có ký hiệu lũy thừa thì giữ nguyên chuỗi hiển thị lũy thừa (VD: "2×10³", "10⁴")
  if (/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻^×]/.test(s)) {
    return s;
  }

  const num = Number(s);
  if (!isNaN(num) && s !== '') {
    return num;
  }
  const parsed = parseNumberFromText(s);
  return !isNaN(parsed) ? parsed : undefined;
}

/**
 * Chuẩn hóa chuỗi ngày tiếng Việt từ bản cứng TCCS về YYYY-MM-DD
 */
export function parseTccsOcrDate(raw?: string): string {
  if (!raw || !raw.trim()) return new Date().toISOString().split('T')[0];
  const s = raw.trim();

  // Đã ở dạng YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  // Dạng DD/MM/YYYY hoặc DD-MM-YYYY
  const dmyMatch = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  // Dạng "Ngày 15 tháng 08 năm 2024"
  const vnMatch = s.match(/ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/i);
  if (vnMatch) {
    return `${vnMatch[3]}-${vnMatch[2].padStart(2, '0')}-${vnMatch[1].padStart(2, '0')}`;
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Chuẩn hóa 1 dòng chỉ tiêu trích xuất từ OCR sang Criterion của TCCSFormPage
 */
function normalizeCriterionItem(
  raw: ExtractedTccsCriterionRaw
): (Criterion & { notes?: string }) | null {
  if (!raw || !raw.name || !String(raw.name).trim()) return null;
  const name = String(raw.name).trim();
  const unit = String(raw.unit || '').trim();
  const notes = String(raw.notes || '').trim();
  let min = normalizeOcrLimitNumber(raw.min);
  let max = normalizeOcrLimitNumber(raw.max);
  let expectedText = String(raw.expectedText || '').trim();
  let declaredContent = normalizeOcrLimitNumber(raw.declaredContent);

  // Nếu min và max đều trống nhưng expectedText chứa biểu thức số rõ ràng (VD: "≤ 2×10³", "90.0 - 110.0", "≥ 10⁸")
  if (min === undefined && max === undefined && expectedText) {
    const expNorm = expectedText.replace(/(\d+),(\d+)/g, '$1.$2').trim();

    // Kiểm tra khoảng "A - B" hoặc "A ~ B"
    const rangeMatch = expNorm.match(
      /^([+-]?\d+(?:\.\d+)?(?:\s*[x×*]\s*10[⁰¹²³⁴⁵⁶⁷⁸⁹⁻^+-]+)?)\s*(?:~|-|đến)\s*([+-]?\d+(?:\.\d+)?(?:\s*[x×*]\s*10[⁰¹²³⁴⁵⁶⁷⁸⁹⁻^+-]+)?)\s*%?$/i
    );
    if (rangeMatch) {
      min = normalizeOcrLimitNumber(rangeMatch[1]);
      max = normalizeOcrLimitNumber(rangeMatch[2]);
    } else if (/^(?:<=|≤|không quá|không lớn hơn|nmt)\s*(.+)$/i.test(expNorm)) {
      const m = expNorm.match(/^(?:<=|≤|không quá|không lớn hơn|nmt)\s*(.+)$/i);
      const cand = normalizeOcrLimitNumber(m?.[1]);
      if (cand !== undefined) max = cand;
    } else if (/^(?:>=|≥|không nhỏ hơn|không thấp hơn|ít nhất|nlt)\s*(.+)$/i.test(expNorm)) {
      const m = expNorm.match(/^(?:>=|≥|không nhỏ hơn|không thấp hơn|ít nhất|nlt)\s*(.+)$/i);
      const cand = normalizeOcrLimitNumber(m?.[1]);
      if (cand !== undefined) min = cand;
    }
  }

  const isNegativeText =
    /không phát hiện|không được có|không có|âm tính|negative|đạt yêu cầu|đúng với/i.test(
      expectedText
    );

  const hasNumericBounds = min !== undefined || max !== undefined;
  const resolvedType: CriterionType =
    !isNegativeText && (hasNumericBounds || String(raw.type || '').toUpperCase() === 'NUMBER')
      ? hasNumericBounds
        ? CriterionType.NUMBER
        : expectedText
          ? CriterionType.TEXT
          : CriterionType.NUMBER
      : CriterionType.TEXT;

  return {
    name,
    type: resolvedType,
    unit,
    min: (resolvedType === CriterionType.NUMBER ? min : undefined) as any,
    max: (resolvedType === CriterionType.NUMBER ? max : undefined) as any,
    expectedText: resolvedType === CriterionType.TEXT ? expectedText || 'Đạt yêu cầu' : undefined,
    declaredContent: (declaredContent !== undefined ? declaredContent : undefined) as any,
    notes,
  };
}

/**
 * Tìm sản phẩm khớp nhất trong danh mục Products từ tên/mã trích xuất trên bản cứng TCCS
 */
export function findMatchingProductFromTccsOcr(
  productName?: string,
  productCode?: string,
  products: Product[] = []
): Product | undefined {
  if (!products || products.length === 0) return undefined;
  const codeNorm = normalizeSearch(productCode || '');
  const nameNorm = normalizeSearch(productName || '');

  if (codeNorm) {
    const exactCode = products.find((p) => normalizeSearch(p.code) === codeNorm);
    if (exactCode) return exactCode;
  }

  if (nameNorm) {
    const exactName = products.find((p) => normalizeSearch(p.name) === nameNorm);
    if (exactName) return exactName;

    const containsMatch = products.find((p) => {
      const pName = normalizeSearch(p.name);
      return pName.length >= 4 && (nameNorm.includes(pName) || pName.includes(nameNorm));
    });
    if (containsMatch) return containsMatch;
  }

  return undefined;
}

/**
 * Chuẩn hóa toàn diện dữ liệu TCCS thô từ AI thành dữ liệu sẵn sàng nạp vào TCCSFormPage
 */
export function normalizeExtractedTccsData(
  raw: ExtractedTccsDocumentRaw,
  products: Product[] = [],
  fileCount: number = 1
): NormalizedTccsExtractionResult {
  const mainCriteria: (Criterion & { notes?: string })[] = [];
  const microbiologicalCriteria: (Criterion & { notes?: string })[] = [];
  const heavyMetalCriteria: (Criterion & { notes?: string })[] = [];
  const mycotoxinCriteria: (Criterion & { notes?: string })[] = [];

  const routeCriterion = (
    itemRaw: ExtractedTccsCriterionRaw,
    defaultBucket: 'MAIN' | 'MICROBIO' | 'HEAVY_METAL' | 'MYCOTOXIN'
  ) => {
    const item = normalizeCriterionItem(itemRaw);
    if (!item) return;

    const nl = item.name.toLowerCase();
    const isProbioticActive = PROBIOTIC_ACTIVE_KEYWORDS.some((kw) => nl.includes(kw));

    if (isProbioticActive) {
      mainCriteria.push(item);
      return;
    }

    if (defaultBucket === 'MAIN') {
      // Kiểm tra nếu AI đặt nhầm chỉ tiêu vi sinh / kim loại nặng / độc tố vi nấm vào bảng chính
      if (MYCOTOXIN_KEYWORDS.some((kw) => nl.includes(kw))) {
        mycotoxinCriteria.push(item);
      } else if (HEAVY_METAL_KEYWORDS.some((kw) => nl.includes(kw)) && !nl.includes('định tính')) {
        heavyMetalCriteria.push(item);
      } else if (MICROBIO_KEYWORDS.some((kw) => nl.includes(kw))) {
        microbiologicalCriteria.push(item);
      } else {
        mainCriteria.push(item);
      }
      return;
    }

    if (defaultBucket === 'MICROBIO') {
      microbiologicalCriteria.push(item);
    } else if (defaultBucket === 'HEAVY_METAL') {
      heavyMetalCriteria.push(item);
    } else {
      mycotoxinCriteria.push(item);
    }
  };

  ensureArray(raw?.mainCriteria).forEach((c) => routeCriterion(c, 'MAIN'));
  ensureArray(raw?.microbiologicalCriteria).forEach((c) => routeCriterion(c, 'MICROBIO'));
  ensureArray(raw?.heavyMetalCriteria).forEach((c) => routeCriterion(c, 'HEAVY_METAL'));
  ensureArray(raw?.mycotoxinCriteria).forEach((c) => routeCriterion(c, 'MYCOTOXIN'));

  // Tự động phát hiện quy tắc thay thế Arsen tổng số -> Arsen vô cơ nếu có cả 2 chỉ tiêu mà AI chưa sinh rule
  const alternateRules: AlternateRule[] = ensureArray(raw?.alternateRules)
    .filter((r) => r && r.main && r.alt)
    .map((r) => ({
      main: String(r.main).trim(),
      alt: String(r.alt).trim(),
      type: r.type === 'CONDITIONAL_CHECK' ? 'CONDITIONAL_CHECK' : 'FAIL_RETRY',
      conditionValue: r.conditionValue ? String(r.conditionValue).trim() : undefined,
    }));

  if (alternateRules.length === 0 && heavyMetalCriteria.length >= 2) {
    const arsenTotal = heavyMetalCriteria.find(
      (c) => /arsen|asen/i.test(c.name) && /tổng/i.test(c.name)
    );
    const arsenInorganic = heavyMetalCriteria.find(
      (c) => /arsen|asen/i.test(c.name) && /vô cơ/i.test(c.name)
    );
    if (arsenTotal && arsenInorganic) {
      alternateRules.push({
        main: arsenTotal.name,
        alt: arsenInorganic.name,
        type: 'FAIL_RETRY',
      });
    }
  }

  const matchedProduct = findMatchingProductFromTccsOcr(
    raw?.productName,
    raw?.productCode,
    products
  );

  return {
    code: String(raw?.code || '').trim(),
    productName: String(raw?.productName || '').trim(),
    productCode: String(raw?.productCode || '').trim(),
    matchedProduct,
    issueDate: parseTccsOcrDate(raw?.issueDate),
    packaging: String(raw?.packaging || '').trim(),
    storage: String(raw?.storage || '').trim(),
    shelfLife: String(raw?.shelfLife || '').trim(),
    standardRefs: ensureArray(raw?.standardRefs)
      .map((s) => String(s || '').trim())
      .filter(Boolean),
    mainCriteria,
    microbiologicalCriteria,
    heavyMetalCriteria,
    mycotoxinCriteria,
    alternateRules,
    pageCount: Number(raw?.pageCount) || 1,
    fileCount,
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      resolve(res.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Quét 1 hoặc nhiều file (PDF nhiều trang hoặc nhiều ảnh chụp bản cứng TCCS) và trích xuất toàn bộ cấu trúc TCCS
 */
export async function extractTccsFromFiles(
  files: File[],
  products: Product[] = [],
  onProgress?: (step: string, percent: number) => void
): Promise<NormalizedTccsExtractionResult> {
  if (!files || files.length === 0) {
    throw new Error('Vui lòng chọn ít nhất 1 file PDF hoặc ảnh chụp bản cứng TCCS.');
  }

  for (const file of files) {
    const check = validateOCRFile(file);
    if (!check.valid) {
      throw new Error(`${file.name}: ${check.error}`);
    }
  }

  const key = getApiKey();
  if (!key) {
    throw new Error(
      'Chưa cấu hình Gemini API Key. Vui lòng nhập API Key trong mục Cài đặt hệ thống.'
    );
  }

  onProgress?.('Đang khởi tạo AI Vision & chuẩn bị trang tài liệu TCCS...', 10);
  const genAI = await createGoogleGenerativeAI(key);

  const contentParts: any[] = [];
  let totalPageCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      onProgress?.(`Đang phân tích và kết xuất các trang PDF (${file.name})...`, 20);
      let renderedPagesDone = false;

      try {
        const [{ analyzePdf }, { convertPdfToImages }] = await Promise.all([
          import('../ocr/pdfAnalyzer'),
          import('../../utils/pdfProcessor'),
        ]);

        const analysis = await analyzePdf(file).catch(() => null);
        // Với TCCS bản cứng (thường có khung bảng nhiều trang), kết xuất ảnh High-DPI 200 DPI kết hợp Text Layer (nếu có) để đạt độ chính xác 100%
        const renderedPages = await convertPdfToImages(file, {
          targetDpi: 200,
          format: 'image/jpeg',
          quality: 0.9,
          maxPages: 25,
          onProgress: (curr, total) => {
            onProgress?.(
              `Đang xử lý trang PDF ${curr}/${total}...`,
              Math.round(20 + (curr / total) * 25)
            );
          },
        });

        if (renderedPages.length > 0) {
          totalPageCount += renderedPages.length;
          renderedPages.forEach((p) => {
            contentParts.push({
              inlineData: {
                data: p.base64,
                mimeType: p.mimeType || 'image/jpeg',
              },
            });
            const textPage = analysis?.pages.find((ap) => ap.pageNumber === p.pageNumber);
            const pageText = textPage?.fullText || textPage?.sampleText || '';
            if (pageText.trim().length > 20) {
              contentParts.push(
                `\n[VĂN BẢN TRÍCH XUẤT HỖ TRỢ TRANG ${p.pageNumber}]:\n${pageText}\n`
              );
            }
          });
          renderedPagesDone = true;
        }
      } catch (pdfRenderErr) {
        console.warn('[TCCS OCR] Fallback gửi trực tiếp file PDF gốc:', pdfRenderErr);
      }

      if (!renderedPagesDone) {
        const b64 = await fileToBase64(file);
        totalPageCount += 1;
        contentParts.push({
          inlineData: {
            data: b64,
            mimeType: 'application/pdf',
          },
        });
      }
    } else {
      onProgress?.(`Đang đọc ảnh trang ${i + 1}/${files.length} (${file.name})...`, 25);
      const b64 = await fileToBase64(file);
      totalPageCount += 1;
      contentParts.push({
        inlineData: {
          data: b64,
          mimeType: file.type || 'image/jpeg',
        },
      });
    }
  }

  contentParts.push(
    `\nHãy đọc toàn bộ ${totalPageCount} trang tài liệu Tiêu chuẩn Cơ sở (TCCS) ở trên và bóc tách đầy đủ thông tin chung cùng tất cả các chỉ tiêu chất lượng chính, vi sinh vật, kim loại nặng, độc tố vi nấm và quy tắc thay thế.`
  );

  onProgress?.('AI đang phân tích bảng chỉ tiêu kỹ thuật và giới hạn TCCS...', 55);

  const primaryModel = getValidGeminiModel(getGeminiModel());
  let currentModel = primaryModel;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const thinkingCfg = getThinkingConfigForModel(currentModel, false);
      const model = genAI.getGenerativeModel({
        model: currentModel,
        systemInstruction: TCCS_OCR_SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: TCCS_OCR_RESPONSE_SCHEMA as any,
          temperature: 0.1,
          ...(thinkingCfg || {}),
        },
      });

      const response = await model.generateContent(contentParts);
      onProgress?.('Đang chuẩn hóa chỉ tiêu và đối chiếu danh mục sản phẩm...', 90);
      const text = response.response.text();
      const parsed = JSON.parse(text) as ExtractedTccsDocumentRaw;
      parsed.pageCount = totalPageCount;

      const normalized = normalizeExtractedTccsData(parsed, products, files.length);
      onProgress?.('Hoàn tất bóc tách bản cứng TCCS!', 100);
      return normalized;
    } catch (err: any) {
      const msg = String(err?.message || '');
      const shouldFallback =
        msg.includes('404') ||
        msg.includes('not found') ||
        msg.includes('is not supported') ||
        msg.includes('429') ||
        msg.includes('503');

      if (shouldFallback && currentModel !== FALLBACK_GEMINI_MODEL && attempt < maxRetries) {
        currentModel = FALLBACK_GEMINI_MODEL;
        onProgress?.(`Đang chuyển sang model dự phòng (${FALLBACK_GEMINI_MODEL})...`, 60);
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      if (attempt === maxRetries) {
        throw new Error(formatGeminiError(err));
      }
    }
  }

  throw new Error('Không thể trích xuất dữ liệu từ bản cứng TCCS.');
}
