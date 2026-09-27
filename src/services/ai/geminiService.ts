import type { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { createGoogleGenerativeAI, SchemaType } from './geminiClientLoader';
import { GEMINI_TOOL_DECLARATIONS, executeTool } from './aiTools';
import type { RenderedPdfPage } from '../../utils/pdfProcessor';
import type { TesseractFallbackResult } from './tesseractFallback';
import { resolveLeanContext } from './contextResolver';
import { semanticCache } from './semanticCacheService';
import {
  AVAILABLE_GEMINI_MODELS,
  DEFAULT_GEMINI_MODEL,
  type GeminiModelOption,
} from '../../constants/aiModels';

export { AVAILABLE_GEMINI_MODELS, DEFAULT_GEMINI_MODEL, type GeminiModelOption };

export const getApiKey = (): string => {
  const localKey =
    typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY')?.trim() : '';
  if (localKey) return localKey;
  return import.meta.env.VITE_GEMINI_API_KEY || '';
};

export const formatGeminiError = (error: any): string => {
  const msg = error?.message || String(error || '');
  if (
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid') ||
    msg.includes('API_KEY_SERVICE_BLOCKED')
  ) {
    return 'Khóa API Gemini không hợp lệ hoặc đã hết hạn. Vui lòng vào mục "Cài đặt" > "Cấu hình AI" để cập nhật API Key mới (lấy miễn phí tại https://aistudio.google.com/app/apikey) hoặc cập nhật file .env.local.';
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return 'Đã vượt quá hạn mức truy vấn API của Google Gemini (Lỗi 429 - Rate Limit / Quota Exceeded). Vui lòng thử lại sau giây lát hoặc cấu hình API Key cá nhân trong Cài đặt.';
  }
  if (msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('overloaded')) {
    return 'Máy chủ Google AI hiện đang quá tải hoặc tạm thời gián đoạn (503). Vui lòng thử lại sau vài giây.';
  }
  if (msg.includes('SAFETY') || msg.includes('blocked due to safety')) {
    return 'Yêu cầu bị từ chối do vi phạm bộ lọc an toàn nội dung của Google AI.';
  }
  return `Đã xảy ra sự cố khi giao tiếp với AI: ${msg}`;
};

const getGenAI = async (): Promise<GoogleGenerativeAI> => {
  const key = getApiKey();
  if (!key) {
    throw new Error(
      'Chưa cấu hình Gemini API Key. Vui lòng nhập API Key trong phần Cài đặt hệ thống hoặc file .env của dự án.'
    );
  }
  return await createGoogleGenerativeAI(key);
};

// [BẢO MẬT] Danh sách MIME types hợp lệ cho OCR upload
const ALLOWED_OCR_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];
const MAX_OCR_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export const validateOCRFile = (file: File): { valid: boolean; error?: string } => {
  if (file.size > MAX_OCR_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Giới hạn tối đa là 20MB.`,
    };
  }
  if (!ALLOWED_OCR_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Định dạng file không hỗ trợ (${file.type}). Vui lòng upload PDF hoặc ảnh (JPG, PNG, WEBP, HEIC).`,
    };
  }
  return { valid: true };
};

export const getGeminiModel = (): string => {
  return localStorage.getItem('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL;
};

export const getIsThinkingEnabled = (): boolean => {
  const saved = localStorage.getItem('GEMINI_THINKING_ENABLED');
  return saved === 'true'; // Mặc định là false theo Phase 14 để tối ưu độ trễ
};

export const extractThinking = (text: string): { thinking?: string; cleanText: string } => {
  if (!text) return { cleanText: text };

  // Case 1: Thẻ <thinking>...</thinking> đầy đủ
  const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/i;
  const match = text.match(thinkingRegex);
  if (match) {
    const thinking = match[1].trim();
    // Xóa tất cả các block thinking (có thể có nhiều block) và clean whitespace thừa
    const cleanText = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
    return { thinking, cleanText };
  }

  // Case 2: Có thẻ mở <thinking> nhưng KHÔNG có thẻ đóng (bị cắt, stream)
  const openTagIdx = text.toLowerCase().indexOf('<thinking>');
  if (openTagIdx !== -1) {
    const cleanText = text.substring(0, openTagIdx).trim();
    const thinking = text.substring(openTagIdx + '<thinking>'.length).trim();
    // Bỏ thẻ đóng lẻ nếu có
    return { thinking: thinking.replace(/<\/thinking>/gi, '').trim(), cleanText };
  }

  // Case 3: Không có thinking
  // Vẫn clean bất kỳ thẻ </thinking> lẻ nào còn sót
  const cleanText = text.replace(/<\/thinking>/gi, '').trim();
  return { cleanText };
};

// ─── OCR SCHEMA dùng chung ─────────────────────────────────────────────────
const OCR_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    labName: {
      type: SchemaType.STRING,
      description: 'Tên đơn vị kiểm nghiệm / Phòng thí nghiệm. Để rỗng nếu không tìm thấy.',
    },
    documentType: {
      type: SchemaType.STRING,
      description: 'Loại phiếu: External_Lab | Internal | CoA | Supplier_CoA',
    },
    pageCount: {
      type: SchemaType.NUMBER,
      description: 'Số trang thực tế đã đọc được trong tài liệu (số nguyên dương)',
    },
    productCode: {
      type: SchemaType.STRING,
      description: 'Mã số / Mã hàng hóa / Mã sản phẩm / SKU đọc được từ phiếu (nếu có)',
    },
    productName: {
      type: SchemaType.STRING,
      description: 'Tên sản phẩm đầy đủ đọc được từ phiếu (nếu có)',
    },
    batchNo: {
      type: SchemaType.STRING,
      description: 'Số lô sản xuất (nếu có, không có thì để rỗng)',
    },
    mfgDate: {
      type: SchemaType.STRING,
      description: 'Ngày sản xuất (định dạng DD/MM/YYYY, nếu không có để rỗng)',
    },
    expDate: {
      type: SchemaType.STRING,
      description: 'Hạn sử dụng (định dạng DD/MM/YYYY, nếu không có để rỗng)',
    },
    testDate: {
      type: SchemaType.STRING,
      description:
        'Ngày kiểm nghiệm / Ngày xuất phiếu kết quả (định dạng DD/MM/YYYY, nếu không có để rỗng)',
    },
    notes: {
      type: SchemaType.STRING,
      description:
        'Ghi chú đặc biệt từ phiếu (ghi chú cuối bảng, phát hiện giá trị sửa tay, ảnh chất lượng thấp...); để rỗng nếu không có',
    },
    testResults: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          criteriaName: {
            type: SchemaType.STRING,
            description: 'Tên chỉ tiêu NGUYÊN BẢN từ phiếu (giữ nguyên, không dịch)',
          },
          mappedName: {
            type: SchemaType.STRING,
            description: 'Tên chỉ tiêu chuẩn trong TCCS nếu map được, để rỗng nếu không chắc',
          },
          confidence: {
            type: SchemaType.STRING,
            description:
              "'high' nếu map được tên TCCS chắc chắn, 'medium' nếu suy luận nhẹ, 'low' nếu không chắc",
          },
          confidenceScore: {
            type: SchemaType.NUMBER,
            description: 'Điểm tin cậy từ 0 đến 100 phản ánh độ nét và độ rõ của số liệu',
          },
          value: {
            type: SchemaType.STRING,
            description:
              'Kết quả kiểm nghiệm (ví dụ: 1.5, Đạt, Trắng trong, 0, < 10). Trả về dưới dạng chuỗi.',
          },
          unit: {
            type: SchemaType.STRING,
            description: 'Đơn vị tính (ví dụ: %, mg, CFU/g. Nếu không có để rỗng)',
          },
          limit: {
            type: SchemaType.STRING,
            description: 'Yêu cầu / Mức tiêu chuẩn / Giới hạn cho phép (nếu có)',
          },
          analysisMethod: {
            type: SchemaType.STRING,
            description:
              'Phương pháp thử nghiệm nếu ghi trên phiếu (ví dụ: HPLC, UV-Vis, TCVN...); để rỗng nếu không có',
          },
          sourcePageNumber: {
            type: SchemaType.INTEGER,
            description: 'Số thứ tự trang chứa chỉ tiêu này trên tài liệu (bắt đầu từ 1)',
          },
          rawText: {
            type: SchemaType.STRING,
            description: 'Dòng văn bản thô nguyên bản trên phiếu của chỉ tiêu này',
          },
        },
        required: ['criteriaName', 'value', 'mappedName', 'confidence'],
      },
    },
  },
} as const;

// Model dự phòng khi model chính bị 503/429
const FALLBACK_OCR_MODEL = 'gemini-2.0-flash';

// ─── Helper gọi Gemini OCR với danh sách inlineData parts ─────────────────────
async function executeGeminiOcrCall(
  genAI: GoogleGenerativeAI,
  systemPrompt: string,
  contentParts: { inlineData: { data: string; mimeType: string } }[],
  onProgress?: (step: string, percent: number) => void,
  progressBase: number = 30
): Promise<any> {
  const primaryModelName = getGeminiModel();
  const buildModel = (modelName: string) =>
    genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: OCR_RESPONSE_SCHEMA as any,
      },
    });

  const maxRetries = 3;
  let attempt = 0;
  let useFallback = false;

  while (attempt < maxRetries) {
    try {
      const modelName = useFallback ? FALLBACK_OCR_MODEL : primaryModelName;
      if (useFallback && attempt === 1) {
        onProgress?.(`Chuyển sang model dự phòng (${FALLBACK_OCR_MODEL})...`, progressBase + 5);
      }
      const model = buildModel(modelName);
      onProgress?.('AI đang phân tích tài liệu...', progressBase + 15 + attempt * 10);

      // Gửi prompt cùng tất cả image parts lên Gemini API
      const result = await model.generateContent([systemPrompt, ...contentParts]);
      const response = result.response;
      const text = response.text();

      return JSON.parse(text);
    } catch (error: any) {
      attempt++;
      const errorMessage = error?.message || '';
      const backoffMs = Math.pow(2, attempt) * 1000;

      if (
        (errorMessage.includes('503') || errorMessage.includes('429')) &&
        !useFallback &&
        attempt < maxRetries
      ) {
        console.warn(
          `Gemini OCR overloaded. Switching to fallback '${FALLBACK_OCR_MODEL}' (attempt ${attempt})...`
        );
        useFallback = true;
        onProgress?.(`Model bị quá tải, đang thử lại với model dự phòng...`, progressBase + 5);
        await new Promise((res) => setTimeout(res, backoffMs));
        continue;
      }
      if ((errorMessage.includes('503') || errorMessage.includes('429')) && attempt < maxRetries) {
        console.warn(
          `Gemini OCR fallback overloaded. Retrying attempt ${attempt} in ${backoffMs}ms...`
        );
        onProgress?.(`Đang thử lại (lần ${attempt})...`, progressBase + 10);
        await new Promise((res) => setTimeout(res, backoffMs));
        continue;
      }

      console.error('Error calling Gemini API:', error);
      throw error;
    }
  }
  throw new Error('Gemini OCR: Đã vượt quá số lần thử lại tối đa mà không thành công.');
}

export const geminiService = {
  /**
   * Gọi API Gemini để phân tích file tài liệu (ảnh hoặc PDF) – đơn file.
   * ĐẶC BIỆT: Đối với file PDF, tự động chuyển đổi từng trang thành ảnh JPEG tối ưu (1600px)
   * và phân đoạn (chunking 3 trang/lần) nếu file nhiều trang, loại bỏ 100% lỗi quá tải / timeout của Gemini.
   * Nếu Gemini API hoàn toàn không khả dụng (mất mạng), tự động chuyển sang Tesseract.js offline OCR.
   * @param file File tài liệu upload từ input
   * @param systemPrompt Lệnh hướng dẫn AI
   * @param onProgress Callback tiến độ (step, percent 0-100)
   */
  extractDataFromDocument: async (
    file: File,
    systemPrompt: string,
    onProgress?: (step: string, percent: number) => void
  ) => {
    const validation = validateOCRFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    const genAI = await getGenAI();

    // ─── Outer try: bắt mọi lỗi mạng để kích hoạt Tesseract.js fallback ────────
    try {
      // ─── TRƯỜNG HỢP 1: FILE PDF ──────────────────────────────────────────────
      if (file.type === 'application/pdf') {
        try {
          onProgress?.('Đang tối ưu & phân tích cấu trúc PDF...', 10);

          // Render từng trang PDF sang ảnh High-DPI (250 DPI) định dạng PNG lossless tối ưu cho OCR
          const { convertPdfToImages } = await import('../../utils/pdfProcessor');
          const renderedPages: RenderedPdfPage[] = await convertPdfToImages(file, {
            targetDpi: 250,
            format: 'image/png',
            maxPages: 50,
            onProgress: (current, total) => {
              onProgress?.(
                `Đang xử lý trang PDF High-DPI ${current}/${total}...`,
                Math.round(10 + (current / total) * 20)
              );
            },
          });

          const totalPages = renderedPages.length;
          if (totalPages === 0) {
            throw new Error('Không thể đọc được trang nào từ file PDF này.');
          }

          // OCR-05: Per-Page Extraction & Context Tracking
          // Bóc tách từng trang độc lập, bảo tồn ngữ cảnh bảng nối trang và gắn cứng sourcePageNumber
          const { extractAllPagesSequentially } = await import('../ocr/pageExtractor');
          const mergedFinalResult = await extractAllPagesSequentially(
            renderedPages,
            systemPrompt,
            async (decoratedPrompt, page) => {
              const imagePart = {
                inlineData: {
                  data: page.base64,
                  mimeType: page.mimeType || 'image/png',
                },
              };
              return await executeGeminiOcrCall(
                genAI,
                decoratedPrompt,
                [imagePart],
                onProgress,
                35
              );
            },
            {
              continueOnPageError: true,
              maxRetriesPerPage: 2,
              onPageProgress: (current, total, stepText) => {
                const percent = Math.round(30 + (current / total) * 65);
                onProgress?.(stepText, percent);
              },
            }
          );

          onProgress?.('Hoàn tất!', 100);
          return mergedFinalResult;
        } catch (pdfError: any) {
          console.warn(
            'Lỗi khi xử lý PDF qua Canvas, chuyển sang phương thức gửi file gốc:',
            pdfError
          );
          // Fallback: Nếu lỗi Canvas hoặc PDF đặc thù, tiếp tục với phương thức gửi file Base64 truyền thống bên dưới
        }
      }

      // ─── TRƯỜNG HỢP 2: FILE ẢNH HOẶC FALLBACK FILE GỐC ─────────────────────────
      onProgress?.('Đang đọc file...', 10);

      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      onProgress?.('Đang gửi lên AI...', 30);

      const filePart = {
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      };

      const result = await executeGeminiOcrCall(genAI, systemPrompt, [filePart], onProgress, 40);
      result.pageCount = 1;
      if (Array.isArray(result?.testResults)) {
        result.testResults = result.testResults.map((it: any) => ({
          ...it,
          sourcePageNumber: it.sourcePageNumber || 1,
        }));
      }
      onProgress?.('Hoàn tất!', 100);
      return result;
    } catch (geminiError: any) {
      // ─── FALLBACK CUỐI CÙNG: Tesseract.js Offline OCR ──────────────────────────
      // Chỉ kích hoạt khi Gemini API hoàn toàn không khả dụng (mất mạng, API sập)
      // Các lỗi logic (API key sai, file không hợp lệ...) vẫn được throw ra bình thường
      const msg = geminiError?.message || '';
      const isNetworkError =
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('net::ERR') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('503') ||
        msg.includes('502');

      if (isNetworkError) {
        console.warn(
          '[geminiService] Gemini API không khả dụng. Chuyển sang Tesseract.js offline fallback...'
        );
        try {
          const { extractRawTextWithTesseract } = await import('./tesseractFallback');
          const fallbackResult = await extractRawTextWithTesseract(file, onProgress);
          return fallbackResult as any;
        } catch (tessError: any) {
          console.error('[geminiService] Cả Gemini lẫn Tesseract đều thất bại:', tessError);
          // Trả về object thông báo để UI hiển thị thay vì throw lỗi trắng
          const emptyFallback: TesseractFallbackResult = {
            _isOfflineFallback: true,
            rawText: '',
            fileName: file.name,
            lang: 'n/a',
            confidence: 0,
            pageCount: 0,
            offlineMessage:
              '⚠️ **Không thể đọc tài liệu** — Cả Gemini AI và OCR offline đều không khả dụng. ' +
              'Vui lòng kiểm tra kết nối mạng và thử lại, hoặc nhập kết quả thủ công.',
            testResults: [],
            labName: '',
            batchNo: '',
            testDate: '',
            notes: `[Offline - OCR thất bại] ${tessError?.message || ''}`,
          };
          return emptyFallback as any;
        }
      }

      // Lỗi không phải lưới: throw ra để hàm gọi xử lý (API key sai, v.v.)
      throw geminiError;
    }
  },

  /**
   * Xử lý nhiều file PDF/ảnh cùng lúc (Batch OCR).
   * Dùng Promise.all để xử lý song song và thu thập kết quả từng file.
   * @param files Danh sách file cần scan
   * @param systemPrompt Lệnh hướng dẫn AI
   * @param onFileProgress Callback nhận trạng thái từng file
   */
  extractDataFromDocumentBatch: async (
    files: File[],
    systemPrompt: string,
    onFileProgress?: (
      fileIndex: number,
      fileName: string,
      status: 'processing' | 'done' | 'error',
      data?: any,
      error?: string
    ) => void
  ): Promise<{ success: any[]; errors: { fileName: string; error: string }[] }> => {
    const tasks = files.map((file, index) => async () => {
      onFileProgress?.(index, file.name, 'processing');
      try {
        const data = await geminiService.extractDataFromDocument(
          file,
          systemPrompt,
          (_step, _percent) => {
            // Truyền trạng thái progress ra ngoài nếu cần
            onFileProgress?.(index, file.name, 'processing', {
              _progressStep: _step,
              _progressPercent: _percent,
            });
          }
        );
        onFileProgress?.(index, file.name, 'done', data);
        return { ok: true as const, data, fileName: file.name };
      } catch (err: any) {
        const errMsg = formatGeminiError(err);
        onFileProgress?.(index, file.name, 'error', undefined, errMsg);
        return { ok: false as const, error: errMsg, fileName: file.name };
      }
    });

    // Chạy song song tất cả file
    const results = await Promise.all(tasks.map((t) => t()));

    const success = results.filter((r) => r.ok).map((r) => (r as any).data);
    const errors = results
      .filter((r) => !r.ok)
      .map((r) => ({ fileName: (r as any).fileName, error: (r as any).error }));

    return { success, errors };
  },

  /**
   * Gọi API sinh văn bản đơn giản (không có tools) từ Gemini.
   * Dùng cho các tác vụ phân tích tự động như RCA, FMEA.
   * @param prompt Nội dung yêu cầu phân tích
   * @param systemPrompt Lệnh định hướng hệ thống
   */
  generateText: async (
    prompt: string,
    systemPrompt?: string,
    modelName?: string
  ): Promise<string> => {
    const genAI = await getGenAI();
    const activeModel = modelName || getGeminiModel();
    const model = genAI.getGenerativeModel({
      model: activeModel,
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  },

  /**
   * Gọi API Gemini với Structured Output (JSON Schema bắt buộc).
   * Loại bỏ 100% rủi ro JSON.parse thủ công — Gemini được enforce trả về đúng schema định sẵn.
   * Dùng cho tất cả AI service cần trả về cấu trúc JSON có kiểu rõ ràng.
   *
   * @param prompt Nội dung yêu cầu
   * @param schema JSON Schema object (dạng Gemini SchemaType)
   * @param systemPrompt Lệnh định hướng hệ thống (tuỳ chọn)
   * @param modelName Tên model cụ thể (tuỳ chọn, mặc định theo cài đặt)
   * @param temperature Mức độ sáng tạo (mặc định 0.2 cho JSON nghiêm ngặt)
   * @returns Promise<T> — Object đã parse sẵn, đúng kiểu T
   */
  generateStructuredJson: async <T = any>(
    prompt: string,
    schema: object,
    systemPrompt?: string,
    modelName?: string,
    temperature: number = 0.2
  ): Promise<T> => {
    const genAI = await getGenAI();
    const activeModel = modelName || getGeminiModel();

    const model = genAI.getGenerativeModel({
      model: activeModel,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema as any,
        temperature,
      },
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
    });

    const maxRetries = 2;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        return JSON.parse(text) as T;
      } catch (error: any) {
        attempt++;
        const errorMessage = error?.message || '';
        const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 300;

        if (
          (errorMessage.includes('503') || errorMessage.includes('429')) &&
          attempt < maxRetries
        ) {
          console.warn(
            `Gemini generateStructuredJson overloaded. Retrying attempt ${attempt} in ${Math.round(backoffMs)}ms...`
          );
          await new Promise((res) => setTimeout(res, backoffMs));
          continue;
        }
        console.error('Error in generateStructuredJson:', error);
        throw error;
      }
    }
    throw new Error(
      'generateStructuredJson: Đã vượt quá số lần thử lại tối đa mà không thành công.'
    );
  },

  /**
   * Tính năng Chat bằng Text với dữ liệu ngữ cảnh tinh gọn (Phases 8, 11, 12, 13, 14, 15)
   * Hỗ trợ Multi-turn + Parallel Tool Execution + Semantic Caching + AbortSignal
   * @param message Tin nhắn câu hỏi của người dùng
   * @param appContextData Object chứa dữ liệu ứng dụng
   * @param history Lịch sử đoạn chat trước đó để hỗ trợ Multi-turn
   * @param modelName Tên model AI tùy chọn
   * @param sessionMemoryPrompt Ký ức hội thoại từ session trước
   * @param options Tùy chọn AbortSignal và bypassCache
   */
  chatWithAppContext: async (
    message: string,
    appContextData: any,
    history: Content[] = [],
    modelName?: string,
    sessionMemoryPrompt?: string,
    options?: { signal?: AbortSignal; bypassCache?: boolean }
  ) => {
    if (options?.signal?.aborted) {
      throw new DOMException('Chat request was aborted before start', 'AbortError');
    }

    const activeModel = modelName || getGeminiModel();
    const isThinkingEnabled = getIsThinkingEnabled();

    // ─── TẦNG CACHE AI (Phase 15): Kiểm tra Semantic Cache cho câu hỏi tra cứu ───
    if (!options?.bypassCache && (!history || history.length === 0)) {
      const cached = semanticCache.get<{ text: string; thinking?: string }>({
        promptId: 'TCCS_ASSISTANT',
        input: `[${activeModel}] ${message}`,
      });
      if (cached && cached.data?.text) {
        return {
          text: cached.data.text,
          thinking: cached.data.thinking,
          fromCache: true,
        };
      }
    }

    const genAI = await getGenAI();

    const model = genAI.getGenerativeModel({
      model: activeModel,
      tools: [{ functionDeclarations: GEMINI_TOOL_DECLARATIONS as any }],
    });

    // ─── TỐI ƯU HÓA NGỮ CẢNH (Phase 8): Context Resolver Siêu nhẹ ─────────────────
    const leanContext = resolveLeanContext(message, appContextData);

    const systemPrompt = `Bạn là Trợ lý AI chuyên môn của phần mềm V-BIOTECH Quality Management (Quản lý Chất lượng Dược phẩm).
Nhiệm vụ: Trả lời câu hỏi dựa trên DỮ LIỆU THỰC của ứng dụng và GỌI CÁC TOOL khi cần phân tích sâu hơn.

DỮ LIỆU NGỮ CẢNH TRỌNG TÂM (JSON):
${JSON.stringify(leanContext, null, 2)}

QUY TẮC:
1. LUÔN dựa vào dữ liệu JSON để trả lời. Không bịa đặt thông tin.
2. Trả lời bằng Tiếng Việt, văn phong chuyên nghiệp, thân thiện.
3. Sử dụng Markdown (in đậm, danh sách) để làm câu trả lời dễ đọc hơn.
4. Nếu người dùng hỏi về xu hướng, thống kê → GỌI analyzeQualityTrends với productId phù hợp.
5. Nếu hỏi về tiêu chuẩn dược điển → GỌI lookupPharmacoeiaStandard.
6. Nếu hỏi về nguyên nhân sự cố → GỌI performRootCauseAnalysis.
7. Nếu hỏi về rủi ro quy trình → GỌI assessQualityRisk.
8. Nếu hỏi về tình trạng lô hàng tổng thể → GỌI getBatchSummary.
9. Nếu hỏi kiểm tra chất lượng dữ liệu → GỌI validateDataIntegrity.
10. Nếu thông tin không có trong dữ liệu, hãy nói rõ "Tôi không tìm thấy thông tin này trong hệ thống".
11. Nếu người dùng yêu cầu xuất báo cáo, tải file Excel, báo cáo tháng/quý → GỌI generateQualityReport với period phù hợp ('month', 'quarter', 'all').
12. Nếu người dùng hỏi về cảnh báo chất lượng, rủi ro, lô sắp hết hạn, xu hướng trôi → GỌI detectQualityAnomalies.
13. Nếu người dùng yêu cầu lập báo cáo chất lượng nâng cao, báo cáo tổng hợp theo ngày sản xuất, theo dõi phần trăm hoạt chất chính qua các lô sản xuất → GỌI generateProductionSynthesisReport với productId (và startDate, endDate nếu có). Bắt buộc phải tìm hoặc hỏi productId trước khi gọi tool.
14. [ACTION] Nếu người dùng yêu cầu tạo lô mới ("tạo lô...", "thêm lô...", "đăng ký lô [số lô] cho [tên SP]") → GỌI createBatchAction với thông tin chi tiết.
15. [ACTION] Nếu người dùng yêu cầu xuất hoặc xem Certificate of Analysis ("xuất CoA...", "in phiếu CoA lô X...", "xem CoA lô X") → GỌI exportCoAReportAction với batchNo.
16. [ACTION] Nếu người dùng yêu cầu điều hướng / mở trang ("mở trang sản phẩm...", "dẫn tôi tới lô X", "mở TCCS", "xem PQR", "xem SPC", "kiểm toán ALCOA") → GỌI navigateToAction với destination phù hợp.
17. [ACTION] Nếu người dùng yêu cầu tự động sửa / hàn gắn dữ liệu ("chạy auto-heal", "tự động hàn gắn dữ liệu", "quét và sửa lỗi dữ liệu") → GỌI triggerAutoHealingAction.
18. [ACTION] Nếu người dùng yêu cầu cập nhật trạng thái lô ("duyệt xuất xưởng lô X", "từ chối lô X", "chuyển lô X về kiểm nghiệm") → GỌI updateBatchStatusAction với batchNo, newStatus ('RELEASED' | 'REJECTED' | 'TESTING') và reason.
19. [PREDICTIVE] Nếu người dùng hỏi về rủi ro trước khi kiểm nghiệm lô ("lô X có nguy cơ gì không?", "dự báo rủi ro lô X") → GỌI predictBatchRiskAction với batchNo.
${sessionMemoryPrompt ? sessionMemoryPrompt : ''}
${isThinkingEnabled ? `20. [BẬT THEO CẤU HÌNH] Bạn hãy bắt đầu phản hồi bằng việc phân tích ngắn gọn lý do chọn công cụ hoặc đối chiếu số liệu bên trong cặp thẻ <thinking>...</thinking>. Không tạo chain-of-thought quá dài gây chậm phản hồi.` : ''}`;

    const maxRetries = 2; // Giảm xuống 2 để tránh treo UI lâu (Phase 12)
    let attempt = 0;

    while (attempt < maxRetries) {
      if (options?.signal?.aborted) {
        throw new DOMException('Chat request was aborted during retry loop', 'AbortError');
      }

      try {
        const chat = model.startChat({
          history: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            {
              role: 'model',
              parts: [
                {
                  text: 'Tôi đã hiểu quy tắc và bối cảnh dữ liệu. Tôi sẵn sàng hỗ trợ và sẽ gọi các tool khi cần thiết.',
                },
              ],
            },
            ...history,
          ],
        });

        let accumulatedThinking = '';

        // Gửi tin nhắn đầu tiên
        let result = await chat.sendMessage(message);
        let response = result.response;

        if (options?.signal?.aborted) {
          throw new DOMException('Chat request was aborted after initial response', 'AbortError');
        }

        // Trích xuất suy nghĩ bước 1 nếu có
        try {
          const firstText = response.text();
          if (firstText) {
            const parsed = extractThinking(firstText);
            if (parsed.thinking) {
              accumulatedThinking += (accumulatedThinking ? '\n\n' : '') + parsed.thinking;
            }
          }
        } catch {
          // Bỏ qua nếu response chỉ chứa functionCall
        }

        // ✅ Vòng lặp xử lý Function Calling (Giới hạn tối đa 4 iterations - Phase 13)
        let iterationCount = 0;
        const MAX_TOOL_ITERATIONS = 4;
        let hasCalledAnyTool = false;

        while (
          response.candidates?.[0]?.content?.parts?.some((p: any) => p.functionCall) &&
          iterationCount < MAX_TOOL_ITERATIONS
        ) {
          if (options?.signal?.aborted) {
            throw new DOMException('Chat request was aborted during tool execution', 'AbortError');
          }

          iterationCount++;
          hasCalledAnyTool = true;
          const toolCallParts = response.candidates[0].content.parts;
          const functionResponseParts: any[] = [];

          // Thực thi song song các tool độc lập trong cùng 1 turn (Phase 13)
          const toolExecutions = toolCallParts
            .filter((p: any) => p.functionCall)
            .map(async (part: any) => {
              const toolResult = await executeTool(
                part.functionCall.name,
                part.functionCall.args as Record<string, any>,
                appContextData,
                geminiService.generateText
              );
              return {
                functionResponse: {
                  name: part.functionCall.name,
                  response: { result: toolResult },
                },
              };
            });

          const executedParts = await Promise.all(toolExecutions);
          functionResponseParts.push(...executedParts);

          if (options?.signal?.aborted) {
            throw new DOMException('Chat request was aborted after tool execution', 'AbortError');
          }

          // Gửi kết quả tool về cho model
          result = await chat.sendMessage(functionResponseParts);
          response = result.response;

          // Trích xuất suy nghĩ sau mỗi bước gọi tool nếu có
          try {
            const stepText = response.text();
            if (stepText) {
              const parsed = extractThinking(stepText);
              if (parsed.thinking) {
                accumulatedThinking += (accumulatedThinking ? '\n\n' : '') + parsed.thinking;
              }
            }
          } catch {
            // Có thể chỉ chứa tool call tiếp theo
          }
        }

        // Lấy text cuối cùng từ model và trích xuất suy nghĩ cuối cùng
        let finalResponseText = response.text();
        const finalParsed = extractThinking(finalResponseText);
        if (finalParsed.thinking) {
          accumulatedThinking += (accumulatedThinking ? '\n\n' : '') + finalParsed.thinking;
          finalResponseText = finalParsed.cleanText;
        }

        // ─── Lưu vào Semantic Cache nếu là câu trả lời tra cứu thông thường ───
        if (!hasCalledAnyTool && (!history || history.length === 0)) {
          semanticCache.set(
            { promptId: 'TCCS_ASSISTANT', input: `[${activeModel}] ${message}` },
            { text: finalResponseText, thinking: accumulatedThinking || undefined }
          );
        }

        return {
          text: finalResponseText,
          thinking: accumulatedThinking || undefined,
        };
      } catch (error: any) {
        if (error?.name === 'AbortError' || options?.signal?.aborted) {
          throw error;
        }

        attempt++;
        const errorMessage = error?.message || '';

        // Phân loại retry (Phase 12):
        // KHÔNG retry lỗi 4xx, authentication, safety, hoặc AbortError
        const isQuotaOrOverload =
          errorMessage.includes('503') ||
          errorMessage.includes('429') ||
          errorMessage.includes('RESOURCE_EXHAUSTED') ||
          errorMessage.includes('overloaded');

        if (isQuotaOrOverload && attempt < maxRetries) {
          const jitter = Math.random() * 500;
          const backoff = (errorMessage.includes('429') ? 1500 : 1000) * attempt + jitter;
          console.warn(
            `Gemini API overloaded/429. Retrying attempt ${attempt} in ${Math.round(backoff)}ms...`
          );
          await new Promise((res) => setTimeout(res, backoff));
          continue;
        }

        console.error('Error in chatWithAppContext:', error);
        throw error;
      }
    }
    throw new Error('Gemini Chat: Đã vượt quá số lần thử lại tối đa mà không thành công.');
  },
};
