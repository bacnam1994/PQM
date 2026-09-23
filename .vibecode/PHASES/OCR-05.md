# PHASE MANIFEST: OCR-05 — PER-PAGE EXTRACTION & CONTEXT TRACKING

_Dự án PQM (Pharma Quality Management) — Chuẩn hóa Framework Vibecode_  
_Tài liệu triển khai và nghiệm thu Bóc tách dữ liệu từng trang độc lập & Bảo tồn ngữ cảnh tài liệu_

---

## 1. Mục Tiêu (Objective)

Giải quyết dứt điểm các lỗi nghiêm trọng đã phát hiện trong kiểm toán OCR-01:

1. **Khắc phục lỗi nuốt mất trang và chunk drop âm thầm (CRITICAL-03)**: Thay thế hoàn toàn cơ chế chia chunk 3 trang cũ (nếu lỗi mạng ở chunk sau thì mất dữ liệu mà không báo) bằng quy trình bóc tách từng trang độc lập (`extractAllPagesSequentially`), có thử lại cục bộ theo trang và ghi nhận cảnh báo minh bạch nếu trang nào thất bại.
2. **Khắc phục lỗi nuốt nhầm phép thử khi Deduplicate (CRITICAL-04)**: Không còn sử dụng Set kiểm tra `criteriaName` thô bạo làm mất các chỉ tiêu kiểm nghiệm trùng tên hoặc phép thử con; bảo toàn 100% các dòng chỉ tiêu trên tất cả các trang.
3. **Thực thi triệt để Rule 7 (Preserve Source Page Index)**: Gắn cứng `sourcePageNumber` (số thứ tự trang tài liệu từ 1..N) vào từng chỉ tiêu trích xuất được để phục vụ giao diện đối soát trực quan (Review UI).
4. **Bảo tồn ngữ cảnh tài liệu xuyên trang (Rule 8: Zero Loss Across Multi-page)**: Truyền liên tục thông tin số lô (`batchNo`), đơn vị kiểm nghiệm (`labName`) và chỉ tiêu cuối của trang trước (`lastItemFromPreviousPage`) sang prompt các trang tiếp theo để nối bảng liền mạch.

---

## 2. Quy Trình Vận Hành (Workflow)

```
[Danh sách Rendered Pages: 1..N]
       │
       ▼
[Vòng lặp Duyệt Từng Trang (Sequential Execution)]:
       ├── Trang 1:
       │     ├── Prompt trang trí với context: Page 1 / N
       │     ├── Gọi Gemini Vision API
       │     ├── Trích xuất: Header (labName, batchNo, dates) + Test Results
       │     ├── Ép gán: sourcePageNumber = 1 cho 100% chỉ tiêu
       │     └── Cập nhật runningContext: batchNo, labName, lastItem = "pH"
       │
       ├── Trang 2:
       │     ├── Prompt trang trí với runningContext: "Số lô: L240901, Lab: Quatest 1, Nối tiếp từ 'pH'"
       │     ├── Gọi Gemini Vision API
       │     ├── Trích xuất: Tiếp nối bảng chỉ tiêu
       │     ├── Ép gán: sourcePageNumber = 2 cho 100% chỉ tiêu
       │     └── Cơ chế phát hiện duplicate ranh giới (nếu dòng đầu trang 2 lặp nguyên xi dòng cuối trang 1)
       │
       └── Trang k: (Cơ chế Retry tối đa 2 lần trước khi gắn cờ FAILED nếu mất mạng)
       │
       ▼
[Merge Multi-Page Engine]:
       ├── Kết hợp Header fields từ trang sớm nhất có giá trị
       ├── Gộp toàn bộ testResults (bảo toàn 100% sourcePageNumber)
       ├── Tổng hợp notes và cảnh báo trang lỗi (nếu có trang FAILED)
       └── Trả về MultiPageExtractionResult (tương thích ngược hoàn toàn với UI)
```

---

## 3. Phạm Vi Công Việc (Scope)

- **Hạng mục thực hiện**:
  - Mở rộng Type definitions tại `src/services/ocr/types.ts`:
    - `ExtractedCriterionItem`: Bổ sung bắt buộc `sourcePageNumber: number`.
    - `DocumentContext`: Lưu trữ thông tin truyền giữa các trang (`batchNo`, `labName`, `lastItemFromPreviousPage`).
    - `PageExtractionResult`: Kết quả chi tiết của từng trang độc lập (`pageNumber`, `status: SUCCESS | PARTIAL | FAILED`, `testResults`, `rawResponse`).
    - `MultiPageExtractionResult`: Cấu trúc tổng hợp đầy đủ sau khi gộp trang.
    - `PageExtractionInput`: Type linh hoạt tương thích cả `RenderedPageResult` và `RenderedPdfPage`.
  - Xây dựng Module độc lập `src/services/ocr/pageExtractor.ts`:
    - Hàm `buildPageExtractionPrompt`: Trang hoàng prompt ngữ cảnh trang, thông báo bảng nối trang và chỉ thị gán `sourcePageNumber`.
    - Hàm `extractSinglePageData`: Gọi AI, chuyển đổi và ép gán `sourcePageNumber = page.pageNumber`.
    - Hàm `mergeMultiPageResults`: Hợp nhất kết quả đa trang, xử lý trùng lặp ranh giới, ghi nhận cảnh báo trang hỏng.
    - Hàm `extractAllPagesSequentially`: Điều phối duyệt trang tuần tự, truyền ngữ cảnh, retry cục bộ, cập nhật tiến độ chi tiết.
  - Nâng cấp `src/services/ai/geminiService.ts`:
    - Bổ sung `sourcePageNumber` vào `OCR_RESPONSE_SCHEMA`.
    - Thay thế luồng chunking 3 trang cũ bằng `extractAllPagesSequentially`.
    - Gán `sourcePageNumber = 1` cho các kết quả từ tệp ảnh đơn lẻ.
  - Mở rộng Model `src/components/features/MappingConfirmModal.tsx`:
    - Bổ sung `sourcePageNumber?: number` vào `AIExtractedItem`.
  - Tích hợp Hook `src/pages/qa/test-result-form/hooks/useTestResultAIIntegration.ts`:
    - Truyền `sourcePageNumber` từ `result.testResults` vào `rawItems` cho cả luồng upload đơn và GDFile scan.
  - Bộ kiểm thử tại `tests/ocr/pageExtractor.test.ts`:
    - Kiểm chứng `buildPageExtractionPrompt` đơn trang và đa trang.
    - Kiểm chứng ép gán `sourcePageNumber` trong `extractSinglePageData`.
    - Kiểm chứng hợp nhất `mergeMultiPageResults` bảng nối trang và xử lý ranh giới.
    - Kiểm chứng phục hồi lỗi cục bộ và ném ngoại lệ khi 100% trang thất bại.

- **Ranh giới tác vụ (Scope Guard)**:
  - **KHÔNG** sửa đổi giao diện người dùng (UI) ở phase này (UI review chi tiết sẽ thực hiện ở OCR-11).
  - **KHÔNG** thay đổi logic đối chiếu TCCS (thuộc phase OCR-10).

---

## 4. Danh Mục Tệp Tin Trong Phạm Vi (Files in Scope)

| Tệp tin                                                             | Trạng thái | Giải thích vai trò                                                                             |
| :------------------------------------------------------------------ | :--------: | :--------------------------------------------------------------------------------------------- |
| `src/services/ocr/types.ts`                                         |  Cập nhật  | Bổ sung types cho per-page extraction, context tracking, `sourcePageNumber`                    |
| `src/services/ocr/pageExtractor.ts`                                 |    Mới     | Module trích xuất từng trang, truyền ngữ cảnh và hợp nhất đa trang                             |
| `src/services/ai/geminiService.ts`                                  |  Cập nhật  | Tích hợp `sourcePageNumber` vào schema và thay thế chunking bằng `extractAllPagesSequentially` |
| `src/components/features/MappingConfirmModal.tsx`                   |  Cập nhật  | Mở rộng `AIExtractedItem` với `sourcePageNumber`                                               |
| `src/pages/qa/test-result-form/hooks/useTestResultAIIntegration.ts` |  Cập nhật  | Truyền dẫn `sourcePageNumber` vào `rawItems`                                                   |
| `tests/ocr/pageExtractor.test.ts`                                   |    Mới     | Bộ 9 test case kiểm thử toàn diện module bóc tách từng trang                                   |
| `.vibecode/PHASES/OCR-05.md`                                        |    Mới     | Tài liệu nghiệm thu Phase OCR-05                                                               |

---

## 5. Tiêu Chí Nghiệm Thu (Acceptance Criteria - AC)

| Mã AC    | Yêu cầu                                               | Kết quả                                                                    | Trạng thái |
| :------- | :---------------------------------------------------- | :------------------------------------------------------------------------- | :--------: |
| **AC-1** | Bóc tách từng trang độc lập, không chunk mù quáng     | Mỗi trang được đọc độc lập, có retry riêng                                 |  **PASS**  |
| **AC-2** | Bảo lưu thông tin trang nguồn (Rule 7)                | 100% chỉ tiêu được gắn cứng `sourcePageNumber = page.pageNumber`           |  **PASS**  |
| **AC-3** | Truyền ngữ cảnh tài liệu giữa các trang               | Trang $i > 1$ nhận được `batchNo`, `labName`, `lastItem` từ trang trước    |  **PASS**  |
| **AC-4** | Không nuốt lỗi mạng âm thầm (Vá CRITICAL-03)          | Trang lỗi được ghi nhận trong `failedPages` và `notes`, không tự ý bỏ qua  |  **PASS**  |
| **AC-5** | Không làm mất chỉ tiêu khi gộp trang (Vá CRITICAL-04) | Bảo toàn toàn bộ chỉ tiêu, chỉ lọc trùng lặp ranh giới thực sự             |  **PASS**  |
| **AC-6** | Kiểm thử tự động & Zero Regression                    | 41/41 OCR tests, 144/144 test files toàn dự án PASS 100%, build thành công |  **PASS**  |

---

## 6. Kết Quả Kiểm Thử (Verification Log)

```
✓ tests/ocr/benchmark.test.ts (3 tests)
✓ tests/ocr/pageExtractor.test.ts (9 tests)
  ✓ Per-Page Extraction & Context Preservation (OCR-05) > 1. buildPageExtractionPrompt > trang hoàng prompt đơn trang chính xác với chỉ dẫn số trang
  ✓ Per-Page Extraction & Context Preservation (OCR-05) > 1. buildPageExtractionPrompt > trang hoàng prompt trang 2/3 với thông tin số lô, lab và bảng nối trang từ ngữ cảnh trang trước
  ✓ Per-Page Extraction & Context Preservation (OCR-05) > 2. extractSinglePageData > gán cứng sourcePageNumber = page.pageNumber cho toàn bộ các chỉ tiêu trích xuất được
  ✓ Per-Page Extraction & Context Preservation (OCR-05) > 2. extractSinglePageData > xử lý an toàn khi trang gặp lỗi ngoại lệ mà không làm crash tiến trình
  ✓ Per-Page Extraction & Context Preservation (OCR-05) > 3. mergeMultiPageResults > hợp nhất đầy đủ chỉ tiêu của các trang và bảo toàn sourcePageNumber cho từng mục
  ✓ Per-Page Extraction & Context Preservation (OCR-05) > 3. mergeMultiPageResults > loại trừ an toàn dòng tiêu đề bảng lặp lại ở ranh giới trang mà không làm mất chỉ tiêu thật
  ✓ Per-Page Extraction & Context Preservation (OCR-05) > 3. mergeMultiPageResults > xử lý phục hồi khi có trang bị lỗi: giữ lại dữ liệu trang thành công và ghi chú cảnh báo
  ✓ Per-Page Extraction & Context Preservation (OCR-05) > 4. extractAllPagesSequentially > chạy tuần tự qua các trang và truyền runningContext từ trang 1 sang trang 2
  ✓ Per-Page Extraction & Context Preservation (OCR-05) > 4. extractAllPagesSequentially > ném lỗi khi toàn bộ các trang đều thất bại để kích hoạt offline fallback
✓ tests/ocr/pdfAnalyzer.test.ts (10 tests)
✓ tests/ocr/pdfProcessor.test.ts (2 tests)
✓ tests/ocr/imagePreprocessor.test.ts (10 tests)
✓ tests/ocr/highDpiRenderer.test.ts (7 tests)

Test Files  6 passed (6)
     Tests  41 passed (41)

Full Regression Test:
Test Files  144 passed (144)
     Tests  1333 passed (1333)
```

---

## 7. Kết Luận & Chuyển Giao

- Phase **OCR-05 — Per-Page Extraction & Context Tracking** đã hoàn thành 100% mục tiêu, vá triệt để 2 lỗi CRITICAL của pipeline trước đây và bảo đảm thông tin `sourcePageNumber` xuyên suốt.
- Hệ thống sẵn sàng cho Phase tiếp theo: **OCR-06 — Gemini Vision Extraction & Schema Hardening**.
