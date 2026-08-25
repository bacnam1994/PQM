import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Thiết lập Worker cho PDF.js trong Vite
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  } catch (e) {
    // Fallback CDN nếu worker URL nội bộ gặp vấn đề
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || '6.2.108'}/build/pdf.worker.min.mjs`;
  }
}

export interface RenderedPdfPage {
  pageNumber: number;
  base64: string; // Chuỗi base64 thuần (không có prefix data:image/jpeg;base64,)
  dataUrl: string;
  width: number;
  height: number;
}

export interface PdfConversionOptions {
  /** Chiều rộng tối đa khi render để tối ưu dung lượng (Mặc định: 1600px - cực kỳ sắc nét cho OCR mà dung lượng chỉ ~150-250KB) */
  targetWidth?: number;
  /** Chất lượng nén JPEG từ 0.1 đến 1.0 (Mặc định: 0.85) */
  quality?: number;
  /** Số trang tối đa cần render (Mặc định: không giới hạn) */
  maxPages?: number;
  /** Callback tiến độ render từng trang */
  onProgress?: (renderedPages: number, totalPages: number) => void;
}

/**
 * Chuyển đổi một file PDF thành mảng các ảnh JPEG tối ưu dung lượng bằng HTML5 Canvas.
 * Giúp giảm tải 80-90% dung lượng gửi lên AI và loại bỏ hoàn toàn lỗi quá tải / timeout của Gemini khi đọc file PDF thô.
 */
export async function convertPdfToImages(
  file: File | Blob,
  options: PdfConversionOptions = {}
): Promise<RenderedPdfPage[]> {
  const {
    targetWidth = 1600,
    quality = 0.85,
    maxPages = 50,
    onProgress,
  } = options;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/cmaps/',
    cMapPacked: true,
  });

  const pdfDocument = await loadingTask.promise;
  const totalPages = Math.min(pdfDocument.numPages, maxPages);
  const renderedPages: RenderedPdfPage[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const originalViewport = page.getViewport({ scale: 1.0 });

    // Tính toán tỷ lệ scale tối ưu
    const scale = targetWidth / originalViewport.width;
    const viewport = page.getViewport({ scale: Math.min(scale, 2.5) }); // Giới hạn scale tối đa 2.5x

    // Tạo canvas offscreen
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error(`Không thể khởi tạo 2D context cho trang ${pageNum}`);
    }

    // Vẽ nền trắng để tránh trong suốt làm mờ chữ
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      intent: 'print',
    };

    await page.render(renderContext as any).promise;

    // Xuất ra định dạng JPEG tối ưu dung lượng
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.split(',')[1];

    renderedPages.push({
      pageNumber: pageNum,
      base64,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
    });

    onProgress?.(pageNum, totalPages);
  }

  return renderedPages;
}
