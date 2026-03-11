import { Product, Batch, TestResult, TCCS } from '../types';

/**
 * Search products by code or name
 */
export const searchProducts = (
  products: Product[],
  query: string
): Product[] => {
  if (!query.trim()) return products;

  const lowerQuery = query.toLowerCase().trim();
  return products.filter(
    product =>
      product.code.toLowerCase().includes(lowerQuery) ||
      product.name.toLowerCase().includes(lowerQuery) ||
      product.registrant?.toLowerCase().includes(lowerQuery)
  );
};

/**
 * Search batches by batch number or product name
 */
export const searchBatches = (
  batches: Batch[],
  products: Product[],
  query: string
): Batch[] => {
  if (!query.trim()) return batches;

  const lowerQuery = query.toLowerCase().trim();
  return batches.filter(batch => {
    const product = products.find(p => p.id === batch.productId);
    return (
      batch.batchNo.toLowerCase().includes(lowerQuery) ||
      product?.name.toLowerCase().includes(lowerQuery)
    );
  });
};

/**
 * Search test results by batch number
 */
export const searchTestResults = (
  testResults: TestResult[],
  batches: Batch[],
  query: string
): TestResult[] => {
  if (!query.trim()) return testResults;

  const lowerQuery = query.toLowerCase().trim();
  return testResults.filter(result => {
    const batch = batches.find(b => b.id === result.batchId);
    return (
      result.labName?.toLowerCase().includes(lowerQuery) ||
      batch?.batchNo.toLowerCase().includes(lowerQuery)
    );
  });
};

/**
 * Search TCCS by code or product name
 */
export const searchTCCS = (
  tccsList: TCCS[],
  products: Product[],
  query: string
): TCCS[] => {
  if (!query.trim()) return tccsList;

  const lowerQuery = query.toLowerCase().trim();
  return tccsList.filter(tccs => {
    const product = products.find(p => p.id === tccs.productId);
    return (
      tccs.code.toLowerCase().includes(lowerQuery) ||
      product?.name.toLowerCase().includes(lowerQuery)
    );
  });
};

/**
 * Advanced search with multiple criteria
 */
export interface SearchFilters {
  query?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const advancedSearchProducts = (
  products: Product[],
  filters: SearchFilters
): Product[] => {
  let results = products;

  if (filters.query) {
    results = searchProducts(results, filters.query);
  }

  if (filters.status) {
    results = results.filter(p => p.status === filters.status);
  }

  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    results = results.filter(p => new Date(p.createdAt) >= fromDate);
  }

  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    results = results.filter(p => new Date(p.createdAt) <= toDate);
  }

  return results;
};

/**
 * Create debounced search handler
 */
export const createDebouncedSearch = <T>(
  searchFn: (query: string) => T[],
  delay: number = 300
): ((query: string) => T[]) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (query: string): T[] => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    return new Promise(resolve => {
      timeoutId = setTimeout(() => {
        const results = searchFn(query);
        resolve(results);
      }, delay);
    }) as any;
  };
};
