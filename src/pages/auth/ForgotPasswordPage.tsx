import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Link } from 'react-router-dom';
import {
  EnvelopeIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const ForgotPasswordPage: React.FC = () => {
  const resetPassword = useAppStore((state) => state.resetPassword);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);
    try {
      await resetPassword(email);
      setMessage(
        'Đã gửi email hướng dẫn đặt lại mật khẩu. Vui lòng kiểm tra hộp thư đến (hoặc thư rác).'
      );
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('Email này chưa được đăng ký trong hệ thống.');
      } else {
        setError('Không thể gửi yêu cầu. Vui lòng thử lại sau.');
      }
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-2 p-4 relative transition-colors duration-200">
      <div className="w-full max-w-sm relative z-10 animate-in fade-in duration-200">
        <div className="bg-surface/95 backdrop-blur-xl rounded-2xl shadow-lg border border-border/80 p-6 sm:p-8">
          <div className="flex flex-col items-center mb-6">
            <img
              src="/logo.png"
              alt="V-Biotech"
              className="h-16 w-auto object-contain mb-3 drop-shadow-xs select-none"
            />
            <h1 className="text-xl font-bold text-ink tracking-tight text-center font-display">
              Khôi phục tài khoản
            </h1>
            <p className="text-ink-muted text-xs font-medium mt-1 text-center">
              Nhập email để nhận hướng dẫn đặt lại mật khẩu
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-rose-600 dark:text-rose-400 text-xs animate-in slide-in-from-top-1">
                <ExclamationCircleIcon className="w-4 h-4 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}
            {message && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400 text-xs animate-in slide-in-from-top-1">
                <CheckCircleIcon className="w-4 h-4 shrink-0" />
                <span className="font-medium">{message}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-muted pl-1">Email của bạn</label>
              <div className="relative">
                <EnvelopeIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-surface border border-border rounded-xl font-medium text-sm text-ink outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all shadow-2xs"
                  placeholder="Nhập email của bạn"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              {isSubmitting ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <EnvelopeIcon className="w-4 h-4" />
              )}
              {isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-border text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" /> Quay lại Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
