import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { testResultRepository } from '../../repositories/firebase/FirebaseTestResultRepository';
import { testResultAppService } from '../../services/app/TestResultAppService';
import { useAppStore } from '../../store/useAppStore';
import { TestResult, Batch } from '../../types';

import { TEST_RESULT_QUERY_KEYS } from '../../constants/queryKeys';
export { TEST_RESULT_QUERY_KEYS };

/**
 * Hook tải danh sách Phiếu kiểm nghiệm
 */
export function useTestResultsQuery() {
  return useQuery<TestResult[]>({
    queryKey: TEST_RESULT_QUERY_KEYS.all,
    queryFn: async () => {
      const items = await testResultRepository.findAll();
      return items.sort(
        (a, b) =>
          new Date(b.testDate || b.createdAt || 0).getTime() -
          new Date(a.testDate || a.createdAt || 0).getTime()
      );
    },
  });
}

/**
 * Hook lấy chi tiết một Phiếu kiểm nghiệm theo ID
 */
export function useTestResultQuery(id: string | undefined) {
  return useQuery<TestResult | null>({
    queryKey: TEST_RESULT_QUERY_KEYS.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      return await testResultRepository.findById(id);
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook lấy danh sách Phiếu kiểm nghiệm theo Lô (batchId)
 */
export function useTestResultsByBatchQuery(batchId: string | undefined) {
  return useQuery<TestResult[]>({
    queryKey: TEST_RESULT_QUERY_KEYS.byBatch(batchId || ''),
    queryFn: async () => {
      if (!batchId) return [];
      return await testResultRepository.findByBatchId(batchId);
    },
    enabled: Boolean(batchId),
  });
}

/**
 * Mutation tạo Phiếu kiểm nghiệm mới
 */
export function useCreateTestResultMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({ testResult, batch }: { testResult: TestResult; batch?: Batch }) => {
      await testResultAppService.createTestResult(testResult, user, { batch });
      return testResult;
    },
    onSuccess: (newResult) => {
      queryClient.setQueryData<TestResult[]>(TEST_RESULT_QUERY_KEYS.all, (old = []) => [
        newResult,
        ...old,
      ]);
      queryClient.invalidateQueries({ queryKey: TEST_RESULT_QUERY_KEYS.all });
      if (newResult.batchId) {
        queryClient.invalidateQueries({
          queryKey: TEST_RESULT_QUERY_KEYS.byBatch(newResult.batchId),
        });
      }
    },
  });
}

/**
 * Mutation cập nhật Phiếu kiểm nghiệm
 */
export function useUpdateTestResultMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({
      testResult,
      oldResult,
    }: {
      testResult: TestResult;
      oldResult?: TestResult;
    }) => {
      await testResultAppService.updateTestResult(testResult, user, oldResult);
      return testResult;
    },
    onSuccess: (updatedResult) => {
      queryClient.setQueryData<TestResult[]>(TEST_RESULT_QUERY_KEYS.all, (old = []) =>
        old.map((r) => (r.id === updatedResult.id ? updatedResult : r))
      );
      queryClient.setQueryData(TEST_RESULT_QUERY_KEYS.detail(updatedResult.id), updatedResult);
      queryClient.invalidateQueries({ queryKey: TEST_RESULT_QUERY_KEYS.all });
      if (updatedResult.batchId) {
        queryClient.invalidateQueries({
          queryKey: TEST_RESULT_QUERY_KEYS.byBatch(updatedResult.batchId),
        });
      }
    },
  });
}

/**
 * Mutation xóa Phiếu kiểm nghiệm
 */
export function useDeleteTestResultMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({
      id,
      batchId,
      oldTestResult,
    }: {
      id: string;
      batchId?: string;
      oldTestResult?: TestResult;
    }) => {
      await testResultAppService.deleteTestResult(id, user, oldTestResult);
      return { id, batchId };
    },
    onSuccess: ({ id, batchId }) => {
      queryClient.setQueryData<TestResult[]>(TEST_RESULT_QUERY_KEYS.all, (old = []) =>
        old.filter((r) => r.id !== id)
      );
      queryClient.invalidateQueries({ queryKey: TEST_RESULT_QUERY_KEYS.all });
      if (batchId) {
        queryClient.invalidateQueries({
          queryKey: TEST_RESULT_QUERY_KEYS.byBatch(batchId),
        });
      }
    },
  });
}
