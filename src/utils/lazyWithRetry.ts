import { lazy, ComponentType } from 'react';

/**
 * Kiểm tra xem lỗi có phải do không nạp được chunk JS (thường xảy ra khi vừa deploy bản mới)
 */
export const isChunkLoadError = (error: unknown): boolean => {
  if (!error) return false;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String((error as any)?.message ?? error);

  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Unexpected token '<'/i.test(message) ||
    /is not a valid JavaScript/i.test(message) ||
    /Loading chunk .* failed/i.test(message)
  );
};

const RELOAD_KEY_PREFIX = 'pqm:auto-reload:';

export const triggerAutoReloadOnce = (reasonKey: string): boolean => {
  if (
    typeof window === 'undefined' ||
    typeof sessionStorage === 'undefined' ||
    typeof window.location?.reload !== 'function'
  ) {
    return false;
  }
  const key = `${RELOAD_KEY_PREFIX}${reasonKey}`;
  const now = Date.now();
  let lastReload: string | null = null;
  try {
    lastReload = sessionStorage.getItem(key);
  } catch {}

  // Tránh lặp vô tận: Nếu đã reload trong vòng 15 giây qua thì không tự reload nữa
  if (lastReload && now - Number(lastReload) < 15000) {
    return false;
  }

  try {
    sessionStorage.setItem(key, String(now));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
};

/**
 * Enhanced lazy loader with bounded, per-module retry strategy.
 * Prevents chunk loading failures from crashing the app without retry,
 * while preventing infinite reload loops and cross-module failure poisoning.
 */
export const lazyWithRetry = <T extends ComponentType<any> = ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | any>,
  moduleKey: string
) => {
  return lazy(async () => {
    const buildId = import.meta.env.VITE_APP_VERSION ?? 'v1';
    const retryKey = `pqm:lazy-retry:${buildId}:${moduleKey}`;

    try {
      const result = await componentImport();
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(retryKey);
        }
      } catch {}
      return result;
    } catch (firstError) {
      let alreadyRetried = false;

      try {
        if (typeof sessionStorage !== 'undefined') {
          alreadyRetried = sessionStorage.getItem(retryKey) === '1';
        }
      } catch {}

      if (alreadyRetried) {
        console.error(`[Lazy] Retry thất bại cho module "${moduleKey}".`, firstError);
        if (isChunkLoadError(firstError)) {
          if (triggerAutoReloadOnce(`chunk:${moduleKey}`)) {
            return new Promise<any>(() => {});
          }
        }
        throw firstError;
      }

      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(retryKey, '1');
        }
      } catch {}

      console.warn(`[Lazy] Import lỗi cho "${moduleKey}", thử import lại.`, firstError);

      try {
        const retryResult = await componentImport();

        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(retryKey);
          }
        } catch {}

        return retryResult;
      } catch (secondError) {
        console.error(`[Lazy] Import lần 2 thất bại cho "${moduleKey}".`, secondError);
        if (isChunkLoadError(secondError)) {
          if (triggerAutoReloadOnce(`chunk:${moduleKey}`)) {
            return new Promise<any>(() => {});
          }
        }
        throw secondError;
      }
    }
  });
};
