
import { initializeApp, getApp, getApps } from "firebase/app";
import { getDatabase, ref, set, onValue, remove, goOnline } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBp9-0Y1SucfFZ0BAnDlr5l9e82Ru4q2Dk",
  authDomain: "pqm-manager.firebaseapp.com",
  databaseURL: "https://pqm-manager-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "pqm-manager",
};

let app;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (e) {
  console.error("Firebase App Init Error:", e);
}

let db: any;
try {
  if (app) {
    db = getDatabase(app, firebaseConfig.databaseURL);
  }
} catch (e) {
  console.error("Firebase DB Init Error:", e);
}

export const firebaseService = {
  async saveFullState(state: any) {
    if (!db) return;
    try {
      await set(ref(db, 'data'), {
        products: state.products || [],
        tccs: state.tccsList || [],
        batches: state.batches || [],
        results: state.testResults || [],
        inventoryIn: state.inventoryIn || [],
        inventoryOut: state.inventoryOut || [],
        lastSync: new Date().toISOString()
      });
    } catch (err) { console.error("Cloud Save Error:", err); }
  },

  async updateItem(path: string, id: string, data: any) {
    if (!db) return;
    try {
      const fbPath = path === 'tccsList' ? 'tccs' : path === 'testResults' ? 'results' : path;
      await set(ref(db, `data/${fbPath}/${id}`), data);
    } catch (err) { console.error(`Cloud Update Error [${path}]:`, err); }
  },

  async deleteItem(path: string, id: string) {
    if (!db) return;
    try {
      const fbPath = path === 'tccsList' ? 'tccs' : path === 'testResults' ? 'results' : path;
      await remove(ref(db, `data/${fbPath}/${id}`));
    } catch (err) { console.error(`Cloud Delete Error [${path}]:`, err); }
  },

  onSync(callback: (data: any) => void) {
    if (!db) return () => {};
    try { goOnline(db); } catch (e) {}
    const dataRef = ref(db, 'data');
    return onValue(dataRef, (snapshot) => {
      const raw = snapshot.val();
      if (!raw) {
        callback({ products: [], tccsList: [], batches: [], testResults: [], inventoryIn: [], inventoryOut: [], lastSync: new Date().toISOString() });
        return;
      }
      const toArr = (obj: any) => obj ? (Array.isArray(obj) ? obj : Object.values(obj)) : [];
      callback({
        products: toArr(raw.products),
        tccsList: toArr(raw.tccs),
        batches: toArr(raw.batches),
        testResults: toArr(raw.results),
        inventoryIn: toArr(raw.inventoryIn),
        inventoryOut: toArr(raw.inventoryOut),
        lastSync: raw.lastSync || new Date().toISOString()
      });
    }, (error) => { console.error("Cloud Sync Error:", error); });
  }
};
