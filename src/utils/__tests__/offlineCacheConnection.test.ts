import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initDB, resetDBConnectionForTest } from '../offlineCache';

describe('Phase 5 — IndexedDB Connection Singleton & Reuse', () => {
  let openCallCount = 0;
  let mockDBInstance: any;

  beforeEach(async () => {
    await resetDBConnectionForTest();
    openCallCount = 0;

    mockDBInstance = {
      objectStoreNames: {
        contains: vi.fn().mockReturnValue(true),
      },
      createObjectStore: vi.fn(),
      close: vi.fn(),
      onclose: null,
      onversionchange: null,
    };

    (globalThis as any).indexedDB = {
      open: vi.fn().mockImplementation(() => {
        openCallCount++;
        const req: any = {
          result: mockDBInstance,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
        };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess({ target: req });
        }, 0);
        return req;
      }),
    };
  });

  afterEach(async () => {
    await resetDBConnectionForTest();
  });

  it('P5-AC1: initDB() tái sử dụng connection promise và chỉ gọi indexedDB.open() một lần duy nhất', async () => {
    const p1 = initDB();
    const p2 = initDB();
    const p3 = initDB();

    expect(p1).toBe(p2);
    expect(p2).toBe(p3);

    const [db1, db2, db3] = await Promise.all([p1, p2, p3]);
    expect(db1).toBe(mockDBInstance);
    expect(db2).toBe(mockDBInstance);
    expect(db3).toBe(mockDBInstance);
    expect(openCallCount).toBe(1);
  });

  it('P5-AC2: Tự động giải phóng kết nối khi có sự kiện onclose hoặc onversionchange', async () => {
    const db1 = await initDB();
    expect(db1).toBe(mockDBInstance);
    expect(openCallCount).toBe(1);

    // Kích hoạt onclose event
    if (typeof mockDBInstance.onclose === 'function') {
      mockDBInstance.onclose(new Event('close'));
    }

    // Lần gọi tiếp theo phải mở connection mới
    const dbNext = await initDB();
    expect(dbNext).toBe(mockDBInstance);
    expect(openCallCount).toBe(2);
  });
});
