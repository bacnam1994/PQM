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
    if (context?.pendingBrokenRow) {
      contextLines.push(
        `- LƯU Ý HÀNG ĐỨT ĐOẠN: Cuối trang trước có chỉ tiêu dang dở "${context.pendingBrokenRow}". Nếu đầu trang ${pageNumber} có giá trị hoặc đơn vị tiếp nối, hãy ưu tiên hoàn thiện chỉ tiêu này.`
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
 * Kiểm tra xem lỗi có thể retry được hay không (bỏ qua các lỗi 400, 401, 403, 404, INVALID_ARGUMENT)
 */
export function isRetryableOcrError(err: any): boolean {
  const msg = String(err?.message || '');
  if (
    msg.includes('400') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('API key') ||
    msg.includes('404') ||
    msg.includes('INVALID_ARGUMENT')
  ) {
    return false;
  }
  return true;
}

/**
 * Thực thi một trang với cơ chế thử lại có kiểm soát (Backoff + Fail-Fast cho lỗi không thể khắc phục)
 */
async function extractPageWithRetry(
  page: PageExtractionInput,
  totalPages: number,
  context: DocumentContext,
  systemPrompt: string,
  executeCall: (prompt: string, page: PageExtractionInput) => Promise<any>,
  maxRetriesPerPage: number
): Promise<PageExtractionResult> {
  let attempt = 0;
  let pageResult: PageExtractionResult | null = null;

  while (attempt <= maxRetriesPerPage) {
    attempt++;
    pageResult = await extractSinglePageData(page, totalPages, context, systemPrompt, executeCall);

    if (pageResult.status === 'SUCCESS') {
      break;
    }

    // Nếu lỗi không thể khắc phục (401, 403, sai API Key...), không retry vô ích
    if (pageResult.errorMessage && !isRetryableOcrError(new Error(pageResult.errorMessage))) {
      break;
    }

    if (attempt <= maxRetriesPerPage) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  return (
    pageResult || {
      pageNumber: page.pageNumber,
      totalPages,
      testResults: [],
      status: 'FAILED',
      errorMessage: `Thất bại sau ${maxRetriesPerPage + 1} lần thử.`,
    }
  );
}

/**
 * Bounded Concurrency Runner: Chạy mảng tác vụ với giới hạn số luồng đồng thời
 */
async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await fn(items[idx]);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Thực thi bóc tách toàn bộ các trang với cơ chế truyền ngữ cảnh, concurrency có kiểm soát và phục hồi lỗi
 */
export async function extractAllPagesSequentially(
  renderedPages: PageExtractionInput[],
  systemPrompt: string,
  executeCall: (prompt: string, page: PageExtractionInput) => Promise<any>,
  options: PageExtractionOptions = {}
): Promise<MultiPageExtractionResult> {
  const {
    continueOnPageError = true,
    maxRetriesPerPage = 2,
    maxConcurrency = 2,
    onPageProgress,
  } = options;

  const totalPages = renderedPages.length;
  if (totalPages === 0) {
    return mergeMultiPageResults([], 0);
  }

  const pageResults: PageExtractionResult[] = [];
  const runningContext: DocumentContext = {};

  // Bước 1: Luôn xử lý Trang 1 đầu tiên để xác lập Header context (số lô, lab, ngày tháng, tên SP)
  const firstPage = renderedPages[0];
  onPageProgress?.(1, totalPages, `Đang phân tích AI trang 1/${totalPages}...`);

  const firstResult = await extractPageWithRetry(
    firstPage,
    totalPages,
    runningContext,
    systemPrompt,
    executeCall,
    maxRetriesPerPage
  );
  pageResults.push(firstResult);

  if (firstResult.status === 'SUCCESS') {
    if (firstResult.batchNo) runningContext.batchNo = firstResult.batchNo;
    if (firstResult.productCode) runningContext.productCode = firstResult.productCode;
    if (firstResult.productName) runningContext.productName = firstResult.productName;
    if (firstResult.labName) runningContext.labName = firstResult.labName;
    if (firstResult.testResults.length > 0) {
      const lastItem = firstResult.testResults[firstResult.testResults.length - 1];
      runningContext.lastItemFromPreviousPage = lastItem.criteriaName;
      if (!lastItem.value || lastItem.value.trim().length === 0) {
        runningContext.pendingBrokenRow = lastItem.criteriaName;
      }
    }
  } else if (!continueOnPageError) {
    throw new Error(`[PageExtractor] Dừng xử lý do lỗi tại trang 1: ${firstResult.errorMessage}`);
  }

  // Bước 2: Xử lý các trang tiếp theo (2..N)
  if (totalPages > 1) {
    const remainingPages = renderedPages.slice(1);

    if (maxConcurrency <= 1) {
      // Tuần tự nghiêm ngặt nếu maxConcurrency <= 1
      for (const page of remainingPages) {
        onPageProgress?.(
          page.pageNumber,
          totalPages,
          `Đang phân tích AI trang ${page.pageNumber}/${totalPages}...`
        );
        const res = await extractPageWithRetry(
          page,
          totalPages,
          runningContext,
          systemPrompt,
          executeCall,
          maxRetriesPerPage
        );
        pageResults.push(res);

        if (res.status === 'SUCCESS' && res.testResults.length > 0) {
          const lastItem = res.testResults[res.testResults.length - 1];
          runningContext.lastItemFromPreviousPage = lastItem.criteriaName;
          if (!lastItem.value || lastItem.value.trim().length === 0) {
            runningContext.pendingBrokenRow = lastItem.criteriaName;
          } else {
            delete runningContext.pendingBrokenRow;
          }
        } else if (res.status === 'FAILED' && !continueOnPageError) {
          throw new Error(
            `[PageExtractor] Dừng xử lý do lỗi tại trang ${page.pageNumber}: ${res.errorMessage}`
          );
        }
      }
    } else {
      // Bounded Concurrency Pool (mặc định 2 workers song song an toàn)
      const poolLimit = Math.max(1, maxConcurrency);
      const remainingResults = await runWithConcurrencyLimit(
        remainingPages,
        poolLimit,
        async (page) => {
          onPageProgress?.(
            page.pageNumber,
            totalPages,
            `Đang phân tích AI trang ${page.pageNumber}/${totalPages}...`
          );
          const res = await extractPageWithRetry(
            page,
            totalPages,
            { ...runningContext },
            systemPrompt,
            executeCall,
            maxRetriesPerPage
          );
          if (res.status === 'FAILED' && !continueOnPageError) {
            throw new Error(
              `[PageExtractor] Dừng xử lý do lỗi tại trang ${page.pageNumber}: ${res.errorMessage}`
            );
          }
          return res;
        }
      );
      pageResults.push(...remainingResults);
    }
  }

  // Luôn sắp xếp lại kết quả theo thứ tự số trang 1, 2, 3...
  pageResults.sort((a, b) => a.pageNumber - b.pageNumber);

  // Nếu 100% số trang đều thất bại thì ném ra lỗi để kích hoạt Fallback
  const allFailed = pageResults.every((p) => p.status === 'FAILED');
  if (allFailed && totalPages > 0) {
    const firstErr = pageResults[0]?.errorMessage || 'Không thể trích xuất dữ liệu từ các trang';
    throw new Error(`[PageExtractor] Tất cả ${totalPages} trang đều thất bại: ${firstErr}`);
  }

  return mergeMultiPageResults(pageResults, totalPages);
}
