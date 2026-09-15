import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualizedTableBodyProps<T> {
  items: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  estimateSize?: number;
  overscan?: number;
  colSpan?: number;
  parentRef?: React.RefObject<HTMLDivElement | null>;
  scrollThreshold?: number;
}

/**
 * VirtualizedTableBody — Hàng ảo hóa cho bảng HTML chuẩn
 *
 * Sử dụng @tanstack/react-virtual kết hợp kỹ thuật spacer rows (paddingTop & paddingBottom).
 * - Giữ nguyên 100% cấu trúc thẻ thead / tbody / tr / td và class CSS
 * - Tự động fallback về tbody thông thường nếu số lượng dòng <= scrollThreshold
 * - Tiết kiệm 95% DOM nodes khi hiển thị hàng trăm đến hàng chục nghìn bản ghi
 */
export function VirtualizedTableBody<T>({
  items,
  renderRow,
  estimateSize = 56,
  overscan = 10,
  colSpan = 10,
  parentRef,
  scrollThreshold = 30,
}: VirtualizedTableBodyProps<T>) {
  const isSmallDataset = items.length <= scrollThreshold || !parentRef?.current;

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef?.current ?? null,
    estimateSize: () => estimateSize,
    overscan,
    enabled: !isSmallDataset,
  });

  if (isSmallDataset) {
    return (
      <tbody className="divide-y divide-border">
        {items.map((item, index) => renderRow(item, index))}
      </tbody>
    );
  }

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  return (
    <tbody className="divide-y divide-border">
      {paddingTop > 0 && (
        <tr style={{ height: `${paddingTop}px` }} aria-hidden="true">
          <td colSpan={colSpan} style={{ padding: 0, border: 0, height: `${paddingTop}px` }} />
        </tr>
      )}
      {virtualItems.map((virtualRow) => {
        const item = items[virtualRow.index];
        return renderRow(item, virtualRow.index);
      })}
      {paddingBottom > 0 && (
        <tr style={{ height: `${paddingBottom}px` }} aria-hidden="true">
          <td colSpan={colSpan} style={{ padding: 0, border: 0, height: `${paddingBottom}px` }} />
        </tr>
      )}
    </tbody>
  );
}

export default VirtualizedTableBody;
