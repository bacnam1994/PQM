import { useState } from 'react';
import { ref, update, get, query, orderByChild, equalTo, set } from 'firebase/database';
import { db } from '../firebase';
import { Product } from '../types';
import { useToast } from '../context/ToastContext';
import { removeUndefined } from '../utils';

export const useProductCrud = () => {
  const { notify } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hàm làm sạch dữ liệu đầu vào để ngăn chặn CSV Injection và chuẩn hóa chuỗi
  const sanitizeInput = (product: Product): Product => {
    const sanitized = { ...product };
    const stringFields: (keyof Product)[] = ['name', 'code', 'group', 'registrant', 'registrationNo'];

    stringFields.forEach(field => {
      if (typeof sanitized[field] === 'string') {
        let value = (sanitized[field] as string).trim();
        // Ngăn chặn CSV Injection: Nếu bắt đầu bằng =, +, -, @, thêm dấu ' vào trước
        if (/^[=+\-@]/.test(value)) {
          value = `'${value}`;
        }
        (sanitized[field] as any) = value;
      }
    });
    return sanitized;
  };

  const handleSave = async (product: Product) => {
    if (!product || !product.id || !product.name) {
      notify({ type: 'ERROR', message: 'Dữ liệu không hợp lệ: Thiếu ID hoặc Tên sản phẩm' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Sanitize và Clean undefined
      const sanitizedItem = sanitizeInput(product);
      const cleanItem = removeUndefined(sanitizedItem);
      
      // Sử dụng update() thay vì set() để tránh mất dữ liệu hiện có trong document
      await update(ref(db, `products/${product.id}`), cleanItem);
      notify({ type: 'SUCCESS', message: 'Đã lưu sản phẩm thành công' });
    } catch (e: any) {
      console.error("Lỗi lưu sản phẩm:", e);
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

  const addProduct = (p: Product) => handleSave(p);
  const updateProduct = (p: Product) => handleSave(p);

  const deleteProduct = async (id: string) => {
    if (!id) return;
    setIsSubmitting(true);
    try {
      const updates: Record<string, any> = {};
      updates[`products/${id}`] = null;

      // 1. Tìm và xóa TCCS liên quan
      const tccsQuery = query(ref(db, 'tccs'), orderByChild('productId'), equalTo(id));
      const tccsSnap = await get(tccsQuery);
      if (tccsSnap.exists()) {
        Object.keys(tccsSnap.val()).forEach(k => updates[`tccs/${k}`] = null);
      }

      // 2. Tìm và xóa Batches + Dữ liệu con của Batch
      const batchesQuery = query(ref(db, 'batches'), orderByChild('productId'), equalTo(id));
      const batchesSnap = await get(batchesQuery);
      
      if (batchesSnap.exists()) {
        const batches = batchesSnap.val();
        await Promise.all(Object.keys(batches).map(async (bid) => {
          updates[`batches/${bid}`] = null;
          
          // Xóa Test Results
          const trQuery = query(ref(db, 'testResults'), orderByChild('batchId'), equalTo(bid));
          const trSnap = await get(trQuery);
          if (trSnap.exists()) Object.keys(trSnap.val()).forEach(k => updates[`testResults/${k}`] = null);

          // Xóa Inventory
          const inQuery = query(ref(db, 'inventoryIn'), orderByChild('batchId'), equalTo(bid));
          const inSnap = await get(inQuery);
          if (inSnap.exists()) Object.keys(inSnap.val()).forEach(k => updates[`inventoryIn/${k}`] = null);

          const outQuery = query(ref(db, 'inventoryOut'), orderByChild('batchId'), equalTo(bid));
          const outSnap = await get(outQuery);
          if (outSnap.exists()) Object.keys(outSnap.val()).forEach(k => updates[`inventoryOut/${k}`] = null);
        }));
      }

      await update(ref(db), updates);
      notify({ type: 'SUCCESS', message: 'Đã xóa sản phẩm và toàn bộ dữ liệu liên quan.' });
    } catch (e: any) {
      console.error("Lỗi xóa sản phẩm:", e);
      let errorMsg = 'Xóa thất bại!';
      if (e.message && (e.message.toLowerCase().includes("permission denied") || e.code === "PERMISSION_DENIED")) {
        errorMsg = "Bạn không có quyền xóa sản phẩm này.";
      }
      notify({ type: 'ERROR', title: 'Lỗi', message: errorMsg });
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  };

  const bulkAddProducts = async (products: Product[]) => {
    setIsSubmitting(true);
    try {
      const updates: Record<string, any> = {};
      products.forEach(p => {
        const sanitized = sanitizeInput(p);
        updates[`products/${p.id}`] = removeUndefined(sanitized);
      });
      await update(ref(db), updates);
      notify({ type: 'SUCCESS', message: `Đã nhập ${products.length} sản phẩm thành công` });
    } catch (e: any) {
      console.error("Lỗi nhập hàng loạt:", e);
      notify({ type: 'ERROR', title: 'Lỗi', message: 'Không thể nhập dữ liệu.' });
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { addProduct, updateProduct, deleteProduct, bulkAddProducts, isSubmitting };
};