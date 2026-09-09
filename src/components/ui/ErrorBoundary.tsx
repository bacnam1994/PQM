import { Component, ErrorInfo, ReactNode } from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Đã bắt được lỗi trong ErrorBoundary:', error, errorInfo);
    const loader = document.getElementById('app-loader');
    if (loader) loader.remove();
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface-2 p-4 font-sans">
          <div className="bg-surface p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-rose-200/80 dark:border-rose-950/60">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-5 ring-1 ring-inset ring-rose-600/20">
              <ExclamationTriangleIcon className="w-8 h-8" />
            </div>
            <h1 className="text-lg font-bold text-ink uppercase tracking-tight mb-2">Đã xảy ra sự cố</h1>
            <p className="text-xs sm:text-sm font-medium text-ink-faint mb-6 line-clamp-3 leading-relaxed">
              {this.state.error?.message || 'Có lỗi không xác định xảy ra trong quá trình hiển thị giao diện. Vui lòng tải lại trang để tiếp tục.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;