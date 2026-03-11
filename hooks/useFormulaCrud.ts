import { useState } from 'react';
import { ref, update, set, remove } from 'firebase/database';
import { db } from '../firebase';
import { ProductFormula } from '../types';
import { useToast } from '../context/ToastContext';
import { removeUndefined, parseNumberFromText } from '../utils';

export const useFormulaCrud = () => {
  const { notify } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to process formula before save (parsing numbers)
  const processFormulaBeforeSave = (formula: ProductFormula): ProductFormula => {
    const processedFormula = { ...formula };
    if (processedFormula.ingredients && Array.isArray(processedFormula.ingredients)) {
      processedFormula.ingredients = processedFormula.ingredients.map(ing => { 
        const newIng = { ...ing } as any;
        if (ing.declaredContent && typeof ing.declaredContent === 'string') {
          newIng.declaredContent = parseNumberFromText(ing.declaredContent);
        }
        if (ing.elementalContent && typeof ing.elementalContent === 'string') {
          newIng.elementalContent = parseNumberFromText(ing.elementalContent);
        } else if (!ing.elementalContent) {
          delete newIng.elementalContent;
        }
        if ((ing as any).materialId) {
          newIng.materialId = (ing as any).materialId;
        }
        return newIng;
      });
    }

    if (processedFormula.excipients && Array.isArray(processedFormula.excipients)) {
      processedFormula.excipients = processedFormula.excipients.map(exc => {
        const newExc = { ...exc } as any;
        if (exc.declaredContent && typeof exc.declaredContent === 'string') {
          newExc.declaredContent = parseNumberFromText(exc.declaredContent);
        }
        if (exc.elementalContent && typeof exc.elementalContent === 'string') {
          newExc.elementalContent = parseNumberFromText(exc.elementalContent);
        } else if (!exc.elementalContent) {
          delete newExc.elementalContent;
        }
        if ((exc as any).materialId) {
          newExc.materialId = (exc as any).materialId;
        }
        return newExc;
      });
    }
    return processedFormula;
  };

  const handleSave = async (formula: ProductFormula, successMsg: string) => {
    if (!formula || !formula.id) {
      notify({ type: 'ERROR', message: 'Dữ liệu công thức không hợp lệ' });
      return;
    }
    setIsSubmitting(true);
    try {
      const processed = processFormulaBeforeSave(formula);
      const cleanItem = removeUndefined(processed);
      // Sử dụng update() thay vì set() để tránh mất dữ liệu hiện có trong document
      await update(ref(db, `product_formulas/${formula.id}`), cleanItem);
      notify({ type: 'SUCCESS', message: successMsg });
    } catch (e: any) {
      console.error("Lỗi lưu công thức:", e);
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

  const addProductFormula = (f: ProductFormula) => handleSave(f, 'Đã thêm công thức mới');
  const updateProductFormula = (f: ProductFormula) => handleSave(f, 'Đã cập nhật công thức');

  const deleteProductFormula = async (id: string) => {
    if (!id) return;
    setIsSubmitting(true);
    try {
      await remove(ref(db, `product_formulas/${id}`));
      notify({ type: 'SUCCESS', message: 'Đã xóa công thức.' });
    } catch (e: any) {
      console.error("Lỗi xóa công thức:", e);
      let errorMsg = 'Xóa thất bại!';
      if (e.message && (e.message.toLowerCase().includes("permission denied") || e.code === "PERMISSION_DENIED")) {
        errorMsg = "Bạn không có quyền xóa công thức này.";
      }
      notify({ type: 'ERROR', title: 'Lỗi', message: errorMsg });
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { addProductFormula, updateProductFormula, deleteProductFormula, isSubmitting };
};