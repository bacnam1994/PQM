import { describe, it, expect } from 'vitest';
import { PHARMA_DATA_INTEGRITY_GUIDE, buildExtractionPrompt } from '../../src/services/ai/prompts';
import { extractSinglePageData, mergeMultiPageResults } from '../../src/services/ocr/pageExtractor';
import type { PageExtractionInput } from '../../src/services/ocr/types';

describe('Gemini Vision Extraction & Schema Hardening (OCR-06)', () => {
  describe('1. PHARMA_DATA_INTEGRITY_GUIDE & Prompt Hardening', () => {
    it('chứa đầy đủ các quy tắc bảo toàn tính toàn vẹn dữ liệu dược phẩm', () => {
      expect(PHARMA_DATA_INTEGRITY_GUIDE).toContain('BẢO TOÀN DẤU THẬP PHÂN & SỐ 0 (Rule 3)');
      expect(PHARMA_DATA_INTEGRITY_GUIDE).toContain(
        'PHÂN BIỆT KẾT QUẢ THỰC TẾ VÀ MỨC TIÊU CHUẨN (Rule 5)'
      );
      expect(PHARMA_DATA_INTEGRITY_GUIDE).toContain('BẢO TOÀN KÝ HIỆU SO SÁNH & KHOA HỌC (Rule 6)');
      expect(PHARMA_DATA_INTEGRITY_GUIDE).toContain('ĐƠN VỊ ĐO LƯỜNG (Rule 4)');
      expect(PHARMA_DATA_INTEGRITY_GUIDE).toContain(
        'ĐIỂM TIN CẬY (confidenceScore: 0-100) & PHÂN LOẠI (Rule 11, 12)'
      );
    });

    it('prompt trích xuất hoàn chỉnh chứa cả cấu trúc JSON mới và hướng dẫn bảo vệ dữ liệu', () => {
      const prompt = buildExtractionPrompt(['Độ ẩm', 'Định lượng Paracetamol']);
      expect(prompt).toContain('"productCode"');
      expect(prompt).toContain('"productName"');
      expect(prompt).toContain('"confidenceScore"');
      expect(prompt).toContain('BẢO TOÀN DẤU THẬP PHÂN & SỐ 0');
      expect(prompt).toContain(
        'TUYỆT ĐỐI KHÔNG đưa giá trị mức giới hạn vào ô kết quả thực tế ("value")'
      );
    });
  });

  describe('2. Bóc tách & Chuẩn hóa Schema (Data Normalization)', () => {
    const mockPage: PageExtractionInput = {
      pageNumber: 1,
      base64: 'mock-base64',
      mimeType: 'image/png',
    };

    it('bóc tách chính xác productCode, productName, số thập phân 0.05, số 0 hợp lệ và ký hiệu khoa học', async () => {
      const mockRawResponse = {
        labName: 'Viện Kiểm Nghiệm Thuốc TW',
        documentType: 'External_Lab',
        productCode: 'VBT-GBE-500',
        productName: 'Viên nang Ginkgo Biloba 500mg',
        batchNo: 'LOT-2026-09',
        testResults: [
          {
            criteriaName: 'Chì (Pb)',
            mappedName: 'Chì',
            confidence: 'high',
            confidenceScore: 98,
            value: '0.05',
            unit: 'ppm',
            limit: '≤ 1.0 ppm',
            rawText: '1. Chì (Pb): 0.05 ppm (Giới hạn: ≤ 1.0 ppm)',
          },
          {
            criteriaName: 'Tạp chất A',
            mappedName: 'Tạp chất A',
            confidence: 'high',
            confidenceScore: 92,
            value: '0',
            unit: '%',
            limit: '≤ 0.1 %',
          },
          {
            criteriaName: 'Tổng số vi sinh vật hiếu khí (TAMC)',
            mappedName: 'Vi sinh vật hiếu khí',
            confidence: 'high',
            confidenceScore: 95,
            value: '< 10',
            unit: 'CFU/g',
            limit: '≤ 10³ CFU/g',
          },
          {
            criteriaName: 'Nấm mốc và nấm men',
            mappedName: '',
            confidence: 'low',
            confidenceScore: 68,
            value: '1.5 × 10²',
            unit: 'CFU/g',
          },
        ],
      };

      const pageResult = await extractSinglePageData(
        mockPage,
        1,
        {},
        'Prompt',
        vi.fn().mockResolvedValue(mockRawResponse)
      );

      expect(pageResult.status).toBe('SUCCESS');
      expect(pageResult.productCode).toBe('VBT-GBE-500');
      expect(pageResult.productName).toBe('Viên nang Ginkgo Biloba 500mg');
      expect(pageResult.testResults).toHaveLength(4);

      // 1. Kiểm tra số thập phân 0.05 không bị làm tròn hay biến thành 0.5
      const itemPb = pageResult.testResults[0];
      expect(itemPb.value).toBe('0.05');
      expect(itemPb.limit).toBe('≤ 1.0 ppm');
      expect(itemPb.confidenceScore).toBe(98);
      expect(itemPb.rawText).toContain('Chì (Pb)');

      // 2. Kiểm tra số 0 được bảo toàn nguyên vẹn
      const itemImpurity = pageResult.testResults[1];
      expect(itemImpurity.value).toBe('0');
      expect(itemImpurity.unit).toBe('%');

      // 3. Kiểm tra ký hiệu so sánh "< 10" và giới hạn "≤ 10³ CFU/g"
      const itemTamc = pageResult.testResults[2];
      expect(itemTamc.value).toBe('< 10');
      expect(itemTamc.unit).toBe('CFU/g');
      expect(itemTamc.limit).toBe('≤ 10³ CFU/g');

      // 4. Kiểm tra số mũ khoa học "1.5 × 10²" và confidenceScore thấp (Rule 12)
      const itemYeast = pageResult.testResults[3];
      expect(itemYeast.value).toBe('1.5 × 10²');
      expect(itemYeast.confidence).toBe('low');
      expect(itemYeast.confidenceScore).toBe(68);
      expect(itemYeast.confidenceScore).toBeLessThan(75);
    });

    it('hợp nhất đa trang kế thừa trọn vẹn productCode và productName từ trang 1', () => {
      const page1 = {
        pageNumber: 1,
        totalPages: 2,
        productCode: 'SKU-001',
        productName: 'Thuốc bột A',
        batchNo: 'B01',
        testResults: [
          {
            criteriaName: 'Độ ẩm',
            value: '3.5',
            unit: '%',
            confidence: 'high' as const,
            sourcePageNumber: 1,
          },
        ],
        status: 'SUCCESS' as const,
      };

      const page2 = {
        pageNumber: 2,
        totalPages: 2,
        testResults: [
          {
            criteriaName: 'Định lượng',
            value: '100.2',
            unit: '%',
            confidence: 'high' as const,
            sourcePageNumber: 2,
          },
        ],
        status: 'SUCCESS' as const,
      };

      const merged = mergeMultiPageResults([page1, page2], 2);

      expect(merged.productCode).toBe('SKU-001');
      expect(merged.productName).toBe('Thuốc bột A');
      expect(merged.batchNo).toBe('B01');
      expect(merged.testResults).toHaveLength(2);
    });

    it('tính toán fallback confidenceScore hợp lý khi AI không trả về trường này', async () => {
      const mockRaw = {
        testResults: [
          { criteriaName: 'C1', value: '10', confidence: 'high' },
          { criteriaName: 'C2', value: '20', confidence: 'medium' },
          { criteriaName: 'C3', value: '30', confidence: 'low' },
        ],
      };

      const res = await extractSinglePageData(
        mockPage,
        1,
        {},
        'P',
        vi.fn().mockResolvedValue(mockRaw)
      );
      expect(res.testResults[0].confidenceScore).toBe(95);
      expect(res.testResults[1].confidenceScore).toBe(80);
      expect(res.testResults[2].confidenceScore).toBe(60);
    });
  });
});
