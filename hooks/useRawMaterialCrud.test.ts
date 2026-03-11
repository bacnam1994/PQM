import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRawMaterialCrud } from './useRawMaterialCrud';
import { ref, set, remove } from 'firebase/database';
import { useToast } from '../context/ToastContext';
import { useAppContext } from '../context/AppContext';
import { RawMaterial } from '../types';

// Mock Firebase
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/database', () => ({
  ref: vi.fn().mockReturnValue({ key: 'mockRef' }),
  set: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  query: vi.fn(),
  orderByChild: vi.fn(),
}));

// Mock Contexts
vi.mock('../context/ToastContext', () => ({ useToast: vi.fn() }));
vi.mock('../context/AppContext', () => ({ useAppContext: vi.fn() }));

describe('useRawMaterialCrud', () => {
  const mockNotify = vi.fn();
  const mockState = {
    productFormulas: [],
    rawMaterials: [{ id: 'rm-1', name: 'Material A' }],
    products: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ notify: mockNotify });
    (useAppContext as any).mockReturnValue({ state: mockState });
  });

  it('should add raw material successfully', async () => {
    const { result } = renderHook(() => useRawMaterialCrud());
    const mockMaterial = { id: 'rm-new', name: 'New Material' } as RawMaterial;

    (set as any).mockResolvedValue(undefined);

    await act(async () => {
      await result.current.addRawMaterial(mockMaterial);
    });

    expect(set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(mockMaterial));
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
  });

  it('should delete raw material successfully if not in use', async () => {
    const { result } = renderHook(() => useRawMaterialCrud());
    (remove as any).mockResolvedValue(undefined);

    await act(async () => {
      await result.current.deleteRawMaterial('rm-1');
    });

    expect(remove).toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
  });

  it('should prevent delete if material is in use in a formula', async () => {
    const mockStateWithUsage = {
      ...mockState,
      productFormulas: [
        { 
          id: 'f1', 
          productId: 'p1', 
          ingredients: [{ materialId: 'rm-1' }], // rm-1 is used here
          excipients: [] 
        }
      ],
      products: [{ id: 'p1', name: 'Product 1' }]
    };
    (useAppContext as any).mockReturnValue({ state: mockStateWithUsage });

    const { result } = renderHook(() => useRawMaterialCrud());

    // Expect promise to reject
    await expect(result.current.deleteRawMaterial('rm-1')).rejects.toThrow();
    
    // Ensure remove was NOT called
    expect(remove).not.toHaveBeenCalled();
    // Ensure error notification was shown
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'ERROR', title: 'Không thể xóa' }));
  });
});