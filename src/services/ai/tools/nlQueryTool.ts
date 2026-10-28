import { executeNLQuery } from '../nlQueryService';

/**
 * Tìm kiếm và thống kê dữ liệu trong hệ thống PQM bằng ngôn ngữ tự nhiên tiếng Việt
 */
export const queryDataNaturalLanguage = (query: string, appContext: any) => {
  return executeNLQuery(query, {
    products: appContext.products || [],
    batches: appContext.batches || [],
    testResults: appContext.testResults || [],
    tccsList: appContext.tccsList || [],
    productFormulas: appContext.productFormulas || [],
  });
};
