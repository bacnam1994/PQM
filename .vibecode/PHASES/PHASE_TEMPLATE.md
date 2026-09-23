# PHASE MANIFEST TEMPLATE: [MÃ_PHASE] — [TÊN_PHASE]

_Tài liệu này là biểu mẫu chuẩn bắt buộc phải tạo trước khi bắt đầu bất kỳ Phase nào trong chu trình Vibecode của PQM._

---

## 1. Mục Tiêu (Objective)

- Tóm tắt mục tiêu cụ thể, súc tích của Phase này.
- Kết quả mong đợi sau khi hoàn thành.

## 2. Phạm Vi Công Việc (Scope)

- **Hạng mục thực hiện**: Mô tả chi tiết những gì sẽ làm.
- **Ranh giới tác vụ**: Những gì cố tình KHÔNG làm trong Phase này để tránh phình phạm vi.

## 3. Danh Mục Tệp Tin Trong Phạm Vi (Files in Scope)

_Chỉ những file dưới đây mới được phép chỉnh sửa hoặc tạo mới trong Phase này:_

- `[NEW/MODIFY] path/to/file1.ts` — Mô tả vai trò
- `[NEW/MODIFY] path/to/file2.ts` — Mô tả vai trò

## 4. Danh Mục Tệp Tin Ngoài Phạm Vi (Files out of Scope)

_Tuyệt đối không chạm vào các file này trong Phase hiện tại:_

- `path/to/criticalService.ts` — Lý do bảo vệ
- `path/to/coreDomain.ts` — Lý do bảo vệ

## 5. Hành Vi Hiện Tại Của Hệ Thống (Current Behavior)

- Mô tả code hiện tại đang hoạt động ra sao.
- Chỉ ra các hạn chế, lỗi sai lệch hoặc điểm nghẽn kỹ thuật cần khắc phục.

## 6. Các Thay Đổi Bắt Buộc (Required Changes)

- Thay đổi 1: ...
- Thay đổi 2: ...
- Thay đổi 3: ...

## 7. Các Ràng Buộc Kỹ Thuật (Constraints)

- Tuân thủ 12 nguyên tắc vàng tại `.vibecode/RULES.md`.
- Với module OCR: Tuân thủ 12 quy tắc tại `.vibecode/OCR_RULES.md`.
- Không thay đổi Data Contract, không làm mất tương thích ngược.

## 8. Tiêu Chí Nghiệm Thu Định Lượng (Acceptance Criteria)

Mỗi tiêu chí phải có khả năng kiểm chứng độc lập (PASS/FAIL):

- [ ] AC-1: [Tiêu chí cụ thể]
- [ ] AC-2: [Tiêu chí cụ thể]
- [ ] AC-3: [Tiêu chí cụ thể]

## 9. Yêu Cầu Kiểm Thử Module (Test Requirements)

- Tạo mới/cập nhật test suite tại: `tests/...`
- Tối thiểu cần bao phủ các ca kiểm thử:
  - Happy Path
  - Edge Cases / Boundary Values
  - Error Handling / Fallback Path

## 10. Yêu Cầu Kiểm Thử Hồi Quy (Regression Requirements)

- `npx tsc --noEmit` phải đạt: **0 errors**.
- `npx vitest run` phải đạt: **100% test files pass**.

## 11. Phương Án Hoàn Tác (Rollback Considerations)

- Nếu việc triển khai thất bại hoặc gây lỗi hồi quy không thể khắc phục nhanh:
  - Lệnh hoàn tác Git: `git checkout -- <files>` hoặc `git revert <commit>`.
  - Không để lại mã lỗi hoặc file rác trong kho lưu trữ.

---

## 12. Báo Cáo Hoàn Thành (Completion Report)

_(Điền vào sau khi hoàn thành tất cả các bước bên trên)_

- **Trạng thái**: [PASS / BLOCKED / FAIL]
- **Thời gian hoàn thành**: [YYYY-MM-DD HH:mm]
- **Kết quả kiểm thử**: [X/X tests pass]
- **Kiểm tra TypeScript**: [0 errors]
- **Cập nhật PROJECT_OVERVIEW.md**: [Đã cập nhật changelog]
- **Sẵn sàng chuyển tiếp**: [Đợi User xác nhận để chuyển sang Phase tiếp theo]
