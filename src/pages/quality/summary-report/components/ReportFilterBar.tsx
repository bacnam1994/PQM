import React from 'react';
import { Search, X, Calendar, Download, Sparkles, Loader2 } from 'lucide-react';
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
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200"
          />
          {productSearch && (
            <button
              type="button"
              onClick={() => {
                setProductSearch('');
                setSelectedProductId('');
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-full cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {showProductDropdown && filteredProducts.length > 0 && (
          <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-900">
            {filteredProducts.map(p => (
              <div
                key={p.id}
                onMouseDown={() => {
                  setSelectedProductId(p.id);
                  setProductSearch(`${p.code} - ${p.name}`);
                  setShowProductDropdown(false);
                }}
                className={`p-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer text-xs flex items-center justify-between transition-colors ${
                  selectedProductId === p.id ? 'bg-indigo-50/80 dark:bg-indigo-950/60 font-black text-indigo-600' : 'text-slate-700 dark:text-zinc-300'
                }`}
              >
                <div>
                  <span className="font-mono font-bold mr-2 text-indigo-500">[{p.code}]</span>
                  <span>{p.name}</span>
                </div>
                {p.group && <span className="text-[10px] text-slate-400 dark:text-zinc-500">{p.group}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Date Range Inputs */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs">
          <Calendar size={14} className="text-slate-400" />
          <input
            type="date"
            value={dateRange.from}
            onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            className="bg-transparent border-none outline-none text-slate-700 dark:text-zinc-300 font-medium"
          />
          <span className="text-slate-400 font-bold">—</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            className="bg-transparent border-none outline-none text-slate-700 dark:text-zinc-300 font-medium"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 ml-auto">
        {reportDataLength > 0 && (
          <>
            <button
              type="button"
              onClick={() => handleGeneratePQR(true)}
              disabled={isGeneratingNarrative}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingNarrative ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>AI Nhận xét PQR</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Download size={14} />
              <span>Xuất Excel</span>
            </button>
          </>
        )}
      </div>
    </DSFilterBar>
  );
};
