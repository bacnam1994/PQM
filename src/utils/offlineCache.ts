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
        'offlineMutations',
      ];
      stores.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveToCache = async (
  storeName: string,
  items: any[],
  options: { clear?: boolean } = { clear: true }
) => {
  try {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    // Chỉ dọn dẹp toàn bộ bảng khi có yêu cầu rõ ràng (ví dụ: Full Initial Sync)
    // Giúp ngăn chặn việc clear + rebuild toàn bộ IndexedDB khi chỉ có một vài record thay đổi
    if (options.clear) {
      store.clear();
    }

    items.forEach((item, index) => {
      if (item) {
        if (!item.id) {
          store.put({ ...item, id: `${storeName}_${index}_${Date.now()}` });
        } else {
          store.put(item);
        }
      }
    });
    return new Promise((resolve) => {
      tx.oncomplete = resolve;
    });
  } catch (error) {
    console.warn(`Lỗi lưu cache IndexedDB [${storeName}]:`, error);
  }
};

/**
 * Lưu hoặc cập nhật một thực thể đơn lẻ vào IndexedDB (Granular Put)
 * Không xóa dữ liệu cũ trong bảng, tối ưu thời gian I/O và hiệu năng bộ nhớ
 */
export const saveItemToCache = async (storeName: string, item: any): Promise<void> => {
  if (!item) return;
  try {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const key = item.id || `${storeName}_${Date.now()}`;
    store.put({ ...item, id: key });
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (error) {
    console.warn(`Lỗi lưu bản ghi đơn vào cache [${storeName}]:`, error);
  }
};

/**
 * Xóa một thực thể đơn lẻ khỏi IndexedDB (Granular Delete)
 */
export const deleteItemFromCache = async (storeName: string, id: string): Promise<void> => {
  if (!id) return;
  try {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(id);
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (error) {
    console.warn(`Lỗi xóa bản ghi khỏi cache [${storeName}]:`, error);
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
      'testResults',
      'products',
      'batches',
      'tccs',
      'productFormulas',
      'rawMaterials',
      'aiLearnedMappings',
      'qualityAlerts',
      'criteriaAliases',
    ];
    const tx = db.transaction(stores, 'readwrite');

    stores.forEach((storeName) => {
      tx.objectStore(storeName).clear();
    });

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
    });
  } catch (error) {
    console.warn('Lỗi xóa toàn bộ cache IndexedDB:', error);
  }
};

/**
 * Dọn dẹp cache cũ trong IndexedDB theo độ tuổi (Cache Hygiene)
 */
export const clearStaleCache = async (
  maxAgeDays: number = 30
): Promise<{ clearedStores: string[] }> => {
  const clearedStores: string[] = [];
  try {
    const db = await initDB();
    const stores = ['aiLearnedMappings', 'qualityAlerts'];
    const tx = db.transaction(stores, 'readwrite');
    for (const storeName of stores) {
      if (db.objectStoreNames.contains(storeName)) {
        tx.objectStore(storeName).clear();
        clearedStores.push(storeName);
      }
    }
    await new Promise((resolve) => {
      tx.oncomplete = () => resolve(undefined);
    });
  } catch (error) {
    console.warn('Lỗi dọn dẹp cache cũ IndexedDB:', error);
  }
  return { clearedStores };
};
