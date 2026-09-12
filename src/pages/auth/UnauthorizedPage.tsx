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
    <div className="min-h-screen flex items-center justify-center bg-surface-2 p-4 transition-colors duration-200">
      <div className="w-full max-w-md relative z-10 animate-in fade-in duration-200">
        <div className="bg-surface rounded-2xl shadow-xs border border-border p-6 sm:p-8 text-center">
          
          {/* Warning Icon */}
          <div className="flex justify-center mb-4">
            <div className="bg-rose-500/10 p-3 rounded-xl text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <ShieldExclamationIcon className="w-8 h-8" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-ink tracking-tight">Truy cập bị từ chối</h1>
          <p className="text-ink-muted text-xs font-medium mt-1">V-BIOTECH QMS</p>

          <div className="my-6 py-4 px-4 bg-surface-2/60 rounded-xl border border-border text-left space-y-2">
            <p className="text-ink-muted text-xs font-normal leading-relaxed">
              Tài khoản của bạn hiện <strong className="text-rose-600 dark:text-rose-400 font-medium">chưa được cấp quyền</strong> truy cập vào hệ thống. Vui lòng liên hệ với Quản trị viên (Admin) để được cấp phát quyền hạn phù hợp.
            </p>
            {user && (
              <div className="flex items-center gap-2 text-xs text-ink-muted font-mono pt-3 border-t border-border">
                <EnvelopeIcon className="w-3.5 h-3.5" />
                <span>{user.email}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              onClick={() => navigate('/login')}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-surface hover:bg-surface-2 border border-border text-ink rounded-lg font-medium text-xs transition-colors active:scale-[0.98]"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" /> Quay lại đăng nhập
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-xs shadow-xs transition-all active:scale-[0.98]"
            >
              <ArrowRightOnRectangleIcon className="w-3.5 h-3.5" /> Đăng xuất tài khoản
            </button>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-ink-muted">
              Cần hỗ trợ? Liên hệ qua kênh nội bộ Phòng Đảm bảo Chất lượng.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
