/**
 * CriteriaAliasManager.tsx
 * ========================
 * Trang Admin quản lý bảng ánh xạ tên chỉ tiêu TCCS (CriteriaAlias).
 *
 * Chức năng:
 * - Hiển thị danh sách alias đã lưu, phân nhóm theo TCCS
 * - Hiển thị danh sách đề xuất chờ xác nhận (autoDetected = true, confirmedByAdmin = false)
 * - Cho phép Admin xác nhận / bỏ qua / xóa alias
 * - Cho phép thêm alias thủ công
 * - Chạy quét toàn bộ dữ liệu để phát hiện mismatch mới
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { CriteriaAlias } from '../../types';
import { detectDataMismatches, normalizeName, createAliasRecord } from '../../services/criteriaAliasService';
import { fetchAllTestResultsRaw } from '../../services/testResultService';

// =============================================================================
// ICONS (inline SVG)
// =============================================================================
const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const IconScan = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const IconPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);
const IconLink = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

// =============================================================================
// SCORE BADGE
// =============================================================================
const ScoreBadge: React.FC<{ score: number }> = ({ score }) => {
  const pct = Math.round(score * 100);
  const color = pct >= 92 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : pct >= 75 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {pct}%
    </span>
  );
};

// =============================================================================
// MAIN PAGE
// =============================================================================
const CriteriaAliasManager: React.FC = () => {
  const { criteriaAliases, tccsList, testResults, isAdmin, addCriteriaAlias, updateCriteriaAlias, deleteCriteriaAlias, confirmCriteriaAlias, addAliasToExisting, notify } = useAppStore();

  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed' | 'scan'>('pending');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ReturnType<typeof detectDataMismatches>>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ tccsId: '', canonicalName: '', aliasName: '' });
  const [expandedAliasId, setExpandedAliasId] = useState<string | null>(null);
  const [newAliasInput, setNewAliasInput] = useState('');

  // Phân loại alias
  const pendingAliases = useMemo(
    () => criteriaAliases.filter(a => a.autoDetected && !a.confirmedByAdmin),
    [criteriaAliases]
  );
  const confirmedAliases = useMemo(
    () => criteriaAliases.filter(a => a.confirmedByAdmin),
    [criteriaAliases]
  );

  // Map TCCS id → code để hiển thị
  const tccsMap = useMemo(
    () => new Map(tccsList.map(t => [t.id, t])),
    [tccsList]
  );

  // Quét toàn bộ dữ liệu (tải 100% phiếu từ Database để quét)
  const handleScan = useCallback(async () => {
    setIsScanning(true);
    try {
      const allResults = await fetchAllTestResultsRaw();
      const reports = detectDataMismatches(allResults, tccsList, criteriaAliases);
      setScanResults(reports);
      if (reports.length === 0) {
        notify({ type: 'SUCCESS', title: 'Quét hoàn tất', message: 'Không phát hiện mismatch nào trong dữ liệu.' });
      } else {
        notify({ type: 'INFO', title: 'Phát hiện mismatch', message: `Tìm thấy ${reports.length} nhóm chỉ tiêu có tên không khớp trong ${allResults.length} phiếu kiểm nghiệm.` });
      }
    } catch (e) {
      notify({ type: 'ERROR', title: 'Lỗi quét', message: 'Không thể quét dữ liệu.' });
    } finally {
      setIsScanning(false);
    }
  }, [tccsList, criteriaAliases, notify]);

  // Xác nhận alias từ kết quả quét
  const handleConfirmFromScan = useCallback(async (tccsId: string, canonicalName: string, rawName: string) => {
    // Tìm alias đã có cho canonical name này
    const existing = criteriaAliases.find(
      a => a.tccsId === tccsId && normalizeName(a.canonicalName) === normalizeName(canonicalName)
    );
    if (existing) {
      await addAliasToExisting(existing.id, rawName);
    } else {
      const newId = `ca_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newAlias: CriteriaAlias = {
        id: newId,
        ...createAliasRecord(tccsId, canonicalName, [rawName], false, true),
      };
      await addCriteriaAlias(newAlias);
    }
    // Refresh scan results
    setScanResults(prev => prev.map(r => {
      if (r.tccsId !== tccsId || r.criteriaName !== canonicalName) return r;
      return {
        ...r,
        suggestions: r.suggestions.filter(s => normalizeName(s.rawName) !== normalizeName(rawName)),
        missingInResults: r.missingInResults.filter(n => normalizeName(n) !== normalizeName(rawName)),
      };
    }).filter(r => r.suggestions.length > 0));
  }, [criteriaAliases, addAliasToExisting, addCriteriaAlias]);

  // Thêm alias thủ công
  const handleAddManual = useCallback(async () => {
    if (!addForm.tccsId || !addForm.canonicalName || !addForm.aliasName) {
      notify({ type: 'WARNING', message: 'Vui lòng điền đầy đủ thông tin.' });
      return;
    }
    const newId = `ca_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newAlias: CriteriaAlias = {
      id: newId,
      ...createAliasRecord(addForm.tccsId, addForm.canonicalName, [addForm.aliasName], false, true),
    };
    await addCriteriaAlias(newAlias);
    setShowAddModal(false);
    setAddForm({ tccsId: '', canonicalName: '', aliasName: '' });
  }, [addForm, addCriteriaAlias, notify]);

  // Thêm alias vào record đã tồn tại
  const handleAddToExisting = useCallback(async (aliasId: string) => {
    if (!newAliasInput.trim()) return;
    await addAliasToExisting(aliasId, newAliasInput.trim());
    setNewAliasInput('');
    setExpandedAliasId(null);
  }, [newAliasInput, addAliasToExisting]);

  // =============================================================================
  // RENDER
  // =============================================================================
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <IconLink /> Quản lý Alias Chỉ tiêu
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Duy trì tương thích giữa phiếu kiểm nghiệm cũ và TCCS sau khi chỉnh sửa tên chỉ tiêu.
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
            >
              <IconScan />
              {isScanning ? 'Đang quét...' : 'Quét toàn bộ dữ liệu'}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              <IconPlus /> Thêm thủ công
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Chờ xác nhận', value: pendingAliases.length, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Đã xác nhận', value: confirmedAliases.length, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Mismatch phát hiện', value: scanResults.length, color: 'text-sky-600 dark:text-sky-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center shadow-sm">
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        {[
          { id: 'pending', label: `Chờ xác nhận (${pendingAliases.length})` },
          { id: 'confirmed', label: `Đã xác nhận (${confirmedAliases.length})` },
          { id: 'scan', label: `Kết quả quét (${scanResults.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Chờ xác nhận */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {pendingAliases.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <p className="text-lg">✅ Không có alias nào đang chờ xác nhận.</p>
              <p className="text-sm mt-1">Khi bạn chỉnh sửa tên chỉ tiêu trong TCCS, hệ thống tự động đề xuất alias ở đây.</p>
            </div>
          ) : pendingAliases.map(alias => (
            <AliasCard
              key={alias.id}
              alias={alias}
              tccsCode={tccsMap.get(alias.tccsId)?.code}
              showActions={isAdmin}
              onConfirm={() => confirmCriteriaAlias(alias.id)}
              onDelete={() => deleteCriteriaAlias(alias.id)}
              expandedId={expandedAliasId}
              setExpandedId={setExpandedAliasId}
              newAliasInput={newAliasInput}
              setNewAliasInput={setNewAliasInput}
              onAddAlias={() => handleAddToExisting(alias.id)}
            />
          ))}
        </div>
      )}

      {/* Tab: Đã xác nhận */}
      {activeTab === 'confirmed' && (
        <div className="space-y-3">
          {confirmedAliases.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <p className="text-lg">Chưa có alias nào được xác nhận.</p>
            </div>
          ) : confirmedAliases.map(alias => (
            <AliasCard
              key={alias.id}
              alias={alias}
              tccsCode={tccsMap.get(alias.tccsId)?.code}
              showActions={isAdmin}
              onDelete={() => deleteCriteriaAlias(alias.id)}
              expandedId={expandedAliasId}
              setExpandedId={setExpandedAliasId}
              newAliasInput={newAliasInput}
              setNewAliasInput={setNewAliasInput}
              onAddAlias={() => handleAddToExisting(alias.id)}
            />
          ))}
        </div>
      )}

      {/* Tab: Kết quả quét */}
      {activeTab === 'scan' && (
        <div className="space-y-4">
          {scanResults.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <p className="text-lg">Nhấn "Quét toàn bộ dữ liệu" để phát hiện mismatch.</p>
              <p className="text-sm mt-1">Hệ thống sẽ so sánh tên chỉ tiêu trong phiếu KN với TCCS hiện tại.</p>
            </div>
          ) : scanResults.map((report, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">TCCS: {report.tccsCode}</span>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                    Chỉ tiêu chuẩn: <span className="text-sky-600 dark:text-sky-400">"{report.criteriaName}"</span>
                  </h3>
                </div>
              </div>
              <div className="space-y-2">
                {report.suggestions.map((sug, si) => (
                  <div key={si} className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <ScoreBadge score={sug.score} />
                      <span className="text-sm text-slate-600 dark:text-slate-300 font-mono truncate">
                        "{sug.rawName}"
                      </span>
                      <span className="text-slate-400 text-xs">→ sẽ ánh xạ thành "{report.criteriaName}"</span>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleConfirmFromScan(report.tccsId, report.criteriaName, sug.rawName)}
                        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                      >
                        <IconCheck /> Xác nhận
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal thêm alias thủ công */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Thêm Alias thủ công</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">TCCS</label>
                <select
                  value={addForm.tccsId}
                  onChange={e => setAddForm(f => ({ ...f, tccsId: e.target.value, canonicalName: '' }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">-- Chọn TCCS --</option>
                  {tccsList.map(t => (
                    <option key={t.id} value={t.id}>{t.code} — {t.productId}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Tên chuẩn (trong TCCS)</label>
                <select
                  value={addForm.canonicalName}
                  onChange={e => setAddForm(f => ({ ...f, canonicalName: e.target.value }))}
                  disabled={!addForm.tccsId}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                >
                  <option value="">-- Chọn chỉ tiêu --</option>
                  {addForm.tccsId && (() => {
                    const t = tccsMap.get(addForm.tccsId);
                    if (!t) return null;
                    return [...(t.mainQualityCriteria || []), ...(t.safetyCriteria || [])]
                      .filter(c => c?.name)
                      .map(c => <option key={c.name} value={c.name}>{c.name}</option>);
                  })()}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Tên cũ / Alias</label>
                <input
                  type="text"
                  value={addForm.aliasName}
                  onChange={e => setAddForm(f => ({ ...f, aliasName: e.target.value }))}
                  placeholder="Nhập tên chỉ tiêu cũ..."
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Hủy</button>
              <button onClick={handleAddManual} className="flex-1 px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-medium">Xác nhận thêm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// ALIAS CARD COMPONENT
// =============================================================================
interface AliasCardProps {
  alias: CriteriaAlias;
  tccsCode?: string;
  showActions?: boolean;
  onConfirm?: () => void;
  onDelete?: () => void;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  newAliasInput: string;
  setNewAliasInput: (v: string) => void;
  onAddAlias: () => void;
}

const AliasCard: React.FC<AliasCardProps> = ({
  alias, tccsCode, showActions, onConfirm, onDelete,
  expandedId, setExpandedId, newAliasInput, setNewAliasInput, onAddAlias
}) => {
  const isExpanded = expandedId === alias.id;

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm transition-all ${
      !alias.confirmedByAdmin
        ? 'border-amber-300 dark:border-amber-700'
        : 'border-slate-200 dark:border-slate-700'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                {tccsCode || alias.tccsId}
              </span>
              {alias.autoDetected && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-medium">
                  Tự động
                </span>
              )}
              {alias.confirmedByAdmin && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-medium">
                  ✓ Đã xác nhận
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex flex-wrap gap-1">
                {alias.aliases.map((a, i) => (
                  <span key={i} className="font-mono text-sm bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                    "{a}"
                  </span>
                ))}
              </div>
              <span className="text-slate-400 dark:text-slate-500 text-sm">→</span>
              <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                "{alias.canonicalName}"
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Cập nhật: {new Date(alias.updatedAt).toLocaleDateString('vi-VN')}
            </p>
          </div>
          {showActions && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {onConfirm && !alias.confirmedByAdmin && (
                <button
                  onClick={onConfirm}
                  title="Xác nhận alias này"
                  className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/60 transition-colors"
                >
                  <IconCheck />
                </button>
              )}
              <button
                onClick={() => setExpandedId(isExpanded ? null : alias.id)}
                title="Thêm alias"
                className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-800/60 transition-colors"
              >
                <IconPlus />
              </button>
              {onDelete && (
                <button
                  onClick={onDelete}
                  title="Xóa alias"
                  className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/60 transition-colors"
                >
                  <IconTrash />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Mở rộng: Thêm alias mới */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex gap-2">
            <input
              type="text"
              value={newAliasInput}
              onChange={e => setNewAliasInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onAddAlias()}
              placeholder="Nhập tên cũ cần thêm..."
              className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              autoFocus
            />
            <button
              onClick={onAddAlias}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition-colors"
            >
              Thêm
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CriteriaAliasManager;
