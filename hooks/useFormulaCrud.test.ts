import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFormulaCrud } from './useFormulaCrud';
import { ref, set, remove } from 'firebase/database';
import { useToast } from '../context/ToastContext';
import { ProductFormula } from '../types';

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
vi.mock('../context/ToastContext', () => ({ useToast: vi.fn() }));

describe('useFormulaCrud', () => {
  const mockNotify = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ notify: mockNotify });
  });

  it('should parse numeric strings in ingredients before saving', async () => {
    const { result } = renderHook(() => useFormulaCrud());
    const mockFormula = {
      id: 'form-1',
      ingredients: [
        { name: 'Ing A', declaredContent: '100 mg', unit: 'mg' }, // Should parse to 100
        { name: 'Ing B', declaredContent: '1.5x10^3', unit: 'CFU' } // Should parse to 1500
      ]
    } as unknown as ProductFormula;

    (set as any).mockResolvedValue(undefined);

    await act(async () => {
      await result.current.addProductFormula(mockFormula);
    });

    expect(set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      ingredients: [
        expect.objectContaining({ declaredContent: 100 }),
        expect.objectContaining({ declaredContent: 1500 })
      ]
    }));
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
  });

  it('should delete formula successfully', async () => {
    const { result } = renderHook(() => useFormulaCrud());
    (remove as any).mockResolvedValue(undefined);

    await act(async () => {
      await result.current.deleteProductFormula('form-1');
    });

    expect(remove).toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUCCESS' }));
  });
});