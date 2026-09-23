# PHASE MANIFEST: OCR-08 — TESSERACT MULTI-PAGE FALLBACK

_Dự án PQM (Pharma Quality Management) — Chuẩn hóa Framework Vibecode_  
_Tài liệu triển khai và nghiệm thu Cơ chế Fallback Offline đa trang sử dụng Tesseract.js WebAssembly_

---

## 1. Mục Tiêu (Objective)

Giải quyết dứt điểm các lỗ hổng của cơ chế ngoại tuyến (Offline Fallback) đã phát hiện tại cuộc kiểm toán OCR-01:

1. **Khắc phục triệt để [CRITICAL-01] (Rơi rụng các trang sau trang 1)**:
   - Trước đây `tesseractFallback.ts` chỉ nhận diện duy nhất `pages[0]`, bỏ rơi toàn bộ các trang 2, 3... khiến dữ liệu chỉ tiêu vi sinh, kim loại nặng bị mất trắng khi chạy offline.
   - Nâng cấp động cơ nhận diện tuần tự toàn bộ $N$ trang của file PDF, lưu giữ đầy đủ văn bản và cấu trúc phân cách `--- [TRANG X/N] ---`.
2. **Khắc phục [CRITICAL-02] (Trích xuất Heuristic bảng chỉ tiêu kiểm nghiệm)**:
   - Trước đây trả về cứng `testResults: []`, buộc kiểm nghiệm viên phải gõ tay 100%.
   - Xây dựng bộ bóc tách Heuristic (`extractHeuristicCriteriaFromText`) nhận diện các dòng bảng phân cách bằng `|` hoặc dấu `:`, tự động trích xuất `criteriaName`, `value`, `unit`, `limit` và gắn cờ `sourcePageNumber` (Rule 7) vào `testResults`.
3. **Trích xuất Heuristic thông tin Header tài liệu ([`extractHeuristicHeaderInfo`](file:///d:/26%20Kiem%20nghiem/PQM/src/services/ai/tesseractFallback.ts))**:
   - Tự động nhận diện Đơn vị kiểm nghiệm (`labName`), Số lô (`batchNo`), Tên sản phẩm (`productName`), và chuẩn hóa các ngày tháng (`mfgDate`, `expDate`, `testDate`) sang định dạng `DD/MM/YYYY`.
4. **Phục hồi an toàn & Chống sập tiến trình**:
   - Cơ chế bảo vệ độc lập từng trang: nếu 1 trang bị lỗi ảnh/render, hệ thống ghi nhận `failedPages` và tiếp tục nhận diện các trang còn lại bình thường, không làm crash toàn bộ tiến trình.
   - Tự động giải phóng worker trong khối `finally` chống rò rỉ bộ nhớ WebAssembly.

---

## 2. Quy Trình Vận Hành (Workflow)

```
[File PDF/Ảnh Đa Trang]
        │
        ▼ (Gemini API lỗi: Mất mạng, 503, Quota...)
[extractRawTextWithTesseract]:
        │
        ├─► [PDF]: convertPdfToImages (High-DPI 250 DPI PNG)
        │            │
        │            ▼
        │     Lặp qua từng trang (Trang 1..N):
        │       ├─ onProgress: Cập nhật % tiến độ từng trang
        │       ├─ worker.recognize(page.dataUrl)
        │       ├─ extractHeuristicCriteriaFromText (kèm sourcePageNumber)
        │       └─ Thu thập PageOcrText { pageNumber, text, confidence }
        │
        ├─► [Single Image]: worker.recognize(file) -> 1 trang
        │
        ▼
[Post-Processing & Assembly]:
        ├─ Ghép rawText cấu trúc: "--- [TRANG X/N] ---\n..."
        ├─ extractHeuristicHeaderInfo(rawText): labName, batchNo, dates
        ├─ Tính toán confidence trung bình
        └─ worker.terminate()
        │
        ▼
[TesseractFallbackResult]:
  {
    _isOfflineFallback: true,
    pageCount: N,
    pageTexts: [...],
    testResults: ExtractedCriterionItem[],
    labName, batchNo, dates,
    notes,
    offlineMessage
  }
```

---

## 3. Phạm Vi Công Việc (Scope)

- **Module cập nhật**:
  - `src/services/ai/tesseractFallback.ts`:
    - Định nghĩa interface `PageOcrText` và mở rộng `TesseractFallbackResult`.
    - Xây dựng `extractHeuristicHeaderInfo(rawText)`.
    - Xây dựng `extractHeuristicCriteriaFromText(text, pageNumber)`.
    - Nâng cấp `extractRawTextWithTesseract(file, onProgress)` xử lý toàn diện đa trang và bắt lỗi từng trang.
    - Cập nhật type guard `isTesseractFallbackResult`.
  - `src/services/ai/geminiService.ts`:
    - Bổ sung `pageCount: 0` cho `emptyFallback` để tương thích chặt chẽ với schema.
- **Bộ kiểm thử tự động**:
  - `tests/ocr/tesseractFallback.test.ts`: 8 test cases bao phủ toàn diện:
    - Bóc tách Header (lab, batchNo, ngày sản xuất, hạn dùng, ngày kiểm nghiệm).
    - Chuẩn hóa ngày từ `DD-MM-YYYY` sang `DD/MM/YYYY`.
    - Bóc tách chỉ tiêu từ bảng `|` và từ dạng `:` kèm `sourcePageNumber`.
    - Quét đa trang PDF (xác minh gọi recognize cho toàn bộ N trang).
    - Phục hồi an toàn khi 1 trang bị lỗi (ghi nhận `failedPages`, giữ dữ liệu trang khác).
    - Nhận diện file ảnh đơn trang.
    - Kiểm tra type guard `isTesseractFallbackResult`.

---

## 4. Tiêu Chí Nghiệm Thu (Acceptance Criteria)

| Mã AC    | Mô tả tiêu chí                                                           | Kết quả thực tế                                                                                         | Trạng thái |
| -------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------- |
| **AC-1** | Quét 100% các trang của PDF trong chế độ Offline (Khắc phục CRITICAL-01) | `extractRawTextWithTesseract` duyệt qua toàn bộ $N$ trang được render bởi `convertPdfToImages`          | **PASS**   |
| **AC-2** | Bóc tách Heuristic chỉ tiêu kiểm nghiệm (Khắc phục CRITICAL-02)          | `extractHeuristicCriteriaFromText` trích xuất các hàng bảng có `criteriaName`, `value`, `unit`, `limit` | **PASS**   |
| **AC-3** | Bảo tồn số trang nguồn `sourcePageNumber` (Rule 7 & 8)                   | Mọi chỉ tiêu bóc tách được từ trang $k$ đều gán cứng `sourcePageNumber = k`                             | **PASS**   |
| **AC-4** | Tự động bóc tách Header tài liệu cơ bản                                  | `extractHeuristicHeaderInfo` nhận diện đúng số lô, lab, tên thuốc và chuẩn hóa ngày                     | **PASS**   |
| **AC-5** | Báo cáo tiến độ chi tiết theo từng trang                                 | Callback `onProgress` thông báo rõ số trang đang xử lý (`Đang nhận diện trang 1/3...`)                  | **PASS**   |
| **AC-6** | Phục hồi lỗi an toàn và dọn dẹp bộ nhớ                                   | Bắt lỗi độc lập từng trang, ghi nhận `failedPages`, luôn `terminate()` worker trong `finally`           | **PASS**   |

---

## 5. Kết Quả Kiểm Thử (Verification Results)

- **Kiểm thử đơn vị (Vitest)**:
  - `tests/ocr/tesseractFallback.test.ts`: **8/8 PASS**
  - Toàn bộ suite `tests/ocr/`: **67/67 PASS** (9 test suites)
- **Kiểm tra kiểu dữ liệu (TypeScript)**:
  - `npx tsc --noEmit`: **0 lỗi**
- **Đóng gói sản phẩm (Vite Build)**:
  - `npm run build`: **Thành công (14.49s)**, chunk `tesseractFallback` được lazy-load độc lập (6.42 kB).

---

## 6. Trạng Thái Hoàn Thành

- **Giai đoạn**: OCR-08 (Tesseract Multi-Page Fallback)
- **Đánh giá**: **PASS 100%**
- **Sẵn sàng chuyển sang**: OCR-09 (Confidence Scoring & LOW Confidence Guard) khi có lệnh từ người dùng.
