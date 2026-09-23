/**
 * src/services/ocr/multiPageMerger.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Động cơ hợp nhất dữ liệu đa trang chuyên dụng (OCR-07: Multi-Page Merge Engine).
 * Giải quyết triệt để các vấn đề:
 * - Nối bảng chỉ tiêu xuyên trang (Table Continuation Across Page Breaks).
 * - Phát hiện và hàn gắn hàng bị đứt gãy tại ranh giới trang (Broken Row Stitching).
 * - Khử trùng lặp thông minh tại ranh giới trang (Boundary Deduplication) mà không làm mất dòng.
 * - Loại bỏ các dòng tiêu đề cột rác lặp lại ở đầu trang tiếp theo.
 * - Xử lý chỉ tiêu phân nhóm (Hierarchical / Grouped Criteria).
 * - Hợp nhất Header tài liệu (Số lô, lab, ngày tháng, mã sản phẩm) theo tiêu chuẩn độ tin cậy.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  ExtractedCriterionItem,
  PageExtractionResult,
  MultiPageExtractionResult,
} from './types';

/** Danh sách từ khóa nhận diện dòng tiêu đề cột bảng bị OCR đọc nhầm thành chỉ tiêu */
const COLUMN_HEADER_NAMES = new Set([
  'stt',
  'tên chỉ tiêu',
  'chỉ tiêu',
  'chỉ tiêu kiểm nghiệm',
  'chỉ tiêu phân tích',
  'phép thử',
  'tên phép thử',
  'test item',
  'test parameter',
  'parameter',
  'parameters',
  'tests',
]);

const COLUMN_HEADER_VALUES = new Set([
  'kết quả',
  'kết quả thử nghiệm',
  'kết quả kiểm nghiệm',
  'giá trị',
  'yêu cầu',
  'tiêu chuẩn',
  'mức chất lượng',
  'result',
  'results',
  'specification',
  'specifications',
]);

/**
 * Kiểm tra xem một dòng có phải là tiêu đề cột bảng lặp lại ở đầu trang mới hay không
 */
export function isTableColumnHeaderRow(item: ExtractedCriterionItem): boolean {
  const normName = item.criteriaName
    .toLowerCase()
    .replace(/[:\-_/.]/g, '')
    .trim();
  const normVal = item.value
    .toLowerCase()
    .replace(/[:\-_/.]/g, '')
    .trim();

  // Nếu cả tên và giá trị đều trùng với các từ khóa tiêu đề cột
  if (COLUMN_HEADER_NAMES.has(normName) && (COLUMN_HEADER_VALUES.has(normVal) || normVal === '')) {
    return true;
  }

  // Trường hợp cột STT (ví dụ name = "1", value = "Tên chỉ tiêu")
  if (/^\d+$/.test(normName) && COLUMN_HEADER_NAMES.has(normVal)) {
    return true;
  }

  return false;
}

/**
 * Kiểm tra xem 2 hàng tại ranh giới giữa 2 trang có phải là bản sao trùng lặp do quét chồng mép hay không
 */
export function isBoundaryDuplicate(
  lastItem: ExtractedCriterionItem,
  currentItem: ExtractedCriterionItem
): boolean {
  if (lastItem.sourcePageNumber === currentItem.sourcePageNumber) {
    return false; // Chỉ xét giữa 2 trang kế cận
  }

  const normLastName = lastItem.criteriaName.toLowerCase().trim();
  const normCurrName = currentItem.criteriaName.toLowerCase().trim();

  const isNameMatch = normLastName === normCurrName;
  const isValueMatch = lastItem.value.trim() === currentItem.value.trim();
  const isUnitMatch = (lastItem.unit || '').trim() === (currentItem.unit || '').trim();

  return isNameMatch && isValueMatch && isUnitMatch;
}

/**
 * Hàn gắn hàng bị đứt gãy tại ranh giới trang:
 * Ví dụ: Trang trước có tên chỉ tiêu nhưng thiếu giá trị, trang sau có giá trị nhưng thiếu tên
 */
export function tryStitchBrokenBoundaryRows(
  lastItem: ExtractedCriterionItem,
  currentItem: ExtractedCriterionItem
): ExtractedCriterionItem | null {
  if (lastItem.sourcePageNumber === currentItem.sourcePageNumber) {
    return null;
  }

  const lastHasName = Boolean(lastItem.criteriaName && lastItem.criteriaName.length > 2);
  const lastHasValue = Boolean(lastItem.value && lastItem.value.trim().length > 0);

  const currHasName = Boolean(currentItem.criteriaName && currentItem.criteriaName.length > 2);
  const currHasValue = Boolean(currentItem.value && currentItem.value.trim().length > 0);

  // Trường hợp A: Trang trước chỉ có tên, trang sau chỉ có kết quả
  if (
    lastHasName &&
    !lastHasValue &&
    currHasValue &&
    (!currHasName || currentItem.criteriaName === '-')
  ) {
    return {
      ...lastItem,
      value: currentItem.value,
      unit: currentItem.unit || lastItem.unit,
      limit: currentItem.limit || lastItem.limit,
      analysisMethod: currentItem.analysisMethod || lastItem.analysisMethod,
      confidence: currentItem.confidence,
      confidenceScore: Math.min(lastItem.confidenceScore ?? 90, currentItem.confidenceScore ?? 90),
      rawText: [lastItem.rawText, currentItem.rawText].filter(Boolean).join(' | '),
    };
  }

  // Trường hợp B: Tên chỉ tiêu bị cắt ngang bằng dấu gạch nối cuối trang (hyphenation)
  if (lastHasName && lastItem.criteriaName.endsWith('-') && currHasName && currHasValue) {
    const combinedName = `${lastItem.criteriaName.slice(0, -1)}${currentItem.criteriaName}`;
    return {
      ...currentItem,
      criteriaName: combinedName,
      sourcePageNumber: lastItem.sourcePageNumber,
      rawText: [lastItem.rawText, currentItem.rawText].filter(Boolean).join(' | '),
    };
  }

  return null;
}

/**
 * Xử lý các chỉ tiêu phân nhóm (Grouped / Parent-Child Criteria):
 * Loại bỏ dòng tiêu đề nhóm rỗng không có giá trị và bảo đảm các chỉ tiêu con được giữ nguyên
 */
export function harmonizeGroupedCriteria(
  items: ExtractedCriterionItem[]
): ExtractedCriterionItem[] {
  const result: ExtractedCriterionItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Bỏ qua dòng tiêu đề cột bảng
    if (isTableColumnHeaderRow(item)) {
      continue;
    }

    // Kiểm tra nếu là dòng cha rỗng (ví dụ: "Giới hạn vi sinh vật" mà không có kết quả, các dòng sau có kết quả)
    const isContainerRowWithoutValue =
      (!item.value || item.value.trim() === '' || item.value.toLowerCase() === 'n/a') &&
      (!item.limit || item.limit.trim() === '');

    if (isContainerRowWithoutValue) {
      // Nhìn trước dòng tiếp theo xem có phải là dòng con có kết quả không
      const nextItem = items[i + 1];
      if (nextItem && nextItem.value && nextItem.value.trim().length > 0) {
        // Dòng này chỉ là container header, không đưa vào danh sách chỉ tiêu định lượng
        continue;
      }
    }

    result.push(item);
  }

  return result;
}

/**
 * Hợp nhất thông tin Header tài liệu từ các trang theo mức độ ưu tiên
 */
export function resolveDocumentHeader(successfulPages: PageExtractionResult[]): {
  labName: string;
  documentType: string;
  productCode: string;
  productName: string;
  batchNo: string;
  mfgDate: string;
  expDate: string;
  testDate: string;
} {
  const first = successfulPages[0];

  // Ưu tiên tên phòng thí nghiệm dài hơn hoặc có đầy đủ định danh
  const labName =
    successfulPages
      .map((p) => p.labName || '')
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0] ||
    first?.labName ||
    '';

  const productCode =
    successfulPages.find((p) => p.productCode && p.productCode.length > 2)?.productCode ||
    first?.productCode ||
    '';

  const productName =
    successfulPages
      .map((p) => p.productName || '')
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0] ||
    first?.productName ||
    '';

  const batchNo =
    successfulPages.find((p) => p.batchNo && p.batchNo.trim().length > 0)?.batchNo ||
    first?.batchNo ||
    '';

  // Định dạng ngày chuẩn DD/MM/YYYY
  const isValidDate = (d?: string) => Boolean(d && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(d.trim()));

  const mfgDate =
    successfulPages.find((p) => isValidDate(p.mfgDate))?.mfgDate || first?.mfgDate || '';
  const expDate =
    successfulPages.find((p) => isValidDate(p.expDate))?.expDate || first?.expDate || '';
  const testDate =
    successfulPages.find((p) => isValidDate(p.testDate))?.testDate || first?.testDate || '';

  const documentType = first?.rawResponse?.documentType || 'External_Lab';

  return {
    labName,
    documentType,
    productCode,
    productName,
    batchNo,
    mfgDate,
    expDate,
    testDate,
  };
}

/**
 * Động cơ hợp nhất đa trang hoàn chỉnh (Multi-Page Merge Engine)
 */
export function mergeMultiPageExtraction(
  pageResults: PageExtractionResult[],
  totalPages: number
): MultiPageExtractionResult {
  const successfulPages = pageResults.filter(
    (p) => p.status === 'SUCCESS' || p.status === 'PARTIAL'
  );
  const failedPages = pageResults.filter((p) => p.status === 'FAILED').map((p) => p.pageNumber);

  // 1. Phân giải thông tin Header tối ưu
  const header = resolveDocumentHeader(successfulPages);

  // 2. Tổng hợp ghi chú từ các trang kèm đánh dấu trang nguồn nếu có nhiều hơn 1 trang có ghi chú
  const pagesWithNotes = successfulPages.filter((p) => p.notes && p.notes.trim());
  const notesList: string[] = [];

  for (const page of pagesWithNotes) {
    const rawNote = page.notes!.trim();
    const pageNote = pagesWithNotes.length > 1 ? `[Trang ${page.pageNumber}]: ${rawNote}` : rawNote;
    if (!notesList.includes(pageNote)) {
      notesList.push(pageNote);
    }
  }

  if (failedPages.length > 0) {
    notesList.push(`[Cảnh báo: Không thể đọc dữ liệu trang: ${failedPages.join(', ')}]`);
  }

  // 3. Gom và sắp xếp toàn bộ items theo trang nguồn
  const mergedItems: ExtractedCriterionItem[] = [];

  for (let i = 0; i < pageResults.length; i++) {
    const page = pageResults[i];
    if (!page.testResults || page.testResults.length === 0) continue;

    let isFirstRealItemOfPage = true;

    for (let j = 0; j < page.testResults.length; j++) {
      const currentItem = page.testResults[j];

      // Bỏ qua dòng tiêu đề cột bảng lặp lại
      if (isTableColumnHeaderRow(currentItem)) {
        continue;
      }

      // Xử lý tại ranh giới chuyển trang (với item thực đầu tiên của trang mới)
      if (mergedItems.length > 0 && isFirstRealItemOfPage && i > 0) {
        isFirstRealItemOfPage = false;
        const lastItem = mergedItems[mergedItems.length - 1];

        // A. Kiểm tra trùng lặp ranh giới
        if (isBoundaryDuplicate(lastItem, currentItem)) {
          continue; // Bỏ qua bản ghi trùng mép
        }

        // B. Kiểm tra hàng bị cắt ngang giữa 2 trang
        const stitched = tryStitchBrokenBoundaryRows(lastItem, currentItem);
        if (stitched) {
          mergedItems[mergedItems.length - 1] = stitched;
          continue;
        }
      }

      isFirstRealItemOfPage = false;
      mergedItems.push(currentItem);
    }
  }

  // 4. Chuẩn hóa chỉ tiêu nhóm
  const finalTestResults = harmonizeGroupedCriteria(mergedItems);

  return {
    labName: header.labName,
    documentType: header.documentType,
    pageCount: totalPages,
    productCode: header.productCode,
    productName: header.productName,
    batchNo: header.batchNo,
    mfgDate: header.mfgDate,
    expDate: header.expDate,
    testDate: header.testDate,
    notes: notesList.join(' | '),
    testResults: finalTestResults,
    pageResults,
    failedPages,
  };
}
