/**
 * routePreloader.ts
 * Hệ thống Prefetch & Preload thông minh cho các Route chính của PQM.
 * ==================================================================
 * NGUYÊN TẮC:
 * 1. ZERO-LATENCY NAVIGATION: Khi người dùng hover chuột vào bất kỳ link / menu item nào
 *    trên Sidebar hoặc thẻ Card Lô, trình duyệt sẽ prefetch chunk tương ứng trong ~200ms trước khi click.
 *    Khi click thực sự xảy ra, trang được nạp tức thì trong 0ms từ RAM.
 * 2. IDLE PREFETCH: Khi trình duyệt ở trạng thái rảnh rỗi (requestIdleCallback), tự động tải ngầm
 *    các trang có tần suất truy cập cao nhất (Lô sản xuất, Phiếu kiểm nghiệm, Sản phẩm).
 */

const preloadedRoutes = new Set<string>();

const ROUTE_LOADERS: Record<string, () => Promise<any>> = {
  '/batches': () => import('../pages/batches/BatchList'),
  '/batches/detail': () => import('../pages/batches/BatchDetailPage'),
  '/test-results': () => import('../pages/qa/TestResultList'),
  '/test-results/new': () => import('../pages/qa/TestResultFormPage'),
  '/products': () => import('../pages/products/ProductList'),
  '/tccs': () => import('../pages/qa/TCCSList'),
  '/alerts': () => import('../pages/quality/AlertsPage'),
  '/quality/comparison': () => import('../pages/quality/comparison/ComparisonPage'),
  '/reports/quality-summary': () => import('../pages/quality/QualitySummaryReport'),
  '/reports/trend-analysis': () => import('../pages/quality/TrendAnalysisPage'),
};

/**
 * Preload một route cụ thể theo đường dẫn
 */
export function preloadRoute(path: string): void {
  if (!path) return;

  // Chuẩn hóa path (ví dụ: '/batches/682605' -> '/batches/detail')
  let targetKey = path;
  if (path.startsWith('/batches/') && path !== '/batches/new') {
    targetKey = '/batches/detail';
  } else if (path.startsWith('/products/') && path !== '/products/new') {
    targetKey = '/products';
  } else if (path.startsWith('/test-results/edit/')) {
    targetKey = '/test-results/new';
  }

  if (preloadedRoutes.has(targetKey)) return;

  const loader = ROUTE_LOADERS[targetKey] || ROUTE_LOADERS[path];
  if (loader) {
    preloadedRoutes.add(targetKey);
    loader().catch(() => {
      preloadedRoutes.delete(targetKey);
    });
  }
}

/**
 * Preload tự động các route cốt lõi khi trình duyệt rảnh rỗi (Idle Prefetch)
 */
export function initIdleRoutePrefetch(): void {
  if (typeof window === 'undefined') return;

  const schedulePrefetch = () => {
    // Ưu tiên nạp ngầm Lô sản xuất và Phiếu kiểm nghiệm
    preloadRoute('/batches');
    preloadRoute('/batches/detail');
    preloadRoute('/test-results');
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(schedulePrefetch, { timeout: 3000 });
  } else {
    setTimeout(schedulePrefetch, 2000);
  }
}
