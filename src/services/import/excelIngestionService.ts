/**
 * excelIngestionService.ts
 * Dịch vụ trích xuất dữ liệu phiếu kiểm nghiệm từ file Excel (.xlsx, .xls, .csv).
 * Hỗ trợ đa sheet, nhiều dòng chỉ tiêu, bảo toàn số thập phân, đơn vị, dấu so sánh.
 * Kết nối trực tiếp vào Ingestion Pipeline chung:
 * Extract -> Normalize -> Map Criteria -> Validate -> Preview -> Human Confirm -> Persist -> Evaluate.
 */

import { getXLSX } from '../../utils/excelExporter';

export interface ExtractedExcelItem {
  criteriaName: string;
  mappedName?: string;
  value: string;
  unit?: string;
  limit?: string;
  analysisMethod?: string;
  confidence: 'high' | 'low';
  confidenceScore?: number;
  sourcePageNumber?: number;
  sheetName?: string;
}

export interface ExtractedExcelData {
  batchNo?: string;
  productCode?: string;
  productName?: string;
  labName?: string;
  testDate?: string;
  reportNo?: string;
  documentType: 'EXCEL_COA' | 'EXCEL_SHEET';
  notes?: string;
  sheetCount: number;
  testResults: ExtractedExcelItem[];
}

/**
 * Trích xuất dữ liệu từ file Excel (hỗ trợ đa sheet và nhiều dòng)
 */
export async function extractDataFromExcel(
  file: File | Blob | ArrayBuffer
): Promise<ExtractedExcelData> {
  const XLSX = await getXLSX();
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();

  // raw: false để SheetJS bảo toàn định dạng chuỗi gốc (số thập phân, dấu cách, text)
  const workbook = XLSX.read(buffer, { type: 'array', raw: false });

  let batchNo: string | undefined;
  let productCode: string | undefined;
  let productName: string | undefined;
  let labName: string | undefined;
  let testDate: string | undefined;
  let reportNo: string | undefined;

  const testResults: ExtractedExcelItem[] = [];

  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return;

    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    if (!rows || rows.length === 0) return;

    let headerRowIdx = -1;
    let colCriteria = -1;
    let colResult = -1;
    let colUnit = -1;
    let colLimit = -1;
    let colMethod = -1;

    // Quét tìm metadata và dòng tiêu đề bảng
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !Array.isArray(row)) continue;

      const rowText = row.map((c) => String(c || '').trim());

      // Quét tìm metadata trên các dòng đầu
      if (headerRowIdx === -1) {
        for (let c = 0; c < rowText.length; c++) {
          const cell = rowText[c].toLowerCase();
          const nextVal = (c + 1 < rowText.length ? rowText[c + 1] : '').trim();

          if (
            !batchNo &&
            (cell.includes('số lô') ||
              cell.includes('batch no') ||
              cell.includes('lô sx') ||
              cell === 'lô')
          ) {
            batchNo = nextVal || extractTrailingValue(rowText[c]);
          } else if (
            !productName &&
            (cell.includes('tên sản phẩm') ||
              cell.includes('tên mẫu') ||
              cell.includes('product name') ||
              cell === 'sản phẩm')
          ) {
            productName = nextVal || extractTrailingValue(rowText[c]);
          } else if (
            !productCode &&
            (cell.includes('mã sản phẩm') ||
              cell.includes('product code') ||
              cell.includes('mã sp'))
          ) {
            productCode = nextVal || extractTrailingValue(rowText[c]);
          } else if (
            !labName &&
            (cell.includes('phòng kiểm nghiệm') ||
              cell.includes('đơn vị kiểm nghiệm') ||
              cell.includes('laboratory') ||
              cell.includes('nơi kiểm nghiệm'))
          ) {
            labName = nextVal || extractTrailingValue(rowText[c]);
          } else if (
            !testDate &&
            (cell.includes('ngày kiểm nghiệm') ||
              cell.includes('ngày thử nghiệm') ||
              cell.includes('test date') ||
              cell.includes('ngày xuất phiếu'))
          ) {
            testDate = parseExcelDateString(nextVal || extractTrailingValue(rowText[c]));
          } else if (
            !reportNo &&
            (cell.includes('số phiếu') ||
              cell.includes('số kết quả') ||
              cell.includes('report no') ||
              cell.includes('phiếu kiểm nghiệm số'))
          ) {
            reportNo = nextVal || extractTrailingValue(rowText[c]);
          }
        }

        // Kiểm tra xem dòng này có phải dòng tiêu đề chỉ tiêu không
        const isCriteriaHeader = rowText.some((text) => {
          const lower = text.toLowerCase();
          return (
            lower.includes('chỉ tiêu') ||
            lower.includes('criteria') ||
            lower.includes('thông số') ||
            lower.includes('tên phép thử')
          );
        });

        const isResultHeader = rowText.some((text) => {
          const lower = text.toLowerCase();
          return (
            lower.includes('kết quả') ||
            lower.includes('result') ||
            lower.includes('thực nghiệm') ||
            lower.includes('giá trị')
          );
        });

        if (isCriteriaHeader && isResultHeader) {
          headerRowIdx = r;
          // Xác định vị trí các cột
          rowText.forEach((text, cIdx) => {
            const lower = text.toLowerCase();
            if (
              lower.includes('chỉ tiêu') ||
              lower.includes('criteria') ||
              lower.includes('thông số') ||
              lower.includes('tên phép thử')
            ) {
              if (colCriteria === -1) colCriteria = cIdx;
            } else if (
              lower.includes('kết quả') ||
              lower.includes('result') ||
              lower.includes('thực tế') ||
              lower.includes('giá trị')
            ) {
              if (colResult === -1) colResult = cIdx;
            } else if (
              lower.includes('đơn vị') ||
              lower.includes('unit') ||
              lower.includes('đvt')
            ) {
              if (colUnit === -1) colUnit = cIdx;
            } else if (
              lower.includes('mức chất lượng') ||
              lower.includes('tiêu chuẩn') ||
              lower.includes('yêu cầu') ||
              lower.includes('specification') ||
              lower.includes('limit')
            ) {
              if (colLimit === -1) colLimit = cIdx;
            } else if (lower.includes('phương pháp') || lower.includes('method')) {
              if (colMethod === -1) colMethod = cIdx;
            }
          });
        }
      } else {
        // Sau khi đã thấy header, trích xuất dữ liệu từng dòng
        if (colCriteria === -1 || colResult === -1) continue;

        const rawCriteriaName = String(row[colCriteria] || '').trim();
        const rawResultVal = String(row[colResult] || '').trim();

        // Bỏ qua dòng trống hoặc phần kết thúc ký tên
        if (!rawCriteriaName || isFooterRow(rawCriteriaName)) continue;

        const unit = colUnit !== -1 ? String(row[colUnit] || '').trim() : undefined;
        const limit = colLimit !== -1 ? String(row[colLimit] || '').trim() : undefined;
        const analysisMethod = colMethod !== -1 ? String(row[colMethod] || '').trim() : undefined;

        testResults.push({
          criteriaName: rawCriteriaName,
          value: rawResultVal,
          unit: unit || undefined,
          limit: limit || undefined,
          analysisMethod: analysisMethod || undefined,
          confidence: 'high',
          confidenceScore: 98,
          sourcePageNumber: sheetIndex + 1,
          sheetName,
        });
      }
    }
  });

  return {
    batchNo,
    productCode,
    productName,
    labName,
    testDate,
    reportNo,
    documentType: 'EXCEL_COA',
    notes: `Trích xuất tự động từ Excel (${workbook.SheetNames.length} sheet, ${testResults.length} chỉ tiêu)`,
    sheetCount: workbook.SheetNames.length,
    testResults,
  };
}

function extractTrailingValue(str: string): string {
  if (!str.includes(':')) return '';
  return str.split(':')[1].trim();
}

function isFooterRow(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.startsWith('người lập') ||
    lower.startsWith('kiểm nghiệm viên') ||
    lower.startsWith('trưởng phòng') ||
    lower.startsWith('phụ trách') ||
    lower.startsWith('giám đốc') ||
    lower.startsWith('ghi chú:') ||
    lower.startsWith('kết luận:') ||
    lower.startsWith('ngày báo cáo')
  );
}

function parseExcelDateString(val?: string): string | undefined {
  if (!val) return undefined;
  const trimmed = val.trim();
  // Khớp dd/mm/yyyy hoặc dd-mm-yyyy
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Khớp yyyy-mm-dd
  const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return trimmed;
}
