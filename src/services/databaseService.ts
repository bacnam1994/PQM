import { db } from '../firebase';
import { ref, set, remove, update, query, orderByChild, equalTo, get } from 'firebase/database';
import { deleteMultipleStorageFiles } from './storageService';

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
 * Xóa Sản phẩm và toàn bộ dữ liệu liên quan (Cascade Delete),
 * đồng thời dọn dẹp toàn bộ hình ảnh và tài liệu đính kèm trên Firebase Storage.
 */
export const deleteProductService = async (id: string) => {
  const updates: Record<string, any> = {};
  const storageUrlsToDelete: string[] = [];
  
  // 1. Kiểm tra ảnh sản phẩm cần dọn dẹp
  const productSnap = await get(ref(db, `products/${id}`));
  if (productSnap.exists()) {
    const productData = productSnap.val();
    if (productData.imageUrl) {
      storageUrlsToDelete.push(productData.imageUrl);
    }
  }
  updates[`products/${id}`] = null;

  // 2. Xóa Công thức sản phẩm
  const formulaQuery = query(ref(db, 'product_formulas'), orderByChild('productId'), equalTo(id));
  const formulaSnap = await get(formulaQuery);
  if (formulaSnap.exists()) {
    Object.keys(formulaSnap.val()).forEach(key => updates[`product_formulas/${key}`] = null);
  }

  // 3. Xóa TCCS liên quan và các Criteria Alias của TCCS đó
  const tccsQuery = query(ref(db, 'tccs'), orderByChild('productId'), equalTo(id));
  const tccsSnap = await get(tccsQuery);
  if (tccsSnap.exists()) {
    const tccsKeys = Object.keys(tccsSnap.val());
    for (const tKey of tccsKeys) {
      updates[`tccs/${tKey}`] = null;
      // Tìm và xóa alias của TCCS này
      const aliasQuery = query(ref(db, 'criteria_aliases'), orderByChild('tccsId'), equalTo(tKey));
      const aliasSnap = await get(aliasQuery);
      if (aliasSnap.exists()) {
        Object.keys(aliasSnap.val()).forEach(aKey => updates[`criteria_aliases/${aKey}`] = null);
      }
    }
  }

  // 4. Xóa Lô và dữ liệu con của Lô (Kết quả kiểm nghiệm)
  const batchesQuery = query(ref(db, 'batches'), orderByChild('productId'), equalTo(id));
  const batchesSnap = await get(batchesQuery);
  
  if (batchesSnap.exists()) {
    const batches = batchesSnap.val();
    const batchIds = Object.keys(batches);
    
    for (const bid of batchIds) {
        updates[`batches/${bid}`] = null;
        
        // Tìm và xóa Test Results của Lô, thu thập attachment URLs
        const resultsQuery = query(ref(db, 'testResults'), orderByChild('batchId'), equalTo(bid));
        const resultsSnap = await get(resultsQuery);
        if (resultsSnap.exists()) {
          const results = resultsSnap.val();
          Object.keys(results).forEach(k => {
            updates[`testResults/${k}`] = null;
            const res = results[k];
            if (res && Array.isArray(res.attachments)) {
              res.attachments.forEach((att: any) => {
                if (att?.url && att?.source !== 'google_drive') storageUrlsToDelete.push(att.url);
              });
            }
          });
        }
    }
  }

  // Thực hiện update atomic trên Database
  await update(ref(db), updates);

  // Dọn dẹp tệp tin mồ côi trên Storage (bất đồng bộ không block giao diện)
  if (storageUrlsToDelete.length > 0) {
    deleteMultipleStorageFiles(storageUrlsToDelete).catch(err => {
      console.warn('Lỗi dọn dẹp Storage trong deleteProductService:', err);
    });
  }
};

/**
 * Xóa Lô và dữ liệu liên quan (Test Results & Storage Attachments)
 */
export const deleteBatchService = async (id: string) => {
  const updates: Record<string, any> = {};
  const storageUrlsToDelete: string[] = [];
  updates[`batches/${id}`] = null;
  
  const resultsQuery = query(ref(db, 'testResults'), orderByChild('batchId'), equalTo(id));
  const resultsSnap = await get(resultsQuery);
  if (resultsSnap.exists()) {
    const results = resultsSnap.val();
    Object.keys(results).forEach(k => {
      updates[`testResults/${k}`] = null;
      const res = results[k];
      if (res && Array.isArray(res.attachments)) {
        res.attachments.forEach((att: any) => {
          if (att?.url && att?.source !== 'google_drive') storageUrlsToDelete.push(att.url);
        });
      }
    });
  }

  await update(ref(db), updates);

  if (storageUrlsToDelete.length > 0) {
    deleteMultipleStorageFiles(storageUrlsToDelete).catch(err => {
      console.warn('Lỗi dọn dẹp Storage trong deleteBatchService:', err);
    });
  }
};

/**
 * Xóa một Phiếu kiểm nghiệm đơn lẻ và dọn dẹp attachments trên Storage
 */
export const deleteTestResultService = async (id: string) => {
  const testSnap = await get(ref(db, `testResults/${id}`));
  const storageUrlsToDelete: string[] = [];

  if (testSnap.exists()) {
    const testData = testSnap.val();
    if (testData && Array.isArray(testData.attachments)) {
      testData.attachments.forEach((att: any) => {
        if (att?.url && att?.source !== 'google_drive') storageUrlsToDelete.push(att.url);
      });
    }
  }

  await remove(ref(db, `testResults/${id}`));

  if (storageUrlsToDelete.length > 0) {
    deleteMultipleStorageFiles(storageUrlsToDelete).catch(err => {
      console.warn('Lỗi dọn dẹp Storage trong deleteTestResultService:', err);
    });
  }
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