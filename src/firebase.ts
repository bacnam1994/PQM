import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase, goOnline, goOffline } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const isTestEnv =
  import.meta.env.MODE === 'test' ||
  (typeof process !== 'undefined' &&
    (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)));

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

if (!apiKey && !isTestEnv) {
  throw new Error(
    'Firebase initialization failed: VITE_FIREBASE_API_KEY is not defined. ' +
      'Please check your .env configuration or environment variables.'
  );
}

const firebaseConfig = {
  apiKey: apiKey || (isTestEnv ? 'AIzaSyTestSafeMockApiKeyForVitest001' : ''),
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    (isTestEnv ? 'v-biotech-test.firebaseapp.com' : ''),
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    (isTestEnv ? 'https://v-biotech-default-rtdb.asia-southeast1.firebasedatabase.app' : ''),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (isTestEnv ? 'v-biotech-test' : ''),
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    (isTestEnv ? 'v-biotech-test.firebasestorage.app' : ''),
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || (isTestEnv ? '1089547502816' : ''),
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    (isTestEnv ? '1:1089547502816:web:testmockappid0001' : ''),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || (isTestEnv ? 'G-BP6DWC5QP1' : ''),
};

// Khởi tạo Firebase App (tái sử dụng nếu đã khởi tạo)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Export các service để sử dụng trong AppContext và Store (Zustand)
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
export const reconnectDatabase = () => goOnline(db);
export const disconnectDatabase = () => goOffline(db);
export default app;
