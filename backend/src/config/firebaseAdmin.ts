/**
 * backend/src/config/firebaseAdmin.ts
 * Firebase Admin SDK initialization for Server-Authoritative backend
 */

import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let initializedApp: admin.app.App | null = null;

export function initializeFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0 && admin.apps[0]) {
    initializedApp = admin.apps[0];
    return initializedApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'v-biotech';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ||
    `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`;

  if (privateKey) {
    // Handle escaped newlines from environment variable strings
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const options: admin.AppOptions = {
    projectId,
    databaseURL,
  };

  if (clientEmail && privateKey) {
    options.credential = admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    });
  } else {
    // Falls back to Google Application Default Credentials or Emulator
    options.credential = admin.credential.applicationDefault();
  }

  initializedApp = admin.initializeApp(options);
  return initializedApp;
}

export function getAdminApp(): admin.app.App {
  if (!initializedApp) {
    return initializeFirebaseAdmin();
  }
  return initializedApp;
}

export function getAdminDb(): admin.database.Database {
  return getAdminApp().database();
}

export function getAdminAuth(): admin.auth.Auth {
  return getAdminApp().auth();
}

// For unit testing: allow overriding with test mocks
let customDb: admin.database.Database | null = null;
let customAuth: admin.auth.Auth | null = null;

export function setCustomAdminInstances(instances: {
  db?: admin.database.Database | null;
  auth?: admin.auth.Auth | null;
}): void {
  customDb = instances.db ?? null;
  customAuth = instances.auth ?? null;
}

export function getDb(): admin.database.Database {
  return customDb || getAdminDb();
}

export function getAuth(): admin.auth.Auth {
  return customAuth || getAdminAuth();
}
