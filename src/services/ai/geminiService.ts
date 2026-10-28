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
  FALLBACK_GEMINI_MODEL,
  getValidGeminiModel,
  type GeminiModelOption,
  getApiKey,
  hasClientApiKey,
  saveClientApiKey,
  clearClientApiKey,
  getGeminiModel,
  formatGeminiError,
  getThinkingConfigForModel,
} from './aiConfig';
import { perfTelemetry } from '../../utils/perfTelemetry';

export {
  AVAILABLE_GEMINI_MODELS,
  DEFAULT_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  getValidGeminiModel,
  type GeminiModelOption,
  getApiKey,
  hasClientApiKey,
  saveClientApiKey,
  clearClientApiKey,
  getGeminiModel,
  formatGeminiError,
  getThinkingConfigForModel,
};

export const testClientGeminiConnection = async (
  candidateKey?: string,
  modelName?: string
): Promise<{ latencyMs: number; model: string }> => {
  const key = candidateKey ? candidateKey.trim() : getApiKey();
  if (!key) {
    throw new Error('Vui lòng nhập API Key để kiểm tra kết nối.');
  }

  const activeModel = modelName ? getValidGeminiModel(modelName) : getGeminiModel();
  const genAI = await createGoogleGenerativeAI(key);
  const thinkingCfg = getThinkingConfigForModel(activeModel, false);
  const model = genAI.getGenerativeModel({
    model: activeModel,
    generationConfig: {
      maxOutputTokens: 10,
      ...(thinkingCfg || {}),
    },
  });

  const start = Date.now();
  try {
    const result = await model.generateContent('Ping. Trả lời "OK".');
    const response = await result.response;
    response.text();
    const latencyMs = Date.now() - start;
    return { latencyMs, model: activeModel };
  } catch (err: any) {
    throw new Error(formatGeminiError(err));
  }
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
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage =
    file.type.startsWith('image/') ||
    /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name) ||
    ALLOWED_OCR_MIME_TYPES.includes(file.type);

  if (!isPdf && !isImage) {
    return {
      valid: false,
      error: `Định dạng file không hỗ trợ (${file.type || 'không rõ'}). Vui lòng upload PDF hoặc ảnh (JPG, PNG, WEBP, HEIC).`,
    };
  }
  return { valid: true };
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
    reportNo: {
      type: SchemaType.STRING,
      description:
        'Số hiệu phiếu kiểm nghiệm / Số kết quả phân tích / Report No / Số PKN đọc được từ phiếu scan (nếu có, không có thì để rỗng)',
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
const FALLBACK_OCR_MODEL = FALLBACK_GEMINI_MODEL;

// ─── Helper gọi Gemini OCR với danh sách inlineData parts ─────────────────────
async function executeGeminiOcrCall(
  genAI: GoogleGenerativeAI,
  systemPrompt: string,
  contentParts: Array<{ inlineData: { data: string; mimeType: string } } | string>,
  onProgress?: (step: string, percent: number) => void,
  progressBase: number = 30
): Promise<any> {
  const primaryModelName = getGeminiModel();
  const buildModel = (modelName: string) => {
    const thinkingCfg = getThinkingConfigForModel(modelName, false);
    return genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: OCR_RESPONSE_SCHEMA as any,
        ...(thinkingCfg || {}),
      },
    });
  };

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

      // Thêm timeout guard 25s để tránh treo vĩnh viễn nếu Google gặp tải cao
      const timeoutMs = 25000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('TIMEOUT_EXCEEDED: Quá 25s chờ phản hồi từ máy chủ Google')),
          timeoutMs
        )
      );

      const result: any = await Promise.race([
        model.generateContent([systemPrompt, ...contentParts]),
        timeoutPromise,
      ]);
      const response = result.response;
      const text = response.text();

      return JSON.parse(text);
    } catch (error: any) {
      attempt++;
      const errorMessage = error?.message || '';
      const backoffMs = Math.pow(2, attempt) * 1000;

      const isFallbackTrigger =
        errorMessage.includes('TIMEOUT_EXCEEDED') ||
        errorMessage.includes('503') ||
        errorMessage.includes('429') ||
        errorMessage.includes('404') ||
        errorMessage.includes('not found') ||
        errorMessage.includes('is not supported');

      if (isFallbackTrigger && !useFallback && attempt < maxRetries) {
        console.warn(
          `Gemini OCR error (${errorMessage}). Switching to fallback '${FALLBACK_OCR_MODEL}' (attempt ${attempt})...`
        );
        useFallback = true;
        onProgress?.(
          `Model gặp sự cố/quá tải, đang chuyển sang model dự phòng (${FALLBACK_OCR_MODEL})...`,
          progressBase + 5
        );
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
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      // ─── TRƯỜNG HỢP 1: FILE PDF ──────────────────────────────────────────────
      if (isPdf) {
        try {
          onProgress?.('Đang phân tích cấu trúc PDF và nhận diện text layer...', 10);

          // Phase 1: Phân tích cấu trúc tài liệu bằng pdfAnalyzer
          let analysisReport: import('../ocr/types').PdfAnalysisReport | null = null;
          try {
            const { analyzePdf } = await import('../ocr/pdfAnalyzer');
            analysisReport = await analyzePdf(file);
          } catch (analyzerError) {
            console.warn(
              '[PDF Pipeline] Phân tích PDF thất bại, chuyển sang chế độ dự phòng quét ảnh:',
              analyzerError
            );
          }

          let pageInputs: import('../ocr/types').PageExtractionInput[] = [];
          const docType = analysisReport?.documentType || 'SCANNED_IMAGE';

          if (analysisReport && analysisReport.documentType === 'NATIVE_TEXT') {
            // Nhánh 1: NATIVE_TEXT - Trích xuất văn bản trực tiếp từ Text Stream (KHÔNG render Canvas)
            onProgress?.(
              `Phát hiện tài liệu điện tử gốc (${analysisReport.pageCount} trang). Đang trích xuất text trực tiếp...`,
              20
            );
            pageInputs = analysisReport.pages.map((p) => ({
              pageNumber: p.pageNumber,
              isNativeText: true,
              textContent: p.fullText || p.sampleText,
              base64: '',
            }));
          } else if (analysisReport && analysisReport.documentType === 'MIXED_PDF') {
            // Nhánh 2: MIXED_PDF - Xử lý lai kết hợp theo từng trang
            onProgress?.(
              `Phát hiện tài liệu hỗn hợp (${analysisReport.pageCount} trang). Đang xử lý kết hợp text & OCR...`,
              15
            );

            // Chỉ render những trang SCANNED hoặc thiếu text
            const scannedPageNumbers = analysisReport.pages
              .filter((p) => !p.isTextUsable)
              .map((p) => p.pageNumber);

            const { convertPdfToImages } = await import('../../utils/pdfProcessor');
            const renderedScannedPages =
              scannedPageNumbers.length > 0
                ? await convertPdfToImages(file, {
                    targetDpi: 200,
                    format: 'image/jpeg',
                    quality: 0.9,
                    pageNumbers: scannedPageNumbers,
                    maxPages: 50,
                  })
                : [];

            const renderedMap = new Map(renderedScannedPages.map((r) => [r.pageNumber, r]));

            pageInputs = analysisReport.pages.map((p) => {
              if (p.isTextUsable) {
                return {
                  pageNumber: p.pageNumber,
                  isNativeText: true,
                  textContent: p.fullText || p.sampleText,
                  base64: '',
                };
              } else {
                const rendered = renderedMap.get(p.pageNumber);
                return {
                  pageNumber: p.pageNumber,
                  isNativeText: false,
                  base64: rendered?.base64 || '',
                  mimeType: rendered?.mimeType || 'image/jpeg',
                  width: rendered?.width,
                  height: rendered?.height,
                };
              }
            });
          } else {
            // Nhánh 3: SCANNED_IMAGE hoặc Fallback khi Analyzer lỗi
            onProgress?.('Đang kết xuất trang PDF tối ưu (200 DPI JPEG)...', 15);
            const { convertPdfToImages } = await import('../../utils/pdfProcessor');
            const renderedPages = await convertPdfToImages(file, {
              targetDpi: 200,
              format: 'image/jpeg',
              quality: 0.9,
              maxPages: 50,
              onProgress: (current, total) => {
                onProgress?.(
                  `Đang xử lý trang PDF ${current}/${total}...`,
                  Math.round(15 + (current / total) * 15)
                );
              },
            });

            pageInputs = renderedPages.map((r) => ({
              pageNumber: r.pageNumber,
              isNativeText: false,
              base64: r.base64,
              mimeType: r.mimeType || 'image/jpeg',
              width: r.width,
              height: r.height,
            }));
          }

          const totalPages = pageInputs.length;
          if (totalPages === 0) {
            throw new Error('Không thể đọc được trang nào từ file PDF này.');
          }

          // Per-Page Extraction & Context Tracking
          const { extractAllPagesSequentially } = await import('../ocr/pageExtractor');
          const mergedFinalResult = await extractAllPagesSequentially(
            pageInputs,
            systemPrompt,
            async (decoratedPrompt, page) => {
              if (page.isNativeText && page.textContent) {
                // Gửi nội dung text trực tiếp lên Gemini
                const textPart = `\n\n--- [NỘI DUNG VĂN BẢN ĐIỆN TỬ BÓC TÁCH TỪ TRANG ${page.pageNumber}/${totalPages}] ---\n${page.textContent}\n--- [HẾT NỘI DUNG TRANG ${page.pageNumber}] ---`;
                return await executeGeminiOcrCall(
                  genAI,
                  decoratedPrompt,
                  [textPart],
                  onProgress,
                  35
                );
              } else {
                const imagePart = {
                  inlineData: {
                    data: page.base64 || '',
                    mimeType: (page.mimeType as any) || 'image/jpeg',
                  },
                };
                return await executeGeminiOcrCall(
                  genAI,
                  decoratedPrompt,
                  [imagePart],
                  onProgress,
                  35
                );
              }
            },
            {
              continueOnPageError: true,
              maxRetriesPerPage: 2,
              maxConcurrency: 2,
              onPageProgress: (current, total, stepText) => {
                const percent = Math.round(30 + (current / total) * 65);
                onProgress?.(stepText, percent);
              },
            }
          );

          if (
            mergedFinalResult &&
            Array.isArray(mergedFinalResult.testResults) &&
            mergedFinalResult.testResults.length > 0
          ) {
            mergedFinalResult.documentType = docType;
            onProgress?.('Hoàn tất!', 100);
            return mergedFinalResult;
          }

          console.warn(
            '[PDF Pipeline] Bóc tách từng trang không tìm thấy kết quả hoặc thất bại, tự động chuyển sang chế độ phân tích file tài liệu trực tiếp...'
          );
        } catch (pdfError: any) {
          console.warn(
            'Lỗi khi xử lý PDF qua Pipeline tối ưu, chuyển sang phương thức gửi file gốc:',
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

      const fileMimeType = file.type || (isPdf ? 'application/pdf' : 'image/jpeg');

      const filePart = {
        inlineData: {
          data: base64Data,
          mimeType: fileMimeType,
        },
      };

      const result = await executeGeminiOcrCall(genAI, systemPrompt, [filePart], onProgress, 40);
      result.pageCount = result.pageCount || 1;
      if (Array.isArray(result?.testResults)) {
        result.testResults = result.testResults.map((it: any) => ({
          ...it,
          sourcePageNumber: it.sourcePageNumber || 1,
        }));
      }

      if (Array.isArray(result?.testResults) && result.testResults.length > 0) {
        onProgress?.('Hoàn tất!', 100);
        return result;
      }

      // Nếu cả hai phương thức đều không tìm thấy chỉ tiêu
      throw new Error(
        'Không tìm thấy hoặc không nhận diện được bảng kết quả kiểm nghiệm từ tài liệu này. Vui lòng kiểm tra lại chất lượng file hoặc nhập kết quả thủ công.'
      );
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
    const primaryModel = modelName ? getValidGeminiModel(modelName) : getGeminiModel();
    let currentModel = primaryModel;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          model: currentModel,
          ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (err: any) {
        const msg = String(err?.message || '');
        const isFallbackTrigger =
          msg.includes('404') ||
          msg.includes('not found') ||
          msg.includes('is not supported') ||
          msg.includes('429') ||
          msg.includes('503');

        if (isFallbackTrigger && currentModel !== FALLBACK_GEMINI_MODEL && attempt < maxRetries) {
          console.warn(
            `[generateText] Model ${currentModel} gặp sự cố. Chuyển sang fallback ${FALLBACK_GEMINI_MODEL}...`
          );
          currentModel = FALLBACK_GEMINI_MODEL;
          await new Promise((res) => setTimeout(res, 1000));
          continue;
        }
        if (attempt === maxRetries) throw err;
      }
    }
    throw new Error('generateText: Đã vượt quá số lần thử lại tối đa.');
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
    _unusedSamplingParam?: number
  ): Promise<T> => {
    const genAI = await getGenAI();
    const primaryModel = modelName ? getValidGeminiModel(modelName) : getGeminiModel();
    let currentModel = primaryModel;

    const buildModel = (targetModel: string) => {
      const thinkingCfg = getThinkingConfigForModel(targetModel, false);
      return genAI.getGenerativeModel({
        model: targetModel,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema as any,
          ...(thinkingCfg || {}),
        },
        ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
      });
    };

    const maxRetries = 2;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const model = buildModel(currentModel);
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        return JSON.parse(text) as T;
      } catch (error: any) {
        attempt++;
        const errorMessage = error?.message || '';
        const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 300;

        const isFallbackTrigger =
          errorMessage.includes('404') ||
          errorMessage.includes('not found') ||
          errorMessage.includes('is not supported') ||
          errorMessage.includes('503') ||
          errorMessage.includes('429');

        if (isFallbackTrigger && currentModel !== FALLBACK_GEMINI_MODEL && attempt < maxRetries) {
          console.warn(
            `[generateStructuredJson] Model ${currentModel} gặp sự cố. Chuyển sang fallback '${FALLBACK_GEMINI_MODEL}' (attempt ${attempt})...`
          );
          currentModel = FALLBACK_GEMINI_MODEL;
          await new Promise((res) => setTimeout(res, backoffMs));
          continue;
        }

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

    // ─── TỐI ƯU HÓA NGỮ CẢNH: Context Resolver Siêu nhẹ ─────────────────
    const leanContext = resolveLeanContext(message, appContextData);

    // Tính toán Entity Identity & Data Version Hash cho Semantic Cache (Phase 3)
    let entityId = 'general';
    let dataVersionHash = '';

    if (leanContext._contextType === 'SPECIFIC_BATCH' && leanContext.batch) {
      entityId = `batch:${leanContext.batch.id || leanContext.batch.batchNo}`;
      dataVersionHash = [
        leanContext.batch.status,
        leanContext.batch.actualYield,
        leanContext.testResult?.id,
        leanContext.testResult?.overallStatus,
        leanContext.testResult?.reportNo,
        leanContext.tccs?.code,
        (leanContext.relevantAlerts || []).length,
      ]
        .filter(Boolean)
        .join('|');
    } else if (leanContext._contextType === 'SPECIFIC_PRODUCT' && leanContext.product) {
      entityId = `product:${leanContext.product.id || leanContext.product.code}`;
      dataVersionHash = [
        leanContext.product.status,
        (leanContext.recentBatches || []).map((b) => `${b.batchNo}:${b.status}`).join(','),
      ]
        .filter(Boolean)
        .join('|');
    } else {
      entityId = 'overview';
      dataVersionHash = [
        leanContext.systemOverview?.totalProducts,
        leanContext.systemOverview?.totalBatches,
        (leanContext.recentBatches || []).map((b) => `${b.batchNo}:${b.status}`).join(','),
      ]
        .filter(Boolean)
        .join('|');
    }

    const promptVersion = 'prompt-v22';

    // ─── TẦNG CACHE AI (Phase 3 Hardening): Kiểm tra Semantic Cache kết hợp Domain Binding ───
    if (!options?.bypassCache && (!history || history.length === 0)) {
      const cached = semanticCache.get<{ text: string; thinking?: string }>({
        promptId: 'AI_ASSISTANT',
        promptVersion,
        model: activeModel,
        entityId,
        dataVersionHash,
        input: message,
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
    const thinkingCfg = getThinkingConfigForModel(activeModel, isThinkingEnabled);

    const model = genAI.getGenerativeModel({
      model: activeModel,
      generationConfig: (thinkingCfg || undefined) as any,
      tools: [{ functionDeclarations: GEMINI_TOOL_DECLARATIONS as any }],
    });

    const systemPrompt = `Bạn là Trợ lý AI chuyên môn của phần mềm V-BIOTECH Quality Management (Quản lý Chất lượng Dược phẩm).
Nhiệm vụ: Trả lời câu hỏi dựa trên DỮ LIỆU THỰC của ứng dụng và GỌI CÁC TOOL khi cần phân tích sâu hơn.

DỮ LIỆU NGỮ CẢNH TRỌNG TÂM (JSON):
${JSON.stringify(leanContext, null, 2)}

QUY TẮC:
1. LUÔN dựa vào dữ liệu JSON để trả lời. Không bịa đặt thông tin.
2. Trả lời bằng Tiếng Việt, NGẮN GỌN, SÚC TÍCH, đi thẳng vào đúng câu hỏi của người dùng. Chỉ trả lời những gì được hỏi, KHÔNG tự ý liệt kê thêm thông tin thừa hoặc chào hỏi dài dòng.
3. Sử dụng Markdown (in đậm, danh sách ngắn) để câu trả lời rõ ràng, dễ đọc.
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

        const reqStartTime = performance.now();
        perfTelemetry.record('AI_REQUEST_START', { model: activeModel, promptId: 'AI_ASSISTANT' });

        // Gửi tin nhắn đầu tiên
        let result = await chat.sendMessage(message);
        let response = result.response;
        const firstRespDuration = performance.now() - reqStartTime;
        perfTelemetry.record('AI_FIRST_RESPONSE', {
          model: activeModel,
          durationMs: firstRespDuration,
          promptId: 'AI_ASSISTANT',
        });

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
          perfTelemetry.record('AI_TOOL', {
            model: activeModel,
            details: { iteration: iterationCount },
          });
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

        const totalDuration = performance.now() - reqStartTime;
        perfTelemetry.record('AI_FINAL_RESPONSE', {
          model: activeModel,
          durationMs: totalDuration,
          promptId: 'AI_ASSISTANT',
        });

        // ─── Lưu vào Semantic Cache nếu là câu trả lời tra cứu thông thường ───
        if (!hasCalledAnyTool && (!history || history.length === 0)) {
          semanticCache.set(
            {
              promptId: 'AI_ASSISTANT',
              promptVersion,
              model: activeModel,
              entityId,
              dataVersionHash,
              input: message,
            },
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
