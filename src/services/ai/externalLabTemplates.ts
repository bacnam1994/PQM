/**
 * externalLabTemplates.ts
 * =======================
 * Module nhận diện và trích xuất dữ liệu chuyên biệt cho các phòng kiểm nghiệm / trung tâm phân tích
 * lớn tại Việt Nam: QUATEST 3, CASE, NIFC, Eurofins.
 *
 * Hỗ trợ bóc tách cấu trúc bảng đặc thù, chuẩn hóa thuật ngữ phân tích,
 * xử lý dữ liệu dưới ngưỡng phát hiện (Censored Data: LOD, LOQ, KPH)
 * và phục vụ đánh giá sai số hệ thống (Lab Bias).
 */

import { TestingLaboratory } from '../../types/laboratory';
import { matchLaboratory, DEFAULT_TESTING_LABORATORIES } from '../laboratoryService';

export type RecognizedLab = 'QUATEST3' | 'CASE' | 'NIFC' | 'EUROFINS' | 'INTERNAL' | 'GENERIC';

export interface LabSignature {
  code: RecognizedLab;
  name: string;
  fullName: string;
  patterns: RegExp[];
  commonMethods: string[];
  nonDetectKeywords: string[];
  typicalReportPrefix: string[];
  extractionGuidePrompt: string;
}

export interface ParsedLabValue {
  rawValue: string | number;
  numericValue?: number;
  isNonDetect: boolean;
  operator?: '<' | '<=' | '>' | '>=' | '=';
  detectionLimit?: number; // LOD
  quantificationLimit?: number; // LOQ
  unit?: string;
  method?: string;
  note?: string;
}

/**
 * Danh mục cấu hình chữ ký nhận dạng và hướng dẫn phân tích của từng phòng lab
 */
export const EXTERNAL_LAB_SIGNATURES: Record<RecognizedLab, LabSignature> = {
  QUATEST3: {
    code: 'QUATEST3',
    name: 'QUATEST 3',
    fullName: 'Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3',
    patterns: [
      /quatest\s*3/i,
      /trung\s*tâm\s*kỹ\s*thuật\s*tiêu\s*chuẩn\s*đo\s*lường\s*chất\s*lượng\s*3/i,
      /kt3-[\da-z]+/i,
      /quality\s*assurance\s*and\s*testing\s*center\s*3/i,
    ],
    commonMethods: ['TCVN', 'AOAC', 'SMEWW', 'HD.TN.', 'USP', 'BP'],
    nonDetectKeywords: ['KPH', 'Không phát hiện', 'Not detected', '< LOD', '< LOQ', '<LOD', '<LOQ'],
    typicalReportPrefix: ['KT3-', 'N3-'],
    extractionGuidePrompt: `
[TEMPLATE QUATEST 3]
- Nhận dạng: Tiêu đề "PHIẾU KẾT QUẢ THỬ NGHIỆM / TEST REPORT" từ QUATEST 3.
- Cấu trúc bảng kết quả gồm các cột: "Tên chỉ tiêu (Test items)" | "Phương pháp thử (Test methods)" | "Kết quả (Test results)" | "Giới hạn phát hiện/định lượng (LOD/LOQ)".
- Thuật ngữ đặc thù:
  + "KPH" = Không phát hiện. Thường kèm "(LOD = ...)" hoặc "(LOQ = ...)". Ví dụ: "KPH (LOD = 0.01 mg/kg)".
  + Phương pháp thử: TCVN, AOAC, SMEWW, HD.TN.xx (Hướng dẫn thử nghiệm nội bộ Quatest 3).
- Lưu ý bóc tách:
  + Nếu kết quả là "KPH (LOD = X)", lưu "value" là "< X" hoặc "KPH", gán đúng đơn vị và phương pháp thử nghiệm.
`,
  },

  CASE: {
    code: 'CASE',
    name: 'CASE',
    fullName: 'Trung tâm Dịch vụ Phân tích Thí nghiệm TP.HCM',
    patterns: [
      /\bcase\b/i,
      /trung\s*tâm\s*dịch\s*vụ\s*phân\s*tích\s*thí\s*nghiệm/i,
      /center\s*of\s*analytical\s*services\s*and\s*experimentation/i,
      /sở\s*khoa\s*học\s*và\s*công\s*nghệ.*hồ\s*chí\s*minh/i,
      /mm\d{2,4}-[\da-z]+/i,
      /pt\d{2,4}-[\da-z]+/i,
    ],
    commonMethods: ['CASE-SOP', 'AOAC', 'TCVN', 'Ref. EPA', 'SMEWW'],
    nonDetectKeywords: ['KPH', 'Không phát hiện', 'Âm tính/25g', 'Âm tính/10g', 'Negative/25g'],
    typicalReportPrefix: ['MM', 'PT'],
    extractionGuidePrompt: `
[TEMPLATE CASE]
- Nhận dạng: Tiêu đề "PHIẾU KẾT QUẢ PHÂN TÍCH / TEST REPORT" từ Trung tâm Dịch vụ Phân tích Thí nghiệm TP.HCM (CASE).
- Cấu trúc bảng gồm: "Chỉ tiêu kiểm nghiệm / Parameters" | "Phương pháp / Methods" | "Đơn vị tính / Units" | "Kết quả / Results".
- Thuật ngữ đặc thù:
  + Vi sinh định tính: "Âm tính/25g" (Salmonella), "Âm tính/10g" -> gán value="Âm tính/25g", isPass=true.
  + Hóa lý / Kim loại / Độc tố: Thường dùng "KPH" hoặc "KPH (LOD: ...)" hoặc "< 0.05".
- Lưu ý bóc tách:
  + Cột phương pháp thường ghi mã CASE-SOP-xxx hoặc AOAC. Hãy trích xuất trường method đầy đủ.
`,
  },

  NIFC: {
    code: 'NIFC',
    name: 'NIFC',
    fullName: 'Viện Kiểm nghiệm An toàn Vệ sinh Thực phẩm Quốc gia',
    patterns: [
      /\bnifc\b/i,
      /viện\s*kiểm\s*nghiệm\s*an\s*toàn\s*vệ\s*sinh\s*thực\s*phẩm\s*quốc\s*gia/i,
      /national\s*institute\s*for\s*food\s*control/i,
      /vkn\.[\da-z]+/i,
    ],
    commonMethods: ['ISO', 'TCVN', 'AOAC', 'FDA BAM', 'QCVN', 'DĐVN'],
    nonDetectKeywords: ['Không phát hiện', 'KPH', 'LOD:', 'LOQ:', '< LOQ', '<LOQ'],
    typicalReportPrefix: ['VKN', 'NIFC'],
    extractionGuidePrompt: `
[TEMPLATE NIFC]
- Nhận dạng: Tiêu đề "PHIẾU KẾT QUẢ KIỂM NGHIỆM / TEST REPORT" của Viện Kiểm nghiệm An toàn Vệ sinh Thực phẩm Quốc gia (Bộ Y tế).
- Cấu trúc bảng gồm: "Tên chỉ tiêu thử nghiệm" | "Đơn vị" | "Kết quả" | "Phương pháp thử" | "Quy chuẩn kỹ thuật / Giới hạn".
- Thuật ngữ đặc thù:
  + Thường tách riêng cả 2 thông số LOD và LOQ ở cột riêng hoặc dòng ghi chú: "LOD = 0.005 mg/kg; LOQ = 0.015 mg/kg".
  + Phương pháp vi sinh thường viện dẫn tiêu chuẩn ISO: ISO 4833-1, ISO 21528-2, ISO 6579-1.
  + Quy chuẩn tham chiếu thường ghi: QCVN 8-1:2011/BYT (Kim loại nặng), QCVN 8-2:2011/BYT (Độc tố vi nấm), QCVN 8-3:2012/BYT (Vi sinh).
- Lưu ý bóc tách:
  + Nhặt đúng quy chuẩn kỹ thuật vào trường "limit" để phục vụ đối chiếu TCCS.
`,
  },

  EUROFINS: {
    code: 'EUROFINS',
    name: 'Eurofins Sắc Ký Hải Đăng',
    fullName: 'Eurofins Sac Ky Hai Dang / Eurofins Central Laboratory',
    patterns: [/eurofins/i, /sắc\s*ký\s*hải\s*đăng/i, /evn\d+/i],
    commonMethods: ['ISO/IEC', 'AOAC', 'CEN/TS', 'DIN EN'],
    nonDetectKeywords: ['ND', 'Not Detected', '< LOQ', '< LOD'],
    typicalReportPrefix: ['AR-', 'EVN-'],
    extractionGuidePrompt: `
[TEMPLATE EUROFINS]
- Nhận dạng: Tiêu đề "TEST REPORT / PHIẾU KẾT QUẢ THỬ NGHIỆM" Eurofins.
- Thường dùng "ND" (Not Detected) hoặc "< [LOQ]" cho các chỉ tiêu dư lượng hóa chất/vi chất.
`,
  },

  INTERNAL: {
    code: 'INTERNAL',
    name: 'Phòng Kiểm nghiệm Nội bộ',
    fullName: 'Phòng QC / QA Nội bộ V-BIOTECH',
    patterns: [/nội\s*bộ/i, /phòng\s*qc/i, /v-biotech/i, /pqm/i],
    commonMethods: ['TCCS', 'DĐVN V', 'SOP-QC'],
    nonDetectKeywords: ['KPH', 'Âm tính', 'Đạt'],
    typicalReportPrefix: ['KN-', 'QC-'],
    extractionGuidePrompt: `
[TEMPLATE NỘI BỘ]
- Phiếu kiểm nghiệm nội bộ theo quy chuẩn TCCS đã ban hành.
`,
  },

  GENERIC: {
    code: 'GENERIC',
    name: 'Phòng Kiểm nghiệm Khác',
    fullName: 'Đơn vị Thử nghiệm Ngoại kiểm Chung',
    patterns: [],
    commonMethods: ['TCVN', 'AOAC', 'ISO', 'Dược điển'],
    nonDetectKeywords: ['KPH', 'Không phát hiện', 'ND', '<'],
    typicalReportPrefix: [],
    extractionGuidePrompt: '',
  },
};

/**
 * Tự động nhận diện đơn vị kiểm nghiệm từ tiêu đề, nội dung văn bản hoặc tên file.
 * Tra cứu trước qua Master Data TestingLaboratory và aliases, sau đó fallback sang Regex Patterns.
 */
export const detectLabOrganization = (
  textOrFileName: string,
  laboratories?: TestingLaboratory[]
): RecognizedLab => {
  if (!textOrFileName) return 'GENERIC';

  // 1. Tra cứu trực tiếp qua Master Data TestingLaboratory và các aliases
  const matched = matchLaboratory(textOrFileName, laboratories || DEFAULT_TESTING_LABORATORIES);
  if (matched) {
    const code = matched.lab.code.toUpperCase();
    if (code in EXTERNAL_LAB_SIGNATURES) {
      return code as RecognizedLab;
    }
    if (matched.lab.type === 'INTERNAL') return 'INTERNAL';
  }

  // 2. Fallback sang Regex Patterns
  const lower = textOrFileName.toLowerCase();

  for (const [key, sig] of Object.entries(EXTERNAL_LAB_SIGNATURES)) {
    if (key === 'GENERIC') continue;
    for (const pattern of sig.patterns) {
      if (pattern.test(lower)) {
        return sig.code;
      }
    }
  }

  return 'GENERIC';
};

/**
 * Chuẩn hóa và bóc tách giá trị kết quả kiểm nghiệm thô (bao gồm xử lý ngưỡng phát hiện Censored Data)
 */
export const parseLabResultValue = (
  raw: string | number | undefined | null,
  rawUnit?: string,
  rawMethod?: string
): ParsedLabValue => {
  if (raw === undefined || raw === null) {
    return { rawValue: '', isNonDetect: false, unit: rawUnit, method: rawMethod };
  }

  if (typeof raw === 'number') {
    return {
      rawValue: raw,
      numericValue: raw,
      isNonDetect: false,
      operator: '=',
      unit: rawUnit,
      method: rawMethod,
    };
  }

  const str = String(raw).trim();
  const lower = str.toLowerCase();

  // 1. Kiểm tra các định dạng KPH / Không phát hiện kèm giới hạn
  // Ví dụ: "KPH (LOD = 0.01 mg/kg)", "KPH (LOQ: 0.05)", "Không phát hiện (LOD: 0.005)"
  const kphMatch = str.match(
    /(?:kph|không phát hiện|not detected|nd)\s*(?:\((?:lod|loq)\s*[:=]\s*([0-9.,]+)\s*([a-zA-Z/%µ]*)\))?/i
  );
  if (kphMatch) {
    const limitNum = kphMatch[1] ? parseFloat(kphMatch[1].replace(',', '.')) : undefined;
    const limitUnit = kphMatch[2] ? kphMatch[2].trim() : rawUnit;
    const isLOD = /lod/i.test(str);
    const isLOQ = /loq/i.test(str);

    return {
      rawValue: str,
      numericValue: limitNum,
      isNonDetect: true,
      operator: '<',
      detectionLimit: isLOD ? limitNum : undefined,
      quantificationLimit: isLOQ ? limitNum : undefined,
      unit: limitUnit || rawUnit,
      method: rawMethod,
    };
  }

  // 2. Dạng toán học: "< 0.05" hoặc "≤ 0.5" hoặc "> 100"
  const operatorMatch = str.match(/^([<>≤≥]=?)\s*([0-9.,]+)\s*(.*)$/);
  if (operatorMatch) {
    const op = operatorMatch[1].replace('≤', '<=').replace('≥', '>=') as '<' | '<=' | '>' | '>=';
    const num = parseFloat(operatorMatch[2].replace(',', '.'));
    const unit = operatorMatch[3]?.trim() || rawUnit;
    const isUnderLimit = op === '<' || op === '<=';

    return {
      rawValue: str,
      numericValue: num,
      isNonDetect: isUnderLimit,
      operator: op,
      quantificationLimit: isUnderLimit ? num : undefined,
      unit,
      method: rawMethod,
    };
  }

  // 3. Dạng định tính vi sinh: "Âm tính / 25g", "Âm tính", "Dương tính"
  if (lower.includes('âm tính') || lower.includes('negative') || lower.includes('absent')) {
    return {
      rawValue: str,
      isNonDetect: true,
      unit: rawUnit,
      method: rawMethod,
      note: 'Chỉ tiêu định tính: Âm tính',
    };
  }

  // 4. Số thực thông thường: "98.5" hoặc "1.25" hoặc "1,25"
  const cleanNumStr = str.replace(/[^\d.,-]/g, '').replace(',', '.');
  const parsedNum = parseFloat(cleanNumStr);

  if (!isNaN(parsedNum) && !str.includes('-') && !str.includes('–')) {
    return {
      rawValue: str,
      numericValue: parsedNum,
      isNonDetect: false,
      operator: '=',
      unit: rawUnit,
      method: rawMethod,
    };
  }

  // 5. Mặc định là chuỗi định tính khác (Đạt, Đục nhẹ, Vàng nhạt...)
  return {
    rawValue: str,
    isNonDetect: false,
    unit: rawUnit,
    method: rawMethod,
  };
};

/**
 * Sinh đoạn prompt hướng dẫn chuyên sâu cho Gemini OCR theo từng phòng lab
 */
export const buildExternalLabPromptSection = (detectedLab?: RecognizedLab): string => {
  const parts: string[] = [
    '=== HƯỚNG DẪN TRÍCH XUẤT CHUYÊN BIỆT THEO PHÒNG KIỂM NGHIỆM NGOẠI KIỂM ===',
  ];

  if (detectedLab && detectedLab !== 'GENERIC') {
    parts.push(EXTERNAL_LAB_SIGNATURES[detectedLab].extractionGuidePrompt);
  } else {
    // Nếu chưa nhận diện được lab cụ thể, đính kèm cả 3 template lớn
    parts.push(EXTERNAL_LAB_SIGNATURES.QUATEST3.extractionGuidePrompt);
    parts.push(EXTERNAL_LAB_SIGNATURES.CASE.extractionGuidePrompt);
    parts.push(EXTERNAL_LAB_SIGNATURES.NIFC.extractionGuidePrompt);
  }

  parts.push(`
QUY TẮC BÓC TÁCH KẾT QUẢ KPH & GIỚI HẠN:
1. Khi gặp "KPH" hoặc "< LOD" hoặc "< LOQ", KHÔNG được bỏ trống trường value!
   - Hãy lưu nguyên văn vào "value" (ví dụ: "KPH (LOD = 0.01 mg/kg)" hoặc "< 0.05").
2. Bóc tách phương pháp thử nghiệm vào field "method" (nếu có): TCVN, AOAC, ISO, DĐVN V, CASE-SOP...
3. Bóc tách đơn vị chuẩn mực: mg/kg, g/100g, CFU/g, Âm tính/25g...
`);

  return parts.join('\n');
};
