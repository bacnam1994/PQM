/**
 * PQM — useMasterCriterionQueries
 * TanStack Query v5 hooks cho Master Criterion (master_criteria/).
 *
 * Kiến trúc: UI → Hook → Repository → Firebase RTDB
 * Không truy cập Firebase trực tiếp từ UI (tuân thủ Layering Boundary P8).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { masterCriterionRepository } from '../../repositories/firebase/FirebaseMasterCriterionRepository';
import { MasterCriterion, MasterCriterionCategory, MasterCriterionFormData } from '../../types';
import { MASTER_CRITERION_QUERY_KEYS } from '../../constants/queryKeys';
import { useAppStore } from '../../store/useAppStore';

export { MASTER_CRITERION_QUERY_KEYS };

// ─── Hàm tạo ID chuẩn hóa ────────────────────────────────────────────────────

function generateMasterCriterionId(canonicalName: string): string {
  const slug = canonicalName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40);
  return `crit_${slug}_${Date.now().toString(36)}`;
}

// ─── Query Hooks ──────────────────────────────────────────────────────────────

/**
 * Tải toàn bộ danh sách MasterCriterion (bao gồm inactive — dùng cho Admin)
 */
export function useMasterCriteriaQuery() {
  return useQuery<MasterCriterion[]>({
    queryKey: MASTER_CRITERION_QUERY_KEYS.all,
    queryFn: () => masterCriterionRepository.findAll(),
    staleTime: 1000 * 60 * 10, // 10 phút
  });
}

/**
 * Tải danh sách MasterCriterion đang active (dùng cho Autocomplete trong TCCS Form)
 */
export function useMasterCriteriaActiveQuery() {
  return useQuery<MasterCriterion[]>({
    queryKey: MASTER_CRITERION_QUERY_KEYS.active,
    queryFn: () => masterCriterionRepository.findActive(),
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Tải chi tiết 1 MasterCriterion theo ID
 */
export function useMasterCriterionQuery(id: string | undefined) {
  return useQuery<MasterCriterion | null>({
    queryKey: MASTER_CRITERION_QUERY_KEYS.detail(id || ''),
    queryFn: () => (id ? masterCriterionRepository.findById(id) : null),
    enabled: Boolean(id),
  });
}

/**
 * Tải danh sách MasterCriterion theo category
 */
export function useMasterCriteriaByCategory(category: MasterCriterionCategory | undefined) {
  return useQuery<MasterCriterion[]>({
    queryKey: MASTER_CRITERION_QUERY_KEYS.byCategory(category || ''),
    queryFn: () =>
      category ? masterCriterionRepository.findByCategory(category) : Promise.resolve([]),
    enabled: Boolean(category),
  });
}

// ─── Mutation Hooks ───────────────────────────────────────────────────────────

/**
 * Mutation tạo mới MasterCriterion
 */
export function useCreateMasterCriterionMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((s) => s.user);

  return useMutation({
    mutationFn: async (formData: MasterCriterionFormData) => {
      const now = new Date().toISOString();
      const item: MasterCriterion = {
        id: generateMasterCriterionId(formData.canonicalName),
        ...formData,
        isActive: formData.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        createdBy: user?.email || 'unknown',
        updatedBy: user?.email || 'unknown',
      };
      await masterCriterionRepository.save(item);
      return item;
    },
    onSuccess: (newItem) => {
      queryClient.setQueryData<MasterCriterion[]>(MASTER_CRITERION_QUERY_KEYS.all, (old = []) => [
        ...old,
        newItem,
      ]);
      queryClient.invalidateQueries({ queryKey: MASTER_CRITERION_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: MASTER_CRITERION_QUERY_KEYS.active });
    },
  });
}

/**
 * Mutation cập nhật MasterCriterion
 */
export function useUpdateMasterCriterionMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((s) => s.user);

  return useMutation({
    mutationFn: async ({
      id,
      formData,
    }: {
      id: string;
      formData: Partial<MasterCriterionFormData>;
    }) => {
      const existing = await masterCriterionRepository.findById(id);
      if (!existing) throw new Error(`Không tìm thấy chỉ tiêu ID: ${id}`);
      const updated: MasterCriterion = {
        ...existing,
        ...formData,
        id,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || 'unknown',
      };
      await masterCriterionRepository.save(updated);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<MasterCriterion[]>(MASTER_CRITERION_QUERY_KEYS.all, (old = []) =>
        old.map((c) => (c.id === updated.id ? updated : c))
      );
      queryClient.setQueryData(MASTER_CRITERION_QUERY_KEYS.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: MASTER_CRITERION_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: MASTER_CRITERION_QUERY_KEYS.active });
    },
  });
}

/**
 * Mutation xóa MasterCriterion (chỉ ADMIN)
 */
export function useDeleteMasterCriterionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await masterCriterionRepository.delete(id);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<MasterCriterion[]>(MASTER_CRITERION_QUERY_KEYS.all, (old = []) =>
        old.filter((c) => c.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: MASTER_CRITERION_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: MASTER_CRITERION_QUERY_KEYS.active });
    },
  });
}

/**
 * Mutation toggle isActive (enable/disable một chỉ tiêu)
 */
export function useToggleMasterCriterionActiveMutation() {
  const updateMutation = useUpdateMasterCriterionMutation();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return updateMutation.mutateAsync({ id, formData: { isActive } });
    },
  });
}
