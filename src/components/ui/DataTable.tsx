import React, { useState, useId } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { motion, useReducedMotion } from 'motion/react';
import { MOTION_SPRINGS } from '../../lib/motion';
import { AnimatedNumber } from './AnimatedNumber';

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
  ariaLabel?: string;
}

/**
 * DataTable - Enterprise Glassmorphic Data Table
 * Compliant with Modern Web Guidance (responsive-table & interactions-in-complex-layouts)
 * and Impeccable Craft Floor (keyboard scrolling, ARIA semantics, tabular-nums).
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
  className = '',
  ariaLabel = 'Bảng dữ liệu',
}: DataTableProps<T>) {
  const [density, setDensity] = useState<TableDensity>(initialDensity);
  const densityToggleId = useId();
  const shouldReduceMotion = useReducedMotion();

  const cellPadding = density === 'compact' ? 'py-2.5 px-3 text-xs' : 'py-3.5 px-4 text-sm';
  const headerPadding = density === 'compact' ? 'py-2.5 px-3 text-xs' : 'py-3.5 px-4 text-xs';

  return (
    <div
      className={`contain-layout-section flex flex-col rounded-2xl border border-border/80 bg-surface/95 dark:bg-surface/90 shadow-xs overflow-hidden ${className}`}
    >
      {allowDensityToggle && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/80 bg-surface-2/50 text-xs text-ink-muted">
          <span className="font-medium">
            Tổng số{' '}
            <AnimatedNumber value={data.length} className="text-ink font-bold tabular-nums" /> bản
            ghi
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ink-muted hidden sm:inline">Mật độ:</span>
            <div
              role="group"
              aria-label="Mật độ bảng dữ liệu"
              className="inline-flex rounded-xl p-0.5 bg-surface-3/60 border border-border/60"
            >
              {(['compact', 'comfortable'] as const).map((mode) => {
                const isActive = density === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setDensity(mode)}
                    className={`relative px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'text-emerald-700 dark:text-emerald-300 font-semibold'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {isActive &&
                      (shouldReduceMotion ? (
                        <div className="absolute inset-0 rounded-lg bg-surface shadow-2xs border border-emerald-500/20" />
                      ) : (
                        <motion.div
                          layoutId={`density-pill-${densityToggleId}`}
                          transition={MOTION_SPRINGS.snappy}
                          className="absolute inset-0 rounded-lg bg-surface shadow-2xs border border-emerald-500/20"
                        />
                      ))}
                    <span className="relative z-10">
                      {mode === 'compact' ? 'Thu gọn' : 'Tiêu chuẩn'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div
        tabIndex={0}
        role="region"
        aria-label={ariaLabel}
        className="overflow-x-auto custom-scrollbar [scrollbar-gutter:stable] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/35"
      >
        <table className="w-full text-left border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-surface-2/90 dark:bg-surface-3/90 backdrop-blur-xs text-ink-muted font-semibold">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={`${headerPadding} border-b border-border/80 text-[11px] font-bold tracking-wider uppercase ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
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
                    {emptyIcon || (
                      <MagnifyingGlassIcon className="w-7 h-7 opacity-30 text-ink-muted" />
                    )}
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
                    tabIndex={isClickable ? 0 : undefined}
                    onClick={() => onRowClick && onRowClick(item)}
                    onKeyDown={
                      isClickable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRowClick?.(item);
                            }
                          }
                        : undefined
                    }
                    className={`transition-colors ${
                      isClickable
                        ? 'cursor-pointer focus:outline-none focus-visible:bg-emerald-500/10'
                        : ''
                    } ${
                      striped && index % 2 === 1
                        ? 'bg-surface-2/30 dark:bg-surface-3/20'
                        : 'bg-surface/60'
                    } hover:bg-emerald-500/[0.04] dark:hover:bg-emerald-500/[0.06]`}
                  >
                    {columns.map((col) => {
                      const content = col.render ? col.render(item, index) : (item as any)[col.key];

                      return (
                        <td
                          key={`${key}-${col.key}`}
                          className={`${cellPadding} text-ink leading-relaxed border-b border-border/50 last:border-b-0 ${
                            col.align === 'right'
                              ? 'text-right tabular-nums'
                              : col.align === 'center'
                                ? 'text-center'
                                : 'text-left'
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
