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
import { executeBatchReleaseBackend, BatchReleaseCommandRequest } from './releaseFunction';
import {
  executeCreateElectronicSignatureBackend,
  CreateSignatureServerRequest,
} from './signatureFunction';

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
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'Chỉ người dùng đã đăng nhập mới có quyền thực hiện tính toán SPC.'
    );
  }

  const data = request.data as SPCMetricsRequest;
  if (!data || !Array.isArray(data.values)) {
    throw new HttpsError('invalid-argument', 'Yêu cầu mảng "values" chứa các giá trị kiểm nghiệm.');
  }
  if (data.values.length > 10000) {
    throw new HttpsError(
      'invalid-argument',
      'Số lượng điểm dữ liệu SPC vượt quá giới hạn an toàn (tối đa 10,000 điểm).'
    );
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
    retryCount: 1,
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
export const generateQualityReport = onCall(
  { cors: true, timeoutSeconds: 120 },
  async (request) => {
    // Chỉ cho phép người dùng đã xác thực và không phải tài khoản GUEST
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError(
        'unauthenticated',
        'Chỉ người dùng đã đăng nhập mới có quyền xuất báo cáo.'
      );
    }

    const uid = request.auth.uid;
    let role = request.auth.token?.role;
    const isAdminClaim = request.auth.token?.isAdmin === true || role === 'ADMIN';
    if (!role && !isAdminClaim) {
      const userSnap = await db.ref(`/users/${uid}/role`).once('value');
      role = userSnap.val() || 'GUEST';
    }
    if (!isAdminClaim && (!role || role === 'GUEST')) {
      throw new HttpsError(
        'permission-denied',
        'Tài khoản GUEST chưa được cấp quyền truy xuất dữ liệu báo cáo chất lượng.'
      );
    }

    const data = request.data as QualityReportRequest;
    try {
      const result = await generateQualityReportBackend(data, storage, db);
      return result;
    } catch (err: any) {
      console.error('[generateQualityReport] Error:', err);
      throw new HttpsError('internal', err?.message || 'Lỗi tạo file báo cáo Excel');
    }
  }
);

/**
 * 4. Database Trigger: Đồng bộ Custom Claims khi quyền người dùng thay đổi tại /users/{uid}
 */
export const onUserRoleChanged = onValueWritten(
  {
    ref: '/users/{uid}',
    instance: '*',
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

/**
 * 5. Callable Function: Phê duyệt Xuất xưởng Lô sản phẩm (Canonical Server Release Command)
 *
 * Single release authority in cloud functions with atomicity, idempotency, OCC, and audit.
 */
export const approveBatchRelease = onCall({ cors: true, timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'Yêu cầu xác thực tài khoản để thực hiện lệnh xuất xưởng.'
    );
  }

  const data = request.data as BatchReleaseCommandRequest;
  return executeBatchReleaseBackend(data, request.auth, db);
});

/**
 * 6. Callable Function: Tạo Chữ ký Điện tử (Canonical Server-Side Electronic Signature)
 *
 * Implements technical controls aligned with FDA 21 CFR Part 11 & GMP-WHO Annex 11 principles.
 * Verifies session freshness, enforces RBAC, computes NIST SHA-256 checksum, and writes to DB server-side.
 */
export const requestElectronicSignature = onCall(
  { cors: true, timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'Yêu cầu đăng nhập để thực hiện ký điện tử có giá trị pháp lý.'
      );
    }

    const data = request.data as CreateSignatureServerRequest;
    const correlationId = data?.correlationId || `REQ-SIG-${Date.now()}`;

    try {
      return await executeCreateElectronicSignatureBackend(data, request.auth, db);
    } catch (err: any) {
      console.error(
        `[requestElectronicSignature][${correlationId}] Error creating signature:`,
        err?.message || err
      );

      if (err instanceof HttpsError) {
        throw err;
      }

      throw new HttpsError('internal', 'Không thể tạo chữ ký điện tử trên máy chủ.');
    }
  }
);
