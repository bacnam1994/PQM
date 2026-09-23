import { describe, it, expect, vi } from 'vitest';
import { convertPdfToImages } from '../../src/utils/pdfProcessor';

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
    return `data:${type};base64,QUJDREVGR0g=`;
  };
  HTMLCanvasElement.prototype.getContext = function (type: string) {
    if (type === '2d') {
      return {
        fillStyle: '#FFFFFF',
        fillRect: () => {},
      } as any;
    }
    return null;
  };
}

describe('pdfProcessor Integration (Backward Compatibility)', () => {
  it('convertPdfToImages kết xuất trang với đầy đủ base64, dataUrl, width, height', async () => {
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

    const pages = await convertPdfToImages(new ArrayBuffer(50), {
      targetWidth: 1600,
      quality: 0.85,
    });

    expect(pages).toHaveLength(1);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].base64).toBe('QUJDREVGR0g=');
    expect(pages[0].dataUrl).toContain('data:image/png;base64');
    expect(pages[0].width).toBeGreaterThan(1000);
    expect(pages[0].height).toBeGreaterThan(1500);
  });

  it('pdfProcessor re-export analyzePdf hoạt động đúng', async () => {
    const { analyzePdf } = await import('../../src/utils/pdfProcessor');
    expect(typeof analyzePdf).toBe('function');
  });
});
