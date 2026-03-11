import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTCCSCrud } from './useTCCSCrud';
import { ref, update, get } from 'firebase/database';
import { useToast } from '../context/ToastContext';
import { useAppContext } from '../context/AppContext';
import { TCCS } from '../types';

// Mock Firebase
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/database', () => ({
  ref: vi.fn().mockReturnValue({ key: 'mockRef' }),
  update: vi.fn(),
  get: vi.fn(),
  query: vi.fn(),
  orderByChild: vi.fn(),
  limitToLast: vi.fn(),
  equalTo: vi.fn(),
}));

// Mock Contexts
vi.mock('../context/ToastContext', () => ({ useToast: vi.fn() }));
vi.mock('../context/AppContext', () => ({ useAppContext: vi.fn() }));

describe('useTCCSCrud', () => {
  const mockNotify = vi.fn();
  const mockState = {
    tccsList: [
      { id: 'tccs-old', productId: 'prod-1', issueDate: '2023-01-01', isActive: true }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ notify: mockNotify });
    (useAppContext as any).mockReturnValue({ state: mockState });
  });

  it('should add TCCS and update active status correctly', async () => {
    const { result } = renderHook(() => useTCCSCrud());
    const newTCCS = { id: 'tccs-new', productId: 'prod-1', issueDate: '2024-01-01' } as TCCS;

    (update as any).mockResolvedValue(undefined);

    await act(async () => {
      await result.current.addTCCS(newTCCS);
    });

    // Expect tccs-new to be active (newer date) and tccs-old to be inactive
    expect(update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      'tccs/tccs-new': expect.objectContaining({ isActive: true }),
      'tccs/tccs-old/isActive': false
    }));
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
  });

  it('should prevent deleting TCCS if used by batches', async () => {
    const { result } = renderHook(() => useTCCSCrud());
    const tccsId = 'tccs-used';

    // Mock batches existing
    (get as any).mockResolvedValue({
      exists: () => true,
      val: () => ({ 'batch-1': { batchNo: 'B001' } })
    });

    // The hook catches the error and notifies, so we check for notification instead of rejection
    await act(async () => {
      await result.current.deleteTCCS(tccsId);
    });

    expect(update).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'WARNING' }));
  });

  it('should delete TCCS if not used', async () => {
    const { result } = renderHook(() => useTCCSCrud());
    const tccsId = 'tccs-unused';

    (get as any).mockResolvedValue({ exists: () => false }); // No batches
    (update as any).mockResolvedValue(undefined);

    await act(async () => {
      await result.current.deleteTCCS(tccsId);
    });

    expect(update).toHaveBeenCalledWith(expect.anything(), { [`tccs/${tccsId}`]: null });
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
  });
});