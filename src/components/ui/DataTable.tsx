import React, { useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

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
 * DataTable - Tailwind UI Standard Data Table
 * Hỗ trợ sticky header, chuyển đổi mật độ compact/comfortable và hover highlight chuẩn Tailwind UI.
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

  const cellPadding = density === 'compact' ? 'py-2.5 px-3 text-xs' : 'py-3.5 px-4 text-sm';
  const headerPadding = density === 'compact' ? 'py-2.5 px-3 text-xs' : 'py-3.5 px-4 text-xs';

  return (
    <div className={`flex flex-col rounded-xl border border-border bg-surface shadow-xs overflow-hidden ${className}`}>
      {allowDensityToggle && (
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-surface-2/50 text-xs text-ink-muted">
          <span className="font-medium">Tổng số <span className="text-ink font-semibold">{data.length}</span> bản ghi</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-ink-muted">Mật độ:</span>
            <div className="inline-flex rounded-lg p-0.5 bg-surface-3/60">
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                  density === 'compact'
                    ? 'bg-surface text-emerald-700 dark:text-emerald-400 shadow-2xs font-semibold'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                Thu gọn
              </button>
              <button
                type="button"
                onClick={() => setDensity('comfortable')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                  density === 'comfortable'
                    ? 'bg-surface text-emerald-700 dark:text-emerald-400 shadow-2xs font-semibold'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                Tiêu chuẩn
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-surface-2/80 dark:bg-surface-3/80 backdrop-blur-xs text-ink-muted font-semibold border-b border-border">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`${headerPadding} text-[11px] font-semibold tracking-wider uppercase ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-ink-muted">
                  <div className="flex flex-col items-center justify-center gap-2">
                    {emptyIcon || <MagnifyingGlassIcon className="w-7 h-7 opacity-30 text-ink-muted" />}
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
                        ? 'bg-surface-2/30 dark:bg-surface-3/20'
                        : 'bg-surface'
                    } hover:bg-surface-2/60 dark:hover:bg-surface-2/40`}
                  >
                    {columns.map((col) => {
                      const content = col.render
                        ? col.render(item, index)
                        : (item as any)[col.key];

                      return (
                        <td
                          key={`${key}-${col.key}`}
                          className={`${cellPadding} text-ink leading-relaxed ${
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

