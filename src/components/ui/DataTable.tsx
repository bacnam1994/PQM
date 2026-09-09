import React, { useState } from 'react';
import { AlignJustify, ListFilter, Search } from 'lucide-react';

export type TableDensity = 'compact' | 'comfortable';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T, index: number) => string;
  density?: TableDensity;
  allowDensityToggle?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onRowClick?: (item: T) => void;
  striped?: boolean;
  className?: string;
}

/**
 * DataTable - Bảng dữ liệu mật độ cao chuẩn mực QMS
 * Hỗ trợ sticky header, chuyển đổi mật độ compact/comfortable và hover highlight.
 */
export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  density: initialDensity = 'compact',
  allowDensityToggle = true,
  emptyMessage = 'Không có dữ liệu phù hợp.',
  emptyIcon,
  onRowClick,
  striped = false,
  className = ''
}: DataTableProps<T>) {
  const [density, setDensity] = useState<TableDensity>(initialDensity);

  const cellPadding = density === 'compact' ? 'py-2 px-3 text-xs' : 'py-3.5 px-4 text-sm';
  const headerPadding = density === 'compact' ? 'py-2 px-3 text-xs' : 'py-3 px-4 text-xs';

  return (
    <div className={`flex flex-col rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-xs overflow-hidden ${className}`}>
      {allowDensityToggle && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 text-[11px] text-slate-500 dark:text-slate-400">
          <span>Tổng số {data.length} bản ghi</span>
          <div className="flex items-center gap-1">
            <span className="mr-1">Mật độ:</span>
            <button
              type="button"
              onClick={() => setDensity('compact')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                density === 'compact'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Thu gọn (Compact)
            </button>
            <button
              type="button"
              onClick={() => setDensity('comfortable')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                density === 'comfortable'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Thoáng (Normal)
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-xs text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`${headerPadding} uppercase tracking-wider ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    {emptyIcon || <Search className="w-8 h-8 opacity-30" />}
                    <p className="text-xs font-medium">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const key = keyExtractor(item, index);
                const isClickable = Boolean(onRowClick);

                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(item)}
                    className={`transition-colors ${
                      isClickable ? 'cursor-pointer' : ''
                    } ${
                      striped && index % 2 === 1
                        ? 'bg-slate-50/40 dark:bg-slate-950/20'
                        : 'bg-white dark:bg-slate-900'
                    } hover:bg-blue-50/40 dark:hover:bg-blue-950/20`}
                  >
                    {columns.map((col) => {
                      const content = col.render
                        ? col.render(item, index)
                        : (item as any)[col.key];

                      return (
                        <td
                          key={`${key}-${col.key}`}
                          className={`${cellPadding} text-slate-700 dark:text-slate-200 ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          } ${col.className || ''}`}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
