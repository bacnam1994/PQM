
import React, { useEffect, Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider } from './providers/AppProvider';
import { Outlet } from 'react-router-dom';
import { Layout, ErrorBoundary, Skeleton } from './components';
import CookieConsentBanner from './components/ui/CookieConsentBanner';
import { useAppStore } from './store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore, loadUserPreferences, resetToSharedKey } from './store/useUIStore';
const lazyWithRetry = (componentImport: () => Promise<any>) => {
  return lazy(async () => {
    const hasReloaded = sessionStorage.getItem('page-has-reloaded-for-chunk');
    try {
      const result = await componentImport();
      sessionStorage.removeItem('page-has-reloaded-for-chunk');
      return result;
    } catch (error) {
      if (!hasReloaded) {
        sessionStorage.setItem('page-has-reloaded-for-chunk', 'true');
        console.error('Lỗi tải module động, đang làm mới cache...', error);
        window.location.reload();
      } else {
        console.error('Không thể tải module động (đã thử reload):', error);
        throw error;
      }
      return new Promise(() => {});
    }
  });
};

const Dashboard = lazyWithRetry(() => import('./pages/system/Dashboard'));
const ProductList = lazyWithRetry(() => import('./pages/products/ProductList'));
const ProductDetail = lazyWithRetry(() => import('./pages/products/ProductDetail'));
const TCCSList = lazyWithRetry(() => import('./pages/qa/TCCSList'));
const ProductFormulaList = lazyWithRetry(() => import('./pages/qa/ProductFormulaList'));
const MaterialList = lazyWithRetry(() => import('./pages/products/MaterialList'));
const BatchList = lazyWithRetry(() => import('./pages/batches/BatchList'));
const TestResultList = lazyWithRetry(() => import('./pages/qa/TestResultList'));
const CriteriaList = lazyWithRetry(() => import('./pages/qa/CriteriaList'));
const SettingsPage = lazyWithRetry(() => import('./pages/system/SettingsPage'));
const AccountPage = lazyWithRetry(() => import('./pages/system/AccountPage'));
const SearchPage = lazyWithRetry(() => import('./pages/system/SearchPage'));
const LoginPage = lazyWithRetry(() => import('./pages/auth/LoginPage'));
const SignupPage = lazyWithRetry(() => import('./pages/auth/SignupPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('./pages/auth/ForgotPasswordPage'));
const UserManagement = lazyWithRetry(() => import('./pages/system/UserManagement'));
const TestResultFormPage = lazyWithRetry(() => import('./pages/qa/TestResultFormPage'));
const CoAReportPage = lazyWithRetry(() => import('./pages/qa/CoAReportPage'));
const ProductFormPage = lazyWithRetry(() => import('./pages/products/ProductFormPage'));
const BatchFormPage = lazyWithRetry(() => import('./pages/batches/BatchFormPage'));
const BatchDetailPage = lazyWithRetry(() => import('./pages/batches/BatchDetailPage'));
const TCCSFormPage = lazyWithRetry(() => import('./pages/qa/TCCSFormPage'));
const TccsDetailPage = lazyWithRetry(() => import('./pages/qa/TccsDetailPage'));
const ProductFormulaFormPage = lazyWithRetry(() => import('./pages/qa/ProductFormulaFormPage'));
const MaterialFormPage = lazyWithRetry(() => import('./pages/products/MaterialFormPage'));
const RawMaterialCatalog = lazyWithRetry(() => import('./pages/products/RawMaterialCatalog'));
const CriteriaFormPage = lazyWithRetry(() => import('./pages/qa/CriteriaFormPage'));
const NotFoundPage = lazyWithRetry(() => import('./pages/system/NotFoundPage'));
const AlertsPage = lazyWithRetry(() => import('./pages/quality/AlertsPage'));
const QualitySummaryReport = lazyWithRetry(() => import('./pages/quality/QualitySummaryReport'));
const UnauthorizedPage = lazyWithRetry(() => import('./pages/auth/UnauthorizedPage'));
const WelcomePage = lazyWithRetry(() => import('./pages/auth/WelcomePage'));

const ProtectedRoute: React.FC = () => {
  const { user, role, authLoading } = useAppStore(useShallow(s => ({
    user: s.user,
    role: s.role,
    authLoading: s.authLoading
  })));

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  
  if (role === 'GUEST') {
    return <Navigate to="/welcome" replace />;
  }

  return <Layout><Outlet /></Layout>;
};

const GuestRoute: React.FC = () => {
  const { user, authLoading } = useAppStore(useShallow(s => ({
    user: s.user,
    authLoading: s.authLoading
  })));

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return <Layout><Outlet /></Layout>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, authLoading } = useAppStore(useShallow(s => ({
    user: s.user,
    role: s.role,
    authLoading: s.authLoading
  })));

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== 'ADMIN') {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
};

// [BẢO MẬT] Route bảo vệ trang in/xuất báo cáo - không có sidebar nhưng bắt buộc đăng nhập
const PrintRoute: React.FC = () => {
  const { user, authLoading } = useAppStore(useShallow(s => ({
    user: s.user,
    authLoading: s.authLoading
  })));

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
};

const AppRoutes: React.FC = () => {
  const authLoading = useAppStore(s => s.authLoading);

  useEffect(() => {
    if (!authLoading) {
      const loader = document.getElementById('app-loader');
      if (loader) loader.remove();
    }
  }, [authLoading]);

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

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
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
          <Route path="/products/new" element={<AdminRoute><ProductFormPage /></AdminRoute>} />
          <Route path="/products/edit/:id" element={<AdminRoute><ProductFormPage /></AdminRoute>} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/tccs" element={<TCCSList />} />
          <Route path="/tccs/new" element={<AdminRoute><TCCSFormPage /></AdminRoute>} />
          <Route path="/tccs/edit/:id" element={<AdminRoute><TCCSFormPage /></AdminRoute>} />
          <Route path="/tccs/detail/:id" element={<TccsDetailPage />} />
          <Route path="/product-formulas" element={<ProductFormulaList />} />
          <Route path="/product-formulas/new" element={<AdminRoute><ProductFormulaFormPage /></AdminRoute>} />
          <Route path="/product-formulas/edit/:id" element={<AdminRoute><ProductFormulaFormPage /></AdminRoute>} />
          <Route path="/materials" element={<MaterialList />} />
          <Route path="/materials/new" element={<AdminRoute><MaterialFormPage /></AdminRoute>} />
          <Route path="/materials/edit/:id" element={<AdminRoute><MaterialFormPage /></AdminRoute>} />
          <Route path="/materials/catalog" element={<RawMaterialCatalog />} />
          <Route path="/criteria" element={<CriteriaList />} />
          <Route path="/criteria/new" element={<AdminRoute><CriteriaFormPage /></AdminRoute>} />
          <Route path="/criteria/edit/:id" element={<AdminRoute><CriteriaFormPage /></AdminRoute>} />
          <Route path="/batches" element={<BatchList />} />
          <Route path="/batches/new" element={<AdminRoute><BatchFormPage /></AdminRoute>} />
          <Route path="/batches/edit/:id" element={<AdminRoute><BatchFormPage /></AdminRoute>} />
          <Route path="/batches/:id" element={<BatchDetailPage />} />
          <Route path="/test-results" element={<TestResultList />} />
          <Route path="/test-results/new" element={<AdminRoute><TestResultFormPage /></AdminRoute>} />
          <Route path="/test-results/edit/:id" element={<AdminRoute><TestResultFormPage /></AdminRoute>} />
          <Route path="/reports/quality-summary" element={<QualitySummaryReport />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
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
  const theme = useAppStore(s => s.theme);
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
  const user = useAppStore(s => s.user);
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
  const setLastVisitedPath = useUIStore(s => s.setLastVisitedPath);
  useEffect(() => {
    // Không lưu các trang auth
    const excludedPaths = ['/login', '/signup', '/forgot-password'];
    if (!excludedPaths.some(p => location.pathname.startsWith(p))) {
      setLastVisitedPath(location.pathname);
    }
  }, [location.pathname, setLastVisitedPath]);
  return null;
};

const App: React.FC = () => {
  return (
      <AppProvider>
          <BrowserRouter>
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
