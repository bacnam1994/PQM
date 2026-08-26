import { GoogleGenerativeAI, SchemaType, Content } from "@google/generative-ai";
import { GEMINI_TOOL_DECLARATIONS, executeTool } from './aiTools';
import type { RenderedPdfPage } from '../../utils/pdfProcessor';

export const getApiKey = (): string => {
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY')?.trim() : '';
  if (localKey) return localKey;
  return import.meta.env.VITE_GEMINI_API_KEY || "";
};

export const formatGeminiError = (error: any): string => {
  const msg = error?.message || String(error || '');
  if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || msg.includes('API_KEY_SERVICE_BLOCKED')) {
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

const getGenAI = () => {
  const key = getApiKey();
  if (!key) {
    throw new Error("Chưa cấu hình Gemini API Key. Vui lòng nhập API Key trong phần Cài đặt hệ thống hoặc file .env của dự án.");
  }
  return new GoogleGenerativeAI(key);
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
    return { valid: false, error: `File quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Giới hạn tối đa là 20MB.` };
  }
  if (!ALLOWED_OCR_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: `Định dạng file không hỗ trợ (${file.type}). Vui lòng upload PDF hoặc ảnh (JPG, PNG, WEBP, HEIC).` };
  }
  return { valid: true };
};

export interface GeminiModelOption {
  id: string;
  name: string;
  badge: string;
  group: 'Gemini 2.5' | 'Gemini 2.0';
  description: string;
}

export const AVAILABLE_GEMINI_MODELS: GeminiModelOption[] = [
  // --- THẾ HỆ GEMINI 2.5 ---
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: '⚡ 2.5 Flash (Tiêu chuẩn)',
    group: 'Gemini 2.5',
    description: 'Mô hình chuẩn cân bằng tốt giữa tốc độ phản hồi và khả năng hiểu ngôn ngữ dược điển.',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    badge: '🔬 2.5 Pro (Suy luận)',
    group: 'Gemini 2.5',
    description: 'Xử lý ngữ cảnh lớn, phân tích dữ liệu chuyên sâu và tính toán thống kê SPC.',
  },
  // --- THẾ HỆ GEMINI 2.0 ---
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    badge: '⚡ 2.0 Flash',
    group: 'Gemini 2.0',
    description: 'Phiên bản tương thích ổn định cho các tác vụ kiểm nghiệm thường quy.',
  },
];

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const getGeminiModel = (): string => {
  return localStorage.getItem('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL;
};

export const getIsThinkingEnabled = (): boolean => {
  const saved = localStorage.getItem('GEMINI_THINKING_ENABLED');
  return saved !== 'false'; // Mặc định là true nếu chưa set
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
      description: "Tên đơn vị kiểm nghiệm / Phòng thí nghiệm. Để rỗng nếu không tìm thấy.",
    },
    documentType: {
      type: SchemaType.STRING,
      description: "Loại phiếu: External_Lab | Internal | CoA | Supplier_CoA",
    },
    pageCount: {
      type: SchemaType.NUMBER,
      description: "Số trang thực tế đã đọc được trong tài liệu (số nguyên dương)",
    },
    batchNo: {
      type: SchemaType.STRING,
      description: "Số lô sản xuất (nếu có, không có thì để rỗng)",
    },
    mfgDate: {
      type: SchemaType.STRING,
      description: "Ngày sản xuất (định dạng DD/MM/YYYY, nếu không có để rỗng)",
    },
    expDate: {
      type: SchemaType.STRING,
      description: "Hạn sử dụng (định dạng DD/MM/YYYY, nếu không có để rỗng)",
    },
    testDate: {
      type: SchemaType.STRING,
      description: "Ngày kiểm nghiệm / Ngày xuất phiếu kết quả (định dạng DD/MM/YYYY, nếu không có để rỗng)",
    },
    notes: {
      type: SchemaType.STRING,
      description: "Ghi chú đặc biệt từ phiếu (ghi chú cuối bảng, phát hiện giá trị sửa tay, ảnh chất lượng thấp...); để rỗng nếu không có",
    },
    testResults: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          criteriaName: {
            type: SchemaType.STRING,
            description: "Tên chỉ tiêu NGUYÊN BẢN từ phiếu (giữ nguyên, không dịch)",
          },
          mappedName: {
            type: SchemaType.STRING,
            description: "Tên chỉ tiêu chuẩn trong TCCS nếu map được, để rỗng nếu không chắc",
          },
          confidence: {
            type: SchemaType.STRING,
            description: "'high' nếu map được tên TCCS chắc chắn, 'low' nếu không chắc hoặc không tìm được",
          },
          value: {
            type: SchemaType.STRING,
            description: "Kết quả kiểm nghiệm (ví dụ: 1.5, Đạt, Trắng trong). Trả về dưới dạng chuỗi.",
          },
          unit: {
            type: SchemaType.STRING,
            description: "Đơn vị tính (ví dụ: %, mg, CFU/g. Nếu không có để rỗng)",
          },
          limit: {
            type: SchemaType.STRING,
            description: "Yêu cầu / Mức tiêu chuẩn / Giới hạn cho phép (nếu có)",
          },
          analysisMethod: {
            type: SchemaType.STRING,
            description: "Phương pháp thử nghiệm nếu ghi trên phiếu (ví dụ: HPLC, UV-Vis, TCVN...); để rỗng nếu không có",
          },
        },
        required: ["criteriaName", "value", "mappedName", "confidence"],
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
        responseMimeType: "application/json",
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
      onProgress?.("AI đang phân tích tài liệu...", progressBase + 15 + attempt * 10);

      // Gửi prompt cùng tất cả image parts lên Gemini API
      const result = await model.generateContent([systemPrompt, ...contentParts]);
      const response = result.response;
      const text = response.text();

      return JSON.parse(text);
    } catch (error: any) {
      attempt++;
      const errorMessage = error?.message || '';
      const backoffMs = Math.pow(2, attempt) * 1000;

      if ((errorMessage.includes('503') || errorMessage.includes('429')) && !useFallback && attempt < maxRetries) {
        console.warn(`Gemini OCR overloaded. Switching to fallback '${FALLBACK_OCR_MODEL}' (attempt ${attempt})...`);
        useFallback = true;
        onProgress?.(`Model bị quá tải, đang thử lại với model dự phòng...`, progressBase + 5);
        await new Promise((res) => setTimeout(res, backoffMs));
        continue;
      }
      if ((errorMessage.includes('503') || errorMessage.includes('429')) && attempt < maxRetries) {
        console.warn(`Gemini OCR fallback overloaded. Retrying attempt ${attempt} in ${backoffMs}ms...`);
        onProgress?.(`Đang thử lại (lần ${attempt})...`, progressBase + 10);
        await new Promise((res) => setTimeout(res, backoffMs));
        continue;
      }

      console.error("Error calling Gemini API:", error);
      throw error;
    }
  }
  throw new Error("Gemini OCR: Đã vượt quá số lần thử lại tối đa mà không thành công.");
}

export const geminiService = {
  /**
   * Gọi API Gemini để phân tích file tài liệu (ảnh hoặc PDF) – đơn file.
   * ĐẶC BIỆT: Đối với file PDF, tự động chuyển đổi từng trang thành ảnh JPEG tối ưu (1600px)
   * và phân đoạn (chunking 3 trang/lần) nếu file nhiều trang, loại bỏ 100% lỗi quá tải / timeout của Gemini.
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
    const genAI = getGenAI();

    // ─── TRƯỜNG HỢP 1: FILE PDF ────────────────────────────────────────────────
    if (file.type === 'application/pdf') {
      try {
        onProgress?.("Đang tối ưu & phân tích cấu trúc PDF...", 10);

        // Render từng trang PDF sang ảnh JPEG tối ưu bằng Canvas
        const { convertPdfToImages } = await import('../../utils/pdfProcessor');
        const renderedPages: RenderedPdfPage[] = await convertPdfToImages(file, {
          targetWidth: 1600,
          quality: 0.85,
          maxPages: 50,
          onProgress: (current, total) => {
            onProgress?.(`Đang xử lý trang PDF ${current}/${total}...`, Math.round(10 + (current / total) * 20));
          },
        });

        const totalPages = renderedPages.length;
        if (totalPages === 0) {
          throw new Error("Không thể đọc được trang nào từ file PDF này.");
        }

        // Nếu PDF ngắn (1 - 3 trang): Gửi tất cả trang trong 1 request duy nhất
        if (totalPages <= 3) {
          onProgress?.(`Đang gửi ${totalPages} trang lên AI phân tích...`, 35);
          const imageParts = renderedPages.map((page) => ({
            inlineData: {
              data: page.base64,
              mimeType: 'image/jpeg',
            },
          }));

          const result = await executeGeminiOcrCall(genAI, systemPrompt, imageParts, onProgress, 40);
          result.pageCount = totalPages;
          onProgress?.("Hoàn tất!", 100);
          return result;
        }

        // Nếu PDF dài (> 3 trang): Tự động chia theo đợt (Chunk 3 trang/lượt) để tránh tràn token / timeout
        const CHUNK_SIZE = 3;
        const chunks: RenderedPdfPage[][] = [];
        for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
          chunks.push(renderedPages.slice(i, i + CHUNK_SIZE));
        }

        const chunkResults: any[] = [];
        for (let idx = 0; idx < chunks.length; idx++) {
          const chunk = chunks[idx];
          const startPage = idx * CHUNK_SIZE + 1;
          const endPage = Math.min(startPage + chunk.length - 1, totalPages);
          const chunkPercentBase = Math.round(35 + (idx / chunks.length) * 55);

          onProgress?.(
            `Đang đọc PDF (${totalPages} trang) – Đợt ${idx + 1}/${chunks.length} (Trang ${startPage}-${endPage})...`,
            chunkPercentBase
          );

          const imageParts = chunk.map((page) => ({
            inlineData: {
              data: page.base64,
              mimeType: 'image/jpeg',
            },
          }));

          try {
            const chunkRes = await executeGeminiOcrCall(genAI, systemPrompt, imageParts, onProgress, chunkPercentBase);
            chunkResults.push(chunkRes);
          } catch (chunkErr) {
            console.warn(`Lỗi khi đọc đợt ${idx + 1} (Trang ${startPage}-${endPage}):`, chunkErr);
            // Nếu là đợt đầu tiên mà lỗi thì ném ra, nếu đợt sau lỗi thì vẫn giữ kết quả đợt trước
            if (chunkResults.length === 0 && idx === chunks.length - 1) {
              throw chunkErr;
            }
          }
        }

        if (chunkResults.length === 0) {
          throw new Error("Không thể trích xuất dữ liệu từ các trang của file PDF.");
        }

        // Gộp kết quả thông minh từ các đợt
        const firstResult = chunkResults[0] || {};
        const mergedTestResults: any[] = [];
        const seenCriteriaKeys = new Set<string>();

        const allNotes: string[] = [];

        for (const res of chunkResults) {
          if (res.notes && !allNotes.includes(res.notes)) {
            allNotes.push(res.notes);
          }
          for (const item of res.testResults || []) {
            const key = (item.mappedName || item.criteriaName || '').toLowerCase().trim();
            if (key && !seenCriteriaKeys.has(key)) {
              seenCriteriaKeys.add(key);
              mergedTestResults.push(item);
            } else if (!key) {
              mergedTestResults.push(item);
            }
          }
        }

        const mergedFinalResult = {
          labName: chunkResults.find((r) => r.labName)?.labName || firstResult.labName || '',
          documentType: chunkResults.find((r) => r.documentType)?.documentType || firstResult.documentType || 'External_Lab',
          pageCount: totalPages,
          batchNo: chunkResults.find((r) => r.batchNo)?.batchNo || firstResult.batchNo || '',
          mfgDate: chunkResults.find((r) => r.mfgDate)?.mfgDate || firstResult.mfgDate || '',
          expDate: chunkResults.find((r) => r.expDate)?.expDate || firstResult.expDate || '',
          testDate: chunkResults.find((r) => r.testDate)?.testDate || firstResult.testDate || '',
          notes: allNotes.filter(Boolean).join(' | ') || firstResult.notes || '',
          testResults: mergedTestResults,
        };

        onProgress?.("Hoàn tất!", 100);
        return mergedFinalResult;
      } catch (pdfError: any) {
        console.warn("Lỗi khi xử lý PDF qua Canvas, chuyển sang phương thức gửi file gốc:", pdfError);
        // Fallback: Nếu lỗi Canvas hoặc PDF đặc thù, tiếp tục với phương thức gửi file Base64 truyền thống bên dưới
      }
    }

    // ─── TRƯỜNG HỢP 2: FILE ẢNH HOẶC FALLBACK FILE GỐC ─────────────────────────
    onProgress?.("Đang đọc file...", 10);

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

    onProgress?.("Đang gửi lên AI...", 30);

    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: file.type,
      },
    };

    const result = await executeGeminiOcrCall(genAI, systemPrompt, [filePart], onProgress, 40);
    onProgress?.("Hoàn tất!", 100);
    return result;
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
            onFileProgress?.(index, file.name, 'processing', { _progressStep: _step, _progressPercent: _percent });
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
    const results = await Promise.all(tasks.map(t => t()));

    const success = results.filter(r => r.ok).map(r => (r as any).data);
    const errors = results
      .filter(r => !r.ok)
      .map(r => ({ fileName: (r as any).fileName, error: (r as any).error }));

    return { success, errors };
  },

  /**
   * Gọi API sinh văn bản đơn giản (không có tools) từ Gemini.
   * Dùng cho các tác vụ phân tích tự động như RCA, FMEA.
   * @param prompt Nội dung yêu cầu phân tích
   * @param systemPrompt Lệnh định hướng hệ thống
   */
  generateText: async (prompt: string, systemPrompt?: string, modelName?: string): Promise<string> => {
    const genAI = getGenAI();
    const activeModel = modelName || getGeminiModel();
    const model = genAI.getGenerativeModel({
      model: activeModel,
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {})
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  },

  /**
   * Tính năng Chat bằng Text với dữ liệu ngữ cảnh của toàn bộ ứng dụng hỗ trợ Multi-turn + Function Calling
   * @param message Tin nhắn câu hỏi của người dùng
   * @param appContextData Object chứa toàn bộ dữ liệu ứng dụng
   * @param history Lịch sử đoạn chat trước đó để hỗ trợ Multi-turn
   */
  chatWithAppContext: async (message: string, appContextData: any, history: Content[] = [], modelName?: string, sessionMemoryPrompt?: string) => {
    const genAI = getGenAI();
    const activeModel = modelName || getGeminiModel();
    const isThinkingEnabled = getIsThinkingEnabled();

    const model = genAI.getGenerativeModel({
      model: activeModel,
      tools: [{ functionDeclarations: GEMINI_TOOL_DECLARATIONS as any }],
    });

    // [SMART CONTEXT BUILDER] Phân tích câu hỏi để xác định data liên quan
    // Thay vì cắt cứng 50 records, ưu tiên data có liên quan đến từ khóa trong message
    const buildSmartContext = (msg: string, data: any) => {
      const msgLower = msg.toLowerCase();

      const products = data.products || [];
      const batches = data.batches || [];
      const tccsList = data.tccsList || [];
      const testResults = data.testResults || [];

      // Bước 1: Tìm sản phẩm/lô được đề cập trong câu hỏi
      const mentionedProducts = products.filter((p: any) =>
        p.name && msgLower.includes(p.name.toLowerCase()) ||
        p.code && msgLower.includes(p.code.toLowerCase())
      );
      const mentionedBatches = batches.filter((b: any) =>
        b.batchNo && msgLower.includes(b.batchNo.toLowerCase())
      );

      const mentionedProductIds = new Set([
        ...mentionedProducts.map((p: any) => p.id),
        ...mentionedBatches.map((b: any) => b.productId)
      ]);

      // Bước 2: Nếu có sản phẩm cụ thể được đề cập → trả về đầy đủ data của sản phẩm đó
      if (mentionedProductIds.size > 0) {
        const relevantBatches = batches.filter((b: any) => mentionedProductIds.has(b.productId));
        const relevantBatchIds = new Set(relevantBatches.map((b: any) => b.id));
        const relevantTestResults = testResults.filter((tr: any) => relevantBatchIds.has(tr.batchId));
        const relevantTccs = tccsList.filter((t: any) => mentionedProductIds.has(t.productId));

        return {
          _note: `Context ưu tiên: ${mentionedProductIds.size} sản phẩm được đề cập trong câu hỏi`,
          products: mentionedProducts.map((p: any) => ({ id: p.id, code: p.code, name: p.name, status: p.status })),
          allProducts_summary: `Tổng ${products.length} sản phẩm. Đang hiển thị ${mentionedProducts.length} sản phẩm liên quan.`,
          batches: relevantBatches.map((b: any) => ({ id: b.id, batchNo: b.batchNo, productId: b.productId, status: b.status, mfg: b.mfgDate, exp: b.expDate })),
          tccs: relevantTccs.map((t: any) => ({ id: t.id, code: t.code, isActive: t.isActive, issueDate: t.issueDate, productId: t.productId })),
          testResults: relevantTestResults.map((tr: any) => ({ id: tr.id, lab: tr.labName, date: tr.testDate, status: tr.overallStatus, batchId: tr.batchId })),
        };
      }

      // Bước 3: Nếu không tìm thấy sản phẩm cụ thể → context tổng hợp thông minh
      // Ưu tiên 20 records mới nhất của mỗi loại + tóm tắt tổng số
      const MAX_GENERAL = 20;
      return {
        _note: 'Context tổng hợp: không có sản phẩm cụ thể được đề cập',
        products: products.slice(0, MAX_GENERAL).map((p: any) => ({ id: p.id, code: p.code, name: p.name, status: p.status })),
        products_total: products.length,
        batches: batches.slice(0, MAX_GENERAL).map((b: any) => ({ id: b.id, batchNo: b.batchNo, productId: b.productId, status: b.status, mfg: b.mfgDate, exp: b.expDate })),
        batches_total: batches.length,
        tccs: tccsList.slice(0, MAX_GENERAL).map((t: any) => ({ code: t.code, isActive: t.isActive, issueDate: t.issueDate, productId: t.productId })),
        testResults: testResults.slice(0, MAX_GENERAL).map((tr: any) => ({ id: tr.id, lab: tr.labName, date: tr.testDate, status: tr.overallStatus, batchId: tr.batchId })),
        testResults_total: testResults.length,
      };
    };

    const smartContext = buildSmartContext(message, appContextData);

    const systemPrompt = `Bạn là Trợ lý AI chuyên môn của phần mềm V-BIOTECH Quality Management (Quản lý Chất lượng Dược phẩm).
Nhiệm vụ: Trả lời câu hỏi dựa trên DỮ LIỆU THỰC của ứng dụng và GỌI CÁC TOOL khi cần phân tích sâu hơn.

DỮ LIỆU ỨNG DỤNG HIỆN TẠI (JSON):
${JSON.stringify(smartContext, null, 2)}

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
${sessionMemoryPrompt ? sessionMemoryPrompt : ""}
${isThinkingEnabled ? `14. [QUAN TRỌNG - BẮT BUỘC] Bạn phải luôn bắt đầu phản hồi của mình bằng việc lập luận chi tiết quy trình suy nghĩ và phân tích dữ liệu bên trong cặp thẻ <thinking>...</thinking> (ví dụ: giải thích tại sao bạn chọn hành động hay quyết định gọi tool nào, đối chiếu số liệu thế nào). Chỉ đưa ra câu trả lời chính thức hoặc định dạng markdown cho người dùng bên ngoài cặp thẻ <thinking>...</thinking>. Không được hiển thị thẻ <thinking> trong markdown code blocks.` : ''}`;

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const chat = model.startChat({
          history: [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "Tôi đã hiểu quy tắc và bối cảnh dữ liệu. Tôi sẵn sàng hỗ trợ và sẽ gọi các tool khi cần thiết." }] },
            ...history
          ],
        });

        let accumulatedThinking = "";

        // Gửi tin nhắn đầu tiên
        let result = await chat.sendMessage(message);
        let response = result.response;

        // Trích xuất suy nghĩ bước 1 nếu có
        try {
          const firstText = response.text();
          if (firstText) {
            const parsed = extractThinking(firstText);
            if (parsed.thinking) {
              accumulatedThinking += (accumulatedThinking ? "\n\n" : "") + parsed.thinking;
            }
          }
        } catch (e) {
          // Bỏ qua nếu response chỉ chứa functionCall
        }

        // ✅ Vòng lặp xử lý Function Calling
        // Gemini có thể gọi nhiều tool liên tiếp trước khi trả về văn bản cuối cùng
        let iterationCount = 0;
        const MAX_TOOL_ITERATIONS = 5; // Giới hạn để tránh vòng lặp vô tận

        while (response.candidates?.[0]?.content?.parts?.some((p: any) => p.functionCall) && iterationCount < MAX_TOOL_ITERATIONS) {
          iterationCount++;
          const toolCallParts = response.candidates[0].content.parts;
          const functionResponseParts: any[] = [];

          // Thực thi tất cả tool calls trong response hiện tại
          for (const part of toolCallParts) {
            if (part.functionCall) {
              const toolResult = await executeTool(
                part.functionCall.name,
                part.functionCall.args as Record<string, any>,
                appContextData, // Truyền dữ liệu thật, không phải leanContext
                geminiService.generateText
              );

              functionResponseParts.push({
                functionResponse: {
                  name: part.functionCall.name,
                  response: { result: toolResult }
                }
              });
            }
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
                accumulatedThinking += (accumulatedThinking ? "\n\n" : "") + parsed.thinking;
              }
            }
          } catch (e) {
            // Có thể chỉ chứa tool call tiếp theo
          }
        }

        // Lấy text cuối cùng từ model và trích xuất suy nghĩ cuối cùng
        let finalResponseText = response.text();
        const finalParsed = extractThinking(finalResponseText);
        if (finalParsed.thinking) {
          accumulatedThinking += (accumulatedThinking ? "\n\n" : "") + finalParsed.thinking;
          finalResponseText = finalParsed.cleanText;
        }

        return {
          text: finalResponseText,
          thinking: accumulatedThinking || undefined
        };

      } catch (error: any) {
        attempt++;
        const errorMessage = error?.message || '';

        // Chỉ retry với lỗi quá tải (503) hoặc rate limit (429)
        if ((errorMessage.includes('503') || errorMessage.includes('429')) && attempt < maxRetries) {
          console.warn(`Gemini API overloaded. Retrying attempt ${attempt}...`);
          await new Promise(res => setTimeout(res, 2000 * attempt));
          continue;
        }

        console.error("Error in chatWithAppContext:", error);
        throw error;
      }
    }
    // Sau vòng while, ném lỗi rõ ràng thay vì trả về undefined im lặng
    throw new Error("Gemini Chat: Đã vượt quá số lần thử lại tối đa mà không thành công.");
  }
};
