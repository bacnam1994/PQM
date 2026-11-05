import React, { useState, useEffect } from 'react';
import {
  WrenchScrewdriverIcon,
  ShieldCheckIcon,
  ClockIcon,
  ChatBubbleBottomCenterTextIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useSystemMaintenance } from '../../../hooks/useSystemMaintenance';
import { formatDateStandard } from '../../../utils';

export const MaintenanceManager: React.FC = () => {
  const { isMaintenanceActive, maintenanceConfig, setMaintenanceMode } = useSystemMaintenance();

  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [scheduledEndTime, setScheduledEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Đồng bộ form với cấu hình hiện tại khi nạp xong
  useEffect(() => {
    if (maintenanceConfig) {
      setEnabled(Boolean(maintenanceConfig.enabled));
      setMessage(maintenanceConfig.message || '');
      setScheduledEndTime(maintenanceConfig.scheduledEndTime || '');
    } else {
      setEnabled(false);
      setMessage('');
      setScheduledEndTime('');
    }
  }, [maintenanceConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const actionText = enabled
      ? 'KÍCH HOẠT chế độ bảo trì (Người dùng thông thường sẽ chỉ có quyền Đọc)'
      : 'TẮT chế độ bảo trì (Hệ thống mở lại bình thường cho toàn bộ nhân sự)';

    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText}?`)) {
      return;
    }

    try {
      setIsSubmitting(true);
      await setMaintenanceMode(enabled, {
        message: message.trim() || undefined,
        scheduledEndTime: scheduledEndTime.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="bg-surface p-5 sm:p-6 rounded-2xl border border-border shadow-xs space-y-5 lg:col-span-2 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20">
            <WrenchScrewdriverIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-ink tracking-tight font-display">
                Chế độ Bảo trì Hệ thống (Maintenance Mode)
              </h3>
              {isMaintenanceActive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Đang Bảo Trì (Read-Only)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Hoạt Động Bình Thường
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Khóa an toàn các thao tác ghi dữ liệu dở dang khi Admin nâng cấp hoặc sửa đổi máy chủ.
            </p>
          </div>
        </div>

        {maintenanceConfig?.updatedAt && (
          <div className="text-[11px] text-ink-muted flex items-center gap-1">
            <span>Cập nhật lần cuối:</span>
            <span className="font-semibold text-ink">
              {formatDateStandard(maintenanceConfig.updatedAt)}
            </span>
            {maintenanceConfig.updatedBy && (
              <span>({maintenanceConfig.updatedBy.split('@')[0]})</span>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Toggle Switch */}
        <div className="p-4 rounded-xl border border-border/80 bg-surface-2/60 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-ink">Kích hoạt Chế độ Bảo trì</p>
            <p className="text-xs text-ink-muted leading-relaxed">
              Khi bật, ứng dụng tự động hiển thị Banner cảnh báo và chuyển toàn bộ người dùng sang{' '}
              <b>Chỉ đọc (Read-only)</b> để bảo vệ toàn vẹn dữ liệu.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={isSubmitting}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Thông điệp bảo trì */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <ChatBubbleBottomCenterTextIcon className="w-4 h-4 text-indigo-500" />
              <span>Thông điệp hiển thị cho nhân sự</span>
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSubmitting}
              placeholder="VD: Hệ thống đang nâng cấp định kỳ. Quý anh/chị vui lòng quay lại sau ít phút..."
              className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs font-medium text-ink placeholder:text-ink-muted focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          {/* Thời gian dự kiến hoàn thành */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4 text-indigo-500" />
              <span>Thời gian dự kiến xong</span>
            </label>
            <input
              type="text"
              value={scheduledEndTime}
              onChange={(e) => setScheduledEndTime(e.target.value)}
              disabled={isSubmitting}
              placeholder="VD: 10:30 hoặc 30 phút nữa"
              className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs font-medium text-ink placeholder:text-ink-muted focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* Cảnh báo an toàn GMP */}
        <div className="p-3 bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
          <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <b>Khuyến nghị GMP & ALCOA+:</b> Trước khi thực hiện bảo trì cơ sở dữ liệu lớn hoặc nâng
            cấp công thức, hãy sử dụng tính năng <b>"Xuất dữ liệu (.json)"</b> ở bên dưới để tải về
            bản sao lưu dự phòng. Mọi thao tác bật/tắt bảo trì đều được lưu vào Dấu vết kiểm toán
            (Audit Trail).
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs text-white shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 ${
              enabled ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isSubmitting ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                <span>Đang lưu cấu hình...</span>
              </>
            ) : (
              <>
                <ShieldCheckIcon className="w-4 h-4" />
                <span>{enabled ? 'Áp dụng Bật Bảo Trì' : 'Lưu Trạng Thái Bình Thường'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
};
