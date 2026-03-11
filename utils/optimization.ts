import { Batch, InventoryIn, InventoryOut } from '../types';

/**
 * Stock calculation using Map.
 * Note: For accurate results, we always recalculate to ensure data consistency.
 * The cache was removed as it caused issues with data freshness.
 */
export const calculateStockMap = (
  batches: Batch[],
  inventoryIn: InventoryIn[],
  inventoryOut: InventoryOut[]
): Map<string, { in: number; out: number; balance: number }> => {
  const stockMap = new Map<string, { in: number; out: number; balance: number }>();

  // Initialize with batches
  batches.forEach(batch => {
    stockMap.set(batch.id, { in: 0, out: 0, balance: 0 });
  });

  // Calculate inventory in
  inventoryIn.forEach(inv => {
    const current = stockMap.get(inv.batchId) || { in: 0, out: 0, balance: 0 };
    stockMap.set(inv.batchId, {
      ...current,
      in: current.in + inv.quantity,
      balance: current.balance + inv.quantity
    });
  });

  // Calculate inventory out
  inventoryOut.forEach(out => {
    const current = stockMap.get(out.batchId) || { in: 0, out: 0, balance: 0 };
    stockMap.set(out.batchId, {
      ...current,
      out: current.out + out.quantity,
      balance: current.balance - out.quantity
    });
  });

  return stockMap;
};

/**
 * Clear stock calculation cache (kept for backward compatibility, but no-op now)
 */
export const clearStockCache = () => {
  // Cache was removed, this function is kept for backward compatibility
};

/**
 * Pagination helper with type safety
 */
export const paginateData = <T>(
  data: T[],
  page: number = 1,
  pageSize: number = 20
): { data: T[]; total: number; totalPages: number } => {
  const total = data.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedData = data.slice(startIndex, startIndex + pageSize);

  return {
    data: paginatedData,
    total,
    totalPages
  };
};

/**
 * Debounce utility for search inputs and other frequent events
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle utility for scroll/resize events
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Memoized selector for filtering data with shallow equality check
 */
export const createSelector = <T, R>(
  selector: (data: T[]) => R,
  equalityFn?: (a: R, b: R) => boolean
): ((data: T[]) => R) => {
  let cachedData: T[] | null = null;
  let cachedResult: R | null = null;

  return (data: T[]) => {
    // Check if data reference changed
    if (cachedData === data && cachedResult !== null) {
      return cachedResult;
    }

    const newResult = selector(data);

    // Check if result changed using custom equality function or reference equality
    if (equalityFn && cachedResult !== null) {
      if (!equalityFn(cachedResult, newResult)) {
        cachedResult = newResult;
      }
    } else {
      cachedResult = newResult;
    }

    cachedData = data;
    return cachedResult;
  };
};

/**
 * Generic memoize function for expensive calculations
 */
export const memoize = <T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T => {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
};

/**
 * Shallow equality check for objects and arrays
 */
export const shallowEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key) || a[key] !== b[key]) {
      return false;
    }
  }
  
  return true;
};

/**
 * Deep equality check for complex objects
 */
export const deepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    
    if (typeof a[key] === 'object' && typeof b[key] === 'object') {
      if (!deepEqual(a[key], b[key])) return false;
    } else if (a[key] !== b[key]) {
      return false;
    }
  }
  
  return true;
};

/**
 * Batch multiple DOM reads/writes for better performance
 */
export const batchDOMOperations = (operations: (() => void)[]) => {
  // Use requestAnimationFrame for visual updates
  requestAnimationFrame(() => {
    // Use setTimeout for non-visual updates
    setTimeout(() => {
      operations.forEach(op => op());
    }, 0);
  });
};

/**
 * Measure function execution time for performance monitoring
 */
export const measurePerformance = <T extends (...args: any[]) => any>(
  fn: T,
  name: string
): T => {
  return ((...args: Parameters<T>): ReturnType<T> => {
    const start = performance.now();
    const result = fn(...args);
    const end = performance.now();
    console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
    return result;
  }) as T;
};

/**
 * Lazy load data with intersection observer pattern
 */
export const createLazyLoader = (
  callback: () => void,
  options?: IntersectionObserverInit
) => {
  let observer: IntersectionObserver | null = null;
  
  return {
    observe: (element: Element) => {
      observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            callback();
          }
        });
      }, options);
      
      observer.observe(element);
    },
    disconnect: () => {
      observer?.disconnect();
    }
  };
};
