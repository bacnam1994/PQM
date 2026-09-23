# VIBECODE WORKFLOW FRAMEWORK — PQM

Tài liệu này định nghĩa quy trình làm việc chuẩn mực bắt buộc cho toàn bộ dự án PQM và mọi phiên làm việc của AI/kỹ sư phát triển.

---

## 1. Chu Trình 8 Bước Bắt Buộc

Mọi tác vụ hoặc Phase nâng cấp trong hệ thống **BẮT BUỘC** phải tuân thủ nghiêm ngặt chuỗi tiến trình:

```
┌─────────────┐
│ 1. INSPECT  │ (Bắt buộc — Không bao giờ được bỏ qua)
└──────┬──────┘
       ▼
┌─────────────┐
│  2. PLAN    │ (Lập kế hoạch, xác định file in-scope/out-scope)
└──────┬──────┘
       ▼
┌─────────────┐
│3. IMPLEMENT │ (Thực hiện đúng phạm vi đã duyệt)
└──────┬──────┘
       ▼
┌─────────────┐
│4. SELF REVIEW│ (Tự rà soát diff, kiểm tra rò rỉ/side-effect)
└──────┬──────┘
       ▼
┌─────────────┐
│  5. TEST    │ (Chạy Unit/Integration/E2E test)
└──────┬──────┘
       ▼
┌─────────────┐
│  6. VERIFY  │ (Đối chiếu mốc acceptance criteria thực tế)
└──────┬──────┘
       ▼
┌─────────────┐
│ 7. REPORT   │ (Báo cáo kết quả định lượng & trạng thái PASS/FAIL)
└──────┬──────┘
       ▼
┌─────────────┐
│8. NEXT PHASE│ (CHỈ chuyển khi Phase hiện tại đạt PASS tuyệt đối)
└─────────────┘
```

---

## 2. Chi Tiết Từng Bước

### Bước 1: INSPECT (Khảo Sát Thực Tế)

- **Quy tắc bất biến**: AI **TUYỆT ĐỐI KHÔNG ĐƯỢC BỎ QUA** bước này trước khi viết hoặc sửa bất kỳ dòng mã nào.
- **Nội dung thực hiện**:
  1. Đọc và inspect cấu trúc thư mục, các file liên quan trực tiếp và gián tiếp.
  2. Xác định các interface, type, schema, hooks, services và UI components hiện hành.
  3. Kiểm tra call graph và luồng dữ liệu (Data Flow) liên quan đến tác vụ.
  4. Xác định rõ ràng: Hiện tại code đang chạy như thế nào, dữ liệu đi từ đâu về đâu.

### Bước 2: PLAN (Lập Kế Hoạch Thực Hiện)

- Tạo hoặc cập nhật Phase Manifest theo template tại `.vibecode/PHASES/`.
- Xác định rõ:
  - `Files in scope`: Danh sách file được phép chỉnh sửa hoặc tạo mới.
  - `Files out of scope`: Danh sách file cấm tuyệt đối can thiệp.
  - `Acceptance criteria`: Tiêu chí nghiệm thu định lượng, rõ ràng.
  - `Rollback considerations`: Phương án hoàn tác nếu xảy ra sự cố.

### Bước 3: IMPLEMENT (Triển Khai Mã Nguồn)

- Triển khai chính xác theo phạm vi đã xác định trong kế hoạch.
- Tuân thủ toàn bộ 12 nguyên tắc vàng tại `.vibecode/RULES.md`.
- Giữ nguyên toàn bộ logic nghiệp vụ hiện có không liên quan đến task.

### Bước 4: SELF REVIEW (Tự Rà Soát Mã Nguồn)

- Tự kiểm tra `git diff` toàn bộ các thay đổi:
  - Có file nào bị sửa ngoài scope không?
  - Có logic nghiệp vụ nào bị refactor âm thầm không?
  - Có hardcoded values, silent failures hoặc console log thừa không?
  - Có làm thay đổi data contract hay phá vỡ tương thích ngược không?

### Bước 5: TEST (Kiểm Thử Kỹ Thuật Tự Động)

- Chạy toàn bộ các bước kiểm tra theo `.vibecode/TESTING.md`:
  1. `npx tsc --noEmit` (Kiểm tra kiểu dữ liệu TypeScript — 0 lỗi).
  2. Chạy test suite riêng của module/phase vừa sửa đổi.
  3. Chạy toàn bộ bộ test hồi quy của hệ thống (`npx vitest run`).

### Bước 6: VERIFY (Xác Minh Nghiệm Thu)

- Đối chiếu thực tế với từng tiêu chí trong Acceptance Criteria của Phase.
- Đo lường bằng dữ liệu thực tế (thời gian, bộ nhớ, độ chính xác, tỷ lệ nhận diện...).
- **Quy tắc chặn**: Nếu bất kỳ tiêu chí nào không đạt, dừng lại ở bước này để phân tích nguyên nhân gốc rễ (root cause) và sửa chữa, **KHÔNG ĐƯỢC PHÉP BỎ QUA**.

### Bước 7: REPORT (Báo Cáo Nghiệm Thu)

- Tạo báo cáo hoàn thành rõ ràng:
  - Danh sách file đã tạo / đã sửa.
  - Kết quả kiểm thử tự động (số tests pass / fail).
  - Kết quả xác minh acceptance criteria.
  - Kết luận dứt khoát: **PASS** hoặc **BLOCKED / FAIL**.
  - Tự động cập nhật `PROJECT_OVERVIEW.md` với changelog tương ứng theo quy định.

### Bước 8: NEXT PHASE (Chuyển Giai Đoạn)

- **Quy tắc bất biến**: AI **TUYỆT ĐỐI KHÔNG TỰ ĐỘNG CHUYỂN PHASE** nếu:
  1. Chưa được người dùng (User) xác nhận hoàn tất phase hiện tại.
  2. Kết quả nghiệm thu bước 7 chưa đạt **PASS**.
  3. Còn tồn tại test fail hoặc type error chưa được khắc phục triệt để.
