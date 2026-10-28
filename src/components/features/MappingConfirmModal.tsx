import React, { useState, useMemo } from 'react';
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowRightIcon,
  SparklesIcon,
  DocumentTextIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIExtractedItem {
  criteriaName: string; // Tên gốc từ phiếu (bất biến, Rule 1)
  mappedName: string; // Tên AI đã map (có thể rỗng)
  confidence: string; // "high" | "low"
  confidenceScore?: number; // Điểm tin cậy OCR (0–100, Rule 11)
  value: string; // Kết quả thực đo (Rule 1, 5)
  unit?: string; // Đơn vị đo (Rule 4)
  limit?: string; // Mức giới hạn TIÊU CHUẨN (Rule 5)
  sourcePageNumber?: number; // Trang nguồn (Rule 7)
  warningMessages?: string[]; // Cảnh báo OCR nghi ngờ (Rule 12)
  isSuspicious?: boolean;
  // OCR-10: Metadata từ tccsMappingService
  mappingScore?: number;
  mappingConfidenceLevel?: string;
  resolvedDictionaryTerm?: string | null;
  requiresManualConfirmation?: boolean;
}

export interface ConfirmedMapping {
  originalName: string; // Tên gốc từ phiếu
  systemName: string; // Tên chuẩn trong TCCS
  value: string;
  unit?: string;
  limit?: string;
}

interface MappingConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Các item AI đã map HIGH confidence (điền thẳng, không cần confirm) */
  highConfidenceItems: AIExtractedItem[];
  /** Các item AI KHÔNG map được hoặc low confidence (cần user ghép) */
  lowConfidenceItems: AIExtractedItem[];
  /** Danh sách tên chỉ tiêu chuẩn từ TCCS để hiện trong dropdown */
  tccsNames: string[];
  /** Callback khi user xác nhận xong */
  onConfirm: (confirmedMappings: ConfirmedMapping[], rememberMappings: boolean) => void;
}

// ─── Helper components ────────────────────────────────────────────────────────

function ConfidenceBadge({ score }: { score: number }) {
  const color =
    score >= 85
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : score >= 75
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300';
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black font-mono ${color}`}
    >
      {score}%
    </span>
  );
}

function MappingLevelBadge({ level }: { level?: string }) {
  if (!level || level === 'UNMATCHED') return null;
  const styles: Record<string, string> = {
    LEARNED: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    EXACT: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    DICTIONARY: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    FUZZY: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  };
  const labels: Record<string, string> = {
    LEARNED: 'Đã học',
    EXACT: 'Chính xác',
    DICTIONARY: 'Từ điển',
    FUZZY: 'Gần đúng',
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${styles[level] ?? ''}`}
    >
      {labels[level] ?? level}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const MappingConfirmModal: React.FC<MappingConfirmModalProps> = ({
  isOpen,
  onClose,
  highConfidenceItems,
  lowConfidenceItems,
  tccsNames,
  onConfirm,
}) => {
  const [userMappings, setUserMappings] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    lowConfidenceItems.forEach((item) => {
      initial[item.criteriaName] = item.mappedName || '';
    });
    return initial;
  });
  const [rememberMappings, setRememberMappings] = useState(true);

  React.useEffect(() => {
    const initial: Record<string, string> = {};
    lowConfidenceItems.forEach((item) => {
      initial[item.criteriaName] = item.mappedName || '';
    });
    setUserMappings(initial);
  }, [lowConfidenceItems]);

  const handleConfirm = () => {
    const confirmed: ConfirmedMapping[] = [];
    highConfidenceItems.forEach((item) => {
      confirmed.push({
        originalName: item.criteriaName,
        systemName: item.mappedName,
        value: item.value,
        unit: item.unit,
        limit: item.limit,
      });
    });
    lowConfidenceItems.forEach((item) => {
      const chosen = userMappings[item.criteriaName];
      if (chosen) {
        confirmed.push({
          originalName: item.criteriaName,
          systemName: chosen,
          value: item.value,
          unit: item.unit,
          limit: item.limit,
        });
      }
    });
    onConfirm(confirmed, rememberMappings);
  };

  const confirmedCount = useMemo(
    () => Object.values(userMappings).filter((v) => v).length,
    [userMappings]
  );

  if (!isOpen) return null;

  const TABLE_HEADERS = [
    'Tên OCR gốc',
    'Ánh xạ TCCS',
    'Trang',
    'Tin cậy',
    'Kết quả',
    'Đơn vị',
    'Giới hạn TC',
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-4xl max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-ink text-sm uppercase tracking-wider">
                Bảng Đối Chiếu Chỉ Tiêu OCR
              </h2>
              <p className="text-[11px] text-ink-muted font-medium mt-0.5">
                {highConfidenceItems.length + lowConfidenceItems.length} chỉ tiêu ·{' '}
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {highConfidenceItems.length} tự động
                </span>{' '}
                ·{' '}
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  {lowConfidenceItems.length} cần xác nhận
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-ink-muted hover:text-ink hover:bg-surface-3 rounded-xl transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* HIGH confidence — bảng gọn */}
          {highConfidenceItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                  Điền tự động ({highConfidenceItems.length})
                </span>
              </div>
              <div className="rounded-xl border border-emerald-500/20 overflow-auto">
                <table className="w-full text-xs min-w-[600px]">
                  <thead>
                    <tr
                      className="border-b border-emerald-500/15"
                      style={{ background: 'rgba(16,185,129,0.06)' }}
                    >
                      {TABLE_HEADERS.map((h) => (
                        <th
                          key={h}
                          className="text-left px-3 py-2 font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider text-[10px] whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-500/10">
                    {highConfidenceItems.map((item, idx) => {
                      const score = item.confidenceScore ?? (item.confidence === 'high' ? 88 : 55);
                      return (
                        <tr key={idx} className="hover:bg-emerald-500/5 transition-colors">
                          <td className="px-3 py-2.5">
                            <div
                              className="font-semibold text-ink truncate max-w-[150px]"
                              title={item.criteriaName}
                            >
                              {item.criteriaName}
                            </div>
                            {item.resolvedDictionaryTerm &&
                              item.resolvedDictionaryTerm !== item.criteriaName && (
                                <div className="text-[9px] text-ink-muted mt-0.5">
                                  📖 {item.resolvedDictionaryTerm}
                                </div>
                              )}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span
                                className="font-bold text-emerald-700 dark:text-emerald-300 truncate max-w-[110px]"
                                title={item.mappedName}
                              >
                                {item.mappedName || '—'}
                              </span>
                              <MappingLevelBadge level={item.mappingConfidenceLevel} />
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {item.sourcePageNumber ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                                <DocumentTextIcon className="w-3 h-3" />
                                {item.sourcePageNumber}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <ConfidenceBadge score={score} />
                          </td>
                          <td className="px-3 py-2.5 font-black text-ink font-mono">
                            {item.value || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-ink-muted font-mono">
                            {item.unit || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-ink-muted font-mono text-[10px]">
                            {item.limit || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* LOW confidence — card xác nhận */}
          {lowConfidenceItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShieldExclamationIcon className="w-4 h-4 text-amber-500" />
                <span className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                  Cần xác nhận ({lowConfidenceItems.length})
                </span>
              </div>
              <div className="space-y-3">
                {lowConfidenceItems.map((item, idx) => {
                  const score = item.confidenceScore ?? 55;
                  const hasSuspicion =
                    item.isSuspicious || (item.warningMessages && item.warningMessages.length > 0);
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border p-4 space-y-3 ${
                        hasSuspicion
                          ? 'bg-rose-500/5 border-rose-500/25'
                          : 'bg-amber-500/5 border-amber-500/20'
                      }`}
                    >
                      {/* Tên + badges */}
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="font-black text-ink text-sm" title={item.criteriaName}>
                          {item.criteriaName}
                        </span>
                        {item.resolvedDictionaryTerm &&
                          item.resolvedDictionaryTerm !== item.criteriaName && (
                            <span className="text-[10px] text-ink-muted bg-surface px-1.5 py-0.5 rounded border border-border">
                              📖 {item.resolvedDictionaryTerm}
                            </span>
                          )}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <ConfidenceBadge score={score} />
                          {item.sourcePageNumber && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                              <DocumentTextIcon className="w-3 h-3" /> Trang {item.sourcePageNumber}
                            </span>
                          )}
                          <MappingLevelBadge level={item.mappingConfidenceLevel} />
                          {hasSuspicion && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                              ⚠️ Nghi ngờ OCR
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Warning messages */}
                      {item.warningMessages && item.warningMessages.length > 0 && (
                        <div className="space-y-0.5 pl-1">
                          {item.warningMessages.map((w, wi) => (
                            <p
                              key={wi}
                              className="text-[10px] text-rose-600 dark:text-rose-400 font-medium"
                            >
                              • {w}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Dữ liệu đo — 3 cột */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Kết quả', val: item.value || '—', highlight: !!hasSuspicion },
                          { label: 'Đơn vị', val: item.unit || '—', highlight: false },
                          { label: 'Giới hạn TC', val: item.limit || '—', highlight: false },
                        ].map(({ label, val, highlight }) => (
                          <div
                            key={label}
                            className="bg-surface border border-border rounded-lg px-2.5 py-2"
                          >
                            <p className="text-[9px] text-ink-muted uppercase tracking-widest font-bold mb-0.5">
                              {label}
                            </p>
                            <p
                              className={`font-black font-mono text-sm ${
                                highlight ? 'text-rose-600 dark:text-rose-400' : 'text-ink'
                              }`}
                            >
                              {val}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Dropdown ghép TCCS */}
                      <div>
                        <p className="text-[10px] font-black text-ink-muted uppercase tracking-widest mb-1.5 flex items-center gap-1">
                          <ArrowRightIcon className="w-3 h-3" /> Ghép với chỉ tiêu TCCS
                        </p>
                        <select
                          value={userMappings[item.criteriaName] || ''}
                          onChange={(e) =>
                            setUserMappings((prev) => ({
                              ...prev,
                              [item.criteriaName]: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-xs font-bold text-ink outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        >
                          <option value="">— Bỏ qua chỉ tiêu này —</option>
                          {tccsNames.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Không có dữ liệu */}
          {lowConfidenceItems.length === 0 && highConfidenceItems.length === 0 && (
            <div className="text-center py-12 text-ink-muted">
              <ExclamationCircleIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-bold">AI không đọc được chỉ tiêu nào.</p>
              <p className="text-xs mt-1 opacity-70">
                Vui lòng thử lại với tài liệu chất lượng cao hơn.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-border bg-surface-2 space-y-3 shrink-0">
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={rememberMappings}
              onChange={(e) => setRememberMappings(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 cursor-pointer rounded"
            />
            <div>
              <p className="text-xs font-bold text-ink group-hover:text-emerald-600 transition-colors">
                Nhớ các lựa chọn này cho lần sau
              </p>
              <p className="text-[10px] text-ink-muted">
                AI sẽ tự động map tên tương tự trong tương lai
              </p>
            </div>
          </label>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-ink-muted font-black uppercase text-[10px] tracking-widest hover:bg-surface-3 rounded-xl transition-colors border border-border"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirm}
              className="flex-[2] py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <CheckCircleIcon className="w-4 h-4" />
              Xác nhận &amp; Điền form
              {confirmedCount + highConfidenceItems.length > 0 && (
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px]">
                  {confirmedCount + highConfidenceItems.length} chỉ tiêu
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MappingConfirmModal;
