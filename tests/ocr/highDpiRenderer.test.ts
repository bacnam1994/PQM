import { describe, it, expect, vi } from 'vitest';
import { calculateDpiScale, renderPdfHighDpi } from '../../src/services/ocr/highDpiRenderer';

const mockGetDocument = vi.fn();

vi.mock('pdfjs-dist', () => ({
  getDocument: (...args: any[]) => mockGetDocument(...args),
  GlobalWorkerOptions: { workerSrc: '' },
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: 'mock-worker-url',
}));

// Polyfill canvas toDataURL for JSDOM
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.toDataURL = function (type = 'image/png') {
    return `data:${type};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
  };
  HTMLCanvasElement.prototype.getContext = function (type: string) {
    if (type === '2d') {
      return {
        fillStyle: '#FFFFFF',
        fillRect: () => {},
        drawImage: () => {},
        getImageData: (x: number, y: number, w: number, h: number) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4),
        }),
        putImageData: () => {},
      } as any;
    }
    return null;
  };
}

describe('High-DPI Renderer Engine (OCR-03)', () => {
  describe('calculateDpiScale', () => {
    it('tính toán chính xác kích thước A4 ở 250 DPI', () => {
      // Khổ A4 chuẩn: 595.28 x 841.89 pt
      const res = calculateDpiScale(595.28, 841.89, 250);
      expect(res.scale).toBeCloseTo(250 / 72, 2);
      expect(res.calculatedWidth).toBe(2066);
      expect(res.calculatedHeight).toBe(2923);
      expect(res.actualDpi).toBe(250);
    });

    it('tính toán chính xác kích thước A4 ở 300 DPI (~2480 x 3507 px)', () => {
      const res = calculateDpiScale(595.28, 841.89, 300);
      expect(res.scale).toBeCloseTo(300 / 72, 2);
      expect(res.calculatedWidth).toBe(2480);
      expect(res.calculatedHeight).toBe(3507);
      expect(res.actualDpi).toBe(300);
    });

    it('tự động co tỷ lệ (clamp) khi kích thước vượt quá maxWidthPx hoặc maxHeightPx để bảo vệ bộ nhớ RAM', () => {
      const maxWidth = 1800;
      const res = calculateDpiScale(595.28, 841.89, 300, maxWidth);
      expect(res.calculatedWidth).toBeLessThanOrEqual(maxWidth);
      expect(res.actualDpi).toBeLessThan(300);
    });

    it('bảo toàn tỷ lệ khung hình (aspect ratio) sau khi tính scale và clamp', () => {
      const widthPt = 595.28;
      const heightPt = 841.89;
      const originalRatio = widthPt / heightPt;

      const res = calculateDpiScale(widthPt, heightPt, 250);
      const calculatedRatio = res.calculatedWidth / res.calculatedHeight;
      expect(Math.abs(calculatedRatio - originalRatio)).toBeLessThan(0.01);

      // Thử trường hợp bị clamp
      const clampedRes = calculateDpiScale(widthPt, heightPt, 300, 1500, 2000);
      const clampedRatio = clampedRes.calculatedWidth / clampedRes.calculatedHeight;
      expect(Math.abs(clampedRatio - originalRatio)).toBeLessThan(0.02);
    });

    it('tính toán chính xác kích thước ở 200 DPI', () => {
      const res = calculateDpiScale(595.28, 841.89, 200);
      expect(res.scale).toBeCloseTo(200 / 72, 2);
      expect(res.actualDpi).toBe(200);
      expect(res.calculatedWidth).toBe(1653);
      expect(res.calculatedHeight).toBe(2338);
    });
  });

  describe('renderPdfHighDpi tích hợp', () => {
    it('kết xuất mảng ảnh PNG sắc nét từng trang và giải phóng tài nguyên canvas', async () => {
      const fakePdfDoc = {
        numPages: 2,
        getPage: vi.fn().mockImplementation((pageNum: number) => ({
          getViewport: ({ scale }: { scale: number }) => ({
            width: 595.28 * scale,
            height: 841.89 * scale,
          }),
          render: () => ({
            promise: Promise.resolve(),
          }),
        })),
      };

      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(fakePdfDoc),
      });

      const progressSteps: number[] = [];
      const pages = await renderPdfHighDpi(new ArrayBuffer(100), {
        targetDpi: 250,
        format: 'image/png',
        maxPages: 2,
        onProgress: (current, total) => {
          progressSteps.push(current);
        },
      });

      expect(pages).toHaveLength(2);
      expect(pages[0].pageNumber).toBe(1);
      expect(pages[0].mimeType).toBe('image/png');
      expect(pages[0].width).toBe(2066);
      expect(pages[0].height).toBe(2923);
      expect(pages[0].dpiCalculated).toBe(250);
      expect(pages[0].base64).toBeTruthy();
      expect(pages[0].byteSize).toBeGreaterThan(0);
      expect(pages[1].pageNumber).toBe(2);
      expect(progressSteps).toEqual([1, 2]);
    });

    it('tạo biến thể enhancedVariant khi applyPreprocessing = true và bảo toàn ảnh gốc', async () => {
      const fakePdfDoc = {
        numPages: 1,
        getPage: vi.fn().mockImplementation(() => ({
          getViewport: ({ scale }: { scale: number }) => ({
            width: 595.28 * scale,
            height: 841.89 * scale,
          }),
          render: () => ({
            promise: Promise.resolve(),
          }),
        })),
      };

      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(fakePdfDoc),
      });

      const pages = await renderPdfHighDpi(new ArrayBuffer(100), {
        targetDpi: 250,
        format: 'image/png',
        maxPages: 1,
        applyPreprocessing: true,
      });

      expect(pages).toHaveLength(1);
      expect(pages[0].dataUrl).toBeTruthy();
      expect(pages[0].enhancedVariant).toBeDefined();
      expect(pages[0].enhancedVariant?.description).toContain('Tối ưu hóa:');
      expect(pages[0].enhancedVariant?.base64).toBeTruthy();
    });
  });
});
