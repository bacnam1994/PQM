/**
 * Tiện ích chuẩn hóa và tự động sinh số phiếu kiểm nghiệm (Report Number)
 * Tuân thủ quy tắc: Ưu tiên số phiếu trích xuất từ AI OCR hoặc người dùng nhập;
 * nếu không có thì tự động sinh số mặc định theo tiêu chuẩn kiểm nghiệm.
 */

export interface GenerateDefaultReportNoOptions {
  batchNo?: string;
  labName?: string;
  testDate?: string;
}

/**
 * Tự động tạo số phiếu kiểm nghiệm mặc định
 * - Phiếu nội bộ V-Biotech: `PKN/${batchNo}/${year}` (hoặc `PKN/QC-${year}/${random}`)
 * - Phiếu ngoại kiểm: `KN-EXT-${batchNo}` (hoặc `KN-EXT-${year}/${random}`)
 */
export function generateDefaultReportNo(options?: GenerateDefaultReportNoOptions): string {
  const batchNo = options?.batchNo?.trim();
  const testDate = options?.testDate?.trim();
  const labName = (options?.labName || '').trim().toLowerCase();

  // Xác định năm từ testDate (YYYY-MM-DD hoặc DD/MM/YYYY) hoặc năm hiện tại
  let year = new Date().getFullYear().toString();
  if (testDate) {
    if (testDate.includes('-')) {
      const y = testDate.split('-')[0];
      if (y && y.length === 4) year = y;
    } else if (testDate.includes('/')) {
      const parts = testDate.split('/');
      const y = parts[parts.length - 1];
      if (y && y.length === 4) year = y;
    }
  }

  const isInternal =
    !labName ||
    labName.includes('nội bộ') ||
    labName.includes('noi bo') ||
    labName.includes('v-biotech') ||
    labName.includes('vbiotech') ||
    labName.includes('phòng qc') ||
    labName.includes('qc');

  if (isInternal) {
    if (batchNo) {
      return `PKN/${batchNo}/${year}`;
    }
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    return `PKN/QC-${year}/${randSuffix}`;
  } else {
    if (batchNo) {
      return `KN-EXT-${batchNo}`;
    }
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    return `KN-EXT-${year}/${randSuffix}`;
  }
}
