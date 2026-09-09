/**
 * PQM 3.0 - Electronic Signature Modal (FDA 21 CFR Part 11 Compliant)
 * Modal ký duyệt điện tử có xác thực mật khẩu hai yếu tố và ghi nhận ý nghĩa pháp lý
 */

import React, { useState } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, CheckCircle, X, FileText, UserCheck } from 'lucide-react';
import { SignatureDocumentType, SIGNATURE_MEANINGS, ElectronicSignature } from '../../types/signature';
import { signatureService } from '../../services/signatureService';
import { useAppStore } from '../../store/useAppStore';

interface ESignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: SignatureDocumentType;
  documentId: string;
  documentTitle?: string;
  documentVersion?: number;
  customMeaning?: string;
  onSuccess: (signature: ElectronicSignature) => void | Promise<void>;
}

export const ESignatureModal: React.FC<ESignatureModalProps> = ({
  isOpen,
  onClose,
  documentType,
  documentId,
  documentTitle,
  documentVersion,
  customMeaning,
  onSuccess,
}) => {
  const { user, role, notify } = useAppStore();
  const [password, setPassword] = useState('');
  const [comments, setComments] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const meaningText = customMeaning || SIGNATURE_MEANINGS[documentType];

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg('Vui lòng nhập mật khẩu tài khoản để hoàn tất xác thực ký điện tử.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const userWithRole = user ? { ...user, role } : null;
      const signature = await signatureService.createElectronicSignature(userWithRole, {
        documentType,
        documentId,
        documentVersion,
        meaning: meaningText,
        password,
        comments: comments.trim() || undefined,
      });

      notify({
        type: 'SUCCESS',
        title: 'Ký duyệt thành công',
        message: `Đã ghi nhận chữ ký điện tử hợp lệ của ${signature.signerEmail}`,
      });

      await onSuccess(signature);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Xác thực ký điện tử thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
              <ShieldCheck className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Chữ Ký Điện Tử (E-Signature)</h3>
              <p className="text-xs text-blue-100 flex items-center gap-1 font-medium">
                <span>Chuẩn 21 CFR Part 11 & GMP-WHO</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSign} className="p-6 space-y-4 text-slate-700 dark:text-slate-200 text-sm">
          {/* Thông tin tài liệu */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hồ sơ đối chiếu:</span>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                {documentType}
              </span>
            </div>
            <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
              <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="truncate">{documentTitle || `Mã: ${documentId}`}</span>
              {documentVersion != null && (
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">v{documentVersion}</span>
              )}
            </div>
          </div>

          {/* Người ký & Quyền hạn */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-full text-indigo-600 dark:text-indigo-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-900 dark:text-white truncate">
                {user?.displayName || user?.email || 'Người dùng'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>{user?.email}</span>
                <span>•</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase">{role || 'QA'}</span>
              </div>
            </div>
          </div>

          {/* Cam kết ý nghĩa chữ ký pháp lý */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
            <div className="font-bold mb-1 flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Cam kết ý nghĩa pháp lý chữ ký:</span>
            </div>
            <p className="italic">{meaningText}</p>
          </div>

          {/* Nhập mật khẩu xác thực lại */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Xác thực lại Mật khẩu đăng nhập (Re-authentication) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu của bạn để ký..."
                disabled={isSubmitting}
                className="w-full pl-9 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm transition-all"
                autoFocus
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Ghi chú / Ý kiến bổ sung */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Ghi chú / Ý kiến bổ sung (Tùy chọn)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Nhập ý kiến soát xét hoặc lưu ý chuyên môn..."
              rows={2}
              disabled={isSubmitting}
              className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm transition-all resize-none"
            />
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang thẩm định & Ký...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-300" />
                  <span>Xác nhận Ký duyệt</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
