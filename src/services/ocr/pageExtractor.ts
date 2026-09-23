/**
 * src/services/ocr/pageExtractor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Module bóc tách dữ liệu từng trang độc lập kèm bảo tồn ngữ cảnh (OCR-05: Per-Page Extraction & Context Tracking).
 * Tuân thủ quy tắc bất biến:
 * - Rule 7: Preserve Source Page Index — Mọi chỉ tiêu đều gắn chặt với sourcePageNumber.
 * - Rule 8: Zero Loss Across Multi-page — Không bỏ sót dữ liệu khi PKN có nhiều trang.
 * - Rule 9: Raw OCR Preservation — Lưu giữ nguyên bản phản hồi thô của AI.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  PageExtractionInput,
  DocumentContext,
  ExtractedCriterionItem,
  PageExtractionResult,
  MultiPageExtractionResult,
  PageExtractionOptions,
} from './types';
import { mergeMultiPageExtraction } from './multiPageMerger';

/**
 * Trang hoàng Prompt hệ thống với thông tin ngữ cảnh trang và tài liệu
 */
export function buildPageExtractionPrompt(
  basePrompt: string,
  pageNumber: number,
  totalPages: number,
  context?: DocumentContext
): string {
  const contextLines: string[] = [
    `\n\n--- [NGỮ CẢNH TRANG TÀI LIỆU (${pageNumber}/${totalPages})] ---`,
    `- Đang phân tích trang ${pageNumber} trên tổng số ${totalPages} trang của cùng một Phiếu kiểm nghiệm.`,
  ];

  if (context?.batchNo) {
    contextLines.push(`- Số lô sản xuất đã ghi nhận từ trang trước: "${context.batchNo}"`);
  }
  if (context?.productCode) {
    contextLines.push(`- Mã sản phẩm đã ghi nhận: "${context.productCode}"`);
  }
  if (context?.productName) {
    contextLines.push(`- Tên sản phẩm: "${context.productName}"`);
  }
  if (context?.labName) {
    contextLines.push(`- Đơn vị kiểm nghiệm: "${context.labName}"`);
  }

  if (pageNumber > 1) {
    contextLines.push(
      `- LƯU Ý BẢNG NỐI TRANG: Trang ${pageNumber} là phần tiếp nối bảng chỉ tiêu từ trang trước. ` +
        `Hãy bóc tách tất cả các hàng chỉ tiêu kiểm nghiệm trên trang này.`
    );
    if (context?.lastItemFromPreviousPage) {
      contextLines.push(
        `- Chỉ tiêu cuối cùng của trang trước là: "${context.lastItemFromPreviousPage}".`
      );
    }
  }

  contextLines.push(
    `- QUY TẮC BẮT BUỘC (RULE 7): Gán cứng thuộc tính "sourcePageNumber": ${pageNumber} cho tất cả các chỉ tiêu trích xuất từ trang này.`,
    `- KHÔNG ĐOÁN MÒ (RULE 1, 2): Chỉ bóc tách những gì nhìn thấy rõ trên trang ${pageNumber}.`,
    `-----------------------------------------------------\n`
  );

  return basePrompt + contextLines.join('\n');
}

/**
 * Bóc tách dữ liệu từ một trang đơn lẻ
 */
export async function extractSinglePageData(
  page: PageExtractionInput,
  totalPages: number,
  context: DocumentContext,
  systemPrompt: string,
  executeCall: (prompt: string, page: PageExtractionInput) => Promise<any>
): Promise<PageExtractionResult> {
  const decoratedPrompt = buildPageExtractionPrompt(
    systemPrompt,
    page.pageNumber,
    totalPages,
    context
  );

  try {
    const rawResult = await executeCall(decoratedPrompt, page);

    const rawResultsArray: any[] = Array.isArray(rawResult?.testResults)
      ? rawResult.testResults
      : [];

    // Chuyển đổi và bảo đảm gắn cứng sourcePageNumber = page.pageNumber cho 100% item
    const testResults: ExtractedCriterionItem[] = rawResultsArray.map((item) => {
      const confStr =
        item.confidence === 'high' ? 'high' : item.confidence === 'medium' ? 'medium' : 'low';
      let score: number;
      if (typeof item.confidenceScore === 'number' && !isNaN(item.confidenceScore)) {
        score = Math.min(100, Math.max(0, Math.round(item.confidenceScore)));
      } else {
        score = confStr === 'high' ? 95 : confStr === 'medium' ? 80 : 60;
      }

      return {
        criteriaName: String(item.criteriaName || '').trim(),
        mappedName: item.mappedName ? String(item.mappedName).trim() : '',
        confidence: confStr,
        confidenceScore: score,
        value: String(item.value ?? '').trim(),
        unit: item.unit ? String(item.unit).trim() : '',
        limit: item.limit ? String(item.limit).trim() : '',
        analysisMethod: item.analysisMethod ? String(item.analysisMethod).trim() : '',
        sourcePageNumber: page.pageNumber, // Cam kết chuẩn 100% Rule 7
        rawText: item.rawText ? String(item.rawText).trim() : undefined,
      };
    });

    return {
      pageNumber: page.pageNumber,
      totalPages,
      labName: rawResult?.labName ? String(rawResult.labName).trim() : undefined,
      productCode: rawResult?.productCode ? String(rawResult.productCode).trim() : undefined,
      productName: rawResult?.productName ? String(rawResult.productName).trim() : undefined,
      batchNo: rawResult?.batchNo ? String(rawResult.batchNo).trim() : undefined,
      mfgDate: rawResult?.mfgDate ? String(rawResult.mfgDate).trim() : undefined,
      expDate: rawResult?.expDate ? String(rawResult.expDate).trim() : undefined,
      testDate: rawResult?.testDate ? String(rawResult.testDate).trim() : undefined,
      notes: rawResult?.notes ? String(rawResult.notes).trim() : undefined,
      testResults,
      status: 'SUCCESS',
      rawResponse: rawResult,
    };
  } catch (err: any) {
    return {
      pageNumber: page.pageNumber,
      totalPages,
      testResults: [],
      status: 'FAILED',
      errorMessage: err?.message || 'Lỗi không xác định khi xử lý trang',
    };
  }
}

/**
 * Hợp nhất kết quả từ nhiều trang thành kết quả hoàn chỉnh (kế thừa từ Multi-Page Merge Engine)
 */
export function mergeMultiPageResults(
  pageResults: PageExtractionResult[],
  totalPages: number
): MultiPageExtractionResult {
  return mergeMultiPageExtraction(pageResults, totalPages);
}

export { mergeMultiPageExtraction };

/**
 * Thực thi bóc tách tuần tự toàn bộ các trang với cơ chế truyền ngữ cảnh và phục hồi lỗi
 */
export async function extractAllPagesSequentially(
  renderedPages: PageExtractionInput[],
  systemPrompt: string,
  executeCall: (prompt: string, page: PageExtractionInput) => Promise<any>,
  options: PageExtractionOptions = {}
): Promise<MultiPageExtractionResult> {
  const { continueOnPageError = true, maxRetriesPerPage = 2, onPageProgress } = options;

  const totalPages = renderedPages.length;
  const pageResults: PageExtractionResult[] = [];
  const runningContext: DocumentContext = {};

  for (let i = 0; i < totalPages; i++) {
    const page = renderedPages[i];
    const pageNum = page.pageNumber;

    onPageProgress?.(pageNum, totalPages, `Đang phân tích AI trang ${pageNum}/${totalPages}...`);

    let pageResult: PageExtractionResult | null = null;
    let attempt = 0;

    while (attempt <= maxRetriesPerPage) {
      attempt++;
      pageResult = await extractSinglePageData(
        page,
        totalPages,
        runningContext,
        systemPrompt,
        executeCall
      );

      if (pageResult.status === 'SUCCESS') {
        break;
      }

      if (attempt <= maxRetriesPerPage) {
        // Chờ backoff ngắn trước khi thử lại trang đó
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    if (!pageResult) {
      pageResult = {
        pageNumber: pageNum,
        totalPages,
        testResults: [],
        status: 'FAILED',
        errorMessage: `Thất bại sau ${maxRetriesPerPage + 1} lần thử.`,
      };
    }

    pageResults.push(pageResult);

    // Cập nhật runningContext cho các trang tiếp theo nếu trang này thành công
    if (pageResult.status === 'SUCCESS') {
      if (pageResult.batchNo && !runningContext.batchNo) {
        runningContext.batchNo = pageResult.batchNo;
      }
      if (pageResult.productCode && !runningContext.productCode) {
        runningContext.productCode = pageResult.productCode;
      }
      if (pageResult.productName && !runningContext.productName) {
        runningContext.productName = pageResult.productName;
      }
      if (pageResult.labName && !runningContext.labName) {
        runningContext.labName = pageResult.labName;
      }
      if (pageResult.testResults.length > 0) {
        const lastItem = pageResult.testResults[pageResult.testResults.length - 1];
        runningContext.lastItemFromPreviousPage = lastItem.criteriaName;
      }
    } else if (!continueOnPageError) {
      throw new Error(
        `[PageExtractor] Dừng xử lý do lỗi tại trang ${pageNum}: ${pageResult.errorMessage}`
      );
    }
  }

  // Nếu 100% số trang đều thất bại thì ném ra lỗi để kích hoạt Fallback
  const allFailed = pageResults.every((p) => p.status === 'FAILED');
  if (allFailed && totalPages > 0) {
    const firstErr = pageResults[0]?.errorMessage || 'Không thể trích xuất dữ liệu từ các trang';
    throw new Error(`[PageExtractor] Tất cả ${totalPages} trang đều thất bại: ${firstErr}`);
  }

  return mergeMultiPageResults(pageResults, totalPages);
}
