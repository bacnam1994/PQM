/**
 * PQM 3.0 - Electronic Signature Modal (FDA 21 CFR Part 11 Compliant)
 * Modal ký duyệt điện tử có xác thực mật khẩu hai yếu tố và ghi nhận ý nghĩa pháp lý
 */

import React, { useState } from 'react';
import {
  ShieldCheckIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  XMarkIcon,
  DocumentTextIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import {
  SignatureDocumentType,
  SIGNATURE_MEANINGS,
  ElectronicSignature,
} from '../../types/signature';
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
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [copiedCorrelationId, setCopiedCorrelationId] = useState(false);

  // Idempotent Correlation ID: Giữ cố định trong suốt phiên mở modal này để tránh tạo trùng chữ ký khi retry sau lỗi mạng
  const [activeCorrelationId] = useState<string>(() => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 9);
    return `SIG-${dateStr}-${rand}`;
  });

  interface ErrorDetails {
    message: string;
    code?: string;
    correlationId?: string;
    isNetworkError?: boolean;
    apiUrl?: string;
  }
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);

  if (!isOpen) return null;

  const meaningText = customMeaning || SIGNATURE_MEANINGS[documentType];

  const handleCheckBackendHealth = async () => {
    setIsCheckingHealth(true);
    setHealthStatus(null);
    try {
      const res = await signatureService.checkBackendHealth(7000);
      if (res.healthy) {
        setHealthStatus(
          `✅ Máy chủ đang hoạt động (${res.service || 'backend'} v${res.version || '1.0.0'}) tại ${res.apiUrl}`
        );
      } else {
        setHealthStatus(
          `❌ Không kết nối được: ${res.error || 'Máy chủ không phản hồi'} (URL: ${res.apiUrl})`
        );
      }
    } catch (e: any) {
      setHealthStatus(`❌ Kiểm tra thất bại: ${e.message}`);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleCopyCorrelationId = (id: string) => {
    navigator.clipboard?.writeText(id);
    setCopiedCorrelationId(true);
    setTimeout(() => setCopiedCorrelationId(false), 2000);
  };

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorDetails({
        message: 'Vui lòng nhập mật khẩu tài khoản để hoàn tất xác thực ký điện tử.',
      });
      return;
    }

    setIsSubmitting(true);
    setErrorDetails(null);
    setHealthStatus(null);

    try {
      const userWithRole = user ? { ...user, role } : null;
      const signature = await signatureService.createElectronicSignature(userWithRole, {
        documentType,
        documentId,
        documentVersion,
        meaning: meaningText,
        password,
        comments: comments.trim() || undefined,
        correlationId: activeCorrelationId,
      });

      notify({
        type: 'SUCCESS',
        title: 'Ký duyệt thành công',
        message: `Đã ghi nhận chữ ký điện tử hợp lệ của ${signature.signerEmail}`,
      });

      await onSuccess(signature);
      onClose();
    } catch (err: any) {
      setErrorDetails({
        message: err.message || 'Xác thực ký điện tử thất bại.',
        code: err.code,
        correlationId: err.correlationId || activeCorrelationId,
        isNetworkError: Boolean(
          err.isNetworkError ||
          err.name === 'SignatureNetworkError' ||
          err.message?.includes('Không thể kết nối') ||
          err.message?.includes('Failed to fetch')
        ),
        apiUrl: err.apiUrl,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-surface-2 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <ShieldCheckIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight text-ink">
                Chữ Ký Điện Tử (E-Signature)
              </h3>
              <p className="text-xs text-ink-muted flex items-center gap-1 font-medium mt-0.5">
                <span>Chuẩn 21 CFR Part 11 &amp; GMP-WHO</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-ink-muted hover:text-ink p-1.5 rounded-xl hover:bg-surface-3 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSign} className="p-6 space-y-4 text-ink text-sm bg-surface">
          {/* Thông tin tài liệu */}
          <div className="bg-surface-2 p-3.5 rounded-xl border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                Hồ sơ đối chiếu:
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                {documentType}
              </span>
            </div>
            <div className="flex items-center gap-2 font-medium text-ink">
              <DocumentTextIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="truncate">{documentTitle || `Mã: ${documentId}`}</span>
              {documentVersion != null && (
                <span className="text-xs text-ink-muted font-mono">v{documentVersion}</span>
              )}
            </div>
          </div>

          {/* Người ký & Quyền hạn */}
          <div className="bg-surface-2 p-3.5 rounded-xl border border-border flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
              <UserCircleIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-ink truncate">
                {user?.displayName || user?.email || 'Người dùng'}
              </div>
              <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5">
                <span>{user?.email}</span>
                <span>•</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                  {role || 'QA'}
                </span>
              </div>
            </div>
          </div>

          {/* Cam kết ý nghĩa chữ ký pháp lý */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
            <div className="font-bold mb-1 flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
              <ExclamationCircleIcon className="w-4 h-4" />
              <span>Cam kết ý nghĩa pháp lý chữ ký:</span>
            </div>
            <p className="italic">{meaningText}</p>
          </div>

          {/* Nhập mật khẩu xác thực lại */}
          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1.5">
              Xác thực lại Mật khẩu đăng nhập (Re-authentication){' '}
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu của bạn để ký..."
                disabled={isSubmitting}
                className="w-full pl-9 pr-10 py-2.5 bg-surface border border-border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm text-ink transition-all"
                autoFocus
              />
              <LockClosedIcon className="w-4 h-4 text-ink-muted absolute left-3 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-ink-muted hover:text-ink"
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-4 h-4" />
                ) : (
                  <EyeIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Ghi chú / Ý kiến bổ sung */}
          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1.5">
              Ghi chú / Ý kiến bổ sung (Tùy chọn)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Nhập ý kiến soát xét hoặc lưu ý chuyên môn..."
              rows={2}
              disabled={isSubmitting}
              className="w-full p-2.5 bg-surface border border-border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm text-ink transition-all resize-none"
            />
          </div>

          {/* Error Message Display */}
          {errorDetails && (
            <div
              className={`p-3.5 rounded-xl text-xs border space-y-2 ${
                errorDetails.isNetworkError
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
              }`}
            >
              <div className="flex items-start gap-2">
                <ExclamationCircleIcon
                  className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                    errorDetails.isNetworkError
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600'
                  }`}
                />
                <div className="flex-1 space-y-1">
                  <div className="font-bold">
                    {errorDetails.isNetworkError
                      ? 'Lỗi kết nối Máy chủ Ký duyệt (Backend Authority)'
                      : errorDetails.code
                        ? `[${errorDetails.code}] Lỗi xác thực chữ ký`
                        : 'Xác thực ký điện tử thất bại'}
                  </div>
                  <p className="leading-relaxed">{errorDetails.message}</p>
                </div>
              </div>

              {/* Correlation ID & Copy Action */}
              {errorDetails.correlationId && (
                <div className="pt-2 border-t border-current/10 flex items-center justify-between text-[11px]">
                  <span className="font-medium opacity-80">
                    Mã đối chiếu:{' '}
                    <code className="font-mono font-bold">{errorDetails.correlationId}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCorrelationId(errorDetails.correlationId!)}
                    className="px-2 py-0.5 rounded bg-surface/50 hover:bg-surface border border-current/20 font-semibold transition-colors"
                  >
                    {copiedCorrelationId ? 'Đã sao chép!' : 'Sao chép mã'}
                  </button>
                </div>
              )}

              {/* Health check action for network errors */}
              {errorDetails.isNetworkError && (
                <div className="pt-1.5 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCheckBackendHealth}
                      disabled={isCheckingHealth}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      {isCheckingHealth ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Đang kiểm tra máy chủ...</span>
                        </>
                      ) : (
                        <span>Kiểm tra trạng thái Máy chủ Ký duyệt</span>
                      )}
                    </button>
                    <span className="text-[10px] opacity-75 italic">
                      (Không tự động gửi lại để bảo đảm toàn vẹn)
                    </span>
                  </div>
                  {healthStatus && (
                    <div className="p-2 rounded bg-surface border border-current/10 font-mono text-[10px] break-all">
                      {healthStatus}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-ink-muted hover:text-ink bg-surface border border-border hover:bg-surface-3 rounded-xl transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang thẩm định &amp; Ký...</span>
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-4 h-4 text-emerald-100" />
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

export default ESignatureModal;
