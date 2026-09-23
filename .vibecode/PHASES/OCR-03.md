# PHASE MANIFEST: OCR-03 — HIGH-DPI PDF RENDERING

_Dự án PQM (Pharma Quality Management) — Chuẩn hóa Framework Vibecode_  
_Tài liệu triển khai và nghiệm thu Động cơ kết xuất PDF độ phân giải cao cho OCR/Vision_

---

## 1. Mục Tiêu (Objective)

Nâng cấp toàn diện chất lượng kết xuất tài liệu PDF sang hình ảnh phục vụ mô hình thị giác AI (Gemini Vision) và OCR ngoại tuyến. Chuyển đổi từ cơ chế cố định 1600px nén JPEG suy hao (quality 0.85) sang cơ chế tính toán tỷ lệ động đạt 200–300 DPI (mặc định 250 DPI) với định dạng PNG không nén suy hao (lossless). Bảo toàn độ sắc nét của các chi tiết nhỏ: số thập phân (`0.05`), ký hiệu toán học ($\le, \ge, <, >, \pm$), số mũ ($\times 10^3$), đơn vị dược điển (`CFU/g`, `ppm`, `mg/ml`) và chữ viết tay.

---

## 2. Quy Trình Vận Hành (Workflow)

```
[File PDF Trang i]
       │
       ▼
[Calculate DPI Scale]:
       ├── Đọc viewport kích thước gốc (widthPt, heightPt)
       ├── Tính scale = targetDpi / 72 (250 DPI ≈ 3.472x; 300 DPI ≈ 4.167x)
       └── Rào chắn RAM: Tự động co tỷ lệ nếu vượt maxWidthPx (3200px) / maxHeightPx (4200px)
       │
       ▼
[Render Print Intent]:
       ├── Khởi tạo Offscreen Canvas với kích thước tính toán
       ├── Tô nền trắng tinh khiết (#FFFFFF) chống nhiễu alpha
       └── PDF.js render với intent = 'print' (anti-aliasing tối ưu cho văn bản bảng biểu)
       │
       ▼
[Output Lossless PNG Payload]:
       ├── Xuất toDataURL('image/png') -> Base64 + dataUrl
       ├── Giải phóng bộ nhớ Canvas lập tức (width=0, height=0)
       └── Giữ trọn vẹn pageNumber, width, height, mimeType: 'image/png'
```

---

## 3. Phạm Vi Công Việc (Scope)

- **Hạng mục thực hiện**:
  - Module kết xuất High-DPI: `src/services/ocr/highDpiRenderer.ts`:
    - Hàm `calculateDpiScale`: Hỗ trợ dải 200–300 DPI, bảo toàn 100% aspect ratio, có cơ chế clamp bảo vệ bộ nhớ RAM.
    - Hàm `renderPdfHighDpi`: Kết xuất từng trang độc lập, hỗ trợ PNG lossless, nền trắng tinh khiết, dọn dẹp canvas ngay sau khi xuất base64.
  - Tích hợp pipeline trong `src/services/ai/geminiService.ts`:
    - Thay thế mức 1600px JPEG bằng `targetDpi: 250, format: 'image/png'`.
    - Đồng bộ MIME type trong payload gửi lên Gemini: `mimeType: page.mimeType || 'image/png'`. Khắc phục triệt để lỗi CRITICAL-06 (Lệch pha MIME type).
  - Tích hợp fallback trong `src/services/ai/tesseractFallback.ts`:
    - Nâng cấp render lên 250 DPI PNG lossless cho worker nhận dạng.
  - Bổ sung bộ test kiểm chứng tại `tests/ocr/highDpiRenderer.test.ts`.
- **Ranh giới tác vụ (Scope Guard)**:
  - **KHÔNG** thay đổi System Prompt lớn của Gemini.
  - **KHÔNG** can thiệp vào logic mapping TCCS (sẽ thực hiện ở OCR-10).
  - **KHÔNG** thay đổi UI ở phase này.

---

## 4. Danh Mục Tệp Tin Trong Phạm Vi (Files in Scope)

| Tệp tin                                |   Trạng thái   | Giải thích vai trò                                                                             |
| :------------------------------------- | :------------: | :--------------------------------------------------------------------------------------------- |
| `src/services/ocr/highDpiRenderer.ts`  | **MAINTAINED** | Động cơ tính toán scale DPI và kết xuất trang print intent với canvas RAM cleanup.             |
| `src/utils/pdfProcessor.ts`            | **MAINTAINED** | Tương thích ngược `convertPdfToImages` tích hợp High-DPI 250 DPI và PNG lossless.              |
| `src/services/ai/geminiService.ts`     |   **MODIFY**   | Kích hoạt High-DPI 250 DPI PNG cho Gemini Vision và đồng bộ `mimeType: page.mimeType`.         |
| `src/services/ai/tesseractFallback.ts` |   **MODIFY**   | Kích hoạt High-DPI PNG cho tầng OCR offline.                                                   |
| `tests/ocr/highDpiRenderer.test.ts`    |   **MODIFY**   | Bổ sung test cases: aspect ratio preservation, dynamic DPI (200, 250, 300), progress callback. |
| `.vibecode/PHASES/OCR-03.md`           |    **NEW**     | Báo cáo nghiệm thu Phase OCR-03.                                                               |

---

## 5. Bảng So Sánh Kỹ Thuật (Trước & Sau Cải Tiến)

| Tiêu chí                     | Trước cải tiến (Legacy)                                         | Sau cải tiến (OCR-03)                                        |
| :--------------------------- | :-------------------------------------------------------------- | :----------------------------------------------------------- |
| **Chiều rộng render**        | Cố định 1600px                                                  | Động theo DPI (Khổ A4 ~2066px ở 250 DPI, ~2480px ở 300 DPI)  |
| **Độ phân giải tương đương** | ~193 DPI trên khổ A4                                            | **250–300 DPI** chuẩn quốc tế cho tài liệu Dược              |
| **Định dạng nén**            | JPEG (quality: 0.85)                                            | **PNG (Lossless)** — Không mất nét                           |
| **Bảo toàn chi tiết nhỏ**    | Dễ nhòe dấu chấm `0.05`, mất số mũ $\times 10^3$, mờ $\le, \ge$ | **Sắc nét 100%**, giữ nguyên nét mảnh và số mũ               |
| **MIME Type payload**        | Khai báo cứng `image/jpeg` gây lệch dữ liệu PNG                 | **Đồng bộ chuẩn xác** `image/png`                            |
| **Quản lý bộ nhớ RAM**       | Không giới hạn đỉnh (nguy cơ crash trên mobile)                 | **Clamp an toàn** maxWidth 3200px, giải phóng canvas lập tức |
| **Aspect Ratio & Số trang**  | Không cam kết chặt chẽ                                          | Bảo toàn tỷ lệ khung hình, đánh số trang chính xác           |

---

## 6. Tiêu Chí Nghiệm Thu (Acceptance Criteria Status)

- [x] **AC-1 (Chữ nhỏ rõ nét)**: Kích thước kết xuất khổ A4 ở 250 DPI đạt $2066 \times 2923$ px, ở 300 DPI đạt $2480 \times 3507$ px, giữ trọn nét ký hiệu toán học và số mũ (PASS).
- [x] **AC-2 (Bảo toàn tỷ lệ khung hình)**: Aspect ratio sau khi scale và clamp sai lệch $< 0.02$ so với tỷ lệ khổ giấy gốc (PASS).
- [x] **AC-3 (Không bị crop/mất trang)**: Mỗi trang được cấp phát canvas đúng kích thước viewport, render đủ 100% trang với `pageNumber` tuần tự (PASS).
- [x] **AC-4 (Đồng bộ MIME Type)**: Payload gửi lên Gemini Vision mang đúng `mimeType: 'image/png'`, triệt tiêu hoàn toàn lỗi lệch pha MIME (PASS).
- [x] **AC-5 (Giữ nguyên vẹn PDF gốc)**: Không chỉnh sửa hay làm thay đổi file PDF nhị phân đầu vào (PASS).
- [x] **AC-6 (Tương thích ngược & Ổn định)**: Luồng upload hiện hữu, offline fallback và toàn bộ test suite pass 100% (PASS).

---

## 7. Báo Cáo Hoàn Thành (Completion Report)

- **Trạng thái**: **PASS** ✅
- **Thời gian hoàn thành**: 2026-09-23 09:52
- **Kết quả kiểm thử**: 26/26 OCR unit tests pass (100%).
- **Kiểm tra TypeScript**: `npx tsc --noEmit` đạt **0 errors**.
- **Không tự chuyển phase**: Dừng tại đây và chờ lệnh tiếp theo từ User cho Phase OCR-04.
