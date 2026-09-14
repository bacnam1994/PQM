import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  ShieldCheckIcon,
  BookmarkSquareIcon,
  ArrowPathIcon,
  UserIcon,
  UserCircleIcon,
  EnvelopeIcon,
  LockClosedIcon,
  CameraIcon,
} from '@heroicons/react/24/outline';
import { PageHeader } from '../../components/ui';
import { DSFormInput } from '../../components/ui/DesignSystem';
import toast from 'react-hot-toast';
import { userService } from '../../services/userService';

const AccountPage: React.FC = () => {
  const user = useAppStore((state) => state.user);
  const role = useAppStore((state) => state.role);
  const changePassword = useAppStore((state) => state.changePassword);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Đổi mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error(error);
      const fbError = error as any;
      if (fbError?.code === 'auth/wrong-password' || fbError?.code === 'auth/invalid-credential') {
        toast.error('Mật khẩu hiện tại không đúng.');
      } else if (fbError?.code === 'auth/requires-recent-login') {
        toast.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại để đổi mật khẩu.');
      } else {
        toast.error('Đã có lỗi xảy ra. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile || !user) return;
    setUploadingAvatar(true);
    try {
      await userService.uploadUserAvatar(user, avatarFile);
      toast.success('Cập nhật ảnh đại diện thành công!');
      setAvatarFile(null);
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi tải ảnh lên. Vui lòng thử lại.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Quản lý tài khoản"
        subtitle="Thông tin cá nhân và bảo mật."
        icon={UserIcon}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section: Thông tin tài khoản */}
        <section className="bg-surface p-6 rounded-2xl border border-border shadow-sm space-y-4 h-fit">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <ShieldCheckIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-ink">Thông tin tài khoản</h3>
            </div>
          </div>

          <div className="space-y-4">
            {/* Avatar Upload Section */}
            <div className="flex flex-col items-center justify-center py-4 border-b border-border mb-4">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-surface-2 border-4 border-surface shadow-lg overflow-hidden flex items-center justify-center">
                  {avatarPreview || user?.photoURL ? (
                    <img
                      src={avatarPreview || user?.photoURL || ''}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserCircleIcon className="w-16 h-16 text-ink-muted/50" />
                  )}
                </div>
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 p-2 bg-emerald-600 text-white rounded-full shadow-md cursor-pointer hover:bg-emerald-700 transition-all hover:scale-110 active:scale-95"
                >
                  <CameraIcon className="w-3.5 h-3.5" />
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
              {avatarFile && (
                <button
                  onClick={handleUploadAvatar}
                  disabled={uploadingAvatar}
                  className="mt-3 px-4 py-1.5 bg-emerald-600 text-white text-[10px] font-bold uppercase rounded-lg shadow-md hover:bg-emerald-700 transition-all flex items-center gap-2"
                >
                  {uploadingAvatar ? (
                    <ArrowPathIcon className="w-3 h-3 animate-spin" />
                  ) : (
                    <BookmarkSquareIcon className="w-3 h-3" />
                  )}
                  {uploadingAvatar ? 'Đang tải...' : 'Lưu ảnh'}
                </button>
              )}
            </div>

            <div className="p-4 bg-surface-2 rounded-xl border border-border flex items-center gap-4">
              <div className="p-3 bg-surface rounded-full text-ink-muted shadow-sm">
                <EnvelopeIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-ink-muted font-bold uppercase tracking-wider mb-0.5">
                  Email đăng nhập
                </p>
                <p className="text-ink font-bold text-lg">{user?.email}</p>
              </div>
            </div>

            <div className="p-4 bg-surface-2 rounded-xl border border-border flex items-center gap-4">
              <div className="p-3 bg-surface rounded-full text-ink-muted shadow-sm">
                <ShieldCheckIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-ink-muted font-bold uppercase tracking-wider mb-0.5">
                  Vai trò hệ thống
                </p>
                <span
                  className={`inline-flex px-3 py-1 rounded-lg text-xs font-black uppercase ${role === 'ADMIN' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-surface-2 text-ink-muted border border-border'}`}
                >
                  {role}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Đổi mật khẩu */}
        <section className="bg-surface p-6 rounded-2xl border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <LockClosedIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-ink">Bảo mật & Mật khẩu</h3>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <DSFormInput
              label="Mật khẩu hiện tại"
              type="password"
              required
              value={currentPassword}
              onChange={(e: any) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />

            <div className="grid grid-cols-2 gap-4">
              <DSFormInput
                label="Mật khẩu mới"
                type="password"
                required
                value={newPassword}
                onChange={(e: any) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
              <DSFormInput
                label="Xác nhận mới"
                type="password"
                required
                value={confirmPassword}
                onChange={(e: any) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={loading || !currentPassword || !newPassword}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-[10px] tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-emerald-500/20"
              >
                {loading ? (
                  <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <BookmarkSquareIcon className="w-3.5 h-3.5" />
                )}
                {loading ? 'Đang xử lý...' : 'Cập nhật mật khẩu'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default AccountPage;
