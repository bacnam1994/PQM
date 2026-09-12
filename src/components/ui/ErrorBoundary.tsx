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
          <div className="bg-surface p-6 sm:p-8 rounded-2xl shadow-xl max-w-sm w-full text-center border border-border">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
              <ExclamationTriangleIcon className="w-6 h-6" />
            </div>
            <h1 className="text-base font-bold text-ink tracking-tight mb-1.5">Đã xảy ra sự cố</h1>
            <p className="text-xs sm:text-sm text-ink-muted mb-5 line-clamp-3 leading-relaxed">
              {this.state.error?.message || 'Có lỗi không xác định xảy ra trong quá trình hiển thị giao diện. Vui lòng tải lại trang để tiếp tục.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-xs"
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