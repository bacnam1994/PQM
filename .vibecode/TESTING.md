# QUY CHUẨN KIỂM THỬ HỆ THỐNG PQM (TESTING.md)

Tài liệu này định nghĩa hệ thống kiểm thử đa tầng bắt buộc để đảm bảo chất lượng, ngăn ngừa lỗi hồi quy và bảo vệ tính toàn vẹn của ứng dụng PQM.

---

## 1. Các Tầng Kiểm Tra Kỹ Thuật (Testing Layers)

Mỗi Phase phát triển phải vượt qua đầy đủ 6 cấp độ kiểm tra trước khi được kết luận PASS:

```
┌────────────────────────────────────────────────────────┐
│ 1. Type Check (`npx tsc --noEmit`)                      │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. Unit & Module Test (`npx vitest run <path>`)        │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. Full Regression Test (`npx vitest run`)             │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ 4. Build Check (`npm run build`)                       │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ 5. Lint & Formatting Check                             │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ 6. Manual Verification (Trực quan trên giao diện)       │
└────────────────────────────────────────────────────────┘
```

---

## 2. Chi Tiết Từng Lệnh Kiểm Tra

### 2.1. Type Check (Kiểm tra kiểu dữ liệu TypeScript)

- **Lệnh thực thi**:
  ```powershell
  npx tsc --noEmit
  ```
- **Tiêu chí nghiệm thu**:
  - **0 errors**: Không có bất kỳ lỗi biên dịch TypeScript nào.
  - Không được dùng `// @ts-ignore` hoặc ép kiểu `any` thô bạo để che giấu lỗi.

### 2.2. Unit & Module Test (Kiểm thử đơn vị theo tính năng)

- **Lệnh thực thi**:
  ```powershell
  npx vitest run tests/ocr/
  # hoặc đường dẫn cụ thể của module vừa chỉnh sửa
  ```
- **Tiêu chí nghiệm thu**:
  - 100% các ca kiểm thử của module đang làm việc phải đạt **PASS**.

### 2.3. Full Regression Suite (Kiểm thử hồi quy toàn bộ hệ thống)

- **Lệnh thực thi**:
  ```powershell
  npx vitest run
  ```
- **Quy mô hiện tại**: **143 test files (1,312+ tests)**.
- **Tiêu chí nghiệm thu**:
  - 100% test files đạt **PASS**.
  - Không có bất kỳ regression nào xuất hiện ở các module lõi (State Machine, Release Gates, Snapshot Hashing, Canonical Status Resolver).

### 2.4. Production Build Check (Kiểm tra đóng gói sản phẩm)

- **Lệnh thực thi**:
  ```powershell
  npm run build
  ```
- **Tiêu chí nghiệm thu**:
  - Lệnh build Vite hoàn thành thành công trong thư mục `dist/`.
  - Không có lỗi module không tìm thấy, không có circular chunk dependencies nguy hiểm.

### 2.5. Lint & Code Quality Check

- **Cấu hình**: `.eslintrc.cjs`, `.prettierrc`, `.lintstagedrc.json`.
- **Lệnh thực thi**:
  ```powershell
  npx prettier --check "src/**/*.{ts,tsx}"
  ```
- **Tiêu chí nghiệm thu**:
  - Code tuân thủ chuẩn format và không chứa biến không dùng (`unused-vars`).

### 2.6. Manual Verification (Xác minh trực quan trên UI)

- **Các bước bắt buộc**:
  1. Kiểm tra Console trình duyệt: **0 uncaught exceptions, 0 warning đỏ nghiêm trọng**.
  2. Với tính năng OCR: Kiểm tra ảnh render bằng mắt thường, xác nhận chữ nhỏ (6-8pt), số thập phân và ký hiệu toán học nhìn thấy rõ ràng, không bị nhòe hạt.
  3. Kiểm tra tương tác: Các thao tác click, mở modal, submit form, đóng thông báo hoạt động chính xác.
