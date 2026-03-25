
const DB_NAME = 'QA_Manager_DB';
const DB_VERSION = 5;
const STORES = {
  PRODUCTS: 'products',
  TCCS: 'tccs',
  BATCHES: 'batches',
  RESULTS: 'results',
  INVENTORY_IN: 'inventoryIn',
  INVENTORY_OUT: 'inventoryOut',
  METADATA: 'metadata'
};

export const storageService = {
  async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event: any) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORES.PRODUCTS)) db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORES.TCCS)) db.createObjectStore(STORES.TCCS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORES.BATCHES)) db.createObjectStore(STORES.BATCHES, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORES.RESULTS)) db.createObjectStore(STORES.RESULTS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORES.INVENTORY_IN)) db.createObjectStore(STORES.INVENTORY_IN, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORES.INVENTORY_OUT)) db.createObjectStore(STORES.INVENTORY_OUT, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORES.METADATA)) db.createObjectStore(STORES.METADATA);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async saveItem(storeName: string, item: any): Promise<void> {
    const db = await this.initDB();
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(item);
  },

  async deleteItem(storeName: string, id: string): Promise<void> {
    const db = await this.initDB();
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(id);
  },

  async getAll(storeName: string): Promise<any[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async saveFullState(state: any): Promise<void> {
    const db = await this.initDB();
    const stores = Object.values(STORES).filter(s => s !== STORES.METADATA);
    const transaction = db.transaction(stores, 'readwrite');
    
    stores.forEach(s => transaction.objectStore(s).clear());
    
    if (state.products) state.products.forEach((p: any) => transaction.objectStore(STORES.PRODUCTS).put(p));
    if (state.tccsList) state.tccsList.forEach((t: any) => transaction.objectStore(STORES.TCCS).put(t));
    if (state.batches) state.batches.forEach((b: any) => transaction.objectStore(STORES.BATCHES).put(b));
    if (state.testResults) state.testResults.forEach((r: any) => transaction.objectStore(STORES.RESULTS).put(r));
    if (state.inventoryIn) state.inventoryIn.forEach((i: any) => transaction.objectStore(STORES.INVENTORY_IN).put(i));
    if (state.inventoryOut) state.inventoryOut.forEach((o: any) => transaction.objectStore(STORES.INVENTORY_OUT).put(o));
  }
};
