# PHASE MANIFEST: OCR-02 — PDF ANALYZER

_Dự án PQM (Pharma Quality Management) — Chuẩn hóa Framework Vibecode_  
_Tài liệu triển khai và nghiệm thu Động cơ phân tích tài liệu PDF trước khi OCR_

---

## 1. Mục Tiêu (Objective)

Xây dựng và chuẩn hóa pipeline phân tích cấu trúc tài liệu PDF (`PDF Analyzer`) trước khi thực hiện OCR, giúp hệ thống tự động nhận diện bản chất tài liệu (Native Text vs Scanned Image vs Mixed), kiểm tra tính khả dụng thực tế của text layer, đếm chính xác số trang và lựa chọn chiến lược xử lý (processingStrategy) tối ưu mà không làm mất PDF gốc hay siêu dữ liệu trang.

---

## 2. Quy Trình Vận Hành (Workflow)

```
[File PDF Đầu Vào]
        │
        ▼
[Analyze Document] (Khai thác PDF.js stream, không làm mất PDF gốc)
        │
        ├──> [Detect Page Count]: Đếm chính xác số trang (1..N)
        │
        ├──> [Detect Text Layer]: Kiểm tra mật độ ký tự/từ & đánh giá Usable (Loại trừ rác/watermark scanner)
        │
        ├──> [Detect Scanned/Image Page]: Nhận diện trang rỗng hoặc trang ảnh thuần
        │
        └──> [Select Processing Strategy]:
                 ├── NATIVE_TEXT   ──> EXTRACT_TEXT_DIRECT
                 ├── SCANNED_IMAGE ──> HIGH_DPI_RENDER_VISION
                 └── MIXED_PDF     ──> HYBRID_PAGE_BY_PAGE
```

---

## 3. Phạm Vi Công Việc (Scope)

- **Hạng mục thực hiện**:
  - Mở rộng kiểu dữ liệu tại `src/services/ocr/types.ts`: Bổ sung `documentType` (`NATIVE_TEXT` | `SCANNED_IMAGE` | `MIXED_PDF`), `pageCount`, `hasTextLayer`, `pageTypes[]`, `processingStrategy` (`EXTRACT_TEXT_DIRECT` | `HIGH_DPI_RENDER_VISION` | `HYBRID_PAGE_BY_PAGE`).
  - Nâng cấp bộ phân tích `src/services/ocr/pdfAnalyzer.ts`:
    - Thêm cơ chế đánh giá tính khả dụng thực tế `isTextUsable` (phân biệt nội dung bảng dược điển với watermark rác như "Scanned with CamScanner").
    - Phân loại trang chuẩn xác: `TEXT`, `SCANNED`, `MIXED`.
    - Lựa chọn chiến lược tổng thể cho tài liệu.
  - Bảo đảm tương thích ngược 100% trong `src/utils/pdfProcessor.ts`.
  - Bổ sung bộ test kiểm chứng toàn diện tại `tests/ocr/pdfAnalyzer.test.ts`.
- **Ranh giới tác vụ (Scope Guard)**:
  - **KHÔNG** thay đổi UI ở phase này.
  - **KHÔNG** làm thay đổi luồng upload hiện có (`convertPdfToImages`).
  - **KHÔNG** tự ý chuyển sang OCR-03.

---

## 4. Danh Mục Tệp Tin Trong Phạm Vi (Files in Scope)

| Tệp tin                           |   Trạng thái   | Giải thích vai trò                                                                                                                         |
| :-------------------------------- | :------------: | :----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/ocr/types.ts`       |   **MODIFY**   | Bổ sung các kiểu dữ liệu chuẩn hóa: `PageContentType`, `ProcessingStrategy`, `PageTypeInfo`, và mở rộng `PdfAnalysisReport`.               |
| `src/services/ocr/pdfAnalyzer.ts` |   **MODIFY**   | Cung cấp hàm `analyzePdf` và `analyzePageText` tính toán `documentType`, `pageCount`, `hasTextLayer`, `pageTypes[]`, `processingStrategy`. |
| `src/utils/pdfProcessor.ts`       | **MAINTAINED** | Re-export `analyzePdf`, giữ nguyên vẹn `convertPdfToImages` cho existing callers.                                                          |
| `tests/ocr/pdfAnalyzer.test.ts`   |   **MODIFY**   | Bộ 10 ca kiểm thử bao phủ toàn bộ các kịch bản: Native Text, Scan, Mixed, Multi-page 5 trang, Watermark detection.                         |
| `tests/ocr/pdfProcessor.test.ts`  |   **MODIFY**   | Kiểm chứng re-export và tính tương thích ngược.                                                                                            |
| `.vibecode/PHASES/OCR-02.md`      |    **NEW**     | Báo cáo nghiệm thu Phase OCR-02.                                                                                                           |

---

## 5. Cấu Trúc Kết Quả Phân Tích Chuẩn Hóa (Structured Document Analysis Result)

`analyzePdf()` trả về đối tượng `PdfAnalysisReport` gồm:

```typescript
export interface PdfAnalysisReport {
  /** Số trang phát hiện được */
  pageCount: number;
  /** Tương thích ngược với totalPages */
  totalPages: number;
  /** Phân loại tài liệu: NATIVE_TEXT | SCANNED_IMAGE | MIXED_PDF */
  documentType: 'NATIVE_TEXT' | 'SCANNED_IMAGE' | 'MIXED_PDF';
  /** Tương thích ngược với docType cũ */
  docType: 'NATIVE_TEXT' | 'SCANNED_IMAGE' | 'MIXED_PDF' | 'DIGITAL_TEXT' | 'HYBRID';
  /** Có lớp text layer khả dụng hay không */
  hasTextLayer: boolean;
  /** Danh sách phân loại từng trang */
  pageTypes: Array<{
    pageNumber: number;
    type: 'TEXT' | 'SCANNED' | 'MIXED';
    usableText: boolean;
    charCount: number;
    wordCount: number;
  }>;
  /** Chiến lược xử lý đề xuất cho pipeline tiếp theo */
  processingStrategy: 'EXTRACT_TEXT_DIRECT' | 'HIGH_DPI_RENDER_VISION' | 'HYBRID_PAGE_BY_PAGE';
  /** Chi tiết cấu trúc và hình học từng trang */
  pages: PdfPageAnalysis[];
  /** Tổng số ký tự trong text layer */
  totalChars: number;
  /** Tổng số từ trong text layer */
  totalWords: number;
  /** Đánh giá có thể dùng Native Text extraction hay không */
  canUseNativeText: boolean;
  /** Tóm tắt lý do phân loại */
  summaryReason: string;
}
```

---

## 6. Tiêu Chí Nghiệm Thu (Acceptance Criteria Status)

- [x] **AC-1 (PDF Native Text)**: Tài liệu có text layer đầy đủ được nhận diện là `documentType: 'NATIVE_TEXT'`, `processingStrategy: 'EXTRACT_TEXT_DIRECT'`, `canUseNativeText: true` (PASS).
- [x] **AC-2 (PDF Scan)**: Tài liệu scan thuần túy (hoặc chỉ có watermark rác của scanner) được nhận diện là `documentType: 'SCANNED_IMAGE'`, `processingStrategy: 'HIGH_DPI_RENDER_VISION'`, `canUseNativeText: false` (PASS).
- [x] **AC-3 (Mixed PDF)**: Tài liệu gồm cả trang text và trang scan được nhận diện là `documentType: 'MIXED_PDF'`, `processingStrategy: 'HYBRID_PAGE_BY_PAGE'` (PASS).
- [x] **AC-4 (Multi-page Integrity)**: Tài liệu 5 trang xử lý tuần tự không làm mất bất kỳ trang nào (`pageCount = 5`, `pages.length = 5`, `pageTypes.length = 5`) (PASS).
- [x] **AC-5 (Backward Compatibility)**: Hàm `convertPdfToImages` trong `pdfProcessor.ts` và luồng upload hiện hữu của Form hoạt động 100% bình thường (PASS).
- [x] **AC-6 (Build & Quality Check)**: `npx tsc --noEmit` đạt 0 lỗi, `tests/ocr` đạt 24/24 tests pass (100%) (PASS).

---

## 7. Báo Cáo Hoàn Thành (Completion Report)

- **Trạng thái**: **PASS** ✅
- **Thời gian hoàn thành**: 2026-09-23 09:40
- **Kết quả kiểm thử**: 24/24 OCR unit tests pass (100%).
- **Kiểm tra TypeScript**: `npx tsc --noEmit` đạt **0 errors**.
- **Không tự chuyển phase**: Dừng tại đây và chờ lệnh tiếp theo từ User cho Phase OCR-03.
