/**
 * Debug Utilities
 * 
 * Centralized debugging functions that only run in development mode.
 * All console logs in production code should use these functions.
 */

// Check if we're in development mode
const isDev = import.meta.env.DEV;

/**
 * Debug log - only outputs in development mode
 */
export const debug = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  
  error: (...args: unknown[]) => {
    // Always log errors in development, optionally in production
    console.error(...args);
  },
  
  /**
   * Log with prefix for easy filtering in console
   */
  group: (label: string) => {
    if (isDev) {
      console.group(`[${label}]`);
    }
  },
  
  groupEnd: () => {
    if (isDev) {
      console.groupEnd();
    }
  },
  
  /**
   * Time tracking for performance
   */
  time: (label: string) => {
    if (isDev) {
      console.time(label);
    }
  },
  
  timeEnd: (label: string) => {
    if (isDev) {
      console.timeEnd(label);
    }
  }
};

/**
 * Safe JSON stringify with error handling
 */
export const safeStringify = (obj: unknown): string => {
  try {
    return JSON.stringify(obj);
  } catch {
    return '[Circular or non-serializable]';
  }
};

