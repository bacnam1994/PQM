/**
 * performanceBenchmark.test.ts
 * =============================
 * Benchmark kiểm chứng hiệu năng định lượng (Phase 7).
 * Tuân thủ quy tắc: Đo lường thời gian thực thi định lượng Trước/Sau,
 * đối chiếu trực tiếp với các ngưỡng mục tiêu SLA của PQM.
 */

import { describe, it, expect } from 'vitest';
import { QualityEvaluationEngine } from '../domain/evaluation/QualityEvaluationEngine';
import { UniversalInvertedIndex } from '../services/core/universalSearchIndex';
import { aggregateBatchSPC } from '../utils/spcEngine';
import { Product, Batch, TCCS, TestResult } from '../types';

describe('Phase 7: Performance Benchmarks & SLA Verification', () => {
  const engine = new QualityEvaluationEngine();

  it('Benchmark 1: Đánh giá 1 chỉ tiêu đơn lẻ (Single Criterion Evaluation) < 1ms', () => {
    const criterion = {
      name: 'Độ ẩm',
      limit: '4.0 - 6.0%',
      type: 'TOLERANCE' as const,
    };
    const value = '5.2%';

    // Warm-up JIT
    for (let i = 0; i < 50; i++) {
      QualityEvaluationEngine.evaluateCriterionSmart(criterion, value);
    }

    const runs = 1000;
    const start = performance.now();
    for (let i = 0; i < runs; i++) {
      QualityEvaluationEngine.evaluateCriterionSmart(criterion, value);
    }
    const totalMs = performance.now() - start;
    const avgPerCriterionMs = totalMs / runs;

    console.log(
      `[Benchmark 1] Single criterion avg: ${avgPerCriterionMs.toFixed(4)}ms (Target: < 1.0ms)`
    );
    expect(avgPerCriterionMs).toBeLessThan(1.0);
  });

  it('Benchmark 2: Đánh giá lô 100 chỉ tiêu liên tiếp (100 Criteria Batch) < 20ms', () => {
    const criteria = Array.from({ length: 100 }, (_, i) => ({
      name: `Chỉ tiêu ${i}`,
      limit: i % 2 === 0 ? '90.0 - 110.0%' : '< 10 CFU/g',
      type: 'TOLERANCE' as const,
    }));
    const values = Array.from({ length: 100 }, (_, i) => (i % 2 === 0 ? '99.5%' : '< 10'));

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      QualityEvaluationEngine.evaluateCriterionSmart(criteria[i], values[i]);
    }
    const durationMs = performance.now() - start;

    console.log(
      `[Benchmark 2] 100 criteria evaluation: ${durationMs.toFixed(3)}ms (Target: < 20.0ms)`
    );
    expect(durationMs).toBeLessThan(20.0);
  });

  it('Benchmark 3: Tra cứu chỉ mục tìm kiếm Universal Inverted Search < 150ms trên 2,000 bản ghi', () => {
    // Giả lập dataset quy mô lớn (Large Dataset: 2,000 bản ghi)
    const largeProducts: Product[] = Array.from({ length: 500 }, (_, i) => ({
      id: `prod-${i}`,
      code: `SP-${1000 + i}`,
      name: `Dược phẩm kiểm nghiệm lô cao cấp ${i} Paracetamol Acetaminophen`,
      status: 'ACTIVE',
    })) as any;

    const largeBatches: Batch[] = Array.from({ length: 1500 }, (_, i) => ({
      id: `batch-${i}`,
      batchNo: `LOT2026-${10000 + i}`,
      productId: `prod-${i % 500}`,
      status: 'RELEASED',
    })) as any;

    const index = new UniversalInvertedIndex({
      products: largeProducts,
      batches: largeBatches,
    });

    const queries = ['Paracetamol', 'LOT2026-10500', 'Acetaminophen', 'SP-1200'];

    const durations: number[] = [];
    for (const q of queries) {
      const res = index.searchPaginated(q, 1, 20);
      durations.push(res.searchDurationMs);
      expect(res.results.length).toBeGreaterThan(0);
    }

    const avgSearchMs = durations.reduce((a, b) => a + b, 0) / durations.length;
    console.log(
      `[Benchmark 3] Universal Search Avg Duration: ${avgSearchMs.toFixed(3)}ms (Target: < 150ms)`
    );
    expect(avgSearchMs).toBeLessThan(150.0);
  });

  it('Benchmark 4: Tổng hợp thống kê SPC & Năng lực Cpk/Ppk trên 1,000 lô < 100ms', () => {
    // 1,000 mẫu kiểm nghiệm lịch sử
    const records = Array.from({ length: 1000 }, (_, i) => ({
      batchNo: `LOT-${i}`,
      mfgDate: '2026-01-01',
      value: 100 + Math.sin(i) * 2 + (i % 10 === 0 ? 0.5 : 0),
    }));

    const start = performance.now();
    const summary = aggregateBatchSPC(records, { usl: 105, lsl: 95, target: 100 });
    const durationMs = performance.now() - start;

    console.log(
      `[Benchmark 4] SPC Aggregation (1,000 records): ${durationMs.toFixed(3)}ms (Target: < 100ms)`
    );
    expect(durationMs).toBeLessThan(100.0);
    expect(summary.sampleSize).toBe(1000);
    expect(summary.parameters.mean).toBeGreaterThan(95);
    expect(summary.parameters.mean).toBeLessThan(105);
  });

  it('Benchmark 5: Hydration & Indexing Data Graph trên quy mô lớn < 100ms', () => {
    // Giả lập tập dữ liệu: 300 Products, 1,000 Batches, 300 TCCS, 2,000 Test Results
    const rawProducts = Array.from({ length: 300 }, (_, i) => ({
      id: `p-${i}`,
      name: `Prod ${i}`,
    }));
    const rawBatches = Array.from({ length: 1000 }, (_, i) => ({
      id: `b-${i}`,
      productId: `p-${i % 300}`,
      tccsId: `t-${i % 300}`,
    }));
    const rawTccs = Array.from({ length: 300 }, (_, i) => ({ id: `t-${i}`, productId: `p-${i}` }));
    const rawTests = Array.from({ length: 2000 }, (_, i) => ({
      id: `tr-${i}`,
      batchId: `b-${i % 1000}`,
      overallStatus: 'PASS' as const,
    }));

    const start = performance.now();

    // Data Graph Primary & Secondary Indexing
    const productsById = new Map(rawProducts.map((p) => [p.id, p]));
    const batchesById = new Map(rawBatches.map((b) => [b.id, b]));
    const tccsById = new Map(rawTccs.map((t) => [t.id, t]));
    const testResultsById = new Map(rawTests.map((t) => [t.id, t]));

    const batchesByProductId = new Map<string, typeof rawBatches>();
    rawBatches.forEach((b) => {
      const list = batchesByProductId.get(b.productId) || [];
      list.push(b);
      batchesByProductId.set(b.productId, list);
    });

    const testResultsByBatchId = new Map<string, typeof rawTests>();
    rawTests.forEach((t) => {
      const list = testResultsByBatchId.get(t.batchId) || [];
      list.push(t);
      testResultsByBatchId.set(t.batchId, list);
    });

    const durationMs = performance.now() - start;

    console.log(
      `[Benchmark 5] Data Graph Indexing (3,600 entities): ${durationMs.toFixed(3)}ms (Target: < 100ms)`
    );
    expect(durationMs).toBeLessThan(100.0);
    expect(batchesByProductId.get('p-0')?.length).toBeGreaterThan(0);
    expect(testResultsByBatchId.get('b-0')?.length).toBeGreaterThan(0);
  });
});
