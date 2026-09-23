import { describe, it, expect, vi } from 'vitest';
import { detectPaperFormat, analyzePageText, analyzePdf } from '../../src/services/ocr/pdfAnalyzer';

const mockGetDocument = vi.fn();

vi.mock('pdfjs-dist', () => ({
  getDocument: (...args: any[]) => mockGetDocument(...args),
  GlobalWorkerOptions: { workerSrc: '' },
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: 'mock-worker-url',
}));

describe('PDF Analyzer Engine (OCR-02)', () => {
  describe('detectPaperFormat', () => {
    it('nhận diện chính xác khổ giấy A4 (chuẩn 595.28 x 841.89 pt)', () => {
      expect(detectPaperFormat(595.28, 841.89)).toBe('A4');
      // Thử xoay ngang
      expect(detectPaperFormat(842, 595)).toBe('A4');
      // Thử sai số trong khoảng ±10pt
      expect(detectPaperFormat(590, 845)).toBe('A4');
    });

    it('nhận diện chính xác khổ giấy US Letter (612 x 792 pt)', () => {
      expect(detectPaperFormat(612, 792)).toBe('LETTER');
      expect(detectPaperFormat(792, 612)).toBe('LETTER');
    });

    it('trả về CUSTOM đối với các kích thước phi chuẩn', () => {
      expect(detectPaperFormat(300, 400)).toBe('CUSTOM');
      expect(detectPaperFormat(1000, 1500)).toBe('CUSTOM');
    });
  });

  describe('analyzePageText', () => {
    it('phát hiện đúng số từ, ký tự và từ khóa bảng kiểm nghiệm', () => {
      const strings = [
        'PHIẾU KIỂM NGHIỆM',
        'Số lô: 702601',
        'BẢNG KẾT QUẢ THỬ NGHIỆM',
        'STT',
        'Tên chỉ tiêu',
        'Tiêu chuẩn',
        'Kết quả',
        'Phương pháp',
        '1. Cảm quan - Đạt chuẩn',
        '2. Độ ẩm - 7.5% - DĐVN V',
      ];

      const res = analyzePageText(strings);
      expect(res.charCount).toBeGreaterThan(50);
      expect(res.wordCount).toBeGreaterThan(15);
      expect(res.hasTableKeywords).toBe(true);
      expect(res.sampleText).toContain('PHIẾU KIỂM NGHIỆM');
    });

    it('xử lý chính xác trang rỗng không có text (tài liệu scan thuần túy)', () => {
      const res = analyzePageText([]);
      expect(res.charCount).toBe(0);
      expect(res.wordCount).toBe(0);
      expect(res.hasTableKeywords).toBe(false);
      expect(res.isTextUsable).toBe(false);
      expect(res.pageType).toBe('SCANNED');
      expect(res.sampleText).toBe('');
    });

    it('nhận diện watermark quét (CamScanner) là text không khả dụng (isTextUsable = false)', () => {
      const watermarkOnly = ['Scanned with CamScanner'];
      const res = analyzePageText(watermarkOnly);
      expect(res.isTextUsable).toBe(false);
      expect(res.pageType).toBe('SCANNED');
    });
  });

  describe('analyzePdf tích hợp phân loại và chiến lược xử lý (OCR-02)', () => {
    it('nhận diện NATIVE_TEXT PDF và đề xuất EXTRACT_TEXT_DIRECT', async () => {
      const fakePdfDoc = {
        numPages: 2,
        getPage: vi.fn().mockImplementation((pageNum: number) => ({
          getViewport: () => ({ width: 595.28, height: 841.89, rotation: 0 }),
          getTextContent: () =>
            Promise.resolve({
              items: Array.from({ length: 60 }).map((_, i) => ({
                str: i % 5 === 0 ? 'Chỉ tiêu kiểm nghiệm ' + i : 'Kết quả đạt tiêu chuẩn ' + i,
              })),
            }),
        })),
      };

      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(fakePdfDoc),
      });

      const fakeArrayBuffer = new ArrayBuffer(100);
      const report = await analyzePdf(fakeArrayBuffer);

      expect(report.pageCount).toBe(2);
      expect(report.totalPages).toBe(2);
      expect(report.documentType).toBe('NATIVE_TEXT');
      expect(report.docType).toBe('DIGITAL_TEXT');
      expect(report.hasTextLayer).toBe(true);
      expect(report.canUseNativeText).toBe(true);
      expect(report.processingStrategy).toBe('EXTRACT_TEXT_DIRECT');
      expect(report.pageTypes).toHaveLength(2);
      expect(report.pageTypes[0].type).toBe('TEXT');
      expect(report.pageTypes[0].usableText).toBe(true);
      expect(report.pages[0].geometry.paperFormat).toBe('A4');
      expect(report.pages[0].recommendedPipeline).toBe('NATIVE_TEXT');
    });

    it('nhận diện SCANNED_IMAGE PDF và đề xuất HIGH_DPI_RENDER_VISION', async () => {
      const fakeScanDoc = {
        numPages: 1,
        getPage: vi.fn().mockReturnValue({
          getViewport: () => ({ width: 595.28, height: 841.89, rotation: 0 }),
          getTextContent: () => Promise.resolve({ items: [] }),
        }),
      };

      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(fakeScanDoc),
      });

      const report = await analyzePdf(new ArrayBuffer(50));

      expect(report.pageCount).toBe(1);
      expect(report.totalPages).toBe(1);
      expect(report.documentType).toBe('SCANNED_IMAGE');
      expect(report.docType).toBe('SCANNED_IMAGE');
      expect(report.hasTextLayer).toBe(false);
      expect(report.canUseNativeText).toBe(false);
      expect(report.processingStrategy).toBe('HIGH_DPI_RENDER_VISION');
      expect(report.pageTypes[0].type).toBe('SCANNED');
      expect(report.pageTypes[0].usableText).toBe(false);
      expect(report.pages[0].recommendedPipeline).toBe('VISION_OCR');
      expect(report.summaryReason).toContain('scan hoàn toàn');
    });

    it('nhận diện MIXED_PDF khi có cả trang Native Text và trang Scan', async () => {
      const fakeMixedDoc = {
        numPages: 3,
        getPage: vi.fn().mockImplementation((pageNum: number) => ({
          getViewport: () => ({ width: 595.28, height: 841.89, rotation: 0 }),
          getTextContent: () => {
            // Trang 1: Native Text đầy đủ với từ khóa kiểm nghiệm
            if (pageNum === 1) {
              return Promise.resolve({
                items: Array.from({ length: 40 }).map((_, i) => ({
                  str: 'Chỉ tiêu kết quả phương pháp kiểm nghiệm ' + i,
                })),
              });
            }
            // Trang 2: Scan thuần túy (0 ký tự)
            if (pageNum === 2) {
              return Promise.resolve({ items: [] });
            }
            // Trang 3: Scan có watermark nhỏ không usable
            return Promise.resolve({
              items: [{ str: 'Scanned with CamScanner' }],
            });
          },
        })),
      };

      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(fakeMixedDoc),
      });

      const report = await analyzePdf(new ArrayBuffer(150));

      expect(report.pageCount).toBe(3);
      expect(report.documentType).toBe('MIXED_PDF');
      expect(report.docType).toBe('HYBRID');
      expect(report.hasTextLayer).toBe(true);
      expect(report.processingStrategy).toBe('HYBRID_PAGE_BY_PAGE');
      expect(report.pageTypes[0].type).toBe('TEXT');
      expect(report.pageTypes[0].usableText).toBe(true);
      expect(report.pageTypes[1].type).toBe('SCANNED');
      expect(report.pageTypes[1].usableText).toBe(false);
      expect(report.pageTypes[2].type).toBe('SCANNED');
      expect(report.pageTypes[2].usableText).toBe(false);
    });

    it('xử lý tài liệu multi-page 5 trang không làm mất trang nào', async () => {
      const fake5PagesDoc = {
        numPages: 5,
        getPage: vi.fn().mockImplementation((pageNum: number) => ({
          getViewport: () => ({ width: 595.28, height: 841.89, rotation: 0 }),
          getTextContent: () =>
            Promise.resolve({
              items: [{ str: `Trang ${pageNum} - Phiếu kiểm nghiệm số ${pageNum}` }],
            }),
        })),
      };

      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(fake5PagesDoc),
      });

      const report = await analyzePdf(new ArrayBuffer(200));

      expect(report.pageCount).toBe(5);
      expect(report.totalPages).toBe(5);
      expect(report.pages).toHaveLength(5);
      expect(report.pageTypes).toHaveLength(5);
      expect(report.pages.map((p) => p.pageNumber)).toEqual([1, 2, 3, 4, 5]);
    });
  });
});
