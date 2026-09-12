import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { 
  LockClosedIcon, 
  EnvelopeIcon, 
  ArrowPathIcon, 
  ExclamationCircleIcon, 
  UserPlusIcon 
} from '@heroicons/react/24/outline';

const LeafIcon = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
);

const SignupPage: React.FC = () => {
  const user = useAppStore(state => state.user);
  const signup = useAppStore(state => state.signup);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setError('Mật khẩu xác nhận không khớp.');
    }
    setError('');
    setIsSubmitting(true);
    try {
      await signup(email, password);
      navigate('/');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Email này đã được sử dụng.');
      } else if (err.code === 'auth/weak-password') {
        setError('Mật khẩu quá yếu (tối thiểu 6 ký tự).');
      } else {
        setError('Không thể tạo tài khoản. Vui lòng thử lại.');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-2 p-4 relative transition-colors duration-200">
      <div className="w-full max-w-sm relative z-10 animate-in fade-in duration-200">
        <div className="bg-surface rounded-2xl shadow-xs border border-border p-6 sm:p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-emerald-600 p-2.5 rounded-xl text-white shadow-xs mb-3">
              <LeafIcon className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-ink tracking-tight text-center">Đăng ký tài khoản</h1>
            <p className="text-ink-muted text-xs font-medium mt-1">Hệ thống Quản lý Chất lượng V-Biotech</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-rose-600 dark:text-rose-400 text-xs animate-in slide-in-from-top-1">
                <ExclamationCircleIcon className="w-4 h-4 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-muted pl-1">Email đăng ký</label>
              <div className="relative">
                <EnvelopeIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full pl-10 pr-3.5 py-2.5 bg-surface border border-border rounded-xl font-medium text-sm text-ink outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all shadow-2xs" 
                  placeholder="name@v-biotech.vn" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-muted pl-1">Mật khẩu</label>
              <div className="relative">
                <LockClosedIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input 
                  type="password" 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full pl-10 pr-3.5 py-2.5 bg-surface border border-border rounded-xl font-medium text-sm text-ink outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all shadow-2xs" 
                  placeholder="Tối thiểu 6 ký tự" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-muted pl-1">Xác nhận mật khẩu</label>
              <div className="relative">
                <LockClosedIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input 
                  type="password" 
                  required 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  className="w-full pl-10 pr-3.5 py-2.5 bg-surface border border-border rounded-xl font-medium text-sm text-ink outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all shadow-2xs" 
                  placeholder="Nhập lại mật khẩu" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <UserPlusIcon className="w-4 h-4" />}
              {isSubmitting ? 'Đang tạo tài khoản...' : 'Đăng ký ngay'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-border text-center">
            <p className="text-xs text-ink-muted font-normal">
              Đã có tài khoản?{' '}
              <Link to="/login" className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline">Đăng nhập</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;