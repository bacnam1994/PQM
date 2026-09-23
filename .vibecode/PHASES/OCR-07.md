# PHASE MANIFEST: OCR-07 — MULTI-PAGE MERGE ENGINE

_Dự án PQM (Pharma Quality Management) — Chuẩn hóa Framework Vibecode_  
_Tài liệu triển khai và nghiệm thu Động cơ hợp nhất dữ liệu đa trang chuyên dụng (Multi-Page Merge Engine)_

---

## 1. Mục Tiêu (Objective)

Giải quyết dứt điểm các thách thức kỹ thuật khi xử lý Phiếu kiểm nghiệm (PKN) có từ 2 trang trở lên:

1. **Khử dòng tiêu đề bảng lặp lại (Repeated Column Header Removal)**: Tự động phát hiện và loại bỏ các hàng tiêu đề cột (STT, Tên chỉ tiêu, Kết quả, Mức chất lượng, Specification...) bị OCR nhận diện nhầm thành chỉ tiêu khi sang trang mới.
2. **Khử trùng lặp thông minh tại ranh giới trang (Boundary Deduplication)**: Nhận diện chính xác trường hợp mép dưới trang trước và mép trên trang sau cùng quét một chỉ tiêu (overlap scan) mà **không làm mất** các chỉ tiêu phân tích độc lập khác (loại bỏ hoàn toàn lỗi dùng Global Set theo tên gây mất chỉ tiêu).
3. **Hàn gắn hàng bị đứt gãy xuyên trang (Broken Row Stitching)**: Tự động nối và hợp nhất chỉ tiêu bị ngắt ngang giữa 2 trang (ví dụ: tên chỉ tiêu ở cuối trang trước bị cắt gạch nối `-`, giá trị/kết quả nằm ở đầu trang tiếp theo).
4. **Chuẩn hóa chỉ tiêu phân nhóm (Hierarchical / Grouped Criteria Harmonization)**: Loại bỏ các dòng tiêu đề nhóm cha rỗng (không có kết quả) mà vẫn bảo toàn 100% các chỉ tiêu con (child items).
5. **Hợp nhất Header tài liệu (Document Header Resolution)**: Lựa chọn tối ưu tên phòng thí nghiệm đầy đủ nhất, chuẩn hóa ngày tháng theo định dạng `DD/MM/YYYY`, bảo toàn số lô, mã sản phẩm trên toàn bộ các trang.
6. **Bảo tồn ngữ cảnh trang nguồn và ghi chú**: Giữ nguyên `sourcePageNumber` (Rule 7), tổng hợp ghi chú có tiền tố `[Trang X]`, và cảnh báo danh sách `failedPages` (nếu có trang bị lỗi).

---

## 2. Quy Trình Vận Hành (Workflow)

```
[Kết quả bóc tách từng trang: PageExtractionResult[]]
                       │
                       ▼
         [multiPageMerger: mergeMultiPageExtraction]
                       │
  ┌────────────────────┴────────────────────────┐
  │                                             │
  ▼                                             ▼
[1. Resolve Document Header]       [2. Resolve Aggregate Notes]
- Tên lab đầy đủ nhất              - [Trang X]: Ghi chú trang
- Chuẩn hóa ngày DD/MM/YYYY        - Cảnh báo [failedPages]
- Số lô, mã, tên sản phẩm
  │                                             │
  └────────────────────┬────────────────────────┘
                       │
                       ▼
[3. Sequential Row Stitching & Filtering Loop]:
  - Bỏ qua tiêu đề cột bảng lặp lại (isTableColumnHeaderRow)
  - Tại ranh giới chuyển trang (với item thực đầu tiên của trang mới):
      ├─ Khử trùng lặp mép (isBoundaryDuplicate)
      └─ Hàn gắn dòng bị ngắt ngang (tryStitchBrokenBoundaryRows)
  - Bảo toàn sourcePageNumber cho từng item
                       │
                       ▼
[4. Grouped Criteria Harmonization (harmonizeGroupedCriteria)]:
  - Loại bỏ các dòng cha container rỗng không có giá trị
  - Giữ nguyên 100% các chỉ tiêu con và chỉ tiêu định lượng
                       │
                       ▼
[MultiPageExtractionResult hoàn chỉnh cho Form & Mapping]
```

---

## 3. Phạm Vi Công Việc (Scope)

- **Module mới tạo**:
  - `src/services/ocr/multiPageMerger.ts`:
    - `isTableColumnHeaderRow(item: ExtractedCriterionItem): boolean`
    - `isBoundaryDuplicate(lastItem, currentItem): boolean`
    - `tryStitchBrokenBoundaryRows(lastItem, currentItem): ExtractedCriterionItem | null`
    - `harmonizeGroupedCriteria(items: ExtractedCriterionItem[]): ExtractedCriterionItem[]`
    - `resolveDocumentHeader(successfulPages: PageExtractionResult[])`
    - `mergeMultiPageExtraction(pageResults, totalPages): MultiPageExtractionResult`
- **Module cập nhật**:
  - `src/services/ocr/pageExtractor.ts`:
    - Tích hợp và ủy quyền hàm `mergeMultiPageResults` cho `mergeMultiPageExtraction`.
- **Bộ kiểm thử tự động**:
  - `tests/ocr/multiPageMerger.test.ts`: 13 test cases bao phủ toàn diện:
    - Nhận diện tiêu đề cột bảng (tiếng Việt & tiếng Anh).
    - Khử trùng lặp mép (không xóa nhầm item trùng tên cùng trang hoặc khác giá trị).
    - Hàn gắn hàng bị đứt gãy (cắt tên có dấu nối, tách rời tên và giá trị).
    - Chuẩn hóa chỉ tiêu nhóm (vi sinh vật, tạp chất).
    - Hợp nhất header tài liệu (lab name, ngày chuẩn).
    - Luồng End-to-End Orchestration tài liệu đa trang.

---

## 4. Tiêu Chí Nghiệm Thu (Acceptance Criteria)

| Mã AC    | Mô tả tiêu chí                                                   | Kết quả thực tế                                                                                              | Trạng thái |
| -------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------- |
| **AC-1** | Loại bỏ 100% dòng tiêu đề cột bảng lặp lại ở đầu trang tiếp theo | `isTableColumnHeaderRow` phát hiện chính xác các tổ hợp (STT, Tên chỉ tiêu, Kết quả...) và loại bỏ           | **PASS**   |
| **AC-2** | Khử trùng lặp mép ranh giới mà không mất chỉ tiêu độc lập        | `isBoundaryDuplicate` chỉ kích hoạt tại ranh giới giữa 2 trang khác nhau khi trùng cả tên, giá trị và đơn vị | **PASS**   |
| **AC-3** | Hàn gắn hàng bị đứt gãy xuyên trang (Broken Row Stitching)       | `tryStitchBrokenBoundaryRows` nối tên có dấu gạch nối và ghép cặp tên/kết quả xuyên trang chuẩn xác          | **PASS**   |
| **AC-4** | Chuẩn hóa chỉ tiêu nhóm cha rỗng không làm mất chỉ tiêu con      | `harmonizeGroupedCriteria` loại bỏ container header, giữ nguyên toàn bộ sub-items                            | **PASS**   |
| **AC-5** | Header phân giải chính xác (Lab name, Ngày, Số lô, Mã SP)        | `resolveDocumentHeader` ưu tiên ngày chuẩn `DD/MM/YYYY` và tên lab dài nhất                                  | **PASS**   |
| **AC-6** | Bảo toàn sourcePageNumber và ghi nhận failedPages                | Mọi chỉ tiêu giữ đúng số trang nguồn (Rule 7, 8); ghi nhận cảnh báo nếu có trang lỗi                         | **PASS**   |

---

## 5. Kết Quả Kiểm Thử (Verification Results)

- **Kiểm thử đơn vị (Vitest)**:
  - `tests/ocr/multiPageMerger.test.ts`: **13/13 PASS**
  - Toàn bộ suite `tests/ocr/`: **59/59 PASS** (8 test suites)
- **Kiểm tra kiểu dữ liệu (TypeScript)**:
  - `npx tsc --noEmit`: **0 lỗi**
- **Đóng gói sản phẩm (Vite Build)**:
  - `npm run build`: **Thành công (11.89s)**, không có cảnh báo nghiêm trọng.

---

## 6. Trạng Thái Hoàn Thành

- **Giai đoạn**: OCR-07 (Multi-Page Merge Engine)
- **Đánh giá**: **PASS 100%**
- **Sẵn sàng chuyển sang**: OCR-08 (Tesseract Multi-Page Fallback) khi có lệnh từ người dùng.
