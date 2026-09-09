import React from 'react';
import { 
  Package, Search, X, ChevronDown, Filter, Check, 
  Sparkles, Activity, Calendar, RefreshCw 
} from 'lucide-react';
import { formatDateStandard } from '../../../../utils';
import { highlightMatch } from '../utils/spcHelpers';

interface TrendFilterPanelProps {
  selectedProduct: any;
  selectedProductId: string;
  selectedProductStat: any;
  activeTccs: any;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (open: boolean) => void;
  productSearch: string;
  setProductSearch: (v: string) => void;
  onlyWithData: boolean;
  setOnlyWithData: (v: boolean) => void;
  productGroups: string[];
  selectedGroupFilter: string;
  setSelectedGroupFilter: (v: string) => void;
  activeProducts: any[];
  filteredProducts: any[];
  topProductsWithData: any[];
  productStats: Map<string, any>;
  handleSelectProduct: (id: string) => void;
  handleClearProduct: () => void;
  // Criteria props
  criteriaList: any[];
  filteredCriteriaList: any[];
  criteriaSearch: string;
  setCriteriaSearch: (v: string) => void;
  selectedCriteriaName: string;
  setSelectedCriteriaName: (v: string) => void;
  selectedCriteria: any;
  declaredBasis: number | undefined;
  basisInfo: any;
  manualBasisChoice: string;
  setManualBasisChoice: (choice: 'AUTO' | 'ELEMENTAL' | 'DECLARED') => void;
  // Date props
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  activeDatePreset: string;
  handleApplyDatePreset: (preset: 'ALL' | '3M' | '6M' | '1Y' | 'YEAR') => void;
}

export const TrendFilterPanel: React.FC<TrendFilterPanelProps> = ({
  selectedProduct,
  selectedProductId,
  selectedProductStat,
  activeTccs,
  dropdownRef,
  searchInputRef,
  isDropdownOpen,
  setIsDropdownOpen,
  productSearch,
  setProductSearch,
  onlyWithData,
  setOnlyWithData,
  productGroups,
  selectedGroupFilter,
  setSelectedGroupFilter,
  activeProducts,
  filteredProducts,
  topProductsWithData,
  productStats,
  handleSelectProduct,
  handleClearProduct,
  criteriaList,
  filteredCriteriaList,
  criteriaSearch,
  setCriteriaSearch,
  selectedCriteriaName,
  setSelectedCriteriaName,
  selectedCriteria,
  declaredBasis,
  basisInfo,
  setManualBasisChoice,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  activeDatePreset,
  handleApplyDatePreset
}) => {
  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-sm p-4 md:p-5 space-y-4">
      
      {/* Selected Product Card Banner */}
      {selectedProduct ? (
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/90 via-slate-50 to-purple-50/50 dark:from-indigo-950/30 dark:via-zinc-900/60 dark:to-purple-950/20 border border-indigo-200/80 dark:border-indigo-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start md:items-center gap-3.5">
            <div className="p-3 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-xl shadow-md flex-shrink-0">
              <Package size={22} />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white shadow-sm">
                  {selectedProduct.code}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  {selectedProduct.name}
                </h3>
                {selectedProduct.group && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                    {selectedProduct.group}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
                {selectedProduct.registrationNo && (
                  <span>SĐK: <strong className="text-slate-700 dark:text-zinc-200">{selectedProduct.registrationNo}</strong></span>
                )}
                <span>Tiêu chuẩn: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{activeTccs ? activeTccs.code : 'Chưa có TCCS'}</strong></span>
                <span>Tổng dữ liệu: <strong className="text-slate-700 dark:text-zinc-200">{selectedProductStat?.batchCount || 0} lô sản xuất</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              className="px-3.5 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700 text-slate-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Search size={14} /> Thay đổi sản phẩm
            </button>
            <button
              type="button"
              onClick={handleClearProduct}
              className="p-2 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 rounded-xl transition-all cursor-pointer"
              title="Bỏ chọn sản phẩm"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : null}

      {/* Search & Combobox Container */}
      <div ref={dropdownRef} className="relative">
        {!selectedProduct && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
              <Search size={14} className="text-indigo-500" /> Chọn sản phẩm cần phân tích xu hướng SPC
            </label>

            <div
              onClick={() => {
                setIsDropdownOpen(true);
                searchInputRef.current?.focus();
              }}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-all cursor-text ${
                isDropdownOpen
                  ? 'bg-white dark:bg-zinc-950 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                  : 'bg-slate-50/80 dark:bg-zinc-900/80 border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
            >
              <Search size={17} className="text-slate-400 dark:text-zinc-500 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={productSearch}
                onChange={e => {
                  setProductSearch(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Gõ mã sản phẩm, tên sản phẩm, số đăng ký hoặc nhóm để tìm nhanh..."
                className="w-full bg-transparent border-none outline-none text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-medium"
              />
              {productSearch ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setProductSearch('');
                    searchInputRef.current?.focus();
                  }}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-full transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              ) : (
                <ChevronDown
                  size={16}
                  className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`}
                />
              )}
            </div>
          </div>
        )}

        {/* Autocomplete Dropdown Popover */}
        {isDropdownOpen && (
          <div className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="p-3 bg-slate-50/90 dark:bg-zinc-900/90 border-b border-slate-100 dark:border-zinc-800/80 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                  <Filter size={12} /> Bộ lọc nhanh danh mục
                </span>

                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyWithData}
                    onChange={e => setOnlyWithData(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  />
                  <span>Chỉ hiện SP có dữ liệu kiểm nghiệm</span>
                </label>
              </div>

              {productGroups.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedGroupFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedGroupFilter === 'ALL'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:border-slate-300'
                    }`}
                  >
                    Tất cả ({activeProducts.length})
                  </button>
                  {productGroups.map(grp => {
                    const count = activeProducts.filter(p => p.group === grp).length;
                    return (
                      <button
                        key={grp}
                        type="button"
                        onClick={() => setSelectedGroupFilter(grp)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          selectedGroupFilter === grp
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:border-slate-300'
                        }`}
                      >
                        {grp} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-900">
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Package size={32} className="text-slate-300 dark:text-zinc-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-600 dark:text-zinc-300">Không tìm thấy sản phẩm phù hợp</p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500">Thử xóa từ khóa tìm kiếm hoặc bỏ chọn lọc dữ liệu</p>
                </div>
              ) : (
                filteredProducts.map(p => {
                  const isSelected = selectedProductId === p.id;
                  const pStat = productStats.get(p.id) || { batchCount: 0, resultCount: 0 };
                  const hasData = pStat.batchCount > 0;

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProduct(p.id)}
                      className={`p-3 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                        isSelected ? 'bg-indigo-50 dark:bg-indigo-950/40' : ''
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-black px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                            {highlightMatch(p.code, productSearch)}
                          </span>
                          <span className="text-sm font-bold text-slate-800 dark:text-zinc-100 truncate">
                            {highlightMatch(p.name, productSearch)}
                          </span>
                          {p.group && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 shrink-0">
                              {p.group}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-zinc-500">
                          {p.registrationNo && <span>SĐK: {p.registrationNo}</span>}
                          {pStat.lastMfgDate && <span>Lô gần nhất: {formatDateStandard(pStat.lastMfgDate)}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {hasData ? (
                          <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                            {pStat.batchCount} lô ({pStat.resultCount} KQ)
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500">
                            Chưa có lô
                          </span>
                        )}
                        {isSelected && <Check size={16} className="text-indigo-600 dark:text-indigo-400" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2 bg-slate-50 dark:bg-zinc-900/60 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center text-[11px] text-slate-400 dark:text-zinc-500">
              <span>Hiển thị {filteredProducts.length} / {activeProducts.length} sản phẩm</span>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(false)}
                className="hover:text-slate-700 dark:hover:text-zinc-200 font-bold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Picks for products with most data when nothing is selected */}
      {!selectedProduct && topProductsWithData.length > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/60 space-y-2">
          <p className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={12} className="text-amber-500" /> Sản phẩm có nhiều dữ liệu kiểm nghiệm nhất (Chọn nhanh):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {topProductsWithData.map(({ product: p, stats }) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectProduct(p.id)}
                className="p-2.5 text-left rounded-xl border border-slate-200/90 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 hover:bg-indigo-50/40 dark:bg-zinc-900/40 dark:hover:bg-indigo-950/20 transition-all group space-y-1 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                    {p.code}
                  </span>
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                    {stats.batchCount} lô
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-1">
                  {p.name}
                </p>
                {p.group && (
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                    {p.group}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Criteria & Date filters when product is selected */}
      {selectedProduct && (
        <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                <Activity size={14} className="text-indigo-500" /> Chỉ tiêu chất lượng phân tích:
              </label>

              {criteriaList.length > 5 && (
                <div className="relative w-44">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={criteriaSearch}
                    onChange={e => setCriteriaSearch(e.target.value)}
                    placeholder="Tìm chỉ tiêu..."
                    className="w-full pl-7 pr-2 py-1 text-xs bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {criteriaList.length === 0 ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded-xl text-xs flex items-center gap-2">
                Sản phẩm này chưa được thiết lập chỉ tiêu chất lượng trong Tiêu chuẩn cơ sở (TCCS).
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredCriteriaList.map((c: any) => {
                  const isSelected = selectedCriteriaName === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setSelectedCriteriaName(c.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800'
                      }`}
                    >
                      {isSelected && <Check size={13} className="stroke-[3]" />}
                      <span>{c.name}</span>
                      {c.unit && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                          isSelected ? 'bg-indigo-700/80 text-indigo-100' : 'bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                        }`}>
                          {c.unit}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedCriteria && (
              <div className="p-3 bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-zinc-900/80 dark:to-indigo-950/20 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="font-bold text-slate-700 dark:text-zinc-200">
                    Chỉ tiêu: <strong className="text-indigo-600 dark:text-indigo-400">{selectedCriteria.name}</strong>
                  </span>
                  {selectedCriteria.unit && (
                    <span className="text-slate-500 dark:text-zinc-400">Đơn vị: <strong>{selectedCriteria.unit}</strong></span>
                  )}
                  {(selectedCriteria.min !== undefined || selectedCriteria.max !== undefined) && (
                    <span className="text-slate-500 dark:text-zinc-400">
                      Giới hạn TCCS: <strong className="font-mono text-slate-700 dark:text-zinc-300">{selectedCriteria.min ?? 0} – {selectedCriteria.max ?? '∞'} {selectedCriteria.unit}</strong>
                    </span>
                  )}
                  {declaredBasis && declaredBasis > 0 ? (
                    <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                      Chuẩn tính %: <strong className="font-mono text-indigo-600 dark:text-indigo-400 font-black">{declaredBasis} {selectedCriteria.unit}</strong>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        basisInfo.basisType === 'ELEMENTAL'
                          ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          : basisInfo.basisType === 'DECLARED'
                          ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                      }`}>
                        {basisInfo.basisType === 'ELEMENTAL' ? '⚡ Thang Nguyên tố' : basisInfo.basisType === 'DECLARED' ? '🧂 Thang Muối' : 'TCCS'}
                      </span>
                    </span>
                  ) : null}
                </div>

                {basisInfo.isElementalCandidate && basisInfo.elementalContent && basisInfo.saltContent && (
                  <div className="flex items-center gap-1 bg-white dark:bg-zinc-950 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1.5">Gốc tính:</span>
                    <button
                      type="button"
                      onClick={() => setManualBasisChoice('ELEMENTAL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        basisInfo.basisType === 'ELEMENTAL'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      ⚡ Nguyên tố ({basisInfo.elementalContent})
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualBasisChoice('DECLARED')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        basisInfo.basisType === 'DECLARED'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      🧂 Muối ({basisInfo.saltContent})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 flex items-center gap-1 mr-1">
                <Calendar size={13} /> Mốc thời gian:
              </span>
              {[
                { key: 'ALL', label: 'Tất cả' },
                { key: '3M', label: '3 tháng gần nhất' },
                { key: '6M', label: '6 tháng' },
                { key: '1Y', label: '1 năm qua' },
                { key: 'YEAR', label: 'Năm nay' },
              ].map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handleApplyDatePreset(p.key as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeDatePreset === p.key
                      ? 'bg-slate-800 dark:bg-zinc-200 text-white dark:text-zinc-900 shadow-sm'
                      : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs w-full lg:w-auto">
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800">
                <span className="text-slate-400 font-medium">Từ:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="bg-transparent border-none outline-none text-slate-700 dark:text-zinc-200 text-xs font-medium"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800">
                <span className="text-slate-400 font-medium">Đến:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="bg-transparent border-none outline-none text-slate-700 dark:text-zinc-200 text-xs font-medium"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => handleApplyDatePreset('ALL')}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-lg transition-colors cursor-pointer"
                  title="Đặt lại khoảng ngày"
                >
                  <RefreshCw size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
