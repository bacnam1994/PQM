import { useState } from 'react';
import { ref, update, set, remove } from 'firebase/database';
import { db } from '../firebase';
import { InventoryIn, InventoryOut } from '../types';
import { useToast } from '../context/ToastContext';
import { removeUndefined } from '../utils';

/**
 * Hook quản lý logic nhập/xuất kho
 * Tách biệt khỏi AppContext để giảm tải và tăng tính module hóa
 * Đã sử dụng removeUndefined từ utils để tránh trùng lặp code
 */
export const useInventoryLogic = () => {
  const { notify } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (path: string, item: any, successMessage: string) => {
    if (!item || !item.id) {
      notify({ type: 'ERROR', message: 'Dữ liệu không hợp lệ (Thiếu ID)' });
      throw new Error("Dữ liệu không hợp lệ");
    }

    setIsSubmitting(true);
    try {
      const cleanItem = removeUndefined(item);
      const dbRef = ref(db, `${path}/${item.id}`);
      // Sử dụng update() thay vì set() để tránh mất dữ liệu hiện có
      await update(dbRef, cleanItem);
      
      notify({ type: 'SUCCESS', message: successMessage });
    } catch (e: any) {
      console.error(`Lỗi lưu ${path}:`, e);
      
      let errorMsg = 'Lưu thất bại!';
      if (e.message && (e.message.toLowerCase().includes("permission denied") || e.code === "PERMISSION_DENIED")) {
        errorMsg = "Bạn không có quyền thực hiện thao tác này.";
      }
      
      notify({ type: 'ERROR', title: 'Lỗi', message: errorMsg });
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (path: string, id: string, successMessage: string) => {
    if (!id) {
      notify({ type: 'ERROR', message: 'ID không hợp lệ' });
      throw new Error("ID không hợp lệ");
    }

    setIsSubmitting(true);
    try {
      await remove(ref(db, `${path}/${id}`));
      notify({ type: 'SUCCESS', message: successMessage });
    } catch (e: any) {
      console.error(`Lỗi xóa ${path}:`, e);
      
      let errorMsg = 'Xóa thất bại!';
      if (e.message && (e.message.toLowerCase().includes("permission denied") || e.code === "PERMISSION_DENIED")) {
        errorMsg = "Bạn không có quyền xóa dữ liệu này.";
      }
      
      notify({ type: 'ERROR', title: 'Lỗi', message: errorMsg });
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Public Methods ---
  const addInventoryIn = async (inv: InventoryIn) => handleSave('inventoryIn', inv, 'Đã nhập kho thành công');
  const deleteInventoryIn = async (id: string) => handleDelete('inventoryIn', id, 'Đã xóa phiếu nhập kho');
  
  const addInventoryOut = async (inv: InventoryOut) => handleSave('inventoryOut', inv, 'Đã xuất kho thành công');
  const deleteInventoryOut = async (id: string) => handleDelete('inventoryOut', id, 'Đã xóa phiếu xuất kho');

  return {
    isSubmitting,
    addInventoryIn, deleteInventoryIn,
    addInventoryOut, deleteInventoryOut
  };
};

