import React from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

export interface FilterBarProps {
  searchValue: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  onClear?: () => void;
  className?: string;
}

/**
 * FilterBar - Tailwind UI Search and Filter Bar
 * Thanh tìm kiếm và bộ lọc nhanh đồng bộ phong cách Tailwind UI với token hệ thống.
 */
export const FilterBar: React.FC<FilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm nhanh...',
  filters,
  actions,
  onClear,
  className = ''
}) => {
  return (
    <div className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 bg-surface rounded-2xl border border-border shadow-xs ${className}`}>
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-8 py-2 bg-surface-2 border border-border/80 rounded-xl text-xs sm:text-sm font-medium text-ink placeholder-ink-faint outline-none focus:border-emerald-500 focus:bg-surface focus:ring-1 focus:ring-emerald-500 transition-all"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                onClear && onClear();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-ink-faint hover:text-ink hover:bg-surface-3 rounded-md transition-colors"
              aria-label="Xóa tìm kiếm"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dynamic Filters Slot */}
        {filters && (
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {filters}
          </div>
        )}
      </div>

      {/* Extra Actions Slot */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

