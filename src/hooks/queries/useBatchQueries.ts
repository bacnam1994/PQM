import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { batchRepository } from '../../repositories/firebase/FirebaseBatchRepository';
import { batchAppService } from '../../services/app/BatchAppService';
import { useAppStore } from '../../store/useAppStore';
import { Batch, ElectronicSignature } from '../../types';

import { BATCH_QUERY_KEYS } from '../../constants/queryKeys';
export { BATCH_QUERY_KEYS };

/**
 * Hook tải danh sách Lô sản xuất với Caching & Background Refresh
 */
export function useBatchesQuery() {
  return useQuery<Batch[]>({
    queryKey: BATCH_QUERY_KEYS.all,
    queryFn: async () => {
      return await batchRepository.findAll();
    },
  });
}

/**
 * Hook lấy chi tiết một Lô sản xuất theo ID
 */
export function useBatchQuery(id: string | undefined) {
  return useQuery<Batch | null>({
    queryKey: BATCH_QUERY_KEYS.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      return await batchRepository.findById(id);
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook lấy danh sách Lô theo Sản phẩm
 */
export function useBatchesByProductQuery(productId: string | undefined) {
  return useQuery<Batch[]>({
    queryKey: BATCH_QUERY_KEYS.byProduct(productId || ''),
    queryFn: async () => {
      if (!productId) return [];
      return await batchRepository.findByProductId(productId);
    },
    enabled: Boolean(productId),
  });
}

/**
 * Mutation tạo Lô sản xuất mới
 */
export function useCreateBatchMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({
      batch,
      existingBatches = [],
      context = {},
    }: {
      batch: Batch;
      existingBatches?: Batch[];
      context?: any;
    }) => {
      await batchAppService.createBatch(batch, user, existingBatches, context);
      return batch;
    },
    onSuccess: (newBatch) => {
      queryClient.setQueryData<Batch[]>(BATCH_QUERY_KEYS.all, (old = []) => [...old, newBatch]);
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.all });
      if (newBatch.productId) {
        queryClient.invalidateQueries({
          queryKey: BATCH_QUERY_KEYS.byProduct(newBatch.productId),
        });
      }
    },
  });
}

/**
 * Mutation cập nhật thông tin Lô sản xuất
 */
export function useUpdateBatchMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({ batch, oldBatch }: { batch: Batch; oldBatch?: Batch }) => {
      await batchAppService.updateBatch(batch, user, oldBatch);
      return batch;
    },
    onSuccess: (updatedBatch) => {
      queryClient.setQueryData<Batch[]>(BATCH_QUERY_KEYS.all, (old = []) =>
        old.map((b) => (b.id === updatedBatch.id ? updatedBatch : b))
      );
      queryClient.setQueryData(BATCH_QUERY_KEYS.detail(updatedBatch.id), updatedBatch);
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.all });
    },
  });
}

/**
 * Mutation xóa Lô sản xuất
 */
export function useDeleteBatchMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({ id, batchNo }: { id: string; batchNo?: string }) => {
      await batchAppService.deleteBatch(id, user, batchNo);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<Batch[]>(BATCH_QUERY_KEYS.all, (old = []) =>
        old.filter((b) => b.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.all });
    },
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
      currentBatch,
      batchTestResults,
      signature,
    }: {
      batchId: string;
      newStatus: Batch['status'];
      rejectReason?: string;
      currentBatch?: Batch;
      batchTestResults?: any[];
      signature?: ElectronicSignature;
    }) => {
      await batchAppService.updateStatus(batchId, newStatus, user, {
        reason: rejectReason,
        currentBatch,
        batchTestResults,
        signature,
      });
      return { batchId, newStatus, rejectReason };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.detail(variables.batchId) });
    },
  });
}

/**
 * Mutation cập nhật tiến độ Lô
 */
export function useUpdateBatchProgressMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({
      batchId,
      progressPercent,
    }: {
      batchId: string;
      progressPercent: number;
    }) => {
      await batchAppService.updateProgress(batchId, progressPercent, user);
      return { batchId, progressPercent };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.detail(variables.batchId) });
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.all });
    },
  });
}
