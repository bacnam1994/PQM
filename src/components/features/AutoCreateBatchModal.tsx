import React, { useState, useMemo } from 'react';
import { 
  XMarkIcon, 
  SparklesIcon, 
  CubeIcon, 
  HashtagIcon, 
  CalendarIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon, 
  ChevronDownIcon, 
  InformationCircleIcon 
} from '@heroicons/react/24/outline';
import { Product, TCCS } from '../../types';
import { DSDateInput } from '../index';
import { parseDateToISO } from '../../utils';

export interface AutoCreateBatchData {
  /** Số lô AI đọc được từ phiếu */
  batchNo: string;
  /** Mã sản phẩm AI đọc được (ưu tiên match) */
  productCode?: string;
  /** Tên sản phẩm AI đọc được (fallback match) */
  productName?: string;
  /** Ngày sản xuất (DD/MM/YYYY raw từ OCR) */
  mfgDate?: string;
  /** Hạn dùng (DD/MM/YYYY raw từ OCR) */
  expDate?: string;
}

export interface AutoCreateBatchResult {
  productId: string;
  tccsId: string;
  batchNo: string;
  mfgDate: string;
  expDate: string;
}

interface AutoCreateBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: AutoCreateBatchResult) => Promise<void>;
  aiData: AutoCreateBatchData;
  products: Product[];
  tccsList: TCCS[];
}

// Normalize chuỗi để so sánh fuzzy
const normalizeStr = (s: string) =>
  (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

const fuzzyScore = (a: string, b: string): number => {
  const na = normalizeStr(a);
  const nb = normalizeStr(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const wordsA = na.split(' ').filter(Boolean);
  const wordsB = nb.split(' ').filter(Boolean);
  const overlap = wordsA.filter(w => wordsB.some(wb => wb.includes(w) || w.includes(wb))).length;
  return overlap / Math.max(wordsA.length, wordsB.length);
};

const AutoCreateBatchModal: React.FC<AutoCreateBatchModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  aiData,
  products,
  tccsList,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Match sản phẩm theo thứ tự ưu tiên ---
  const suggestedMatch = useMemo(() => {
    if (!products.length) return null;

    // Ưu tiên 1: Match mã sản phẩm (exact, case-insensitive)
    if (aiData.productCode) {
      const exact = products.find(
        p => normalizeStr(p.code) === normalizeStr(aiData.productCode!)
      );
      if (exact) return { product: exact, matchType: 'code' as const, confidence: 100 };

      // Partial code match
      const partial = products.find(
        p =>
          normalizeStr(p.code).includes(normalizeStr(aiData.productCode!)) ||
          normalizeStr(aiData.productCode!).includes(normalizeStr(p.code))
      );
      if (partial) return { product: partial, matchType: 'code' as const, confidence: 82 };
    }

    // Ưu tiên 2: Match tên sản phẩm (fuzzy)
    if (aiData.productName) {
      const scored = products
        .map(p => ({ product: p, score: fuzzyScore(p.name, aiData.productName!) }))
        .sort((a, b) => b.score - a.score);
      if (scored[0] && scored[0].score >= 0.5) {
        return {
          product: scored[0].product,
          matchType: 'name' as const,
          confidence: Math.round(scored[0].score * 100),
        };
      }
    }

    return null;
  }, [products, aiData]);

  // Form state — khởi tạo từ suggested match
  const [selectedProductId, setSelectedProductId] = useState<string>(
    suggestedMatch?.product.id || ''
  );
  const [batchNo, setBatchNo] = useState(aiData.batchNo);
  const [mfgDate, setMfgDate] = useState(parseDateToISO(aiData.mfgDate || '') || '');
  const [expDate, setExpDate] = useState(parseDateToISO(aiData.expDate || '') || '');

  React.useEffect(() => {
    if (suggestedMatch && !selectedProductId) {
      setSelectedProductId(suggestedMatch.product.id);
    }
  }, [suggestedMatch, selectedProductId]);

  // TCCS active của sản phẩm đang chọn
  const activeTccs = useMemo(() => {
    if (!selectedProductId) return null;
    return (
      tccsList
        .filter(t => t.productId === selectedProductId && t.isActive)
        .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())[0] || null
    );
  }, [selectedProductId, tccsList]);

  const canConfirm = !!selectedProductId && !!batchNo.trim();

  const handleConfirm = async () => {
    if (!canConfirm || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm({
        productId: selectedProductId,
        tccsId: activeTccs?.id || '',
        batchNo: batchNo.trim(),
        mfgDate,
        expDate,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const matchBadgeColor =
    suggestedMatch
      ? suggestedMatch.confidence >= 90
        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
        : suggestedMatch.confidence >= 70
        ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300'
        : 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300'
      : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">

        {/* ── Header ── */}
        <div className="p-5 border-b border-border bg-surface-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm flex-shrink-0">
                <SparklesIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-ink uppercase tracking-wide">
                  AI phát hiện Lô mới
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Số lô{' '}
                  <code className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    {aiData.batchNo}
                  </code>{' '}
                  chưa có trong hệ thống
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-surface-3 rounded-lg text-ink-muted hover:text-ink transition-colors flex-shrink-0"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-5 space-y-4 bg-surface text-ink">

          {/* AI Match Badge */}
          <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${matchBadgeColor}`}>
            {suggestedMatch ? (
              <>
                <CheckCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-black">
                    AI gợi ý ({suggestedMatch.confidence}% tin cậy):
                  </span>{' '}
                  <span className="font-bold">{suggestedMatch.product.name}</span>
                  {' '}
                  <span className="opacity-75">
                    [{suggestedMatch.product.code}]
                  </span>
                  <br />
                  <span className="opacity-70 mt-0.5 block">
                    {suggestedMatch.matchType === 'code'
                      ? `✓ Khớp mã sản phẩm: "${aiData.productCode}"`
                      : `✓ Khớp tên sản phẩm: "${(aiData.productName || '').slice(0, 40)}${(aiData.productName || '').length > 40 ? '…' : ''}"`}
                  </span>
                </div>
              </>
            ) : (
              <>
                <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-black">Không tự động khớp được sản phẩm.</span>{' '}
                  Vui lòng chọn thủ công bên dưới.
                  {(aiData.productCode || aiData.productName) && (
                    <span className="block mt-1 opacity-70">
                      AI đọc được:{' '}
                      {aiData.productCode && <span className="font-mono">Mã: {aiData.productCode}</span>}
                      {aiData.productCode && aiData.productName && ' · '}
                      {aiData.productName && <span>Tên: {aiData.productName}</span>}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Sản phẩm */}
          <div>
            <label className="block text-[10px] font-black text-ink-muted uppercase tracking-wider mb-1.5">
              <CubeIcon className="w-3.5 h-3.5 inline mr-1 text-emerald-500" />
              Sản phẩm <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                className="w-full appearance-none bg-surface border border-border rounded-xl px-3 py-2.5 pr-8 text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              >
                <option value="">— Chọn sản phẩm —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
            </div>
            {/* TCCS indicator */}
            {selectedProductId && (
              <p className="mt-1.5 text-[10px] flex items-center gap-1">
                {activeTccs ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    TCCS hiệu lực: {activeTccs.code} (ngày {activeTccs.issueDate})
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                    <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                    Chưa có TCCS hiệu lực — có thể bổ sung sau
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Số lô */}
          <div>
            <label className="block text-[10px] font-black text-ink-muted uppercase tracking-wider mb-1.5">
              <HashtagIcon className="w-3.5 h-3.5 inline mr-1 text-emerald-500" />
              Số lô <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={batchNo}
              onChange={e => setBatchNo(e.target.value)}
              placeholder="Số lô sản xuất..."
              className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono tracking-wider"
            />
          </div>

          {/* NSX / HSD */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-ink-muted uppercase tracking-wider mb-1.5">
                <CalendarIcon className="w-3.5 h-3.5 inline mr-1 text-emerald-500" />
                Ngày sản xuất (NSX)
              </label>
              <DSDateInput
                value={mfgDate}
                onChange={val => setMfgDate(val)}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-ink-muted uppercase tracking-wider mb-1.5">
                <CalendarIcon className="w-3.5 h-3.5 inline mr-1 text-emerald-500" />
                Hạn dùng (HSD)
              </label>
              <DSDateInput
                value={expDate}
                onChange={val => setExpDate(val)}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Ghi chú */}
          <div className="flex items-start gap-1.5 text-[10px] text-ink-muted bg-surface-2 border border-border rounded-xl p-3">
            <InformationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" />
            <span>
              Lô mới sẽ được tạo với trạng thái{' '}
              <strong className="text-ink">Đang kiểm nghiệm</strong>.
              Thông tin còn lại (sản lượng, bao bì...) có thể bổ sung sau trong{' '}
              <strong className="text-ink">Quản lý Lô</strong>.
            </span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-border bg-surface-2 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-black text-ink-muted hover:text-ink bg-surface border border-border rounded-xl hover:bg-surface-3 transition-colors uppercase tracking-wide disabled:opacity-50"
          >
            Bỏ qua
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm || isSubmitting}
            className="px-5 py-2 text-xs font-black text-white rounded-xl uppercase tracking-wide transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang tạo...
              </>
            ) : (
              <>
                <SparklesIcon className="w-4 h-4" />
                Xác nhận &amp; Tạo Lô
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoCreateBatchModal;
