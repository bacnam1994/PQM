import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useQAQCActionQueue } from './useQAQCActionQueue';
import { useAppStore } from '../store/useAppStore';

describe('TASK-010: useQAQCActionQueue Hook', () => {
  beforeEach(() => {
    useAppStore.setState({
      batches: [
        { id: 'b1', batchNo: 'L2601', productId: 'p1', status: 'TESTING', createdAt: '2026-03-01' } as any,
        { id: 'b2', batchNo: 'L2602', productId: 'p1', status: 'PENDING', createdAt: '2026-03-02' } as any,
        { id: 'b3', batchNo: 'L2600', productId: 'p1', status: 'RELEASED', createdAt: '2026-02-01' } as any,
      ],
      testResults: [
        { id: 'tr1', batchId: 'b1', overallStatus: 'FAIL', testDate: '2026-03-05' } as any,
        { id: 'tr2', batchId: 'b3', overallStatus: 'PASS', testDate: '2026-02-10' } as any,
      ],
      qualityAlerts: [
        { type: 'OOT_NEAR_LIMIT', severity: 'HIGH', title: 'Tiệm cận ngưỡng', detail: 'Chi tiết' } as any
      ],
      products: [
        { id: 'p1', name: 'Ginkgo Biloba 120mg' } as any
      ]
    });
  });

  it('tổng hợp chính xác danh sách các tác vụ cần hành động của QA/QC', () => {
    const { result } = renderHook(() => useQAQCActionQueue());

    expect(result.current.batchClearanceCount).toBe(2); // b1 (TESTING) và b2 (PENDING)
    expect(result.current.testResultReviewCount).toBe(1); // tr1 (FAIL)
    expect(result.current.alertCount).toBe(1);
    expect(result.current.actionItems.length).toBe(4); // 2 lô + 1 phiếu + 1 alert
    expect(result.current.hasUrgentItems).toBe(true);
  });

  it('sắp xếp tác vụ có mức độ HIGH URGENT lên đầu danh sách', () => {
    const { result } = renderHook(() => useQAQCActionQueue());

    const firstItem = result.current.actionItems[0];
    expect(firstItem.urgency).toBe('HIGH');
  });
});
