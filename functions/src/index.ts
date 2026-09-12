/**
 * functions/src/index.ts
 * Main Entrypoint for Firebase Cloud Functions (PQM Platform v4)
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onValueWritten } from 'firebase-functions/v2/database';

import { executeSPCCalculation, SPCMetricsRequest } from './spcFunction';
import { runAutoHealDatabase } from './autoHealCron';
import { generateQualityReportBackend, QualityReportRequest } from './reportFunction';
import { syncUserCustomClaims } from './customClaimsTrigger';

// Khởi tạo Firebase Admin App
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.database();
const storage = admin.storage();
const auth = admin.auth();

/**
 * 1. Callable Function: Tính toán SPC & 8 quy tắc Nelson trên Server
 */
export const calculateSPCMetrics = onCall({ cors: true }, async (request) => {
  const data = request.data as SPCMetricsRequest;
  if (!data || !Array.isArray(data.values)) {
    throw new HttpsError('invalid-argument', 'Yêu cầu mảng "values" chứa các giá trị kiểm nghiệm.');
  }

  try {
    return executeSPCCalculation(data);
  } catch (err: any) {
    console.error('[calculateSPCMetrics] Error:', err);
    throw new HttpsError('internal', err?.message || 'Lỗi xử lý tính toán SPC');
  }
});

/**
 * 2. Scheduled Cron Job: Quét và hàn gắn CSDL tự động vào 2h sáng mỗi ngày (Asia/Ho_Chi_Minh)
 */
export const autoHealConsistencyCron = onSchedule(
  {
    schedule: '0 2 * * *',
    timeZone: 'Asia/Ho_Chi_Minh',
    retryCount: 1
  },
  async (event) => {
    console.log('[autoHealConsistencyCron] Starting daily data auto-healing at 02:00 AM...');
    const result = await runAutoHealDatabase(db);
    console.log('[autoHealConsistencyCron] Completed:', result);
    return;
  }
);

/**
 * 3. Callable Function: Tạo Báo cáo Excel Chất lượng đa sheet bằng SheetJS và lưu Storage
 */
export const generateQualityReport = onCall({ cors: true, timeoutSeconds: 120 }, async (request) => {
  // Chỉ cho phép người dùng đã xác thực
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Chỉ người dùng đã đăng nhập mới có quyền xuất báo cáo.');
  }

  const data = request.data as QualityReportRequest;
  try {
    const result = await generateQualityReportBackend(data, storage, db);
    return result;
  } catch (err: any) {
    console.error('[generateQualityReport] Error:', err);
    throw new HttpsError('internal', err?.message || 'Lỗi tạo file báo cáo Excel');
  }
});

/**
 * 4. Database Trigger: Đồng bộ Custom Claims khi quyền người dùng thay đổi tại /users/{uid}
 */
export const onUserRoleChanged = onValueWritten(
  {
    ref: '/users/{uid}',
    instance: '*'
  },
  async (event) => {
    const uid = event.params.uid;
    const afterData = event.data.after.val();

    if (!afterData) {
      console.log(`[onUserRoleChanged] User ${uid} deleted, skipping claims.`);
      return;
    }

    await syncUserCustomClaims(uid, afterData, auth);
  }
);
