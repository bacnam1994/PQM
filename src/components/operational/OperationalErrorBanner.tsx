import React, { useState } from 'react';
import {
  ExclamationCircleIcon,
  ArrowPathIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { OperationalError } from '../../types/operational';

interface OperationalErrorBannerProps {
  error: OperationalError | Error | string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  title?: string;
  className?: string;
}

export const OperationalErrorBanner: React.FC<OperationalErrorBannerProps> = ({
  error,
  onRetry,
  onDismiss,
  title,
  className = '',
}) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!error) return null;

  let message = '';
  let technicalDetails: string | undefined = undefined;
  let retryable = Boolean(onRetry);
  let retryAction = onRetry;
  let code = '';
  let type = 'UNKNOWN';

  if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
    technicalDetails = error.stack;
  } else {
    message = error.message;
    technicalDetails = error.technicalDetails;
    retryable = error.retryable !== false && Boolean(onRetry || error.onRetry);
    retryAction = onRetry || error.onRetry;
    code = error.code;
    type = error.type;
  }

  const isPermission = type === 'PERMISSION' || code === 'PERMISSION_DENIED';
  const bannerBg = isPermission
    ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
    : 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800';

  const textColor = isPermission
    ? 'text-amber-950 dark:text-amber-100'
    : 'text-rose-950 dark:text-rose-100';

  const icon = isPermission ? (
    <ShieldExclamationIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
  ) : (
    <ExclamationCircleIcon className="w-5 h-5 text-rose-600 dark:text-rose-400" />
  );

  return (
    <div
      className={`rounded-2xl border p-4 backdrop-blur-xs shadow-xs animate-in slide-in-from-top-2 duration-300 space-y-3 ${bannerBg} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-surface/60 shrink-0 mt-0.5">{icon}</div>
          <div className="space-y-1">
            <h4 className={`text-xs font-bold ${textColor}`}>
              {title ||
                (isPermission
                  ? 'Quyền truy cập bị từ chối'
                  : 'Có lỗi phát sinh trong quá trình xử lý')}
            </h4>
            <p className={`text-[12px] leading-relaxed opacity-90 ${textColor}`}>{message}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {retryable && retryAction && (
            <button
              type="button"
              onClick={retryAction}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              Thử lại
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Đóng thông báo"
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface/50 transition-colors cursor-pointer"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {technicalDetails && (
        <div className="pt-2 border-t border-border/50">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="text-[11px] font-semibold text-ink-muted hover:text-ink inline-flex items-center gap-1 cursor-pointer"
          >
            {showDetails ? (
              <ChevronUpIcon className="w-3.5 h-3.5" />
            ) : (
              <ChevronDownIcon className="w-3.5 h-3.5" />
            )}
            {showDetails ? 'Thu gọn chi tiết kỹ thuật' : 'Xem chi tiết kỹ thuật'}
          </button>
          {showDetails && (
            <pre className="mt-2 p-2.5 rounded-xl bg-surface text-[10px] text-ink-muted font-mono overflow-x-auto max-h-36 border border-border">
              {technicalDetails}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
