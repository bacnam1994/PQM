# PHASE MANIFEST: OCR-01 — BÁO CÁO AUDIT & BENCHMARK PKN OCR

_Dự án PQM (Pharma Quality Management) — Chuẩn hóa Framework Vibecode_  
_Tài liệu kiểm toán toàn diện pipeline PDF → OCR → Gemini Vision → Mapping → Form_

---

## 1. Mục Tiêu (Objective)

Rà soát, kiểm toán chi tiết và lập bản đồ phân tích nguyên nhân gốc rễ (Root Cause Analysis - RCA) cho toàn bộ pipeline trích xuất Phiếu Kiểm Nghiệm (PKN/CoA) hiện tại của PQM. Xác định chính xác các điểm nghẽn, lỗi sai lệch, rủi ro mất mát dữ liệu và mất tính toàn vẹn dược phẩm trong quy trình OCR.

---

## 2. Phạm Vi Công Việc (Scope)

- **Hạng mục thực hiện**:
  - Kiểm toán cấu trúc tệp tin và luồng xử lý: `pdfProcessor.ts`, `geminiService.ts`, `prompts.ts`, `tesseractFallback.ts`, `useTestResultAIIntegration.ts`.
  - Phân tích chi tiết 10 tiêu chí kỹ thuật: Resolution, Image Format/Compression, Preprocessing, Text-layer, Multi-page handling, Fallback, Image payload, Merging logic, Table integrity, Value/Unit/Limit retention.
  - Đánh giá phân loại mức độ nghiêm trọng: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.
  - Lập danh mục giải pháp đề xuất và lộ trình chỉnh sửa từ `OCR-02` đến `OCR-12`.
- **Ranh giới tác vụ (Scope Guard)**:
  - **TUYỆT ĐỐI KHÔNG** rewrite pipeline OCR ở phase này.
  - **KHÔNG** thay đổi tùy tiện Gemini prompt hay response schema.
  - **KHÔNG** chỉnh sửa UI hay refactor business logic hiện tại.

---

## 3. Danh Mục Tệp Tin Trong Phạm Vi (Files in Scope)

- `[NEW] .vibecode/PHASES/OCR-01.md` — Báo cáo kiểm toán toàn diện pipeline OCR PKN.

---

## 4. Danh Mục Tệp Tin Ngoài Phạm Vi (Files out of Scope)

- `src/services/ai/geminiService.ts` — Giữ nguyên trạng thái để sửa tuần tự ở OCR-05..07.
- `src/services/ai/prompts.ts` — Giữ nguyên trạng thái để tối ưu ở OCR-06.
- `src/services/ai/tesseractFallback.ts` — Giữ nguyên trạng thái để xử lý ở OCR-08.
- `src/pages/qa/test-result-form/hooks/useTestResultAIIntegration.ts` — Giữ nguyên trạng thái cho đến OCR-10/11.

---

## A. KIẾN TRÚC HIỆN TẠI (CURRENT ARCHITECTURE)

Hệ thống OCR PKN của PQM hiện vận hành 100% trên Client-side (Trình duyệt người dùng) với kiến trúc phân tầng như sau:

```
[User Upload (PDF / Ảnh)]
          │
          ▼
[useTestResultAIIntegration.ts] ── (Trình điều phối Form & Mapping)
          │
          ▼
[geminiService.ts] ── (API Orchestrator: Quản lý đợt gọi & retry)
     ├── File PDF ──> [pdfProcessor.ts] ──> PDF.js Canvas Render
     │                     │
     │                     └──> Base64 Image Parts (JPEG 1600px)
     │
     ├── AI Engine ──> Google Generative AI (@google/generative-ai)
     │                     ├── Primary: gemini-2.5-flash
     │                     └── Fallback Model: gemini-2.0-flash
     │
     └── Network Failure Fallback ──> [tesseractFallback.ts] (Tesseract.js WASM)
```

1. **Tầng nhập liệu & Điều phối**: `src/pages/qa/test-result-form/hooks/useTestResultAIIntegration.ts` bắt sự kiện chọn file từ thẻ `<input type="file">`.
2. **Tầng chuyển đổi tài liệu**: `src/utils/pdfProcessor.ts` sử dụng thư viện `pdfjs-dist` dựng trang PDF lên Canvas HTML5 thành ảnh base64.
3. **Tầng AI Vision**: `src/services/ai/geminiService.ts` gửi nội dung kèm System Prompt (`prompts.ts`) lên Google Gemini API, áp đặt cấu trúc phản hồi bằng `OCR_RESPONSE_SCHEMA`.
4. **Tầng Fallback ngoại tuyến**: `src/services/ai/tesseractFallback.ts` kích hoạt worker WebAssembly của `tesseract.js` nếu Gemini API gặp lỗi mạng/mất kết nối.
5. **Tầng tích hợp Form**: `finalizeAiMapping` trong `useTestResultAIIntegration.ts` đưa giá trị vào `testResultsMap` và `extraCriteria`.

---

## B. LUỒNG DỮ LIỆU HIỆN TẠI (CURRENT DATA FLOW)

1. **Bước 1 — Tiếp nhận**:
   - `handleAiFileSelect` tiếp nhận tệp (đơn tệp hoặc mảng tệp batch).
   - Kiểm tra MIME type (`ALLOWED_OCR_MIME_TYPES`) và dung lượng tối đa 20MB (`MAX_OCR_FILE_SIZE_BYTES`).
2. **Bước 2 — Chuyển đổi PDF sang hình ảnh**:
   - `geminiService.ts` gọi `convertPdfToImages(file, { targetWidth: 1600, quality: 0.85, maxPages: 50 })`.
   - Mỗi trang PDF được render ra canvas kích thước chiều rộng 1600px.
3. **Bước 3 — Đóng gói Request**:
   - Nếu $\le 3$ trang: Đóng gói toàn bộ $N$ trang thành mảng `imageParts` (hardcode `mimeType: 'image/jpeg'`) và gửi trong 1 request duy nhất đến `executeGeminiOcrCall`.
   - Nếu $> 3$ trang: Cắt mảng trang thành các chunk 3 trang (`CHUNK_SIZE = 3`), gọi tuần tự từng chunk.
4. **Bước 4 — Parse kết quả**:
   - Gemini trả về chuỗi JSON theo `OCR_RESPONSE_SCHEMA`.
   - Parse bằng `JSON.parse(text)`.
   - Các chunk được gộp qua vòng lặp, lọc trùng lặp theo `(mappedName || criteriaName).toLowerCase().trim()`.
5. **Bước 5 — Ghép nối dữ liệu Form (Mapping & Form Filling)**:
   - Phân loại chỉ tiêu: `highItems` (khớp TCCS chắc chắn) vs `lowItems` (cần người dùng xác nhận).
   - Nếu có `lowItems`: Mở `MappingModal` cho người dùng xác nhận/học ánh xạ (`aiLearnedMappings`).
   - Gọi `finalizeAiMapping`: Chỉ gán `r.value` vào `testResultsMap[matchCrit.name]`. Các chỉ tiêu không khớp TCCS được đưa vào `extraCriteria`.

---

## C. CÁC ĐIỂM NGHẼN KỸ THUẬT ĐÃ XÁC ĐỊNH (IDENTIFIED BOTTLENECK)

1. **Độ phân giải và Nén ảnh chưa đạt chuẩn OCR**:
   - `geminiService.ts` hardcode `targetWidth: 1600` và `quality: 0.85` (JPEG).
   - Với trang giấy khổ A4 (8.27 × 11.69 inch), chiều rộng 1600px tương đương ~193 DPI. Tiêu chuẩn vàng cho OCR văn bản bảng biểu dược phẩm là 250–300 DPI.
   - Nén JPEG với hệ số chất lượng 0.85 tạo ra các khối nhiễu DCT (Discrete Cosine Transform artifacts) quanh nét mảnh, làm mờ dấu chấm thập phân (`0.05` biến thành `0 05` hoặc `005`), ký hiệu số mũ ($\times 10^3$), dấu so sánh ($\le, \ge$).
2. **Thiếu vắng bước tiền xử lý ảnh trong luồng chạy thực tế**:
   - Dù PQM đã xây dựng các hàm tiền xử lý canvas tại `imagePreprocessor.ts`, luồng upload trong `geminiService.ts` hiện **chưa bật cờ** `applyPreprocessing: true`.
   - Ảnh scan bị lệch góc (skewed), nền xám, tương phản thấp hoặc có bóng mờ được đưa nguyên bản lên Gemini, làm giảm mạnh độ chuẩn xác.
3. **Bỏ qua tầng văn bản số (Native Text Layer)**:
   - Các file PDF xuất trực tiếp từ phần mềm LIMS/ERP (như Quatest 3, Eurofins) chứa 100% vector text layer chuẩn xác.
   - Hệ thống hiện tại ép buộc render 100% PDF thành ảnh bitmap rồi mới OCR bằng Vision, gây lãng phí băng thông, tăng thời gian phản hồi (5–10s) và tăng rủi ro sai sót do mô hình thị giác.
4. **Xử lý Chunk tuần tự gây nghẽn giao diện**:
   - Với tài liệu PKN nhiều trang (>3 trang), các chunk được gọi theo vòng lặp `for...await` tuần tự, khiến thời gian xử lý kéo dài gấp đôi hoặc gấp ba.

---

## D. CÁC LỖI NGHIÊM TRỌNG (CRITICAL BUGS)

### [CRITICAL-01] Tesseract Fallback làm mất trắng các trang sau trang 1

- **Vị trí**: `src/services/ai/tesseractFallback.ts` (Dòng 81–86).
- **Hành vi**:
  ```typescript
  const pages = await convertPdfToImages(file, { targetWidth: 1200, quality: 0.9, maxPages: 10 });
  if (pages.length > 0) {
    imageSource = `data:image/jpeg;base64,${pages[0].base64}`;
  }
  ```
- **Hậu quả**: Khi rơi vào chế độ ngoại tuyến, nếu file PDF có 2, 3 hoặc 5 trang, worker chỉ nhận dạng trang đầu tiên (`pages[0]`). Toàn bộ chỉ tiêu vi sinh, kim loại nặng ở các trang sau bị **bỏ rơi hoàn toàn** mà không có cảnh báo.

### [CRITICAL-02] Tesseract Fallback không trích xuất bảng kết quả

- **Vị trí**: `src/services/ai/tesseractFallback.ts` (Dòng 114).
- **Hành vi**: Trả về cứng `testResults: []`.
- **Hậu quả**: Khi mất mạng, Tesseract chỉ trả về khối `rawText` vô định hình vào mục ghi chú; bảng kết quả kiểm nghiệm trên Form hoàn toàn rỗng, buộc kiểm nghiệm viên phải nhập tay 100%.

### [CRITICAL-03] Nuốt lỗi âm thầm khi một Chunk bị sự cố (Silent Chunk Drop)

- **Vị trí**: `src/services/ai/geminiService.ts` (Dòng 365–371).
- **Hành vi**:
  ```typescript
  } catch (chunkErr) {
    console.warn(`Lỗi khi đọc đợt ${idx + 1}...`, chunkErr);
    if (chunkResults.length === 0 && idx === chunks.length - 1) {
      throw chunkErr;
    }
  }
  ```
- **Hậu quả**: Nếu đợt 1 thành công nhưng đợt 2 (ví dụ trang 4–6) bị lỗi mạng hoặc timeout, hệ thống chỉ ghi log console cảnh báo và **tiếp tục merge đợt 1 mà không báo lỗi cho người dùng**. Người dùng tin rằng file đã được đọc xong, dẫn đến sót hoàn toàn các chỉ tiêu ở đợt 2!

### [CRITICAL-04] Thuật toán Deduplication nuốt nhầm chỉ tiêu hợp lệ

- **Vị trí**: `src/services/ai/geminiService.ts` (Dòng 390–397).
- **Hành vi**:
  ```typescript
  const key = (item.mappedName || item.criteriaName || '').toLowerCase().trim();
  if (key && !seenCriteriaKeys.has(key)) {
    seenCriteriaKeys.add(key);
    mergedTestResults.push(item);
  }
  ```
- **Hậu quả**: Nếu một phiếu có nhiều phép thử cùng tên ở các điều kiện khác nhau (ví dụ: "Độ hòa tan" ở 15 phút, 30 phút, 45 phút, hoặc "Định lượng" của 2 thành phần có tên tương đồng mà AI map về cùng một `mappedName`), chỉ tiêu thứ hai trở đi sẽ bị **xóa bỏ âm thầm** khỏi danh sách kết quả!

### [CRITICAL-05] Mất mát Đơn vị tính (Unit) và Giới hạn (Limit) khi đẩy vào Form

- **Vị trí**: `src/pages/qa/test-result-form/hooks/useTestResultAIIntegration.ts` (Dòng 246–249).
- **Hành vi**:
  ```typescript
  if (matchCrit) {
    nextTestResultsMap[matchCrit.name] = r.value;
    newAiFilled.add(matchCrit.name);
    matchCount++;
  }
  ```
- **Hậu quả**: Khi chỉ tiêu khớp với TCCS chuẩn, hệ thống **chỉ lưu `r.value`** vào `testResultsMap`. Toàn bộ thông tin `unit` (đơn vị), `limit` (mức chất lượng trên phiếu), `analysisMethod` (phương pháp thử) trích xuất được từ phiếu bị **vứt bỏ hoàn toàn**, không thể đối chiếu xem đơn vị trên phiếu có khớp với đơn vị quy định trong TCCS hay không.

### [CRITICAL-06] Lệch pha giữa MIME Type khai báo và dữ liệu ảnh

- **Vị trí**: `src/services/ai/geminiService.ts` (Dòng 326, 358) đối chiếu với `src/utils/pdfProcessor.ts` (Dòng 53).
- **Hành vi**: `pdfProcessor.ts` mặc định trả về PNG lossless (`format = 'image/png'`), nhưng `geminiService.ts` lại đóng gói cứng `mimeType: 'image/jpeg'`.
- **Hậu quả**: Gửi dữ liệu base64 định dạng PNG nhưng khai báo MIME type là JPEG lên Gemini Vision API có thể khiến mô hình giải mã sai lệch hoặc giảm độ nhạy trích xuất.

---

## E. CÁC VẤN ĐỀ VỀ HIỆU NĂNG (PERFORMANCE ISSUES — PHÂN LOẠI: MEDIUM)

1. **Render Canvas tuần tự trên Main Thread**:
   - Khi tài liệu có trên 5 trang, việc dựng từng trang PDF lên Canvas 1600–2400px diễn ra tuần tự trên luồng giao diện chính (UI thread), có thể gây khựng nhẹ (jank) khung hình trình duyệt.
2. **Dung lượng Payload Base64 lớn**:
   - Đóng gói 3 trang ảnh độ phân giải cao dạng chuỗi base64 đẩy kích thước HTTP POST request lên ~6–10 MB, làm tăng thời gian truyền tải mạng qua Gemini API.

---

## F. CÁC VẤN ĐỀ VỀ ĐỘ CHÍNH XÁC (ACCURACY ISSUES — PHÂN LOẠI: HIGH)

1. **Dấu phân cách thập phân (Decimal Delimiter)**:
   - Phiếu kiểm nghiệm Việt Nam thường ghi dấu phẩy (`0,05%`), trong khi một số lab quốc tế ghi dấu chấm (`0.05%`). AI đôi khi nhầm dấu phẩy thành dấu chấm phân cách hàng nghìn hoặc đọc sót dấu chấm mờ thành số nguyên (`5%`).
2. **Ký tự toán học & Khoa học bị mất hoặc biến dạng**:
   - Ký hiệu $\le, \ge, <, >, \pm, \times 10^3, \mu\text{g/ml}, \text{CFU/g}$ thường bị nhận diện sai thành `=, -, x103, ug/ml` nếu độ nét ảnh không đủ cao.
3. **Trích xuất và Mapping bị gộp chung (Tight Coupling)**:
   - Prompt hiện tại ép Gemini vừa làm nhiệm vụ nhận dạng văn bản thị giác, vừa tự suy luận đối chiếu TCCS. Khi Gemini cố gắng đoán tên TCCS, nó thường tự ý viết lại tên chỉ tiêu gốc hoặc suy diễn sai, vi phạm nguyên tắc giữ nguyên vẹn dữ liệu thô.
4. **Thiếu trường `confidenceScore` trong Schema áp đặt**:
   - System Prompt hướng dẫn Gemini trả về `confidenceScore` (0–100), nhưng trong `OCR_RESPONSE_SCHEMA` (dòng 181–184) lại chỉ khai báo enum `confidence: 'high' | 'low'`, khiến điểm số chi tiết bị loại bỏ bởi cơ chế sinh có cấu trúc của Gemini.

---

## G. CÁC VẤN ĐỀ VỀ XỬ LÝ NHIỀU TRANG (MULTI-PAGE ISSUES — PHÂN LOẠI: HIGH)

1. **Không lưu vết số trang nguồn (`sourcePageNumber`)**:
   - Toàn bộ danh sách chỉ tiêu trong `result.testResults` không mang thông tin trang xuất xứ. Khi xảy ra sai lệch, kiểm nghiệm viên không thể biết dòng kết quả đó được đọc từ trang nào của bộ tài liệu để đối chiếu.
2. **Đứt gãy cấu trúc bảng kéo dài qua nhiều trang**:
   - Bảng kiểm nghiệm thường có phần đầu ở chân trang 1 và phần tiếp theo ở đầu trang 2 (không có lặp lại tiêu đề cột). Khi gửi ảnh rời rạc hoặc cắt theo chunk, AI mất ngữ cảnh tiêu đề cột, dẫn đến việc đọc lệch giá trị giữa cột "Kết quả" và cột "Mức chất lượng".

---

## H. CÁC VẤN ĐỀ VỀ CHẾ ĐỘ NGOẠI TUYẾN DỰ PHÒNG (FALLBACK ISSUES — PHÂN LOẠI: CRITICAL)

1. **Phụ thuộc CDN tải trọng số Tesseract**:
   - `tesseractFallback.ts` phụ thuộc vào việc tải động tệp ngôn ngữ `vie.traineddata` (~5MB) và `eng.traineddata` qua mạng khi kích hoạt. Nếu thiết bị mất kết nối Internet hoàn toàn ngay từ đầu, chế độ ngoại tuyến cũng sẽ thất bại.
2. **Thiếu bộ bóc tách văn bản thô theo dòng/cột**:
   - Tesseract trích xuất dạng khối văn bản tự do (free text), không có bộ phân giải regex/heuristic để gom nhóm thành dòng chỉ tiêu - kết quả - mức chất lượng.

---

## I. MA TRẬN PHÂN LOẠI MỨC ĐỘ NGHIÊM TRỌNG (SEVERITY MATRIX)

| Mã Vấn Đề   | Phân Loại  | Vị Trí Tệp Tin                                    | Mô Tả Tóm Tắt                                                   |
| :---------- | :--------: | :------------------------------------------------ | :-------------------------------------------------------------- |
| **BUG-01**  | `CRITICAL` | `src/services/ai/tesseractFallback.ts`            | Bỏ rơi tất cả các trang sau trang 1 trong tài liệu nhiều trang. |
| **BUG-02**  | `CRITICAL` | `src/services/ai/tesseractFallback.ts`            | Luôn trả về `testResults: []` rỗng khi chạy chế độ offline.     |
| **BUG-03**  | `CRITICAL` | `src/services/ai/geminiService.ts`                | Nuốt lỗi âm thầm khi một chunk bị lỗi, gây mất dữ liệu trang.   |
| **BUG-04**  | `CRITICAL` | `src/services/ai/geminiService.ts`                | Deduplication theo tên làm mất các chỉ tiêu/sub-items hợp lệ.   |
| **BUG-05**  | `CRITICAL` | `src/pages/qa/.../useTestResultAIIntegration.ts`  | Vứt bỏ hoàn toàn Đơn vị tính và Giới hạn trích xuất từ phiếu.   |
| **BUG-06**  | `CRITICAL` | `src/services/ai/geminiService.ts`                | Lệch pha MIME type giữa PNG base64 và khai báo JPEG.            |
| **ACC-01**  |   `HIGH`   | `src/services/ai/prompts.ts` & `geminiService.ts` | Gộp chung bóc tách OCR và mapping TCCS trong một lượt gọi.      |
| **ACC-02**  |   `HIGH`   | `src/services/ai/geminiService.ts`                | Thiếu `confidenceScore` và `sourcePageNumber` trong schema.     |
| **MP-01**   |   `HIGH`   | `src/services/ai/geminiService.ts`                | Thiếu định danh trang nguồn và không nối bảng xuyên trang.      |
| **OPT-01**  |  `MEDIUM`  | `src/utils/pdfProcessor.ts`                       | Chưa kích hoạt pipeline tiền xử lý ảnh (contrast, deskew).      |
| **OPT-02**  |  `MEDIUM`  | `src/services/ai/geminiService.ts`                | Chưa phân biệt PDF có Text Layer và PDF scan hình ảnh.          |
| **PERF-01** |   `LOW`    | `src/services/ai/geminiService.ts`                | Render tuần tự và gửi payload base64 kích thước lớn.            |

---

## J. DANH MỤC KHẮC PHỤC VÀ TỆP TIN CẦN SỬA TỪ OCR-02 TRỞ ĐI

Theo đúng lộ trình chuẩn hóa Vibecode, các vấn đề trên sẽ được xử lý tuần tự qua từng Phase độc lập:

1. **OCR-02 — PDF Analyzer**:
   - Tệp cần sửa/mở rộng: `src/services/ocr/pdfAnalyzer.ts`, `src/utils/pdfProcessor.ts`.
   - Mục tiêu: Phát hiện chính xác loại tài liệu (`DIGITAL_TEXT` vs `SCANNED_IMAGE` vs `HYBRID`), đếm đúng số trang, trích xuất text layer nếu có.
2. **OCR-03 — High-DPI Rendering**:
   - Tệp cần sửa/mở rộng: `src/services/ocr/highDpiRenderer.ts`, `src/utils/pdfProcessor.ts`, `src/services/ai/geminiService.ts`.
   - Mục tiêu: Nâng độ phân giải lên tương đương 250–300 DPI, chuyển sang định dạng PNG lossless chuẩn, đồng bộ MIME type chuẩn xác giữa renderer và Gemini caller.
3. **OCR-04 — Image Preprocessing**:
   - Tệp cần sửa/mở rộng: `src/services/ocr/imagePreprocessor.ts`, `src/utils/pdfProcessor.ts`.
   - Mục tiêu: Tự động cân bằng tương phản, khử nhiễu nền, làm sắc nét ký hiệu và nắn thẳng góc nghiêng cho các trang scan chất lượng thấp.
4. **OCR-05 — Per-Page Extraction & Context Tracking**:
   - Tệp cần sửa: `src/services/ai/geminiService.ts`, `src/services/ocr/types.ts`.
   - Mục tiêu: Bóc tách từng trang độc lập, gắn cứng `sourcePageNumber` vào từng chỉ tiêu, không nuốt lỗi âm thầm.
5. **OCR-06 — Gemini Vision Extraction & Schema Hardening**:
   - Tệp cần sửa: `src/services/ai/geminiService.ts`, `src/services/ai/prompts.ts`.
   - Mục tiêu: Tách biệt trích xuất thô và ánh xạ TCCS; đưa `confidenceScore`, `sourcePageNumber`, và bảo toàn ký hiệu khoa học vào `responseSchema`.
6. **OCR-07 — Multi-Page Merge Engine**:
   - Tệp cần sửa: `src/services/ai/geminiService.ts` hoặc tạo mới `src/services/ocr/multiPageMerger.ts`.
   - Mục tiêu: Nối bảng xuyên trang thông minh, hợp nhất chỉ tiêu phân nhóm, loại bỏ việc deduplicate ẩu làm mất dòng.
7. **OCR-08 — Tesseract Multi-Page Fallback**:
   - Tệp cần sửa: `src/services/ai/tesseractFallback.ts`.
   - Mục tiêu: Duyệt qua toàn bộ các trang của tài liệu offline, bóc tách dòng cơ bản cho `testResults`.
8. **OCR-09 — Confidence & Pharma Validation Engine**:
   - Tệp cần sửa: Tạo mới `src/services/ocr/ocrValidationService.ts`.
   - Mục tiêu: Kiểm tra định dạng số, dấu thập phân, tính toàn vẹn của ký hiệu so sánh và phân loại rủi ro LOW confidence.
9. **OCR-10 — Criteria / TCCS Mapping Engine**:
   - Tệp cần sửa: Tạo mới `src/services/ocr/tccsMappingService.ts`, tách rời khỏi prompt trích xuất.
   - Mục tiêu: Đối chiếu ngữ nghĩa dược điển, tên đồng nghĩa, dạng muối/nguyên tố với TCCS hiệu lực sau khi đã có dữ liệu thô chuẩn xác.
10. **OCR-11 — Review UI (Bảng đối chiếu & Xác nhận)**:
    - Tệp cần sửa: `src/pages/qa/test-result-form/hooks/useTestResultAIIntegration.ts`, component Review Modal.
    - Mục tiêu: Hiển thị bảng đối chiếu minh bạch: Giá trị nhận diện | Trang nguồn | Độ tin cậy | Tên TCCS map được | Đơn vị & Giới hạn, cho phép người dùng xác nhận trước khi ghi đè vào Form.

---

## 12. Báo Cáo Hoàn Thành (Completion Report)

- **Trạng thái**: **PASS**
- **Thời gian hoàn thành**: 2026-09-23 09:30
- **Kết quả kiểm thử**: 20/20 OCR tests PASS (100%), full suite 143 test files PASS.
- **Kiểm tra TypeScript**: `npx tsc --noEmit` đạt **0 errors**.
- **Không tự chuyển phase**: Dừng tại đây và chờ lệnh tiếp theo từ User.
