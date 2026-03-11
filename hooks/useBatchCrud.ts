import { useState } from 'react';
import { ref, update, get, query, orderByChild, equalTo, set } from 'firebase/database';
import { db } from '../firebase';
import { Batch } from '../types';
import { useToast } from '../context/ToastContext';
import { removeUndefined } from '../utils';

export const useBatchCrud = () => {
  const { notify } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addBatch = async (batch: Batch) => {
    if (!batch || !batch.id) {
      notify({ type: 'ERROR', message: 'Dữ liệu lô không hợp lệ' });
      return;
    }
    setIsSubmitting(true);
    try {
      const cleanItem = removeUndefined(batch);
      await set(ref(db, `batches/${batch.id}`), cleanItem);
      notify({ type: 'SUCCESS', message: 'Đã tạo lô mới thành công' });
    } catch (e: any) {
      console.error("Lỗi tạo lô mới:", e);
      let errorMsg = 'Tạo mới thất bại!';
      if (e.message && (e.message.toLowerCase().includes("permission denied") || e.code === "PERMISSION_DENIED")) {
        errorMsg = "Bạn không có quyền thực hiện thao tác này.";
      }
      notify({ type: 'ERROR', title: 'Lỗi', message: errorMsg });
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateBatch = async (batch: Batch) => {
    if (!batch || !batch.id) {
      notify({ type: 'ERROR', message: 'Dữ liệu lô không hợp lệ' });
      return;
    }
    setIsSubmitting(true);
    try {
      const cleanItem = removeUndefined(batch);
      await update(ref(db, `batches/${batch.id}`), cleanItem);
      notify({ type: 'SUCCESS', message: 'Đã cập nhật thông tin lô' });
    } catch (e: any) {
      console.error("Lỗi cập nhật lô:", e);
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
  
  const updateBatchStatus = async (id: string, status: string, rejectReason?: string) => {
    // Validate status
    const validStatuses = ['PENDING', 'TESTING', 'RELEASED', 'REJECTED'];
    if (!id || !status || !validStatuses.includes(status)) {
      notify({ type: 'ERROR', message: 'Trạng thái không hợp lệ' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Check if batch exists
      const batchRef = ref(db, `batches/${id}`);
      const snapshot = await get(batchRef);
      if (!snapshot.exists()) {
        notify({ type: 'ERROR', message: 'Lô hàng không tồn tại' });
        return;
      }

      const updates: Record<string, any> = { status, updatedAt: new Date().toISOString() };
      if (status === 'REJECTED') {
        updates.rejectReason = rejectReason || null;
      } else {
        updates.rejectReason = null;
      }
      await update(batchRef, updates);
      notify({ type: 'SUCCESS', message: `Đã cập nhật trạng thái: ${status}` });
    } catch (e: any) {
      console.error("Lỗi cập nhật trạng thái lô:", e);
      if (e.message && (e.message.toLowerCase().includes("permission denied") || e.code === "PERMISSION_DENIED")) {
        notify({ type: 'ERROR', title: 'Cập nhật thất bại', message: 'Bạn không có quyền thay đổi trạng thái lô.' });
      } else {
        notify({ type: 'ERROR', message: 'Lỗi khi cập nhật trạng thái.' });
      }
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteBatch = async (id: string) => {
    if (!id) return;
    setIsSubmitting(true);
    try {
      const updates: Record<string, any> = {};
      updates[`batches/${id}`] = null;
      
      // Xóa dữ liệu liên quan
      const trQuery = query(ref(db, 'testResults'), orderByChild('batchId'), equalTo(id));
      const trSnap = await get(trQuery);
      if (trSnap.exists()) Object.keys(trSnap.val()).forEach(k => updates[`testResults/${k}`] = null);
      
      const inQuery = query(ref(db, 'inventoryIn'), orderByChild('batchId'), equalTo(id));
      const inSnap = await get(inQuery);
      if (inSnap.exists()) Object.keys(inSnap.val()).forEach(k => updates[`inventoryIn/${k}`] = null);

      const outQuery = query(ref(db, 'inventoryOut'), orderByChild('batchId'), equalTo(id));
      const outSnap = await get(outQuery);
      if (outSnap.exists()) Object.keys(outSnap.val()).forEach(k => updates[`inventoryOut/${k}`] = null);

      await update(ref(db), updates);
      notify({ type: 'SUCCESS', message: 'Đã xóa lô và dữ liệu liên quan.' });
    } catch (e: any) {
      console.error("Lỗi xóa lô:", e);
      let errorMsg = 'Xóa thất bại!';
      if (e.message && (e.message.toLowerCase().includes("permission denied") || e.code === "PERMISSION_DENIED")) {
        errorMsg = "Bạn không có quyền xóa lô hàng này.";
      }
      notify({ type: 'ERROR', title: 'Lỗi', message: errorMsg });
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { addBatch, updateBatch, updateBatchStatus, deleteBatch, isSubmitting };
};