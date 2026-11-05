import { useState, useEffect, useCallback } from 'react';
import { systemAppService, SystemMaintenanceConfig } from '../services/app/SystemAppService';
import { useAppStore } from '../store/useAppStore';

let globalMaintenanceConfig: SystemMaintenanceConfig | null = null;
const listeners = new Set<(config: SystemMaintenanceConfig | null) => void>();

let hasInitializedListener = false;

function initGlobalMaintenanceListener() {
  if (hasInitializedListener || typeof window === 'undefined') return;
  hasInitializedListener = true;

  try {
    systemAppService.listenMaintenanceConfig((config) => {
      globalMaintenanceConfig = config;
      listeners.forEach((fn) => fn(config));
    });
  } catch (err) {
    console.warn('[useSystemMaintenance] Không thể khởi tạo listener:', err);
  }
}

export function useSystemMaintenance() {
  const [config, setConfig] = useState<SystemMaintenanceConfig | null>(globalMaintenanceConfig);
  const user = useAppStore((state) => state.user);
  const notify = useAppStore((state) => state.notify);

  useEffect(() => {
    initGlobalMaintenanceListener();

    const handleUpdate = (newConfig: SystemMaintenanceConfig | null) => {
      setConfig(newConfig);
    };

    listeners.add(handleUpdate);
    // Đồng bộ ngay giá trị hiện tại nếu có
    if (globalMaintenanceConfig !== config) {
      setConfig(globalMaintenanceConfig);
    }

    return () => {
      listeners.delete(handleUpdate);
    };
  }, [config]);

  const userRole = (user?.role || '').trim().toUpperCase();
  const isAdmin = userRole === 'ADMIN' || Boolean(user?.isAdmin);

  const isMaintenanceActive = Boolean(config?.enabled);
  // Nếu bảo trì đang bật và người dùng không phải ADMIN -> Bị khóa quyền ghi
  const isBlockedForCurrentUser = isMaintenanceActive && !isAdmin;
  const isAdminInMaintenance = isMaintenanceActive && isAdmin;

  const setMaintenanceMode = useCallback(
    async (enabled: boolean, options: { message?: string; scheduledEndTime?: string } = {}) => {
      if (!user) {
        throw new Error('Yêu cầu đăng nhập để thực hiện thao tác này.');
      }
      if (!isAdmin) {
        throw new Error('Chỉ có Quản trị viên (ADMIN) mới có quyền bật/tắt chế độ bảo trì.');
      }

      try {
        const result = await systemAppService.setMaintenanceMode(enabled, options, {
          actorId: (user as any).id || user.uid,
          actorRole: 'ADMIN',
          actorEmail: user.email || undefined,
          reason: enabled ? 'Bật chế độ bảo trì hệ thống' : 'Tắt chế độ bảo trì hệ thống',
        });

        notify({
          type: 'SUCCESS',
          title: enabled ? 'Đã bật Chế độ Bảo trì' : 'Đã tắt Chế độ Bảo trì',
          message: result.message || 'Cập nhật trạng thái bảo trì thành công.',
        });
      } catch (err: any) {
        notify({
          type: 'ERROR',
          title: 'Lỗi cập nhật bảo trì',
          message: err.message || 'Không thể cập nhật trạng thái bảo trì hệ thống.',
        });
        throw err;
      }
    },
    [user, isAdmin, notify]
  );

  return {
    maintenanceConfig: config,
    isMaintenanceActive,
    isBlockedForCurrentUser,
    isAdminInMaintenance,
    setMaintenanceMode,
  };
}
