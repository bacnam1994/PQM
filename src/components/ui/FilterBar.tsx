import React from 'react';
import { Search, X } from 'lucide-react';

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
 * FilterBar - Thanh tìm kiếm và bộ lọc nhanh đồng bộ phong cách Workbench
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
    <div className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs ${className}`}>
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                onClear && onClear();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
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
