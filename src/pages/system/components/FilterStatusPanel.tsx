import React from 'react';
import { FunnelIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useUIStore } from '../../../store/useUIStore';
import { useShallow } from 'zustand/react/shallow';

/** Panel hiển thị trạng thái bộ lọc đã lưu và cho phép reset từng trang */
export const FilterStatusPanel: React.FC = () => {
  const {
    batchFilterStatus,
    batchFilterYear,
    batchFilterMonth,
    batchFilterProductId,
    batchSortConfig,
    productFilterType,
    productFilterStatus,
    productSort,
    testResultFilterYear,
    testResultFilterMonth,
    testResultFilterProductId,
    testResultSortConfig,
    resetPreferences,
  } = useUIStore(
    useShallow((s) => ({
      batchFilterStatus: s.batchFilterStatus,
      batchFilterYear: s.batchFilterYear,
      batchFilterMonth: s.batchFilterMonth,
      batchFilterProductId: s.batchFilterProductId,
      batchSortConfig: s.batchSortConfig,
      productFilterType: s.productFilterType,
      productFilterStatus: s.productFilterStatus,
      productSort: s.productSort,
      testResultFilterYear: s.testResultFilterYear,
      testResultFilterMonth: s.testResultFilterMonth,
      testResultFilterProductId: s.testResultFilterProductId,
      testResultSortConfig: s.testResultSortConfig,
      resetPreferences: s.resetPreferences,
    }))
  );

  const batchHasFilters =
    batchFilterStatus !== 'ALL' ||
    batchFilterYear !== 'ALL' ||
    batchFilterMonth !== 'ALL' ||
    batchFilterProductId !== '';
  const productHasFilters =
    productFilterType !== 'ALL' || productFilterStatus !== 'ALL' || productSort.key !== 'createdAt';
  const testResultHasFilters =
    testResultFilterYear !== 'ALL' ||
    testResultFilterMonth !== 'ALL' ||
    testResultFilterProductId !== '';
  const anyFilter = batchHasFilters || productHasFilters || testResultHasFilters;

  const resetBatchFilters = () =>
    useUIStore.setState({
      batchFilterStatus: 'ALL',
      batchFilterYear: 'ALL',
      batchFilterMonth: 'ALL',
      batchFilterProductId: '',
      batchSortConfig: { key: 'createdAt', direction: 'desc' },
    });
  const resetProductFilters = () =>
    useUIStore.setState({
      productFilterType: 'ALL',
      productFilterStatus: 'ALL',
      productSort: { key: 'createdAt', direction: 'desc' },
    });
  const resetTestResultFilters = () =>
    useUIStore.setState({
      testResultFilterYear: 'ALL',
      testResultFilterMonth: 'ALL',
      testResultFilterProductId: '',
      testResultSortConfig: { key: 'testDate', direction: 'desc' },
    });

  return (
    <div className="pt-2 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-semibold text-ink flex items-center gap-2">
          <FunnelIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Bộ lọc đã lưu
          {anyFilter ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Đang lưu
            </span>
          ) : (
            <span className="text-[10px] font-normal text-ink-muted">(mặc định)</span>
          )}
        </label>
        {anyFilter && (
          <button
            onClick={resetPreferences}
            className="text-xs text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-1 active:scale-[0.98]"
          >
            <ArrowPathIcon className="w-3 h-3" /> Xóa tất cả bộ lọc
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Lô hàng */}
        <div
          className={`rounded-xl border p-3 space-y-1.5 transition-all ${batchHasFilters ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-surface-2/60 border-border'}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
              Trang Lô hàng
            </p>
            {batchHasFilters && (
              <button
                onClick={resetBatchFilters}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Reset
              </button>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Trạng thái:</span>
              <span
                className={`font-medium ${batchFilterStatus !== 'ALL' ? 'text-indigo-600 dark:text-indigo-400' : 'text-ink-muted'}`}
              >
                {batchFilterStatus}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Năm / Tháng:</span>
              <span
                className={`font-medium ${batchFilterYear !== 'ALL' || batchFilterMonth !== 'ALL' ? 'text-indigo-600 dark:text-indigo-400' : 'text-ink-muted'}`}
              >
                {batchFilterYear === 'ALL' ? '—' : batchFilterYear} /{' '}
                {batchFilterMonth === 'ALL' ? '—' : `T${batchFilterMonth}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Sắp xếp:</span>
              <span className="font-medium text-ink-muted">
                {batchSortConfig.key} {batchSortConfig.direction}
              </span>
            </div>
          </div>
        </div>

        {/* Sản phẩm */}
        <div
          className={`rounded-xl border p-3 space-y-1.5 transition-all ${productHasFilters ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-surface-2/60 border-border'}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
              Trang Sản phẩm
            </p>
            {productHasFilters && (
              <button
                onClick={resetProductFilters}
                className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Reset
              </button>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Nguồn gốc:</span>
              <span
                className={`font-medium ${productFilterType !== 'ALL' ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-muted'}`}
              >
                {productFilterType}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Trạng thái:</span>
              <span
                className={`font-medium ${productFilterStatus !== 'ALL' ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-muted'}`}
              >
                {productFilterStatus}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Sắp xếp:</span>
              <span className="font-medium text-ink-muted">
                {productSort.key} {productSort.direction}
              </span>
            </div>
          </div>
        </div>

        {/* Kết quả Lab */}
        <div
          className={`rounded-xl border p-3 space-y-1.5 transition-all ${testResultHasFilters ? 'bg-sky-500/5 border-sky-500/20' : 'bg-surface-2/60 border-border'}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
              Kết quả Lab
            </p>
            {testResultHasFilters && (
              <button
                onClick={resetTestResultFilters}
                className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline"
              >
                Reset
              </button>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Năm / Tháng:</span>
              <span
                className={`font-medium ${testResultFilterYear !== 'ALL' || testResultFilterMonth !== 'ALL' ? 'text-sky-600 dark:text-sky-400' : 'text-ink-muted'}`}
              >
                {testResultFilterYear === 'ALL' ? '—' : testResultFilterYear} /{' '}
                {testResultFilterMonth === 'ALL' ? '—' : `T${testResultFilterMonth}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Sản phẩm:</span>
              <span
                className={`font-medium ${testResultFilterProductId ? 'text-sky-600 dark:text-sky-400' : 'text-ink-muted'}`}
              >
                {testResultFilterProductId ? '● Đã chọn' : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Sắp xếp:</span>
              <span className="font-medium text-ink-muted">
                {testResultSortConfig.key} {testResultSortConfig.direction}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
