import React, { useEffect, Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider } from './providers/AppProvider';
import { Outlet } from 'react-router-dom';
import { Layout, ErrorBoundary, Skeleton, CookieConsentBanner } from './components';
import { useAppStore } from './store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore, loadUserPreferences, resetToSharedKey } from './store/useUIStore';
import { lazyWithRetry } from './utils/lazyWithRetry';

const Dashboard = lazyWithRetry(() => import('./pages/system/Dashboard'), 'Dashboard');
const ProductList = lazyWithRetry(() => import('./pages/products/ProductList'), 'ProductList');
const ProductDetail = lazyWithRetry(
  () => import('./pages/products/ProductDetail'),
  'ProductDetail'
);
const TCCSList = lazyWithRetry(() => import('./pages/qa/TCCSList'), 'TCCSList');
const ProductFormulaList = lazyWithRetry(
  () => import('./pages/qa/ProductFormulaList'),
  'ProductFormulaList'
);
const MaterialList = lazyWithRetry(() => import('./pages/products/MaterialList'), 'MaterialList');
const BatchList = lazyWithRetry(() => import('./pages/batches/BatchList'), 'BatchList');
const TestResultList = lazyWithRetry(() => import('./pages/qa/TestResultList'), 'TestResultList');
const CriteriaList = lazyWithRetry(() => import('./pages/qa/CriteriaList'), 'CriteriaList');
const SettingsPage = lazyWithRetry(() => import('./pages/system/SettingsPage'), 'SettingsPage');
const AccountPage = lazyWithRetry(() => import('./pages/system/AccountPage'), 'AccountPage');
const SearchPage = lazyWithRetry(() => import('./pages/system/SearchPage'), 'SearchPage');
const LoginPage = lazyWithRetry(() => import('./pages/auth/LoginPage'), 'LoginPage');
const SignupPage = lazyWithRetry(() => import('./pages/auth/SignupPage'), 'SignupPage');
const ForgotPasswordPage = lazyWithRetry(
  () => import('./pages/auth/ForgotPasswordPage'),
  'ForgotPasswordPage'
);
const UserManagement = lazyWithRetry(
  () => import('./pages/system/UserManagement'),
  'UserManagement'
);
const TestResultFormPage = lazyWithRetry(
  () => import('./pages/qa/TestResultFormPage'),
  'TestResultFormPage'
);
const CoAReportPage = lazyWithRetry(() => import('./pages/qa/CoAReportPage'), 'CoAReportPage');
const ProductFormPage = lazyWithRetry(
  () => import('./pages/products/ProductFormPage'),
  'ProductFormPage'
);
const BatchFormPage = lazyWithRetry(() => import('./pages/batches/BatchFormPage'), 'BatchFormPage');
const BatchDetailPage = lazyWithRetry(
  () => import('./pages/batches/BatchDetailPage'),
  'BatchDetailPage'
);
const TCCSFormPage = lazyWithRetry(() => import('./pages/qa/TCCSFormPage'), 'TCCSFormPage');
const TccsDetailPage = lazyWithRetry(() => import('./pages/qa/TccsDetailPage'), 'TccsDetailPage');
const ProductFormulaFormPage = lazyWithRetry(
  () => import('./pages/qa/ProductFormulaFormPage'),
  'ProductFormulaFormPage'
);
const MaterialFormPage = lazyWithRetry(
  () => import('./pages/products/MaterialFormPage'),
  'MaterialFormPage'
);
const CriteriaFormPage = lazyWithRetry(
  () => import('./pages/qa/CriteriaFormPage'),
  'CriteriaFormPage'
);
const NotFoundPage = lazyWithRetry(() => import('./pages/system/NotFoundPage'), 'NotFoundPage');
const AlertsPage = lazyWithRetry(() => import('./pages/quality/AlertsPage'), 'AlertsPage');
const QualitySummaryReport = lazyWithRetry(
  () => import('./pages/quality/QualitySummaryReport'),
  'QualitySummaryReport'
);
const TrendAnalysisPage = lazyWithRetry(
  () => import('./pages/quality/TrendAnalysisPage'),
  'TrendAnalysisPage'
);
const UnauthorizedPage = lazyWithRetry(
  () => import('./pages/auth/UnauthorizedPage'),
  'UnauthorizedPage'
);
const WelcomePage = lazyWithRetry(() => import('./pages/auth/WelcomePage'), 'WelcomePage');
const CriteriaAliasManager = lazyWithRetry(
  () => import('./pages/system/CriteriaAliasManager'),
  'CriteriaAliasManager'
);
const AuditLogPage = lazyWithRetry(() => import('./pages/system/AuditLogPage'), 'AuditLogPage');
const CoAVerifyPage = lazyWithRetry(() => import('./pages/public/CoAVerifyPage'), 'CoAVerifyPage');
const DeviationListPage = lazyWithRetry(
  () => import('./pages/qa/DeviationListPage'),
  'DeviationListPage'
);
const ChangeControlListPage = lazyWithRetry(
  () => import('./pages/quality/change-control/ChangeControlListPage'),
  'ChangeControlListPage'
);
const Batch360Page = lazyWithRetry(
  () => import('./pages/batches/batch-360/Batch360Page').then((m) => ({ default: m.Batch360Page })),
  'Batch360Page'
);
const Product360Page = lazyWithRetry(
  () =>
    import('./pages/products/product-360/Product360Page').then((m) => ({
      default: m.Product360Page,
    })),
  'Product360Page'
);
const LaboratoryManagementPage = lazyWithRetry(
  () => import('./pages/qa/LaboratoryManagementPage'),
  'LaboratoryManagementPage'
);

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen w-full bg-transparent transition-colors duration-300">
    <div className="flex flex-col items-center gap-6 w-full max-w-sm px-4">
      <Skeleton className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/50" />
      <div className="space-y-3 w-full">
        <Skeleton className="h-4 w-3/4 mx-auto bg-slate-200 dark:bg-slate-700/50" />
        <Skeleton className="h-3 w-1/2 mx-auto bg-slate-200 dark:bg-slate-700/50" />
      </div>
    </div>
  </div>
);

const ProtectedRoute: React.FC = () => {
  const { user, role, isAdmin, authLoading } = useAppStore(
    useShallow((s) => ({
      user: s.user,
      role: s.role,
      isAdmin: s.isAdmin,
      authLoading: s.authLoading,
    }))
  );

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (role === 'GUEST' && !isAdmin) {
    return <Navigate to="/welcome" replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

const GuestRoute: React.FC = () => {
  const { user, role, isAdmin, authLoading } = useAppStore(
    useShallow((s) => ({
      user: s.user,
      role: s.role,
      isAdmin: s.isAdmin,
      authLoading: s.authLoading,
    }))
  );

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  // Nếu là Admin thì không giữ ở trang chào mừng mà chuyển thẳng vào hệ thống
  if (role === 'ADMIN' || isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, isAdmin, authLoading } = useAppStore(
    useShallow((s) => ({
      user: s.user,
      role: s.role,
      isAdmin: s.isAdmin,
      authLoading: s.authLoading,
    }))
  );

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== 'ADMIN' && !isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
};

// [BẢO MẬT] Route bảo vệ trang in/xuất báo cáo - không có sidebar nhưng bắt buộc đăng nhập
const PrintRoute: React.FC = () => {
  const { user, authLoading } = useAppStore(
    useShallow((s) => ({
      user: s.user,
      authLoading: s.authLoading,
    }))
  );

  if (authLoading) return <LoadingFallback />;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
};

const AppRoutes: React.FC = () => {
  const authLoading = useAppStore((s) => s.authLoading);

  useEffect(() => {
    if (!authLoading) {
      const loader = document.getElementById('app-loader');
      if (loader) loader.remove();
    }
  }, [authLoading]);

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        {/* [XÁC THỰC CÔNG KHAI] Route xác thực chứng chỉ CoA khi quét QR không cần đăng nhập */}
        <Route path="/verify/:id" element={<CoAVerifyPage />} />

        {/* [BẢO MẬT] Route CoA đã được bảo vệ - yêu cầu đăng nhập trước khi xem báo cáo */}
        <Route element={<PrintRoute />}>
          <Route path="/test-results/coa/:batchId" element={<CoAReportPage />} />
          <Route path="/test-results/print/:id" element={<CoAReportPage />} />
        </Route>

        {/* Guest Routes */}
        <Route element={<GuestRoute />}>
          <Route path="/welcome" element={<WelcomePage />} />
        </Route>

        {/* Authenticated User / Admin Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<ProductList />} />
          <Route
            path="/products/new"
            element={
              <AdminRoute>
                <ProductFormPage />
              </AdminRoute>
            }
          />
          <Route
            path="/products/edit/:id"
            element={
              <AdminRoute>
                <ProductFormPage />
              </AdminRoute>
            }
          />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/products/360/:id" element={<Product360Page />} />
          <Route path="/tccs" element={<TCCSList />} />
          <Route
            path="/tccs/new"
            element={
              <AdminRoute>
                <TCCSFormPage />
              </AdminRoute>
            }
          />
          <Route
            path="/tccs/edit/:id"
            element={
              <AdminRoute>
                <TCCSFormPage />
              </AdminRoute>
            }
          />
          <Route path="/tccs/detail/:id" element={<TccsDetailPage />} />
          <Route path="/product-formulas" element={<ProductFormulaList />} />
          <Route
            path="/product-formulas/new"
            element={
              <AdminRoute>
                <ProductFormulaFormPage />
              </AdminRoute>
            }
          />
          <Route
            path="/product-formulas/edit/:id"
            element={
              <AdminRoute>
                <ProductFormulaFormPage />
              </AdminRoute>
            }
          />
          <Route path="/materials" element={<MaterialList />} />
          <Route
            path="/materials/new"
            element={
              <AdminRoute>
                <MaterialFormPage />
              </AdminRoute>
            }
          />
          <Route
            path="/materials/edit/:id"
            element={
              <AdminRoute>
                <MaterialFormPage />
              </AdminRoute>
            }
          />
          {/* /materials/catalog redirect về /materials — RawMaterialCatalog đã gộp vào MaterialList */}
          <Route path="/materials/catalog" element={<Navigate to="/materials" replace />} />
          <Route path="/criteria" element={<CriteriaList />} />
          <Route
            path="/criteria/new"
            element={
              <AdminRoute>
                <CriteriaFormPage />
              </AdminRoute>
            }
          />
          <Route
            path="/criteria/edit/:id"
            element={
              <AdminRoute>
                <CriteriaFormPage />
              </AdminRoute>
            }
          />
          <Route path="/batches" element={<BatchList />} />
          {/* USER được tạo lô mới, chỉ ADMIN mới sửa/xóa */}
          <Route path="/batches/new" element={<BatchFormPage />} />
          <Route
            path="/batches/edit/:id"
            element={
              <AdminRoute>
                <BatchFormPage />
              </AdminRoute>
            }
          />
          <Route path="/batches/:id" element={<BatchDetailPage />} />
          <Route path="/batches/360/:id" element={<Batch360Page />} />
          <Route path="/test-results" element={<TestResultList />} />
          <Route path="/laboratories" element={<LaboratoryManagementPage />} />
          <Route path="/labs" element={<Navigate to="/laboratories" replace />} />
          {/* USER được tạo phiếu KN mới, chỉ ADMIN mới sửa */}
          <Route path="/test-results/new" element={<TestResultFormPage />} />
          <Route path="/test-results/form" element={<Navigate to="/test-results/new" replace />} />
          <Route
            path="/test-results/edit/:id"
            element={
              <AdminRoute>
                <TestResultFormPage />
              </AdminRoute>
            }
          />
          <Route path="/deviations" element={<DeviationListPage />} />
          <Route path="/change-control" element={<ChangeControlListPage />} />
          <Route path="/reports/quality-summary" element={<QualitySummaryReport />} />
          <Route path="/reports/trend-analysis" element={<TrendAnalysisPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route
            path="/users"
            element={
              <AdminRoute>
                <UserManagement />
              </AdminRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <AdminRoute>
                <AuditLogPage />
              </AdminRoute>
            }
          />
          <Route
            path="/criteria-aliases"
            element={
              <AdminRoute>
                <CriteriaAliasManager />
              </AdminRoute>
            }
          />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};

// Component "tàng hình" để nạp useNavigate vào Zustand
const GlobalNavigation = () => {
  const navigate = useNavigate();
  useEffect(() => {
    useAppStore.setState({ navigate });
  }, [navigate]);
  return null;
};

// Component "tàng hình" để xử lý giao diện Dark Mode
const ThemeManager = () => {
  const theme = useAppStore((s) => s.theme);
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  return null;
};

// Component đồng bộ preferences theo userId (per-user cookie key)
const UserPreferenceSync = () => {
  const user = useAppStore((s) => s.user);
  useEffect(() => {
    if (user?.uid) {
      loadUserPreferences(user.uid);
    } else {
      resetToSharedKey();
    }
  }, [user?.uid]);
  return null;
};

// Component theo dõi và lưu trang cuối người dùng đã truy cập
const RouteTracker = () => {
  const location = useLocation();
  const setLastVisitedPath = useUIStore((s) => s.setLastVisitedPath);
  useEffect(() => {
    // Không lưu các trang auth
    const excludedPaths = ['/login', '/signup', '/forgot-password'];
    if (!excludedPaths.some((p) => location.pathname.startsWith(p))) {
      setLastVisitedPath(location.pathname);
    }
  }, [location.pathname, setLastVisitedPath]);
  return null;
};

const getBasename = () => {
  const base = import.meta.env.BASE_URL;
  if (!base || base === './' || base === '/') return undefined;
  return base.endsWith('/') ? base.slice(0, -1) : base;
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <BrowserRouter basename={getBasename()}>
        <GlobalNavigation />
        <ThemeManager />
        <UserPreferenceSync />
        <RouteTracker />
        <Toaster position="bottom-right" toastOptions={{ duration: 4000 }} />
        <CookieConsentBanner />
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </BrowserRouter>
    </AppProvider>
  );
};

export default App;
