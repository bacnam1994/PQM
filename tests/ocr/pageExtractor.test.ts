import { describe, it, expect, vi } from 'vitest';
import {
  buildPageExtractionPrompt,
  extractSinglePageData,
  mergeMultiPageResults,
  extractAllPagesSequentially,
} from '../../src/services/ocr/pageExtractor';
import type {
  RenderedPageResult,
  PageExtractionResult,
  DocumentContext,
} from '../../src/services/ocr/types';

describe('Per-Page Extraction & Context Preservation (OCR-05)', () => {
  const dummyBasePrompt = 'Bạn là chuyên gia phân tích phiếu kiểm nghiệm dược phẩm.';

  describe('1. buildPageExtractionPrompt', () => {
    it('trang hoàng prompt đơn trang chính xác với chỉ dẫn số trang', () => {
      const prompt = buildPageExtractionPrompt(dummyBasePrompt, 1, 1);
      expect(prompt).toContain('NGỮ CẢNH TRANG TÀI LIỆU (1/1)');
      expect(prompt).toContain('sourcePageNumber": 1');
      expect(prompt).not.toContain('LƯU Ý BẢNG NỐI TRANG');
    });

    it('trang hoàng prompt trang 2/3 với thông tin số lô, lab và bảng nối trang từ ngữ cảnh trang trước', () => {
      const context: DocumentContext = {
        batchNo: 'L240901',
        labName: 'Trung tâm Kiểm nghiệm Hà Nội',
        lastItemFromPreviousPage: 'Độ đồng đều khối lượng',
      };
      const prompt = buildPageExtractionPrompt(dummyBasePrompt, 2, 3, context);

      expect(prompt).toContain('NGỮ CẢNH TRANG TÀI LIỆU (2/3)');
      expect(prompt).toContain('Số lô sản xuất đã ghi nhận từ trang trước: "L240901"');
      expect(prompt).toContain('Đơn vị kiểm nghiệm: "Trung tâm Kiểm nghiệm Hà Nội"');
      expect(prompt).toContain('LƯU Ý BẢNG NỐI TRANG: Trang 2 là phần tiếp nối bảng chỉ tiêu');
      expect(prompt).toContain('Chỉ tiêu cuối cùng của trang trước là: "Độ đồng đều khối lượng"');
      expect(prompt).toContain('sourcePageNumber": 2');
    });
  });

  describe('2. extractSinglePageData', () => {
    const mockPage: RenderedPageResult = {
      pageNumber: 2,
      dataUrl: 'data:image/png;base64,mock',
      base64: 'mock',
      width: 2000,
      height: 2800,
      dpiCalculated: 250,
      mimeType: 'image/png',
      byteSize: 50000,
    };

    it('gán cứng sourcePageNumber = page.pageNumber cho toàn bộ các chỉ tiêu trích xuất được', async () => {
      const mockRawOcrCall = vi.fn().mockResolvedValue({
        labName: 'Lab Alpha',
        batchNo: 'B999',
        testResults: [
          {
            criteriaName: 'Độ rã',
            mappedName: 'Độ rã',
            confidence: 'high',
            value: '12 phút',
            unit: 'phút',
            limit: '≤ 15 phút',
            // Lưu ý: AI không tự trả về sourcePageNumber
          },
          {
            criteriaName: 'Định lượng Paracetamol',
            mappedName: 'Định lượng',
            confidence: 'high',
            value: '502.4',
            unit: 'mg/viên',
            limit: '475.0 - 525.0 mg/viên',
          },
        ],
      });

      const res = await extractSinglePageData(mockPage, 3, {}, dummyBasePrompt, mockRawOcrCall);

      expect(res.status).toBe('SUCCESS');
      expect(res.pageNumber).toBe(2);
      expect(res.testResults).toHaveLength(2);
      expect(res.testResults[0].sourcePageNumber).toBe(2);
      expect(res.testResults[1].sourcePageNumber).toBe(2);
      expect(res.testResults[1].value).toBe('502.4');
      expect(res.testResults[1].unit).toBe('mg/viên');
    });

    it('xử lý an toàn khi trang gặp lỗi ngoại lệ mà không làm crash tiến trình', async () => {
      const mockRawOcrCall = vi.fn().mockRejectedValue(new Error('Rate limit 429'));

      const res = await extractSinglePageData(mockPage, 3, {}, dummyBasePrompt, mockRawOcrCall);

      expect(res.status).toBe('FAILED');
      expect(res.errorMessage).toContain('Rate limit 429');
      expect(res.testResults).toHaveLength(0);
    });
  });

  describe('3. mergeMultiPageResults', () => {
    it('hợp nhất đầy đủ chỉ tiêu của các trang và bảo toàn sourcePageNumber cho từng mục', () => {
      const page1: PageExtractionResult = {
        pageNumber: 1,
        totalPages: 2,
        labName: 'Viện Kiểm nghiệm Thuốc',
        batchNo: '010226',
        testDate: '15/09/2026',
        testResults: [
          {
            criteriaName: 'Tính chất',
            mappedName: 'Tính chất',
            confidence: 'high',
            value: 'Viên nén màu trắng',
            sourcePageNumber: 1,
          },
          {
            criteriaName: 'Độ ẩm',
            mappedName: 'Độ ẩm',
            confidence: 'high',
            value: '4.8',
            unit: '%',
            limit: '≤ 7.0 %',
            sourcePageNumber: 1,
          },
        ],
        status: 'SUCCESS',
      };

      const page2: PageExtractionResult = {
        pageNumber: 2,
        totalPages: 2,
        notes: 'Mẫu đạt tiêu chuẩn Dược điển V',
        testResults: [
          {
            criteriaName: 'Độ hòa tan',
            mappedName: 'Độ hòa tan',
            confidence: 'high',
            value: '85.2',
            unit: '%',
            limit: '≥ 75 %',
            sourcePageNumber: 2,
          },
          {
            criteriaName: 'Định lượng',
            mappedName: 'Định lượng',
            confidence: 'high',
            value: '99.5',
            unit: '%',
            sourcePageNumber: 2,
          },
        ],
        status: 'SUCCESS',
      };

      const merged = mergeMultiPageResults([page1, page2], 2);

      expect(merged.pageCount).toBe(2);
      expect(merged.labName).toBe('Viện Kiểm nghiệm Thuốc');
      expect(merged.batchNo).toBe('010226');
      expect(merged.testDate).toBe('15/09/2026');
      expect(merged.notes).toBe('Mẫu đạt tiêu chuẩn Dược điển V');
      expect(merged.testResults).toHaveLength(4);
      expect(merged.testResults[0].sourcePageNumber).toBe(1);
      expect(merged.testResults[1].sourcePageNumber).toBe(1);
      expect(merged.testResults[2].sourcePageNumber).toBe(2);
      expect(merged.testResults[3].sourcePageNumber).toBe(2);
      expect(merged.failedPages).toHaveLength(0);
    });

    it('loại trừ an toàn dòng tiêu đề bảng lặp lại ở ranh giới trang mà không làm mất chỉ tiêu thật', () => {
      const itemDuplicated: any = {
        criteriaName: 'Độ ẩm',
        value: '4.8',
        unit: '%',
      };

      const page1: PageExtractionResult = {
        pageNumber: 1,
        totalPages: 2,
        testResults: [{ ...itemDuplicated, sourcePageNumber: 1, confidence: 'high' }],
        status: 'SUCCESS',
      };

      const page2: PageExtractionResult = {
        pageNumber: 2,
        totalPages: 2,
        testResults: [
          // Dòng đầu trang 2 lặp lại nguyên xi dòng cuối trang 1 (Header/repeat row)
          { ...itemDuplicated, sourcePageNumber: 2, confidence: 'high' },
          {
            criteriaName: 'Tạp chất',
            value: '0.02',
            unit: '%',
            sourcePageNumber: 2,
            confidence: 'high',
          },
        ],
        status: 'SUCCESS',
      };

      const merged = mergeMultiPageResults([page1, page2], 2);
      // Dòng lặp bị bỏ qua, chỉ còn 1 Độ ẩm và 1 Tạp chất
      expect(merged.testResults).toHaveLength(2);
      expect(merged.testResults[0].criteriaName).toBe('Độ ẩm');
      expect(merged.testResults[1].criteriaName).toBe('Tạp chất');
    });

    it('xử lý phục hồi khi có trang bị lỗi: giữ lại dữ liệu trang thành công và ghi chú cảnh báo', () => {
      const page1: PageExtractionResult = {
        pageNumber: 1,
        totalPages: 2,
        batchNo: 'BATCH-ERR',
        testResults: [
          { criteriaName: 'Chỉ tiêu 1', value: 'Đạt', sourcePageNumber: 1, confidence: 'high' },
        ],
        status: 'SUCCESS',
      };

      const page2: PageExtractionResult = {
        pageNumber: 2,
        totalPages: 2,
        testResults: [],
        status: 'FAILED',
        errorMessage: 'Connection reset',
      };

      const merged = mergeMultiPageResults([page1, page2], 2);

      expect(merged.testResults).toHaveLength(1);
      expect(merged.failedPages).toEqual([2]);
      expect(merged.notes).toContain('Không thể đọc dữ liệu trang: 2');
    });
  });

  describe('4. extractAllPagesSequentially', () => {
    it('chạy tuần tự qua các trang và truyền runningContext từ trang 1 sang trang 2', async () => {
      const mockPages: RenderedPageResult[] = [
        {
          pageNumber: 1,
          dataUrl: 'data:image/png;base64,p1',
          base64: 'p1',
          width: 1000,
          height: 1400,
          dpiCalculated: 250,
          mimeType: 'image/png',
          byteSize: 1000,
        },
        {
          pageNumber: 2,
          dataUrl: 'data:image/png;base64,p2',
          base64: 'p2',
          width: 1000,
          height: 1400,
          dpiCalculated: 250,
          mimeType: 'image/png',
          byteSize: 1000,
        },
      ];

      const capturedPrompts: string[] = [];

      const mockCaller = vi
        .fn()
        .mockImplementation(async (prompt: string, page: RenderedPageResult) => {
          capturedPrompts.push(prompt);
          if (page.pageNumber === 1) {
            return {
              labName: 'Trung tâm Quatest 1',
              batchNo: 'LOT-2026-ABC',
              testResults: [{ criteriaName: 'pH', value: '6.5', confidence: 'high' }],
            };
          } else {
            return {
              testResults: [
                {
                  criteriaName: 'Kim loại nặng',
                  value: '< 10 ppm',
                  unit: 'ppm',
                  confidence: 'high',
                },
              ],
            };
          }
        });

      const onProgress = vi.fn();

      const result = await extractAllPagesSequentially(mockPages, dummyBasePrompt, mockCaller, {
        onPageProgress: onProgress,
      });

      expect(result.pageCount).toBe(2);
      expect(result.labName).toBe('Trung tâm Quatest 1');
      expect(result.batchNo).toBe('LOT-2026-ABC');
      expect(result.testResults).toHaveLength(2);
      expect(result.testResults[0].sourcePageNumber).toBe(1);
      expect(result.testResults[1].sourcePageNumber).toBe(2);

      // Prompt trang 2 phải chứa số lô và tên lab lấy được từ trang 1
      expect(capturedPrompts[1]).toContain('LOT-2026-ABC');
      expect(capturedPrompts[1]).toContain('Trung tâm Quatest 1');
      expect(capturedPrompts[1]).toContain('Chỉ tiêu cuối cùng của trang trước là: "pH"');

      expect(onProgress).toHaveBeenCalledTimes(2);
    });

    it('ném lỗi khi toàn bộ các trang đều thất bại để kích hoạt offline fallback', async () => {
      const mockPages: RenderedPageResult[] = [
        {
          pageNumber: 1,
          dataUrl: 'mock',
          base64: 'mock',
          width: 100,
          height: 100,
          dpiCalculated: 250,
          mimeType: 'image/png',
          byteSize: 100,
        },
      ];

      const mockCaller = vi.fn().mockRejectedValue(new Error('Network dead'));

      await expect(
        extractAllPagesSequentially(mockPages, dummyBasePrompt, mockCaller, {
          maxRetriesPerPage: 0,
        })
      ).rejects.toThrow('Tất cả 1 trang đều thất bại');
    });
  });
});
