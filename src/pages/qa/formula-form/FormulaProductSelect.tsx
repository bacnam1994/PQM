import React from 'react';
import { MagnifyingGlassIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { Product } from '../../../types';
import { normalizeSearch } from '../../../utils';

interface FormulaProductSelectProps {
  selectedProductId: string;
  productSearch: string;
  showProductDropdown: boolean;
  isEditMode: boolean;
  products: Product[];
  setProductSearch: (search: string) => void;
  setShowProductDropdown: (show: boolean) => void;
  onSelectProduct: (product: Product) => void;
  onClearProduct: () => void;
}

export const FormulaProductSelect: React.FC<FormulaProductSelectProps> = ({
  selectedProductId,
  productSearch,
  showProductDropdown,
  isEditMode,
  products,
  setProductSearch,
  setShowProductDropdown,
  onSelectProduct,
  onClearProduct,
}) => {
  const filteredProducts = products.filter(
    (p) =>
      !productSearch ||
      normalizeSearch(p.name).includes(normalizeSearch(productSearch)) ||
      normalizeSearch(p.code).includes(normalizeSearch(productSearch))
  );

  return (
    <div className="relative">
      <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5 block">
        Sản phẩm áp dụng *
      </label>
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted h-4 w-4" />
        <input
          type="text"
          value={productSearch}
          onChange={(e) => {
            setProductSearch(e.target.value);
            setShowProductDropdown(true);
            if (!e.target.value) onClearProduct();
          }}
          onFocus={() => setShowProductDropdown(true)}
          onBlur={() => setTimeout(() => setShowProductDropdown(false), 250)}
          placeholder="Tìm kiếm mã hoặc tên sản phẩm..."
          className="w-full pl-10 pr-10 py-2.5 bg-surface border border-border rounded-xl font-medium text-sm text-ink outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all shadow-2xs"
          disabled={isEditMode}
        />
        {selectedProductId && (
          <CheckCircleIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400 h-5 w-5" />
        )}
      </div>

      {showProductDropdown && !isEditMode && (
        <div className="absolute z-30 w-full mt-1.5 bg-surface rounded-xl shadow-xl border border-border max-h-60 overflow-y-auto">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelectProduct(p)}
              className={`px-4 py-3 hover:bg-surface-2 cursor-pointer border-b border-border last:border-none transition-colors ${selectedProductId === p.id ? 'bg-surface-2' : ''}`}
            >
              <p className="text-sm font-semibold text-ink">{p.name}</p>
              <p className="text-[10px] font-mono font-medium text-ink-muted uppercase">{p.code}</p>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="px-4 py-3 text-xs text-ink-muted text-center">
              Không tìm thấy sản phẩm phù hợp
            </div>
          )}
        </div>
      )}
    </div>
  );
};
