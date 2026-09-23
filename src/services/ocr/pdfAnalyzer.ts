/**
 * src/services/ocr/pdfAnalyzer.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Bộ phân tích cấu trúc tài liệu PDF (OCR-02).
 * Phân tích siêu dữ liệu, hình học khổ giấy, và độ dày của text layer để tự động
 * quyết định luồng xử lý: Trích xuất trực tiếp Text Stream (Native) hay Render High-DPI (Vision/OCR).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  PageContentType,
  PageTypeInfo,
  PdfAnalysisReport,
  PdfDocumentType,
  PdfPageAnalysis,
  PdfPageGeometry,
  ProcessingStrategy,
} from './types';

// Bảng từ khóa nhận diện bảng kết quả kiểm nghiệm phổ biến trong ngành Dược
const TABLE_DETECTION_KEYWORDS = [
  'chỉ tiêu',
  'tên chỉ tiêu',
  'kết quả',
  'tiêu chuẩn',
  'mức chất lượng',
  'phương pháp',
  'phương pháp thử',
  'đơn vị',
  'yêu cầu',
  'giới hạn',
  'stt',
  'criteria',
  'test parameter',
  'result',
  'specification',
  'method',
  'acceptance criteria',
];

/**
 * Lazy loader cho pdfjs-dist
 */
async function getPdfJs() {
  const [pdfjsLib, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  if (typeof window !== 'undefined') {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || '6.2.108'}/build/pdf.worker.min.mjs`;
    }
  }
  return pdfjsLib;
}

/**
 * Nhận diện định dạng khổ giấy từ kích thước Points (1 pt = 1/72 inch)
 */
export function detectPaperFormat(widthPt: number, heightPt: number): 'A4' | 'LETTER' | 'CUSTOM' {
  const shortSide = Math.min(widthPt, heightPt);
  const longSide = Math.max(widthPt, heightPt);

  // A4 chuẩn: 595.28 x 841.89 pt (cho phép sai số ±10 pt)
  if (Math.abs(shortSide - 595.28) <= 10 && Math.abs(longSide - 841.89) <= 10) {
    return 'A4';
  }

  // US Letter: 612 x 792 pt
  if (Math.abs(shortSide - 612) <= 10 && Math.abs(longSide - 792) <= 10) {
    return 'LETTER';
  }

  return 'CUSTOM';
}

/**
 * Phân tích nội dung text của một trang PDF và đánh giá tính khả dụng thực tế
 */
export function analyzePageText(rawStrings: string[]): {
  charCount: number;
  wordCount: number;
  sampleText: string;
  hasTableKeywords: boolean;
  isTextUsable: boolean;
  pageType: PageContentType;
} {
  const combined = rawStrings.join(' ').replace(/\s+/g, ' ').trim();
  const charCount = combined.length;
  const wordCount = combined ? combined.split(/\s+/).filter((w) => w.length > 0).length : 0;
  const lower = combined.toLowerCase();

  const hasTableKeywords = TABLE_DETECTION_KEYWORDS.some((kw) => lower.includes(kw));

  // Kiểm tra xem text layer có chỉ là watermark quét / rác OCR scanner hay không
  const isScannerWatermarkOnly =
    wordCount > 0 &&
    wordCount <= 6 &&
    (lower.includes('camscanner') ||
      lower.includes('scanned by') ||
      lower.includes('scanner') ||
      lower.includes('watermark'));

  // Đánh giá text layer có usable cho việc bóc tách PKN hay không:
  // Cần có tối thiểu 20 từ (hoặc >= 8 từ nếu có từ khóa bảng kiểm nghiệm dược điển)
  const isTextUsable =
    !isScannerWatermarkOnly && (wordCount >= 20 || (wordCount >= 8 && hasTableKeywords));

  let pageType: PageContentType;
  if (wordCount === 0 || isScannerWatermarkOnly) {
    pageType = 'SCANNED';
  } else if (isTextUsable && hasTableKeywords) {
    pageType = 'TEXT';
  } else {
    pageType = 'MIXED';
  }

  return {
    charCount,
    wordCount,
    sampleText: combined.slice(0, 300),
    hasTableKeywords,
    isTextUsable,
    pageType,
  };
}

/**
 * Phân tích toàn diện file PDF từ File, Blob hoặc Uint8Array
 */
export async function analyzePdf(
  fileOrBytes: File | Blob | Uint8Array | ArrayBuffer
): Promise<PdfAnalysisReport> {
  const pdfjsLib = await getPdfJs();

  let arrayBuffer: ArrayBuffer;
  if (fileOrBytes instanceof ArrayBuffer) {
    arrayBuffer = fileOrBytes;
  } else if (fileOrBytes instanceof Uint8Array) {
    arrayBuffer = fileOrBytes.buffer as ArrayBuffer;
  } else {
    arrayBuffer = await fileOrBytes.arrayBuffer();
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  const pageAnalyses: PdfPageAnalysis[] = [];
  let totalChars = 0;
  let totalWords = 0;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });

    const widthPt = viewport.width;
    const heightPt = viewport.height;
    const rotation = viewport.rotation || 0;
    const paperFormat = detectPaperFormat(widthPt, heightPt);

    const geometry: PdfPageGeometry = {
      pageNumber: pageNum,
      widthPt,
      heightPt,
      rotation,
      aspectRatio: Number((widthPt / heightPt).toFixed(3)),
      paperFormat,
    };

    // Đọc Text Content
    const textContent = await page.getTextContent();
    const rawStrings: string[] = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .filter((s: string) => s.trim().length > 0);

    const { charCount, wordCount, sampleText, hasTableKeywords, isTextUsable, pageType } =
      analyzePageText(rawStrings);

    totalChars += charCount;
    totalWords += wordCount;

    // Xác định pipeline cho từng trang
    let recommendedPipeline: 'NATIVE_TEXT' | 'VISION_OCR' | 'HYBRID';
    if (pageType === 'TEXT' && isTextUsable) {
      recommendedPipeline = 'NATIVE_TEXT';
    } else if (pageType === 'SCANNED') {
      recommendedPipeline = 'VISION_OCR';
    } else {
      recommendedPipeline = 'HYBRID';
    }

    pageAnalyses.push({
      pageNumber: pageNum,
      geometry,
      charCount,
      wordCount,
      sampleText,
      hasTableKeywords,
      isTextUsable,
      pageType,
      recommendedPipeline,
    });
  }

  // Phân loại danh sách từng trang
  const pageTypes: PageTypeInfo[] = pageAnalyses.map((p) => ({
    pageNumber: p.pageNumber,
    type: p.pageType,
    usableText: p.isTextUsable,
    charCount: p.charCount,
    wordCount: p.wordCount,
  }));

  const pagesWithUsableText = pageAnalyses.filter((p) => p.isTextUsable).length;
  const pagesWithScanned = pageAnalyses.filter((p) => p.pageType === 'SCANNED').length;
  const hasTextLayer = pagesWithUsableText > 0;

  let documentType: 'NATIVE_TEXT' | 'SCANNED_IMAGE' | 'MIXED_PDF';
  let processingStrategy: ProcessingStrategy;
  let canUseNativeText = false;
  let summaryReason = '';

  if (pagesWithScanned === totalPages || !hasTextLayer) {
    documentType = 'SCANNED_IMAGE';
    processingStrategy = 'HIGH_DPI_RENDER_VISION';
    canUseNativeText = false;
    summaryReason = `Tài liệu dạng scan hoàn toàn (0/${totalPages} trang có text layer khả dụng). Cần áp dụng High-DPI Rendering và Vision OCR.`;
  } else if (pagesWithUsableText === totalPages) {
    documentType = 'NATIVE_TEXT';
    processingStrategy = 'EXTRACT_TEXT_DIRECT';
    canUseNativeText = true;
    summaryReason = `Tài liệu điện tử gốc có lớp văn bản đầy đủ (${totalWords} từ trên ${totalPages} trang, chứa từ khóa bảng kiểm nghiệm). Có thể ưu tiên trích xuất trực tiếp Text Stream.`;
  } else {
    documentType = 'MIXED_PDF';
    processingStrategy = 'HYBRID_PAGE_BY_PAGE';
    canUseNativeText = pagesWithUsableText > 0;
    summaryReason = `Tài liệu hỗn hợp (${pagesWithUsableText}/${totalPages} trang có text layer khả dụng). Áp dụng chiến lược kết hợp bóc tách text và Vision OCR theo từng trang.`;
  }

  // Tương thích ngược: docType
  const docType: PdfDocumentType =
    documentType === 'NATIVE_TEXT'
      ? 'DIGITAL_TEXT'
      : documentType === 'MIXED_PDF'
        ? 'HYBRID'
        : 'SCANNED_IMAGE';

  return {
    pageCount: totalPages,
    totalPages,
    documentType,
    docType,
    hasTextLayer,
    pageTypes,
    processingStrategy,
    pages: pageAnalyses,
    totalChars,
    totalWords,
    canUseNativeText,
    summaryReason,
  };
}
