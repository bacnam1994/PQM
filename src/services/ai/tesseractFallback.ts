/**
 * tesseractFallback.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Offline OCR Fallback sử dụng Tesseract.js (WebAssembly) — chạy hoàn toàn
 * trên trình duyệt, không cần kết nối Internet hay API key.
 *
 * Được kích hoạt tự động khi Gemini API không khả dụng (mất mạng, API sập,
 * quota vượt hạn mức) sau khi tất cả retry đã thất bại.
 *
 * Giới hạn: Chỉ trích xuất TEXT THÔ — không có semantic mapping, không tự
 * điền form. User cần đọc text và nhập kết quả thủ công. UI sẽ hiển thị
 * banner "Chế độ Offline" rõ ràng để thông báo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Kết quả trả về từ Tesseract Fallback — phân biệt với kết quả Gemini bình thường */
export interface TesseractFallbackResult {
  /** Flag để UI nhận biết đây là kết quả offline, không phải từ Gemini */
  _isOfflineFallback: true;
  /** Text thô trích xuất được từ tài liệu */
  rawText: string;
  /** Tên file gốc đã scan */
  fileName: string;
  /** Ngôn ngữ OCR đã dùng */
  lang: string;
  /** Độ tin cậy trung bình (0-100) do Tesseract tự tính */
  confidence: number;
  /** Thông báo giải thích cho user */
  offlineMessage: string;
  /** testResults rỗng — không map được khi offline */
  testResults: [];
  /** Các field khác giữ rỗng để không xung đột với type OCR bình thường */
  labName: string;
  batchNo: string;
  testDate: string;
  notes: string;
}

/**
 * Chuyển đổi file ảnh/PDF thành text thô bằng Tesseract.js.
 * Lazy-load thư viện chỉ khi cần — tránh tải ~4MB khi người dùng có mạng tốt.
 *
 * @param file File ảnh hoặc PDF cần OCR
 * @param onProgress Callback tiến độ (step, percent 0-100)
 * @returns TesseractFallbackResult với text thô và metadata
 */
export const extractRawTextWithTesseract = async (
  file: File,
  onProgress?: (step: string, percent: number) => void
): Promise<TesseractFallbackResult> => {
  onProgress?.('📴 Đang khởi động chế độ Offline OCR (Tesseract.js)...', 5);

  // Lazy-load Tesseract.js chỉ khi thực sự cần
  const { createWorker } = await import('tesseract.js');

  onProgress?.('⚙️ Đang tải bộ nhận dạng ký tự (OCR engine)...', 15);

  // Hỗ trợ tiếng Việt (vie) và tiếng Anh (eng) — 2 ngôn ngữ phổ biến nhất trên phiếu
  // Tesseract sẽ tự download language data (~5MB) nếu chưa có trong cache
  const worker = await createWorker(['vie', 'eng'], 1, {
    logger: (m: any) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        const pct = Math.round(20 + m.progress * 70); // 20% → 90%
        onProgress?.(`🔍 Đang nhận diện ký tự... (${Math.round(m.progress * 100)}%)`, pct);
      } else if (m.status === 'loading language traineddata') {
        onProgress?.('📦 Đang tải ngôn ngữ Việt-Anh lần đầu (cache cho lần sau)...', 18);
      }
    },
  });

  try {
    onProgress?.('🔍 Đang nhận diện văn bản từ tài liệu...', 25);

    // Tesseract có thể nhận File trực tiếp (ảnh) hoặc URL
    // Với PDF, cần convert sang ảnh trước — thử dùng pdfProcessor nếu có
    let imageSource: File | string = file;
    if (file.type === 'application/pdf') {
      try {
        onProgress?.('📄 Đang chuyển đổi trang đầu PDF sang ảnh...', 20);
        const { convertPdfToImages } = await import('../../utils/pdfProcessor');
        const pages = await convertPdfToImages(file, { targetWidth: 1200, quality: 0.9, maxPages: 10 });
        if (pages.length > 0) {
          // Tesseract nhận data URL trực tiếp
          imageSource = `data:image/jpeg;base64,${pages[0].base64}`;
          onProgress?.(`📄 Chuyển đổi thành công ${pages.length} trang PDF → nhận diện trang đầu tiên`, 22);
        }
      } catch (_) {
        // Nếu PDF processor lỗi, thử nhận trực tiếp (Tesseract có hỗ trợ giới hạn)
        onProgress?.('⚠️ Không thể tối ưu PDF, thử nhận diện trực tiếp...', 20);
      }
    }

    const { data } = await worker.recognize(imageSource);

    onProgress?.('✅ Hoàn tất trích xuất văn bản offline!', 95);

    await worker.terminate();

    const rawText = data.text?.trim() || '';
    const confidence = Math.round(data.confidence || 0);

    onProgress?.('✅ Hoàn tất!', 100);

    return {
      _isOfflineFallback: true,
      rawText,
      fileName: file.name,
      lang: 'vie+eng',
      confidence,
      offlineMessage:
        '📴 **Chế độ Offline đang hoạt động** — Gemini API không khả dụng. ' +
        'Văn bản thô bên dưới đã được trích xuất bằng Tesseract.js (OCR cục bộ). ' +
        'Vui lòng đọc và nhập kết quả kiểm nghiệm thủ công vào bảng bên dưới.',
      testResults: [],
      labName: '',
      batchNo: '',
      testDate: '',
      notes: `[Offline OCR – Tesseract.js] Độ tin cậy: ${confidence}% | File: ${file.name}`,
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
 * Dùng trong UI để phân biệt và hiển thị banner offline thích hợp.
 */
export const isTesseractFallbackResult = (result: any): result is TesseractFallbackResult => {
  return result && result._isOfflineFallback === true;
};
