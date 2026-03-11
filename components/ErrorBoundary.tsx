import React, { useState, useCallback, useEffect, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

// Functional component để bắt lỗi React render
export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps): ReactNode {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const handleRetry = useCallback(() => {
    setHasError(false);
    setError(undefined);
  }, []);

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      console.error('Unhandled error:', event.error);
      if (event.error && !(event.error instanceof DOMException)) {
        setHasError(true);
        setError(event.error);
      }
    };

    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      if (event.reason && event.reason instanceof Error) {
        setHasError(true);
        setError(event.reason);
      }
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);

    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
    };
  }, []);

  if (hasError) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Đã xảy ra lỗi</h2>
          <p className="text-slate-600 mb-6">
            Có lỗi không mong muốn xảy ra. Vui lòng thử lại hoặc liên hệ hỗ trợ.
          </p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={18} />
            Thử lại
          </button>
          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">
                Chi tiết lỗi (Development)
              </summary>
              <pre className="mt-2 p-3 bg-slate-100 rounded text-xs overflow-auto">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default ErrorBoundary;
