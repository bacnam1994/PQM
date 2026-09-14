import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOperationalWorkflow } from './useOperationalWorkflow';

// Mock dependencies
vi.mock('@tanstack/react-query', () => ({
  useIsMutating: vi.fn(() => 0),
  useIsFetching: vi.fn(() => 0),
}));

vi.mock('../../firebase', () => ({
  db: {},
}));

vi.mock('firebase/database', () => ({
  goOnline: vi.fn(),
}));

vi.mock('../../lib/queryClient', () => ({
  queryClient: {
    resumePausedMutations: vi.fn(),
  },
}));

describe('useOperationalWorkflow Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default operational lifecycle state', () => {
    const { result } = renderHook(() => useOperationalWorkflow());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasDraft).toBe(false);
    expect(result.current.isAiProcessing).toBe(false);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('manages AI filled fields tracking accurately', () => {
    const { result } = renderHook(() => useOperationalWorkflow());

    act(() => {
      result.current.markAiFilled('pH');
      result.current.markAiFilled('moisture');
    });

    expect(result.current.aiFilledFields.has('pH')).toBe(true);
    expect(result.current.aiFilledFields.has('moisture')).toBe(true);
    expect(result.current.aiFilledFields.has('appearance')).toBe(false);

    act(() => {
      result.current.clearAiFilled();
    });

    expect(result.current.aiFilledFields.size).toBe(0);
  });

  it('handles executeSave lifecycle with success and sets isDirty to false', async () => {
    const { result } = renderHook(() => useOperationalWorkflow());

    act(() => {
      result.current.setIsDirty(true);
    });
    expect(result.current.isDirty).toBe(true);

    const mockSaveFn = vi.fn().mockResolvedValue({ id: '123', status: 'PASS' });

    let saveResult;
    await act(async () => {
      saveResult = await result.current.executeSave(mockSaveFn);
    });

    expect(mockSaveFn).toHaveBeenCalledTimes(1);
    expect(saveResult).toEqual({ id: '123', status: 'PASS' });
    expect(result.current.saveSuccess).toBe(true);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('handles executeSave failure, captures normalized error, and provides 1-click retry', async () => {
    const { result } = renderHook(() => useOperationalWorkflow());

    let attempt = 0;
    const failingSaveFn = vi.fn().mockImplementation(async () => {
      attempt++;
      if (attempt === 1) {
        throw new Error('NetworkError: connection refused');
      }
      return { success: true };
    });

    await act(async () => {
      await result.current.executeSave(failingSaveFn);
    });

    expect(failingSaveFn).toHaveBeenCalledTimes(1);
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.stage).toBe('SAVE');
    expect(result.current.error?.type).toBe('NETWORK');
    expect(result.current.error?.code).toBe('NETWORK_ERROR');
    expect(result.current.canRetry).toBe(true);

    // Test retry
    await act(async () => {
      await result.current.retry();
    });

    expect(failingSaveFn).toHaveBeenCalledTimes(2);
    expect(result.current.saveSuccess).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('translates Firebase permission error accurately to Vietnamese', () => {
    const { result } = renderHook(() => useOperationalWorkflow());

    act(() => {
      result.current.setError(new Error('permission_denied at /testResults'), 'SAVE');
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.type).toBe('PERMISSION');
    expect(result.current.error?.message).toContain('Bạn không có quyền thực hiện');
    expect(result.current.error?.retryable).toBe(false);
  });
});
