/**
 * PQM Security Rules Validator (Client/Application Guard)
 * Mô phỏng và tiền kiểm soát các ràng buộc an ninh của database.rules.json và storage.rules
 * Tuân thủ chuẩn GMP & ALCOA+: Phân quyền vai trò, Chống leo thang quyền hạn, Bất biến Audit Trail.
 */

import { Role } from '../types';

export interface SecurityUserContext {
  uid: string;
  email?: string;
  role: Role | null;
  isAdmin: boolean;
}

export type SecurityAction = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE';

export interface SecurityValidationResult {
  allowed: boolean;
  reason?: string;
}

export class SecurityRulesValidator {
  /**
   * Kiểm tra quyền truy cập vào đường dẫn dữ liệu
   */
  static evaluate(
    user: SecurityUserContext | null,
    action: SecurityAction,
    resourcePath: string,
    payload?: any,
    currentData?: any
  ): SecurityValidationResult {
    // 1. Chưa đăng nhập: chặn mọi thao tác
    if (!user || !user.uid) {
      return { allowed: false, reason: 'Chưa xác thực: Yêu cầu đăng nhập để truy cập tài nguyên.' };
    }

    // 2. ADMIN có toàn quyền
    if (user.isAdmin || user.role === 'ADMIN') {
      // Ngoại lệ duy nhất của ADMIN: Không được UPDATE hoặc DELETE Audit Trail (Quy định ALCOA+ bất biến)
      if (resourcePath.startsWith('audit_logs') && (action === 'UPDATE' || action === 'DELETE')) {
        return {
          allowed: false,
          reason: 'ALCOA+ Violation: Nhật ký kiểm toán là bất biến, không thể sửa đổi hoặc xóa.',
        };
      }
      return { allowed: true };
    }

    const segments = resourcePath.split('/');
    const rootCollection = segments[0];

    // 3. Ràng buộc Audit Trail
    if (rootCollection === 'audit_logs') {
      if (action === 'CREATE') {
        if (!payload?.timestamp && !payload?.createdAt) {
          return { allowed: false, reason: 'Bản ghi audit log thiếu timestamp.' };
        }
        return { allowed: true };
      }
      return { allowed: false, reason: 'Nhật ký audit trail chỉ cho phép thêm mới (Append-only).' };
    }

    // 4. Ràng buộc Users (Chống leo thang đặc quyền)
    if (rootCollection === 'users') {
      if (action === 'READ') {
        const targetUid = segments[1];
        if (targetUid === user.uid) return { allowed: true };
        return { allowed: false, reason: 'Chỉ được xem thông tin tài khoản của chính mình.' };
      }
      if (action === 'UPDATE' || action === 'CREATE') {
        // Cho phép tài khoản mới tạo profile tự gán role mặc định là GUEST và isAdmin: false
        if (action === 'CREATE' && (!currentData || Object.keys(currentData).length === 0)) {
          if (payload?.isAdmin) {
            return { allowed: false, reason: 'Không có quyền tự cấp quyền Admin.' };
          }
          if (payload?.role && payload.role !== 'GUEST') {
            return {
              allowed: false,
              reason: 'Không có quyền tự cấp quyền (Role Escalation Prevention).',
            };
          }
          return { allowed: true };
        }
        if (payload?.role || payload?.isAdmin) {
          return {
            allowed: false,
            reason: 'Không có quyền tự cấp quyền (Role Escalation Prevention).',
          };
        }
        return { allowed: true };
      }
      return { allowed: false, reason: 'Chỉ Admin mới có quyền xóa tài khoản.' };
    }

    // 5. Ràng buộc Sản phẩm & Danh mục Master Data
    if (
      rootCollection === 'products' ||
      rootCollection === 'raw_materials' ||
      rootCollection === 'product_formulas'
    ) {
      if (action === 'READ') return { allowed: true };
      if (user.role === 'QA') return { allowed: true };
      return {
        allowed: false,
        reason: 'Chỉ QA hoặc Admin mới có quyền sửa đổi dữ liệu sản phẩm / danh mục.',
      };
    }

    // 6. Ràng buộc TCCS
    if (rootCollection === 'tccs') {
      if (action === 'READ') return { allowed: true };
      if (user.role === 'QA') return { allowed: true };
      return {
        allowed: false,
        reason: 'Chỉ QA hoặc Admin mới có quyền cập nhật Tiêu chuẩn cơ sở.',
      };
    }

    // 7. Ràng buộc Lô sản xuất (Batches)
    if (rootCollection === 'batches') {
      if (action === 'READ') return { allowed: true };
      // Chuyển trạng thái sang RELEASED hoặc REJECTED: BẮT BUỘC QA
      if (payload?.status === 'RELEASED' || payload?.status === 'REJECTED') {
        if (user.role !== 'QA') {
          return {
            allowed: false,
            reason:
              'Chỉ QA mới có thẩm quyền Phê duyệt xuất xưởng (RELEASED) hoặc Từ chối (REJECTED) lô sản xuất.',
          };
        }
      }
      // Lô đã RELEASED hoặc REJECTED: không cho user bình thường chỉnh sửa
      if (
        (currentData?.status === 'RELEASED' || currentData?.status === 'REJECTED') &&
        user.role !== 'QA'
      ) {
        return {
          allowed: false,
          reason:
            'Lô sản xuất đã xuất xưởng (RELEASED) hoặc từ chối (REJECTED) bị khóa, không thể chỉnh sửa.',
        };
      }
      return { allowed: true };
    }

    // 8. Ràng buộc Phiếu kiểm nghiệm (Test Results)
    if (rootCollection === 'testResults') {
      if (action === 'READ') return { allowed: true };
      // Nếu phiếu đã có evaluationSnapshot (đã chốt đánh giá) hoặc LOCKED/APPROVED: chặn LAB/QC/USER sửa đổi
      if (
        (currentData?.evaluationSnapshot ||
          currentData?.overallStatus === 'APPROVED' ||
          currentData?.status === 'LOCKED') &&
        user.role !== 'QA'
      ) {
        return {
          allowed: false,
          reason:
            'Phiếu kiểm nghiệm đã được khóa/duyệt hoặc đã có snapshot đánh giá (chốt kết quả), không thể sửa đổi.',
        };
      }
      return { allowed: true };
    }

    // 9. Ràng buộc Cảnh báo chất lượng (Quality Alerts)
    if (rootCollection === 'quality_alerts') {
      if (action === 'READ') return { allowed: true };
      if (user.role === 'GUEST') {
        return {
          allowed: false,
          reason: 'Tài khoản GUEST không có quyền tạo hoặc cập nhật cảnh báo chất lượng.',
        };
      }
      return { allowed: true };
    }

    return { allowed: true };
  }

  /**
   * Kiểm tra tính hợp lệ của tệp tải lên Firebase Storage
   */
  static validateStorageUpload(
    user: SecurityUserContext | null,
    folder: string,
    file: { size: number; type: string }
  ): SecurityValidationResult {
    if (!user) {
      return { allowed: false, reason: 'Chưa đăng nhập: Không thể tải tệp lên hệ thống.' };
    }

    // 1. Chứng nhận CoA điện tử
    if (folder === 'coas') {
      if (user.role !== 'QA' && !user.isAdmin) {
        return { allowed: false, reason: 'Chỉ QA mới có quyền tải lên chứng nhận CoA.' };
      }
      if (file.type !== 'application/pdf') {
        return { allowed: false, reason: 'Chứng nhận CoA bắt buộc phải là định dạng PDF.' };
      }
      if (file.size > 10 * 1024 * 1024) {
        return { allowed: false, reason: 'Tệp CoA không được vượt quá 10MB.' };
      }
      return { allowed: true };
    }

    // 2. Tài liệu kiểm nghiệm (test_attachments)
    if (folder === 'test_attachments') {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return {
          allowed: false,
          reason: 'Tệp đính kèm chỉ chấp nhận định dạng PDF hoặc hình ảnh (JPEG, PNG, WEBP).',
        };
      }
      if (file.size > 20 * 1024 * 1024) {
        return { allowed: false, reason: 'Tệp đính kèm không được vượt quá 20MB.' };
      }
      return { allowed: true };
    }

    // 3. Ảnh mẫu sản phẩm
    if (folder === 'product_images') {
      if (user.role !== 'QA' && !user.isAdmin) {
        return {
          allowed: false,
          reason: 'Chỉ QA hoặc Admin mới có quyền cập nhật hình ảnh sản phẩm.',
        };
      }
      if (!file.type.startsWith('image/')) {
        return { allowed: false, reason: 'Tệp tải lên phải là hình ảnh.' };
      }
      if (file.size > 5 * 1024 * 1024) {
        return { allowed: false, reason: 'Ảnh sản phẩm không được vượt quá 5MB.' };
      }
      return { allowed: true };
    }

    return { allowed: user.isAdmin, reason: user.isAdmin ? undefined : 'Đường dẫn không hợp lệ.' };
  }
}
