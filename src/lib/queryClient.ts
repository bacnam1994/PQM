/**
 * queryClient.ts
 * Cấu hình tập trung cho TanStack Query (React Query) v5
 * Tối ưu hóa Server State & Chuẩn hóa Offline-First cho hệ thống PQM:
 * - networkMode: 'offlineFirst' thực thi ngay cả khi mất kết nối, tự động retry & pause
 * - persistQueryClient: Lưu cache & mutations vào localStorage qua createSyncStoragePersister
 * - staleTime: 5 phút cho dữ liệu danh mục (Sản phẩm, Nguyên liệu, TCCS)
 * - gcTime: 24 giờ cho cache offline bền vững
 * - refetchOnWindowFocus: false chống gọi API Firebase dư thừa
 */

import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 phút - Dữ liệu đã được đồng bộ Realtime qua Firebase WebSockets
      gcTime: 24 * 60 * 60 * 1000, // 24 giờ cho offline cache dự phòng
      networkMode: 'offlineFirst',
      refetchOnWindowFocus: false, // Chống bão refetch làm đơ Main Thread khi chuyển tab/trang
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 1,
    },
  },
});

// Thiết lập Persister ngoại tuyến an toàn (chỉ chạy trong môi trường browser có localStorage)
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const localStoragePersister = createSyncStoragePersister({
      storage: window.localStorage,
      key: 'PQM_OFFLINE_REACT_QUERY_CACHE',
      throttleTime: 2000, // Giới hạn ghi đĩa tối đa 1 lần mỗi 2s, giải phóng Main Thread
    });

    const activeAppVersion = (import.meta as any).env?.VITE_APP_VERSION || 'v11.102.0';

    persistQueryClient({
      queryClient,
      persister: localStoragePersister,
      maxAge: 24 * 60 * 60 * 1000, // 24 giờ
      buster: activeAppVersion, // Tự động dọn dẹp cache cũ khi deploy phiên bản mới
    });

    // Lắng nghe khi có mạng trở lại -> Tự động phát lại các mutations đang tạm dừng
    window.addEventListener('online', () => {
      queryClient.resumePausedMutations();
      queryClient.invalidateQueries();
    });
  } catch (e) {
    console.warn('[QueryClient] Không thể khởi tạo localStorage persister:', e);
  }
}
