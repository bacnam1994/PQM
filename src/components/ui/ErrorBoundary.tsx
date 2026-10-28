import { Component, ErrorInfo, ReactNode } from 'react';
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorId: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', {
      error,
      errorInfo,
      url: typeof window !== 'undefined' ? window.location.href : '',
    });

    if (typeof document !== 'undefined') {
      const loader = document.getElementById('app-loader');
      if (loader) loader.remove();
    }
  }

  private handleRecover = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
    });
  };

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.assign('/test-results');
    }
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-2 p-4 font-sans">
        <div className="bg-surface p-6 sm:p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-border">
          <div className="w-12 h-12 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
            <ExclamationTriangleIcon className="w-6 h-6" />
          </div>

          <h1 className="text-base font-bold text-ink tracking-tight mb-1.5">
            Đã xảy ra sự cố
          </h1>

          <p className="text-xs sm:text-sm text-ink-muted mb-5 leading-relaxed">
            Giao diện hiện tại không thể hiển thị. Bạn có thể thử khôi phục
            trước khi tải lại toàn bộ ứng dụng.
          </p>

          {import.meta.env.DEV && this.state.error?.message && (
            <pre className="mb-5 max-h-32 overflow-auto rounded-xl bg-surface-2 p-3 text-left text-[10px] text-ink-muted whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={this.handleRecover}
              className="px-3 py-2.5 rounded-xl border border-border text-ink hover:bg-surface-2 transition-colors text-xs font-medium cursor-pointer"
            >
              Thử khôi phục
            </button>

            <button
              type="button"
              onClick={this.handleGoHome}
              className="px-3 py-2.5 rounded-xl border border-border text-ink hover:bg-surface-2 transition-colors text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <HomeIcon className="w-4 h-4" />
              Danh sách
            </button>

            <button
              type="button"
              onClick={this.handleReload}
              className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Tải lại
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;