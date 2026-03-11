import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useInventoryLogic } from './useInventoryLogic';
import { ref, set, remove } from 'firebase/database';
import { useToast } from '../context/ToastContext';

// Mock Firebase
vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn().mockReturnValue({ key: 'mockRef' }),
  set: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  query: vi.fn(),
  orderByChild: vi.fn(),
}));

// Mock ToastContext
vi.mock('../context/ToastContext', () => ({
  useToast: vi.fn(),
}));

describe('useInventoryLogic', () => {
  const mockNotify = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ notify: mockNotify });
  });

  it('should initialize with isSubmitting false', () => {
    const { result } = renderHook(() => useInventoryLogic());
    expect(result.current.isSubmitting).toBe(false);
  });

  describe('addInventoryIn', () => {
    it('should add inventory in record successfully', async () => {
      const { result } = renderHook(() => useInventoryLogic());
      const mockData = { id: 'inv-1', batchId: 'batch-1', quantity: 100 } as any;

      (set as any).mockResolvedValue(undefined);

      await act(async () => {
        await result.current.addInventoryIn(mockData);
      });

      expect(ref).toHaveBeenCalledWith(expect.anything(), 'inventoryIn/inv-1');
      expect(set).toHaveBeenCalledWith(expect.anything(), mockData);
      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
      expect(result.current.isSubmitting).toBe(false);
    });

    it('should handle error when adding inventory in', async () => {
      const { result } = renderHook(() => useInventoryLogic());
      const mockData = { id: 'inv-1' } as any;
      const error = new Error('Permission denied');
      (error as any).code = 'PERMISSION_DENIED';

      (set as any).mockRejectedValue(error);

      await expect(result.current.addInventoryIn(mockData)).rejects.toThrow();

      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'ERROR' }));
      expect(result.current.isSubmitting).toBe(false);
    });

    it('should validate input data', async () => {
      const { result } = renderHook(() => useInventoryLogic());
      // Missing ID
      const mockData = { batchId: 'batch-1' } as any;

      await expect(result.current.addInventoryIn(mockData)).rejects.toThrow('Dữ liệu không hợp lệ');
      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'ERROR', message: 'Dữ liệu không hợp lệ (Thiếu ID)' }));
    });
  });

  describe('deleteInventoryIn', () => {
    it('should delete inventory in record successfully', async () => {
      const { result } = renderHook(() => useInventoryLogic());
      (remove as any).mockResolvedValue(undefined);

      await act(async () => {
        await result.current.deleteInventoryIn('inv-1');
      });

      expect(ref).toHaveBeenCalledWith(expect.anything(), 'inventoryIn/inv-1');
      expect(remove).toHaveBeenCalled();
      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
    });
  });

  describe('addInventoryOut', () => {
    it('should add inventory out record successfully', async () => {
      const { result } = renderHook(() => useInventoryLogic());
      const mockData = { id: 'out-1', batchId: 'batch-1', quantity: 50 } as any;

      (set as any).mockResolvedValue(undefined);

      await act(async () => {
        await result.current.addInventoryOut(mockData);
      });

      expect(ref).toHaveBeenCalledWith(expect.anything(), 'inventoryOut/out-1');
      expect(set).toHaveBeenCalledWith(expect.anything(), mockData);
      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
    });
  });

  describe('deleteInventoryOut', () => {
    it('should delete inventory out record successfully', async () => {
      const { result } = renderHook(() => useInventoryLogic());
      (remove as any).mockResolvedValue(undefined);

      await act(async () => {
        await result.current.deleteInventoryOut('out-1');
      });

      expect(ref).toHaveBeenCalledWith(expect.anything(), 'inventoryOut/out-1');
      expect(remove).toHaveBeenCalled();
      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
    });
  });
});