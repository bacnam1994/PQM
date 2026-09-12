/**
 * cloudFunctionsService.ts
 * =========================
 * Service Gateway phía Client kết nối tới Firebase Cloud Functions (v2)
 * áp dụng chiến lược Hybrid Fallback (Offline-first & High Availability):
 * 
 * 1. calculateSPCMetricsRemote:
 *    - Ưu tiên gọi Cloud Function "calculateSPCMetrics".
 *    - Fallback: Chạy spcEngine.ts ngay tại client nếu offline/network error.
 * 
 * 2. generateQualityReportRemote:
 *    - Ưu tiên gọi Cloud Function "generateQualityReport" nhận Signed URL tải trực tiếp từ Firebase Storage.
 *    - Fallback: Sử dụng reportService.ts (SheetJS Client) tự động xuất và kích hoạt tải xuống tại trình duyệt.
 * 
 * 3. triggerAutoHealRemote:
 *    - Gửi yêu cầu kích hoạt bảo trì CSDL lên server.
 *    - Fallback: Thực thi dataConsistencyService.ts tại client.
 */

import { runComprehensiveSPC, SPCResult } from '../utils/spcEngine';
import { generateQualityReport, QualityReportOptions } from './reportService';
import { auditDataConsistency, generateAutoHealPlan, SystemDataSnapshot } from './dataConsistencyService';

// Cấu hình Base URL của Firebase Functions nếu gọi qua REST/HTTP endpoint
const FUNCTIONS_ORIGIN = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || 'https://asia-southeast1-v-biotech.cloudfunctions.net';

export interface RemoteSPCRequest {
  values: number[];
  usl?: number;
  lsl?: number;
  target?: number;
}

export interface RemoteReportRequest extends QualityReportOptions {
  appContext?: any;
}

/**
 * 1. Tính toán SPC & Nelson Rules với Hybrid Fallback
 */
export async function calculateSPCMetricsRemote(req: RemoteSPCRequest): Promise<SPCResult> {
  const values = req.values || [];
  
  // Nếu mảng rỗng hoặc quá ít điểm, tính ngay tại client cho nhanh
  if (values.length < 2) {
    return runComprehensiveSPC(values, req.usl, req.lsl, req.target);
  }

  // Thử gọi Cloud Function nếu có kết nối mạng
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const response = await fetch(`${FUNCTIONS_ORIGIN}/calculateSPCMetrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: req }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        const res = json.result || json.data || json;
        if (res.parameters && res.capability) {
          return {
            parameters: res.parameters,
            capability: res.capability,
            nelsonViolations: res.nelsonViolations || []
          };
        }
      }
    } catch (err) {
      // Fallback êm dịu về Client-side
      console.info('[cloudFunctionsService] Cloud Function calculateSPCMetrics unavailable, falling back to local SPC engine.', err);
    }
  }

  // Local fallback
  return runComprehensiveSPC(values, req.usl, req.lsl, req.target);
}

/**
 * 2. Tạo Báo cáo Excel Chất lượng với Hybrid Fallback
 */
export async function generateQualityReportRemote(req: RemoteReportRequest): Promise<{ downloadUrl?: string; localFallback: boolean; filename: string }> {
  // Thử gọi Cloud Function
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const payload = {
        period: req.period,
        year: req.year,
        month: req.month,
        quarter: req.quarter,
        productId: req.productId
      };

      const response = await fetch(`${FUNCTIONS_ORIGIN}/generateQualityReport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        const res = json.result || json.data || json;
        if (res.downloadUrl) {
          // Mở Signed URL để tải file trực tiếp từ Firebase Storage
          if (typeof window !== 'undefined') {
            const a = document.createElement('a');
            a.href = res.downloadUrl;
            a.download = res.filename || 'Bao_cao_chat_luong.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
          return { downloadUrl: res.downloadUrl, localFallback: false, filename: res.filename };
        }
      }
    } catch (err) {
      console.info('[cloudFunctionsService] Cloud Function generateQualityReport unavailable, falling back to local SheetJS generator.', err);
    }
  }

  // Local fallback bằng SheetJS Client
  if (req.appContext) {
    const result = generateQualityReport(req.appContext, {
      period: req.period,
      year: req.year,
      month: req.month,
      quarter: req.quarter,
      productId: req.productId
    });
    return { localFallback: true, filename: result.filename };
  }

  throw new Error('Không thể tạo báo cáo: Không có dữ liệu context cục bộ để fallback.');
}

/**
 * 3. Kích hoạt bảo trì & hàn gắn CSDL tự động
 */
export async function triggerAutoHealRemote(snapshot?: SystemDataSnapshot): Promise<{ success: boolean; healedCount: number; message: string }> {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const response = await fetch(`${FUNCTIONS_ORIGIN}/autoHealConsistencyCron`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        return { success: true, healedCount: 0, message: 'Đã kích hoạt tác vụ bảo trì server thành công.' };
      }
    } catch (err) {
      console.info('[cloudFunctionsService] Server trigger failed, running client-side auto-heal.', err);
    }
  }

  // Local fallback
  if (snapshot) {
    const report = auditDataConsistency(snapshot);
    const plan = generateAutoHealPlan(report, snapshot);
    return {
      success: true,
      healedCount: plan.totalActionsCount,
      message: `Hàn gắn cục bộ hoàn tất: Lập kế hoạch xử lý ${plan.totalActionsCount} hành động khắc phục dữ liệu.`
    };
  }

  return { success: false, healedCount: 0, message: 'Không có dữ liệu để thực hiện hàn gắn.' };
}
