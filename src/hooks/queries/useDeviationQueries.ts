import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { firebaseDeviationRepository } from '../../repositories/firebase/FirebaseDeviationRepository';
import { deviationAppService } from '../../services/app/DeviationAppService';
import { useAppStore } from '../../store/useAppStore';
import { QualityDeviation, DeviationStatus } from '../../types/deviation';
import { PaginationOptions, QueryFilter, PaginatedResult } from '../../repositories/types';
import { DEVIATION_QUERY_KEYS } from '../../constants/queryKeys';

export { DEVIATION_QUERY_KEYS };

/**
 * Hook tải danh sách toàn bộ hồ sơ sai lệch (hoặc theo limit)
 */
export function useDeviationsQuery(limit?: number) {
  return useQuery<QualityDeviation[]>({
    queryKey: limit
      ? DEVIATION_QUERY_KEYS.paginated({ pageSize: limit })
      : DEVIATION_QUERY_KEYS.all,
    queryFn: async () => {
      if (limit) {
        const paginated = await firebaseDeviationRepository.findPaginated({
          pageSize: limit,
          orderBy: 'loggedAt',
          orderDirection: 'desc',
        });
        return paginated.items;
      }
      const items = await firebaseDeviationRepository.findAll();
      return items.sort((a, b) => (b.loggedAt || '').localeCompare(a.loggedAt || ''));
    },
  });
}

/**
 * Hook phân trang hồ sơ sai lệch
 */
export function useDeviationsPaginatedQuery(
  options?: PaginationOptions<QualityDeviation>,
  filters?: QueryFilter<QualityDeviation>[]
) {
  return useQuery<PaginatedResult<QualityDeviation>>({
    queryKey: DEVIATION_QUERY_KEYS.paginated(options, filters),
    queryFn: async () => {
      return await firebaseDeviationRepository.findPaginated(options, filters);
    },
  });
}

/**
 * Hook lấy chi tiết 1 hồ sơ sai lệch theo ID
 */
export function useDeviationQuery(id: string | undefined) {
  return useQuery<QualityDeviation | null>({
    queryKey: DEVIATION_QUERY_KEYS.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      return await firebaseDeviationRepository.findById(id);
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook lấy danh sách sai lệch theo Lô sản xuất
 */
export function useDeviationsByBatchQuery(batchId: string | undefined) {
  return useQuery<QualityDeviation[]>({
    queryKey: DEVIATION_QUERY_KEYS.byBatch(batchId || ''),
    queryFn: async () => {
      if (!batchId) return [];
      return await firebaseDeviationRepository.findByBatchId(batchId);
    },
    enabled: Boolean(batchId),
  });
}

/**
 * Mutation tạo hồ sơ sai lệch mới
 */
export function useCreateDeviationMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async (
      deviationData: Parameters<typeof deviationAppService.createDeviation>[0]
    ) => {
      return await deviationAppService.createDeviation(deviationData, user);
    },
    onSuccess: (newDeviation) => {
      queryClient.setQueryData<QualityDeviation[]>(DEVIATION_QUERY_KEYS.all, (old = []) => [
        newDeviation,
        ...old,
      ]);
      queryClient.invalidateQueries({ queryKey: DEVIATION_QUERY_KEYS.all });
      if (newDeviation.batchId) {
        queryClient.invalidateQueries({
          queryKey: DEVIATION_QUERY_KEYS.byBatch(newDeviation.batchId),
        });
      }
    },
  });
}

/**
 * Mutation cập nhật trạng thái sai lệch
 */
export function useUpdateDeviationStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: DeviationStatus;
      notes?: string;
    }) => {
      const state = useAppStore.getState();
      const currentUser = {
        email: state.user?.email || 'system',
        role: state.role,
        isAdmin: state.role === 'ADMIN',
      };
      await deviationAppService.updateStatus(id, status, currentUser, { notes });
      return { id, status, notes };
    },
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: DEVIATION_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: DEVIATION_QUERY_KEYS.detail(id) });
    },
  });
}

/**
 * Mutation xóa hồ sơ sai lệch qua Application Service
 */
export function useDeleteDeviationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const state = useAppStore.getState();
      const currentUser = {
        email: state.user?.email || 'system',
        role: state.role,
        isAdmin: state.role === 'ADMIN',
      };
      await deviationAppService.deleteDeviation(id, currentUser);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<QualityDeviation[]>(DEVIATION_QUERY_KEYS.all, (old = []) =>
        old.filter((d) => d.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: DEVIATION_QUERY_KEYS.all });
    },
  });
}
