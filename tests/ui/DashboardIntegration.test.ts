import { describe, it, expect } from 'vitest';
import { Batch, TestResult, Product, TCCS } from '../../src/types';
import { BATCH_STATUS, PRODUCT_STATUS } from '../../src/utils';
import { BatchInspectionProgressService } from '../../src/domain/batch/BatchInspectionProgressService';
import {
  DashboardStats,
  ExpiringBatchItem,
  MonthlyTestTrend,
} from '../../src/pages/system/dashboard/types';

describe('Dashboard Quality & Operational Logic Integration Tests', () => {
  const mockProducts: Product[] = [
    {
      id: 'p-1',
      code: 'PROD-01',
      name: 'Viên nang Ginkgo Biloba 120mg',
      status: PRODUCT_STATUS.ACTIVE,
    },
    {
      id: 'p-2',
      code: 'PROD-02',
      name: 'Siro Ho Bách Bộ V-Biotech',
      status: PRODUCT_STATUS.ACTIVE,
    },
    {
      id: 'p-3',
      code: 'PROD-03',
      name: 'Thuốc cốm Canxi Nano D3',
      status: PRODUCT_STATUS.DISCONTINUED,
    },
  ];

  const mockTccsList: TCCS[] = [
    { id: 'tccs-1', code: 'TCCS-GINKGO-01', productId: 'p-1', isActive: true } as any,
    { id: 'tccs-2', code: 'TCCS-SIRO-02', productId: 'p-2', isActive: true } as any,
    { id: 'tccs-3', code: 'TCCS-CANXI-03', productId: 'p-3', isActive: false } as any,
  ];

  const mockBatches: Batch[] = [
    // 1. Chờ tiếp nhận (PENDING)
    {
      id: 'b-1',
      batchNo: 'LOT-2026-001',
      productId: 'p-1',
      tccsId: 'tccs-1',
      status: BATCH_STATUS.PENDING,
      mfgDate: '2026-01-10',
      expDate: '2028-01-10',
      theoreticalYield: 10000,
      actualYield: 9950,
      yieldUnit: 'viên',
    },
    // 2. Chưa kiểm (TESTING & NOT_TESTED -> mapped to Stage 1 PENDING/NOT_TESTED)
    {
      id: 'b-2',
      batchNo: 'LOT-2026-002',
      productId: 'p-1',
      tccsId: 'tccs-1',
      status: BATCH_STATUS.TESTING,
      inspectionStatus: 'NOT_TESTED',
      progressPercent: 0,
      mfgDate: '2026-02-01',
      expDate: '2028-02-01',
      theoreticalYield: 5000,
      actualYield: 4980,
      yieldUnit: 'viên',
    },
    // 3. Đang kiểm nghiệm tại Lab (TESTING & IN_PROGRESS)
    {
      id: 'b-3',
      batchNo: 'LOT-2026-003',
      productId: 'p-2',
      tccsId: 'tccs-2',
      status: BATCH_STATUS.TESTING,
      inspectionStatus: 'IN_PROGRESS',
      progressPercent: 60,
      mfgDate: '2026-03-01',
      expDate: '2028-03-01',
      theoreticalYield: 2000,
      actualYield: 1980,
      yieldUnit: 'chai',
    },
    // 4. Chờ QA thẩm định (TESTING & PENDING_REVIEW)
    {
      id: 'b-4',
      batchNo: 'LOT-2026-004',
      productId: 'p-2',
      tccsId: 'tccs-2',
      status: BATCH_STATUS.TESTING,
      inspectionStatus: 'PENDING_REVIEW',
      progressPercent: 100,
      mfgDate: '2026-03-15',
      expDate: '2028-03-15',
      theoreticalYield: 3000,
      actualYield: 2990,
      yieldUnit: 'chai',
    },
    // 5. Đã xuất xưởng (RELEASED)
    {
      id: 'b-5',
      batchNo: 'LOT-2026-005',
      productId: 'p-1',
      tccsId: 'tccs-1',
      status: BATCH_STATUS.RELEASED,
      inspectionStatus: 'PASS',
      progressPercent: 100,
      mfgDate: '2026-01-05',
      expDate: '2026-11-15', // Sắp hết hạn trong ~20 ngày!
      theoreticalYield: 15000,
      actualYield: 14920,
      yieldUnit: 'viên',
    },
    // 6. Không đạt (REJECTED)
    {
      id: 'b-6',
      batchNo: 'LOT-2026-006',
      productId: 'p-3',
      tccsId: 'tccs-3',
      status: BATCH_STATUS.REJECTED,
      inspectionStatus: 'FAIL',
      progressPercent: 100,
      mfgDate: '2024-01-01',
      expDate: '2025-01-01', // Đã hết hạn!
      theoreticalYield: 1000,
      actualYield: 800,
      yieldUnit: 'hộp',
    },
  ];

  const mockTestResults: TestResult[] = [
    {
      id: 'tr-1',
      batchId: 'b-5',
      labName: 'QUATEST 3',
      testDate: '2026-01-20',
      overallStatus: 'PASS',
      results: [],
      evaluationSnapshot: { evaluationHash: 'sha256_mock_hash_1' } as any,
    },
    {
      id: 'tr-2',
      batchId: 'b-4',
      labName: 'EUROFINS',
      testDate: '2026-03-25',
      overallStatus: 'PASS',
      results: [],
      evaluationSnapshot: { evaluationHash: 'sha256_mock_hash_2' } as any,
    },
    {
      id: 'tr-3',
      batchId: 'b-3',
      labName: 'Nội bộ',
      testDate: '2026-03-10',
      overallStatus: 'PENDING',
      results: [],
    },
    {
      id: 'tr-4',
      batchId: 'b-6',
      labName: 'NIFC',
      testDate: '2024-01-25',
      overallStatus: 'FAIL',
      results: [],
    },
  ];

  it('1. Tính toán chính xác tổng hợp KPI Dashboard (Batches, Results, Pass Rate, Products)', () => {
    const totalProducts = mockProducts.length;
    const activeProducts = mockProducts.filter((p) => p.status === 'ACTIVE').length;
    expect(totalProducts).toBe(3);
    expect(activeProducts).toBe(2);

    const activeTCCS = mockTccsList.filter((t) => t.isActive).length;
    expect(activeTCCS).toBe(2);

    // Tính toán phân bổ 5 giai đoạn Lô theo canonical resolveInspectionStatusWithFallback
    let notTested = 0;
    let testing = 0;
    let review = 0;
    let released = 0;
    let rejected = 0;

    mockBatches.forEach((b) => {
      const boundTccs = b.tccs || mockTccsList.find((t) => t.id === b.tccsId);
      const inspectionStatus =
        b.inspectionStatus ||
        BatchInspectionProgressService.resolveInspectionStatusWithFallback({
          batch: b,
          testResults: mockTestResults,
          tccs: boundTccs,
          tccsList: mockTccsList,
        });

      if (b.status === BATCH_STATUS.RELEASED) {
        released++;
      }
      if (b.status === BATCH_STATUS.REJECTED || inspectionStatus === 'FAIL') {
        rejected++;
      }

      if (inspectionStatus === 'NOT_TESTED') {
        notTested++;
      } else if (inspectionStatus === 'IN_PROGRESS') {
        testing++;
      } else if (inspectionStatus === 'PENDING_REVIEW') {
        review++;
      }
    });

    expect(notTested).toBe(2); // b-1 (PENDING, 0 tests) + b-2 (NOT_TESTED)
    expect(testing).toBe(1); // b-3 (IN_PROGRESS)
    expect(review).toBe(1); // b-4 (PENDING_REVIEW)
    expect(released).toBe(1); // b-5 (RELEASED)
    expect(rejected).toBe(1); // b-6 (REJECTED)
    expect(mockBatches.length).toBe(6);

    // Test results pass rate calculation
    let passCount = 0;
    let failCount = 0;
    let pendingCount = 0;

    mockTestResults.forEach((r) => {
      if (r.overallStatus === 'PASS') passCount++;
      else if (r.overallStatus === 'FAIL') failCount++;
      else pendingCount++;
    });

    expect(passCount).toBe(2);
    expect(failCount).toBe(1);
    expect(pendingCount).toBe(1);

    const passRate = Math.round((passCount / mockTestResults.length) * 100);
    expect(passRate).toBe(50); // 2/4 = 50%
  });

  it('2. Nhận diện chính xác lô cận hạn và hết hạn (Expiring Batches Logic)', () => {
    // Current test date: 2026-10-27
    const now = new Date('2026-10-27T12:00:00Z').getTime();
    const items: ExpiringBatchItem[] = [];

    mockBatches.forEach((b) => {
      if (!b.expDate) return;
      const expTime = new Date(b.expDate).getTime();
      const diffDays = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));

      if (diffDays <= 90) {
        items.push({
          batch: b,
          daysRemaining: diffDays,
          isExpired: diffDays < 0,
          urgency: diffDays < 0 ? 'EXPIRED' : diffDays <= 30 ? 'CRITICAL' : 'WARNING',
        });
      }
    });

    // b-5: expDate 2026-11-15 -> ~19 days remaining (CRITICAL)
    // b-6: expDate 2025-01-01 -> expired in the past (EXPIRED)
    expect(items.length).toBe(2);

    const expiredItem = items.find((i) => i.batch.id === 'b-6');
    expect(expiredItem).toBeDefined();
    expect(expiredItem?.isExpired).toBe(true);
    expect(expiredItem?.urgency).toBe('EXPIRED');

    const nearExpItem = items.find((i) => i.batch.id === 'b-5');
    expect(nearExpItem).toBeDefined();
    expect(nearExpItem?.isExpired).toBe(false);
    expect(nearExpItem?.urgency).toBe('CRITICAL');
  });

  it('3. Tổng hợp phân bổ theo Đơn vị kiểm nghiệm (Laboratory Distribution)', () => {
    const labMap = new Map<string, { total: number; pass: number; fail: number }>();

    mockTestResults.forEach((r) => {
      const name = (r.labName || 'Nội bộ').trim();
      const current = labMap.get(name) || { total: 0, pass: 0, fail: 0 };
      current.total++;
      if (r.overallStatus === 'PASS') current.pass++;
      else if (r.overallStatus === 'FAIL') current.fail++;
      labMap.set(name, current);
    });

    expect(labMap.get('QUATEST 3')?.total).toBe(1);
    expect(labMap.get('QUATEST 3')?.pass).toBe(1);
    expect(labMap.get('EUROFINS')?.pass).toBe(1);
    expect(labMap.get('NIFC')?.fail).toBe(1);
    expect(labMap.get('Nội bộ')?.total).toBe(1);
  });

  it('4. Phân loại theo bộ lọc thời gian (Date Range Filter)', () => {
    const refNow = new Date('2026-10-27T12:00:00Z').getTime();

    // 30D threshold: 2026-09-27
    const d30Threshold = refNow - 30 * 24 * 60 * 60 * 1000;
    // YTD threshold: 2026-01-01
    const ytdThreshold = new Date(2026, 0, 1).getTime();

    const batchesYTD = mockBatches.filter((b) => {
      const d = new Date(b.mfgDate).getTime();
      return d >= ytdThreshold;
    });

    // Batches in 2026: b-1, b-2, b-3, b-4, b-5 (b-6 is from 2024)
    expect(batchesYTD.length).toBe(5);
    expect(batchesYTD.some((b) => b.id === 'b-6')).toBe(false);
  });
});
