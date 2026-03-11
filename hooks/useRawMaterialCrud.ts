import { useState } from 'react';
import { ref, update, set, remove } from 'firebase/database';
import { db } from '../firebase';
import { RawMaterial } from '../types';
import { useToast } from '../context/ToastContext';
import { useAppContext } from '../context/AppContext';
import { removeUndefined } from '../utils';

export const useRawMaterialCrud = () => {
  const { state } = useAppContext();
  const { notify } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (material: RawMaterial, successMsg: string) => {
    if (!material || !material.id) {
      notify({ type: 'ERROR', message: 'Dữ liệu nguyên liệu không hợp lệ' });
      return;
    }
    setIsSubmitting(true);
    try {
      const cleanItem = removeUndefined(material);
      // Sử dụng update() thay vì set() để tránh mất dữ liệu hiện có
      await update(ref(db, `raw_materials/${material.id}`), cleanItem);
      notify({ type: 'SUCCESS', message: successMsg });
    } catch (e: any) {
      console.error("Lỗi lưu nguyên liệu:", e);
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

  const addRawMaterial = (rm: RawMaterial) => handleSave(rm, 'Đã thêm nguyên liệu mới');
  const updateRawMaterial = (rm: RawMaterial) => handleSave(rm, 'Đã cập nhật nguyên liệu');

  const deleteRawMaterial = async (id: string) => {
    if (!id) return;
    
    // Validation: Kiểm tra xem nguyên liệu có đang được sử dụng không
    const formulasUsingMaterial: string[] = [];
    state.productFormulas.forEach(formula => {
      const inIngredients = formula.ingredients?.some((ing: any) => ing.materialId === id);
      const inExcipients = formula.excipients?.some((exc: any) => exc.materialId === id);
      
      if (inIngredients || inExcipients) {
        const product = state.products.find(p => p.id === formula.productId);
        formulasUsingMaterial.push(product?.name || formula.id);
      }
    });

    if (formulasUsingMaterial.length > 0) {
      const materialName = state.rawMaterials.find(m => m.id === id)?.name || 'Nguyên liệu';
      const msg = `"${materialName}" đang được dùng trong ${formulasUsingMaterial.length} công thức: ${formulasUsingMaterial.slice(0, 3).join(', ')}${formulasUsingMaterial.length > 3 ? '...' : ''}.`;
      
      notify({ 
        type: 'ERROR', 
        title: 'Không thể xóa', 
        message: msg 
      });
      throw new Error(msg);
    }

    setIsSubmitting(true);
    try {
      await remove(ref(db, `raw_materials/${id}`));
      notify({ type: 'SUCCESS', message: 'Đã xóa nguyên liệu.' });
    } catch (e: any) {
      console.error("Lỗi xóa nguyên liệu:", e);
      let errorMsg = 'Xóa thất bại!';
      if (e.message && (e.message.toLowerCase().includes("permission denied") || e.code === "PERMISSION_DENIED")) {
        errorMsg = "Bạn không có quyền xóa nguyên liệu này.";
      }
      notify({ type: 'ERROR', title: 'Lỗi', message: errorMsg });
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { addRawMaterial, updateRawMaterial, deleteRawMaterial, isSubmitting };
};