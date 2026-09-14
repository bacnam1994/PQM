import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tccsRepository } from '../../repositories/firebase/FirebaseTCCSRepository';
import { criteriaAliasRepository } from '../../repositories/firebase/FirebaseCriteriaAliasRepository';
import { aiLearnedMappingRepository } from '../../repositories/firebase/FirebaseAILearnedMappingRepository';
import { tccsAppService } from '../../services/app/TCCSAppService';
import { useAppStore } from '../../store/useAppStore';
import { TCCS, CriteriaAlias, AILearnedMapping, Batch } from '../../types';
import { BATCH_QUERY_KEYS } from './useBatchQueries';

import { TCCS_QUERY_KEYS } from '../../constants/queryKeys';
export { TCCS_QUERY_KEYS };

/**
 * Hook tải danh sách Tiêu chuẩn cơ sở (TCCS)
 */
export function useTCCSListQuery() {
  return useQuery<TCCS[]>({
    queryKey: TCCS_QUERY_KEYS.all,
    queryFn: async () => {
      return await tccsRepository.findAll();
    },
  });
}

/**
 * Hook lấy chi tiết một TCCS theo ID
 */
export function useTCCSQuery(id: string | undefined) {
  return useQuery<TCCS | null>({
    queryKey: TCCS_QUERY_KEYS.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      return await tccsRepository.findById(id);
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook lấy danh sách TCCS theo ProductId
 */
export function useTCCSByProductQuery(productId: string | undefined) {
  return useQuery<TCCS[]>({
    queryKey: TCCS_QUERY_KEYS.byProduct(productId || ''),
    queryFn: async () => {
      if (!productId) return [];
      return await tccsRepository.findByProductId(productId);
    },
    enabled: Boolean(productId),
  });
}

/**
 * Hook tải danh mục Criteria Aliases
 */
export function useCriteriaAliasesQuery() {
  return useQuery<CriteriaAlias[]>({
    queryKey: TCCS_QUERY_KEYS.aliases,
    queryFn: async () => {
      return await criteriaAliasRepository.findAll();
    },
  });
}

/**
 * Hook tải danh mục AI Learned Mappings
 */
export function useAILearnedMappingsQuery() {
  return useQuery<AILearnedMapping[]>({
    queryKey: TCCS_QUERY_KEYS.aiMappings,
    queryFn: async () => {
      return await aiLearnedMappingRepository.findAll();
    },
  });
}

/**
 * Mutation tạo mới TCCS
 */
export function useCreateTCCSMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({
      tccs,
      existingTCCSList = [],
    }: {
      tccs: TCCS;
      existingTCCSList?: TCCS[];
    }) => {
      await tccsAppService.createTCCS(tccs, existingTCCSList, user);
      return tccs;
    },
    onSuccess: (newTCCS) => {
      queryClient.setQueryData<TCCS[]>(TCCS_QUERY_KEYS.all, (old = []) => [...old, newTCCS]);
      queryClient.invalidateQueries({ queryKey: TCCS_QUERY_KEYS.all });
      if (newTCCS.productId) {
        queryClient.invalidateQueries({
          queryKey: TCCS_QUERY_KEYS.byProduct(newTCCS.productId),
        });
      }
    },
  });
}

/**
 * Mutation cập nhật TCCS
 */
export function useUpdateTCCSMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({
      tccs,
      oldTCCS,
      existingAliases = [],
    }: {
      tccs: TCCS;
      oldTCCS?: TCCS;
      existingAliases?: CriteriaAlias[];
    }) => {
      const aliases =
        existingAliases.length > 0
          ? existingAliases
          : queryClient.getQueryData<CriteriaAlias[]>(TCCS_QUERY_KEYS.aliases) || [];
      await tccsAppService.updateTCCS(tccs, oldTCCS, aliases, user);
      return tccs;
    },
    onSuccess: (updatedTCCS) => {
      queryClient.setQueryData<TCCS[]>(TCCS_QUERY_KEYS.all, (old = []) =>
        old.map((t) => (t.id === updatedTCCS.id ? updatedTCCS : t))
      );
      queryClient.setQueryData(TCCS_QUERY_KEYS.detail(updatedTCCS.id), updatedTCCS);
      queryClient.invalidateQueries({ queryKey: TCCS_QUERY_KEYS.all });
      if (updatedTCCS.productId) {
        queryClient.invalidateQueries({
          queryKey: TCCS_QUERY_KEYS.byProduct(updatedTCCS.productId),
        });
      }
    },
  });
}

/**
 * Mutation xóa TCCS
 */
export function useDeleteTCCSMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({
      id,
      code,
      associatedBatches = [],
    }: {
      id: string;
      code?: string;
      associatedBatches?: Batch[];
    }) => {
      const batches =
        associatedBatches.length > 0
          ? associatedBatches
          : queryClient.getQueryData<Batch[]>(BATCH_QUERY_KEYS.all) || [];
      const aliases = queryClient.getQueryData<CriteriaAlias[]>(TCCS_QUERY_KEYS.aliases) || [];
      await tccsAppService.deleteTCCS(id, batches, user, code, aliases);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<TCCS[]>(TCCS_QUERY_KEYS.all, (old = []) =>
        old.filter((t) => t.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: TCCS_QUERY_KEYS.all });
    },
  });
}
