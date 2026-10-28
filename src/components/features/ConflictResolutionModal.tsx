/**
 * ConflictResolutionModal.tsx
 * =============================
 * Giao diện Xử lý Xung đột Đồng thời (Concurrent Edit Conflict Modal - Phase 8).
 * Tuân thủ tiêu chuẩn ALCOA+ Data Integrity & FDA 21 CFR Part 11:
 * - Cảnh báo người dùng khi bản ghi trên Server đã bị người khác thay đổi (Version mismatch).
 * - Hiển thị Diff trực quan từng trường giữa Client và Server.
 * - Cho phép lựa chọn chiến lược phân giải: SERVER_WINS, CLIENT_WINS hoặc SAFE_MERGE.
 */

import React from 'react';
import {
  ExclamationTriangleIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ServerIcon,
  ComputerDesktopIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { Modal } from '../ui/CommonUI';
import {
  ConflictReport,
  ConflictResolutionStrategy,
} from '../../services/conflictResolutionService';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflictReport: ConflictReport | null;
  onResolve: (strategy: ConflictResolutionStrategy) => void;
  isResolving?: boolean;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  onClose,
  conflictReport,
  onResolve,
  isResolving = false,
}) => {
  if (!conflictReport) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cảnh báo Xung đột Phiên bản (Concurrent Edit Collision)"
    >
      <div className="space-y-6 text-sm">
        {/* Banner cảnh báo */}
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3.5">
          <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-900 dark:text-amber-200 text-base">
              Phát hiện thay đổi đồng thời trên Server!
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Bản ghi <strong>{conflictReport.entityId}</strong> (Loại: {conflictReport.entityType})
              đã được cập nhật bởi một người dùng khác trên máy chủ từ phiên bản v
              {conflictReport.expectedVersion} lên v{conflictReport.serverVersion}.
            </p>
          </div>
        </div>

        {/* Bảng so sánh trường xung đột */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-bold text-ink flex items-center gap-2">
              <ArrowsRightLeftIcon className="w-4 h-4 text-brand-600" />
              Chi tiết các trường dữ liệu khác biệt ({conflictReport.diffs.length} trường)
            </h5>
            <span className="text-xs text-ink-muted">
              Xung đột trực tiếp:{' '}
              <strong className="text-rose-600">{conflictReport.conflictingFields.length}</strong>{' '}
              trường
            </span>
          </div>

          <div className="border border-border rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-2 border-b border-border font-semibold text-ink-muted uppercase">
                  <th className="py-2.5 px-3">Tên trường</th>
                  <th className="py-2.5 px-3">
                    Dữ liệu máy chủ (Server v{conflictReport.serverVersion})
                  </th>
                  <th className="py-2.5 px-3">Dữ liệu trên máy của bạn (Client)</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {conflictReport.diffs.map((diff) => (
                  <tr
                    key={diff.fieldName}
                    className={
                      diff.isConflicting
                        ? 'bg-rose-50/60 dark:bg-rose-950/20'
                        : 'hover:bg-surface-2/40'
                    }
                  >
                    <td className="py-2 px-3 font-semibold text-ink font-mono">{diff.fieldName}</td>
                    <td className="py-2 px-3 font-mono text-ink-soft">
                      {typeof diff.serverValue === 'object'
                        ? JSON.stringify(diff.serverValue)
                        : String(diff.serverValue ?? '---')}
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-brand-700 dark:text-brand-300">
                      {typeof diff.clientValue === 'object'
                        ? JSON.stringify(diff.clientValue)
                        : String(diff.clientValue ?? '---')}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {diff.isConflicting ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                          Xung đột
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Khác biệt
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Khuyến nghị phân giải */}
        <div className="p-3 bg-surface-2 border border-border rounded-xl flex items-center gap-2 text-xs text-ink-muted">
          <ShieldCheckIcon className="w-4 h-4 text-ink-soft shrink-0" />
          <span>
            Mọi hành động phân giải sẽ được tự động ghi nhận vào <strong>ALCOA+ Audit Trail</strong>{' '}
            kèm danh tính người thực hiện.
          </span>
        </div>

        {/* Nút hành động lựa chọn chiến lược */}
        <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onResolve('SERVER_WINS')}
            disabled={isResolving}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border hover:bg-surface-2 text-ink font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ServerIcon className="w-4 h-4 text-ink-muted" />
            Giữ dữ liệu Máy chủ (Hủy thay đổi)
          </button>

          {conflictReport.conflictingFields.length === 0 && (
            <button
              type="button"
              onClick={() => onResolve('SAFE_MERGE')}
              disabled={isResolving}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircleIcon className="w-4 h-4" />
              Tự động Hợp nhất (Safe Merge)
            </button>
          )}

          <button
            type="button"
            onClick={() => onResolve('CLIENT_WINS')}
            disabled={isResolving}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ComputerDesktopIcon className="w-4 h-4" />
            Ghi đè bằng Dữ liệu của tôi
          </button>
        </div>
      </div>
    </Modal>
  );
};
