/**
 * PQM Repository Pagination & Filtering Engine
 * Tiện ích dùng chung cho các Repositories để chuẩn hóa xử lý phân trang, lọc và sắp xếp.
 */

import { QueryFilter, PaginationOptions, PaginatedResult } from '../types';

/**
 * Lấy giá trị của một thuộc tính (hỗ trợ nested path ví dụ 'user.email' hoặc 'sensory.appearance')
 */
export function getFieldValue(item: any, fieldPath: string): any {
  if (!item || !fieldPath) return undefined;
  if (!fieldPath.includes('.')) return item[fieldPath];
  
  const parts = fieldPath.split('.');
  let current = item;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Kiểm tra xem một item có thỏa mãn điều kiện filter hay không
 */
export function matchesFilter<T>(item: T, filter: QueryFilter<T>): boolean {
  const itemValue = getFieldValue(item, String(filter.field));
  const targetValue = filter.value;

  if (itemValue === undefined || itemValue === null) {
    if (filter.operator === '==' && (targetValue === null || targetValue === undefined)) return true;
    if (filter.operator === '!=' && targetValue !== null && targetValue !== undefined) return true;
    return false;
  }

  switch (filter.operator) {
    case '==':
      if (typeof itemValue === 'string' && typeof targetValue === 'string') {
        return itemValue.trim().toLowerCase() === targetValue.trim().toLowerCase();
      }
      return itemValue === targetValue;

    case '!=':
      if (typeof itemValue === 'string' && typeof targetValue === 'string') {
        return itemValue.trim().toLowerCase() !== targetValue.trim().toLowerCase();
      }
      return itemValue !== targetValue;

    case '>':
      return Number(itemValue) > Number(targetValue);

    case '<':
      return Number(itemValue) < Number(targetValue);

    case '>=':
      return Number(itemValue) >= Number(targetValue);

    case '<=':
      return Number(itemValue) <= Number(targetValue);

    case 'contains':
      return String(itemValue).toLowerCase().includes(String(targetValue).toLowerCase());

    case 'in':
      if (!Array.isArray(targetValue)) return false;
      return targetValue.some(val => {
        if (typeof itemValue === 'string' && typeof val === 'string') {
          return itemValue.trim().toLowerCase() === val.trim().toLowerCase();
        }
        return itemValue === val;
      });

    default:
      return false;
  }
}

/**
 * Lọc mảng items theo danh sách các bộ lọc
 */
export function applyFilters<T>(items: T[], filters?: QueryFilter<T>[]): T[] {
  if (!filters || filters.length === 0) return items;
  return items.filter(item => filters.every(f => matchesFilter(item, f)));
}

/**
 * Sắp xếp mảng items theo trường và chiều
 */
export function applySorting<T>(
  items: T[],
  orderBy?: keyof T | string,
  orderDirection: 'asc' | 'desc' = 'desc'
): T[] {
  if (!orderBy) return items;

  const sorted = [...items];
  const field = String(orderBy);
  const multiplier = orderDirection === 'asc' ? 1 : -1;

  return sorted.sort((a, b) => {
    const valA = getFieldValue(a, field);
    const valB = getFieldValue(b, field);

    if (valA === valB) return 0;
    if (valA === undefined || valA === null) return 1 * multiplier;
    if (valB === undefined || valB === null) return -1 * multiplier;

    // So sánh chuỗi ngày tháng ISO (e.g. createdAt, testDate)
    if (typeof valA === 'string' && typeof valB === 'string') {
      return valA.localeCompare(valB) * multiplier;
    }

    // So sánh số
    if (typeof valA === 'number' && typeof valB === 'number') {
      return (valA - valB) * multiplier;
    }

    return String(valA).localeCompare(String(valB)) * multiplier;
  });
}

/**
 * Phân trang toàn bộ mảng dữ liệu theo Cursor hoặc Page/Offset
 */
export function paginateDataset<T extends { id?: string }>(
  items: T[],
  options?: PaginationOptions<T>,
  filters?: QueryFilter<T>[]
): PaginatedResult<T> {
  // 1. Áp dụng filters
  const filtered = applyFilters(items, filters);
  const totalCount = filtered.length;

  const pageSize = Math.max(1, options?.pageSize ?? 20);
  const orderBy = options?.orderBy || 'createdAt';
  const orderDirection = options?.orderDirection || 'desc';

  // 2. Sắp xếp
  const sorted = applySorting(filtered, orderBy, orderDirection);

  // 3. Phân đoạn dữ liệu (Cursor hoặc Offset)
  let startIndex = 0;

  if (options?.cursor) {
    // Cursor pagination: tìm phần tử có id trùng với cursor
    const cursorIndex = sorted.findIndex(item => item.id === options.cursor);
    if (cursorIndex >= 0) {
      startIndex = cursorIndex + 1;
    }
  } else if (options?.offset !== undefined) {
    startIndex = Math.max(0, options.offset);
  } else if (options?.page !== undefined && options.page > 0) {
    startIndex = (options.page - 1) * pageSize;
  }

  const paginatedItems = sorted.slice(startIndex, startIndex + pageSize);
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const currentPage = Math.floor(startIndex / pageSize) + 1;

  const hasNextPage = startIndex + pageSize < totalCount;
  const hasPrevPage = startIndex > 0;

  const nextCursor = hasNextPage && paginatedItems.length > 0
    ? paginatedItems[paginatedItems.length - 1].id ?? null
    : null;

  const prevCursor = hasPrevPage && paginatedItems.length > 0
    ? paginatedItems[0].id ?? null
    : null;

  return {
    items: paginatedItems,
    totalCount,
    pageSize,
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextCursor,
    prevCursor
  };
}
