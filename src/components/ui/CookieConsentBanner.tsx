import React, { useState, useEffect } from 'react';
import { Cookie, X, Shield, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
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
      // Delay nhỏ để animation vào mượt hơn
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
      <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-slate-900/95 shadow-2xl backdrop-blur-xl">
        {/* Decorative gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-transparent to-purple-900/20 pointer-events-none" />

        <div className="relative p-5">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
              <Cookie className="text-indigo-400" size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">
                  Ứng dụng sử dụng Cookie
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                  Cá nhân hóa
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                Chúng tôi dùng cookie và bộ nhớ cục bộ để lưu trữ thói quen sử dụng của bạn,
                giúp trải nghiệm cá nhân hóa hơn (chế độ xem, bộ lọc, lịch sử tìm kiếm, v.v.)
              </p>
            </div>
            <button
              onClick={handleDecline}
              className="flex-shrink-0 p-1 text-slate-500 hover:text-slate-300 transition-colors rounded-lg"
              aria-label="Từ chối và đóng"
            >
              <X size={18} />
            </button>
          </div>

          {/* Details toggle */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="mt-3 flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors ml-[54px]"
          >
            <Shield size={12} />
            Xem chi tiết dữ liệu được lưu
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showDetails && (
            <div className="mt-3 ml-[54px] p-3 bg-white/5 rounded-xl border border-white/10 text-xs text-slate-400 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
              {[
                { label: 'Chế độ xem (lưới/danh sách)', icon: '📋' },
                { label: 'Định dạng số và ngày tháng', icon: '🔢' },
                { label: 'Bộ lọc & sắp xếp mặc định', icon: '🔍' },
                { label: 'Số dòng hiển thị trên mỗi trang', icon: '📄' },
                { label: 'Lịch sử tìm kiếm (tối đa 10 mục)', icon: '🕐' },
                { label: 'Trạng thái sidebar (thu gọn/mở rộng)', icon: '◀️' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <CheckCircle2 size={11} className="text-emerald-500 flex-shrink-0" />
                  <span>
                    {item.icon} {item.label}
                  </span>
                </div>
              ))}
              <p className="text-slate-500 pt-1 border-t border-white/10">
                Không có dữ liệu nào được gửi ra bên ngoài. Tất cả chỉ lưu trên trình duyệt của bạn.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex items-center gap-3 justify-end ml-[54px]">
            <button
              onClick={handleDecline}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/10"
            >
              Từ chối
            </button>
            <button
              onClick={handleAccept}
              id="cookie-accept-btn"
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-900/40 hover:shadow-indigo-800/50 hover:scale-105"
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
