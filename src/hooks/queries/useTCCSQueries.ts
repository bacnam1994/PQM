import { useQuery } from '@tanstack/react-query';
import { tccsRepository } from '../../repositories/firebase/FirebaseTCCSRepository';
import { useAppStore } from '../../store/useAppStore';
import { TCCS } from '../../types';

export const TCCS_QUERY_KEYS = {
  all: ['tccsList'] as const,
  detail: (id: string) => ['tccsList', id] as const,
  byProduct: (productId: string) => ['tccsList', 'product', productId] as const,
};

/**
 * Hook tải danh sách Tiêu chuẩn cơ sở (TCCS)
 */
export function useTCCSListQuery() {
  const storeTccs = useAppStore((state) => state.tccsList);

  return useQuery<TCCS[]>({
    queryKey: TCCS_QUERY_KEYS.all,
    queryFn: async () => {
      const items = await tccsRepository.findAll();
      return items.length > 0 ? items : storeTccs;
    },
    initialData: storeTccs.length > 0 ? storeTccs : undefined,
  });
}

/**
 * Hook lấy chi tiết một TCCS theo ID
 */
export function useTCCSQuery(id: string | undefined) {
  const storeTccs = useAppStore((state) => state.tccsList);

  return useQuery<TCCS | null>({
    queryKey: TCCS_QUERY_KEYS.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      const found = await tccsRepository.findById(id);
      return found || storeTccs.find((t) => t.id === id) || null;
    },
    enabled: Boolean(id),
    initialData: () => storeTccs.find((t) => t.id === id) || null,
  });
}
