/**
 * functions/src/autoHealCron.ts
 * Cloud Function Scheduled Cron Job: Quét và hàn gắn toàn vẹn CSDL định kỳ lúc 2h sáng
 */

import * as admin from 'firebase-admin';

export interface AutoHealSummary {
  scannedAt: string;
  orphansDetected: number;
  orphansResolved: number;
  testStatusCorrected: number;
  activeTccsResolved: number;
  details: string[];
}

export async function runAutoHealDatabase(db: admin.database.Database): Promise<AutoHealSummary> {
  const summary: AutoHealSummary = {
    scannedAt: new Date().toISOString(),
    orphansDetected: 0,
    orphansResolved: 0,
    testStatusCorrected: 0,
    activeTccsResolved: 0,
    details: [],
  };

  try {
    // 1. Đọc dữ liệu các node (Ưu tiên testResults chuẩn của RTDB, fallback test_results nếu có legacy)
    const [productsSnap, batchesSnap, primaryTrSnap, legacyTrSnap, tccsSnap] = await Promise.all([
      db.ref('products').once('value'),
      db.ref('batches').once('value'),
      db.ref('testResults').once('value'),
      db.ref('test_results').once('value'),
      db.ref('tccs').once('value'),
    ]);

    const products = productsSnap.val() || {};
    const batches = batchesSnap.val() || {};
    const primaryTestResults = primaryTrSnap.val() || {};
    const legacyTestResults = legacyTrSnap.val() || {};
    // Hợp nhất dữ liệu: bản ghi trên testResults là canonical
    const testResults = { ...legacyTestResults, ...primaryTestResults };
    const tccsList = tccsSnap.val() || {};

    const productIds = new Set(Object.keys(products));
    const batchIds = new Set(Object.keys(batches));
    const batchNoToIdMap = new Map<string, string>();
    for (const [bId, bVal] of Object.entries<any>(batches)) {
      if (bVal && bVal.batchNo) {
        batchNoToIdMap.set(bVal.batchNo.trim().toLowerCase(), bId);
      }
    }

    // 2. Quét Orphan Batches (lô không có sản phẩm cha)
    for (const [bId, bVal] of Object.entries<any>(batches)) {
      if (bVal && bVal.productId && !productIds.has(bVal.productId)) {
        summary.orphansDetected++;
        summary.details.push(
          `Phát hiện Lô mồ côi [${bVal.batchNo || bId}]: Không tìm thấy sản phẩm ${bVal.productId}`
        );
      }
    }

    // 3. Quét & sửa Test Result Status Mismatch và Quan hệ Liên kết ID
    const updates: Record<string, any> = {};
    for (const [trId, trVal] of Object.entries<any>(testResults)) {
      if (!trVal) continue;

      const rawBatchId = (trVal.batchId || '').trim();
      const rawBatchNo = (trVal.batchNo || '').trim();

      // Kiểm tra xem có đang dùng batchNo thay cho batchId không
      if (rawBatchId && !batchIds.has(rawBatchId) && batchNoToIdMap.has(rawBatchId.toLowerCase())) {
        const canonicalBatchId = batchNoToIdMap.get(rawBatchId.toLowerCase())!;
        updates[`testResults/${trId}/batchId`] = canonicalBatchId;
        summary.details.push(
          `Tự động hàn gắn liên kết kỹ thuật Phiếu KN [${trVal.reportNumber || trId}]: batchId ${rawBatchId} -> ${canonicalBatchId}`
        );
      } else if (!rawBatchId && rawBatchNo && batchNoToIdMap.has(rawBatchNo.toLowerCase())) {
        const canonicalBatchId = batchNoToIdMap.get(rawBatchNo.toLowerCase())!;
        updates[`testResults/${trId}/batchId`] = canonicalBatchId;
        summary.details.push(
          `Tự động bổ sung batchId kỹ thuật cho Phiếu KN [${trVal.reportNumber || trId}]: ${canonicalBatchId}`
        );
      } else if (rawBatchId && !batchIds.has(rawBatchId)) {
        // Kiểm tra orphan test result (kết quả thực sự không thuộc lô nào)
        summary.orphansDetected++;
        summary.details.push(
          `Phát hiện Phiếu KN mồ côi [${trVal.reportNumber || trId}]: Không tìm thấy lô ${rawBatchId}`
        );
      }

      // Kiểm tra overallStatus logic: Chỉ chuẩn hóa định dạng chuỗi (Normalization) an toàn
      const rawStatus = trVal.overallStatus || trVal.status;
      const strUpper = String(rawStatus || '')
        .trim()
        .toUpperCase();
      const isVietnamesePass = strUpper === 'ĐẠT' || strUpper === 'DAT' || strUpper === 'PASSED';
      const isVietnameseFail =
        strUpper === 'KHÔNG ĐẠT' ||
        strUpper === 'KHONG DAT' ||
        strUpper === 'KHONG_DAT' ||
        strUpper === 'FAILED';

      if (isVietnamesePass) {
        updates[`testResults/${trId}/overallStatus`] = 'PASS';
        summary.testStatusCorrected++;
        summary.details.push(
          `Tự động chuẩn hóa định dạng trạng thái Phiếu KN [${trVal.reportNumber || trId}] từ ${trVal.overallStatus} sang PASS`
        );
      } else if (isVietnameseFail) {
        updates[`testResults/${trId}/overallStatus`] = 'FAIL';
        summary.testStatusCorrected++;
        summary.details.push(
          `Tự động chuẩn hóa định dạng trạng thái Phiếu KN [${trVal.reportNumber || trId}] từ ${trVal.overallStatus} sang FAIL`
        );
      }
    }

    // 4. Áp dụng các bản sửa nếu có
    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
      summary.orphansResolved = summary.testStatusCorrected;
    }

    // 5. Ghi log kiểm toán hệ thống
    const auditId = `audit_autoheal_${Date.now()}`;
    await db.ref(`audit_logs/${auditId}`).set({
      id: auditId,
      action: 'SYSTEM_AUTO_HEAL',
      collection: 'DATABASE_MAINTENANCE',
      details: `Hệ thống chạy Cron lúc 2h sáng: Sửa ${summary.testStatusCorrected} trạng thái phiếu, phát hiện ${summary.orphansDetected} mồ côi.`,
      performedBy: 'system-cron-scheduler@v-biotech.web.app',
      timestamp: summary.scannedAt,
    });
  } catch (error: any) {
    console.error('[AutoHealCron] Error during maintenance:', error);
    summary.details.push(`Lỗi trong quá trình quét: ${error?.message || String(error)}`);
  }

  return summary;
}
