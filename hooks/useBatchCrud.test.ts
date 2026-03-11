import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBatchCrud } from './useBatchCrud';
import { ref, set, update, get } from 'firebase/database';
import { useToast } from '../context/ToastContext';
import { Batch } from '../types';

// Mock Firebase
vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn().mockReturnValue({ key: 'mockRef' }),
  set: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  query: vi.fn(),
  orderByChild: vi.fn(),
  limitToLast: vi.fn(),
  equalTo: vi.fn(),
}));

// Mock ToastContext
vi.mock('../context/ToastContext', () => ({
  useToast: vi.fn(),
}));

describe('useBatchCrud', () => {
  const mockNotify = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ notify: mockNotify });
  });

  it('should add batch successfully', async () => {
    const { result } = renderHook(() => useBatchCrud());
    const mockBatch = { id: 'batch-1', batchNo: 'B001' } as Batch;

    (set as any).mockResolvedValue(undefined);

    await act(async () => {
      await result.current.addBatch(mockBatch);
    });

    expect(ref).toHaveBeenCalledWith(expect.anything(), 'batches/batch-1');
    expect(set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(mockBatch));
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
  });

  it('should update batch status successfully', async () => {
    const { result } = renderHook(() => useBatchCrud());
    (update as any).mockResolvedValue(undefined);

    await act(async () => {
      await result.current.updateBatchStatus('batch-1', 'RELEASED');
    });

    expect(ref).toHaveBeenCalledWith(expect.anything(), 'batches/batch-1');
    expect(update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'RELEASED' }));
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
  });

  it('should delete batch and related data successfully', async () => {
    const { result } = renderHook(() => useBatchCrud());
    const batchId = 'batch-1';

    // Mock related data existence
    const mockTestResultsSnap = { exists: () => true, val: () => ({ 'res-1': { id: 'res-1' } }) };
    const mockInvInSnap = { exists: () => true, val: () => ({ 'in-1': { id: 'in-1' } }) };
    const mockInvOutSnap = { exists: () => true, val: () => ({ 'out-1': { id: 'out-1' } }) };

    (get as any)
      .mockResolvedValueOnce(mockTestResultsSnap)
      .mockResolvedValueOnce(mockInvInSnap)
      .mockResolvedValueOnce(mockInvOutSnap);

    (update as any).mockResolvedValue(undefined);

    await act(async () => {
      await result.current.deleteBatch(batchId);
    });

    expect(update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      [`batches/${batchId}`]: null,
      'testResults/res-1': null,
      'inventoryIn/in-1': null,
      'inventoryOut/out-1': null
    }));
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
  });
});