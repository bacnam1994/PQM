---
name: pqm-ocr-pipeline
description: >-
  Immutable rules and engineering constraints for OCR & AI Vision extraction of
  Test Results (PKN) and TCCS documents in PQM. Activate when working on
  src/services/ocr/, src/services/ai/, PDF/Image extraction, or criteria mapping.
---

# PQM OCR & AI Vision Extraction Rules (Bản Chuẩn Hoá Thực Chiến)

Tài liệu này định nghĩa 12 quy tắc bất biến và kiến trúc thực tế xử lý trích xuất Phiếu Kiểm Nghiệm (PKN) và Tiêu chuẩn cơ sở (TCCS) bằng AI Vision (`src/services/ocr/`, `src/services/ai/`).

---

## 🏛️ Kiến trúc Đường ống OCR 4 Giai đoạn (4-Stage Pipeline)

```
[Ảnh/PDF Phiếu KN]
       │
       ▼ (Giai đoạn 1)
[High-DPI Renderer & Preprocessor] ──> Tăng tương phản, khử nghiêng, render 300 DPI
       │
       ▼ (Giai đoạn 2)
[Gemini Vision Extraction]        ──> Trích xuất chuỗi thô (Rule 1, 2, 3, 4, 5, 6, 9)
       │
       ▼ (Giai đoạn 3)
[TCCS Mapping & Auto-Evaluation]   ──> Ánh xạ chỉ tiêu (Learned -> Exact -> Dict -> Fuzzy)
                                      + Đánh giá Đạt/OOS tức thì (checkRange)
       │
       ▼ (Giai đoạn 4)
[MappingConfirmModal UI]          ──> Bảng đối chiếu trực quan, cờ cảnh báo OOS đỏ,
                                      lưu từ điển học máy (Auto-Learn)
```

---

## 🔬 12 Quy tắc Bất biến (12 Immutable Invariants)

1. **Không suy diễn giá trị vô hình (Never Infer Invisible Values)**:
   - Nếu ô kết quả, chữ ký, số lô hoặc ngày kiểm nghiệm bị mờ, rách hoặc không đọc được, để trống `""` hoặc ghi chú `UNREADABLE`. Tuyệt đối không tự suy đoán từ giới hạn TCCS.
2. **Không ảo giác số liệu (Zero Hallucination / Zero Fabrication)**:
   - Mọi con số định lượng (hàm lượng %, chỉ số vi sinh CFU/g, kim loại nặng ppm) phải có bằng chứng điểm ảnh trực tiếp từ tài liệu gốc.
3. **Bảo toàn số 0 và dấu thập phân (Preserve Decimal Delimiters & Trailing Zeros)**:
   - Trong dược phẩm: `0.05` ≠ `0.5` ≠ `50`. Tuyệt đối không làm mất số 0 sau dấu thập phân.
   - Số định lượng `99.0%` hoặc `100.0%` không được làm tròn thành `99%` hoặc `100%`.
4. **Bảo toàn và chuẩn hóa đơn vị (Mandatory Unit Preservation)**:
   - Luôn trích xuất và bảo toàn đơn vị: `ppm`, `ppb`, `%`, `mg/viên`, `CFU/g`, `CFU/mL`, `g/mL`, `pH`.
   - Chuẩn hóa thông qua `normalizeUnit()` (`src/utils/aiMapping.ts`).
5. **Tách biệt tuyệt đối Kết quả đo vs Mức tiêu chuẩn (Actual Value vs Specification Limit)**:
   - Cột "Giới hạn / Yêu cầu" (`≤ 10.0 ppm`, `90.0 - 110.0%`) đưa vào field `limit`.
   - Cột "Kết quả thực tế" (`1.2 ppm`, `98.5%`) đưa vào field `value`.
   - Không bao giờ nhầm lẫn 2 cột này.
6. **Bảo toàn ký hiệu toán học & khoa học (Preserve Comparison & Scientific Symbols)**:
   - Giữ nguyên các ký tự: `≤`, `≥`, `<`, `>`, `±`, `×10³`, `1.5 x 10^9 CFU/g`.
   - Không được cắt bỏ ký tự `<` từ `< 0.01` hoặc biến nó thành `0.01`.
   - Kết quả dạng "Không phát hiện" (`KPH`), `< LOQ`, `< LOD`, `Âm tính` giữ nguyên vẹn chuỗi gốc.
7. **Gắn chỉ số trang nguồn (Preserve Source Page Index)**:
   - Mỗi chỉ tiêu trích xuất phải gắn `sourcePageNumber` để phục vụ người dùng đối chiếu lại file PDF gốc hai màn hình.
8. **Bảo toàn bảng đa trang (Zero Loss Across Multi-Page Documents)**:
   - Ghép bảng kéo dài từ 2 đến 10+ trang mà không làm rơi rụng các dòng ranh giới (`multiPageMerger.ts`).
9. **Lưu trữ dữ liệu trích xuất thô (Raw OCR Preservation)**:
   - Lưu trữ bản nguyên bản chưa qua mapping trong `rawOcrText` để phục vụ đối chiếu và kiểm toán dữ liệu.
10. **Tách rời Trích xuất và Ánh xạ (Decouple Extraction from Mapping)**:
    - _Bước 1 (Extraction)_: Đọc chính xác chữ trên phiếu (`rawCriteriaName`, `value`).
    - _Bước 2 (Mapping)_: Đối chiếu với danh mục TCCS (`tccsMappingService.ts`). Lỗi mapping không được làm hỏng dữ liệu bước 1.
11. **Điểm tin cậy độc lập (Decoupled Confidence Score)**:
    - Điểm tin cậy trích xuất (`confidenceScore: 0..100`) phản ánh độ rõ nét của chữ/số, độc lập với điểm ánh xạ `mappingScore`.
12. **Rào chắn tin cậy & Đánh giá Đạt/OOS trực quan (Low-Confidence & OOS Guard)**:
    - Bất kỳ chỉ tiêu nào có `confidenceScore < 75%` hoặc nghi ngờ nhầm lẫn phải được bôi màu hổ phách/đỏ trên `MappingConfirmModal.tsx` để người dùng xác nhận thủ công.
    - Tự động chạy `checkRange(limit, value)` để gắn badge `✓ Đạt` hoặc `⚠ OOS` trực quan.

---

## 📋 Mẫu Bảng Phiếu Kiểm Nghiệm Phổ Biến tại Việt Nam

1. **Quatest 3 (TP.HCM) / Quatest 1 (Hà Nội)**:
   - Tiêu đề: _Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng_.
   - Số hiệu phiếu: `KN-YYYY-XXXXXX` hoặc `Số KQPT: ...`
   - Bảng kết quả gồm: `STT | Tên chỉ tiêu | Phương pháp thử | Giới hạn phát hiện (LOD/LOQ) | Kết quả`.
2. **Eurofins Sắc Ký Hải Đăng**:
   - Header song ngữ Anh - Việt.
   - Bảng kết quả: `Test Parameter / Chỉ tiêu | Test Method / Phương pháp | Specification / Mức tiêu chuẩn | Result / Kết quả`.
3. **CASE (Trung tâm Dịch vụ Phân tích Thí nghiệm TP.HCM)**:
   - Số hiệu: `CASE-YYYY/XXXX`.
   - Bảng kết quả rõ ràng, phân nhóm hóa lý và vi sinh.
4. **NIFC (Viện Kiểm Nghiệm Thuốc Trung Ương)**:
   - Header: _Bộ Y Tế - Viện Kiểm Nghiệm Thuốc Trung Ương_.
   - Trích dẫn chuẩn Dược điển Việt Nam V, USP, BP.
5. **Phiếu Kiểm Nghiệm Nội Bộ (Phòng QC Nhà máy)**:
   - Tiêu đề: _PHIẾU KIỂM NGHIỆM_.
   - Có mã số lô, ngày sản xuất, hạn dùng, TCCS tham chiếu.

---

## 📑 Cấu trúc Nhận diện Khớp Chuẩn Form Nhập Phiếu Kiểm Nghiệm (PKN Form-Aligned Schema)

Để tự động điền chính xác 100% vào Form Nhập PKN (`TestResultFormPage.tsx` / `useTestResultForm`), pipeline AI Vision bóc tách toàn diện 2 khối thông tin bám sát cấu trúc Form:

### 1. Khối Thông tin Hành chính & Tổng quan (Header Metadata)

- `reportNo`: Số hiệu phiếu kiểm nghiệm / Số KQPT / Report No (đối chiếu lưu trữ và truy vết CoA).
- `labName` / `labId`: Đơn vị kiểm nghiệm (chuẩn hóa theo danh mục Master Data Testing Laboratories: CASE, Quatest 3, Eurofins, NIFC, Phòng Kiểm Nghiệm Nội Bộ V-BIOTECH...).
- `batchNo`: Số lô sản xuất (tự động khớp Lô trong hệ thống hoặc kích hoạt modal tạo Lô mới `AutoCreateBatchModal`).
- `productCode` & `productName`: Mã và Tên sản phẩm/mẫu (truy vấn nhanh TCCS hiệu lực của sản phẩm).
- `testDate`: Ngày kiểm nghiệm / ngày xuất phiếu / ngày ký (định dạng `YYYY-MM-DD` khớp với `<DSDateInput>`).
- `sampleDate`: Ngày nhận mẫu / ngày lấy mẫu (lưu vết thời gian lưu mẫu).
- `mfgDate` & `expDate`: Ngày sản xuất và Hạn sử dụng (hỗ trợ tự động tạo Lô).
- `sampleType`: Phân loại mẫu (`FINISHED` - Thành phẩm, `RAW_MATERIAL` - Nguyên liệu, `PACKAGING` - Bao bì, `IN_PROCESS` - Bán thành phẩm).
- `overallStatus`: Kết luận chung toàn bộ phiếu (`PASS` - Đạt / `FAIL` - Không đạt / OOS).
- `notes`: Ghi chú về tình trạng mẫu (niêm phong, bao bì, nhiệt độ nhận mẫu).

### 2. Khối Chỉ tiêu Kiểm nghiệm & Phân nhóm Form (Criteria & Grouping)

Mỗi chỉ tiêu trong bảng được AI phân loại sâu vào 1 trong 5 nhóm của Form PKN:

- `category`:
  - `PHYSICAL` (Lý học & Cảm quan): Màu sắc, mùi vị, thể chất, hình thức, độ ẩm, độ rã, khối lượng trung bình, thể tích thực, pH, tỷ trọng, độ khúc xạ, độ trong...
  - `CHEMICAL` (Hóa học & Định lượng): Định tính, định lượng hoạt chất chính, hàm lượng hoạt chất, tạp chất liên quan, tro toàn phần, tro không tan trong acid, cắn khô...
  - `MICROBIAL` (Vi sinh vật): Tổng số vi sinh vật hiếu khí (TAMC), tổng số nấm men nấm mốc (TYMC), E. coli, Salmonella, S. aureus, P. aeruginosa, Coliforms...
  - `HEAVY_METAL` (Kim loại nặng): Chì (Pb), Asen (As), Cadmi (Cd), Thủy ngân (Hg)...
  - `SAFETY` (Chỉ tiêu an toàn khác): Độc tố vi nấm (Aflatoxin...), Dư lượng thuốc BVTV, Dung môi tồn dư...
- `value`: Kết quả thực đo (bảo toàn số 0, số thập phân, ký hiệu so sánh `<`, `≤`, `KPH`, `Âm tính`).
- `unit`: Đơn vị tính (`%`, `mg/viên`, `CFU/g`, `ppm`, `mL`...).
- `limit`: Mức yêu cầu/giới hạn tiêu chuẩn.
- `analysisMethod`: Phương pháp thử nghiệm (HPLC, UV-Vis, AAS, TCVN, DĐVN V...).
- `status`: Đánh giá riêng của từng chỉ tiêu trên phiếu (`PASS` | `FAIL` | `INDETERMINATE`).
- `confidenceScore` (0-100) & `confidence` (high/medium/low).

### 3. Giao diện Xác nhận & Tự động Ingestion

- `MappingConfirmModal.tsx`:
  - **Header Summary Card**: Hiển thị bảng tổng hợp thông tin hành chính (Số phiếu, Đơn vị KN, Số lô, Tên sản phẩm, Ngày KN, Đánh giá chung) ngay trên đầu modal.
  - **Category Badges**: Gắn nhãn màu phân loại (`Lý hóa`, `Định lượng`, `Vi sinh`, `Kim loại nặng`, `An toàn`) cạnh tên từng chỉ tiêu.
  - **Evaluation Badges**: Tự động so sánh giá trị thực đo với mức tiêu chuẩn để gắn badge `✓ Đạt` hoặc `⚠ OOS`.
- `useTestResultAIIntegration.ts`:
  - Tự động điền `reportNo`, `labName`, `labId`, `testDate`, `notes`, chọn Lô `batchNo`, điền `testResultsMap` theo TCCS và thêm các chỉ tiêu ngoài TCCS vào `extraCriteria`.
