import React from 'react';
import { Link } from 'react-router-dom';
import { SearchX, ArrowLeft } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] dark:bg-slate-900 p-6">
      <div className="text-center max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Icon */}
        <div className="relative inline-flex items-center justify-center w-28 h-28 mb-8">
          <div className="absolute inset-0 rounded-full bg-indigo-50 dark:bg-indigo-900/30 animate-ping opacity-20" />
          <div className="relative w-24 h-24 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
            <SearchX size={40} className="text-indigo-400 dark:text-indigo-300" />
          </div>
        </div>

        {/* Error code */}
        <p className="text-8xl font-black text-slate-100 dark:text-slate-800 select-none mb-0 leading-none">404</p>

        {/* Title */}
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-2 mb-3">
          Không tìm thấy trang
        </h1>

        {/* Subtitle */}
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
          Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
          <br />
          Hãy kiểm tra lại đường dẫn hoặc quay về trang chủ.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm w-full sm:w-auto"
          >
            <ArrowLeft size={16} />
            Quay lại
          </button>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 w-full sm:w-auto"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
