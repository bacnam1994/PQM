import React from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-2 p-6">
      <div className="text-center max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <MagnifyingGlassIcon className="w-8 h-8" />
        </div>

        {/* Error code */}
        <p className="text-6xl font-bold tracking-tight text-ink-muted/30 select-none mb-1 leading-none">404</p>

        {/* Title */}
        <h1 className="text-xl font-bold tracking-tight text-ink mt-2 mb-2">
          Không tìm thấy trang
        </h1>

        {/* Subtitle */}
        <p className="text-ink-muted text-xs mb-6 leading-relaxed">
          Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.
          <br />
          Vui lòng kiểm tra lại đường dẫn hoặc quay về trang chủ.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-surface text-ink rounded-lg border border-border font-medium text-xs hover:bg-surface-2 transition-all shadow-xs active:scale-[0.98] w-full sm:w-auto"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Quay lại
          </button>
          <Link
            to="/"
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs transition-all shadow-xs active:scale-[0.98] w-full sm:w-auto"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
