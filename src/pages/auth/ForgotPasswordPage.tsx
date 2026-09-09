import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Link } from 'react-router-dom';
import { 
  EnvelopeIcon, 
  ArrowPathIcon, 
  ExclamationCircleIcon, 
  CheckCircleIcon, 
  ArrowLeftIcon 
} from '@heroicons/react/24/outline';

const LeafIcon = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
);

const ForgotPasswordPage: React.FC = () => {
  const resetPassword = useAppStore(state => state.resetPassword);
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
      setMessage('Đã gửi email hướng dẫn đặt lại mật khẩu. Vui lòng kiểm tra hộp thư đến (hoặc thư rác).');
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
    <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] dark:bg-[#07130e] p-4 relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-emerald-100/50 dark:bg-emerald-950/20 rounded-full blur-[120px] -mr-[25vw] -mt-[25vw]" />
      <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-emerald-100/30 dark:bg-emerald-950/10 rounded-full blur-[100px] -ml-[20vw] -mb-[20vw]" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white dark:bg-zinc-950/80 rounded-[2.5rem] shadow-2xl shadow-emerald-900/5 dark:shadow-black/50 border border-white dark:border-zinc-800/40 p-10 backdrop-blur-md">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-emerald-600 p-4 rounded-3xl text-white shadow-xl shadow-emerald-500/20 mb-6">
              <LeafIcon className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 tracking-tight text-center">Khôi phục tài khoản</h1>
            <p className="text-slate-400 dark:text-zinc-400 text-sm font-medium mt-2 text-center">Nhập email để nhận hướng dẫn đặt lại mật khẩu</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-sm animate-in slide-in-from-top-2">
                <ExclamationCircleIcon className="w-5 h-5 shrink-0" />
                <span className="font-semibold">{error}</span>
              </div>
            )}
            {message && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl flex items-center gap-3 text-emerald-700 dark:text-emerald-400 text-sm animate-in slide-in-from-top-2">
                <CheckCircleIcon className="w-5 h-5 shrink-0" />
                <span className="font-semibold">{message}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="relative">
                <EnvelopeIcon className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-zinc-500" />
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-zinc-900/50 border border-transparent dark:border-zinc-800/50 rounded-2xl font-semibold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner" 
                  placeholder="Nhập email của bạn" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
            >
              {isSubmitting ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <EnvelopeIcon className="w-5 h-5" />}
              {isSubmitting ? 'ĐANG GỬI...' : 'GỬI YÊU CẦU'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              <ArrowLeftIcon className="w-4 h-4" /> Quay lại Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;