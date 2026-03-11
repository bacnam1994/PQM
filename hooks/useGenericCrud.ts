import { useState, useCallback } from 'react';
import { ref, update, get, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '../firebase';
import { useToast } from '../context/ToastContext';
import { removeUndefined } from '../utils';

/**
 * Generic CRUD hook for Firebase Realtime Database
 * 
 * @template T - The type of the entity being managed
 */
export interface UseGenericCrudOptions<T> {
  /** The Firebase collection name (e.g., 'products', 'batches') */
  collectionName: string;
  /** Success message for create/update operations */
  successMessage?: string;
  /** Custom error handler */
  onError?: (error: Error) => void;
  /** Related collections to cascade delete */
  relatedCollections?: {
    collection: string;
    foreignKey: string;
  }[];
}

export interface UseGenericCrudReturn<T> {
  /** Whether an operation is in progress */
  isSubmitting: boolean;
  /** Save (create or update) an entity */
  save: (item: T & { id: string }, successMsg?: string) => Promise<void>;
  /** Create a new entity */
  add: (item: T & { id: string }) => Promise<void>;
  /** Update an existing entity */
  update: (item: T & { id: string }) => Promise<void>;
  /** Delete an entity and optionally its related data */
  delete: (id: string) => Promise<void>;
  /** Bulk create multiple entities */
  bulkAdd: (items: (T & { id: string })[]) => Promise<void>;
  /** Bulk update multiple entities */
  bulkUpdate: (items: (T & { id: string })[]) => Promise<void>;
}

/**
 * Hook for generic CRUD operations on Firebase Realtime Database
 */
export function useGenericCrud<T extends Record<string, any>>(
  options: UseGenericCrudOptions<T>
): UseGenericCrudReturn<T> {
  const { 
    collectionName, 
    successMessage = 'Thao tác thành công',
    onError,
    relatedCollections = []
  } = options;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { notify } = useToast();

  const handleError = useCallback((error: unknown, defaultMsg: string) => {
    console.error(`Lỗi ${collectionName}:`, error);
    let errorMsg = defaultMsg;
    
    if (error instanceof Error) {
      if (error.message.toLowerCase().includes("permission denied") || error.message.includes("PERMISSION_DENIED")) {
        errorMsg = "Bạn không có quyền thực hiện thao tác này.";
      }
      if (onError) {
        onError(error);
      }
    }
    
    notify({ type: 'ERROR', title: 'Lỗi', message: errorMsg });
    throw error;
  }, [collectionName, notify, onError]);

  const save = useCallback(async (item: T & { id: string }, customMsg?: string) => {
    if (!item?.id) {
      notify({ type: 'ERROR', message: 'Dữ liệu không hợp lệ (Thiếu ID)' });
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanItem = removeUndefined(item);
      await update(ref(db, `${collectionName}/${item.id}`), cleanItem);
      notify({ type: 'SUCCESS', message: customMsg || successMessage });
    } catch (error) {
      handleError(error, 'Lưu thất bại!');
    } finally {
      setIsSubmitting(false);
    }
  }, [collectionName, successMessage, handleError]);

  const add = useCallback(async (item: T & { id: string }) => {
    await save(item, `Đã thêm mới thành công`);
  }, [save]);

  const updateItem = useCallback(async (item: T & { id: string }) => {
    await save(item, `Đã cập nhật thành công`);
  }, [save]);

  const deleteItem = useCallback(async (id: string) => {
    if (!id) return;

    setIsSubmitting(true);
    try {
      const updates: Record<string, any> = {};
      updates[`${collectionName}/${id}`] = null;

      // Cascade delete related collections
      for (const related of relatedCollections) {
        const relatedQuery = query(
          ref(db, related.collection),
          orderByChild(related.foreignKey),
          equalTo(id)
        );
        const snapshot = await get(relatedQuery);
        
        if (snapshot.exists()) {
          Object.keys(snapshot.val()).forEach(key => {
            updates[`${related.collection}/${key}`] = null;
          });
        }
      }

      await update(ref(db), updates);
      notify({ type: 'SUCCESS', message: 'Đã xóa thành công' });
    } catch (error) {
      handleError(error, 'Xóa thất bại!');
    } finally {
      setIsSubmitting(false);
    }
  }, [collectionName, relatedCollections, handleError]);

  const bulkAdd = useCallback(async (items: (T & { id: string })[]) => {
    if (!items || items.length === 0) return;

    setIsSubmitting(true);
    try {
      const updates: Record<string, any> = {};
      
      items.forEach(item => {
        if (item?.id) {
          updates[`${collectionName}/${item.id}`] = removeUndefined(item);
        }
      });

      await update(ref(db), updates);
      notify({ type: 'SUCCESS', message: `Đã thêm ${items.length} bản ghi thành công` });
    } catch (error) {
      handleError(error, 'Nhập hàng loạt thất bại!');
    } finally {
      setIsSubmitting(false);
    }
  }, [collectionName, handleError]);

  const bulkUpdate = useCallback(async (items: (T & { id: string })[]) => {
    await bulkAdd(items);
  }, [bulkAdd]);

  return {
    isSubmitting,
    save,
    add,
    update: updateItem,
    delete: deleteItem,
    bulkAdd,
    bulkUpdate,
  };
}

export default useGenericCrud;

