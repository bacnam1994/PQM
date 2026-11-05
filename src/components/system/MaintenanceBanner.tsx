import React, { useState } from 'react';
import {
  ExclamationTriangleIcon,
  WrenchScrewdriverIcon,
  ClockIcon,
  LockClosedIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useSystemMaintenance } from '../../hooks/useSystemMaintenance';

export const MaintenanceBanner: React.FC = () => {
  const {
    isMaintenanceActive,
    isBlockedForCurrentUser,
    isAdminInMaintenance,
    maintenanceConfig,
    setMaintenanceMode,
  } = useSystemMaintenance();

  const [isDisabling, setIsDisabling] = useState(false);

  if (!isMaintenanceActive || (!isBlockedForCurrentUser && !isAdminInMaintenance)) {
    return null;
  }

  // Trường hợp 1: Người dùng thông thường (QA, QC, Lab, SX, User) bị khóa quyền ghi (Read-Only)
  if (isBlockedForCurrentUser) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="w-full bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-100 px-4 py-2.5 shadow-sm transition-all animate-in fade-in slide-in-from-top-2 duration-300"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
              <LockClosedIcon className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-amber-950 dark:text-amber-200 tracking-tight">
                  HỆ THỐNG ĐANG BẢO TRÌ (CHẾ ĐỘ CHỈ ĐỌC)
                </span>
                <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  READ-ONLY GUARD
                </span>
              </div>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 truncate mt-0.5">
                {maintenanceConfig?.message ||
                  'Hệ thống đang được nâng cấp bảo trì định kỳ. Các thao tác Lưu/Sửa/Ký duyệt tạm khóa để bảo vệ dữ liệu.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {maintenanceConfig?.scheduledEndTime && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-medium">
                <ClockIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>
                  Dự kiến xong: <b>{maintenanceConfig.scheduledEndTime}</b>
                </span>
              </div>
            )}
            <span className="text-[10px] font-semibold text-amber-700/80 dark:text-amber-400/80 hidden md:inline">
              Chuẩn an toàn ALCOA+ GMP
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Trường hợp 2: Quản trị viên (ADMIN) đang trong phiên bảo trì kỹ thuật
  if (isAdminInMaintenance) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="w-full bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-indigo-500/15 border-b border-indigo-500/30 text-indigo-900 dark:text-indigo-100 px-4 py-2.5 shadow-sm transition-all animate-in fade-in slide-in-from-top-2 duration-300"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1 rounded-md bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 shrink-0">
              <WrenchScrewdriverIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-indigo-950 dark:text-indigo-200 tracking-tight">
                  CHẾ ĐỘ BẢO TRÌ ĐANG BẬT (QUẢN TRỊ VIÊN)
                </span>
                <span className="px-1.5 py-0.2 rounded-md bg-indigo-500/20 text-[10px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 border border-indigo-500/30">
                  ADMIN ONLY
                </span>
              </div>
              <p className="text-[11px] text-indigo-800/90 dark:text-indigo-300/90 truncate mt-0.5">
                Người dùng khác đang bị khóa quyền ghi. Bạn có toàn quyền thao tác kỹ thuật và kiểm
                tra.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isDisabling}
              onClick={async () => {
                if (
                  window.confirm(
                    'Bạn có chắc chắn muốn TẮT chế độ bảo trì để mở lại hệ thống cho toàn bộ nhân sự?'
                  )
                ) {
                  try {
                    setIsDisabling(true);
                    await setMaintenanceMode(false);
                  } finally {
                    setIsDisabling(false);
                  }
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-[11px] shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <CheckCircleIcon className="w-3.5 h-3.5" />
              <span>{isDisabling ? 'Đang mở lại...' : 'Tắt bảo trì & Mở hệ thống'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
