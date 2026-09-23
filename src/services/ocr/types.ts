/**
 * src/services/ocr/types.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Định nghĩa các kiểu dữ liệu cốt lõi cho pipeline xử lý tài liệu & OCR (Phiếu Kiểm Nghiệm).
 * Phục vụ từ giai đoạn phân tích cấu trúc PDF (OCR-02), render chất lượng cao (OCR-03),
 * tiền xử lý ảnh (OCR-04) đến đo đạc benchmark (OCR-01).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Phân loại bản chất tài liệu PDF đầu vào */
export type PdfDocumentType =
  | 'NATIVE_TEXT'
  | 'SCANNED_IMAGE'
  | 'MIXED_PDF'
  | 'DIGITAL_TEXT'
  | 'HYBRID';

/** Phân loại trạng thái nội dung của từng trang PDF */
export type PageContentType = 'TEXT' | 'SCANNED' | 'MIXED';

/** Chiến lược xử lý tài liệu tối ưu được bộ phân tích PDF đề xuất */
export type ProcessingStrategy =
  | 'EXTRACT_TEXT_DIRECT'
  | 'HIGH_DPI_RENDER_VISION'
  | 'HYBRID_PAGE_BY_PAGE';

/** Thông tin tóm tắt loại trang */
export interface PageTypeInfo {
  pageNumber: number;
  type: PageContentType;
  usableText: boolean;
  charCount: number;
  wordCount: number;
}

/** Thông tin kích thước và phân giải từng trang */
export interface PdfPageGeometry {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  rotation: number;
  /** Tỷ lệ khung hình (width / height) */
  aspectRatio: number;
  /** Nhận diện khổ giấy phổ biến (A4, Letter, Custom) */
  paperFormat: 'A4' | 'LETTER' | 'CUSTOM';
}

/** Kết quả phân tích cấu trúc trang của PDF Analyzer */
export interface PdfPageAnalysis {
  pageNumber: number;
  geometry: PdfPageGeometry;
  /** Số lượng ký tự tìm thấy trong text layer */
  charCount: number;
  /** Số lượng từ tìm thấy */
  wordCount: number;
  /** Mẫu text thô trích xuất được (đoạn đầu) */
  sampleText: string;
  /** Phát hiện có cấu trúc dạng bảng hay không */
  hasTableKeywords: boolean;
  /** Đánh giá text layer có thực sự sử dụng được hay chỉ là watermark/rác OCR */
  isTextUsable: boolean;
  /** Phân loại dạng trang */
  pageType: PageContentType;
  /** Khuyến nghị hình thức xử lý cho trang này */
  recommendedPipeline: 'NATIVE_TEXT' | 'VISION_OCR' | 'HYBRID';
}

/** Kết quả phân tích tổng thể toàn bộ tài liệu PDF */
export interface PdfAnalysisReport {
  /** Số trang phát hiện được (chuẩn hóa mới) */
  pageCount: number;
  /** Tương thích ngược với totalPages */
  totalPages: number;
  /** Phân loại tài liệu chuẩn hóa: NATIVE_TEXT | SCANNED_IMAGE | MIXED_PDF */
  documentType: 'NATIVE_TEXT' | 'SCANNED_IMAGE' | 'MIXED_PDF';
  /** Tương thích ngược với docType */
  docType: PdfDocumentType;
  /** Có lớp text layer khả dụng hay không */
  hasTextLayer: boolean;
  /** Danh sách phân loại từng trang */
  pageTypes: PageTypeInfo[];
  /** Chiến lược xử lý đề xuất cho pipeline tiếp theo */
  processingStrategy: ProcessingStrategy;
  /** Chi tiết cấu trúc từng trang */
  pages: PdfPageAnalysis[];
  /** Tổng số ký tự trong text layer */
  totalChars: number;
  /** Tổng số từ trong text layer */
  totalWords: number;
  /** Đánh giá xem có thể dùng Native Text extraction không */
  canUseNativeText: boolean;
  /** Tóm tắt lý do phân loại */
  summaryReason: string;
}

/** Tùy chọn render High-DPI */
export interface HighDpiRenderOptions {
  /** Target DPI mong muốn (khuyến nghị 200 - 300) */
  targetDpi?: number;
  /** Giới hạn chiều rộng tối đa (px) để tránh tràn bộ nhớ Canvas */
  maxWidthPx?: number;
  /** Giới hạn chiều cao tối đa (px) */
  maxHeightPx?: number;
  /** Định dạng xuất: PNG (lossless) hoặc JPEG */
  format?: 'image/png' | 'image/jpeg';
  /** Chất lượng nén nếu dùng JPEG (0.1 - 1.0) */
  quality?: number;
  /** Số trang tối đa xử lý */
  maxPages?: number;
  /** Áp dụng tự động tiền xử lý (Grayscale, Contrast...) */
  applyPreprocessing?: boolean;
  /** Callback tiến độ render */
  onProgress?: (current: number, total: number, stepText: string) => void;
}

/** Kết quả render từng trang */
export interface RenderedPageResult {
  pageNumber: number;
  dataUrl: string;
  base64: string;
  width: number;
  height: number;
  dpiCalculated: number;
  mimeType: 'image/png' | 'image/jpeg';
  byteSize: number;
  /** Biến thể ảnh đã qua tiền xử lý tương phản (nếu có yêu cầu) */
  enhancedVariant?: {
    dataUrl: string;
    base64: string;
    description: string;
  };
}

/** Tùy chọn cho module tiền xử lý ảnh (Image Preprocessor) */
export interface ImagePreprocessingOptions {
  /** Chuyển sang ảnh thang độ xám (Grayscale) */
  grayscale?: boolean;
  /** Tự động cân bằng và kéo dãn tương phản (Auto Contrast Stretching) */
  autoContrast?: boolean;
  /** Tỷ lệ cắt nhiễu biên khi cân bằng tương phản (mặc định 0.01 = 1% an toàn cho dấu thập phân) */
  contrastClipPercent?: number;
  /** Khử nhiễu đốm hạt máy scan (Denoise) */
  denoise?: boolean;
  /** Áp dụng làm sắc nét viền chữ (Unsharp Mask / Sharpen) */
  sharpen?: boolean;
  /** Cường độ làm sắc nét (0.1 - 2.0, mặc định 0.35 bảo toàn chữ viết tay & bảng) */
  sharpenStrength?: number;
  /** Tự động phát hiện và xoay nắn độ nghiêng văn bản (-15° đến +15°) */
  deskew?: boolean;
  /** Kích hoạt nhị phân hóa tùy chọn (Binarization, mặc định false để giữ sắc thái) */
  binarize?: boolean;
  /** Ngưỡng nhị phân hóa (Binarization threshold 0-255, undefined nếu không dùng) */
  binarizationThreshold?: number;
}

/** Kết quả sau khi xử lý ảnh qua Canvas */
export interface ProcessedImageData {
  canvas: HTMLCanvasElement;
  originalCanvas?: HTMLCanvasElement;
  width: number;
  height: number;
  detectedSkewAngleDeg?: number;
  appliedFilters: string[];
  /** DataUrl của biến thể ảnh đã qua xử lý */
  processedDataUrl?: string;
  /** DataUrl của ảnh gốc trước xử lý */
  originalDataUrl?: string;
}

/** Cấu trúc Ground Truth dùng cho Benchmark OCR */
export interface OcrGroundTruth {
  docId: string;
  batchNo?: string;
  labName?: string;
  testDate?: string;
  criteria: Array<{
    criteriaName: string;
    expectedResult: string;
    unit?: string;
    limitText?: string;
  }>;
}

/** Kết quả đo đạc độ chính xác Benchmark */
export interface OcrBenchmarkMetric {
  docId: string;
  fieldAccuracy: {
    batchNoMatched: boolean;
    labNameMatched: boolean;
    testDateMatched: boolean;
    accuracyPercent: number;
  };
  criteriaMetrics: {
    totalExpected: number;
    totalExtracted: number;
    correctlyMatched: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  performance: {
    renderDurationMs: number;
    ocrDurationMs: number;
    totalDurationMs: number;
    totalImageBytes: number;
  };
}

/** Chỉ tiêu trích xuất kèm thông tin trang nguồn (Rule 7: Preserve Source Page Index) */
export interface ExtractedCriterionItem {
  criteriaName: string;
  mappedName?: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore?: number;
  value: string;
  unit?: string;
  limit?: string;
  analysisMethod?: string;
  sourcePageNumber: number; // 1-indexed, số thứ tự trang tài liệu chứa chỉ tiêu này
  rawText?: string;
}

/** Ngữ cảnh tài liệu được truyền giữa các trang để bảo tồn tính liên tục */
export interface DocumentContext {
  labName?: string;
  batchNo?: string;
  mfgDate?: string;
  expDate?: string;
  testDate?: string;
  documentType?: string;
  productCode?: string;
  productName?: string;
  /** Chỉ tiêu cuối cùng của trang trước để phát hiện tiếp nối bảng xuyên trang */
  lastItemFromPreviousPage?: string;
}

/** Kết quả trích xuất của từng trang riêng lẻ (Per-Page Extraction Result) */
export interface PageExtractionResult {
  pageNumber: number;
  totalPages: number;
  labName?: string;
  productCode?: string;
  productName?: string;
  batchNo?: string;
  mfgDate?: string;
  expDate?: string;
  testDate?: string;
  notes?: string;
  testResults: ExtractedCriterionItem[];
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  errorMessage?: string;
  rawResponse?: any;
}

/** Kết quả tổng hợp từ trích xuất từng trang */
export interface MultiPageExtractionResult {
  labName: string;
  documentType: string;
  pageCount: number;
  productCode?: string;
  productName?: string;
  batchNo: string;
  mfgDate: string;
  expDate: string;
  testDate: string;
  notes: string;
  testResults: ExtractedCriterionItem[];
  pageResults: PageExtractionResult[];
  failedPages: number[];
}

/** Tùy chọn cho module bóc tách từng trang */
export interface PageExtractionOptions {
  /** Cho phép tiếp tục xử lý các trang còn lại nếu 1 trang bị lỗi mạng (mặc định true) */
  continueOnPageError?: boolean;
  /** Số lần thử lại tối đa cho mỗi trang trước khi đánh dấu FAILED (mặc định 2) */
  maxRetriesPerPage?: number;
  /** Callback tiến độ từng trang */
  onPageProgress?: (currentPage: number, totalPages: number, stepText: string) => void;
}

/** Đầu vào linh hoạt cho module bóc tách trang (tương thích cả RenderedPageResult và RenderedPdfPage) */
export interface PageExtractionInput {
  pageNumber: number;
  base64: string;
  dataUrl?: string;
  width?: number;
  height?: number;
  mimeType?: 'image/png' | 'image/jpeg' | string;
  dpiCalculated?: number;
  byteSize?: number;
  enhancedVariant?: {
    dataUrl: string;
    base64: string;
    description: string;
  };
}
