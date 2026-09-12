import { describe, it, expect, beforeEach, vi } from 'vitest';
import { lazyWithRetry } from './lazyWithRetry';

describe('lazyWithRetry', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('loads component successfully on first attempt', async () => {
    const mockComponent = () => 'MockComponent';
    const importFn = vi.fn().mockResolvedValue({ default: mockComponent });

    const lazyComponent = lazyWithRetry(importFn, 'TestComponent');
    expect(lazyComponent).toBeDefined();

    // Invoke the loader under lazy
    const loaded = await (lazyComponent as any)._payload._result();
    expect(loaded.default).toBe(mockComponent);
    expect(importFn).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('pqm:lazy-retry:v1:TestComponent')).toBeNull();
  });

  it('retries once if the first import fails and succeeds on retry', async () => {
    const mockComponent = () => 'MockComponent';
    const importFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce({ default: mockComponent });

    const lazyComponent = lazyWithRetry(importFn, 'RetryComponent');
    const loaded = await (lazyComponent as any)._payload._result();

    expect(loaded.default).toBe(mockComponent);
    expect(importFn).toHaveBeenCalledTimes(2);
    // Key should be cleaned up after successful recovery
    expect(sessionStorage.getItem('pqm:lazy-retry:v1:RetryComponent')).toBeNull();
  });

  it('throws error when retry fails, without entering infinite reload', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const importFn = vi
      .fn()
      .mockRejectedValue(new Error('Persistent chunk missing'));

    const lazyComponent = lazyWithRetry(importFn, 'FailingComponent');

    await expect((lazyComponent as any)._payload._result()).rejects.toThrow(
      'Persistent chunk missing'
    );
    expect(importFn).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem('pqm:lazy-retry:v1:FailingComponent')).toBe('1');
    consoleErrorSpy.mockRestore();
  });
});
