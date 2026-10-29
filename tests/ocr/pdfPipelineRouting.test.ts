import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geminiService } from '../../src/services/ai/geminiService';
import * as pdfAnalyzerModule from '../../src/services/ocr/pdfAnalyzer';
import * as pdfProcessorModule from '../../src/utils/pdfProcessor';
import {
  extractAllPagesSequentially,
  isRetryableOcrError,
} from '../../src/services/ocr/pageExtractor';
import type { PageExtractionInput, PdfAnalysisReport } from '../../src/services/ocr/types';

describe('PDF Pipeline Routing & Concurrency Hardening (VIBECODE-AI-PDF-01)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem('GEMINI_API_KEY', 'mock-gemini-key');
  });

  describe('1. Định tuyến thông minh theo loại tài liệu (Phase 1)', () => {
    it('NATIVE_TEXT: trích xuất text trực tiếp, TUYỆT ĐỐI KHÔNG gọi convertPdfToImages để render ảnh Canvas', async () => {
      const mockReport: PdfAnalysisReport = {
        pageCount: 2,
        totalPages: 2,
        documentType: 'NATIVE_TEXT',
        docType: 'DIGITAL_TEXT',
        hasTextLayer: true,
        pageTypes: [
          { pageNumber: 1, type: 'TEXT', usableText: true, charCount: 500, wordCount: 80 },
          { pageNumber: 2, type: 'TEXT', usableText: true, charCount: 600, wordCount: 95 },
        ],
        processingStrategy: 'EXTRACT_TEXT_DIRECT',
        pages: [
          {
            pageNumber: 1,
            geometry: {
              pageNumber: 1,
              widthPt: 595,
              heightPt: 842,
              rotation: 0,
              aspectRatio: 0.707,
              paperFormat: 'A4',
            },
            charCount: 500,
            wordCount: 80,
            sampleText: 'PHIẾU KIỂM NGHIỆM LÔ 702601',
            fullText:
              'PHIẾU KIỂM NGHIỆM\nSố lô: 702601\nChỉ tiêu: Cảm quan\nKết quả: Đạt tiêu chuẩn',
            hasTableKeywords: true,
            isTextUsable: true,
            pageType: 'TEXT',
            recommendedPipeline: 'NATIVE_TEXT',
          },
          {
            pageNumber: 2,
            geometry: {
              pageNumber: 2,
              widthPt: 595,
              heightPt: 842,
              rotation: 0,
              aspectRatio: 0.707,
              paperFormat: 'A4',
            },
            charCount: 600,
            wordCount: 95,
            sampleText: 'Chỉ tiêu: Định lượng',
            fullText:
              'Chỉ tiêu: Định lượng Paracetamol\nKết quả: 502.5 mg/viên\nGiới hạn: 475.0 - 525.0 mg/viên',
            hasTableKeywords: true,
            isTextUsable: true,
            pageType: 'TEXT',
            recommendedPipeline: 'NATIVE_TEXT',
          },
        ],
        totalChars: 1100,
        totalWords: 175,
        canUseNativeText: true,
        summaryReason: 'PDF điện tử đầy đủ text layer',
      };

      vi.spyOn(pdfAnalyzerModule, 'analyzePdf').mockResolvedValue(mockReport);
      const convertSpy = vi.spyOn(pdfProcessorModule, 'convertPdfToImages');

      // Giả lập file PDF
      const fakePdfFile = new File(['%PDF-1.4 mock content'], 'test-native.pdf', {
        type: 'application/pdf',
      });

      // Mock client Gemini
      let callCount = 0;
      const fakeGenAI = {
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContent: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
              return {
                response: {
                  text: () =>
                    JSON.stringify({
                      labName: 'Trung tâm Kiểm nghiệm',
                      batchNo: '702601',
                      testResults: [
                        {
                          criteriaName: 'Cảm quan',
                          mappedName: 'Cảm quan',
                          confidence: 'high',
                          value: 'Đạt tiêu chuẩn',
                          sourcePageNumber: 1,
                        },
                      ],
                    }),
                },
              };
            }
            return {
              response: {
                text: () =>
                  JSON.stringify({
                    testResults: [
                      {
                        criteriaName: 'Định lượng Paracetamol',
                        mappedName: 'Định lượng',
                        confidence: 'high',
                        value: '502.5',
                        unit: 'mg/viên',
                        limit: '475.0 - 525.0 mg/viên',
                        sourcePageNumber: 2,
                      },
                    ],
                  }),
              },
            };
          }),
        }),
      };

      // Đưa mock vào geminiClientLoader
      const clientLoaderModule = await import('../../src/services/ai/geminiClientLoader');
      vi.spyOn(clientLoaderModule, 'createGoogleGenerativeAI').mockResolvedValue(fakeGenAI as any);

      // Chạy bóc tách
      const result = await geminiService.extractDataFromDocument(fakePdfFile, 'Prompt hướng dẫn');

      // XÁC MINH CỐT LÕI: convertPdfToImages hoàn toàn KHÔNG được gọi
      expect(convertSpy).not.toHaveBeenCalled();
      expect(result.documentType).toBe('NATIVE_TEXT');
      expect(result.testResults).toHaveLength(2);
      expect(result.testResults[0].value).toBe('Đạt tiêu chuẩn');
      expect(result.testResults[1].value).toBe('502.5');
    });

    it('NATIVE_TEXT self-recovery: khi text layer trích xuất trả về 0 kết quả, tự động chuyển sang High-DPI Canvas Rendering', async () => {
      const mockReport: PdfAnalysisReport = {
        pageCount: 1,
        totalPages: 1,
        documentType: 'NATIVE_TEXT',
        docType: 'DIGITAL_TEXT',
        hasTextLayer: true,
        pageTypes: [
          { pageNumber: 1, type: 'TEXT', usableText: true, charCount: 300, wordCount: 50 },
        ],
        processingStrategy: 'EXTRACT_TEXT_DIRECT',
        pages: [
          {
            pageNumber: 1,
            geometry: {
              pageNumber: 1,
              widthPt: 595,
              heightPt: 842,
              rotation: 0,
              aspectRatio: 0.707,
              paperFormat: 'A4',
            },
            charCount: 300,
            wordCount: 50,
            sampleText: 'PHIẾU KIỂM NGHIỆM',
            fullText: 'Bảng kết quả kiểm nghiệm rỗng do font subset lỗi',
            hasTableKeywords: true,
            isTextUsable: true,
            pageType: 'TEXT',
            recommendedPipeline: 'NATIVE_TEXT',
          },
        ],
        totalChars: 300,
        totalWords: 50,
        canUseNativeText: true,
        summaryReason: 'PDF điện tử đầy đủ text layer',
      };

      vi.spyOn(pdfAnalyzerModule, 'analyzePdf').mockResolvedValue(mockReport);
      const convertSpy = vi.spyOn(pdfProcessorModule, 'convertPdfToImages').mockResolvedValue([
        {
          pageNumber: 1,
          base64: 'mock-rendered-page-base64',
          dataUrl: 'data:image/jpeg;base64,mock',
          width: 1654,
          height: 2339,
          mimeType: 'image/jpeg',
        },
      ]);

      const fakePdfFile = new File(['%PDF-1.4 mock content'], 'broken-text.pdf', {
        type: 'application/pdf',
      });

      let callCount = 0;
      const fakeGenAI = {
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContent: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
              // Lần 1 (Text Stream): Trả về 0 chỉ tiêu
              return {
                response: {
                  text: () => JSON.stringify({ testResults: [] }),
                },
              };
            } else {
              // Lần 2 (Vision Retry): Nhận diện thành công từ ảnh Canvas High-DPI
              return {
                response: {
                  text: () =>
                    JSON.stringify({
                      reportNo: 'KN-2026-001',
                      labName: 'Trung tâm Quatest 3',
                      testResults: [
                        {
                          criteriaName: 'Chì (Pb)',
                          mappedName: 'Chì (Pb)',
                          category: 'HEAVY_METAL',
                          confidence: 'high',
                          value: '< 0.05',
                          unit: 'ppm',
                        },
                      ],
                    }),
                },
              };
            }
          }),
        }),
      };

      const clientLoaderModule = await import('../../src/services/ai/geminiClientLoader');
      vi.spyOn(clientLoaderModule, 'createGoogleGenerativeAI').mockResolvedValue(fakeGenAI as any);

      const result = await geminiService.extractDataFromDocument(fakePdfFile, 'Prompt');

      // Tự động kích hoạt convertPdfToImages sau khi lần text thuần trả về 0 kết quả
      expect(convertSpy).toHaveBeenCalledTimes(1);
      expect(result.testResults).toHaveLength(1);
      expect(result.testResults[0].criteriaName).toBe('Chì (Pb)');
      expect(result.documentType).toBe('SCANNED_IMAGE');
    });

    it('SCANNED_IMAGE: tự động gọi convertPdfToImages để render ảnh Canvas High-DPI', async () => {
      const mockReport: PdfAnalysisReport = {
        pageCount: 1,
        totalPages: 1,
        documentType: 'SCANNED_IMAGE',
        docType: 'SCANNED_IMAGE',
        hasTextLayer: false,
        pageTypes: [
          { pageNumber: 1, type: 'SCANNED', usableText: false, charCount: 0, wordCount: 0 },
        ],
        processingStrategy: 'HIGH_DPI_RENDER_VISION',
        pages: [
          {
            pageNumber: 1,
            geometry: {
              pageNumber: 1,
              widthPt: 595,
              heightPt: 842,
              rotation: 0,
              aspectRatio: 0.707,
              paperFormat: 'A4',
            },
            charCount: 0,
            wordCount: 0,
            sampleText: '',
            hasTableKeywords: false,
            isTextUsable: false,
            pageType: 'SCANNED',
            recommendedPipeline: 'VISION_OCR',
          },
        ],
        totalChars: 0,
        totalWords: 0,
        canUseNativeText: false,
        summaryReason: 'Tài liệu scan không có text',
      };

      vi.spyOn(pdfAnalyzerModule, 'analyzePdf').mockResolvedValue(mockReport);
      const convertSpy = vi.spyOn(pdfProcessorModule, 'convertPdfToImages').mockResolvedValue([
        {
          pageNumber: 1,
          base64: 'mock-scanned-base64',
          dataUrl: 'data:image/png;base64,mock',
          width: 2000,
          height: 2800,
          mimeType: 'image/png',
        },
      ]);

      const fakePdfFile = new File(['%PDF-1.4 scanned'], 'test-scanned.pdf', {
        type: 'application/pdf',
      });

      const fakeGenAI = {
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContent: vi.fn().mockResolvedValue({
            response: {
              text: () =>
                JSON.stringify({
                  labName: 'Lab Quatest',
                  batchNo: 'SC01',
                  testResults: [
                    {
                      criteriaName: 'Độ rã',
                      mappedName: 'Độ rã',
                      confidence: 'high',
                      value: '10 phút',
                    },
                  ],
                }),
            },
          }),
        }),
      };
      const clientLoaderModule = await import('../../src/services/ai/geminiClientLoader');
      vi.spyOn(clientLoaderModule, 'createGoogleGenerativeAI').mockResolvedValue(fakeGenAI as any);

      const result = await geminiService.extractDataFromDocument(fakePdfFile, 'Prompt');

      // Phải gọi convertPdfToImages với targetDpi 200, format JPEG tối ưu dung lượng & tốc độ
      expect(convertSpy).toHaveBeenCalledWith(
        fakePdfFile,
        expect.objectContaining({ targetDpi: 200, format: 'image/jpeg' })
      );
      expect(result.documentType).toBe('SCANNED_IMAGE');
    });

    it('MIXED_PDF: chỉ render Canvas cho các trang scan, trang text trích xuất trực tiếp', async () => {
      const mockReport: PdfAnalysisReport = {
        pageCount: 2,
        totalPages: 2,
        documentType: 'MIXED_PDF',
        docType: 'HYBRID',
        hasTextLayer: true,
        pageTypes: [
          { pageNumber: 1, type: 'TEXT', usableText: true, charCount: 400, wordCount: 60 },
          { pageNumber: 2, type: 'SCANNED', usableText: false, charCount: 0, wordCount: 0 },
        ],
        processingStrategy: 'HYBRID_PAGE_BY_PAGE',
        pages: [
          {
            pageNumber: 1,
            geometry: {
              pageNumber: 1,
              widthPt: 595,
              heightPt: 842,
              rotation: 0,
              aspectRatio: 0.707,
              paperFormat: 'A4',
            },
            charCount: 400,
            wordCount: 60,
            sampleText: 'Trang text 1',
            fullText: 'Số lô: MIX01\nChỉ tiêu: Độ ẩm\nKết quả: 4.5%',
            hasTableKeywords: true,
            isTextUsable: true,
            pageType: 'TEXT',
            recommendedPipeline: 'NATIVE_TEXT',
          },
          {
            pageNumber: 2,
            geometry: {
              pageNumber: 2,
              widthPt: 595,
              heightPt: 842,
              rotation: 0,
              aspectRatio: 0.707,
              paperFormat: 'A4',
            },
            charCount: 0,
            wordCount: 0,
            sampleText: '',
            hasTableKeywords: false,
            isTextUsable: false,
            pageType: 'SCANNED',
            recommendedPipeline: 'VISION_OCR',
          },
        ],
        totalChars: 400,
        totalWords: 60,
        canUseNativeText: true,
        summaryReason: 'Tài liệu hỗn hợp',
      };

      vi.spyOn(pdfAnalyzerModule, 'analyzePdf').mockResolvedValue(mockReport);
      const convertSpy = vi.spyOn(pdfProcessorModule, 'convertPdfToImages').mockResolvedValue([
        {
          pageNumber: 2,
          base64: 'mock-page-2-base64',
          dataUrl: 'data:image/png;base64,mock',
          width: 2000,
          height: 2800,
          mimeType: 'image/png',
        },
      ]);

      const fakePdfFile = new File(['%PDF-1.4 mixed'], 'test-mixed.pdf', {
        type: 'application/pdf',
      });

      const fakeGenAI = {
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContent: vi.fn().mockResolvedValue({
            response: {
              text: () =>
                JSON.stringify({
                  labName: 'Lab Mixed',
                  batchNo: 'MIX01',
                  testResults: [
                    {
                      criteriaName: 'Độ ẩm',
                      mappedName: 'Độ ẩm',
                      confidence: 'high',
                      value: '4.5%',
                    },
                  ],
                }),
            },
          }),
        }),
      };
      const clientLoaderModule = await import('../../src/services/ai/geminiClientLoader');
      vi.spyOn(clientLoaderModule, 'createGoogleGenerativeAI').mockResolvedValue(fakeGenAI as any);

      const result = await geminiService.extractDataFromDocument(fakePdfFile, 'Prompt');

      // Chỉ render trang 2
      expect(convertSpy).toHaveBeenCalledWith(
        fakePdfFile,
        expect.objectContaining({ pageNumbers: [2] })
      );
      expect(result.documentType).toBe('MIXED_PDF');
    });

    it('chuyển đổi an toàn sang fallback khi analyzePdf bị lỗi', async () => {
      vi.spyOn(pdfAnalyzerModule, 'analyzePdf').mockRejectedValue(
        new Error('Corrupt PDF metadata')
      );
      const convertSpy = vi.spyOn(pdfProcessorModule, 'convertPdfToImages').mockResolvedValue([
        {
          pageNumber: 1,
          base64: 'fallback-base64',
          dataUrl: 'data:image/png;base64,mock',
          width: 2000,
          height: 2800,
          mimeType: 'image/png',
        },
      ]);

      const fakePdfFile = new File(['%PDF-1.4 bad'], 'test-corrupt.pdf', {
        type: 'application/pdf',
      });

      const fakeGenAI = {
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContent: vi.fn().mockResolvedValue({
            response: {
              text: () =>
                JSON.stringify({
                  labName: 'Lab Fallback',
                  batchNo: 'FB01',
                  testResults: [
                    {
                      criteriaName: 'Chỉ tiêu 1',
                      mappedName: 'Chỉ tiêu 1',
                      confidence: 'high',
                      value: 'Đạt',
                    },
                  ],
                }),
            },
          }),
        }),
      };
      const clientLoaderModule = await import('../../src/services/ai/geminiClientLoader');
      vi.spyOn(clientLoaderModule, 'createGoogleGenerativeAI').mockResolvedValue(fakeGenAI as any);

      const result = await geminiService.extractDataFromDocument(fakePdfFile, 'Prompt');

      // Khi analyzer lỗi, vẫn tự động render dự phòng qua Canvas không làm sập ứng dụng
      expect(convertSpy).toHaveBeenCalled();
      expect(result.documentType).toBe('SCANNED_IMAGE');
    });
  });

  describe('2. Concurrency có kiểm soát và bảo toàn thứ tự trang (Phase 2)', () => {
    it('bảo toàn 100% thứ tự trang (1, 2, 3) ngay cả khi các trang sau hoàn thành không đồng thời', async () => {
      const inputs: PageExtractionInput[] = [
        { pageNumber: 1, isNativeText: true, textContent: 'Trang 1: Số lô B100', base64: '' },
        { pageNumber: 2, isNativeText: true, textContent: 'Trang 2: Chỉ tiêu 2', base64: '' },
        { pageNumber: 3, isNativeText: true, textContent: 'Trang 3: Chỉ tiêu 3', base64: '' },
      ];

      const callOrder: number[] = [];
      const mockExecuteCall = vi
        .fn()
        .mockImplementation(async (_prompt: string, page: PageExtractionInput) => {
          callOrder.push(page.pageNumber);
          // Giả lập trang 2 mất nhiều thời gian hơn trang 3
          if (page.pageNumber === 2) {
            await new Promise((r) => setTimeout(r, 50));
          } else if (page.pageNumber === 3) {
            await new Promise((r) => setTimeout(r, 10));
          }
          return {
            testResults: [
              {
                criteriaName: `Chỉ tiêu trang ${page.pageNumber}`,
                mappedName: `Chỉ tiêu ${page.pageNumber}`,
                confidence: 'high',
                value: `Kết quả ${page.pageNumber}`,
                sourcePageNumber: page.pageNumber,
              },
            ],
          };
        });

      const merged = await extractAllPagesSequentially(inputs, 'Base Prompt', mockExecuteCall, {
        maxConcurrency: 2,
      });

      // Trang 1 phải luôn được gọi đầu tiên để thiết lập context
      expect(callOrder[0]).toBe(1);
      // Kết quả cuối cùng phải được sắp xếp tuần tự theo đúng thứ tự trang
      expect(merged.pageCount).toBe(3);
      expect(merged.testResults).toHaveLength(3);
      expect(merged.testResults[0].sourcePageNumber).toBe(1);
      expect(merged.testResults[1].sourcePageNumber).toBe(2);
      expect(merged.testResults[2].sourcePageNumber).toBe(3);
    });

    it('không retry đối với các lỗi không thể khắc phục (isRetryableOcrError)', () => {
      expect(isRetryableOcrError(new Error('401 Unauthorized: Invalid API key'))).toBe(false);
      expect(isRetryableOcrError(new Error('403 Forbidden: API disabled'))).toBe(false);
      expect(isRetryableOcrError(new Error('404 Not Found: Model does not exist'))).toBe(false);
      expect(isRetryableOcrError(new Error('INVALID_ARGUMENT: Bad schema'))).toBe(false);

      // Các lỗi mạng/tạm thời thì CÓ THỂ retry
      expect(isRetryableOcrError(new Error('503 Service Unavailable'))).toBe(true);
      expect(isRetryableOcrError(new Error('429 Resource has been exhausted'))).toBe(true);
      expect(isRetryableOcrError(new Error('Failed to fetch'))).toBe(true);
    });
  });

  describe('3. Bảo toàn nguyên vẹn số 0, dấu so sánh và đơn vị đo (Phase 3)', () => {
    it('bảo toàn chính xác số 0, 0.0, 0.05, dấu so sánh ≤, < và đơn vị đo phức tạp', async () => {
      const inputs: PageExtractionInput[] = [
        {
          pageNumber: 1,
          isNativeText: true,
          textContent: 'Kiểm nghiệm vi sinh và định lượng',
          base64: '',
        },
      ];

      const mockExecuteCall = vi.fn().mockResolvedValue({
        batchNo: '702601',
        labName: 'QUATEST 3',
        testResults: [
          {
            criteriaName: 'Tạp chất liên quan A',
            mappedName: 'Tạp chất A',
            confidence: 'high',
            value: '0',
            unit: '%',
            limit: '≤ 0.1 %',
          },
          {
            criteriaName: 'Chì (Pb)',
            mappedName: 'Chì',
            confidence: 'high',
            value: '< 0.01',
            unit: 'ppm',
            limit: '≤ 2.0 ppm',
          },
          {
            criteriaName: 'Cadmi (Cd)',
            mappedName: 'Cadmi',
            confidence: 'high',
            value: '0.05',
            unit: 'ppm',
            limit: '≤ 0.5 ppm',
          },
          {
            criteriaName: 'Tổng số vi sinh vật hiếu khí',
            mappedName: 'Tổng vi sinh hiếu khí',
            confidence: 'high',
            value: '1.2 x 10^3',
            unit: 'CFU/g',
            limit: '≤ 10^4 CFU/g',
          },
        ],
      });

      const merged = await extractAllPagesSequentially(inputs, 'Base Prompt', mockExecuteCall);

      const items = merged.testResults;
      expect(items).toHaveLength(4);

      // Bảo toàn số 0 dạng chuỗi
      expect(items[0].value).toBe('0');
      expect(items[0].unit).toBe('%');
      expect(items[0].limit).toBe('≤ 0.1 %');

      // Bảo toàn dấu < và số thập phân
      expect(items[1].value).toBe('< 0.01');
      expect(items[1].unit).toBe('ppm');

      // Bảo toàn số 0.05
      expect(items[2].value).toBe('0.05');

      // Bảo toàn ký hiệu lũy thừa vi sinh
      expect(items[3].value).toBe('1.2 x 10^3');
      expect(items[3].unit).toBe('CFU/g');
    });
  });
});
