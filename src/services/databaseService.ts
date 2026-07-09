import { db } from '../firebase';
import { ref, set, remove, update, query, orderByChild, equalTo, get } from 'firebase/database';

/**
 * Ghi một bản ghi vào đường dẫn cụ thể
 */
export const saveItem = async (path: string, id: string, data: any) => {
  await set(ref(db, `${path}/${id}`), data);
};

/**
 * Xóa một bản ghi
 */
export const deleteItemService = async (path: string, id: string) => {
  await remove(ref(db, `${path}/${id}`));
};

/**
 * Cập nhật trạng thái của một Lô
 */
export const updateBatchStatusService = async (id: string, status: string) => {
  await set(ref(db, `batches/${id}/status`), status);
};

/**
 * Xóa Sản phẩm và toàn bộ dữ liệu liên quan (Cascade Delete)
 * Đây là một tác vụ phức tạp được đóng gói lại
 */
export const deleteProductService = async (id: string) => {
  const updates: Record<string, any> = {};
  
  // 1. Xóa Sản phẩm
  updates[`products/${id}`] = null;

  // 2. Xóa TCCS liên quan
  const tccsQuery = query(ref(db, 'tccs'), orderByChild('productId'), equalTo(id));
  const tccsSnap = await get(tccsQuery);
  if (tccsSnap.exists()) {
     Object.keys(tccsSnap.val()).forEach(key => updates[`tccs/${key}`] = null);
  }

  // 3. Xóa Lô và dữ liệu con của Lô (Kết quả, Kho)
  const batchesQuery = query(ref(db, 'batches'), orderByChild('productId'), equalTo(id));
  const batchesSnap = await get(batchesQuery);
  
  if (batchesSnap.exists()) {
    const batches = batchesSnap.val();
    const batchIds = Object.keys(batches);
    
    for (const bid of batchIds) {
        updates[`batches/${bid}`] = null;
        
        // Tìm và xóa Test Results của Lô
        const resultsQuery = query(ref(db, 'testResults'), orderByChild('batchId'), equalTo(bid));
        const resultsSnap = await get(resultsQuery);
        if (resultsSnap.exists()) Object.keys(resultsSnap.val()).forEach(k => updates[`testResults/${k}`] = null);
    }
  }

  // Thực hiện update atomic (tất cả hoặc không gì cả)
  await update(ref(db), updates);
};

/**
 * Xóa Lô và dữ liệu liên quan
 */
export const deleteBatchService = async (id: string) => {
  const updates: Record<string, any> = {};
  updates[`batches/${id}`] = null;
  
  const resultsQuery = query(ref(db, 'testResults'), orderByChild('batchId'), equalTo(id));
  const resultsSnap = await get(resultsQuery);
  if (resultsSnap.exists()) Object.keys(resultsSnap.val()).forEach(k => updates[`testResults/${k}`] = null);

  await update(ref(db), updates);
};

/**
 * Xóa toàn bộ dữ liệu (Dùng cho Admin)
 */
export const clearDatabaseService = async () => {
  await set(ref(db), null);
};

/**
 * Cập nhật hàng loạt (Dùng cho Restore/Demo data)
 */
export const updateRootService = async (updates: Record<string, any>) => {
  await update(ref(db), updates);
};