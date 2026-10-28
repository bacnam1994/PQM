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
      staleTime: 5 * 60 * 1000, // 5 phút
      gcTime: 24 * 60 * 60 * 1000, // 24 giờ cho offline cache
      networkMode: 'offlineFirst',
      refetchOnWindowFocus: false,
      retry: 2,
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 2,
    },
  },
});

// Thiết lập Persister ngoại tuyến an toàn (chỉ chạy trong môi trường browser có localStorage)
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const localStoragePersister = createSyncStoragePersister({
      storage: window.localStorage,
      key: 'PQM_OFFLINE_REACT_QUERY_CACHE',
    });

    persistQueryClient({
      queryClient,
      persister: localStoragePersister,
      maxAge: 24 * 60 * 60 * 1000, // 24 giờ
      buster: 'v5.3.1-offline-first',
    });

    // Lắng nghe khi có mạng trở lại -> Tự động phát lại các mutations đang tạm dừng
    window.addEventListener('online', () => {
      queryClient.resumePausedMutations();
    });
  } catch (e) {
    console.warn('[QueryClient] Không thể khởi tạo localStorage persister:', e);
  }
}
