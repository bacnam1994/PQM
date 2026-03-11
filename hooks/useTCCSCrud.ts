import { useState } from 'react';
import { ref, update, get, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '../firebase';
import { TCCS } from '../types';
import { useToast } from '../context/ToastContext';
import { useAppContext } from '../context/AppContext';
import { removeUndefined } from '../utils';

export const useTCCSCrud = () => {
  const { state } = useAppContext(); // Lấy danh sách TCCS hiện tại để so sánh version
  const { notify } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const saveTCCSWithActiveCheck = async (t: TCCS) => {
    setIsSubmitting(true);
    try {
      const otherTCCS = state.tccsList.filter(item => item.productId === t.productId && item.id !== t.id);
      const allTCCS = [...otherTCCS, t];
      
      // Sắp xếp theo ngày ban hành giảm dần (mới nhất lên đầu)
      allTCCS.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
      
      const latestId = allTCCS[0].id;
      const updates: Record<string, any> = {};
      
      allTCCS.forEach(item => {
        const shouldBeActive = item.id === latestId;
        
        if (item.id === t.id) {
          const newItem = { ...t, isActive: shouldBeActive };
          updates[`tccs/${item.id}`] = removeUndefined(newItem);
        } else {
          if (item.isActive !== shouldBeActive) {
            updates[`tccs/${item.id}/isActive`] = shouldBeActive;
          }
        }
      });

      await update(ref(db), updates);
      notify({ type: 'SUCCESS', message: 'Đã lưu TCCS thành công' });
    } catch (e: any) {
      console.error("Lỗi lưu TCCS:", e);
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

  const deleteTCCS = async (id: string) => {
    if (!id) return;
    setIsSubmitting(true);
    try {
      // Kiểm tra ràng buộc: TCCS có đang được sử dụng bởi Lô nào không?
      const batchesQuery = query(ref(db, 'batches'), orderByChild('tccsId'), equalTo(id));
      const batchesSnap = await get(batchesQuery);
      
      if (batchesSnap.exists()) {
        const batches = batchesSnap.val();
        const batchCodes = Object.values(batches).map((b: any) => b.batchNo || b.code || b.id).join(', ');
        const msg = `Không thể xóa! TCCS đang được sử dụng bởi các lô: ${batchCodes}.\nVui lòng xóa các lô hàng này trước.`;
        
        notify({ type: 'WARNING', title: 'Không thể xóa', message: msg });
        throw new Error(msg);
      }

      const updates: Record<string, any> = {};
      updates[`tccs/${id}`] = null;
      await update(ref(db), updates);
      
      notify({ type: 'SUCCESS', message: 'Đã xóa TCCS.' });
    } catch (e: any) {
      // Lỗi đã được handle hoặc log ở trên
      if (!e.message?.includes("Không thể xóa")) console.error("Lỗi xóa TCCS:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return { addTCCS: saveTCCSWithActiveCheck, updateTCCS: saveTCCSWithActiveCheck, deleteTCCS, isSubmitting };
};