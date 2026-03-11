
import React, { useEffect, Suspense, lazy } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TestResultProvider } from './context/TestResultContext';
import Layout from './components/Layout';
import { Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ReloadPrompt from './components/ReloadPrompt';
import ErrorBoundary from './components/ErrorBoundary';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProductList = lazy(() => import('./pages/ProductList'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const TCCSList = lazy(() => import('./pages/TCCSList'));
const ProductFormulaList = lazy(() => import('./pages/ProductFormulaList'));
const MaterialList = lazy(() => import('./pages/MaterialList'));
const BatchList = lazy(() => import('./pages/BatchList'));
const TestResultList = lazy(() => import('./pages/TestResultList'));
const CriteriaList = lazy(() => import('./pages/CriteriaList'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const UserManagement = lazy(() => import('./pages/UserManagement'));

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null; // App loader in index.html will be visible
  if (!user) return <Navigate to="/login" replace />;
  return <Layout><Outlet /></Layout>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  // Admin routes are also protected routes, so they share the same layout.
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      const loader = document.getElementById('app-loader');
      if (loader) loader.remove();
    }
  }, [loading]);

  const LoadingFallback = () => (
    <div className="flex items-center justify-center h-screen w-full bg-[#f8faf9]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={48} className="text-[#009639] animate-spin" />
        <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">Đang tải dữ liệu...</p>
      </div>
    </div>
  );

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/tccs" element={<TCCSList />} />
          <Route path="/product-formulas" element={<ProductFormulaList />} />
          <Route path="/materials" element={<MaterialList />} />
          <Route path="/criteria" element={<CriteriaList />} />
          <Route path="/batches" element={<BatchList />} />
          <Route path="/test-results" element={<TestResultList />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <TestResultProvider>
            <HashRouter>
              <Toaster position="bottom-right" toastOptions={{ duration: 4000 }} />
              <ReloadPrompt />
              <AppRoutes />
            </HashRouter>
          </TestResultProvider>
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
