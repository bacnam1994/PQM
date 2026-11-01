/**
 * versionSyncService.ts
 * Quản lý đồng bộ phiên bản Ưu tiên Server-First (Server-First Version Sync)
 * =========================================================================
 * NGUYÊN TẮC:
 * 1. SERVER-FIRST: Luôn đối chiếu phiên bản với máy chủ (Firebase Hosting) trước khi dùng cache.
 * 2. CHỐNG KẸT CHUNK CŨ: Khi vừa deploy bản mới, các chunk JS cũ bị xóa khỏi server. Nếu client
 *    còn giữ index.html cũ thì việc điều hướng sẽ báo lỗi chunk. Service này phát hiện ngay và
 *    tự động nạp lại bản mới nhất từ server.
 * 3. THÔNG BÁO THỜI GIAN THỰC: Kiểm tra khi mở app, khi tab active trở lại (focus), hoặc định kỳ.
 */

export interface VersionInfo {
  version: string;
  buildTime?: string;
}

class VersionSyncService {
  private currentVersion: string = (import.meta as any).env?.VITE_APP_VERSION || 'v11.103.1';
  private currentBuildTime: string = (import.meta as any).env?.VITE_BUILD_TIME || '';
  private checkInterval: any = null;
  private hasPromptedUpdate = false;

  /**
   * Khởi động cơ chế kiểm tra phiên bản định kỳ và sự kiện tab focus
   */
  init(onNewVersionDetected?: (serverVersion: VersionInfo) => void): void {
    if (typeof window === 'undefined') return;

    // 1. Kiểm tra ngay khi khởi động
    this.checkForUpdates(onNewVersionDetected);

    // 2. Kiểm tra khi người dùng quay lại tab (window focus)
    window.addEventListener('focus', () => {
      this.checkForUpdates(onNewVersionDetected);
    });

    // 3. Kiểm tra định kỳ mỗi 5 phút
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = setInterval(
      () => {
        this.checkForUpdates(onNewVersionDetected);
      },
      5 * 60 * 1000
    );
  }

  /**
   * Truy vấn version.json từ Server (chống cache với timestamp & no-store)
   */
  async checkForUpdates(
    onNewVersionDetected?: (serverVersion: VersionInfo) => void
  ): Promise<boolean> {
    if (typeof fetch === 'undefined') return false;

    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!response.ok) return false;

      const serverInfo: VersionInfo = await response.json();
      if (!serverInfo || !serverInfo.version) return false;

      // So sánh phiên bản hoặc thời điểm build
      const isDifferent =
        serverInfo.version !== this.currentVersion ||
        (serverInfo.buildTime &&
          this.currentBuildTime &&
          serverInfo.buildTime !== this.currentBuildTime);

      if (isDifferent) {
        if (!this.hasPromptedUpdate) {
          this.hasPromptedUpdate = true;
          console.info(
            `[VersionSync] Phát hiện phiên bản mới từ Server: ${serverInfo.version} (Hiện tại: ${this.currentVersion})`
          );

          if (onNewVersionDetected) {
            onNewVersionDetected(serverInfo);
          }
        }
        return true;
      }
    } catch {
      // Bỏ qua lỗi mạng khi offline
    }

    return false;
  }

  /**
   * Thực hiện tải lại ứng dụng từ Server, xóa sạch cache trình duyệt
   */
  forceReloadFromServer(): void {
    if (typeof window === 'undefined') return;

    try {
      // Xóa sessionStorage lưu cờ reload
      sessionStorage.clear();
    } catch {}

    // Reload cứng từ server
    window.location.reload();
  }

  getCurrentVersion(): string {
    return this.currentVersion;
  }
}

export const versionSyncService = new VersionSyncService();
