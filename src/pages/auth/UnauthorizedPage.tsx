import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { 
  ShieldExclamationIcon, 
  ArrowRightOnRectangleIcon, 
  ArrowLeftIcon, 
  EnvelopeIcon 
} from '@heroicons/react/24/outline';

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
    <div className="min-h-screen flex items-center justify-center bg-surface-2 p-4 relative overflow-hidden transition-colors duration-300">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-rose-500/10 rounded-full blur-[120px] -mr-[25vw] -mt-[25vw]" />
      <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-emerald-500/10 rounded-full blur-[100px] -ml-[20vw] -mb-[20vw]" />

      <div className="w-full max-w-lg relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-surface rounded-[2.5rem] shadow-2xl border border-border p-10 text-center">
          
          {/* Warning Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-rose-50 dark:bg-rose-950/50 p-5 rounded-3xl text-rose-500 shadow-xl shadow-rose-500/10 animate-bounce duration-1000">
              <ShieldExclamationIcon className="w-12 h-12" />
            </div>
          </div>

          <h1 className="text-2xl font-black text-ink tracking-tight">TRUY CẬP BỊ TỪ CHỐI</h1>
          <p className="text-ink-muted text-xs font-bold uppercase tracking-widest mt-2">V-BIOTECH QMS</p>

          <div className="my-8 py-5 px-6 bg-surface-2 rounded-2xl border border-border text-left space-y-3">
            <p className="text-ink-muted text-sm font-medium leading-relaxed">
              Tài khoản của bạn hiện <strong className="text-rose-600 dark:text-rose-400">chưa được cấp quyền</strong> truy cập vào hệ thống. Chỉ các tài khoản có vai trò <strong>Quản trị viên (Admin)</strong> mới có thể xem thông tin.
            </p>
            {user && (
              <div className="flex items-center gap-2 text-xs text-ink-muted font-mono mt-4 pt-4 border-t border-border">
                <EnvelopeIcon className="w-3.5 h-3.5" />
                <span>{user.email}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/login')}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-surface-2 hover:bg-surface border border-border text-ink rounded-2xl font-bold text-xs uppercase tracking-wider transition-all"
            >
              <ArrowLeftIcon className="w-4 h-4" /> Quay lại đăng nhập
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-rose-500/20 transition-all"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" /> Đăng xuất tài khoản
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
