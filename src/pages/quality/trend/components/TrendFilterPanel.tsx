import React from 'react';
import { 
  CubeIcon, 
  MagnifyingGlassIcon, 
  XMarkIcon, 
  ChevronDownIcon, 
  FunnelIcon, 
  CheckIcon, 
  SparklesIcon, 
  ChartBarIcon, 
  CalendarIcon, 
  ArrowPathIcon 
} from '@heroicons/react/24/outline';
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
    <div className="bg-surface rounded-2xl border border-border shadow-sm p-4 md:p-5 space-y-4">
      
      {/* Selected Product Card Banner */}
      {selectedProduct ? (
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-surface to-teal-500/10 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start md:items-center gap-3.5">
            <div className="p-3 bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-xl shadow-md shrink-0">
              <CubeIcon className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white shadow-sm">
                  {selectedProduct.code}
                </span>
                <h3 className="text-base font-bold text-ink">
                  {selectedProduct.name}
                </h3>
                {selectedProduct.group && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-surface-2 text-ink-muted border border-border">
                    {selectedProduct.group}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                {selectedProduct.registrationNo && (
                  <span>SĐK: <strong className="text-ink">{selectedProduct.registrationNo}</strong></span>
                )}
                <span>Tiêu chuẩn: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{activeTccs ? activeTccs.code : 'Chưa có TCCS'}</strong></span>
                <span>Tổng dữ liệu: <strong className="text-ink">{selectedProductStat?.batchCount || 0} lô sản xuất</strong></span>
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
              className="px-3.5 py-2 bg-surface border border-border hover:border-emerald-500 text-ink hover:text-emerald-600 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <MagnifyingGlassIcon className="w-3.5 h-3.5" /> Thay đổi sản phẩm
            </button>
            <button
              type="button"
              onClick={handleClearProduct}
              className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-xl transition-all cursor-pointer"
              title="Bỏ chọn sản phẩm"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Search & Combobox Container */}
      <div ref={dropdownRef} className="relative">
        {!selectedProduct && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink flex items-center gap-1.5">
              <MagnifyingGlassIcon className="w-4 h-4 text-emerald-600" /> Chọn sản phẩm cần phân tích xu hướng SPC
            </label>

            <div
              onClick={() => {
                setIsDropdownOpen(true);
                searchInputRef.current?.focus();
              }}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-all cursor-text ${
                isDropdownOpen
                  ? 'bg-surface border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                  : 'bg-surface-2 border-border hover:border-border-strong'
              }`}
            >
              <MagnifyingGlassIcon className="w-4 h-4 text-ink-muted shrink-0" />
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
                className="w-full bg-transparent border-none outline-none text-sm text-ink placeholder:text-ink-muted font-medium"
              />
              {productSearch ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setProductSearch('');
                    searchInputRef.current?.focus();
                  }}
                  className="p-1 hover:bg-surface-3 text-ink-muted hover:text-ink rounded-full transition-colors cursor-pointer"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              ) : (
                <ChevronDownIcon
                  className={`w-4 h-4 text-ink-muted transition-transform ${isDropdownOpen ? 'rotate-180 text-emerald-600' : ''}`}
                />
              )}
            </div>
          </div>
        )}

        {/* Autocomplete Dropdown Popover */}
        {isDropdownOpen && (
          <div className="absolute z-50 left-0 right-0 mt-2 bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="p-3 bg-surface-2 border-b border-border space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                  <FunnelIcon className="w-3.5 h-3.5 text-emerald-600" /> Bộ lọc nhanh danh mục
                </span>

                <label className="flex items-center gap-1.5 text-xs text-ink-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyWithData}
                    onChange={e => setOnlyWithData(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
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
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-surface text-ink border border-border hover:bg-surface-3'
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
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-surface text-ink border border-border hover:bg-surface-3'
                        }`}
                      >
                        {grp} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-border">
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <CubeIcon className="w-8 h-8 text-ink-muted mx-auto" />
                  <p className="text-xs font-bold text-ink">Không tìm thấy sản phẩm phù hợp</p>
                  <p className="text-[11px] text-ink-muted">Thử xóa từ khóa tìm kiếm hoặc bỏ chọn lọc dữ liệu</p>
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
                      className={`p-3 hover:bg-surface-2 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                        isSelected ? 'bg-emerald-500/10' : ''
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-black px-2 py-0.5 rounded bg-surface-2 text-ink border border-border">
                            {highlightMatch(p.code, productSearch)}
                          </span>
                          <span className="text-sm font-bold text-ink truncate">
                            {highlightMatch(p.name, productSearch)}
                          </span>
                          {p.group && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-2 text-ink-muted shrink-0 border border-border">
                              {p.group}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-ink-muted">
                          {p.registrationNo && <span>SĐK: {p.registrationNo}</span>}
                          {pStat.lastMfgDate && <span>Lô gần nhất: {formatDateStandard(pStat.lastMfgDate)}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {hasData ? (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            {pStat.batchCount} lô ({pStat.resultCount} KQ)
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-2 text-ink-muted">
                            Chưa có lô
                          </span>
                        )}
                        {isSelected && <CheckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2 bg-surface-2 border-t border-border flex justify-between items-center text-[11px] text-ink-muted">
              <span>Hiển thị {filteredProducts.length} / {activeProducts.length} sản phẩm</span>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(false)}
                className="hover:text-ink font-bold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Picks for products with most data when nothing is selected */}
      {!selectedProduct && topProductsWithData.length > 0 && (
        <div className="pt-2 border-t border-border space-y-2">
          <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
            <SparklesIcon className="w-3.5 h-3.5 text-amber-500" /> Sản phẩm có nhiều dữ liệu kiểm nghiệm nhất (Chọn nhanh):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {topProductsWithData.map(({ product: p, stats }) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectProduct(p.id)}
                className="p-2.5 text-left rounded-xl border border-border hover:border-emerald-500/50 bg-surface hover:bg-emerald-500/5 transition-all group space-y-1 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    {p.code}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    {stats.batchCount} lô
                  </span>
                </div>
                <p className="text-xs font-bold text-ink group-hover:text-emerald-600 dark:group-hover:text-emerald-400 line-clamp-1">
                  {p.name}
                </p>
                {p.group && (
                  <p className="text-[10px] text-ink-muted truncate">
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
        <div className="space-y-4 pt-3 border-t border-border">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                <ChartBarIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Chỉ tiêu chất lượng phân tích:
              </label>

              {criteriaList.length > 5 && (
                <div className="relative w-48">
                  <MagnifyingGlassIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input
                    type="text"
                    value={criteriaSearch}
                    onChange={e => setCriteriaSearch(e.target.value)}
                    placeholder="Tìm chỉ tiêu..."
                    className="w-full pl-7 pr-2.5 py-1 text-xs bg-surface-2 border border-border rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 text-ink placeholder:text-ink-muted"
                  />
                </div>
              )}
            </div>

            {criteriaList.length === 0 ? (
              <div className="p-3 bg-amber-500/10 text-amber-800 dark:text-amber-300 rounded-xl text-xs flex items-center gap-2 border border-amber-500/20">
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-surface hover:bg-surface-2 text-ink border border-border'
                      }`}
                    >
                      {isSelected && <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />}
                      <span>{c.name}</span>
                      {c.unit && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                          isSelected ? 'bg-emerald-700 text-white' : 'bg-surface-2 text-ink-muted border border-border'
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
              <div className="p-3 bg-surface-2 rounded-xl border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="font-bold text-ink">
                    Chỉ tiêu: <strong className="text-emerald-600 dark:text-emerald-400">{selectedCriteria.name}</strong>
                  </span>
                  {selectedCriteria.unit && (
                    <span className="text-ink-muted">Đơn vị: <strong className="text-ink">{selectedCriteria.unit}</strong></span>
                  )}
                  {(selectedCriteria.min !== undefined || selectedCriteria.max !== undefined) && (
                    <span className="text-ink-muted">
                      Giới hạn TCCS: <strong className="font-mono text-ink">{selectedCriteria.min ?? 0} – {selectedCriteria.max ?? '∞'} {selectedCriteria.unit}</strong>
                    </span>
                  )}
                  {declaredBasis && declaredBasis > 0 ? (
                    <span className="text-ink-muted flex items-center gap-1.5">
                      Chuẩn tính %: <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{declaredBasis} {selectedCriteria.unit}</strong>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        basisInfo.basisType === 'ELEMENTAL'
                          ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                          : basisInfo.basisType === 'DECLARED'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                          : 'bg-surface text-ink-muted border border-border'
                      }`}>
                        {basisInfo.basisType === 'ELEMENTAL' ? '⚡ Thang Nguyên tố' : basisInfo.basisType === 'DECLARED' ? '🧂 Thang Muối' : 'TCCS'}
                      </span>
                    </span>
                  ) : null}
                </div>

                {basisInfo.isElementalCandidate && basisInfo.elementalContent && basisInfo.saltContent && (
                  <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border shadow-xs shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted px-1.5">Gốc tính:</span>
                    <button
                      type="button"
                      onClick={() => setManualBasisChoice('ELEMENTAL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        basisInfo.basisType === 'ELEMENTAL'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-ink hover:bg-surface-2'
                      }`}
                    >
                      ⚡ Nguyên tố ({basisInfo.elementalContent})
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualBasisChoice('DECLARED')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        basisInfo.basisType === 'DECLARED'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-ink hover:bg-surface-2'
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
              <span className="text-xs font-bold text-ink-muted flex items-center gap-1 mr-1">
                <CalendarIcon className="w-3.5 h-3.5" /> Mốc thời gian:
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeDatePreset === p.key
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-surface text-ink border border-border hover:bg-surface-2'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs w-full lg:w-auto">
              <div className="flex items-center gap-1.5 bg-surface px-2.5 py-1.5 rounded-xl border border-border">
                <span className="text-ink-muted font-medium">Từ:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="bg-transparent border-none outline-none text-ink text-xs font-medium cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-surface px-2.5 py-1.5 rounded-xl border border-border">
                <span className="text-ink-muted font-medium">Đến:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="bg-transparent border-none outline-none text-ink text-xs font-medium cursor-pointer"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => handleApplyDatePreset('ALL')}
                  className="p-1.5 hover:bg-surface-2 text-ink-muted hover:text-ink rounded-lg transition-colors cursor-pointer border border-border"
                  title="Đặt lại khoảng ngày"
                >
                  <ArrowPathIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
