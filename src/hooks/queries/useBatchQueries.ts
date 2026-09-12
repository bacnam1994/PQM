import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { batchRepository } from '../../repositories/firebase/FirebaseBatchRepository';
import { batchAppService } from '../../services/app/BatchAppService';
import { useAppStore } from '../../store/useAppStore';
import { Batch } from '../../types';

export const BATCH_QUERY_KEYS = {
  all: ['batches'] as const,
  detail: (id: string) => ['batches', id] as const,
  byProduct: (productId: string) => ['batches', 'product', productId] as const,
};

/**
 * Hook tải danh sách Lô sản xuất với Caching & Background Refresh
 */
export function useBatchesQuery() {
  const storeBatches = useAppStore((state) => state.batches);

  return useQuery<Batch[]>({
    queryKey: BATCH_QUERY_KEYS.all,
    queryFn: async () => {
      const items = await batchRepository.findAll();
      return items.length > 0 ? items : storeBatches;
    },
    initialData: storeBatches.length > 0 ? storeBatches : undefined,
  });
}

/**
 * Hook lấy chi tiết một Lô sản xuất theo ID
 */
export function useBatchQuery(id: string | undefined) {
  const storeBatches = useAppStore((state) => state.batches);

  return useQuery<Batch | null>({
    queryKey: BATCH_QUERY_KEYS.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      const found = await batchRepository.findById(id);
      return found || storeBatches.find((b) => b.id === id) || null;
    },
    enabled: Boolean(id),
    initialData: () => storeBatches.find((b) => b.id === id) || null,
  });
}

/**
 * Mutation cập nhật trạng thái Lô (Release / Reject / Testing) với Invalidation tự động
 */
export function useUpdateBatchStatusMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({
      batchId,
      newStatus,
      rejectReason,
    }: {
      batchId: string;
      newStatus: Batch['status'];
      rejectReason?: string;
    }) => {
      await batchAppService.updateStatus(batchId, newStatus, user, { reason: rejectReason });
      return { batchId, newStatus };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.detail(variables.batchId) });
    },
  });
}
