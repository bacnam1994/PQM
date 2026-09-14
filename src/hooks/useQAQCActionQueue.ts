/**
 * PQM V4 Platform - useQAQCActionQueue Hook
 * Tổng hợp toàn bộ các đầu việc hành động cần xử lý ngay trong ngày của QA/QC Workbench
 */

import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useDataGraph } from './useDataGraph';

export interface ActionItem {
  id: string;
  type: 'BATCH_CLEARANCE' | 'TEST_RESULT_REVIEW' | 'QUALITY_ALERT' | 'TCCS_REVIEW';
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  subtitle: string;
  link: string;
  timestamp?: string;
  tagText: string;
}

export interface QAQCActionQueueReturn {
  actionItems: ActionItem[];
  totalUrgentCount: number;
  batchClearanceCount: number;
  testResultReviewCount: number;
  alertCount: number;
  hasUrgentItems: boolean;
}

export function useQAQCActionQueue(): QAQCActionQueueReturn {
  const {
    batches: graphBatches = [],
    testResults: graphTestResults = [],
    products: graphProducts = [],
    getBatchById,
    getProductById,
  } = useDataGraph();

  const storeBatches = useAppStore((state) => state.batches) || [];
  const storeTestResults = useAppStore((state) => state.testResults) || [];
  const qualityAlerts = useAppStore((state) => state.qualityAlerts) || [];
  const storeProducts = useAppStore((state) => state.products) || [];

  const batches = graphBatches.length > 0 ? graphBatches : storeBatches;
  const testResults = graphTestResults.length > 0 ? graphTestResults : storeTestResults;
  const products = graphProducts.length > 0 ? graphProducts : storeProducts;

  return useMemo(() => {
    const items: ActionItem[] = [];

    // 1. Các lô sản xuất đang chờ thẩm định / kiểm nghiệm (Pending Clearance)
    const activeBatches = batches.filter((b) => b.status === 'TESTING' || b.status === 'PENDING');
    activeBatches.forEach((b) => {
      const prod = getProductById
        ? getProductById(b.productId)
        : products.find((p) => p.id === b.productId);
      items.push({
        id: `action_batch_${b.id}`,
        type: 'BATCH_CLEARANCE',
        urgency: b.status === 'TESTING' ? 'HIGH' : 'MEDIUM',
        title: `Lô ${b.batchNo} — ${prod?.name || 'Sản phẩm'}`,
        subtitle: `Trạng thái: ${b.status} | Đang chờ QA/QC thẩm định hồ sơ xuất xưởng`,
        link: `/batches/${b.id}`,
        timestamp: b.createdAt,
        tagText: b.status === 'TESTING' ? 'Chờ kiểm nghiệm' : 'Chờ bắt đầu',
      });
    });

    // 2. Phiếu kiểm nghiệm có kết quả OOS/FAIL hoặc chưa đạt
    const nonPassResults = testResults.filter((r) => r.overallStatus !== 'PASS');
    nonPassResults.forEach((r) => {
      // Tích hợp useDataGraph ($O(1)$ Lookup): getBatchById và getProductById
      const batch = getBatchById
        ? getBatchById(r.batchId)
        : batches.find((b) => b.id === r.batchId);
      const product = batch?.productId
        ? getProductById
          ? getProductById(batch.productId)
          : products.find((p) => p.id === batch.productId)
        : undefined;

      const batchNo = batch?.batchNo || r.batchId;
      const productName = product?.name || 'Sản phẩm';
      const labName = r.labName || 'Đơn vị kiểm nghiệm';
      const testDate = r.testDate || (r.createdAt ? r.createdAt.slice(0, 10) : 'N/A');

      items.push({
        id: `action_tr_${r.id}`,
        type: 'TEST_RESULT_REVIEW',
        urgency: 'HIGH',
        title: `Phiếu kiểm nghiệm lô ${batchNo} - ${productName} của ${labName} ngày xuất phiếu ${testDate}`,
        subtitle: `Kết quả: ${r.overallStatus} — Cần kích hoạt quy trình điều tra OOS/OOT`,
        link: `/test-results/edit/${r.id}`,
        timestamp: r.testDate,
        tagText: 'OOS / Không đạt',
      });
    });

    // 3. Cảnh báo chất lượng cấp thiết (Quality Anomaly Alerts)
    qualityAlerts.forEach((a, idx) => {
      items.push({
        id: `action_alert_${idx}`,
        type: 'QUALITY_ALERT',
        urgency: a.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
        title: a.title,
        subtitle: a.detail,
        link: '/alerts',
        tagText: a.severity === 'HIGH' ? 'Cảnh báo Đỏ' : 'Cảnh báo Vàng',
      });
    });

    // Sắp xếp: Ưu tiên HIGH lên đầu
    items.sort((a, b) => {
      if (a.urgency === 'HIGH' && b.urgency !== 'HIGH') return -1;
      if (a.urgency !== 'HIGH' && b.urgency === 'HIGH') return 1;
      return 0;
    });

    const highCount = items.filter((i) => i.urgency === 'HIGH').length;

    return {
      actionItems: items,
      totalUrgentCount: highCount,
      batchClearanceCount: activeBatches.length,
      testResultReviewCount: nonPassResults.length,
      alertCount: qualityAlerts.length,
      hasUrgentItems: highCount > 0,
    };
  }, [batches, testResults, qualityAlerts, products, getBatchById, getProductById]);
}
