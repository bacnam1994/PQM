import React, { useState, useEffect } from 'react';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface OperationalLoadingStateProps {
  message?: string;
  subMessage?: string;
  onRetry?: () => void;
  timeoutSeconds?: number;
  fullPage?: boolean;
  className?: string;
}

export const OperationalLoadingState: React.FC<OperationalLoadingStateProps> = ({
  message = 'Đang tải dữ liệu...',
  subMessage = 'Hệ thống đang kết nối và xử lý thông tin...',
  onRetry,
  timeoutSeconds = 10,
  fullPage = false,
  className = '',
}) => {
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTimedOut(true);
    }, timeoutSeconds * 1000);

    return () => clearTimeout(timer);
  }, [timeoutSeconds]);

  const containerClass = fullPage
    ? 'min-h-[70vh] flex items-center justify-center p-6'
    : 'p-8 flex items-center justify-center';

  if (isTimedOut && onRetry) {
    return (
      <div className={`${containerClass} ${className}`}>
        <div className="bg-surface p-6 rounded-2xl border border-border shadow-xs max-w-md w-full text-center space-y-4 animate-in fade-in duration-300">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <ExclamationTriangleIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">Quá trình nạp dữ liệu lâu hơn dự kiến</h3>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              Đường truyền mạng hoặc máy chủ phản hồi chậm. Bạn có muốn thử kết nối lại không?
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsTimedOut(false);
              onRetry();
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-xs inline-flex items-center gap-2 cursor-pointer"
          >
            <ArrowPathIcon className="w-3.5 h-3.5" />
            Thử lại tải dữ liệu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${containerClass} ${className}`}>
      <div className="bg-surface/80 backdrop-blur-xs p-6 rounded-2xl border border-border shadow-xs max-w-sm w-full flex flex-col items-center text-center space-y-3 animate-in fade-in duration-300">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <ArrowPathIcon className="w-5 h-5 animate-spin" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-ink">{message}</h4>
          {subMessage && <p className="text-xs text-ink-muted mt-0.5">{subMessage}</p>}
        </div>
        <div className="w-36 h-1 bg-surface-3 rounded-full overflow-hidden">
          <div className="w-full h-full bg-emerald-500 animate-pulse" />
        </div>
      </div>
    </div>
  );
};
