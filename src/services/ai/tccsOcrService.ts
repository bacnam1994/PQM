/**
 * PQM — TCCS Hardcopy Document OCR & AI Vision Extraction Service
 * ================================================================
 * Cho phép quét bản cứng Tiêu chuẩn cơ sở (TCCS) từ file PDF (scan nhiều trang hoặc PDF điện tử)
 * hoặc nhiều ảnh chụp (JPG/PNG/WEBP/HEIC) để tự động điền toàn bộ biểu mẫu Xây dựng TCCS:
 * 1. Thông tin chung: Mã TCCS, Sản phẩm áp dụng (khớp thông minh với danh mục SP), Ngày ban hành, Quy cách đóng gói, Bảo quản, Hạn dùng, Tài liệu tham khảo.
 * 2. Thành phần cấu tạo / Công thức sản phẩm trên bản cứng TCCS (Hoạt chất & Phụ liệu) -> Tự động khớp nối với Công thức có sẵn hoặc tạo Công thức mới cho Sản phẩm.
 * 3. Chỉ tiêu Chất lượng chính: Cảm quan, Lý hóa, Định tính, Định lượng hoạt chất (Min, Max, Công bố, ĐVT, Phương pháp thử, tự động link `formulaIngredientId`).
 * 4. Giới hạn Vi sinh vật, Kim loại nặng, Độc tố vi nấm & An toàn khác (bảo toàn số mũ 10³, 2×10³, Không phát hiện).
 * 5. Quy tắc thay thế / Điều kiện miễn kiểm (Alternate Rules).
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
import {
  Criterion,
  CriterionType,
  AlternateRule,
  Product,
  ProductFormula,
  FormulaIngredient,
} from '../../types';
import { ensureArray, generateId, normalizeSearch, parseNumberFromText } from '../../utils';

export interface ExtractedTccsFormulaItemRaw {
  name: string;
  declaredContent?: string | number;
  elementalContent?: string | number;
  unit?: string;
}

export interface ExtractedTccsCriterionRaw {
  name: string;
  type?: 'NUMBER' | 'TEXT' | string;
  unit?: string;
  min?: string | number;
  max?: string | number;
  expectedText?: string;
  declaredContent?: string | number;
  formulaIngredientName?: string;
  notes?: string;
  category?: 'MAIN' | 'MICROBIO' | 'HEAVY_METAL' | 'MYCOTOXIN' | string;
}

export interface ExtractedTccsDocumentRaw {
  code?: string;
  productName?: string;
  productCode?: string;
  matchedProductId?: string;
  issueDate?: string;
  packaging?: string;
  storage?: string;
  shelfLife?: string;
  standardRefs?: string[];
  formulaIngredients?: ExtractedTccsFormulaItemRaw[];
  formulaExcipients?: ExtractedTccsFormulaItemRaw[];
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
  extractedFormulaIngredients: FormulaIngredient[];
  extractedFormulaExcipients: FormulaIngredient[];
  mainCriteria: (Criterion & { notes?: string })[];
  microbiologicalCriteria: (Criterion & { notes?: string })[];
  heavyMetalCriteria: (Criterion & { notes?: string })[];
  mycotoxinCriteria: (Criterion & { notes?: string })[];
  alternateRules: AlternateRule[];
  linkedFormulaCount: number;
  pageCount: number;
  fileCount: number;
}

const TCCS_FORMULA_ITEM_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    name: {
      type: SchemaType.STRING,
      description:
        'Tên hoạt chất hoặc phụ liệu trong mục Thành phần cấu tạo / Công thức của TCCS (VD: "Vitamin C", "Kẽm gluconat", "Bacillus clausii"). Không gộp lượng vào tên.',
    },
    declaredContent: {
      type: SchemaType.STRING,
      description: 'Hàm lượng công bố của thành phần (chỉ lấy phần số, VD: "500", "70", "2×10⁹").',
    },
    elementalContent: {
      type: SchemaType.STRING,
      description:
        'Hàm lượng nguyên tố / ion quy đổi nếu có ghi "(tương đương Kẽm 10mg)" -> điền "10". Để rỗng nếu không có.',
    },
    unit: {
      type: SchemaType.STRING,
      description: 'Đơn vị tính của thành phần (VD: "mg", "mcg", "IU", "CFU", "g", "ml").',
    },
  },
  required: ['name', 'declaredContent', 'unit'],
};

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
        'Mô tả mức chất lượng chấp nhận bằng chữ (cho chỉ tiêu TEXT như Cảm quan, Định tính, hoặc "Không được có", "Không phát hiện"). Với chỉ tiêu NUMBER đã tách được min/max thì để rỗng.',
    },
    declaredContent: {
      type: SchemaType.STRING,
      description:
        'Hàm lượng công bố trên nhãn của hoạt chất tương ứng với chỉ tiêu định lượng này (VD: "500", "100", "2×10⁹"). Để rỗng nếu không có.',
    },
    formulaIngredientName: {
      type: SchemaType.STRING,
      description:
        'Tên thành phần hoạt chất tương ứng trong Công thức / Thành phần cấu tạo nếu chỉ tiêu này là chỉ tiêu Định lượng / Hàm lượng hoạt chất (VD: chỉ tiêu "Hàm lượng Kẽm" -> formulaIngredientName: "Kẽm gluconat" hoặc "Kẽm"). Để rỗng nếu là chỉ tiêu lý hóa chung.',
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
      description:
        'Tên thương mại chính của sản phẩm trên TCCS (bỏ tiền tố "Thực phẩm bảo vệ sức khỏe:", "TPBVSK:", "Tiêu chuẩn cơ sở:" nếu có để lấy đúng tên sản phẩm).',
    },
    productCode: {
      type: SchemaType.STRING,
      description: 'Mã sản phẩm / Mã hàng hóa nếu có ghi trên TCCS hoặc khớp từ danh mục.',
    },
    matchedProductId: {
      type: SchemaType.STRING,
      description:
        'ID sản phẩm (id) khớp nhất trong DANH MỤC SẢN PHẨM HỆ THỐNG được cung cấp trong prompt. Để rỗng nếu không có sản phẩm nào trong danh mục khớp với tài liệu này.',
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
    formulaIngredients: {
      type: SchemaType.ARRAY,
      description:
        'Danh sách các HOẠT CHẤT CHÍNH trích xuất từ mục "Thành phần cấu tạo / Công thức" trong bản TCCS.',
      items: TCCS_FORMULA_ITEM_SCHEMA,
    },
    formulaExcipients: {
      type: SchemaType.ARRAY,
      description:
        'Danh sách các PHỤ LIỆU / TÁ DƯỢC trích xuất từ mục "Thành phần cấu tạo / Công thức" trong bản TCCS.',
      items: TCCS_FORMULA_ITEM_SCHEMA,
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
    'formulaIngredients',
    'mainCriteria',
    'microbiologicalCriteria',
    'heavyMetalCriteria',
    'mycotoxinCriteria',
  ],
};

const TCCS_OCR_SYSTEM_PROMPT = `Bạn là Chuyên gia AI Thẩm định Hồ sơ Tiêu chuẩn Cơ sở (TCCS) Dược phẩm & Thực phẩm Bảo vệ Sức khỏe của hệ thống V-BIOTECH PQM.
Nhiệm vụ: Đọc toàn bộ các trang của bản cứng Tiêu chuẩn Cơ sở (TCCS) và bóc tách ĐẦY ĐỦ 100% thông tin hành chính, công thức thành phần cấu tạo, cùng tất cả các bảng chỉ tiêu kỹ thuật sang cấu trúc JSON chuẩn.

QUY TẮC BẤT BIẾN (TUÂN THỦ TUYỆT ĐỐI):
1. ĐỐI CHIẾU TÊN SẢN PHẨM & CÔNG THỨC TRONG HỆ THỐNG:
   - Trên bìa hoặc tiêu đề TCCS thường ghi kèm tiền tố như "Thực phẩm bảo vệ sức khỏe: <Tên SP>", "TPBVSK <Tên SP>", "Thực phẩm bổ sung: <Tên SP>". Hãy tách bỏ tiền tố chung để lấy đúng tên sản phẩm thương mại vào "productName".
   - Đối chiếu với [DANH MỤC SẢN PHẨM HỆ THỐNG] được đính kèm trong prompt: nếu tìm thấy sản phẩm tương ứng (kể cả viết tắt, không dấu hoặc khác dấu gạch ngang), hãy điền chính xác "id" của sản phẩm đó vào "matchedProductId".
   - Đọc kỹ mục "Thành phần cấu tạo / Công thức" trong TCCS để trích xuất đầy đủ danh sách hoạt chất vào "formulaIngredients" (kèm hàm lượng công bố declaredContent, hàm lượng nguyên tố quy đổi elementalContent nếu có, và đơn vị tính).
   - Với mỗi chỉ tiêu Định lượng / Hàm lượng hoạt chất trong "mainCriteria", hãy điền luôn "declaredContent" và "formulaIngredientName" khớp với tên hoạt chất trong Công thức.
2. KHÔNG BỎ SÓT BẤT KỲ CHỈ TIÊU NÀO:
   - Quét kỹ tất cả các mục: Chỉ tiêu cảm quan, Chỉ tiêu lý học / hóa học, Định tính, Định lượng / Hàm lượng hoạt chất, Chỉ tiêu vi sinh vật, Chỉ tiêu kim loại nặng, Độc tố vi nấm.
3. TÁCH MIN / MAX & KIỂU SỐ (NUMBER) VS CHỮ (TEXT) CHUẨN XÁC:
   - Nếu mức yêu cầu là một khoảng số: VD "90,0 - 110,0%", "450 - 550 mg", "8,0 ~ 12,0 mg/viên" -> Đặt type = "NUMBER", min = "90.0", max = "110.0", unit = "%".
   - Nếu mức yêu cầu là dung sai quanh hàm lượng công bố: VD "500 mg ± 10%" hoặc "100 mg ± 7.5%" -> Tính luôn min = "450", max = "550", declaredContent = "500", type = "NUMBER".
   - Nếu mức yêu cầu là giới hạn trên: VD "≤ 5,0%", "Không quá 2000", "≤ 2 x 10³", "≤ 10⁴" -> Đặt type = "NUMBER", min = "", max = "5.0" (hoặc "2×10³", "10⁴").
   - Nếu mức yêu cầu là giới hạn dưới: VD "≥ 10⁸ CFU/g", "Không thấp hơn 80%", "≥ 1,5 x 10⁹" -> Đặt type = "NUMBER", min = "10⁸" (hoặc "80", "1.5×10⁹"), max = "".
   - Nếu mức yêu cầu là chữ định tính: VD "Không phát hiện", "Không được có", "Âm tính", "Đạt yêu cầu", "Viên nang cứng..." -> Đặt type = "TEXT", expectedText = nguyên văn mức yêu cầu, min = "", max = "".
4. BẢO TOÀN SỐ MŨ LŨY THỪA & SỐ THẬP PHÂN:
   - Giữ nguyên ký hiệu lũy thừa Unicode chuẩn như "10²", "10³", "2×10³", "10⁴", "10⁵", "10⁶", "10⁸", "10⁹".
   - Đổi dấu phẩy thập phân tiếng Việt ("0,5", "1,5", "5,0") thành dấu chấm ("0.5", "1.5", "5.0").
5. PHÂN NHÓM CHÍNH XÁC:
   - Lợi khuẩn có ích là thành phần hoạt chất của sản phẩm (VD: Bacillus clausii, Bacillus subtilis, Lactobacillus, Bifidobacterium, Saccharomyces boulardii) -> Đưa vào "mainCriteria" (Chỉ tiêu chất lượng chính).
   - Vi sinh vật tạp nhiễm / gây bệnh (Tổng số vi sinh vật hiếu khí, Tổng số bào tử nấm men nấm mốc, E. coli, Salmonella, S. aureus, P. aeruginosa, Coliforms, Cl. perfringens) -> Đưa vào "microbiologicalCriteria".
   - Kim loại nặng (Chì Pb, Cadmi Cd, Thủy ngân Hg, Arsen/Asen As tổng số, Arsen vô cơ) -> Đưa vào "heavyMetalCriteria".
   - Độc tố vi nấm (Aflatoxin B1, Aflatoxin tổng số, Ochratoxin A...) -> Đưa vào "mycotoxinCriteria".`;

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
 * Làm sạch tên sản phẩm khỏi các tiền tố pháp lý chung ("Thực phẩm bảo vệ sức khỏe:", "TPBVSK", "Tiêu chuẩn cơ sở"...)
 * để đối chiếu chính xác với Danh mục Sản phẩm
 */
export function cleanProductNameForMatch(rawName?: string): string {
  if (!rawName) return '';
  let s = normalizeSearch(rawName);
  s = s
    .replace(
      /\b(thuc pham bao ve suc khoe|tpbvsk|thuc pham bo sung|thuc pham chuc nang|tpcn|tieu chuan co so|tccs|san pham|ten san pham)\b/g,
      ' '
    )
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

/**
 * Làm sạch tên hoạt chất / chỉ tiêu định lượng để khớp nối giữa Chỉ tiêu TCCS <-> Thành phần Công thức
 * VD: "Định lượng Vitamin C (Acid ascorbic)" -> "vitamin c acid ascorbic"
 *     "Hàm lượng Kẽm (dưới dạng Kẽm gluconat)" -> "kem kem gluconat"
 */
export function cleanIngredientKeyForMatch(rawName?: string): string {
  if (!rawName) return '';
  let s = normalizeSearch(rawName);
  // Đồng nghĩa hóa học / dược học phổ biến
  s = s
    .replace(/\bcanxi\b/g, 'calci')
    .replace(/\bcalcium\b/g, 'calci')
    .replace(/\bzinc\b/g, 'kem')
    .replace(/\basen\b/g, 'arsen')
    .replace(/\bthiamin\w*\b/g, 'vitamin b1')
    .replace(/\briboflavin\w*\b/g, 'vitamin b2')
    .replace(/\bpyridoxin\w*\b/g, 'vitamin b6')
    .replace(/\bcyanocobalamin\w*\b/g, 'vitamin b12')
    .replace(/\bcholecalciferol\b/g, 'vitamin d3')
    .replace(/\bascorbic acid\b/g, 'vitamin c')
    .replace(/\bacid ascorbic\b/g, 'vitamin c');

  s = s
    .replace(
      /\b(dinh luong|ham luong|dinh tinh va dinh luong|dinh tinh|hoat chat|thanh phan|tuong duong|duoi dang|nguyen to|tong so)\b/g,
      ' '
    )
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

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

  s = s
    .replace(/^(<=|>=|≤|≥|<|>|không quá|không lớn hơn|không nhỏ hơn|không ít hơn|nmt|nlt)\s*/i, '')
    .trim();
  if (!s) return undefined;

  s = s.replace(/(\d+),(\d+)/g, '$1.$2');

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

  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  const dmyMatch = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  const vnMatch = s.match(/ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/i);
  if (vnMatch) {
    return `${vnMatch[3]}-${vnMatch[2].padStart(2, '0')}-${vnMatch[1].padStart(2, '0')}`;
  }

  return new Date().toISOString().split('T')[0];
}

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
  const formulaIngredientId = raw.formulaIngredientName
    ? String(raw.formulaIngredientName).trim()
    : undefined;

  if (min === undefined && max === undefined && expectedText) {
    const expNorm = expectedText.replace(/(\d+),(\d+)/g, '$1.$2').trim();

    // Kiểm tra dung sai "500 mg ± 10%" hoặc "100 ± 7.5%"
    const pmSymbol = expNorm.includes('±') ? '±' : expNorm.includes('+/-') ? '+/-' : null;
    if (pmSymbol) {
      const parts = expNorm.split(pmSymbol);
      const baseNum = parseNumberFromText(parts[0]);
      const tolNum = parseNumberFromText(parts[1] || '');
      if (!isNaN(baseNum) && !isNaN(tolNum) && baseNum > 0) {
        const delta = (parts[1] || '').includes('%') ? (baseNum * tolNum) / 100 : tolNum;
        min = Math.round((baseNum - delta) * 1000) / 1000;
        max = Math.round((baseNum + delta) * 1000) / 1000;
        if (declaredContent === undefined) declaredContent = baseNum;
      }
    }

    if (min === undefined && max === undefined) {
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
    formulaIngredientId: formulaIngredientId || undefined,
    notes,
  };
}

/**
 * Tìm sản phẩm khớp nhất trong danh mục Products từ:
 * 1. matchedProductId do AI chọn trực tiếp từ danh mục
 * 2. Mã sản phẩm (productCode) hoặc Mã TCCS (code có chứa mã SP)
 * 3. Tên sản phẩm đã làm sạch tiền tố pháp lý ("Thực phẩm bảo vệ sức khỏe...", dấu gạch ngang, v.v.)
 * 4. Độ phủ từ khóa (Token Overlap Score) giữa tên SP trên TCCS và tên SP trong hệ thống
 */
export function findMatchingProductFromTccsOcr(
  productName?: string,
  productCode?: string,
  products: Product[] = [],
  matchedProductId?: string,
  tccsCode?: string
): Product | undefined {
  if (!products || products.length === 0) return undefined;

  // 1. Ưu tiên ID khớp trực tiếp từ AI
  if (matchedProductId && matchedProductId.trim()) {
    const byId = products.find((p) => p.id === matchedProductId.trim());
    if (byId) return byId;
  }

  // 2. Khớp theo Mã sản phẩm (productCode)
  const codeClean = normalizeSearch(productCode || '').replace(/[^a-z0-9]/g, '');
  if (codeClean && codeClean.length >= 2) {
    const exactCode = products.find(
      (p) => normalizeSearch(p.code).replace(/[^a-z0-9]/g, '') === codeClean
    );
    if (exactCode) return exactCode;
  }

  // 3. Khớp theo Tên sản phẩm đã khử tiền tố pháp lý ("Thực phẩm bảo vệ sức khỏe", dấu câu...)
  const targetClean = cleanProductNameForMatch(productName);
  if (targetClean) {
    for (const p of products) {
      const pClean = cleanProductNameForMatch(p.name);
      if (!pClean) continue;
      if (pClean === targetClean) return p;
      // Khớp không khoảng trắng (VD: "bio-plus" vs "bioplus" vs "bio plus")
      if (pClean.replace(/\s+/g, '') === targetClean.replace(/\s+/g, '')) return p;
    }

    // Substring hai chiều sau khi làm sạch tiền tố
    for (const p of products) {
      const pClean = cleanProductNameForMatch(p.name);
      if (pClean.length >= 3 && (targetClean.includes(pClean) || pClean.includes(targetClean))) {
        return p;
      }
    }

    // 4. Chấm điểm Token Overlap (F1 token similarity)
    const targetTokens = targetClean.split(' ').filter((t) => t.length >= 2);
    if (targetTokens.length > 0) {
      let bestProduct: Product | undefined;
      let bestScore = 0;

      for (const p of products) {
        const pClean = cleanProductNameForMatch(p.name);
        const pTokens = pClean.split(' ').filter((t) => t.length >= 2);
        if (pTokens.length === 0) continue;

        const matchedCount = pTokens.filter(
          (pt) =>
            targetTokens.includes(pt) ||
            targetTokens.some((tt) => tt.includes(pt) || pt.includes(tt))
        ).length;

        const recallOnProduct = matchedCount / pTokens.length;
        const precisionOnTarget = matchedCount / targetTokens.length;
        const score = recallOnProduct * 0.7 + precisionOnTarget * 0.3;

        if (score > bestScore && (recallOnProduct >= 0.6 || matchedCount >= 2)) {
          bestScore = score;
          bestProduct = p;
        }
      }

      if (bestProduct && bestScore >= 0.5) {
        return bestProduct;
      }
    }
  }

  // 5. Kiểm tra nếu Mã TCCS hoặc Tên SP trên TCCS có chứa Mã sản phẩm (p.code)
  const combinedSource = normalizeSearch(`${productName || ''} ${tccsCode || ''}`);
  if (combinedSource) {
    const byEmbeddedCode = products.find((p) => {
      const pCode = normalizeSearch(p.code);
      return pCode.length >= 3 && combinedSource.includes(pCode);
    });
    if (byEmbeddedCode) return byEmbeddedCode;
  }

  return undefined;
}

/**
 * Tự động liên kết danh sách Chỉ tiêu Chất lượng chính (mainCriteria) với Công thức sản phẩm (ProductFormula / FormulaIngredient[])
 * - Khớp theo tên hoạt chất (bỏ tiền tố "Định lượng", "Hàm lượng", xử lý từ đồng nghĩa Kẽm/Zinc, Calci/Canxi, Vitamin...)
 * - Tự động điền `formulaIngredientId = ing.name`
 * - Tự động điền `declaredContent` từ Công thức nếu chỉ tiêu chưa có `declaredContent`
 * - Tự động chọn `calculationBasis = 'ELEMENTAL'` nếu thành phần công thức có `elementalContent`, ngược lại `'DECLARED'`
 * - Tự động gán `masterCriterionId` nếu khớp với danh mục chỉ tiêu đã có
 */
export function linkCriteriaWithFormulaAndCatalog(
  mainCriteria: (Criterion & { notes?: string })[],
  formulaIngredients: FormulaIngredient[] = [],
  existingCatalog: Array<{
    canonicalName: string;
    masterCriterionId?: string;
    defaultUnit?: string;
  }> = []
): { linkedCriteria: (Criterion & { notes?: string })[]; linkedCount: number } {
  const safeIngredients = ensureArray(formulaIngredients).filter((ing) => ing && ing.name);
  let linkedCount = 0;

  const linkedCriteria = ensureArray(mainCriteria).map((crit) => {
    if (!crit || !crit.name) return crit;
    const updated = { ...crit };
    const critKey = cleanIngredientKeyForMatch(updated.name);
    const critNorm = normalizeSearch(updated.name);

    // 1. Liên kết với Master Criterion nếu có trong catalog
    if (!updated.masterCriterionId && existingCatalog.length > 0) {
      const matchedCatalog = existingCatalog.find(
        (cat) => normalizeSearch(cat.canonicalName) === critNorm
      );
      if (matchedCatalog?.masterCriterionId) {
        updated.masterCriterionId = matchedCatalog.masterCriterionId;
      }
      if (!updated.unit && matchedCatalog?.defaultUnit) {
        updated.unit = matchedCatalog.defaultUnit;
      }
    }

    // 2. Liên kết với Thành phần Công thức (FormulaIngredient)
    if (safeIngredients.length > 0 && critKey.length >= 2) {
      // Nếu đã có formulaIngredientId, kiểm tra xem có khớp chính xác tên thành phần trong formula không
      let matchedIng: FormulaIngredient | undefined;

      if (updated.formulaIngredientId) {
        const hintKey = cleanIngredientKeyForMatch(updated.formulaIngredientId);
        matchedIng = safeIngredients.find((ing) => {
          const ingKey = cleanIngredientKeyForMatch(ing.name);
          return (
            ing.name.toLowerCase() === updated.formulaIngredientId!.toLowerCase() ||
            (ingKey && hintKey && (ingKey.includes(hintKey) || hintKey.includes(ingKey)))
          );
        });
      }

      if (!matchedIng) {
        // Tìm thành phần khớp theo từ khóa hoạt chất
        let bestIngScore = 0;
        for (const ing of safeIngredients) {
          const ingKey = cleanIngredientKeyForMatch(ing.name);
          if (!ingKey) continue;

          if (ingKey === critKey) {
            matchedIng = ing;
            break;
          }

          if (critKey.includes(ingKey) || ingKey.includes(critKey)) {
            const score =
              Math.min(ingKey.length, critKey.length) / Math.max(ingKey.length, critKey.length);
            if (score > bestIngScore) {
              bestIngScore = score;
              matchedIng = ing;
            }
            continue;
          }

          // Khớp token đầu tiên (VD: chỉ tiêu "Hàm lượng Kẽm" vs thành phần "Kẽm gluconat" -> cùng token chính "kem")
          const critTokens = critKey.split(' ').filter((t) => t.length >= 2);
          const ingTokens = ingKey.split(' ').filter((t) => t.length >= 2);
          if (critTokens.length > 0 && ingTokens.length > 0) {
            const sharedTokens = critTokens.filter((ct) => ingTokens.includes(ct));
            // Nếu chỉ tiêu có dạng "Vitamin B1", đòi hỏi khớp cả "vitamin" và "b1"
            const isVitamin = critTokens[0] === 'vitamin' || ingTokens[0] === 'vitamin';
            const isMatch = isVitamin
              ? sharedTokens.length >= 2
              : sharedTokens.length >= 1 &&
                (critTokens[0] === ingTokens[0] || sharedTokens[0].length >= 3);

            if (isMatch) {
              const score = sharedTokens.length / Math.max(critTokens.length, ingTokens.length);
              if (score > bestIngScore) {
                bestIngScore = score;
                matchedIng = ing;
              }
            }
          }
        }
      }

      if (matchedIng) {
        updated.formulaIngredientId = matchedIng.name;
        const hasElemental =
          matchedIng.elementalContent !== undefined &&
          matchedIng.elementalContent !== null &&
          String(matchedIng.elementalContent).trim() !== '' &&
          Number(matchedIng.elementalContent) > 0;

        if (!updated.calculationBasis) {
          updated.calculationBasis = hasElemental ? 'ELEMENTAL' : 'DECLARED';
        }

        if (
          updated.declaredContent === undefined ||
          String(updated.declaredContent).trim() === ''
        ) {
          const basisVal = hasElemental ? matchedIng.elementalContent : matchedIng.declaredContent;
          if (basisVal !== undefined && basisVal !== null && String(basisVal).trim() !== '') {
            updated.declaredContent = basisVal as any;
          }
        }

        if (!updated.unit && matchedIng.unit) {
          updated.unit = matchedIng.unit;
        }

        linkedCount += 1;
      }
    }

    return updated;
  });

  return { linkedCriteria, linkedCount };
}

/**
 * Chuẩn hóa toàn diện dữ liệu TCCS thô từ AI thành dữ liệu sẵn sàng nạp vào TCCSFormPage
 */
export function normalizeExtractedTccsData(
  raw: ExtractedTccsDocumentRaw,
  products: Product[] = [],
  fileCount: number = 1,
  productFormulas: ProductFormula[] = [],
  currentProductId?: string
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

  // Chuẩn hóa danh sách Thành phần công thức trích xuất trực tiếp từ bản cứng TCCS
  const normalizeFormulaList = (
    list?: ExtractedTccsFormulaItemRaw[],
    prefix = 'ing'
  ): FormulaIngredient[] => {
    return ensureArray(list)
      .filter((it) => it && it.name && String(it.name).trim() !== '')
      .map((it) => {
        const dc = normalizeOcrLimitNumber(it.declaredContent);
        const ec = normalizeOcrLimitNumber(it.elementalContent);
        return {
          id: generateId(prefix),
          name: String(it.name).trim(),
          declaredContent:
            typeof dc === 'number' ? dc : parseNumberFromText(String(dc || '0')) || 0,
          elementalContent:
            ec !== undefined
              ? typeof ec === 'number'
                ? ec
                : parseNumberFromText(String(ec)) || undefined
              : undefined,
          unit: String(it.unit || 'mg').trim(),
        };
      });
  };

  const extractedFormulaIngredients = normalizeFormulaList(raw?.formulaIngredients, 'ing');
  const extractedFormulaExcipients = normalizeFormulaList(raw?.formulaExcipients, 'exc');

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

  // Khớp Sản phẩm: Ưu tiên match từ OCR, nếu không thấy mà người dùng đã chọn sẵn sản phẩm trên Form thì giữ sản phẩm đã chọn
  let matchedProduct = findMatchingProductFromTccsOcr(
    raw?.productName,
    raw?.productCode,
    products,
    raw?.matchedProductId,
    raw?.code
  );
  if (!matchedProduct && currentProductId) {
    matchedProduct = products.find((p) => p.id === currentProductId);
  }

  // Tìm Công thức của Sản phẩm trong hệ thống; nếu chưa có thì dùng chính Công thức bóc tách từ bản cứng TCCS
  const existingFormula = matchedProduct
    ? ensureArray(productFormulas).find((f) => f && f.productId === matchedProduct!.id)
    : undefined;

  const activeFormulaIngredients =
    existingFormula && ensureArray(existingFormula.ingredients).length > 0
      ? [...ensureArray(existingFormula.ingredients), ...ensureArray(existingFormula.excipients)]
      : [...extractedFormulaIngredients, ...extractedFormulaExcipients];

  // Tự động liên kết Chỉ tiêu Chất lượng chính với Thành phần Công thức
  const { linkedCriteria, linkedCount } = linkCriteriaWithFormulaAndCatalog(
    mainCriteria,
    activeFormulaIngredients
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
    extractedFormulaIngredients,
    extractedFormulaExcipients,
    mainCriteria: linkedCriteria,
    microbiologicalCriteria,
    heavyMetalCriteria,
    mycotoxinCriteria,
    alternateRules,
    linkedFormulaCount: linkedCount,
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
  onProgress?: (step: string, percent: number) => void,
  options?: {
    productFormulas?: ProductFormula[];
    currentProductId?: string;
  }
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

  // Đính kèm Danh mục Sản phẩm & Công thức hiện có để AI tự động đối chiếu chính xác ID sản phẩm & Tên hoạt chất
  const productCatalogSummary = ensureArray(products)
    .slice(0, 150)
    .map((p) => `- id: "${p.id}" | code: "${p.code}" | name: "${p.name}"`)
    .join('\n');

  contentParts.push(
    `\n[DANH MỤC SẢN PHẨM HỆ THỐNG ĐỂ ĐỐI CHIẾU matchedProductId]:\n${productCatalogSummary || '(Chưa có sản phẩm)'}\n\nHãy đọc toàn bộ ${totalPageCount} trang tài liệu Tiêu chuẩn Cơ sở (TCCS) ở trên và bóc tách đầy đủ: Thông tin chung, matchedProductId (nếu khớp với sản phẩm trong danh mục), Thành phần cấu tạo / Công thức (formulaIngredients, formulaExcipients), cùng tất cả các chỉ tiêu chất lượng chính, vi sinh vật, kim loại nặng, độc tố vi nấm và quy tắc thay thế.`
  );

  onProgress?.('AI đang phân tích bảng chỉ tiêu kỹ thuật, sản phẩm và công thức TCCS...', 55);

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
      onProgress?.(
        'Đang đối chiếu sản phẩm, liên kết thành phần công thức & chuẩn hóa chỉ tiêu...',
        90
      );
      const text = response.response.text();
      const parsed = JSON.parse(text) as ExtractedTccsDocumentRaw;
      parsed.pageCount = totalPageCount;

      const normalized = normalizeExtractedTccsData(
        parsed,
        products,
        files.length,
        options?.productFormulas || [],
        options?.currentProductId
      );
      onProgress?.('Hoàn tất bóc tách và liên kết TCCS!', 100);
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
