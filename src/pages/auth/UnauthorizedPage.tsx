import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { ShieldAlert, LogOut, ArrowLeft, Mail } from 'lucide-react';

const UnauthorizedPage: React.FC = () => {
  const user = useAppStore(state => state.user);
  const logout = useAppStore(state => state.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Lỗi khi đăng xuất:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] dark:bg-slate-900 p-4 relative overflow-hidden transition-colors duration-300">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-red-100/50 dark:bg-red-950/20 rounded-full blur-[120px] -mr-[25vw] -mt-[25vw]" />
      <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-indigo-100/30 dark:bg-indigo-950/10 rounded-full blur-[100px] -ml-[20vw] -mb-[20vw]" />

      <div className="w-full max-w-lg relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl shadow-slate-900/5 border border-white dark:border-slate-700/50 p-10 text-center">
          
          {/* Warning Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-red-50 dark:bg-red-950/50 p-5 rounded-3xl text-red-500 dark:text-red-400 shadow-xl shadow-red-100 dark:shadow-none animate-bounce duration-1000">
              <ShieldAlert size={48} />
            </div>
          </div>

          <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">TRUY CẬP BỊ TỪ CHỐI</h1>
          <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">V-BIOTECH QMS</p>

          <div className="my-8 py-5 px-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-left space-y-3">
            <p className="text-slate-600 dark:text-slate-300 text-sm font-medium leading-relaxed">
              Tài khoản của bạn hiện <strong className="text-red-500 dark:text-red-400">chưa được cấp quyền</strong> truy cập vào hệ thống. Chỉ các tài khoản có vai trò <strong>Quản trị viên (Admin)</strong> mới có thể xem thông tin.
            </p>
            {user && (
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 font-mono mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Mail size={14} />
                <span>{user.email}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/login')}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all"
            >
              <ArrowLeft size={16} /> Quay lại đăng nhập
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-200 dark:shadow-none transition-all"
            >
              <LogOut size={16} /> Đăng xuất tài khoản
            </button>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Vui lòng liên hệ với Quản trị viên hệ thống để yêu cầu phân quyền.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
