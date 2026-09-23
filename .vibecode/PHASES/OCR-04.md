# PHASE MANIFEST: OCR-04 — IMAGE PREPROCESSING PIPELINE

_Dự án PQM (Pharma Quality Management) — Chuẩn hóa Framework Vibecode_  
_Tài liệu triển khai và nghiệm thu Pipeline tiền xử lý hình ảnh cho Phiếu kiểm nghiệm (PKN)_

---

## 1. Mục Tiêu (Objective)

Xây dựng pipeline tiền xử lý hình ảnh chuyên dụng cho các tài liệu Phiếu kiểm nghiệm (PKN) bị scan mờ, scan nghiêng, độ tương phản thấp hoặc có nhiễu nền/watermark. Pipeline chuyển đổi hình ảnh theo chuỗi tuần tự an toàn:
`Original -> Normalize -> Grayscale -> Auto Contrast -> Denoise (Speckle Filter) -> Sharpen -> Deskew -> Optional Adaptive Threshold -> OCR-Ready Image`.
Quy trình đảm bảo tính phi phá hủy (**non-destructive**), luôn lưu giữ song song bản gốc và bản xử lý nâng cao (`originalCanvas` / `enhancedVariant`). Các tham số mặc định được tính toán để tuyệt đối không làm mất dấu chấm thập phân (`0.05`), ký hiệu so sánh ($\le, \ge, <, >$), số mũ ($\times 10^3$), đơn vị đo hoặc nét chữ viết tay.

---

## 2. Quy Trình Vận Hành (Workflow)

```
[Hình ảnh Trang PKN Gốc]
       │
       ▼
[1. Non-destructive Clone]:
       ├── Tạo bản sao canvas độc lập
       └── Giữ nguyên canvas gốc và originalDataUrl
       │
       ▼
[2. Grayscale Conversion]:
       └── Chuyển đổi độ chói theo chuẩn truyền hình ITU-R BT.601: Y = 0.299*R + 0.587*G + 0.114*B
       │
       ▼
[3. Auto Contrast Enhancement]:
       ├── Lập biểu đồ phân bố độ sáng (Histogram)
       └── Co giãn biểu đồ mức nhẹ (contrastClipPercent = 1.0%), làm nổi bật chữ mờ mà không gây cháy nền
       │
       ▼
[4. Denoise (Outlier Speckle Filter)]:
       ├── Quét ma trận 3x3 khử đốm nhiễu ngẫu nhiên
       └── Rào chắn bảo toàn: Nếu pixel tối hơn đáng kể nền xung quanh nhưng ở vùng sáng, bảo toàn dấu chấm thập phân
       │
       ▼
[5. Controlled Sharpening]:
       ├── Tăng cường độ nét viền với hệ số an toàn k = 0.35 (Unsharp Mask Kernel)
       └── Giúp nét chữ thanh mảnh và số nhỏ trong bảng chỉ tiêu trở nên sắc nét
       │
       ▼
[6. Hough Deskew (Xoay nắn góc)]:
       ├── Ước lượng góc nghiêng văn bản qua biến thiên tích lũy dòng
       └── Xoay nắn góc trả về phương ngang nếu góc nghiêng trong ngưỡng an toàn |θ| <= 15°
       │
       ▼
[7. Optional Adaptive Threshold / Binarization]:
       ├── Phân ngưỡng Otsu toàn cục hoặc ngưỡng thích nghi cục bộ
       └── Tùy chọn kích hoạt cho các tác vụ Tesseract / Document Scanner đặc thù
       │
       ▼
[Dual Variant Output Payload]:
       ├── canvas: Canvas đã xử lý tăng cường
       ├── originalCanvas: Canvas gốc nguyên bản
       ├── processedDataUrl: DataURL định dạng PNG lossless
       └── originalDataUrl: DataURL gốc
```

---

## 3. Phạm Vi Công Việc (Scope)

- **Hạng mục thực hiện**:
  - Mở rộng Type definitions tại `src/services/ocr/types.ts`:
    - Thêm `denoise`, `binarize`, `contrastClipPercent` vào `ImagePreprocessingOptions`.
    - Thêm `processedDataUrl`, `originalDataUrl`, `originalCanvas` vào `ProcessedImageData`.
  - Nâng cấp Module `src/services/ocr/imagePreprocessor.ts`:
    - Hàm `applyDenoise`: Bộ lọc đốm ngoại lai 3x3 với logic bảo toàn dấu chấm thập phân.
    - Hàm `applyAdaptiveThreshold`: Thuật toán phân ngưỡng Otsu tự động tìm ngưỡng tối ưu theo phương sai liên lớp.
    - Clone canvas bảo vệ ảnh gốc (Non-destructive).
    - Trả về cấu trúc song song `originalCanvas` và `canvas`, kèm `processedDataUrl` và `originalDataUrl`.
  - Tích hợp Module `src/services/ocr/highDpiRenderer.ts`:
    - Bổ sung tùy chọn `applyPreprocessing: boolean` trong `HighDpiRenderOptions`.
    - Khi bật, tự động kích hoạt pipeline tiền xử lý an toàn và đính kèm `enhancedVariant` vào đối tượng `RenderedPage`.
  - Bộ kiểm thử toàn diện tại `tests/ocr/imagePreprocessor.test.ts` & `tests/ocr/highDpiRenderer.test.ts`:
    - Kiểm chứng từng bước xử lý: Grayscale, AutoContrast, Sharpen, Deskew, Denoise, Adaptive Threshold.
    - Kiểm chứng bảo toàn tính phi phá hủy (non-destructive guarantee).
    - Kiểm chứng các kịch bản thực tế: Scan mờ, scan nghiêng, bảng biểu nhiều dòng.

- **Ranh giới tác vụ (Scope Guard)**:
  - **KHÔNG** sửa đổi giao diện người dùng (UI).
  - **KHÔNG** thay đổi logic trích xuất từng trang Per-Page Extraction (thuộc phase OCR-05).
  - **KHÔNG** can thiệp vào logic đối chiếu TCCS (thuộc phase OCR-10).

---

## 4. Danh Mục Tệp Tin Trong Phạm Vi (Files in Scope)

| Tệp tin                                 | Trạng thái | Giải thích vai trò                                                        |
| :-------------------------------------- | :--------: | :------------------------------------------------------------------------ |
| `src/services/ocr/types.ts`             |  Cập nhật  | Bổ sung options và fields cho preprocessing & dual variants               |
| `src/services/ocr/imagePreprocessor.ts` |  Cập nhật  | Hoàn thiện pipeline tiền xử lý (denoise, binarize, non-destructive clone) |
| `src/services/ocr/highDpiRenderer.ts`   |  Cập nhật  | Hỗ trợ tùy chọn `applyPreprocessing` và tạo `enhancedVariant`             |
| `tests/ocr/imagePreprocessor.test.ts`   |    Mới     | Bộ 10 test case chuyên biệt kiểm thử mọi bước tiền xử lý                  |
| `tests/ocr/highDpiRenderer.test.ts`     |  Cập nhật  | Bổ sung test case kiểm chứng tiền xử lý tích hợp vào renderer             |
| `.vibecode/PHASES/OCR-04.md`            |    Mới     | Tài liệu nghiệm thu Phase OCR-04                                          |

---

## 5. Tiêu Chí Nghiệm Thu (Acceptance Criteria - AC)

| Mã AC    | Yêu cầu                                          | Kết quả                                                                                                                                                       | Trạng thái |
| :------- | :----------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------: |
| **AC-1** | Pipeline tiền xử lý hoàn chỉnh theo thứ tự chuẩn | Chuỗi: Normalize $\rightarrow$ Grayscale $\rightarrow$ Auto Contrast $\rightarrow$ Denoise $\rightarrow$ Sharpen $\rightarrow$ Deskew $\rightarrow$ Threshold |  **PASS**  |
| **AC-2** | Tính phi phá hủy (Non-destructive guarantee)     | Canvas gốc không bị biến đổi; trả về cả `originalCanvas` và `canvas` tăng cường                                                                               |  **PASS**  |
| **AC-3** | Tham số an toàn, bảo vệ dấu thập phân & ký hiệu  | Sharpen nhẹ ($k=0.35$), Clip 1%, Denoise giữ nguyên dấu chấm đơn lẻ ($>100$ diff)                                                                             |  **PASS**  |
| **AC-4** | Thử nghiệm thành công với scan mờ, scan nghiêng  | Test case mô phỏng scan mờ tăng tương phản, scan nghiêng được ước lượng góc                                                                                   |  **PASS**  |
| **AC-5** | Tích hợp tùy chọn mượt mà vào `highDpiRenderer`  | Bật `applyPreprocessing: true` tự sinh `enhancedVariant` mà không ảnh hưởng payload gốc                                                                       |  **PASS**  |
| **AC-6** | Kiểm thử tự động & TypeScript                    | 10/10 test `imagePreprocessor`, 7/7 test `highDpiRenderer`, 0 lỗi tsc                                                                                         |  **PASS**  |

---

## 6. Kết Quả Kiểm Thử (Verification Log)

```
✓ tests/ocr/imagePreprocessor.test.ts (10 tests)
  ✓ Image Preprocessing Pipeline > 1. Grayscale: chuyển đổi ảnh màu sang thang xám chuẩn xác
  ✓ Image Preprocessing Pipeline > 2. Auto Contrast: co giãn biểu đồ độ sáng làm nổi bật chữ mờ
  ✓ Image Preprocessing Pipeline > 3. Sharpen: tăng cường độ sắc nét viền chữ
  ✓ Image Preprocessing Pipeline > 4. Deskew: ước lượng góc nghiêng văn bản
  ✓ Image Preprocessing Pipeline > 5. Denoise: loại bỏ đốm nhiễu ngẫu nhiên mà không làm mất dấu chấm thập phân
  ✓ Image Preprocessing Pipeline > 6. Adaptive Threshold: phân ngưỡng nhị phân tách biệt nền và chữ
  ✓ Image Preprocessing Pipeline > 7. Non-destructive: bảo toàn nguyên vẹn canvas gốc
  ✓ Image Preprocessing Pipeline > 8. Kịch bản Scan mờ: nâng cao độ tương phản chữ mờ nhạt
  ✓ Image Preprocessing Pipeline > 9. Kịch bản Scan nghiêng: phát hiện góc lệch
  ✓ Image Preprocessing Pipeline > 10. Kịch bản Bảng nhiều dòng: xử lý an toàn không làm vỡ cấu trúc bảng

✓ tests/ocr/highDpiRenderer.test.ts (7 tests)
  ✓ High-DPI PDF Renderer > ... (6 existing tests)
  ✓ High-DPI PDF Renderer > Tùy chọn tiền xử lý: tạo ảnh enhancedVariant khi applyPreprocessing = true

Test Files  5 passed (5)
     Tests  32 passed (32)
```

---

## 7. Kết Luận & Chuyển Giao

- Phase **OCR-04 — Image Preprocessing Pipeline** đã được hoàn thành 100% yêu cầu kỹ thuật và nghiệm thu thành công.
- Pipeline sẵn sàng cung cấp ảnh xử lý chất lượng cao phục vụ Phase tiếp theo: **OCR-05 — Per-Page Extraction & Context Preservation**.
