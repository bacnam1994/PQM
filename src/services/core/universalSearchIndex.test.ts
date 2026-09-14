import { describe, it, expect } from 'vitest';
import {
  removeVietnameseAccents,
  tokenize,
  computeMatchScore,
  searchUniversal,
  UniversalSearchDataset,
  UniversalInvertedIndex,
} from './universalSearchIndex';

describe('Universal Search Index & Engine', () => {
  it('loại bỏ dấu tiếng Việt chính xác', () => {
    expect(removeVietnameseAccents('Định lượng Hoạt chất Ginkgo')).toBe(
      'dinh luong hoat chat ginkgo'
    );
    expect(removeVietnameseAccents('Lô sản xuất ĐẠT')).toBe('lo san xuat dat');
  });

  it('tokenize các cụm từ chính xác', () => {
    const tokens = tokenize('TCCS-01/2026: Định lượng (mg/viên)');
    expect(tokens).toContain('tccs');
    expect(tokens).toContain('01');
    expect(tokens).toContain('2026');
    expect(tokens).toContain('dinh');
    expect(tokens).toContain('luong');
  });

  it('tính điểm khớp ưu tiên mã code chính xác hơn text chung', () => {
    const scoreExactCode = computeMatchScore('L2601', 'L2601', true);
    const scorePrefixText = computeMatchScore('L2601', 'Lô sản xuất L2601 Đạt', false);
    expect(scoreExactCode).toBeGreaterThan(scorePrefixText);
  });

  it('tìm kiếm đa thực thể khớp chính xác khi gõ tiếng Việt không dấu', () => {
    const mockDataset: UniversalSearchDataset = {
      products: [
        {
          id: 'p1',
          code: 'SP-GINKGO',
          name: 'Viên nang Bạch Quả',
          status: 'ACTIVE',
        } as any,
      ],
      batches: [
        {
          id: 'b1',
          productId: 'p1',
          batchNo: 'L260901',
          mfgDate: '2026-09-01',
          status: 'RELEASED',
        } as any,
      ],
      rawMaterials: [
        {
          id: 'm1',
          code: 'NL-GINKGO',
          name: 'Cao khô lá Bạch Quả',
          casNumber: '90045-36-6',
          category: 'ACTIVE',
        } as any,
      ],
      deviations: [
        {
          id: 'd1',
          deviationNo: 'DEV-2026-001',
          title: 'Nhiệt độ phòng sấy vượt ngưỡng',
          severity: 'CRITICAL',
          status: 'LOGGED',
        } as any,
      ],
    };

    // Tìm kiếm "bach qua" không dấu -> phải tìm thấy cả Sản phẩm và Nguyên liệu
    const resBachQua = searchUniversal('bach qua', mockDataset);
    expect(resBachQua.length).toBeGreaterThanOrEqual(2);
    expect(resBachQua.some((r) => r.category === 'PRODUCT')).toBe(true);
    expect(resBachQua.some((r) => r.category === 'MATERIAL')).toBe(true);

    // Tìm kiếm số lô "L260901" -> Lô hàng phải lên đầu
    const resBatch = searchUniversal('L260901', mockDataset);
    expect(resBatch.length).toBeGreaterThanOrEqual(1);
    expect(resBatch[0].category).toBe('BATCH');
    expect(resBatch[0].title).toContain('L260901');

    // Tìm kiếm số CAS "90045-36-6" -> Nguyên liệu
    const resCas = searchUniversal('90045-36-6', mockDataset);
    expect(resCas.some((r) => r.category === 'MATERIAL')).toBe(true);

    // Tìm kiếm sai lệch "phong say" -> Sai lệch
    const resDev = searchUniversal('phong say', mockDataset);
    expect(resDev.some((r) => r.category === 'DEVIATION')).toBe(true);
  });

  it('UniversalInvertedIndex hỗ trợ tra cứu chỉ mục đảo với phân trang và thời gian tìm kiếm < 150ms', () => {
    const mockDataset: UniversalSearchDataset = {
      products: Array.from({ length: 50 }, (_, i) => ({
        id: `p-${i}`,
        code: `PROD-${i}`,
        name: `Dược phẩm mẫu ${i} Paracetamol`,
        status: 'ACTIVE',
      })) as any,
      batches: Array.from({ length: 100 }, (_, i) => ({
        id: `b-${i}`,
        batchNo: `LOT-${i}`,
        mfgDate: '2026-01-01',
        status: 'RELEASED',
      })) as any,
    };

    const index = new UniversalInvertedIndex(mockDataset);
    const paginated = index.searchPaginated('Paracetamol', 1, 10);

    expect(paginated.total).toBe(50);
    expect(paginated.results).toHaveLength(10);
    expect(paginated.page).toBe(1);
    expect(paginated.pageSize).toBe(10);
    expect(paginated.hasMore).toBe(true);
    expect(paginated.searchDurationMs).toBeLessThan(150);

    // Trang 2
    const page2 = index.searchPaginated('Paracetamol', 2, 10);
    expect(page2.results).toHaveLength(10);
    expect(page2.page).toBe(2);
    expect(page2.results[0].id).not.toBe(paginated.results[0].id);
  });
});
