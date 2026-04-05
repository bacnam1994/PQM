import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

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
    // Cập nhật state để render UI thay thế
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Bạn có thể log lỗi này lên các dịch vụ như Sentry, Firebase Crashlytics ở đây
    console.error('Đã bắt được lỗi trong ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border border-red-100">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} />
            </div>
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Đã xảy ra sự cố</h1>
            <p className="text-sm font-medium text-slate-500 mb-8 line-clamp-3">
              {this.state.error?.message || 'Có lỗi không xác định xảy ra trong quá trình hiển thị giao diện. Vui lòng tải lại trang để tiếp tục.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-100"
            >
              <RefreshCcw size={16} />
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