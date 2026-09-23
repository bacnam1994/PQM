/**
 * src/services/ocr/highDpiRenderer.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Bộ kết xuất PDF độ phân giải cao (OCR-03: High-DPI Rendering).
 * Nâng cấp chất lượng ảnh kết xuất từ mức 1600px JPEG lên cấu hình động 200–300 DPI,
 * sử dụng định dạng PNG không nén suy hao (lossless) giúp giữ nguyên độ sắc nét
 * của các số nhỏ, ký hiệu thập phân (0.05, 0.001), dấu so sánh (≤, ≥, <, >) và đơn vị đo (CFU/g, ppm).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { HighDpiRenderOptions, RenderedPageResult } from './types';

/** Lazy loader cho pdfjs-dist */
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
 * Tính toán tỷ lệ scale Canvas dựa trên target DPI và giới hạn kích thước tối đa
 * 1 pt trong PDF chuẩn tương đương 1/72 inch.
 */
export function calculateDpiScale(
  widthPt: number,
  heightPt: number,
  targetDpi = 250,
  maxWidthPx = 3200,
  maxHeightPx = 4200
): { scale: number; calculatedWidth: number; calculatedHeight: number; actualDpi: number } {
  // scale lý tưởng = targetDpi / 72 (ví dụ 250 / 72 ≈ 3.472; 300 / 72 ≈ 4.167)
  let scale = targetDpi / 72;

  let calculatedWidth = Math.floor(widthPt * scale);
  let calculatedHeight = Math.floor(heightPt * scale);

  // Rào chắn bảo vệ bộ nhớ RAM trình duyệt: nếu vượt quá giới hạn max px, co tỉ lệ lại
  if (calculatedWidth > maxWidthPx) {
    const clampScale = maxWidthPx / calculatedWidth;
    scale *= clampScale;
    calculatedWidth = maxWidthPx;
    calculatedHeight = Math.floor(heightPt * scale);
  }

  if (calculatedHeight > maxHeightPx) {
    const clampScale = maxHeightPx / calculatedHeight;
    scale *= clampScale;
    calculatedHeight = maxHeightPx;
    calculatedWidth = Math.floor(widthPt * scale);
  }

  const actualDpi = Math.round(scale * 72);

  return { scale, calculatedWidth, calculatedHeight, actualDpi };
}

/**
 * Render toàn bộ hoặc các trang chọn lọc của file PDF sang mảng ảnh High-DPI
 */
export async function renderPdfHighDpi(
  fileOrBytes: File | Blob | Uint8Array | ArrayBuffer,
  options: HighDpiRenderOptions = {}
): Promise<RenderedPageResult[]> {
  const {
    targetDpi = 250,
    maxWidthPx = 3000,
    maxHeightPx = 4200,
    format = 'image/png',
    quality = 0.95,
    maxPages = 50,
    applyPreprocessing = false,
    onProgress,
  } = options;

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
  const totalPages = Math.min(pdfDoc.numPages, maxPages);
  const renderedResults: RenderedPageResult[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.(pageNum, totalPages, `Đang kết xuất High-DPI trang ${pageNum}/${totalPages}...`);

    const page = await pdfDoc.getPage(pageNum);
    const originalViewport = page.getViewport({ scale: 1.0 });

    const { scale, calculatedWidth, calculatedHeight, actualDpi } = calculateDpiScale(
      originalViewport.width,
      originalViewport.height,
      targetDpi,
      maxWidthPx,
      maxHeightPx
    );

    const viewport = page.getViewport({ scale });

    // Khởi tạo Canvas offscreen
    const canvas = document.createElement('canvas');
    canvas.width = calculatedWidth;
    canvas.height = calculatedHeight;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error(`[HighDpiRenderer] Không thể tạo 2D Context cho trang ${pageNum}`);
    }

    // Nền trắng tinh khiết để chống răng cưa và alpha artifact
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: context,
      viewport,
      intent: 'print',
    };

    await page.render(renderContext as any).promise;

    // Nếu có yêu cầu tiền xử lý ảnh (OCR-04: Giữ cả bản gốc và bản enhancedVariant)
    let enhancedVariant: RenderedPageResult['enhancedVariant'];
    if (applyPreprocessing) {
      const { preprocessCanvasImage } = await import('./imagePreprocessor');
      const processed = preprocessCanvasImage(canvas, {
        grayscale: true,
        autoContrast: true,
        contrastClipPercent: 0.01,
        denoise: true,
        sharpen: true,
        sharpenStrength: 0.35,
        deskew: true,
      });
      const pDataUrl =
        format === 'image/png'
          ? processed.canvas.toDataURL('image/png')
          : processed.canvas.toDataURL('image/jpeg', quality);
      const pBase64 = pDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
      enhancedVariant = {
        dataUrl: pDataUrl,
        base64: pBase64,
        description: `Tối ưu hóa: ${processed.appliedFilters.join(' + ')}`,
      };
      processed.canvas.width = 0;
      processed.canvas.height = 0;
    }

    // Xuất chuỗi ảnh dataUrl & base64 của ảnh gốc
    const dataUrl =
      format === 'image/png'
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
    const byteSize = Math.round((base64.length * 3) / 4);

    renderedResults.push({
      pageNumber: pageNum,
      dataUrl,
      base64,
      width: calculatedWidth,
      height: calculatedHeight,
      dpiCalculated: actualDpi,
      mimeType: format,
      byteSize,
      enhancedVariant,
    });

    // Giải phóng bộ nhớ Canvas ngay lập tức để chống rò rỉ RAM trên thiết bị di động
    canvas.width = 0;
    canvas.height = 0;
  }

  return renderedResults;
}
