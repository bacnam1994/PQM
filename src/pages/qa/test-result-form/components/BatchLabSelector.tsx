import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  CubeIcon,
  HashtagIcon,
  CalendarIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PrinterIcon,
  BuildingOffice2Icon,
  ShieldCheckIcon,
  ChevronUpDownIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { DSDateInput } from '../../../../components';
import { formatDateStandard, TEST_RESULT_STATUS, getAppUrl } from '../../../../utils';
import { HydratedBatch } from '../../../../hooks/useDataGraph';
import { useAppStore } from '../../../../store/useAppStore';
import {
  DEFAULT_TESTING_LABORATORIES,
  matchLaboratory,
  normalizeLabQuery,
} from '../../../../services/laboratoryService';
import { TestingLaboratory } from '../../../../types/laboratory';

export interface BatchLabSelectorProps {
  batchSearch: string;
  setBatchSearch: (val: string) => void;
  showBatchDropdown: boolean;
  setShowBatchDropdown: (val: boolean) => void;
  isEditMode: boolean;
  batchId: string;
  availableBatchesForDropdown: HydratedBatch[];
  handleBatchSelect: (batchId: string) => void;
  setFieldValue: (field: string, value: any) => void;
  labId?: string;
  labName: string;
  testDate: string;
  hydratedBatches: HydratedBatch[];
  existingResultsForBatch: any[];
  switchToEditMode: (res: any) => void;
}

export const BatchLabSelector: React.FC<BatchLabSelectorProps> = ({
  batchSearch,
  setBatchSearch,
  showBatchDropdown,
  setShowBatchDropdown,
  isEditMode,
  batchId,
  availableBatchesForDropdown,
  handleBatchSelect,
  setFieldValue,
  labId,
  labName,
  testDate,
  hydratedBatches,
  existingResultsForBatch,
  switchToEditMode,
}) => {
  const selectedBatch = hydratedBatches.find((batch) => batch.id === batchId);

  // Danh mục Lab từ Master Data trong AppStore
  const storeLaboratories = useAppStore((state) => state.testingLaboratories);
  const laboratories = useMemo<TestingLaboratory[]>(() => {
    return storeLaboratories && storeLaboratories.length > 0
      ? storeLaboratories
      : DEFAULT_TESTING_LABORATORIES;
  }, [storeLaboratories]);

  // Trạng thái điều khiển Combobox cho Đơn vị kiểm nghiệm
  const [showLabDropdown, setShowLabDropdown] = useState(false);
  const [labSearchQuery, setLabSearchQuery] = useState(labName);
  const labComboboxRef = useRef<HTMLDivElement>(null);

  // Đồng bộ labSearchQuery khi labName thay đổi từ ngoài (AI trích xuất hoặc load phiếu)
  useEffect(() => {
    setLabSearchQuery(labName);
  }, [labName]);

  // Nhận diện Lab hiện tại từ labId hoặc labName
  const currentMatchedLab = useMemo<TestingLaboratory | null>(() => {
    if (labId) {
      const byId = laboratories.find((l) => l.id === labId);
      if (byId) return byId;
    }
    if (labName) {
      const match = matchLaboratory(labName, laboratories);
      if (match) return match.lab;
    }
    return null;
  }, [labId, labName, laboratories]);

  // Lọc danh sách gợi ý theo từ khóa người dùng gõ
  const filteredLaboratories = useMemo(() => {
    const query = normalizeLabQuery(labSearchQuery);
    if (!query) return laboratories;

    return laboratories.filter((l) => {
      if (normalizeLabQuery(l.canonicalName).includes(query)) return true;
      if (l.code.toLowerCase().includes(query.toLowerCase())) return true;
      if (Array.isArray(l.aliases)) {
        return l.aliases.some((a) => normalizeLabQuery(a).includes(query));
      }
      return false;
    });
  }, [laboratories, labSearchQuery]);

  // Xử lý chọn Lab từ dropdown gợi ý
  const handleSelectLab = (lab: TestingLaboratory) => {
    setFieldValue('labName', lab.canonicalName);
    setFieldValue('labId', lab.id);
    setLabSearchQuery(lab.canonicalName);
    setShowLabDropdown(false);
  };

  // Xử lý khi người dùng rời khỏi ô input (Blur) - Tự động đối chiếu mờ (Auto-Resolve)
  const handleLabInputBlur = () => {
    setTimeout(() => {
      setShowLabDropdown(false);

      if (!labSearchQuery.trim()) {
        setFieldValue('labName', '');
        setFieldValue('labId', '');
        return;
      }

      // Đối chiếu mờ thông minh
      const match = matchLaboratory(labSearchQuery, laboratories);
      if (match) {
        setFieldValue('labName', match.lab.canonicalName);
        setFieldValue('labId', match.lab.id);
        setLabSearchQuery(match.lab.canonicalName);
      } else {
        // Nếu là đơn vị tự do chưa có trong từ điển
        setFieldValue('labName', labSearchQuery.trim());
        setFieldValue('labId', '');
      }
    }, 200);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cột 1: Chọn Lô Hàng */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Chọn Lô hàng cần test *
          </label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted w-5 h-5" />
            <input
              type="text"
              value={batchSearch}
              onChange={(e) => {
                setBatchSearch(e.target.value);
                setShowBatchDropdown(true);
                if (!e.target.value) setFieldValue('batchId', '');
              }}
              onFocus={() => setShowBatchDropdown(true)}
              onBlur={() => setTimeout(() => setShowBatchDropdown(false), 200)}
              placeholder="Tìm kiếm Lô hàng (Số lô hoặc Tên SP)..."
              disabled={isEditMode}
              className="w-full pl-10 pr-10 py-2.5 bg-surface border border-border rounded-xl font-medium text-ink placeholder:text-ink-muted outline-none text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-60 transition-all"
            />
            {batchId && (
              <CheckCircleIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-600 w-5 h-5" />
            )}

            {showBatchDropdown && (
              <div className="absolute z-20 w-full mt-2 bg-surface rounded-xl shadow-xl border border-border max-h-60 overflow-y-auto divide-y divide-border">
                {availableBatchesForDropdown.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => {
                      handleBatchSelect(b.id);
                      setBatchSearch(`${b.batchNo} - ${b.product?.name}`);
                      setShowBatchDropdown(false);
                    }}
                    className={`px-4 py-3 hover:bg-surface-2 cursor-pointer transition-colors ${
                      batchId === b.id
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : ''
                    }`}
                  >
                    <p className="text-sm font-semibold text-ink uppercase">Lô: {b.batchNo}</p>
                    <p className="text-xs text-ink-muted">{b.product?.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cột 2: Đơn vị Kiểm nghiệm (Autocomplete Combobox) & Ngày xuất phiếu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5" ref={labComboboxRef}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
                <BuildingOffice2Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Đơn vị kiểm nghiệm *
              </label>
              {currentMatchedLab && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <ShieldCheckIcon className="w-3.5 h-3.5" />
                  Đã chuẩn hóa
                </span>
              )}
            </div>

            {/* Input ẩn lưu labId cho form serialize */}
            <input type="hidden" name="labId" value={labId || currentMatchedLab?.id || ''} />

            <div className="relative">
              <input
                type="text"
                name="labName"
                value={labSearchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setLabSearchQuery(val);
                  setFieldValue('labName', val);
                  setShowLabDropdown(true);

                  // Dò nhanh exact match
                  const quickMatch = laboratories.find(
                    (l) =>
                      l.canonicalName.toLowerCase() === val.trim().toLowerCase() ||
                      l.code.toLowerCase() === val.trim().toLowerCase()
                  );
                  if (quickMatch) {
                    setFieldValue('labId', quickMatch.id);
                  }
                }}
                onFocus={() => setShowLabDropdown(true)}
                onBlur={handleLabInputBlur}
                required
                placeholder="VD: Quatest 3, CASE, Phòng QC..."
                className="w-full pl-3.5 pr-10 py-2.5 bg-surface border border-border rounded-xl font-medium text-ink placeholder:text-ink-muted outline-none text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              />

              <button
                type="button"
                onClick={() => setShowLabDropdown(!showLabDropdown)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink transition-colors"
                tabIndex={-1}
              >
                <ChevronUpDownIcon className="w-4 h-4" />
              </button>

              {/* Dropdown Gợi ý Đơn vị Kiểm nghiệm Chuẩn hóa */}
              {showLabDropdown && (
                <div className="absolute z-30 w-full mt-1.5 bg-surface rounded-xl shadow-2xl border border-border max-h-64 overflow-y-auto divide-y divide-border">
                  <div className="p-2 bg-surface-2/60 text-[11px] font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-1.5 sticky top-0 backdrop-blur-md">
                    <SparklesIcon className="w-3.5 h-3.5 text-emerald-600" />
                    Danh mục chuẩn hóa (Master Data)
                  </div>

                  {filteredLaboratories.length > 0 ? (
                    filteredLaboratories.map((lab) => {
                      const isSelected =
                        (labId && labId === lab.id) ||
                        lab.canonicalName.toLowerCase() === labName.trim().toLowerCase();

                      return (
                        <div
                          key={lab.id}
                          onMouseDown={(e) => {
                            e.preventDefault(); // Tránh kích hoạt onBlur trước khi chọn
                            handleSelectLab(lab);
                          }}
                          className={`p-3 hover:bg-surface-2 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-ink leading-snug">
                              {lab.canonicalName}
                            </p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  lab.type === 'INTERNAL'
                                    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                                    : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20'
                                }`}
                              >
                                {lab.type === 'INTERNAL' ? 'Nội bộ' : 'Ngoại kiểm'}
                              </span>
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-surface-2 rounded text-ink-soft border border-border">
                                {lab.code}
                              </span>
                            </div>
                          </div>

                          {lab.aliases && lab.aliases.length > 0 && (
                            <p className="text-[11px] text-ink-muted mt-1 truncate">
                              Bí danh: {lab.aliases.slice(0, 4).join(' • ')}
                            </p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-3 text-xs text-ink-muted text-center">
                      Không tìm thấy đơn vị chuẩn. Hệ thống sẽ lưu dưới dạng đơn vị mới:{' '}
                      <b className="text-ink">"{labSearchQuery}"</b>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chi tiết chuẩn hóa phía dưới input */}
            {currentMatchedLab ? (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 px-1">
                <CheckCircleIcon className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Gán mã chuẩn: <b>{currentMatchedLab.code}</b> ({currentMatchedLab.canonicalName})
                </span>
              </div>
            ) : labName.trim() ? (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 px-1">
                <ExclamationCircleIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Đơn vị tự do. Dữ liệu có thể cần chuẩn hóa sau này.</span>
              </div>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <DSDateInput
              label="Ngày xuất phiếu *"
              name="testDate"
              value={testDate}
              onChange={(val) => setFieldValue('testDate', val)}
              required
            />
          </div>
        </div>
      </div>

      {batchId && selectedBatch && (
        <div className="space-y-3">
          <div className="bg-surface-2 p-3.5 rounded-xl border border-border flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <CubeIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-ink">{selectedBatch.product?.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HashtagIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {selectedBatch.batchNo}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-ink-muted" />
              <span className="text-ink-soft">
                SX: {selectedBatch.mfgDate ? formatDateStandard(selectedBatch.mfgDate) : '---'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4 text-ink-muted" />
              <span className="text-ink-soft">
                HD: {selectedBatch.expDate ? formatDateStandard(selectedBatch.expDate) : '---'}
              </span>
            </div>
          </div>

          {existingResultsForBatch.length > 0 && (
            <div className="bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/20">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ExclamationCircleIcon className="w-4 h-4" /> Lô này đã có{' '}
                  {existingResultsForBatch.length} phiếu kết quả:
                </p>
                <button
                  type="button"
                  onClick={() => window.open(getAppUrl(`/test-results/coa/${batchId}`), '_blank')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <PrinterIcon className="w-3.5 h-3.5" /> Xem CoA Tổng hợp
                </button>
              </div>
              <div className="space-y-1.5">
                {existingResultsForBatch.map((r: any) => (
                  <div
                    key={r.id}
                    className="flex justify-between items-center text-xs bg-surface p-2.5 rounded-lg border border-border"
                  >
                    <span className="font-medium text-ink">
                      {r.labName}{' '}
                      <span className="text-ink-muted font-normal">
                        ({formatDateStandard(r.testDate)})
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          r.overallStatus === TEST_RESULT_STATUS.PASS
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {r.overallStatus}
                      </span>
                      <button
                        type="button"
                        onClick={() => switchToEditMode(r)}
                        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Sửa phiếu này
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 italic mt-2 text-center">
                Bạn đang tạo phiếu kết quả <b>MỚI</b> (ví dụ: gửi mẫu thêm cho đơn vị khác).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
