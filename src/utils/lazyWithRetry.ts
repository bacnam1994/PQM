import { lazy, ComponentType } from 'react';

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
        console.error(
          `[Lazy] Retry thất bại cho module "${moduleKey}".`,
          firstError
        );
        throw firstError;
      }

      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(retryKey, '1');
        }
      } catch {}

      console.warn(
        `[Lazy] Import lỗi cho "${moduleKey}", thử import lại.`,
        firstError
      );

      try {
        const retryResult = await componentImport();

        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(retryKey);
          }
        } catch {}

        return retryResult;
      } catch (secondError) {
        console.error(
          `[Lazy] Import lần 2 thất bại cho "${moduleKey}".`,
          secondError
        );
        throw secondError;
      }
    }
  });
};
