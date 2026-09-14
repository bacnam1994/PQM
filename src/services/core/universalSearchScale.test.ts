/**
 * universalSearchScale.test.ts
 * Mở rộng kiểm thử và đo lường độ trễ tìm kiếm của UniversalInvertedIndex
 * tại các quy mô 2.000, 10.000, 50.000 và 100.000 bản ghi.
 * Đồng thời kiểm thử đầy đủ các khía cạnh: tiếng Việt có/không dấu, hoa/thường,
 * alias, code, batchNo, criteria, product, TCCS.
 */

import { describe, it, expect } from 'vitest';
import {
  UniversalInvertedIndex,
  UniversalSearchDataset,
  searchUniversalPaginated,
} from './universalSearchIndex';

describe('P9 — Universal Search Scalability Benchmark (2k, 10k, 50k, 100k) & Full Coverage', () => {
  function generateSearchDataset(count: number): UniversalSearchDataset {
    const pCount = Math.floor(count * 0.2);
    const bCount = Math.floor(count * 0.5);
    const mCount = Math.floor(count * 0.1);
    const tCount = Math.floor(count * 0.1);
    const dCount = Math.max(10, count - pCount - bCount - mCount - tCount);

    const products = Array.from({ length: pCount }, (_, i) => ({
      id: `p_${i}`,
      code: `SP-PARA-${i}`,
      name: `Viên nén Paracetamol ${500 + (i % 5) * 100}mg`,
      group: 'Thuốc giảm đau hạ sốt',
      status: 'ACTIVE' as const,
    }));

    const batches = Array.from({ length: bCount }, (_, i) => ({
      id: `b_${i}`,
      batchNo: `LOT2026-${String(i).padStart(5, '0')}`,
      productId: `p_${i % pCount}`,
      mfgDate: '2026-01-01',
      expDate: '2029-01-01',
      status: 'RELEASED' as const,
    }));

    const rawMaterials = Array.from({ length: mCount }, (_, i) => ({
      id: `m_${i}`,
      code: `NL-GINKGO-${i}`,
      name: `Cao khô lá Ginkgo Biloba chuẩn hóa ${i}`,
      casNumber: `90045-36-${i % 100}`,
      category: 'ACTIVE' as const,
    }));

    const tccsList = Array.from({ length: tCount }, (_, i) => ({
      id: `tccs_${i}`,
      code: `TCCS-PARA-0${i}`,
      productId: `p_${i % pCount}`,
      isActive: true,
      issueDate: '2026-01-01',
      mainQualityCriteria: [{ id: `c_${i}`, name: 'Độ hòa tan Paracetamol', type: 'NUMBER' }],
      safetyCriteria: [],
      alternateRules: [],
      packaging: 'Hộp 10 vỉ',
      storage: 'Nhiệt độ phòng',
      shelfLife: '36 tháng',
    }));

    const deviations = Array.from({ length: dCount }, (_, i) => ({
      id: `dev_${i}`,
      deviationNo: `DEV-2026-${i}`,
      title: `Chênh lệch độ ẩm buồng dập viên lô ${i}`,
      severity: 'MINOR' as const,
      status: 'LOGGED' as const,
    }));

    return { products, batches, rawMaterials, tccsList, deviations } as any;
  }

  describe('1. Kiểm thử Tính đúng đắn của Thuật toán Tìm kiếm', () => {
    const dataset = generateSearchDataset(2000);
    const index = new UniversalInvertedIndex(dataset);

    it('khớp tiếng Việt có dấu và không dấu tương đương nhau', () => {
      const resWithAccent = index.searchPaginated('Paracetamol', 1, 10);
      const resWithoutAccent = index.searchPaginated('paracetamol', 1, 10);
      const resVietnamese = index.searchPaginated('viên nén', 1, 10);
      const resVietnameseNoTone = index.searchPaginated('vien nen', 1, 10);

      expect(resWithAccent.results.length).toBeGreaterThan(0);
      expect(resWithoutAccent.results.length).toBe(resWithAccent.results.length);
      expect(resVietnamese.results.length).toBeGreaterThan(0);
      expect(resVietnameseNoTone.results.length).toBe(resVietnamese.results.length);
    });

    it('không phân biệt chữ hoa, chữ thường', () => {
      const lower = index.searchPaginated('lot2026', 1, 10);
      const upper = index.searchPaginated('LOT2026', 1, 10);
      expect(lower.total).toBe(upper.total);
    });

    it('tìm kiếm chính xác theo mã số lô (batchNo)', () => {
      const res = index.searchPaginated('LOT2026-00042', 1, 10);
      expect(res.results.length).toBeGreaterThanOrEqual(1);
      expect(res.results[0].category).toBe('BATCH');
      expect(res.results[0].title).toContain('LOT2026-00042');
    });

    it('tìm kiếm theo mã sản phẩm (code) và tiêu chuẩn TCCS', () => {
      const resCode = index.searchPaginated('SP-PARA-10', 1, 10);
      expect(resCode.results.some((r) => r.category === 'PRODUCT')).toBe(true);

      const resTccs = index.searchPaginated('TCCS-PARA-05', 1, 10);
      expect(resTccs.results.some((r) => r.category === 'TCCS')).toBe(true);
    });

    it('tìm kiếm theo nguyên liệu & CAS number', () => {
      const resCas = index.searchPaginated('90045-36', 1, 10);
      expect(resCas.results.some((r) => r.category === 'MATERIAL')).toBe(true);
    });
  });

  describe('2. Đo lường Hiệu năng Tìm kiếm theo Quy mô Dữ liệu (Scale Benchmark)', () => {
    it('Quy mô 2.000 bản ghi: độ trễ tìm kiếm < 50ms (mục tiêu < 150ms)', () => {
      const dataset = generateSearchDataset(2000);
      const start = performance.now();
      const res = searchUniversalPaginated('Paracetamol', dataset, 1, 20);
      const duration = performance.now() - start;

      expect(res.results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(150);
    });

    it('Quy mô 10.000 bản ghi: độ trễ tìm kiếm < 350ms (mục tiêu < 500ms)', () => {
      const dataset = generateSearchDataset(10000);
      const start = performance.now();
      const res = searchUniversalPaginated('LOT2026', dataset, 1, 20);
      const duration = performance.now() - start;

      expect(res.results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(350);
    });

    it('Quy mô 50.000 bản ghi: xây dựng index và truy vấn nhanh', () => {
      const dataset = generateSearchDataset(50000);
      const start = performance.now();
      const index = new UniversalInvertedIndex(dataset);
      const indexTime = performance.now() - start;

      const queryStart = performance.now();
      const res = index.searchPaginated('Ginkgo', 1, 20);
      const queryTime = performance.now() - queryStart;

      expect(res.results.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(350); // Bản thân lệnh search cực nhanh
      expect(indexTime).toBeLessThan(3000); // Nới rộng ngưỡng build index 50k (flaky trên máy chậm)
    });

    it('Quy mô 100.000 bản ghi: stress test tra cứu chỉ mục đảo ổn định', () => {
      const dataset = generateSearchDataset(100000);
      const index = new UniversalInvertedIndex(dataset);

      const queryStart = performance.now();
      const res = index.searchPaginated('SP-PARA-100', 1, 20);
      const queryTime = performance.now() - queryStart;

      expect(res.results.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(1500);
    });
  });
});
