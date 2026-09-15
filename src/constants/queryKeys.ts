/**
 * queryKeys.ts
 * Tập trung định nghĩa tất cả Query Keys của TanStack Query v5 trong hệ thống PQM.
 * Đảm bảo Single Source of Truth, ngăn chặn trùng lặp hoặc gõ sai chuỗi query key.
 */

export const PRODUCT_QUERY_KEYS = {
  all: ['products'] as const,
  detail: (id: string) => ['products', id] as const,
  paginated: (options?: any, filters?: any) => ['products', 'paginated', options, filters] as const,
  formulas: ['productFormulas'] as const,
  formulaDetail: (id: string) => ['productFormulas', id] as const,
  formulaByProduct: (productId: string) => ['productFormulas', 'byProduct', productId] as const,
  materials: ['rawMaterials'] as const,
  materialDetail: (id: string) => ['rawMaterials', id] as const,
};

export const BATCH_QUERY_KEYS = {
  all: ['batches'] as const,
  detail: (id: string) => ['batches', id] as const,
  byProduct: (productId: string) => ['batches', 'product', productId] as const,
  recent: (limit: number) => ['batches', 'recent', limit] as const,
  paginated: (options?: any, filters?: any) => ['batches', 'paginated', options, filters] as const,
};

export const TCCS_QUERY_KEYS = {
  all: ['tccsList'] as const,
  detail: (id: string) => ['tccsList', id] as const,
  byProduct: (productId: string) => ['tccsList', 'product', productId] as const,
  aliases: ['criteriaAliases'] as const,
  aiMappings: ['aiLearnedMappings'] as const,
};

export const TEST_RESULT_QUERY_KEYS = {
  all: ['testResults'] as const,
  detail: (id: string) => ['testResults', id] as const,
  byBatch: (batchId: string) => ['testResults', 'batch', batchId] as const,
  recent: (limit: number) => ['testResults', 'recent', limit] as const,
  paginated: (options?: any, filters?: any) =>
    ['testResults', 'paginated', options, filters] as const,
};

export const LABORATORY_QUERY_KEYS = {
  all: ['testingLaboratories'] as const,
  detail: (id: string) => ['testingLaboratories', id] as const,
};

export const DEVIATION_QUERY_KEYS = {
  all: ['deviations'] as const,
  detail: (id: string) => ['deviations', id] as const,
  byBatch: (batchId: string) => ['deviations', 'batch', batchId] as const,
  paginated: (options?: any, filters?: any) =>
    ['deviations', 'paginated', options, filters] as const,
};
