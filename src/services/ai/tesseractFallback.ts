/**
 * src/services/ai/tesseractFallback.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Offline OCR Fallback sử dụng Tesseract.js (WebAssembly) đa trang chuyên dụng
 * (OCR-08: Tesseract Multi-Page Fallback).
 *
 * Chạy 100% trên trình duyệt (client-side), không cần Internet hay API Key.
 * Được kích hoạt tự động khi Gemini API không khả dụng (mất mạng, 503, timeout).
 *
 * Khắc phục triệt để:
 * - [CRITICAL-01]: Quét toàn bộ N trang PDF thay vì chỉ nhận dạng trang đầu tiên.
 * - [CRITICAL-02]: Hỗ trợ bóc tách heuristic các chỉ tiêu (criteria table lines)
 *   và thông tin Header cơ bản (Số lô, ngày, lab, tên SP) ngay trong chế độ offline.
 * - [Rule 7 & 8]: Bảo toàn số trang nguồn sourcePageNumber và zero loss giữa các trang.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ExtractedCriterionItem } from '../ocr/types';

/** Chi tiết văn bản và độ tin cậy của từng trang */
export interface PageOcrText {
  pageNumber: number;
  text: string;
  confidence: number;
}

/** Kết quả trả về từ Tesseract Fallback — tương thích hoàn toàn với luồng dữ liệu hệ thống */
export interface TesseractFallbackResult {
  /** Flag nhận biết chế độ offline */
  _isOfflineFallback: true;
  /** Text thô trích xuất từ tài liệu (có phân tách [TRANG X/N] nếu nhiều trang) */
  rawText: string;
  /** Tên file gốc đã scan */
  fileName: string;
  /** Ngôn ngữ OCR đã dùng */
  lang: string;
  /** Độ tin cậy trung bình (0-100) trên toàn bộ các trang */
  confidence: number;
  /** Tổng số trang đã xử lý (nếu có) */
  pageCount?: number;
  /** Chi tiết text từng trang */
  pageTexts?: PageOcrText[];
  /** Thông báo giải thích cho người dùng */
  offlineMessage: string;
  /** Danh sách chỉ tiêu trích xuất được bằng thuật toán Heuristic */
  testResults: ExtractedCriterionItem[];
  /** Thông tin Header bóc tách được từ văn bản */
  labName: string;
  batchNo: string;
  productCode?: string;
  productName?: string;
  mfgDate?: string;
  expDate?: string;
  testDate: string;
  notes: string;
  failedPages?: number[];
}

/**
 * Trích xuất Heuristic thông tin Header từ text thô (Số lô, Ngày kiểm nghiệm, Lab, Tên mẫu)
 */
export function extractHeuristicHeaderInfo(rawText: string): {
  labName: string;
  batchNo: string;
  testDate: string;
  mfgDate: string;
  expDate: string;
  productName: string;
} {
  let labName = '';
  let batchNo = '';
  let testDate = '';
  let mfgDate = '';
  let expDate = '';
  let productName = '';

  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Nhận diện Đơn vị kiểm nghiệm (Lab Name)
  const labRegex =
    /(?:trung tâm kiểm nghiệm|viện kiểm nghiệm|phân viện kiểm nghiệm|quatest \d|eurofins|sgs|pasteur)[^\n\r,;]*/i;
  for (const line of lines) {
    const match = line.match(labRegex);
    if (match && !labName) {
      labName = match[0].trim();
      break;
    }
  }

  // 2. Nhận diện Số lô sản xuất (Batch No)
  const batchRegex =
    /(?:số lô|lô sx|lô số|số lot|batch no\.?|lot no\.?|batch\s*#)[:\s]+([A-Z0-9\-_./]+)/i;
  for (const line of lines) {
    const match = line.match(batchRegex);
    if (match) {
      batchNo = match[1].trim();
      break;
    }
  }

  // 3. Nhận diện Ngày tháng (DD/MM/YYYY hoặc DD-MM-YYYY)
  const testDateRegex =
    /(?:ngày kiểm nghiệm|ngày thử nghiệm|ngày kt|test date|testing date)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i;
  const receivedDateRegex =
    /(?:ngày nhận mẫu|ngày lấy mẫu|received date)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i;
  const mfgDateRegex =
    /(?:ngày sản xuất|ngày sx|nsx|mfg\.?\s*date|manufacturing date)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i;
  const expDateRegex =
    /(?:hạn dùng|hạn sử dụng|hdsd|exp\.?\s*date|expiry date)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i;

  const normalizeDate = (d: string) => d.replace(/-/g, '/');

  let explicitTestDate = '';
  let receiptDate = '';

  for (const line of lines) {
    if (!explicitTestDate) {
      const match = line.match(testDateRegex);
      if (match) explicitTestDate = normalizeDate(match[1].trim());
    }
    if (!receiptDate) {
      const match = line.match(receivedDateRegex);
      if (match) receiptDate = normalizeDate(match[1].trim());
    }
    if (!mfgDate) {
      const match = line.match(mfgDateRegex);
      if (match) mfgDate = normalizeDate(match[1].trim());
    }
    if (!expDate) {
      const match = line.match(expDateRegex);
      if (match) expDate = normalizeDate(match[1].trim());
    }
  }

  testDate = explicitTestDate || receiptDate;

  // 4. Nhận diện Tên sản phẩm / Tên mẫu thử
  const prodRegex =
    /(?:tên mẫu|tên sản phẩm|mẫu thử|tên mẫu thử|tên thuốc|sample name)[:\s]+([^\n\r|;]+)/i;
  for (const line of lines) {
    const match = line.match(prodRegex);
    if (match) {
      productName = match[1].trim();
      break;
    }
  }

  return { labName, batchNo, testDate, mfgDate, expDate, productName };
}

/**
 * Trích xuất Heuristic các hàng chỉ tiêu kiểm nghiệm từ văn bản của từng trang
 */
export function extractHeuristicCriteriaFromText(
  text: string,
  pageNumber: number
): ExtractedCriterionItem[] {
  const items: ExtractedCriterionItem[] = [];
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Danh sách dòng cần bỏ qua
  const ignorePatterns = [
    /^(stt|tên chỉ tiêu|chỉ tiêu|phép thử|kết quả|mức chất lượng|tiêu chuẩn|yêu cầu)/i,
    /^(phiếu kiểm nghiệm|kết quả phân tích|certificate of analysis|bộ y tế|sở y tế)/i,
    /^(cộng hòa xã hội|độc lập - tự do|ngày|số:|kính gửi)/i,
    /^(người kiểm nghiệm|trưởng phòng|giám đốc|thủ trưởng|kết luận|ghi chú)/i,
  ];

  for (const line of lines) {
    if (ignorePatterns.some((pattern) => pattern.test(line))) {
      continue;
    }

    // Mẫu A: Dạng bảng phân tách bằng ký tự | (pipe delimiter)
    if (line.includes('|')) {
      const parts = line
        .split('|')
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        let nameIdx = 0;
        if (/^\d+$/.test(parts[0]) && parts.length >= 3) {
          nameIdx = 1; // Cột 0 là số thứ tự
        }
        const criteriaName = parts[nameIdx];
        const valIdx = nameIdx + 1;
        const val = parts[valIdx];

        if (
          criteriaName &&
          val &&
          criteriaName.length >= 2 &&
          !/^(stt|tên|kết quả)/i.test(criteriaName)
        ) {
          const unit =
            parts[valIdx + 1] && parts[valIdx + 1].length < 15 ? parts[valIdx + 1] : undefined;
          const limit = parts[valIdx + 2] || undefined;

          items.push({
            criteriaName,
            value: val,
            unit,
            limit,
            confidence: 'medium',
            confidenceScore: 70,
            sourcePageNumber: pageNumber,
            rawText: line,
          });
          continue;
        }
      }
    }

    // Mẫu B: Dạng "Tên chỉ tiêu: Kết quả" hoặc "Tên chỉ tiêu - Kết quả"
    const colonMatch = line.match(/^([A-Za-zÀ-ỹ0-9\s().,%-]{3,40})[:\t](.+)$/);
    if (colonMatch) {
      const rawName = colonMatch[1].trim().replace(/^\d+[\.\-\)]\s*/, '');
      const rawVal = colonMatch[2].trim();

      if (
        rawName &&
        rawVal &&
        !/^(số lô|ngày|hạn dùng|mẫu|tiêu chuẩn|bảo quản|kết luận)/i.test(rawName)
      ) {
        items.push({
          criteriaName: rawName,
          value: rawVal,
          confidence: 'low',
          confidenceScore: 60,
          sourcePageNumber: pageNumber,
          rawText: line,
        });
      }
    }
  }

  return items;
}

/**
 * Chuyển đổi file ảnh/PDF nhiều trang thành text và chỉ tiêu bằng Tesseract.js (Offline Fallback).
 * Hỗ trợ quét toàn diện N trang (Multi-Page Recognition) bảo đảm không mất mát dữ liệu.
 *
 * @param file File ảnh hoặc PDF cần OCR
 * @param onProgress Callback tiến độ (step, percent 0-100)
 * @returns TesseractFallbackResult với đầy đủ text các trang và dữ liệu heuristic
 */
export const extractRawTextWithTesseract = async (
  file: File,
  onProgress?: (step: string, percent: number) => void
): Promise<TesseractFallbackResult> => {
  onProgress?.('📴 Đang khởi động chế độ Offline OCR (Tesseract.js)...', 5);

  // Lazy-load Tesseract.js chỉ khi thực sự cần
  const { createWorker } = await import('tesseract.js');

  onProgress?.('⚙️ Đang tải bộ nhận dạng ký tự (OCR engine)...', 10);

  // Hỗ trợ tiếng Việt (vie) và tiếng Anh (eng)
  const worker = await createWorker(['vie', 'eng'], 1, {
    logger: (m: any) => {
      if (m.status === 'loading language traineddata') {
        onProgress?.('📦 Đang tải dữ liệu ngôn ngữ (cache cho lần sau)...', 12);
      }
    },
  });

  try {
    const pageTexts: PageOcrText[] = [];
    const allCriteria: ExtractedCriterionItem[] = [];
    const failedPages: number[] = [];

    // 1. Xử lý PDF đa trang
    if (file.type === 'application/pdf') {
      try {
        onProgress?.('📄 Đang kết xuất các trang PDF sang ảnh High-DPI...', 15);
        const { convertPdfToImages } = await import('../../utils/pdfProcessor');
        const pages = await convertPdfToImages(file, {
          targetDpi: 250,
          format: 'image/png',
          maxPages: 20,
        });

        if (pages.length > 0) {
          const totalPages = pages.length;
          onProgress?.(`📄 Chuyển đổi thành công ${totalPages} trang PDF High-DPI`, 18);

          for (let i = 0; i < totalPages; i++) {
            const page = pages[i];
            const pageNum = i + 1;
            const startPct = 18 + Math.round((i / totalPages) * 75);

            onProgress?.(
              `🔍 [Offline OCR] Đang nhận diện trang ${pageNum}/${totalPages}...`,
              startPct
            );

            try {
              const { data } = await worker.recognize(page.dataUrl);
              const pText = data.text?.trim() || '';
              const pConf = Math.round(data.confidence || 0);

              pageTexts.push({
                pageNumber: pageNum,
                text: pText,
                confidence: pConf,
              });

              // Trích xuất heuristic các chỉ tiêu của trang này
              const pageItems = extractHeuristicCriteriaFromText(pText, pageNum);
              allCriteria.push(...pageItems);
            } catch (pageErr) {
              console.warn(`[TesseractFallback] Lỗi nhận diện trang ${pageNum}:`, pageErr);
              failedPages.push(pageNum);
              pageTexts.push({
                pageNumber: pageNum,
                text: `[Lỗi nhận diện trang ${pageNum}]`,
                confidence: 0,
              });
            }
          }
        }
      } catch (pdfErr) {
        console.warn(
          '[TesseractFallback] Không thể render qua pdfProcessor, thử nhận diện trực tiếp:',
          pdfErr
        );
        onProgress?.('⚠️ Không thể tối ưu PDF, thử nhận diện trực tiếp...', 20);
      }
    }

    // 2. Nếu không phải PDF hoặc convertPdfToImages không trích xuất được trang, nhận diện file đơn
    if (pageTexts.length === 0) {
      onProgress?.('🔍 [Offline OCR] Đang nhận diện hình ảnh...', 30);
      try {
        const { data } = await worker.recognize(file);
        const pText = data.text?.trim() || '';
        const pConf = Math.round(data.confidence || 0);

        pageTexts.push({
          pageNumber: 1,
          text: pText,
          confidence: pConf,
        });

        const pageItems = extractHeuristicCriteriaFromText(pText, 1);
        allCriteria.push(...pageItems);
      } catch (imgErr: any) {
        failedPages.push(1);
        throw imgErr;
      }
    }

    await worker.terminate();

    // 3. Tính toán độ tin cậy trung bình
    const validPages = pageTexts.filter((p) => p.confidence > 0);
    const avgConfidence =
      validPages.length > 0
        ? Math.round(validPages.reduce((acc, p) => acc + p.confidence, 0) / validPages.length)
        : 0;

    // 4. Định dạng văn bản thô theo cấu trúc từng trang
    const fullRawText =
      pageTexts.length > 1
        ? pageTexts
            .map((p) => `--- [TRANG ${p.pageNumber}/${pageTexts.length}] ---\n${p.text}`)
            .join('\n\n')
        : pageTexts[0]?.text || '';

    // 5. Trích xuất Heuristic thông tin Header từ toàn bộ văn bản
    const header = extractHeuristicHeaderInfo(fullRawText);

    onProgress?.('✅ Hoàn tất trích xuất văn bản offline!', 100);

    return {
      _isOfflineFallback: true,
      rawText: fullRawText,
      fileName: file.name,
      lang: 'vie+eng',
      confidence: avgConfidence,
      pageCount: pageTexts.length,
      pageTexts,
      offlineMessage:
        '📴 **Chế độ Offline đang hoạt động** — Gemini API không khả dụng. ' +
        `Văn bản đã được trích xuất bằng Tesseract.js cục bộ (${pageTexts.length} trang). ` +
        (allCriteria.length > 0
          ? `Hệ thống đã nhận diện được ${allCriteria.length} chỉ tiêu tham khảo. Vui lòng kiểm tra lại.`
          : 'Vui lòng đọc văn bản và nhập kết quả kiểm nghiệm thủ công vào bảng bên dưới.'),
      testResults: allCriteria,
      labName: header.labName,
      batchNo: header.batchNo,
      productName: header.productName,
      mfgDate: header.mfgDate,
      expDate: header.expDate,
      testDate: header.testDate,
      notes: `[Offline OCR – Tesseract.js] Độ tin cậy: ${avgConfidence}% | ${pageTexts.length} trang | File: ${file.name}`,
      failedPages: failedPages.length > 0 ? failedPages : undefined,
    };
  } catch (tessError: any) {
    await worker.terminate().catch(() => {});
    console.error('[TesseractFallback] OCR error:', tessError);
    throw new Error(
      `Tesseract OCR thất bại: ${tessError?.message || 'Lỗi không xác định'}. ` +
        'Vui lòng nhập kết quả kiểm nghiệm thủ công.'
    );
  }
};

/**
 * Kiểm tra xem kết quả trả về có phải từ Tesseract Fallback không.
 */
export const isTesseractFallbackResult = (result: any): result is TesseractFallbackResult => {
  return Boolean(result && result._isOfflineFallback === true);
};
