/**
 * queryClient.ts
 * Cấu hình tập trung cho TanStack Query (React Query)
 * Tối ưu hóa Server State cho hệ thống PQM:
 * - staleTime: 5 phút cho dữ liệu danh mục ít biến động (Sản phẩm, Nguyên liệu, TCCS)
 * - gcTime: 30 phút tự động dọn rác giải phóng RAM
 * - refetchOnWindowFocus: false chống gọi API Firebase dư thừa
 * - retry: 1
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 phút
      gcTime: 30 * 60 * 1000, // 30 phút
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});
