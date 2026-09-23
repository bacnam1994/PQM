import { describe, it, expect } from 'vitest';
import {
  isTableColumnHeaderRow,
  isBoundaryDuplicate,
  tryStitchBrokenBoundaryRows,
  harmonizeGroupedCriteria,
  resolveDocumentHeader,
  mergeMultiPageExtraction,
} from '../../src/services/ocr/multiPageMerger';
import type { ExtractedCriterionItem, PageExtractionResult } from '../../src/services/ocr/types';

describe('Multi-Page Merge Engine (OCR-07)', () => {
  describe('1. isTableColumnHeaderRow', () => {
    it('nhận diện chính xác các hàng tiêu đề cột bảng lặp lại ở đầu trang tiếp theo', () => {
      const headerItem1: ExtractedCriterionItem = {
        criteriaName: 'Tên chỉ tiêu',
        value: 'Kết quả thử nghiệm',
        unit: 'Đơn vị',
        limit: 'Mức yêu cầu',
        confidence: 'HIGH',
      };
      expect(isTableColumnHeaderRow(headerItem1)).toBe(true);

      const headerItem2: ExtractedCriterionItem = {
        criteriaName: 'Chỉ tiêu kiểm nghiệm:',
        value: '',
        confidence: 'MEDIUM',
      };
      expect(isTableColumnHeaderRow(headerItem2)).toBe(true);

      const headerItem3: ExtractedCriterionItem = {
        criteriaName: '1',
        value: 'Tên chỉ tiêu',
        confidence: 'LOW',
      };
      expect(isTableColumnHeaderRow(headerItem3)).toBe(true);

      const headerItemEn: ExtractedCriterionItem = {
        criteriaName: 'Test Item',
        value: 'Specification',
        confidence: 'HIGH',
      };
      expect(isTableColumnHeaderRow(headerItemEn)).toBe(true);
    });

    it('không nhận diện nhầm các chỉ tiêu thật có tên chứa từ khóa kiểm nghiệm', () => {
      const realItem1: ExtractedCriterionItem = {
        criteriaName: 'Chỉ tiêu độ ẩm',
        value: '4.8%',
        unit: '%',
        limit: '≤ 9.0%',
        confidence: 'HIGH',
      };
      expect(isTableColumnHeaderRow(realItem1)).toBe(false);

      const realItem2: ExtractedCriterionItem = {
        criteriaName: 'Định lượng Paracetamol',
        value: '502.4 mg/viên',
        unit: 'mg/viên',
        limit: '475 - 525 mg/viên',
        confidence: 'HIGH',
      };
      expect(isTableColumnHeaderRow(realItem2)).toBe(false);
    });
  });

  describe('2. isBoundaryDuplicate', () => {
    it('bỏ qua nếu 2 item cùng thuộc một trang', () => {
      const itemA: ExtractedCriterionItem = {
        criteriaName: 'Độ hòa tan',
        value: '95.2%',
        unit: '%',
        sourcePageNumber: 1,
      };
      const itemB: ExtractedCriterionItem = {
        criteriaName: 'Độ hòa tan',
        value: '95.2%',
        unit: '%',
        sourcePageNumber: 1,
      };
      // Cùng trang thì không phải boundary duplicate (không được tùy tiện xóa)
      expect(isBoundaryDuplicate(itemA, itemB)).toBe(false);
    });

    it('phát hiện đúng dòng quét chồng mép (duplicate scan) tại ranh giới chuyển trang', () => {
      const lastItemPage1: ExtractedCriterionItem = {
        criteriaName: 'Độ rã',
        value: 'Đạt (dưới 15 phút)',
        unit: '',
        sourcePageNumber: 1,
      };
      const firstItemPage2: ExtractedCriterionItem = {
        criteriaName: 'Độ rã',
        value: 'Đạt (dưới 15 phút)',
        unit: '',
        sourcePageNumber: 2,
      };
      expect(isBoundaryDuplicate(lastItemPage1, firstItemPage2)).toBe(true);
    });

    it('không nhận nhầm 2 chỉ tiêu khác nhau hoặc khác kết quả giữa 2 trang', () => {
      const lastItemPage1: ExtractedCriterionItem = {
        criteriaName: 'Tạp chất A',
        value: '0.05%',
        sourcePageNumber: 1,
      };
      const firstItemPage2: ExtractedCriterionItem = {
        criteriaName: 'Tạp chất B',
        value: '0.05%',
        sourcePageNumber: 2,
      };
      expect(isBoundaryDuplicate(lastItemPage1, firstItemPage2)).toBe(false);
    });
  });

  describe('3. tryStitchBrokenBoundaryRows', () => {
    it('trả về null nếu 2 item cùng thuộc một trang', () => {
      const a: ExtractedCriterionItem = {
        criteriaName: 'Độ ẩm-',
        value: '',
        sourcePageNumber: 1,
      };
      const b: ExtractedCriterionItem = {
        criteriaName: '',
        value: '4.5%',
        sourcePageNumber: 1,
      };
      expect(tryStitchBrokenBoundaryRows(a, b)).toBeNull();
    });

    it('hàn gắn trường hợp trang 1 chỉ có tên chỉ tiêu, trang 2 chứa kết quả', () => {
      const lastItemPage1: ExtractedCriterionItem = {
        criteriaName: 'Độ đồng đều hàm lượng theo khối lượng',
        value: '',
        sourcePageNumber: 1,
        confidenceScore: 92,
        rawText: 'Độ đồng đều hàm lượng theo khối lượng',
      };
      const firstItemPage2: ExtractedCriterionItem = {
        criteriaName: '-',
        value: 'Đạt yêu cầu phép thử',
        unit: '',
        limit: 'Phù hợp DĐVN V',
        sourcePageNumber: 2,
        confidence: 'HIGH',
        confidenceScore: 88,
        rawText: '- | Đạt yêu cầu phép thử | Phù hợp DĐVN V',
      };

      const stitched = tryStitchBrokenBoundaryRows(lastItemPage1, firstItemPage2);
      expect(stitched).not.toBeNull();
      expect(stitched?.criteriaName).toBe('Độ đồng đều hàm lượng theo khối lượng');
      expect(stitched?.value).toBe('Đạt yêu cầu phép thử');
      expect(stitched?.limit).toBe('Phù hợp DĐVN V');
      expect(stitched?.sourcePageNumber).toBe(1);
      expect(stitched?.confidenceScore).toBe(88);
      expect(stitched?.rawText).toContain('Độ đồng đều hàm lượng theo khối lượng');
      expect(stitched?.rawText).toContain('Đạt yêu cầu phép thử');
    });

    it('hàn gắn trường hợp tên chỉ tiêu bị ngắt bằng dấu nối (hyphenation) ở cuối trang 1', () => {
      const lastItemPage1: ExtractedCriterionItem = {
        criteriaName: 'Định lượng Ibupro-',
        value: '',
        sourcePageNumber: 1,
        rawText: 'Định lượng Ibupro-',
      };
      const firstItemPage2: ExtractedCriterionItem = {
        criteriaName: 'fen',
        value: '398.5 mg',
        unit: 'mg',
        limit: '380 - 420 mg',
        sourcePageNumber: 2,
        confidence: 'HIGH',
        rawText: 'fen | 398.5 mg',
      };

      const stitched = tryStitchBrokenBoundaryRows(lastItemPage1, firstItemPage2);
      expect(stitched).not.toBeNull();
      expect(stitched?.criteriaName).toBe('Định lượng Ibuprofen');
      expect(stitched?.value).toBe('398.5 mg');
      expect(stitched?.unit).toBe('mg');
      expect(stitched?.sourcePageNumber).toBe(1);
    });
  });

  describe('4. harmonizeGroupedCriteria', () => {
    it('loại bỏ dòng tiêu đề nhóm không có giá trị và giữ nguyên toàn bộ các chỉ tiêu con', () => {
      const rawItems: ExtractedCriterionItem[] = [
        {
          criteriaName: 'Cảm quan',
          value: 'Viên nén màu trắng',
          sourcePageNumber: 1,
        },
        {
          criteriaName: 'Giới hạn vi sinh vật',
          value: '',
          limit: '',
          sourcePageNumber: 1,
        },
        {
          criteriaName: 'Tổng số vi sinh vật hiếu khí (TAMC)',
          value: '< 10 CFU/g',
          unit: 'CFU/g',
          limit: '≤ 10^3 CFU/g',
          sourcePageNumber: 1,
        },
        {
          criteriaName: 'Tổng số nấm men và nấm mốc (TYMC)',
          value: 'Không phát hiện',
          unit: 'CFU/g',
          limit: '≤ 10^2 CFU/g',
          sourcePageNumber: 1,
        },
      ];

      const harmonized = harmonizeGroupedCriteria(rawItems);
      expect(harmonized.length).toBe(3);
      expect(harmonized[0].criteriaName).toBe('Cảm quan');
      expect(harmonized[1].criteriaName).toBe('Tổng số vi sinh vật hiếu khí (TAMC)');
      expect(harmonized[2].criteriaName).toBe('Tổng số nấm men và nấm mốc (TYMC)');
    });

    it('loại bỏ dòng tiêu đề cột bảng xuất hiện trong danh sách', () => {
      const items: ExtractedCriterionItem[] = [
        {
          criteriaName: 'Tên chỉ tiêu',
          value: 'Kết quả',
          sourcePageNumber: 2,
        },
        {
          criteriaName: 'Độ tan',
          value: 'Hoàn toàn',
          sourcePageNumber: 2,
        },
      ];
      const result = harmonizeGroupedCriteria(items);
      expect(result.length).toBe(1);
      expect(result[0].criteriaName).toBe('Độ tan');
    });
  });

  describe('5. resolveDocumentHeader', () => {
    it('ưu tiên tên lab đầy đủ/dài nhất và ngày tháng định dạng chuẩn DD/MM/YYYY', () => {
      const page1: PageExtractionResult = {
        pageNumber: 1,
        status: 'SUCCESS',
        labName: 'TTKN',
        productName: 'Paracetamol',
        mfgDate: '2024-01-01', // sai format chuẩn DD/MM/YYYY
        expDate: '01/01/2027',
        batchNo: 'L2401',
      };
      const page2: PageExtractionResult = {
        pageNumber: 2,
        status: 'SUCCESS',
        labName: 'Trung tâm Kiểm nghiệm Thuốc & Mỹ phẩm TP.HCM',
        productName: 'Paracetamol 500mg viên nén',
        productCode: 'TP-PARA-500',
        mfgDate: '01/01/2024', // chuẩn DD/MM/YYYY
        testDate: '15/01/2024',
      };

      const header = resolveDocumentHeader([page1, page2]);
      expect(header.labName).toBe('Trung tâm Kiểm nghiệm Thuốc & Mỹ phẩm TP.HCM');
      expect(header.productName).toBe('Paracetamol 500mg viên nén');
      expect(header.productCode).toBe('TP-PARA-500');
      expect(header.batchNo).toBe('L2401');
      expect(header.mfgDate).toBe('01/01/2024');
      expect(header.expDate).toBe('01/01/2027');
      expect(header.testDate).toBe('15/01/2024');
    });
  });

  describe('6. mergeMultiPageExtraction (End-to-End Orchestration)', () => {
    it('hợp nhất tài liệu 2 trang hoàn chỉnh: khử trùng lặp mép, loại bỏ header lặp, gắn cờ trang nguồn', () => {
      const page1: PageExtractionResult = {
        pageNumber: 1,
        status: 'SUCCESS',
        labName: 'Viện Kiểm nghiệm Thuốc TW',
        batchNo: 'L0924',
        productName: 'Amoxicillin 500mg',
        notes: 'Mẫu kiểm tra đạt chỉ tiêu hóa lý',
        testResults: [
          {
            criteriaName: 'Hình thức',
            value: 'Bột màu trắng',
            sourcePageNumber: 1,
          },
          {
            criteriaName: 'Độ ẩm',
            value: '5.1%',
            sourcePageNumber: 1,
          },
          {
            criteriaName: 'Độ hòa tan',
            value: '88.5%',
            sourcePageNumber: 1,
          },
        ],
      };

      const page2: PageExtractionResult = {
        pageNumber: 2,
        status: 'SUCCESS',
        notes: 'Bảo quản nơi khô ráo',
        testResults: [
          // Dòng tiêu đề cột lặp lại ở đầu trang 2
          {
            criteriaName: 'Tên chỉ tiêu',
            value: 'Kết quả thử nghiệm',
            sourcePageNumber: 2,
          },
          // Dòng quét trùng mép cuối trang 1
          {
            criteriaName: 'Độ hòa tan',
            value: '88.5%',
            sourcePageNumber: 2,
          },
          // Chỉ tiêu trang 2
          {
            criteriaName: 'Định lượng',
            value: '499.2 mg/viên',
            sourcePageNumber: 2,
          },
        ],
      };

      const merged = mergeMultiPageExtraction([page1, page2], 2);

      expect(merged.labName).toBe('Viện Kiểm nghiệm Thuốc TW');
      expect(merged.batchNo).toBe('L0924');
      expect(merged.pageCount).toBe(2);
      expect(merged.failedPages).toEqual([]);

      // Kiểm tra danh sách chỉ tiêu:
      // Phải có: Hình thức (p1), Độ ẩm (p1), Độ hòa tan (p1), Định lượng (p2)
      // Loại bỏ: Tiêu đề cột (Tên chỉ tiêu) và bản sao mép (Độ hòa tan p2)
      expect(merged.testResults.length).toBe(4);
      expect(merged.testResults.map((t) => t.criteriaName)).toEqual([
        'Hình thức',
        'Độ ẩm',
        'Độ hòa tan',
        'Định lượng',
      ]);
      expect(merged.testResults[0].sourcePageNumber).toBe(1);
      expect(merged.testResults[3].sourcePageNumber).toBe(2);

      // Ghi chú hợp nhất có tag [Trang X]
      expect(merged.notes).toContain('[Trang 1]: Mẫu kiểm tra đạt chỉ tiêu hóa lý');
      expect(merged.notes).toContain('[Trang 2]: Bảo quản nơi khô ráo');
    });

    it('ghi nhận cảnh báo trang lỗi (failedPages) trong kết quả hợp nhất', () => {
      const page1: PageExtractionResult = {
        pageNumber: 1,
        status: 'SUCCESS',
        batchNo: 'L123',
        testResults: [{ criteriaName: 'Độ pH', value: '6.5', sourcePageNumber: 1 }],
      };
      const page2: PageExtractionResult = {
        pageNumber: 2,
        status: 'FAILED',
        error: 'Timeout',
        testResults: [],
      };

      const merged = mergeMultiPageExtraction([page1, page2], 2);
      expect(merged.failedPages).toEqual([2]);
      expect(merged.notes).toContain('[Cảnh báo: Không thể đọc dữ liệu trang: 2]');
      expect(merged.testResults.length).toBe(1);
    });
  });
});
