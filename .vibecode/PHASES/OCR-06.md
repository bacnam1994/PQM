# PHASE MANIFEST: OCR-06 — GEMINI VISION EXTRACTION & SCHEMA HARDENING

_Dự án PQM (Pharma Quality Management) — Chuẩn hóa Framework Vibecode_  
_Tài liệu triển khai và nghiệm thu Nâng cấp trích xuất AI Vision & Làm cứng Schema dữ liệu dược phẩm_

---

## 1. Mục Tiêu (Objective)

Giải quyết dứt điểm các yêu cầu cốt lõi về chất lượng dữ liệu và tính toàn vẹn y dược học:

1. **Làm cứng Schema dữ liệu (Schema Hardening)**: Bổ sung các trường thiết yếu vào `OCR_RESPONSE_SCHEMA` của Gemini:
   - Header: `productCode`, `productName`.
   - Criteria Items: `confidenceScore` (0..100), `rawText`, `sourcePageNumber` (1..N).
2. **Thực thi triệt để các quy tắc bảo toàn dữ liệu Dược phẩm**:
   - **Rule 3 (Preserve Decimal Delimiters & Zero Values)**: Bảo toàn số thập phân nhỏ (`0.05` không bị biến thành `0.5` hoặc bị làm tròn), số 0 là dữ liệu hợp lệ (`0`, `0.0`, `0%` không được để trống hay nuốt mất).
   - **Rule 4 (Mandatory Unit Preservation)**: Đơn vị tính tách rời độc lập (`unit`: `ppm`, `CFU/g`, `%`...), không lẫn vào giá trị đo (`value`).
   - **Rule 5 (Distinguish Value vs Limit)**: Phân tách tuyệt đối giữa kết quả thực tế (`value`) và mức tiêu chuẩn (`limit`: `≤ 10.0 ppm`, `90.0 - 110.0%`). Cấm đưa giới hạn vào ô kết quả.
   - **Rule 6 (Preserve Comparison & Scientific Notation)**: Giữ nguyên các toán tử so sánh (`< 10`, `≤ 0.5%`) và định dạng số mũ vi sinh (`1.5 × 10³ CFU/g`, `1.5E3`).
   - **Rule 10 (Decouple Extraction & Mapping)**: Giữ nguyên văn `criteriaName` thô từ phiếu trước khi chuyển sang đối chiếu TCCS.
   - **Rule 11 & 12 (Confidence Scoring & LOW Confidence Guard)**: Tách riêng chỉ số điểm tin cậy `confidenceScore` (0-100), cảnh báo khi `< 75%`.

---

## 2. Quy Trình Vận Hành (Workflow)

```
[Hình ảnh Trang PKN]
       │
       ▼
[Gemini Vision Request với Hardened Schema]:
       ├── Prompt tích hợp PHARMA_DATA_INTEGRITY_GUIDE
       ├── Cấu trúc JSON Schema nghiêm ngặt:
       │     ├── Header: labName, documentType, pageCount, productCode, productName, batchNo, dates
       │     └── testResults[]:
       │           ├── criteriaName (nguyên bản từ phiếu)
       │           ├── mappedName (tùy chọn)
       │           ├── confidence ("high" | "medium" | "low")
       │           ├── confidenceScore (0..100)
       │           ├── value ("0.05", "0", "< 10", "1.5 × 10³")
       │           ├── unit ("ppm", "%", "CFU/g")
       │           ├── limit ("≤ 1.0 ppm")
       │           ├── analysisMethod ("HPLC", "TCVN...")
       │           ├── sourcePageNumber (1..N)
       │           └── rawText (văn bản thô)
       │
       ▼
[Data Normalization & Fallback Guard (pageExtractor)]:
       ├── Chuẩn hóa confidenceScore: Nếu AI không trả về, tự động tính fallback hợp lý (high=95, med=80, low=60)
       ├── Ép gán cứng sourcePageNumber = page.pageNumber
       ├── Bảo toàn định dạng chuỗi số học, số 0, dấu thập phân và toán tử so sánh
       └── Kế thừa đầy đủ productCode, productName khi gộp đa trang
```

---

## 3. Phạm Vi Công Việc (Scope)

- **Hạng mục thực hiện**:
  - Nâng cấp `src/services/ai/prompts.ts`:
    - Định nghĩa `PHARMA_DATA_INTEGRITY_GUIDE` gồm 5 nhóm quy tắc bất biến.
    - Cập nhật `buildExtractionPrompt` tích hợp hướng dẫn số mũ vi sinh, phân tách value/limit, bảo toàn số 0 và cấu trúc JSON chuẩn.
  - Nâng cấp `src/services/ai/geminiService.ts`:
    - Cập nhật `OCR_RESPONSE_SCHEMA` với `productCode`, `productName`, `confidenceScore`, `rawText`.
  - Nâng cấp `src/services/ocr/types.ts`:
    - Mở rộng `DocumentContext`, `PageExtractionResult`, `MultiPageExtractionResult` với `productCode?` và `productName?`.
  - Nâng cấp `src/services/ocr/pageExtractor.ts`:
    - Bóc tách `productCode`, `productName`, tính toán `confidenceScore` (0..100), truyền dẫn `runningContext` giữa các trang.
  - Bộ kiểm thử tại `tests/ocr/schemaHardening.test.ts`:
    - Kiểm chứng `PHARMA_DATA_INTEGRITY_GUIDE` trong prompt.
    - Kiểm chứng bóc tách `productCode`, `productName`, số thập phân `0.05`, số 0 hợp lệ, ký hiệu khoa học (`< 10`, `≤ 10³ CFU/g`, `1.5 × 10²`).
    - Kiểm chứng kế thừa `productCode`, `productName` khi gộp đa trang.
    - Kiểm chứng tính toán fallback `confidenceScore`.

- **Ranh giới tác vụ (Scope Guard)**:
  - **KHÔNG** sửa đổi giao diện người dùng (UI) ở phase này (UI review chi tiết sẽ thực hiện ở OCR-11).
  - **KHÔNG** can thiệp vào logic đối chiếu TCCS độc lập (thuộc phase OCR-10).

---

## 4. Danh Mục Tệp Tin Trong Phạm Vi (Files in Scope)

| Tệp tin                             | Trạng thái | Giải thích vai trò                                                                           |
| :---------------------------------- | :--------: | :------------------------------------------------------------------------------------------- |
| `src/services/ai/prompts.ts`        |  Cập nhật  | Bổ sung `PHARMA_DATA_INTEGRITY_GUIDE` và cấu trúc JSON chuẩn                                 |
| `src/services/ai/geminiService.ts`  |  Cập nhật  | Mở rộng `OCR_RESPONSE_SCHEMA` với `productCode`, `productName`, `confidenceScore`, `rawText` |
| `src/services/ocr/types.ts`         |  Cập nhật  | Bổ sung `productCode`, `productName` vào types                                               |
| `src/services/ocr/pageExtractor.ts` |  Cập nhật  | Chuẩn hóa `confidenceScore`, bóc tách và kế thừa `productCode`, `productName`                |
| `tests/ocr/schemaHardening.test.ts` |    Mới     | Bộ 5 test case kiểm thử toàn diện Schema Hardening và bảo toàn số liệu                       |
| `.vibecode/PHASES/OCR-06.md`        |    Mới     | Tài liệu nghiệm thu Phase OCR-06                                                             |

---

## 5. Tiêu Chí Nghiệm Thu (Acceptance Criteria - AC)

| Mã AC    | Yêu cầu                                   | Kết quả                                                                                  | Trạng thái |
| :------- | :---------------------------------------- | :--------------------------------------------------------------------------------------- | :--------: |
| **AC-1** | Hardened JSON Schema đầy đủ               | Schema có `productCode`, `productName`, `confidenceScore`, `rawText`, `sourcePageNumber` |  **PASS**  |
| **AC-2** | Bảo toàn dấu thập phân & số 0 (Rule 3)    | `0.05` giữ nguyên vẹn, số `0` và `0.0` không bị nuốt thành chuỗi rỗng                    |  **PASS**  |
| **AC-3** | Phân tách kết quả đo và giới hạn (Rule 5) | `limit` chứa ngưỡng tiêu chuẩn, `value` chứa kết quả thực tế                             |  **PASS**  |
| **AC-4** | Bảo toàn ký hiệu so sánh & số mũ (Rule 6) | Giữ nguyên `<`, `>`, `≤`, `≥`, `±`, `×10³`, `1.5 x 10^3`                                 |  **PASS**  |
| **AC-5** | Điểm tin cậy độc lập (Rule 11, 12)        | `confidenceScore` dạng số 0..100, tự động phân cấp và cảnh báo khi `< 75%`               |  **PASS**  |
| **AC-6** | Kiểm thử tự động & Zero Regression        | 46/46 OCR tests, 0 lỗi TypeScript, build thành công 11.43s                               |  **PASS**  |

---

## 6. Kết Quả Kiểm Thử (Verification Log)

```
✓ tests/ocr/schemaHardening.test.ts (5 tests)
  ✓ Gemini Vision Extraction & Schema Hardening (OCR-06) > 1. PHARMA_DATA_INTEGRITY_GUIDE & Prompt Hardening > chứa đầy đủ các quy tắc bảo toàn tính toàn vẹn dữ liệu dược phẩm
  ✓ Gemini Vision Extraction & Schema Hardening (OCR-06) > 1. PHARMA_DATA_INTEGRITY_GUIDE & Prompt Hardening > prompt trích xuất hoàn chỉnh chứa cả cấu trúc JSON mới và hướng dẫn bảo vệ dữ liệu
  ✓ Gemini Vision Extraction & Schema Hardening (OCR-06) > 2. Bóc tách & Chuẩn hóa Schema (Data Normalization) > bóc tách chính xác productCode, productName, số thập phân 0.05, số 0 hợp lệ và ký hiệu khoa học
  ✓ Gemini Vision Extraction & Schema Hardening (OCR-06) > 2. Bóc tách & Chuẩn hóa Schema (Data Normalization) > hợp nhất đa trang kế thừa trọn vẹn productCode và productName từ trang 1
  ✓ Gemini Vision Extraction & Schema Hardening (OCR-06) > 2. Bóc tách & Chuẩn hóa Schema (Data Normalization) > tính toán fallback confidenceScore hợp lý khi AI không trả về trường này
✓ tests/ocr/pageExtractor.test.ts (9 tests)
✓ tests/ocr/benchmark.test.ts (3 tests)
✓ tests/ocr/imagePreprocessor.test.ts (10 tests)
✓ tests/ocr/pdfAnalyzer.test.ts (10 tests)
✓ tests/ocr/pdfProcessor.test.ts (2 tests)
✓ tests/ocr/highDpiRenderer.test.ts (7 tests)

Test Files  7 passed (7)
     Tests  46 passed (46)
```

---

## 7. Kết Luận & Chuyển Giao

- Phase **OCR-06 — Gemini Vision Extraction & Schema Hardening** đã hoàn thành 100% mục tiêu, đảm bảo dữ liệu trích xuất từ Gemini Vision phản ánh chính xác cấu trúc y dược học.
- Hệ thống sẵn sàng cho Phase tiếp theo: **OCR-07 — Multi-Page Merge Engine**.
