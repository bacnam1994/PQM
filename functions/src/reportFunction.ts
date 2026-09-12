/**
 * functions/src/reportFunction.ts
 * Cloud Function tạo Báo cáo Excel Chất lượng đa sheet bằng SheetJS và lưu Storage trả về Signed URL
 */

import * as admin from 'firebase-admin';
import * as XLSX from 'xlsx';

export interface QualityReportRequest {
  period: 'month' | 'quarter' | 'all';
  year?: number;
  month?: number;
  quarter?: number;
  productId?: string;
  reportData?: {
    batches: any[];
    testResults: any[];
    products: any[];
  };
}

export interface QualityReportResponse {
  downloadUrl: string;
  filename: string;
  rowCount: number;
  summary: {
    total: number;
    pass: number;
    fail: number;
    passRate: string;
    periodLabel: string;
  };
  expiresAt: string;
}

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

export async function generateQualityReportBackend(
  req: QualityReportRequest,
  storage: admin.storage.Storage,
  db: admin.database.Database
): Promise<QualityReportResponse> {
  let batches: any[] = [];
  let testResults: any[] = [];
  let products: any[] = [];

  if (req.reportData && req.reportData.batches && req.reportData.testResults) {
    batches = req.reportData.batches;
    testResults = req.reportData.testResults;
    products = req.reportData.products || [];
  } else {
    // Đọc trực tiếp từ Firebase RTDB nếu client không truyền data
    const [bSnap, trSnap, pSnap] = await Promise.all([
      db.ref('batches').once('value'),
      db.ref('test_results').once('value'),
      db.ref('products').once('value')
    ]);
    batches = Object.values(bSnap.val() || {});
    testResults = Object.values(trSnap.val() || {});
    products = Object.values(pSnap.val() || {});
  }

  const now = new Date();
  const year = req.year || now.getFullYear();
  const month = req.month || (now.getMonth() + 1);
  const quarter = req.quarter || Math.ceil((now.getMonth() + 1) / 3);

  let periodLabel = 'Toàn bộ';
  let filterFn: (tr: any) => boolean = () => true;

  if (req.period === 'month') {
    periodLabel = `Tháng ${String(month).padStart(2, '0')}/${year}`;
    filterFn = (tr: any) => {
      if (!tr.testDate) return false;
      const d = new Date(tr.testDate);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    };
  } else if (req.period === 'quarter') {
    const qMonths: Record<number, number[]> = { 1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12] };
    periodLabel = `Quý ${quarter}/${year}`;
    filterFn = (tr: any) => {
      if (!tr.testDate) return false;
      const d = new Date(tr.testDate);
      return d.getFullYear() === year && qMonths[quarter]?.includes(d.getMonth() + 1);
    };
  }

  const productMap = new Map(products.map(p => [p.id, p]));
  const batchMap = new Map(batches.map(b => [b.id, b]));

  let filteredResults = testResults.filter(filterFn);
  if (req.productId) {
    filteredResults = filteredResults.filter(tr => {
      const b = batchMap.get(tr.batchId);
      return b && b.productId === req.productId;
    });
  }

  const total = filteredResults.length;
  const pass = filteredResults.filter(r => r.overallStatus === 'PASS').length;
  const fail = filteredResults.filter(r => r.overallStatus === 'FAIL').length;
  const passRate = total > 0 ? `${((pass / total) * 100).toFixed(1)}%` : '0%';

  // Tạo hàng dữ liệu
  const buildRow = (tr: any) => {
    const batch = batchMap.get(tr.batchId) || {};
    const product = productMap.get(batch.productId) || {};
    const results = Array.isArray(tr.results) ? tr.results : [];
    const passCount = results.filter((r: any) => r && r.isPass).length;
    const failCount = results.filter((r: any) => r && !r.isPass).length;

    return {
      'Ngày KN': fmtDate(tr.testDate),
      'Số phiếu': tr.reportNumber || '---',
      'Số lô': batch.batchNo || tr.batchId || '---',
      'Tên sản phẩm': product.name || '---',
      'Mã sản phẩm': product.code || '---',
      'Đơn vị KN': tr.labType === 'INTERNAL' ? 'Nội bộ' : tr.externalLabName || 'Thuê ngoài',
      'Kết quả tổng': tr.overallStatus === 'PASS' ? 'ĐẠT' : tr.overallStatus === 'FAIL' ? 'KHÔNG ĐẠT' : 'CHỜ',
      'Số CT đạt': passCount,
      'Số CT không đạt': failCount,
      'Ngày SX': fmtDate(batch.mfgDate),
      'Hạn dùng': fmtDate(batch.expDate),
      'Ghi chú': tr.note || ''
    };
  };

  const allRows = filteredResults.map(buildRow);
  const passRows = filteredResults.filter(r => r.overallStatus === 'PASS').map(buildRow);
  const failRows = filteredResults.filter(r => r.overallStatus === 'FAIL').map(buildRow);

  // Sheet Tóm tắt
  const summaryData = [
    { 'CHỈ SỐ': 'Kỳ báo cáo', 'GIÁ TRỊ': periodLabel },
    { 'CHỈ SỐ': 'Thời gian xuất file', 'GIÁ TRỊ': fmtDate(now.toISOString()) },
    { 'CHỈ SỐ': 'Tổng số phiếu kiểm nghiệm', 'GIÁ TRỊ': total },
    { 'CHỈ SỐ': 'Số phiếu ĐẠT', 'GIÁ TRỊ': pass },
    { 'CHỈ SỐ': 'Số phiếu KHÔNG ĐẠT (OOS)', 'GIÁ TRỊ': fail },
    { 'CHỈ SỐ': 'Tỷ lệ đạt chuẩn', 'GIÁ TRỊ': passRate },
    { 'CHỈ SỐ': 'Sản phẩm lọc', 'GIÁ TRỊ': req.productId ? (productMap.get(req.productId)?.name || req.productId) : 'Tất cả' }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Tổng quan');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allRows), 'Toàn bộ phiếu KN');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(passRows), 'Phiếu ĐẠT');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(failRows), 'Phiếu KHÔNG ĐẠT (OOS)');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // Upload lên Firebase Storage
  const dateStr = now.toISOString().split('T')[0];
  const filename = `Bao_cao_chat_luong_${req.period}_${dateStr}_${Date.now()}.xlsx`;
  const bucket = storage.bucket();
  const file = bucket.file(`reports/${filename}`);

  await file.save(buffer, {
    metadata: {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      metadata: {
        generatedBy: 'PQM-Cloud-Function',
        period: periodLabel
      }
    }
  });

  // Tạo Signed URL có thời hạn 60 phút
  const expiresAtMs = Date.now() + 60 * 60 * 1000;
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: expiresAtMs
  });

  return {
    downloadUrl: signedUrl,
    filename,
    rowCount: total,
    summary: {
      total,
      pass,
      fail,
      passRate,
      periodLabel
    },
    expiresAt: new Date(expiresAtMs).toISOString()
  };
}
