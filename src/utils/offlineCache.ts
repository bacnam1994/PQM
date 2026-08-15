const DB_NAME = 'QA_Manager_DB';
const DB_VERSION = 4; // v4: thêm store offlineMutations phục vụ hàng đợi ghi ngoại tuyến

/**
 * Khởi tạo IndexedDB và tạo các bảng lưu trữ (Object Stores)
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result as IDBDatabase;
      
      // Tạo các bảng lưu trữ cho từng loại dữ liệu
      const stores = [
        'testResults', 
        'products', 
        'batches', 
        'tccs', 
        'productFormulas', 
        'rawMaterials',
        'aiLearnedMappings',
        'qualityAlerts',
        'criteriaAliases',
        'offlineMutations'
      ];
      stores.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveToCache = async (storeName: string, items: any[]) => {
  try {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    // Dọn dẹp rác: Xóa sạch dữ liệu cũ trong bảng trước khi nạp danh sách mới
    // Đảm bảo cache Offline luôn là bản sao chính xác 1:1 của Firebase
    store.clear();
    
    items.forEach((item, index) => {
      if (item) {
        if (!item.id) {
          store.put({ ...item, id: `${storeName}_${index}_${Date.now()}` });
        } else {
          store.put(item);
        }
      }
    });
    return new Promise((resolve) => { tx.oncomplete = resolve; });
  } catch (error) {
    console.warn(`Lỗi lưu cache IndexedDB [${storeName}]:`, error);
  }
};

export const getFromCache = async (storeName: string): Promise<any[]> => {
  try {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn(`Lỗi đọc cache IndexedDB [${storeName}]:`, error);
    return [];
  }
};

/**
 * Xóa toàn bộ dữ liệu trong IndexedDB (Sử dụng khi người dùng Đăng xuất)
 */
export const clearEntireCache = async (): Promise<void> => {
  try {
    const db = await initDB();
    const stores = [
      'testResults', 'products', 'batches', 'tccs', 
      'productFormulas', 'rawMaterials',
      'aiLearnedMappings', 'qualityAlerts', 'criteriaAliases'
    ];
    const tx = db.transaction(stores, 'readwrite');
    
    stores.forEach(storeName => {
      tx.objectStore(storeName).clear();
    });
    
    return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
  } catch (error) {
    console.warn('Lỗi xóa toàn bộ cache IndexedDB:', error);
  }
};