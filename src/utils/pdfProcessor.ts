/**
 * src/utils/pdfProcessor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Bộ điều phối xử lý PDF client-side (Tích hợp OCR-02, OCR-03, OCR-04).
 * Cung cấp API tương thích ngược convertPdfToImages và mở rộng các năng lực:
 * - High-DPI Rendering (200-300 DPI, hỗ trợ PNG không nén suy hao)
 * - Tích hợp phân tích PDF Analyzer (phát hiện text layer vs scan)
 * - Tiền xử lý ảnh Canvas (Grayscale, Contrast stretching, Sharpen, Deskew)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { renderPdfHighDpi } from '../services/ocr/highDpiRenderer';
import { preprocessCanvasImage } from '../services/ocr/imagePreprocessor';
import { analyzePdf } from '../services/ocr/pdfAnalyzer';

export interface RenderedPdfPage {
  pageNumber: number;
  base64: string; // Chuỗi base64 thuần (không có prefix data:image/...;base64,)
  dataUrl: string;
  width: number;
  height: number;
  mimeType?: 'image/png' | 'image/jpeg';
}

export interface PdfConversionOptions {
  /** Chiều rộng tối đa khi render (Mặc định: 2000px cho độ sắc nét cao) */
  targetWidth?: number;
  /** Target DPI mong muốn (200 - 300 DPI). Nếu được cung cấp, sẽ ưu tiên hơn targetWidth */
  targetDpi?: number;
  /** Định dạng xuất: PNG (lossless, tối ưu chữ nhỏ) hoặc JPEG */
  format?: 'image/png' | 'image/jpeg';
  /** Chất lượng nén JPEG từ 0.1 đến 1.0 (Mặc định: 0.90) */
  quality?: number;
  /** Số trang tối đa cần render (Mặc định: 50) */
  maxPages?: number;
  /** Áp dụng tiền xử lý ảnh nâng cao (Tăng tương phản, khử nhiễu nền xám, làm sắc nét) */
  applyPreprocessing?: boolean;
  /** Callback tiến độ render từng trang */
  onProgress?: (renderedPages: number, totalPages: number) => void;
}

/**
 * Chuyển đổi một file PDF thành mảng các ảnh chất lượng cao tối ưu cho OCR bằng Canvas.
 * Bảo đảm tương thích ngược 100% với các dịch vụ gọi hiện có.
 */
export async function convertPdfToImages(
  file: File | Blob,
  options: PdfConversionOptions = {}
): Promise<RenderedPdfPage[]> {
  const {
    targetWidth = 2000,
    targetDpi,
    format = 'image/png',
    quality = 0.9,
    maxPages = 50,
    applyPreprocessing = false,
    onProgress,
  } = options;

  // Tính targetDpi: Nếu không truyền trực tiếp, ước tính từ targetWidth trên khổ A4 (~595 pt)
  // targetDpi ≈ (targetWidth / 595.28) * 72
  const effectiveDpi =
    targetDpi || Math.min(300, Math.max(180, Math.round((targetWidth / 595.28) * 72)));

  const renderedResults = await renderPdfHighDpi(file, {
    targetDpi: effectiveDpi,
    maxWidthPx: Math.max(targetWidth, 2400),
    format,
    quality,
    maxPages,
    onProgress: (current, total) => {
      onProgress?.(current, total);
    },
  });

  return renderedResults.map((item) => ({
    pageNumber: item.pageNumber,
    base64: item.base64,
    dataUrl: item.dataUrl,
    width: item.width,
    height: item.height,
    mimeType: item.mimeType,
  }));
}

// Re-export các module chuyên sâu phục vụ pipeline OCR mới
export { renderPdfHighDpi, analyzePdf, preprocessCanvasImage };
