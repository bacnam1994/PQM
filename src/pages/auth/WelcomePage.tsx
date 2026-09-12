import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { 
  ClockIcon, 
  ArrowRightOnRectangleIcon, 
  ChatBubbleLeftRightIcon, 
  EnvelopeIcon 
} from '@heroicons/react/24/outline';
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
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-xs p-6 sm:p-8 text-center space-y-6">
        {/* Icon Container */}
        <div className="mx-auto w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <ClockIcon className="w-7 h-7" />
        </div>

        {/* Title & Email */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
            Tài khoản đang chờ phê duyệt
          </h1>
          <p className="text-ink-muted max-w-md mx-auto text-xs leading-relaxed">
            Chào mừng bạn đến với hệ thống Quản lý Chất lượng <strong className="text-emerald-600 dark:text-emerald-400 font-medium">V-Biotech PQM</strong>.
          </p>
          <div className="inline-flex px-3 py-1 bg-surface-2 rounded-lg text-xs font-mono font-medium text-ink-muted border border-border">
            {user?.email}
          </div>
        </div>

        {/* Process Timeline */}
        <div className="max-w-md mx-auto bg-surface-2/60 p-4 rounded-xl border border-border space-y-3 text-left">
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider pl-1">
            Trạng thái xử lý
          </h3>
          <div className="space-y-3">
            <div className="flex gap-2.5 items-start">
              <div className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                ✓
              </div>
              <div>
                <p className="text-xs font-medium text-ink">Đăng ký tài khoản</p>
                <p className="text-[11px] text-ink-muted">Đăng ký thông tin tài khoản thành công qua email.</p>
              </div>
            </div>
            
            <div className="flex gap-2.5 items-start">
              <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <ClockIcon className="w-2.5 h-2.5" />
              </div>
              <div>
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Chờ Quản trị viên phê duyệt</p>
                <p className="text-[11px] text-ink-muted">Yêu cầu cấp quyền đã được ghi nhận. Ban quản trị sẽ sớm duyệt tài khoản của bạn lên vai trò chính thức.</p>
              </div>
            </div>

            <div className="flex gap-2.5 items-start opacity-40">
              <div className="w-4 h-4 rounded-full bg-surface text-ink-muted border border-border flex items-center justify-center text-[9px] font-medium shrink-0 mt-0.5">
                3
              </div>
              <div>
                <p className="text-xs font-medium text-ink">Truy cập hệ thống</p>
                <p className="text-[11px] text-ink-muted">Sử dụng đầy đủ các tính năng hồ sơ lô, kiểm nghiệm và TCCS.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Support & Contact */}
        <div className="pt-3 border-t border-border flex flex-col sm:flex-row justify-center items-center gap-3 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5"><EnvelopeIcon className="w-3.5 h-3.5"/> support@v-biotech.com</span>
          <span className="hidden sm:inline text-border">|</span>
          <span className="flex items-center gap-1.5"><ChatBubbleLeftRightIcon className="w-3.5 h-3.5"/> Nhóm IT vận hành hệ thống</span>
        </div>

        {/* Log Out */}
        <div className="pt-1">
          <button 
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 rounded-lg font-medium text-xs transition-colors border border-rose-500/20 active:scale-[0.98]"
          >
            <ArrowRightOnRectangleIcon className="w-3.5 h-3.5" /> Đăng xuất tài khoản
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
