import { useQuery } from '@tanstack/react-query';
import { testResultRepository } from '../../repositories/firebase/FirebaseTestResultRepository';
import { useAppStore } from '../../store/useAppStore';
import { TestResult } from '../../types';

export const TEST_RESULT_QUERY_KEYS = {
  all: ['testResults'] as const,
  detail: (id: string) => ['testResults', id] as const,
  byBatch: (batchId: string) => ['testResults', 'batch', batchId] as const,
};

/**
 * Hook tải danh sách Phiếu kiểm nghiệm
 */
export function useTestResultsQuery() {
  const storeTestResults = useAppStore((state) => state.testResults);

  return useQuery<TestResult[]>({
    queryKey: TEST_RESULT_QUERY_KEYS.all,
    queryFn: async () => {
      const items = await testResultRepository.findAll();
      return items.length > 0 ? items : storeTestResults;
    },
    initialData: storeTestResults.length > 0 ? storeTestResults : undefined,
  });
}

/**
 * Hook lấy chi tiết một Phiếu kiểm nghiệm theo ID
 */
export function useTestResultQuery(id: string | undefined) {
  const storeTestResults = useAppStore((state) => state.testResults);

  return useQuery<TestResult | null>({
    queryKey: TEST_RESULT_QUERY_KEYS.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      const found = await testResultRepository.findById(id);
      return found || storeTestResults.find((r) => r.id === id) || null;
    },
    enabled: Boolean(id),
    initialData: () => storeTestResults.find((r) => r.id === id) || null,
  });
}
