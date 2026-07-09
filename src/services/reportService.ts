/**
 * reportService.ts
 * Service xuất báo cáo Excel chất lượng sử dụng SheetJS (xlsx).
 * Hỗ trợ báo cáo tháng/quý với định dạng chuyên nghiệp, nhiều sheet, màu sắc chuẩn.
 */
import * as XLSX from 'xlsx';

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
export interface QualityAnomaly {
  type: 'DRIFT' | 'EXPIRY' | 'HIGH_FAIL_RATE' | 'MISSING_DATA';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  detail: string;
  productName?: string;
  batchNo?: string;
}

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
        type: 'EXPIRY',
        severity: daysLeft <= 7 ? 'HIGH' : daysLeft <= 14 ? 'MEDIUM' : 'LOW',
        title: `Lô sắp hết hạn: ${b.batchNo}`,
        detail: `Sản phẩm **${product?.name || b.productId}** còn **${daysLeft} ngày** đến hạn dùng (${fmtDate(b.expDate)}).`,
        productName: product?.name,
        batchNo: b.batchNo,
      });
    }
  });

  // ─── 2. Phát hiện xu hướng trôi (Drift) ─────────────────────────────
  const productGroups: Record<string, any[]> = {};
  testResults.forEach((tr: any) => {
    const batch = batches.find((b: any) => b.id === tr.batchId);
    if (!batch) return;
    const pid = batch.productId;
    if (!productGroups[pid]) productGroups[pid] = [];
    productGroups[pid].push({ ...tr, batch });
  });

  Object.entries(productGroups).forEach(([pid, results]) => {
    results.sort((a, b) => new Date(b.testDate || 0).getTime() - new Date(a.testDate || 0).getTime());
    const recent3 = results.slice(0, 3);
    if (recent3.length < 3) return;

    const criteriaValues: Record<string, number[]> = {};
    recent3.forEach(tr => {
      (tr.results || []).forEach((entry: any) => {
        const numVal = parseFloat(String(entry.value || '').replace(',', '.'));
        if (isNaN(numVal)) return;
        if (!criteriaValues[entry.criteriaName]) criteriaValues[entry.criteriaName] = [];
        criteriaValues[entry.criteriaName].push(numVal);
      });
    });

    Object.entries(criteriaValues).forEach(([criteriaName, values]) => {
      if (values.length < 3) return;
      // recent3 được sort descending: [0]=mới nhất, [1]=giữa, [2]=cũ nhất
      // v1=mới nhất, v2=giữa, v3=cũ nhất
      const [v1, v2, v3] = values;
      const isIncreasing = v1 > v2 && v2 > v3;
      const isDecreasing = v1 < v2 && v2 < v3;

      if (isIncreasing || isDecreasing) {
        const product = products.find((p: any) => p.id === pid);
        const trend = isIncreasing ? 'tăng liên tục' : 'giảm liên tục';
        const changeRate = Math.abs(((v1 - v3) / (v3 || 1)) * 100).toFixed(1);
        // FIX 6: Hiển thị đúng chiều thời gian cũ→mới: v3 (cũ nhất) → v2 → v1 (mới nhất)
        anomalies.push({
          type: 'DRIFT',
          severity: parseFloat(changeRate) > 20 ? 'HIGH' : 'MEDIUM',
          title: `Xu hướng trôi: ${criteriaName}`,
          detail: `Sản phẩm **${product?.name || pid}** — chỉ tiêu **${criteriaName}** đang **${trend}** qua 3 lần kiểm gần nhất (cũ→mới): ${v3.toFixed(3)} → ${v2.toFixed(3)} → ${v1.toFixed(3)} (thay đổi ${changeRate}%).`,
          productName: product?.name,
        });
      }
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
