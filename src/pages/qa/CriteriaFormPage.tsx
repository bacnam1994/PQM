import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CheckIcon,
  ChartBarSquareIcon,
  CubeIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store/useAppStore';
import { DSFormInput, SpecialCharToolbar, DSCard, PageHeader } from '../../components';
import { normalizeName, createAliasRecord } from '../../services/criteriaAliasService';
import { masterCriterionAppService } from '../../services/app/MasterCriterionAppService';

interface CriterionUsageInfo {
  name: string;
  count: number;
  relatedTCCS: { id: string; code: string; product: string; productId?: string }[];
  types: Set<string>;
  relatedBatchesCount: number;
}

const CriteriaFormPage: React.FC = () => {
  const { id: paramId } = useParams();
  const navigate = useNavigate();

  // App Store States
  const {
    tccsList,
    products,
    batches,
    testResults,
    allTestResults,
    fetchAllTestResultsForDashboard,
    criteriaAliases,
    updateTCCS,
    addCriteriaAlias,
    notify,
    isAdmin,
    user,
  } = useAppStore();

  const [selectedName, setSelectedName] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [renameScope, setRenameScope] = useState<'global' | 'product'>('global');
  const [targetProductId, setTargetProductId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoCreateAlias, setAutoCreateAlias] = useState(true);

  // Tự động nạp toàn bộ danh sách phiếu kiểm nghiệm từ DB để thống kê chính xác
  useEffect(() => {
    fetchAllTestResultsForDashboard().catch(() => {});
  }, [fetchAllTestResultsForDashboard]);

  // 1. Tổng hợp toàn bộ danh mục chỉ tiêu từ TCCS và TestResults (quét toàn bộ kho dữ liệu)
  const criteriaMap = useMemo(() => {
    const map = new Map<string, CriterionUsageInfo>();
    const productMap = new Map(products.map((p) => [p.id, p]));

    tccsList.forEach((tccs) => {
      const product = productMap.get(tccs.productId);
      const productName = product
        ? product.name
        : tccs.productId
          ? `Sản phẩm đã xóa (${tccs.productId.slice(-6)})`
          : 'Chưa gán sản phẩm';

      const processList = (list: any[], type: string) => {
        (list || []).forEach((c) => {
          if (!c || !c.name) return;
          const trimmed = c.name.trim();
          if (!map.has(trimmed)) {
            map.set(trimmed, {
              name: trimmed,
              count: 0,
              relatedTCCS: [],
              types: new Set(),
              relatedBatchesCount: 0,
            });
          }
          const entry = map.get(trimmed)!;
          entry.count++;
          entry.types.add(type);
          if (!entry.relatedTCCS.some((r) => r.id === tccs.id)) {
            entry.relatedTCCS.push({
              id: tccs.id,
              code: tccs.code,
              product: productName,
              productId: tccs.productId,
            });
          }
        });
      };

      processList(tccs.mainQualityCriteria, 'Chất lượng chính');
      processList(tccs.safetyCriteria, 'An toàn');
    });

    // Đếm số lô kiểm nghiệm từ toàn bộ danh sách testResults (kết hợp allTestResults nếu có)
    const effectiveTestResults =
      allTestResults && allTestResults.length > 0 ? allTestResults : testResults;
    effectiveTestResults.forEach((result) => {
      (result.results || []).forEach((r) => {
        if (!r || !r.criteriaName) return;
        const trimmed = r.criteriaName.trim();
        const entry = map.get(trimmed);
        if (entry) {
          entry.relatedBatchesCount++;
        }
      });
    });

    return map;
  }, [tccsList, products, testResults, allTestResults]);

  const allCriteriaNames = useMemo(() => {
    return Array.from(criteriaMap.keys()).sort((a, b) => a.localeCompare(b));
  }, [criteriaMap]);

  // Nạp dữ liệu theo paramId khi mount hoặc thay đổi URL
  useEffect(() => {
    if (paramId) {
      const decoded = decodeURIComponent(paramId).trim();
      setSelectedName(decoded);
      setNewName(decoded);
    } else if (allCriteriaNames.length > 0 && !selectedName) {
      setSelectedName(allCriteriaNames[0]);
      setNewName(allCriteriaNames[0]);
    }
  }, [paramId, allCriteriaNames]);

  const currentInfo = useMemo(() => {
    if (!selectedName) return null;
    return (
      criteriaMap.get(selectedName) || {
        name: selectedName,
        count: 0,
        relatedTCCS: [],
        types: new Set<string>(['Chỉ tiêu mới']),
        relatedBatchesCount: 0,
      }
    );
  }, [selectedName, criteriaMap]);

  const productsUsingCurrentCriteria = useMemo(() => {
    if (!currentInfo) return [];
    const prodMap = new Map<string, string>();
    currentInfo.relatedTCCS.forEach((r) => {
      if (r.productId) {
        prodMap.set(r.productId, r.product);
      }
    });
    return Array.from(prodMap.entries()).map(([id, name]) => ({ id, name }));
  }, [currentInfo]);

  // Lấy các alias hiện có của chỉ tiêu này
  const activeAliases = useMemo(() => {
    if (!selectedName) return [];
    const norm = normalizeName(selectedName);
    return criteriaAliases.filter((a) => normalizeName(a.canonicalName) === norm);
  }, [selectedName, criteriaAliases]);

  // Xử lý đổi tên / chuẩn hóa chỉ tiêu
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedName || !newName.trim()) {
      notify({ type: 'WARNING', message: 'Vui lòng nhập tên chỉ tiêu mới!' });
      return;
    }

    if (newName.trim() === selectedName) {
      notify({ type: 'INFO', message: 'Tên chỉ tiêu không thay đổi.' });
      return;
    }

    if (renameScope === 'product' && !targetProductId) {
      notify({ type: 'WARNING', message: 'Vui lòng chọn sản phẩm cần áp dụng đổi tên!' });
      return;
    }

    setIsSubmitting(true);
    try {
      const oldName = selectedName;
      const targetName = newName.trim();
      const tccsUpdates: Promise<void>[] = [];

      // 1. Cập nhật các TCCS liên quan
      tccsList.forEach((tccs) => {
        if (renameScope === 'product' && tccs.productId !== targetProductId) return;

        let hasChange = false;
        const updateList = (list: any[]) =>
          (list || []).map((c) => {
            if (c && c.name && c.name.trim() === oldName) {
              hasChange = true;
              return { ...c, name: targetName };
            }
            return c;
          });

        const newMain = updateList(tccs.mainQualityCriteria);
        const newSafety = updateList(tccs.safetyCriteria);

        const newRules = (tccs.alternateRules || []).map((r) => {
          let ruleChanged = false;
          let main = r.main;
          let alt = r.alt;
          if (main === oldName) {
            main = targetName;
            ruleChanged = true;
          }
          if (alt === oldName) {
            alt = targetName;
            ruleChanged = true;
          }
          if (ruleChanged) hasChange = true;
          return { ...r, main, alt };
        });

        if (hasChange) {
          tccsUpdates.push(
            updateTCCS({
              ...tccs,
              mainQualityCriteria: newMain,
              safetyCriteria: newSafety,
              alternateRules: newRules,
            })
          );

          // Tự động tạo bản ghi alias để bảo toàn tương thích ngược
          if (autoCreateAlias) {
            const aliasRec = {
              id: `ca_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              ...createAliasRecord(tccs.id, targetName, [oldName], false, true),
            };
            addCriteriaAlias(aliasRec).catch((err) => console.warn('Lỗi tạo alias tự động:', err));
          }
        }
      });

      // 2. Cập nhật 100% các phiếu kiểm nghiệm liên quan trên TOÀN BỘ CƠ SỞ DỮ LIỆU qua Canonical Service
      const { updatedCount } = await masterCriterionAppService.bulkRename(
        oldName,
        targetName,
        user,
        renameScope === 'product' ? targetProductId : undefined
      );

      await Promise.all(tccsUpdates);

      notify({
        type: 'SUCCESS',
        title: 'Đổi tên thành công',
        message: `Đã cập nhật chỉ tiêu thành "${targetName}" trên ${tccsUpdates.length} hồ sơ TCCS và ${updatedCount} phiếu kiểm nghiệm.`,
      });

      setSelectedName(targetName);
      setNewName(targetName);
      navigate('/criteria');
    } catch (error) {
      console.error('Lỗi khi đổi tên chỉ tiêu:', error);
      notify({ type: 'ERROR', message: 'Có lỗi xảy ra khi cập nhật chỉ tiêu.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/criteria')}
            className="p-2 bg-surface hover:bg-surface-2 text-ink-muted hover:text-ink rounded-lg border border-border transition-colors"
            title="Quay lại danh sách"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-ink flex items-center gap-2">
              <ChartBarSquareIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              Quản lý & Chuẩn hóa Chỉ tiêu
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              Tra cứu hồ sơ áp dụng, chuẩn hóa tên gọi và đồng bộ bảng ánh xạ toàn hệ thống.
            </p>
          </div>
        </div>
        <Link
          to="/system/criteria-aliases"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 rounded-lg font-medium text-xs hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
        >
          <SparklesIcon className="h-4 w-4" />
          Quản lý Alias
        </Link>
      </div>

      {/* Selector chọn chỉ tiêu nếu không đi từ đường dẫn trực tiếp */}
      <div className="bg-surface rounded-xl shadow-sm border border-border p-5 space-y-3">
        <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider block">
          Chọn chỉ tiêu cần quản lý / chuẩn hóa:
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedName}
            onChange={(e) => {
              setSelectedName(e.target.value);
              setNewName(e.target.value);
            }}
            className="flex-1 px-3 py-2 bg-surface-2 border border-border rounded-lg font-medium text-sm text-ink outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {allCriteriaNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const customName = prompt('Nhập tên chỉ tiêu mới cần tra cứu:');
              if (customName && customName.trim()) {
                setSelectedName(customName.trim());
                setNewName(customName.trim());
              }
            }}
            className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-ink font-semibold rounded-lg text-xs border border-border transition-colors whitespace-nowrap"
          >
            + Nhập tên khác
          </button>
        </div>
      </div>

      {currentInfo && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card Thông tin sử dụng */}
          <div className="md:col-span-1 space-y-4">
            <div className="p-5 bg-surface rounded-xl border border-border shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                  <ChartBarSquareIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-ink text-sm leading-tight truncate">
                    {currentInfo.name}
                  </h3>
                  <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    {Array.from(currentInfo.types).join(', ') || 'Chỉ tiêu phân tích'}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-border text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-ink-muted">Hồ sơ TCCS sử dụng:</span>
                  <span className="font-semibold text-ink bg-surface-2 px-2 py-0.5 rounded border border-border">
                    {currentInfo.relatedTCCS.length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-muted">Lô kiểm nghiệm áp dụng:</span>
                  <span className="font-semibold text-ink bg-surface-2 px-2 py-0.5 rounded border border-border">
                    {currentInfo.relatedBatchesCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Danh sách TCCS & Sản phẩm */}
            <div className="bg-surface rounded-xl p-5 border border-border shadow-sm space-y-3">
              <h4 className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
                <CubeIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Sản phẩm áp dụng ({currentInfo.relatedTCCS.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {currentInfo.relatedTCCS.length === 0 ? (
                  <p className="text-xs text-ink-muted italic">Chưa gắn vào TCCS nào.</p>
                ) : (
                  currentInfo.relatedTCCS.map((t, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-surface-2 rounded-lg border border-border space-y-1"
                    >
                      <p className="text-xs font-semibold text-ink line-clamp-1">{t.product}</p>
                      <p className="text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400 uppercase">
                        TCCS: {t.code}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Danh sách Alias đã lưu */}
            {activeAliases.length > 0 && (
              <div className="bg-surface rounded-xl p-5 border border-border shadow-sm space-y-2">
                <h4 className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowPathIcon className="h-4 w-4 text-amber-500" />
                  Alias đã ánh xạ ({activeAliases.length})
                </h4>
                <div className="space-y-1.5 text-xs">
                  {activeAliases.map((a) => (
                    <div
                      key={a.id}
                      className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800/40"
                    >
                      <p className="font-semibold text-amber-900 dark:text-amber-300">
                        {a.canonicalName}
                      </p>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                        Biến thể: {a.aliases?.join(', ') || '---'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form Đổi tên & Chuẩn hóa */}
          <div className="md:col-span-2">
            <div className="bg-surface rounded-xl shadow-sm border border-border p-6 space-y-6">
              <div className="border-b border-border pb-4">
                <h3 className="text-base font-bold text-ink flex items-center gap-2">
                  <SparklesIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  Chuẩn hóa / Đổi tên Chỉ tiêu
                </h3>
                <p className="text-xs text-ink-muted mt-1">
                  Thay đổi tên chỉ tiêu đồng loạt trên các hồ sơ TCCS và phiếu kiểm nghiệm mà không
                  làm mất dữ liệu lịch sử.
                </p>
              </div>

              <form onSubmit={handleSave} className="space-y-5">
                <SpecialCharToolbar />

                <div>
                  <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider block mb-1.5">
                    Tên chỉ tiêu mới *
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nhập tên chuẩn hóa (VD: Độ ẩm, Định lượng Paracetamol...)"
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-lg font-medium text-sm text-ink outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-inner"
                    required
                  />
                </div>

                <div className="space-y-3 bg-surface-2 p-4 rounded-xl border border-border">
                  <label className="text-xs font-semibold text-ink uppercase tracking-wider block">
                    Phạm vi áp dụng
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start sm:items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="scope"
                        value="global"
                        checked={renameScope === 'global'}
                        onChange={() => setRenameScope('global')}
                        className="mt-0.5 sm:mt-0 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-semibold text-ink">
                          Toàn hệ thống (Khuyến nghị)
                        </span>
                        <p className="text-[11px] text-ink-muted">
                          Cập nhật tất cả hồ sơ TCCS ({currentInfo.relatedTCCS.length}) và toàn bộ
                          phiếu kiểm nghiệm có chỉ tiêu này.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start sm:items-center gap-3 cursor-pointer pt-2 border-t border-border">
                      <input
                        type="radio"
                        name="scope"
                        value="product"
                        checked={renameScope === 'product'}
                        onChange={() => setRenameScope('product')}
                        className="mt-0.5 sm:mt-0 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-semibold text-ink">
                          Chỉ áp dụng cho 1 Sản phẩm cụ thể
                        </span>
                        <p className="text-[11px] text-ink-muted">
                          Chỉ đổi tên trên hồ sơ TCCS và phiếu kiểm nghiệm thuộc sản phẩm được chọn.
                        </p>
                      </div>
                    </label>
                  </div>

                  {renameScope === 'product' && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <label className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider block mb-1">
                        Chọn sản phẩm:
                      </label>
                      <select
                        value={targetProductId}
                        onChange={(e) => setTargetProductId(e.target.value)}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      >
                        <option value="">-- Chọn sản phẩm --</option>
                        {productsUsingCurrentCriteria.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="auto-alias-check"
                    checked={autoCreateAlias}
                    onChange={(e) => setAutoCreateAlias(e.target.checked)}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500 rounded h-4 w-4"
                  />
                  <label htmlFor="auto-alias-check" className="text-xs text-ink cursor-pointer">
                    <span className="font-semibold text-emerald-900 dark:text-emerald-300">
                      Tự động tạo Alias ánh xạ
                    </span>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                      Lưu tên cũ ("{selectedName}") làm alias của tên mới ("{newName}") để các báo
                      cáo và biểu đồ xu hướng cũ vẫn hiển thị đồng bộ.
                    </p>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => navigate('/criteria')}
                    className="px-4 py-2 text-ink-muted font-semibold text-xs hover:bg-surface-2 rounded-lg border border-border transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !isAdmin}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckIcon className="h-4 w-4" />
                    )}
                    Xác nhận & Cập nhật
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CriteriaFormPage;
