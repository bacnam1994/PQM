import { describe, it, expect } from 'vitest';
import { Batch } from '../../../types';

describe('Product 360 & Batch Release Matrix Calculations', () => {
  const mockBatches: Batch[] = [
    {
      id: 'b-1',
      productId: 'prod-1',
      tccsId: 'tccs-1',
      batchNo: 'L2601',
      mfgDate: '2026-01-10',
      expDate: '2029-01-10',
      theoreticalYield: 10000,
      actualYield: 9900,
      yieldUnit: 'chai',
      status: 'RELEASED',
      createdAt: '2026-01-10T08:00:00Z'
    },
    {
      id: 'b-2',
      productId: 'prod-1',
      tccsId: 'tccs-1',
      batchNo: 'L2602',
      mfgDate: '2026-02-15',
      expDate: '2029-02-15',
      theoreticalYield: 10000,
      actualYield: 9850,
      yieldUnit: 'chai',
      status: 'RELEASED',
      createdAt: '2026-02-15T08:00:00Z'
    },
    {
      id: 'b-3',
      productId: 'prod-1',
      tccsId: 'tccs-1',
      batchNo: 'L2603',
      mfgDate: '2026-03-20',
      expDate: '2029-03-20',
      theoreticalYield: 10000,
      actualYield: 9500,
      yieldUnit: 'chai',
      status: 'REJECTED',
      createdAt: '2026-03-20T08:00:00Z'
    },
    {
      id: 'b-4',
      productId: 'prod-1',
      tccsId: 'tccs-1',
      batchNo: 'L2501',
      mfgDate: '2025-11-05',
      expDate: '2028-11-05',
      theoreticalYield: 10000,
      actualYield: 9950,
      yieldUnit: 'chai',
      status: 'RELEASED',
      createdAt: '2025-11-05T08:00:00Z'
    }
  ];

  it('tính toán chính xác tỷ lệ xuất xưởng tổng thể', () => {
    const total = mockBatches.length;
    const released = mockBatches.filter(b => b.status === 'RELEASED').length;
    const rate = Math.round((released / total) * 100);

    expect(total).toBe(4);
    expect(released).toBe(3);
    expect(rate).toBe(75);
  });

  it('phân nhóm lô theo năm sản xuất chính xác', () => {
    const map = new Map<string, { total: number; released: number; rejected: number }>();
    mockBatches.forEach(b => {
      const year = b.mfgDate ? b.mfgDate.substring(0, 4) : 'Khác';
      const curr = map.get(year) || { total: 0, released: 0, rejected: 0 };
      curr.total += 1;
      if (b.status === 'RELEASED') curr.released += 1;
      else if (b.status === 'REJECTED') curr.rejected += 1;
      map.set(year, curr);
    });

    const stat2026 = map.get('2026');
    const stat2025 = map.get('2025');

    expect(stat2026).toBeDefined();
    expect(stat2026!.total).toBe(3);
    expect(stat2026!.released).toBe(2);
    expect(stat2026!.rejected).toBe(1);

    expect(stat2025).toBeDefined();
    expect(stat2025!.total).toBe(1);
    expect(stat2025!.released).toBe(1);
  });
});
