import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProductCrud } from './useProductCrud';
import { ref, set, update, get } from 'firebase/database';
import { useToast } from '../context/ToastContext';
import { Product } from '../types';

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
  limitToLast: vi.fn(), // Thêm hàm này nếu có dùng
  equalTo: vi.fn(),
}));

// Mock ToastContext
vi.mock('../context/ToastContext', () => ({
  useToast: vi.fn(),
}));

describe('useProductCrud', () => {
  const mockNotify = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ notify: mockNotify });
  });

  it('should initialize with isSubmitting false', () => {
    const { result } = renderHook(() => useProductCrud());
    expect(result.current.isSubmitting).toBe(false);
  });

  describe('addProduct', () => {
    it('should add product successfully', async () => {
      const { result } = renderHook(() => useProductCrud());
      const mockProduct = { id: 'prod-1', name: 'Product 1' } as Product;

      (set as any).mockResolvedValue(undefined);

      await act(async () => {
        await result.current.addProduct(mockProduct);
      });

      expect(ref).toHaveBeenCalledWith(expect.anything(), 'products/prod-1');
      expect(set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(mockProduct));
      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
      expect(result.current.isSubmitting).toBe(false);
    });

    it('should handle validation error (missing ID)', async () => {
      const { result } = renderHook(() => useProductCrud());
      const mockProduct = { name: 'Product 1' } as Product; // Missing ID

      await act(async () => {
        await result.current.addProduct(mockProduct);
      });

      expect(set).not.toHaveBeenCalled();
      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'ERROR', message: 'Dữ liệu sản phẩm không hợp lệ (Thiếu ID)' }));
    });

    it('should handle firebase error', async () => {
      const { result } = renderHook(() => useProductCrud());
      const mockProduct = { id: 'prod-1', name: 'Product 1' } as Product;
      const error = new Error('Permission denied');
      (error as any).code = 'PERMISSION_DENIED';

      (set as any).mockRejectedValue(error);

      await expect(result.current.addProduct(mockProduct)).rejects.toThrow();

      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'ERROR' }));
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  describe('updateProduct', () => {
    it('should update product successfully', async () => {
      const { result } = renderHook(() => useProductCrud());
      const mockProduct = { id: 'prod-1', name: 'Product 1 Updated' } as Product;

      (set as any).mockResolvedValue(undefined);

      await act(async () => {
        await result.current.updateProduct(mockProduct);
      });

      expect(ref).toHaveBeenCalledWith(expect.anything(), 'products/prod-1');
      expect(set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(mockProduct));
      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
    });
  });

  describe('deleteProduct', () => {
    it('should delete product and related data successfully', async () => {
      const { result } = renderHook(() => useProductCrud());
      const productId = 'prod-1';

      // Mock get calls for cascading delete
      const mockTccsSnap = { exists: () => true, val: () => ({ 'tccs-1': { id: 'tccs-1' } }) };
      const mockBatchesSnap = { exists: () => true, val: () => ({ 'batch-1': { id: 'batch-1' } }) };
      const mockTestResultsSnap = { exists: () => true, val: () => ({ 'res-1': { id: 'res-1' } }) };
      const mockInvInSnap = { exists: () => true, val: () => ({ 'in-1': { id: 'in-1' } }) };
      const mockInvOutSnap = { exists: () => true, val: () => ({ 'out-1': { id: 'out-1' } }) };

      (get as any)
        .mockResolvedValueOnce(mockTccsSnap) // tccsQuery
        .mockResolvedValueOnce(mockBatchesSnap) // batchesQuery
        .mockResolvedValueOnce(mockTestResultsSnap) // trQuery
        .mockResolvedValueOnce(mockInvInSnap) // inQuery
        .mockResolvedValueOnce(mockInvOutSnap); // outQuery

      (update as any).mockResolvedValue(undefined);

      await act(async () => {
        await result.current.deleteProduct(productId);
      });

      // Verify cascading deletes
      expect(update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        [`products/${productId}`]: null,
        'tccs/tccs-1': null,
        'batches/batch-1': null,
        'testResults/res-1': null,
        'inventoryIn/in-1': null,
        'inventoryOut/out-1': null
      }));

      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
    });

    it('should handle delete error', async () => {
      const { result } = renderHook(() => useProductCrud());
      const productId = 'prod-1';
      const error = new Error('Delete failed');

      (get as any).mockResolvedValue({ exists: () => false }); // No related data
      (update as any).mockRejectedValue(error);

      await expect(result.current.deleteProduct(productId)).rejects.toThrow();

      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'ERROR' }));
    });
  });

  describe('bulkAddProducts', () => {
    it('should bulk add products successfully', async () => {
      const { result } = renderHook(() => useProductCrud());
      const products = [{ id: 'prod-1', name: 'P1' }, { id: 'prod-2', name: 'P2' }] as Product[];

      (update as any).mockResolvedValue(undefined);

      await act(async () => {
        await result.current.bulkAddProducts(products);
      });

      expect(update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        'products/prod-1': expect.objectContaining({ id: 'prod-1' }),
        'products/prod-2': expect.objectContaining({ id: 'prod-2' })
      }));
      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
    });
  });
});