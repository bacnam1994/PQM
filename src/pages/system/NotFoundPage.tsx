import React from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-2 p-6">
      <div className="text-center max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Icon */}
        <div className="relative inline-flex items-center justify-center w-28 h-28 mb-8">
          <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping opacity-20" />
          <div className="relative w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
            <MagnifyingGlassIcon className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        {/* Error code */}
        <p className="text-8xl font-black text-surface-3/50 select-none mb-0 leading-none">404</p>

        {/* Title */}
        <h1 className="text-2xl font-extrabold text-ink mt-2 mb-3">
          Không tìm thấy trang
        </h1>

        {/* Subtitle */}
        <p className="text-ink-muted text-sm mb-8 leading-relaxed">
          Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
          <br />
          Hãy kiểm tra lại đường dẫn hoặc quay về trang chủ.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-6 py-3 bg-surface text-ink rounded-xl border border-border font-bold text-sm hover:bg-surface-2 transition-all shadow-sm w-full sm:w-auto"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Quay lại
          </button>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 w-full sm:w-auto"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
