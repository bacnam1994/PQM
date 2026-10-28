import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractHeuristicHeaderInfo,
  extractHeuristicCriteriaFromText,
  extractRawTextWithTesseract,
  isTesseractFallbackResult,
} from '../../src/services/ai/tesseractFallback';

const mockWorkerRecognize = vi.fn();
const mockWorkerTerminate = vi.fn();

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn().mockImplementation(() =>
    Promise.resolve({
      recognize: (...args: any[]) => mockWorkerRecognize(...args),
      terminate: (...args: any[]) => mockWorkerTerminate(...args),
    })
  ),
}));

const mockConvertPdfToImages = vi.fn();
vi.mock('../../src/utils/pdfProcessor', () => ({
  convertPdfToImages: (...args: any[]) => mockConvertPdfToImages(...args),
}));

describe('Tesseract Multi-Page Fallback (OCR-08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. extractHeuristicHeaderInfo', () => {
    it('trích xuất chính xác labName, batchNo, dates, và productName từ văn bản thô', () => {
      const sampleText = `
SỞ Y TẾ THÀNH PHỐ HỒ CHÍ MINH
TRUNG TÂM KIỂM NGHIỆM THUỐC & MỸ PHẨM TP.HCM
Địa chỉ: 45 Lê Duẩn, Q.1

PHIẾU KIỂM NGHIỆM
Tên mẫu: Paracetamol 500mg viên nén
Số lô: L240901-VN
Ngày sản xuất: 01/09/2024
Hạn dùng: 01/09/2027
Ngày nhận mẫu: 10/09/2024
Ngày kiểm nghiệm: 12/09/2024
      `;

      const header = extractHeuristicHeaderInfo(sampleText);
      expect(header.labName).toContain('TRUNG TÂM KIỂM NGHIỆM THUỐC & MỸ PHẨM TP.HCM');
      expect(header.batchNo).toBe('L240901-VN');
      expect(header.productName).toBe('Paracetamol 500mg viên nén');
      expect(header.mfgDate).toBe('01/09/2024');
      expect(header.expDate).toBe('01/09/2027');
      expect(header.testDate).toBe('12/09/2024');
    });

    it('chuẩn hóa định dạng ngày từ gạch ngang (DD-MM-YYYY) sang DD/MM/YYYY', () => {
      const text = 'Batch No: B123\nNgày sản xuất: 15-08-2024\nExp date: 15-08-2027';
      const header = extractHeuristicHeaderInfo(text);
      expect(header.batchNo).toBe('B123');
      expect(header.mfgDate).toBe('15/08/2024');
      expect(header.expDate).toBe('15/08/2027');
    });
  });

  describe('2. extractHeuristicCriteriaFromText', () => {
    it('trích xuất các dòng bảng phân tách bằng pipe | kèm sourcePageNumber', () => {
      const pageText = `
BẢNG KẾT QUẢ PHÂN TÍCH
STT | Tên chỉ tiêu | Kết quả | Đơn vị | Mức chất lượng
1 | Độ ẩm | 4.5% | % | ≤ 9.0%
2 | Độ rã | Đạt | | Dưới 15 phút
3 | Định lượng Paracetamol | 501.2 | mg/viên | 475 - 525 mg/viên
KẾT LUẬN: Đạt tiêu chuẩn
      `;

      const items = extractHeuristicCriteriaFromText(pageText, 2);
      expect(items.length).toBe(3);

      expect(items[0].criteriaName).toBe('Độ ẩm');
      expect(items[0].value).toBe('4.5%');
      expect(items[0].unit).toBe('%');
      expect(items[0].limit).toBe('≤ 9.0%');
      expect(items[0].sourcePageNumber).toBe(2);

      expect(items[1].criteriaName).toBe('Độ rã');
      expect(items[1].value).toBe('Đạt');
      expect(items[1].sourcePageNumber).toBe(2);

      expect(items[2].criteriaName).toBe('Định lượng Paracetamol');
      expect(items[2].value).toBe('501.2');
      expect(items[2].unit).toBe('mg/viên');
      expect(items[2].sourcePageNumber).toBe(2);
    });

    it('trích xuất các dòng có dạng Tên chỉ tiêu: Kết quả', () => {
      const text = `
Cảm quan: Viên nén hình trụ màu trắng
Độ đồng đều khối lượng: Phù hợp tiêu chuẩn DĐVN V
      `;

      const items = extractHeuristicCriteriaFromText(text, 1);
      expect(items.length).toBe(2);
      expect(items[0].criteriaName).toBe('Cảm quan');
      expect(items[0].value).toBe('Viên nén hình trụ màu trắng');
      expect(items[0].sourcePageNumber).toBe(1);

      expect(items[1].criteriaName).toBe('Độ đồng đều khối lượng');
      expect(items[1].value).toBe('Phù hợp tiêu chuẩn DĐVN V');
      expect(items[1].sourcePageNumber).toBe(1);
    });
  });

  describe('3. extractRawTextWithTesseract (Multi-Page Recognition)', () => {
    it('quét toàn bộ N trang PDF (không bị rơi rụng sau trang 1)', async () => {
      const mockPdfFile = new File(['mock-pdf'], 'pkn-multi.pdf', { type: 'application/pdf' });

      mockConvertPdfToImages.mockResolvedValue([
        { pageNumber: 1, dataUrl: 'data:image/png;base64,page1' },
        { pageNumber: 2, dataUrl: 'data:image/png;base64,page2' },
      ]);

      mockWorkerRecognize
        .mockResolvedValueOnce({
          data: {
            text: 'VIỆN KIỂM NGHIỆM THUỐC TRUNG ƯƠNG\nSố lô: L9999\n1 | Cảm quan | Đạt chuẩn',
            confidence: 90,
          },
        })
        .mockResolvedValueOnce({
          data: {
            text: '2 | Độ ẩm | 5.2% | %\n3 | Định lượng | 99.8% | %',
            confidence: 84,
          },
        });

      const progressSteps: string[] = [];
      const result = await extractRawTextWithTesseract(mockPdfFile, (step) => {
        progressSteps.push(step);
      });

      // Xác minh worker đã nhận diện cả 2 trang
      expect(mockWorkerRecognize).toHaveBeenCalledTimes(2);
      expect(mockWorkerTerminate).toHaveBeenCalledTimes(1);

      expect(result._isOfflineFallback).toBe(true);
      expect(result.pageCount).toBe(2);
      expect(result.confidence).toBe(87); // (90 + 84) / 2
      expect(result.labName).toContain('VIỆN KIỂM NGHIỆM THUỐC TRUNG ƯƠNG');
      expect(result.batchNo).toBe('L9999');

      // Xác minh rawText có cấu trúc [TRANG X/N]
      expect(result.rawText).toContain('--- [TRANG 1/2] ---');
      expect(result.rawText).toContain('--- [TRANG 2/2] ---');

      // Xác minh toàn bộ chỉ tiêu từ cả 2 trang đều được thu thập kèm sourcePageNumber
      expect(result.testResults.length).toBe(3);
      expect(result.testResults[0].criteriaName).toBe('Cảm quan');
      expect(result.testResults[0].sourcePageNumber).toBe(1);

      expect(result.testResults[1].criteriaName).toBe('Độ ẩm');
      expect(result.testResults[1].sourcePageNumber).toBe(2);

      expect(result.testResults[2].criteriaName).toBe('Định lượng');
      expect(result.testResults[2].sourcePageNumber).toBe(2);
    });

    it('xử lý an toàn khi 1 trang bị lỗi: bảo toàn dữ liệu các trang khác và ghi nhận failedPages', async () => {
      const mockPdfFile = new File(['mock-pdf'], 'pkn-partial-err.pdf', {
        type: 'application/pdf',
      });

      mockConvertPdfToImages.mockResolvedValue([
        { pageNumber: 1, dataUrl: 'data:image/png;base64,page1' },
        { pageNumber: 2, dataUrl: 'data:image/png;base64,page2' },
      ]);

      mockWorkerRecognize
        .mockResolvedValueOnce({
          data: {
            text: 'Số lô: L123\n1 | pH | 6.8',
            confidence: 88,
          },
        })
        .mockRejectedValueOnce(new Error('Canvas corrupt on page 2'));

      const result = await extractRawTextWithTesseract(mockPdfFile);

      expect(result.pageCount).toBe(2);
      expect(result.failedPages).toEqual([2]);
      expect(result.rawText).toContain('[Lỗi nhận diện trang 2]');
      expect(result.testResults.length).toBe(1);
      expect(result.testResults[0].criteriaName).toBe('pH');
      expect(result.testResults[0].sourcePageNumber).toBe(1);
    });

    it('nhận diện chính xác file ảnh đơn trang (không phải PDF)', async () => {
      const mockImgFile = new File(['mock-img'], 'pkn.png', { type: 'image/png' });

      mockWorkerRecognize.mockResolvedValueOnce({
        data: {
          text: 'Số lô: IMG-001\nCảm quan: Đạt yêu cầu',
          confidence: 95,
        },
      });

      const result = await extractRawTextWithTesseract(mockImgFile);

      expect(result.pageCount).toBe(1);
      expect(result.batchNo).toBe('IMG-001');
      expect(result.testResults.length).toBe(1);
      expect(result.testResults[0].criteriaName).toBe('Cảm quan');
      expect(result.testResults[0].sourcePageNumber).toBe(1);
      expect(result.rawText).toBe('Số lô: IMG-001\nCảm quan: Đạt yêu cầu');
    });
  });

  describe('4. isTesseractFallbackResult', () => {
    it('nhận diện đúng flag _isOfflineFallback', () => {
      expect(isTesseractFallbackResult({ _isOfflineFallback: true })).toBe(true);
      expect(isTesseractFallbackResult({ _isOfflineFallback: false })).toBe(false);
      expect(isTesseractFallbackResult(null)).toBe(false);
      expect(isTesseractFallbackResult({})).toBe(false);
    });
  });
});
