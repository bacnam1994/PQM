import { Component, ErrorInfo, ReactNode } from 'react';
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  HomeIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { isChunkLoadError, triggerAutoReloadOnce } from '../../utils/lazyWithRetry';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
  isChunkMismatch: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorId: null,
    isChunkMismatch: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    const isChunkMismatch = isChunkLoadError(error);
    return {
      hasError: true,
      error,
      errorId:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`,
      isChunkMismatch,
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

    // Nếu lỗi do phiên bản chunk cũ trên trình duyệt, tự động nạp lại trang 1 lần
    if (isChunkLoadError(error)) {
      if (triggerAutoReloadOnce('error-boundary')) {
        return;
      }
    }
  }

  private handleRecover = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
      isChunkMismatch: false,
    });
  };

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.assign('/test-results');
    }
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.clear();
      } catch {}
      window.location.reload();
    }
  };

  private handleHardRefresh = () => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.clear();
        if ('caches' in window) {
          caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
        }
      } catch {}
      window.location.reload();
    }
  };

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { isChunkMismatch } = this.state;

    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-2 p-4 font-sans">
        <div className="bg-surface p-6 sm:p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-border">
          <div className="w-12 h-12 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
            <ExclamationTriangleIcon className="w-6 h-6" />
          </div>

          <h1 className="text-base font-bold text-ink tracking-tight mb-1.5">Đã xảy ra sự cố</h1>

          <p className="text-xs sm:text-sm text-ink-muted mb-4 leading-relaxed">
            {isChunkMismatch
              ? 'Hệ thống vừa cập nhật phiên bản mới. Trình duyệt cần làm mới để nạp tài nguyên mới nhất.'
              : 'Giao diện hiện tại không thể hiển thị. Bạn có thể thử khôi phục trước khi tải lại toàn bộ ứng dụng.'}
          </p>

          {isChunkMismatch && (
            <div className="mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs text-left flex items-start gap-2">
              <ArrowDownTrayIcon className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                Phát hiện mã nguồn phía máy chủ đã được nâng cấp. Bấm <strong>Tải lại</strong> hoặc{' '}
                <strong>Xóa bộ nhớ đệm</strong> để đồng bộ.
              </span>
            </div>
          )}

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

          {isChunkMismatch && (
            <button
              type="button"
              onClick={this.handleHardRefresh}
              className="mt-3 w-full py-2 px-3 rounded-xl border border-dashed border-border text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors text-[11px] font-medium cursor-pointer"
            >
              Xóa bộ nhớ đệm & Tải lại triệt để
            </button>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
