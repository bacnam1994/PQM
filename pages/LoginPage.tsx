
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Leaf, Lock, Mail, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { user, login, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError('Email hoặc mật khẩu không chính xác. Vui lòng thử lại.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-emerald-100/50 rounded-full blur-[120px] -mr-[25vw] -mt-[25vw]" />
      <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-emerald-100/30 rounded-full blur-[100px] -ml-[20vw] -mb-[20vw]" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-emerald-900/5 border border-white p-10">
          <div className="flex flex-col items-center mb-10">
            <div className="bg-[#009639] p-4 rounded-3xl text-white shadow-xl shadow-emerald-100 mb-6">
              <Leaf size={40} fill="currentColor" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight text-center">V-BIOTECH QMS</h1>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mt-2">Hệ thống quản lý chất lượng</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm animate-in slide-in-from-top-2">
                <AlertCircle size={18} />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Tài khoản Email</label>
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner" 
                  placeholder="name@v-biotech.vn"
                />
              </div>
              <div className="text-right pr-2">
                <Link to="/forgot-password" className="text-[11px] font-bold text-indigo-600 hover:underline">Quên mật khẩu?</Link>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner" 
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-4 bg-[#009639] text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-xl shadow-emerald-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
              {isSubmitting ? 'ĐANG XỬ LÝ...' : 'ĐĂNG NHẬP HỆ THỐNG'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500 font-medium">
              Chưa có tài khoản?{' '}
              <Link to="/signup" className="font-bold text-[#009639] hover:underline">Đăng ký ngay</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
