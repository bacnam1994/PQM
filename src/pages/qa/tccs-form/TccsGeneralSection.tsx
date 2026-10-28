import React from 'react';
import { DSDateInput } from '../../../components';
import { Product } from '../../../types';

interface TccsGeneralSectionProps {
  productId: string;
  code: string;
  issueDate: string;
  packaging: string;
  storage: string;
  shelfLife: string;
  standardRefs: string[];
  products: Product[];
  errors: Record<string, string>;
  productSearch: string;
  setProductSearch: (s: string) => void;
  showProductDropdown: boolean;
  setShowProductDropdown: (show: boolean) => void;
  onProductSelect: (product: Product) => void;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
  onDateChange: (field: string, val: string) => void;
}

export const TccsGeneralSection: React.FC<TccsGeneralSectionProps> = ({
  productId,
  code,
  issueDate,
  packaging,
  storage,
  shelfLife,
  standardRefs,
  products,
  errors,
  productSearch,
  setProductSearch,
  showProductDropdown,
  setShowProductDropdown,
  onProductSelect,
  onChange,
  onDateChange,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
        <span>1. Thông tin chung TCCS</span>
      </div>

      <div className="relative">
        <label className="block text-xs font-semibold text-ink-muted mb-1">
          Sản phẩm áp dụng <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          placeholder="Tìm sản phẩm theo mã hoặc tên..."
          value={productSearch}
          onChange={(e) => {
            setProductSearch(e.target.value);
            setShowProductDropdown(true);
          }}
          onFocus={() => setShowProductDropdown(true)}
          className={`w-full px-4 py-2.5 bg-surface border border-border rounded-xl font-medium text-ink placeholder:text-ink-muted outline-none text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all ${
            errors.productId ? 'ring-2 ring-rose-500 border-rose-500' : ''
          }`}
        />
        {showProductDropdown && (
          <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-surface border border-border rounded-xl shadow-xl divide-y divide-border">
            {products
              .filter(
                (p) =>
                  p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                  p.code.toLowerCase().includes(productSearch.toLowerCase())
              )
              .map((p) => (
                <div
                  key={p.id}
                  onClick={() => onProductSelect(p)}
                  className={`px-4 py-3 hover:bg-surface-2 cursor-pointer transition-colors ${
                    productId === p.id
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : ''
                  }`}
                >
                  <p className="text-sm font-semibold text-ink">{p.name}</p>
                  <p className="text-[11px] font-mono text-ink-muted uppercase">{p.code}</p>
                </div>
              ))}
          </div>
        )}
        {errors.productId && (
          <p className="text-rose-500 text-xs font-medium mt-1 pl-1">{errors.productId}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-ink-muted">Mã hiệu TCCS *</label>
          <input
            placeholder="Mã hiệu TCCS (VD: TCCS-01:2024)"
            name="code"
            value={code}
            onChange={onChange}
            className={`w-full px-4 py-2.5 bg-surface border border-border rounded-xl font-medium text-ink placeholder:text-ink-muted outline-none text-sm uppercase focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all ${
              errors.code ? 'ring-2 ring-rose-500 border-rose-500' : ''
            }`}
          />
          {errors.code && (
            <p className="text-rose-500 text-xs font-medium mt-1 pl-1">{errors.code}</p>
          )}
        </div>
        <div className="space-y-1 flex flex-col justify-end">
          <label className="block text-xs font-semibold text-ink-muted mb-1">Ngày ban hành *</label>
          <DSDateInput value={issueDate} onChange={(val) => onDateChange('issueDate', val)} />
          {errors.issueDate && (
            <p className="text-rose-500 text-xs font-medium mt-1 pl-1">{errors.issueDate}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-ink-muted">Quy cách đóng gói</label>
          <input
            placeholder="VD: Hộp 3 vỉ x 10 viên"
            name="packaging"
            value={packaging}
            onChange={onChange}
            className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-sm text-ink outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-ink-muted">Điều kiện bảo quản</label>
          <input
            placeholder="VD: Nơi khô mát, dưới 30°C"
            name="storage"
            value={storage}
            onChange={onChange}
            className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-sm text-ink outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-ink-muted">Hạn dùng</label>
          <input
            placeholder="VD: 36 tháng"
            name="shelfLife"
            value={shelfLife}
            onChange={onChange}
            className="w-full px-4 py-2 bg-surface border border-border rounded-xl text-sm text-ink outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>
    </div>
  );
};
