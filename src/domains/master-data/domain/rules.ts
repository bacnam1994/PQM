/**
 * MASTER DATA DOMAIN: RULES & VALIDATIONS
 * Rào chắn thẩm quyền (RBAC) và kiểm tra tính hợp lệ dữ liệu Master Data.
 */

import {
  MasterCriterion,
  PharmacopoeiaStandard,
  TestingLaboratory,
  PharmacopoeiaActionContext,
  LabActionContext,
} from './types';
import { can } from '../../../services/permissionService';

export class MasterCriterionRules {
  public static validate(criterion: MasterCriterion): void {
    if (!criterion.canonicalName || !criterion.canonicalName.trim()) {
      throw new Error('Tên chỉ tiêu không được để trống.');
    }
  }

  public static validatePermission(
    currentUser: any,
    action: 'tccs:create' | 'tccs:update' | 'tccs:delete'
  ): void {
    if (!can(currentUser, action)) {
      const actionLabels = {
        'tccs:create': 'tạo Chỉ tiêu chuẩn',
        'tccs:update': 'sửa Chỉ tiêu chuẩn',
        'tccs:delete': 'xóa Chỉ tiêu chuẩn',
      };
      throw new Error(`Từ chối quyền: Bạn không có quyền ${actionLabels[action] || action}.`);
    }
  }

  public static validateBulkRenamePermission(currentUser: any): void {
    if (!can(currentUser, 'tccs:update')) {
      throw new Error(
        'Từ chối quyền: Chỉ Quản lý/Quản trị viên mới có quyền đổi tên chỉ tiêu hàng loạt.'
      );
    }
  }
}

export class PharmacopoeiaRules {
  public static validate(standard: PharmacopoeiaStandard): void {
    if (!standard.id || !standard.title || !standard.standard) {
      throw new Error('Dữ liệu không hợp lệ: Yêu cầu đầy đủ ID, tiêu đề và nội dung quy chuẩn.');
    }
  }

  public static validatePermission(
    context: PharmacopoeiaActionContext,
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SEED'
  ): void {
    const role = (context.actorRole || '').toUpperCase();
    if (action === 'DELETE' || action === 'SEED') {
      if (role !== 'ADMIN') {
        throw new Error(
          `Thẩm quyền bị từ chối: Chỉ Quản trị viên (ADMIN) mới có quyền thực hiện ${action} tiêu chuẩn dược điển.`
        );
      }
    } else {
      if (!['ADMIN', 'QA', 'QA_MANAGER'].includes(role)) {
        throw new Error(
          `Thẩm quyền bị từ chối: Vai trò ${context.actorRole} không có quyền thực hiện ${action} tiêu chuẩn dược điển.`
        );
      }
    }
  }

  public static validateDeletionReason(reason?: string): void {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Xóa tiêu chuẩn dược điển bắt buộc phải có lý do giải trình.');
    }
  }
}

export class LaboratoryRules {
  public static validate(lab: TestingLaboratory): void {
    if (!lab.id || !lab.code || !lab.canonicalName) {
      throw new Error(
        'Dữ liệu không hợp lệ: Yêu cầu đầy đủ ID, mã Code và Tên chuẩn hóa của phòng kiểm nghiệm.'
      );
    }
  }

  public static validatePermission(
    context: LabActionContext,
    action: 'CREATE' | 'UPDATE' | 'DELETE'
  ): void {
    const role = (context.actorRole || '').toUpperCase();
    if (action === 'DELETE') {
      if (role !== 'ADMIN') {
        throw new Error(
          'Thẩm quyền bị từ chối: Chỉ Quản trị viên (ADMIN) mới có quyền xóa đơn vị kiểm nghiệm.'
        );
      }
    } else {
      if (!['ADMIN', 'QA', 'QA_MANAGER'].includes(role)) {
        throw new Error(
          `Thẩm quyền bị từ chối: Vai trò ${context.actorRole} không có quyền thực hiện ${action} đơn vị kiểm nghiệm.`
        );
      }
    }
  }

  public static validateDeletionReason(reason?: string): void {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Xóa đơn vị kiểm nghiệm bắt buộc phải có lý do giải trình.');
    }
  }
}
