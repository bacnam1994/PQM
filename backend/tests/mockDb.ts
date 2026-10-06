/**
 * backend/tests/mockDb.ts
 * In-memory Mock Realtime Database & Auth for Backend Unit & Integration Tests
 */

import { vi } from 'vitest';

export function createStrictMockDatabase() {
  const storage: Record<string, any> = {};

  function validateNoUndefined(obj: any, path = '') {
    if (obj === undefined) {
      throw new Error(`Firebase RTDB Admin SDK Error: value at ${path} contains undefined`);
    }
    if (obj !== null && typeof obj === 'object') {
      for (const [key, val] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (val === undefined) {
          throw new Error(
            `Firebase RTDB Admin SDK Error: value at ${currentPath} contains undefined in property '${key}'`
          );
        }
        validateNoUndefined(val, currentPath);
      }
    }
  }

  const db: any = {
    _storage: storage,
    ref: (rawPath: string) => {
      const path = (rawPath || '').replace(/^\/+/, '');
      return {
        once: vi.fn().mockImplementation(async (event: string) => {
          const val = storage[path] ?? null;
          return {
            exists: () => val !== null,
            val: () => (val !== null ? JSON.parse(JSON.stringify(val)) : null),
          };
        }),
        set: vi.fn().mockImplementation(async (data: any) => {
          validateNoUndefined(data, path);
          storage[path] = JSON.parse(JSON.stringify(data));
        }),
        update: vi.fn().mockImplementation(async (updates: Record<string, any>) => {
          for (const [subPath, val] of Object.entries(updates)) {
            const rawSub = path && path !== '/' ? `${path}/${subPath}` : subPath;
            const cleanPath = rawSub.replace(/^\/+/, '');
            validateNoUndefined(val, cleanPath);
            storage[cleanPath] = JSON.parse(JSON.stringify(val));

            // Also mutate parent if it exists as an object in storage (e.g. batches/BATCH-001/status)
            const parts = cleanPath.split('/');
            if (parts.length > 1) {
              const parentPath = parts.slice(0, -1).join('/');
              const field = parts[parts.length - 1];
              if (storage[parentPath] && typeof storage[parentPath] === 'object') {
                storage[parentPath][field] = JSON.parse(JSON.stringify(val));
              }
            }
          }
        }),
        transaction: vi
          .fn()
          .mockImplementation(async (transactionUpdate: (current: any) => any) => {
            const current = storage[path] ?? null;
            const updated = transactionUpdate(current);
            if (updated === undefined) {
              return { committed: false, snapshot: { val: () => current } };
            }
            validateNoUndefined(updated, path);
            storage[path] = JSON.parse(JSON.stringify(updated));
            return { committed: true, snapshot: { val: () => updated } };
          }),
        orderByChild: vi.fn().mockImplementation((childKey: string) => ({
          equalTo: vi.fn().mockImplementation((childValue: any) => ({
            once: vi.fn().mockImplementation(async () => {
              const results: Record<string, any> = {};
              for (const [key, val] of Object.entries(storage)) {
                if (key.startsWith(`${path}/`)) {
                  const subKey = key.substring(path.length + 1);
                  if (!subKey.includes('/') && val && val[childKey] === childValue) {
                    results[subKey] = val;
                  }
                }
              }
              return {
                exists: () => Object.keys(results).length > 0,
                val: () => (Object.keys(results).length > 0 ? results : null),
                forEach: (callback: (child: any) => void) => {
                  for (const [k, v] of Object.entries(results)) {
                    callback({ key: k, val: () => v });
                  }
                },
              };
            }),
          })),
        })),
      };
    },
  };

  return db;
}

export function createMockAuth() {
  const users: Record<string, any> = {};

  return {
    _users: users,
    verifyIdToken: vi.fn().mockImplementation(async (token: string) => {
      if (!token || token === 'invalid-token') {
        throw new Error('Firebase Auth Error: Invalid token');
      }
      if (token === 'expired-token') {
        throw new Error('Firebase Auth Error: Token expired');
      }
      const parsed = JSON.parse(token);
      return parsed;
    }),
  };
}
