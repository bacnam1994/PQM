import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { versionSyncService } from '../versionSyncService';

describe('versionSyncService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lấy được phiên bản hiện tại của client', () => {
    const v = versionSyncService.getCurrentVersion();
    expect(v).toBeDefined();
    expect(typeof v).toBe('string');
  });

  it('phát hiện khi version trên server khác version hiện tại của client', async () => {
    const callback = vi.fn();

    // Mock fetch trả về version mới hơn
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: 'v99.999.0-future',
        buildTime: new Date().toISOString(),
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const hasNew = await versionSyncService.checkForUpdates(callback);

    expect(hasNew).toBe(true);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 'v99.999.0-future',
      })
    );
  });

  it('không báo cập nhật khi version server giống hệt client', async () => {
    const currentV = versionSyncService.getCurrentVersion();
    const callback = vi.fn();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: currentV,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const hasNew = await versionSyncService.checkForUpdates(callback);
    expect(hasNew).toBe(false);
    expect(callback).not.toHaveBeenCalled();
  });
});
