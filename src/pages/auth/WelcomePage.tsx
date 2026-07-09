import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ShieldAlert, Clock, LogOut, MessageCircle, Mail, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WelcomePage: React.FC = () => {
  const user = useAppStore(state => state.user);
  const logout = useAppStore(state => state.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-xl p-8 md:p-12 text-center space-y-8 relative overflow-hidden">
        {/* Background Decorative Blobs */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/5 dark:bg-indigo-500/2 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/5 dark:bg-emerald-500/2 rounded-full blur-3xl pointer-events-none"></div>

        {/* Animated Icon Container */}
        <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 bg-indigo-100 dark:bg-indigo-950/30 rounded-full animate-ping opacity-25"></div>
          <div className="relative w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
            <Clock size={36} className="animate-pulse" />
          </div>
        </div>

        {/* Title & Email */}
        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100">
            Tài khoản đang chờ phê duyệt
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-sm">
            Chào mừng bạn đến với hệ thống Quản lý Chất lượng <strong className="text-indigo-600 dark:text-indigo-400">V-Biotech PQM</strong>.
          </p>
          <div className="inline-flex px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs font-mono font-bold text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700/50">
            {user?.email}
          </div>
        </div>

        {/* Process Timeline */}
        <div className="max-w-md mx-auto bg-slate-50/50 dark:bg-slate-950/30 p-6 rounded-3xl border border-slate-100 dark:border-slate-850 space-y-4 text-left">
          <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-2">
            Trạng thái xử lý
          </h3>
          <div className="space-y-4">
            <div className="flex gap-3 items-start">
              <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                ✓
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Đăng ký tài khoản</p>
                <p className="text-[10px] text-slate-400">Đăng ký thông tin tài khoản thành công qua email.</p>
              </div>
            </div>
            
            <div className="flex gap-3 items-start">
              <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                <Clock size={10} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-850 dark:text-slate-100">Chờ Quản trị viên phê duyệt</p>
                <p className="text-[10px] text-slate-400">Yêu cầu cấp quyền của bạn đã được ghi nhận. Ban quản trị sẽ sớm duyệt tài khoản của bạn lên vai trò chính thức.</p>
              </div>
            </div>

            <div className="flex gap-3 items-start opacity-40">
              <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                3
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Truy cập hệ thống</p>
                <p className="text-[10px] text-slate-400">Đọc và theo dõi kết quả kiểm nghiệm, TCCS sản phẩm.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Support & Contact */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-center items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5"><Mail size={14} className="text-slate-450"/> support@v-biotech.com</span>
          <span className="hidden sm:inline text-slate-300">|</span>
          <span className="flex items-center gap-1.5"><MessageCircle size={14} className="text-slate-450"/> Nhóm IT vận hành hệ thống</span>
        </div>

        {/* Log Out */}
        <div className="pt-2">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 mx-auto px-6 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl font-bold text-xs transition-all uppercase tracking-wider border border-rose-100 dark:border-rose-900/30"
          >
            <LogOut size={14} /> Đăng xuất tài khoản
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
