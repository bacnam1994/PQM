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
  '/': () => import('../pages/system/Dashboard'),
  '/batches': () => import('../pages/batches/BatchList'),
  '/batches/new': () => import('../pages/batches/BatchFormPage'),
  '/batches/detail': () => import('../pages/batches/BatchDetailPage'),
  '/test-results': () => import('../pages/qa/TestResultList'),
  '/test-results/new': () => import('../pages/qa/TestResultFormPage'),
  '/products': () => import('../pages/products/ProductList'),
  '/products/new': () => import('../pages/products/ProductFormPage'),
  '/products/detail': () => import('../pages/products/ProductDetail'),
  '/materials': () => import('../pages/products/MaterialList'),
  '/tccs': () => import('../pages/qa/TCCSList'),
  '/tccs/new': () => import('../pages/qa/TCCSFormPage'),
  '/tccs/detail': () => import('../pages/qa/TccsDetailPage'),
  '/product-formulas': () => import('../pages/qa/ProductFormulaList'),
  '/criteria': () => import('../pages/qa/CriteriaList'),
  '/laboratories': () => import('../pages/qa/LaboratoryManagementPage'),
  '/alerts': () => import('../pages/quality/AlertsPage'),
  '/quality/comparison': () => import('../pages/quality/comparison/ComparisonPage'),
  '/reports/quality-summary': () => import('../pages/quality/QualitySummaryReport'),
  '/reports/trend-analysis': () => import('../pages/quality/TrendAnalysisPage'),
  '/settings': () => import('../pages/system/SettingsPage'),
  '/search': () => import('../pages/system/SearchPage'),
};

/**
 * Preload một route cụ thể theo đường dẫn
 */
export function preloadRoute(path: string): void {
  if (!path) return;
  const cleanPath = path.split('?')[0].split('#')[0];

  // Chuẩn hóa dynamic path về loader key tương ứng
  let targetKey = cleanPath;
  if (cleanPath.startsWith('/batches/edit/')) {
    targetKey = '/batches/new';
  } else if (cleanPath.startsWith('/batches/') && cleanPath !== '/batches/new') {
    targetKey = '/batches/detail';
  } else if (cleanPath.startsWith('/products/edit/')) {
    targetKey = '/products/new';
  } else if (cleanPath.startsWith('/products/') && cleanPath !== '/products/new') {
    targetKey = '/products/detail';
  } else if (cleanPath.startsWith('/tccs/edit/')) {
    targetKey = '/tccs/new';
  } else if (cleanPath.startsWith('/tccs/detail/')) {
    targetKey = '/tccs/detail';
  } else if (cleanPath.startsWith('/test-results/edit/')) {
    targetKey = '/test-results/new';
  }

  if (preloadedRoutes.has(targetKey)) return;

  const loader = ROUTE_LOADERS[targetKey] || ROUTE_LOADERS[cleanPath];
  if (loader) {
    preloadedRoutes.add(targetKey);
    loader().catch(() => {
      preloadedRoutes.delete(targetKey);
    });
  }
}

/**
 * Preload tự động route hiện tại ngay lập tức (Zero-Waterfall) và nạp ngầm theo đợt
 * các route cốt lõi khi trình duyệt rảnh rỗi (Staggered Idle Prefetch).
 */
export function initIdleRoutePrefetch(): void {
  if (typeof window === 'undefined') return;

  // 1. Nạp ngay lập tức chunk của URL hiện tại để phá vỡ thác nước mạng (Zero-Waterfall)
  preloadRoute(window.location.pathname);

  // Tôn trọng chế độ tiết kiệm dữ liệu của trình duyệt nếu có
  const conn = (navigator as any).connection;
  if (conn?.saveData) return;

  const tier1Routes = ['/', '/batches', '/batches/detail', '/test-results', '/test-results/new'];
  const tier2Routes = ['/products', '/tccs', '/product-formulas', '/materials', '/criteria'];

  const runIdle = (fn: () => void, timeoutMs: number) => {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(fn, { timeout: timeoutMs });
    } else {
      setTimeout(fn, timeoutMs);
    }
  };

  runIdle(() => {
    tier1Routes.forEach((r) => preloadRoute(r));
    runIdle(() => {
      tier2Routes.forEach((r) => preloadRoute(r));
    }, 1500);
  }, 400);
}
