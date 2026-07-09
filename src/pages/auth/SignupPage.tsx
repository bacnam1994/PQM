import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Leaf, Lock, Mail, Loader2, AlertCircle, UserPlus } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] dark:bg-[#07130e] p-4 relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-emerald-100/50 dark:bg-emerald-950/20 rounded-full blur-[120px] -mr-[25vw] -mt-[25vw]" />
      <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-emerald-100/30 dark:bg-emerald-950/10 rounded-full blur-[100px] -ml-[20vw] -mb-[20vw]" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white dark:bg-zinc-950/80 rounded-[2.5rem] shadow-2xl shadow-emerald-900/5 dark:shadow-black/50 border border-white dark:border-zinc-800/40 p-10 backdrop-blur-md">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-[#009639] p-4 rounded-3xl text-white shadow-xl shadow-emerald-100 dark:shadow-none mb-6">
              <Leaf size={40} fill="currentColor" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 tracking-tight text-center">Đăng ký tài khoản</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm animate-in slide-in-from-top-2">
                <AlertCircle size={18} />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-zinc-500" size={18} />
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-zinc-900/50 border border-transparent dark:border-zinc-800/50 rounded-2xl font-semibold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner" 
                  placeholder="Email đăng ký" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-zinc-500" size={18} />
                <input 
                  type="password" 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-zinc-900/50 border border-transparent dark:border-zinc-800/50 rounded-2xl font-semibold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner" 
                  placeholder="Mật khẩu" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-zinc-500" size={18} />
                <input 
                  type="password" 
                  required 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-zinc-900/50 border border-transparent dark:border-zinc-800/50 rounded-2xl font-semibold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner" 
                  placeholder="Xác nhận mật khẩu" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full py-4 bg-[#009639] text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-xl shadow-emerald-200/50 dark:shadow-emerald-950/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
              {isSubmitting ? 'ĐANG TẠO...' : 'ĐĂNG KÝ NGAY'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Đã có tài khoản?{' '}
              <Link to="/login" className="font-bold text-[#009639] dark:text-emerald-400 hover:underline">Đăng nhập</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;