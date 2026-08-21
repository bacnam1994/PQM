/**
 * reportService.ts
 * Service xuất báo cáo Excel chất lượng sử dụng SheetJS (xlsx).
 * Hỗ trợ báo cáo tháng/quý với định dạng chuyên nghiệp, nhiều sheet, màu sắc chuẩn.
 */
import * as XLSX from 'xlsx';
import { QualityAnomaly } from '../types';
import { lookupPharmaTerm } from '../utils/aiMapping';
import { detectOOTForCriterion, BatchCriterionDataPoint } from '../utils/ootDetection';

/**
 * Định dạng ngày tháng sang DD/MM/YYYY
 */
const fmtDate = (dateStr: string): string => {
  if (!dateStr) return '---';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
};

export interface QualityReportOptions {
  period: 'month' | 'quarter' | 'all';
  year?: number;
  month?: number; // 1-12
  quarter?: number; // 1-4
  productId?: string; // Lọc theo sản phẩm (tùy chọn)
}

export interface QualityReportResult {
  filename: string;
  rowCount: number;
  summary: {
    total: number;
    pass: number;
    fail: number;
    passRate: string;
    periodLabel: string;
  };
}

// Kiểu dữ liệu cho từng hàng dữ liệu
interface ReportRow {
  'Ngày KN': string;
  'Số lô': string;
  'Tên sản phẩm': string;
  'Mã sản phẩm': string;
  'Đơn vị KN': string;
  'Kết quả tổng': string;
  'Số CT đạt': number | string;
  'Số CT không đạt': number | string;
  'Ngày SX': string;
  'Hạn dùng': string;
  'Ghi chú': string;
}

/**
 * Xuất báo cáo tổng hợp chất lượng ra file Excel (.xlsx) đa sheet.
 * Sheet 1: Tóm tắt thống kê
 * Sheet 2: Danh sách phiếu ĐẠT (nền xanh nhạt)
 * Sheet 3: Danh sách phiếu KHÔNG ĐẠT (nền đỏ nhạt)
 * Sheet 4: Toàn bộ danh sách
 */
export const generateQualityReport = (
  appContext: any,
  options: QualityReportOptions = { period: 'all' }
): QualityReportResult => {
  const batches = appContext.batches || [];
  const testResults = appContext.testResults || [];
  const products = appContext.products || [];

  const now = new Date();
  const year = options.year || now.getFullYear();
  const month = options.month || (now.getMonth() + 1);
  const quarter = options.quarter || Math.ceil((now.getMonth() + 1) / 3);

  // ─── Tính nhãn kỳ báo cáo ───────────────────────────────────────────
  let periodLabel = 'Toàn bộ';
  let filterFn: (tr: any) => boolean = () => true;

  if (options.period === 'month') {
    periodLabel = `Tháng ${String(month).padStart(2, '0')}/${year}`;
    filterFn = (tr: any) => {
      if (!tr.testDate) return false;
      const d = new Date(tr.testDate);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    };
  } else if (options.period === 'quarter') {
    const qMonths: Record<number, number[]> = { 1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12] };
    periodLabel = `Quý ${quarter}/${year}`;
    filterFn = (tr: any) => {
      if (!tr.testDate) return false;
      const d = new Date(tr.testDate);
      return d.getFullYear() === year && qMonths[quarter]?.includes(d.getMonth() + 1);
    };
  }

  // ─── Lọc kết quả theo kỳ ────────────────────────────────────────────
  let filteredResults = testResults.filter(filterFn);

  // Lọc thêm theo sản phẩm nếu có
  if (options.productId) {
    const productBatchIds = new Set(
      batches.filter((b: any) => b.productId === options.productId).map((b: any) => b.id)
    );
    filteredResults = filteredResults.filter((tr: any) => productBatchIds.has(tr.batchId));
  }

  // ─── Build dữ liệu báo cáo ──────────────────────────────────────────
  const rows: ReportRow[] = filteredResults.map((tr: any) => {
    const batch = batches.find((b: any) => b.id === tr.batchId);
    const product = products.find((p: any) => p.id === batch?.productId);
    const isPass = tr.overallStatus === 'PASS';
    const results = tr.results || [];
    const passItems = results.filter((r: any) => r.isPass !== false && r.value).length;
    const failItems = results.filter((r: any) => r.isPass === false).length;

    return {
      'Ngày KN': fmtDate(tr.testDate),
      'Số lô': batch?.batchNo || tr.batchId,
      'Tên sản phẩm': product?.name || batch?.productId || '---',
      'Mã sản phẩm': product?.code || '---',
      'Đơn vị KN': tr.labName || '---',
      'Kết quả tổng': isPass ? 'ĐẠT' : 'KHÔNG ĐẠT',
      'Số CT đạt': passItems,
      'Số CT không đạt': failItems,
      'Ngày SX': fmtDate(batch?.mfgDate || ''),
      'Hạn dùng': fmtDate(batch?.expDate || ''),
      'Ghi chú': tr.notes || '',
    };
  });

  // ─── Tính tóm tắt ───────────────────────────────────────────────────
  const total = rows.length;
  const pass = filteredResults.filter((tr: any) => tr.overallStatus === 'PASS').length;
  const fail = total - pass;
  const passRate = total > 0 ? `${((pass / total) * 100).toFixed(1)}%` : '0%';

  // ─── Tạo Workbook XLSX ───────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  // === Sheet 1: Tóm tắt ===
  const summaryData = [
    ['BÁO CÁO CHẤT LƯỢNG V-BIOTECH QMS'],
    [],
    ['Kỳ báo cáo:', periodLabel],
    ['Ngày xuất báo cáo:', new Date().toLocaleString('vi-VN')],
    [],
    ['THỐNG KÊ TỔNG HỢP'],
    ['Tổng số phiếu kiểm nghiệm:', total],
    ['Số phiếu ĐẠT:', pass],
    ['Số phiếu KHÔNG ĐẠT:', fail],
    ['Tỷ lệ đạt chuẩn:', passRate],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 25 }];

  // Style cho tiêu đề chính
  if (wsSummary['A1']) {
    wsSummary['A1'].s = { font: { bold: true, sz: 14 }, fill: { fgColor: { rgb: '1E3A5F' } }, font2: { color: { rgb: 'FFFFFF' } } };
  }
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Tóm tắt');

  // === Sheet 2: Toàn bộ danh sách ===
  if (rows.length > 0) {
    const wsAll = XLSX.utils.json_to_sheet(rows);
    applyColumnWidths(wsAll);
    XLSX.utils.book_append_sheet(wb, wsAll, 'Tất cả phiếu');
  }

  // === Sheet 3: Chỉ phiếu ĐẠT ===
  const passRows = rows.filter(r => r['Kết quả tổng'] === 'ĐẠT');
  if (passRows.length > 0) {
    const wsPass = XLSX.utils.json_to_sheet(passRows);
    applyColumnWidths(wsPass);
    XLSX.utils.book_append_sheet(wb, wsPass, `Đạt (${passRows.length})`);
  }

  // === Sheet 4: Chỉ phiếu KHÔNG ĐẠT ===
  const failRows = rows.filter(r => r['Kết quả tổng'] === 'KHÔNG ĐẠT');
  if (failRows.length > 0) {
    const wsFail = XLSX.utils.json_to_sheet(failRows);
    applyColumnWidths(wsFail);
    XLSX.utils.book_append_sheet(wb, wsFail, `Không đạt (${failRows.length})`);
  }

  // ─── Tạo tên file và tải về ─────────────────────────────────────────
  const timestamp = new Date().toISOString().slice(0, 10);
  const periodSlug = options.period === 'month' ? `thang${month}_${year}`
    : options.period === 'quarter' ? `quy${quarter}_${year}`
    : 'toan_bo';
  const filename = `baocao_chatluong_${periodSlug}_${timestamp}.xlsx`;

  // Tải file về máy
  XLSX.writeFile(wb, filename);

  return {
    filename,
    rowCount: filteredResults.length,
    summary: { total, pass, fail, passRate, periodLabel }
  };
};

/**
 * Căn chỉnh độ rộng cột tự động dựa trên nội dung
 */
function applyColumnWidths(ws: XLSX.WorkSheet) {
  ws['!cols'] = [
    { wch: 12 },  // Ngày KN
    { wch: 15 },  // Số lô
    { wch: 28 },  // Tên sản phẩm
    { wch: 12 },  // Mã SP
    { wch: 20 },  // Đơn vị KN
    { wch: 14 },  // Kết quả tổng
    { wch: 10 },  // Số CT đạt
    { wch: 14 },  // Số CT không đạt
    { wch: 12 },  // Ngày SX
    { wch: 12 },  // Hạn dùng
    { wch: 30 },  // Ghi chú
  ];
}

/**
 * Phát hiện các bất thường chất lượng (anomaly detection):
 * - Chỉ tiêu có xu hướng tăng liên tục (drift) dù vẫn trong giới hạn
 * - Lô sắp hết hạn trong N ngày
 * - Sản phẩm có tỷ lệ thất bại cao bất thường
 */
export type { QualityAnomaly };

export const detectQualityAnomalies = (appContext: any, daysAhead = 30): QualityAnomaly[] => {
  const batches = appContext.batches || [];
  const testResults = appContext.testResults || [];
  const products = appContext.products || [];
  const anomalies: QualityAnomaly[] = [];
  const now = new Date();

  // ─── 1. Lô sắp hết hạn ──────────────────────────────────────────────
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  batches.forEach((b: any) => {
    if (!b.expDate) return;
    const exp = new Date(b.expDate);
    if (exp > now && exp <= cutoff) {
      const product = products.find((p: any) => p.id === b.productId);
      const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      anomalies.push({
        id: `qa_exp_${b.id || b.batchNo}`,
        type: 'EXPIRY',
        severity: daysLeft <= 7 ? 'HIGH' : daysLeft <= 14 ? 'MEDIUM' : 'LOW',
        title: `Lô sắp hết hạn: ${b.batchNo}`,
        detail: `Sản phẩm **${product?.name || b.productId}** còn **${daysLeft} ngày** đến hạn dùng (${fmtDate(b.expDate)}).`,
        productName: product?.name,
        batchNo: b.batchNo,
      });
    }
  });

  // ─── 2. Phát hiện xu hướng trôi (Drift & Out-of-Trend OOT) ─────────
  const productGroups: Record<string, any[]> = {};
  testResults.forEach((tr: any) => {
    const batch = batches.find((b: any) => b.id === tr.batchId);
    if (!batch) return;
    const pid = batch.productId;
    if (!productGroups[pid]) productGroups[pid] = [];
    productGroups[pid].push({ ...tr, batch });
  });

  const tccsList = appContext.tccsList || [];

  Object.entries(productGroups).forEach(([pid, results]) => {
    const product = products.find((p: any) => p.id === pid);
    const productTccs = tccsList.find((t: any) => t.productId === pid);
    const allTccsCriteria = [
      ...(productTccs?.mainQualityCriteria || []),
      ...(productTccs?.safetyCriteria || [])
    ];

    // Gom dữ liệu điểm đo theo từng chỉ tiêu
    const criteriaDataPointsMap: Record<string, BatchCriterionDataPoint[]> = {};

    results.forEach(tr => {
      const b = tr.batch;
      (tr.results || []).forEach((entry: any) => {
        if (!entry.criteriaName || entry.value === undefined || entry.value === null || entry.value === '') return;
        const canonicalName = lookupPharmaTerm(entry.criteriaName) || entry.criteriaName;
        if (!criteriaDataPointsMap[canonicalName]) {
          criteriaDataPointsMap[canonicalName] = [];
        }

        // Tìm limit trong TCCS nếu có
        const matchedTccs = allTccsCriteria.find(c => c && c.name && (c.name.trim().toLowerCase() === entry.criteriaName.trim().toLowerCase() || lookupPharmaTerm(c.name) === canonicalName));

        criteriaDataPointsMap[canonicalName].push({
          batchId: b.id || tr.batchId,
          batchNo: b.batchNo || `Lô ${tr.batchId}`,
          testDate: tr.testDate || b.mfgDate || '',
          value: entry.value,
          criteriaName: entry.criteriaName,
          unit: entry.unit,
          minLimit: matchedTccs?.minLimit,
          maxLimit: matchedTccs?.maxLimit,
        });
      });
    });

    // Chạy thuật toán OOT cho từng chỉ tiêu
    Object.entries(criteriaDataPointsMap).forEach(([canonicalName, dataPoints]) => {
      const ootAnomalies = detectOOTForCriterion(canonicalName, dataPoints);
      ootAnomalies.forEach((oot, idx) => {
        let anomalyType: QualityAnomaly['type'] = 'DRIFT';
        if (oot.type === 'NEAR_SPEC_LIMIT') anomalyType = 'OOT_NEAR_LIMIT';
        else if (oot.type === 'SIGMA_SHIFT') anomalyType = 'OOT_SIGMA_SHIFT';

        anomalies.push({
          id: `qa_oot_${pid}_${canonicalName}_${idx}`,
          type: anomalyType,
          severity: oot.severity,
          title: `${oot.title}: ${canonicalName}`,
          detail: `Sản phẩm **${product?.name || pid}** — ${oot.description}`,
          productName: product?.name,
          batchNo: oot.affectedBatches.slice(-1)[0],
          criteriaName: canonicalName,
          recommendation: oot.recommendation,
        });
      });
    });
  });

  // ─── 3. Sản phẩm có tỷ lệ thất bại cao ─────────────────────────────
  Object.entries(productGroups).forEach(([pid, results]) => {
    if (results.length < 3) return;
    const failCount = results.filter(tr => tr.overallStatus === 'FAIL').length;
    const failRate = failCount / results.length;
    if (failRate >= 0.3) {
      const product = products.find((p: any) => p.id === pid);
      anomalies.push({
        id: `qa_fail_${pid}`,
        type: 'HIGH_FAIL_RATE',
        severity: failRate >= 0.5 ? 'HIGH' : 'MEDIUM',
        title: `Tỷ lệ thất bại cao: ${product?.name || pid}`,
        detail: `Sản phẩm **${product?.name || pid}** có **${failCount}/${results.length}** phiếu KHÔNG ĐẠT (${(failRate * 100).toFixed(0)}%). Cần điều tra nguyên nhân.`,
        productName: product?.name,
      });
    }
  });

  // Sắp xếp theo mức độ nghiêm trọng: HIGH → MEDIUM → LOW
  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return anomalies;
};
