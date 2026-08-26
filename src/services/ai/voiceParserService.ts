/**
 * voiceParserService.ts
 * =====================
 * Trợ lý bóc tách và chuẩn hóa dữ liệu kết quả kiểm nghiệm từ giọng nói (Voice-to-Data Lab Assistant).
 * Hỗ trợ chuyển đổi ngôn ngữ tự nhiên kiểm nghiệm tiếng Việt sang cấu trúc chỉ tiêu chuẩn.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiKey, getGeminiModel } from './geminiService';
import { PHARMA_TERM_DICTIONARY } from '../../utils/aiMapping';

export interface ParsedVoiceCriteria {
  criteriaName: string;
  value: string;
  unit?: string;
  isPass?: boolean;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Bảng quy đổi số đọc tiếng Việt sang số
 */
const VIETNAMESE_NUMBERS: Record<string, number> = {
  'không': 0, 'mot': 1, 'một': 1, 'mốt': 1, 'hai': 2, 'ba': 3, 'bốn': 4, 'tư': 4,
  'năm': 5, 'lăm': 5, 'sáu': 6, 'bảy': 7, 'bẩy': 7, 'tám': 8, 'chín': 9, 'mười': 10,
  'chục': 10, 'mươi': 10, 'trăm': 100, 'nghìn': 1000, 'ngàn': 1000
};

/**
 * Chuyển đổi các cụm từ số bằng chữ sang dạng số (ví dụ: "ba phẩy năm" -> "3.5", "năm trăm mười" -> "510")
 */
export const normalizeSpokenNumbers = (text: string): string => {
  if (!text) return '';
  let result = text.toLowerCase();

  // Quy đổi cụm [chữ số] phẩy/chấm [chữ số] (ví dụ: "ba phẩy năm" -> "3.5")
  Object.entries(VIETNAMESE_NUMBERS).forEach(([word1, num1]) => {
    Object.entries(VIETNAMESE_NUMBERS).forEach(([word2, num2]) => {
      if (num1 < 10 && num2 < 10) {
        const regex = new RegExp(`\\b${word1}\\s*(?:phẩy|chấm)\\s*${word2}\\b`, 'gi');
        result = result.replace(regex, `${num1}.${num2}`);
      }
    });
  });

  // Quy đổi các số cơ bản đứng đơn lẻ nếu đứng trước đơn vị (mg, %, ml, g, phút...)
  Object.entries(VIETNAMESE_NUMBERS).forEach(([word, num]) => {
    if (num < 10) {
      const regex = new RegExp(`\\b${word}\\s*(?=%|mg|ml|g|phút|°c|phần trăm)`, 'gi');
      result = result.replace(regex, `${num} `);
    }
  });

  // Thay thế các từ nối phân số / thập phân và đơn vị
  result = result
    .replace(/\s*phần trăm/g, '%')
    .replace(/\s*độ c/g, '°C')
    .replace(/\s*mi li gam/g, 'mg')
    .replace(/\s*mi li lít/g, 'mL')
    .replace(/\s*gam/g, 'g')
    .replace(/\s*microgam/g, 'mcg')
    .replace(/\s*phút/g, ' phút');

  return result;
};

/**
 * Trích xuất Rule-based từ câu nói tiếng Việt
 */
export const parseVoiceTextRuleBased = (
  spokenText: string,
  targetCriteriaNames: string[] = []
): ParsedVoiceCriteria[] => {
  const normalized = normalizeSpokenNumbers(spokenText);
  const results: ParsedVoiceCriteria[] = [];

  // Tách câu thành các mệnh đề theo dấu phẩy, chấm phẩy, từ "và", "tiếp theo", "chỉ tiêu"
  const clauses = normalized.split(/[,;\n]|(?:\b(?:và|tiếp theo|chỉ tiêu|tiêu chí)\b)/i);

  // Tập hợp các tên chỉ tiêu mục tiêu hoặc từ điển
  const allKnownNames = targetCriteriaNames.length > 0 
    ? targetCriteriaNames 
    : Object.keys(PHARMA_TERM_DICTIONARY);

  for (const rawClause of clauses) {
    const clause = rawClause.trim();
    if (!clause || clause.length < 2) continue;

    let matchedName = '';
    let matchedPos = -1;
    let matchedLength = 0;

    // 1. So khớp trực tiếp với targetCriteriaNames
    for (const name of allKnownNames) {
      const idx = clause.toLowerCase().indexOf(name.toLowerCase());
      if (idx !== -1 && name.length > matchedLength) {
        matchedName = name;
        matchedPos = idx;
        matchedLength = name.length;
      }
    }

    // 2. So khớp qua từ điển PHARMA_TERM_DICTIONARY
    if (!matchedName) {
      for (const [canonical, aliases] of Object.entries(PHARMA_TERM_DICTIONARY)) {
        // Tìm xem canonical hoặc alias nào có trong targetCriteriaNames
        const isTarget = allKnownNames.includes(canonical) || allKnownNames.some(t => aliases.includes(t.toLowerCase()));
        
        for (const alias of [canonical, ...aliases]) {
          const idx = clause.toLowerCase().indexOf(alias.toLowerCase());
          if (idx !== -1 && alias.length > matchedLength) {
            // Ưu tiên trả về tên trong targetCriteriaNames nếu có
            const targetMatch = targetCriteriaNames.find(t => t.toLowerCase() === canonical.toLowerCase() || aliases.includes(t.toLowerCase()));
            matchedName = targetMatch || canonical;
            matchedPos = idx;
            matchedLength = alias.length;
          }
        }
      }
    }

    if (matchedName) {
      // Phần còn lại sau tên chỉ tiêu chứa giá trị
      const afterName = clause.substring(matchedPos + matchedLength).trim();
      
      // Tìm số hoặc giá trị định tính
      const numMatch = afterName.match(/[-+]?[0-9]*\.?[0-9]+/);
      const isFailText = afterName.includes('không đạt') || afterName.includes('hỏng') || afterName.includes('fail') || afterName.includes('khong dat');
      const isPassText = afterName.includes('đạt') || afterName.includes('pass') || afterName.includes('chuẩn') || afterName.includes('dat');

      let val = '';
      let unit = '';

      if (numMatch) {
        val = numMatch[0];
        // Đơn vị sau số
        const afterNum = afterName.substring(numMatch.index! + numMatch[0].length).trim();
        if (afterNum.startsWith('%')) unit = '%';
        else if (afterNum.startsWith('mg')) unit = 'mg';
        else if (afterNum.startsWith('ml') || afterNum.startsWith('mL')) unit = 'mL';
        else if (afterNum.startsWith('g')) unit = 'g';
        else if (afterNum.startsWith('°C') || afterNum.startsWith('độ')) unit = '°C';
      } else if (isFailText) {
        val = 'Không đạt';
      } else if (isPassText) {
        val = 'Đạt';
      } else {
        val = afterName || 'Đạt';
      }

      results.push({
        criteriaName: matchedName,
        value: val,
        unit: unit || undefined,
        isPass: isFailText ? false : true,
        confidence: numMatch || isPassText ? 'high' : 'medium'
      });
    }
  }

  return results;
};

/**
 * Trích xuất toàn diện bằng AI Gemini từ văn bản giọng nói
 */
export const parseVoiceInputWithAI = async (
  spokenText: string,
  targetCriteriaNames: string[] = []
): Promise<ParsedVoiceCriteria[]> => {
  if (!spokenText || !spokenText.trim()) return [];

  const ruleBased = parseVoiceTextRuleBased(spokenText, targetCriteriaNames);

  const apiKey = getApiKey();
  if (!apiKey) return ruleBased;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: getGeminiModel() });

    const prompt = `
Bạn là Trợ lý AI chuyên trách chuyển đổi giọng nói thành dữ liệu kiểm nghiệm Dược phẩm (Voice-to-Data Parser).
Người dùng là Kiểm nghiệm viên đang đọc kết quả thử nghiệm trong phòng lab:
"${spokenText}"

${targetCriteriaNames.length > 0 ? `DANH SÁCH CHỈ TIÊU CỦA SẢN PHẨM HIỆN TẠI:\n${targetCriteriaNames.map(n => `- "${n}"`).join('\n')}` : ''}

YÊU CẦU:
1. Hãy phân tích và trích xuất tất cả các chỉ tiêu, giá trị đo được, đơn vị và đánh giá Đạt/Không Đạt.
2. Chuẩn hóa tên chỉ tiêu tương ứng trong danh sách chỉ tiêu trên nếu có.
3. Quy đổi số bằng chữ ("ba phẩy năm" -> "3.5", "năm trăm" -> "500").
4. Trả về DUY NHẤT mảng JSON hợp lệ theo định dạng:
[
  {
    "criteriaName": "Tên chỉ tiêu chuẩn",
    "value": "Giá trị chuỗi (ví dụ: 3.5, 500, Đạt, <10)",
    "unit": "Đơn vị tính (nếu có)",
    "isPass": true,
    "confidence": "high"
  }
]
`;

    const response = await model.generateContent(prompt);
    const text = response.response.text();
    const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any) => ({
        criteriaName: item.criteriaName || '',
        value: String(item.value || ''),
        unit: item.unit || undefined,
        isPass: item.isPass !== undefined ? Boolean(item.isPass) : true,
        confidence: item.confidence || 'high'
      }));
    }
  } catch (err) {
    console.warn('AI Voice Parsing fallback to rule-based:', err);
  }

  return ruleBased;
};
