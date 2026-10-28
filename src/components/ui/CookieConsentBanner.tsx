import React, { useState, useEffect } from 'react';
import {
  ShieldCheckIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import {
  getConsentStatus,
  acceptConsent,
  declineConsent,
  type ConsentStatus,
} from '../../hooks/useCookieConsent';

interface CookieConsentBannerProps {
  onConsent?: (status: 'ACCEPTED' | 'DECLINED') => void;
}

const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({ onConsent }) => {
  const [status, setStatus] = useState<ConsentStatus>('PENDING');
  const [showDetails, setShowDetails] = useState(false);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const current = getConsentStatus();
    setStatus(current);
    if (current === 'PENDING') {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = (chosenStatus: 'ACCEPTED' | 'DECLINED') => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setStatus(chosenStatus);
      onConsent?.(chosenStatus);
    }, 400);
  };

  const handleAccept = () => {
    acceptConsent();
    dismiss('ACCEPTED');
  };

  const handleDecline = () => {
    declineConsent();
    dismiss('DECLINED');
  };

  if (status !== 'PENDING' || !visible) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-[9999] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 transition-all duration-500 ${
        exiting
          ? 'opacity-0 translate-y-8 pointer-events-none'
          : 'opacity-100 translate-y-0'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Thông báo Cookie"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface/95 dark:bg-surface/95 shadow-2xl backdrop-blur-xl">
        {/* Decorative gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10 pointer-events-none" />

        <div className="relative p-5">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl ring-1 ring-inset ring-emerald-600/20">
              <InformationCircleIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-ink text-base">
                  Ứng dụng sử dụng Cookie
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-full ring-1 ring-inset ring-emerald-600/20">
                  Cá nhân hóa
                </span>
              </div>
              <p className="text-ink-faint text-xs sm:text-sm mt-1 leading-relaxed">
                Chúng tôi dùng cookie và bộ nhớ cục bộ để lưu trữ thói quen sử dụng của bạn,
                giúp trải nghiệm cá nhân hóa hơn (chế độ xem, bộ lọc, lịch sử tìm kiếm, v.v.)
              </p>
            </div>
            <button
              type="button"
              onClick={handleDecline}
              className="flex-shrink-0 p-1 text-ink-faint hover:text-ink hover:bg-surface-2 transition-colors rounded-lg"
              aria-label="Từ chối và đóng"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Details toggle */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors ml-[54px] font-medium"
          >
            <ShieldCheckIcon className="w-3.5 h-3.5" />
            Xem chi tiết dữ liệu được lưu
            {showDetails ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
          </button>

          {showDetails && (
            <div className="mt-3 ml-[54px] p-3 bg-surface-2 rounded-xl border border-border text-xs text-ink-soft space-y-1.5 animate-in slide-in-from-top-2 duration-200">
              {[
                { label: 'Chế độ xem (lưới/danh sách)', icon: '📋' },
                { label: 'Định dạng số và ngày tháng', icon: '🔢' },
                { label: 'Bộ lọc & sắp xếp mặc định', icon: '🔍' },
                { label: 'Số dòng hiển thị trên mỗi trang', icon: '📄' },
                { label: 'Lịch sử tìm kiếm (tối đa 10 mục)', icon: '🕐' },
                { label: 'Trạng thái sidebar (thu gọn/mở rộng)', icon: '◀️' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>
                    {item.icon} {item.label}
                  </span>
                </div>
              ))}
              <p className="text-ink-faint pt-1 border-t border-border/60">
                Không có dữ liệu nào được gửi ra bên ngoài. Tất cả chỉ lưu trên trình duyệt của bạn.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex items-center gap-3 justify-end ml-[54px]">
            <button
              type="button"
              onClick={handleDecline}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-ink-soft hover:text-ink transition-colors rounded-xl hover:bg-surface-2 border border-border"
            >
              Từ chối
            </button>
            <button
              type="button"
              onClick={handleAccept}
              id="cookie-accept-btn"
              className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs"
            >
              ✓ Chấp nhận tất cả
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsentBanner;

