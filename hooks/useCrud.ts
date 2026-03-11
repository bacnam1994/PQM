import { useState, useCallback } from 'react';

export type CrudMode = 'IDLE' | 'ADD' | 'EDIT' | 'DELETE' | 'VIEW';

export interface UseCrudReturn<T> {
  mode: CrudMode;
  selectedItem: T | null;
  isOpen: boolean; // True nếu mode != IDLE
  
  openAdd: (initialData?: Partial<T>) => void;
  openEdit: (item: T) => void;
  openDelete: (item: T) => void;
  openView: (item: T) => void;
  close: () => void;
}

export function useCrud<T>(): UseCrudReturn<T> {
  const [mode, setMode] = useState<CrudMode>('IDLE');
  const [selectedItem, setSelectedItem] = useState<T | null>(null);

  const openAdd = useCallback((initialData?: Partial<T>) => {
    setSelectedItem((initialData as T) || null);
    setMode('ADD');
  }, []);

  const openEdit = useCallback((item: T) => {
    setSelectedItem(item);
    setMode('EDIT');
  }, []);

  const openDelete = useCallback((item: T) => {
    setSelectedItem(item);
    setMode('DELETE');
  }, []);

  const openView = useCallback((item: T) => {
    setSelectedItem(item);
    setMode('VIEW');
  }, []);

  const close = useCallback(() => {
    setMode('IDLE');
    setSelectedItem(null);
  }, []);

  return {
    mode,
    selectedItem,
    isOpen: mode !== 'IDLE',
    openAdd,
    openEdit,
    openDelete,
    openView,
    close
  };
}