import React from 'react';
import { 
  MagnifyingGlassIcon, 
  XMarkIcon, 
  CalendarIcon, 
  ArrowDownTrayIcon, 
  SparklesIcon, 
  ArrowPathIcon 
} from '@heroicons/react/24/outline';
import { DSFilterBar } from '../../../../components';
import { Product } from '../../../../types';

interface ReportFilterBarProps {
  productSearch: string;
  setProductSearch: (v: string) => void;
  showProductDropdown: boolean;
  setShowProductDropdown: (v: boolean) => void;
  filteredProducts: Product[];
  selectedProductId: string;
  setSelectedProductId: (id: string) => void;
  handleInputBlur: () => void;
  dateRange: { from: string; to: string };
  setDateRange: React.Dispatch<React.SetStateAction<{ from: string; to: string }>>;
  reportDataLength: number;
  handleExportExcel: () => void;
  handleGeneratePQR: (useAi?: boolean) => Promise<void>;
  isGeneratingNarrative: boolean;
}

export const ReportFilterBar: React.FC<ReportFilterBarProps> = ({
  productSearch,
  setProductSearch,
  showProductDropdown,
  setShowProductDropdown,
  filteredProducts,
  selectedProductId,
  setSelectedProductId,
  handleInputBlur,
  dateRange,
  setDateRange,
  reportDataLength,
  handleExportExcel,
  handleGeneratePQR,
  isGeneratingNarrative
}) => {
  return (
    <DSFilterBar>
      {/* Product Search & Dropdown */}
      <div className="relative flex-1 min-w-[280px]">
        <div className="relative">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={productSearch}
            onChange={e => {
              setProductSearch(e.target.value);
              setShowProductDropdown(true);
            }}
            onFocus={() => setShowProductDropdown(true)}
            onBlur={handleInputBlur}
            placeholder="Tìm theo mã hoặc tên sản phẩm..."
            className="w-full pl-9 pr-8 py-2.5 bg-surface border border-border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-ink placeholder-ink-muted"
          />
          {productSearch && (
            <button
              type="button"
              onClick={() => {
                setProductSearch('');
                setSelectedProductId('');
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink rounded-lg cursor-pointer"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {showProductDropdown && filteredProducts.length > 0 && (
          <div className="absolute z-50 left-0 right-0 mt-1.5 bg-surface border border-border rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-border">
            {filteredProducts.map(p => (
              <div
                key={p.id}
                onMouseDown={() => {
                  setSelectedProductId(p.id);
                  setProductSearch(`${p.code} - ${p.name}`);
                  setShowProductDropdown(false);
                }}
                className={`p-2.5 hover:bg-surface-2 cursor-pointer text-xs flex items-center justify-between transition-colors ${
                  selectedProductId === p.id ? 'bg-emerald-500/10 font-black text-emerald-700 dark:text-emerald-300' : 'text-ink'
                }`}
              >
                <div>
                  <span className="font-mono font-bold mr-2 text-emerald-600 dark:text-emerald-400">[{p.code}]</span>
                  <span>{p.name}</span>
                </div>
                {p.group && <span className="text-[10px] text-ink-muted">{p.group}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Date Range Inputs */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-xl border border-border text-xs">
          <CalendarIcon className="w-4 h-4 text-ink-muted" />
          <input
            type="date"
            value={dateRange.from}
            onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            className="bg-transparent border-none text-xs text-ink outline-none cursor-pointer"
          />
          <span className="text-ink-muted font-bold">→</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            className="bg-transparent border-none text-xs text-ink outline-none cursor-pointer"
          />
        </div>
        {(dateRange.from || dateRange.to) && (
          <button
            type="button"
            onClick={() => setDateRange({ from: '', to: '' })}
            className="p-2 text-ink-muted hover:text-ink bg-surface border border-border hover:bg-surface-2 rounded-xl transition-colors text-xs"
            title="Xóa lọc ngày"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 ml-auto">
        {reportDataLength > 0 && (
          <>
            <button
              type="button"
              onClick={() => handleGeneratePQR(true)}
              disabled={isGeneratingNarrative}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isGeneratingNarrative ? (
                <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <SparklesIcon className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>{isGeneratingNarrative ? 'Đang phân tích...' : 'AI Nhận định PQR'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-surface hover:bg-surface-2 text-ink border border-border rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <ArrowDownTrayIcon className="w-3.5 h-3.5 text-ink-muted" />
              <span>Xuất Excel</span>
            </button>
          </>
        )}
      </div>
    </DSFilterBar>
  );
};
