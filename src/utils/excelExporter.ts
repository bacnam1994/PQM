/**
 * excelExporter.ts
 * Helper tải động thư viện SheetJS (xlsx) theo nhu cầu (On-demand Lazy Load).
 * Giảm dung lượng Main Bundle ban đầu ~800KB.
 */

export const getXLSX = async () => {
  const XLSX = await import('xlsx');
  return XLSX;
};

export type XLSXModule = typeof import('xlsx');
