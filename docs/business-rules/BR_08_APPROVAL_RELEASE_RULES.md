# BỘ QUY TẮC NGHIỆP VỤ 08: APPROVAL & RELEASE RULES

## (QUY TẮC PHÊ DUYỆT & CHỐT CHẶN XUẤT XƯỞNG LÔ)

> **Mã tài liệu**: `BR-CATALOG-08`  
> **Thư mục**: `docs/business-rules/BR_08_APPROVAL_RELEASE_RULES.md`  
> **Phân hệ liên quan**: `MOD-13` (Approval) & `MOD-14` (Release)

---

### BR-REL-001: 5 Điều Kiện Tiên Quyết Bắt Buộc Để Xuất Xưởng Lô (5-Pillar Release Gate)

- **Mục đích**: Bảo đảm an toàn tuyệt đối cho người tiêu dùng và tuân thủ luật dược.
- **Trigger**: Khi QA Director / Authorized Person bấm nút "Ký lệnh xuất xưởng" tại `SC-10`.
- **5 Điều kiện bắt buộc (AND logic)**:
  1. `batch.qualityStatus === 'PASS'` (Engine xác nhận ĐẠT).
  2. Toàn bộ Phiếu kiểm nghiệm liên quan đều ở trạng thái `APPROVED` và có `EvaluationSnapshot` hợp lệ.
  3. Không có hồ sơ OOS nào của Lô đang mở (`batch.hasActiveOOS !== true`).
  4. Không có sai lệch nghiêm trọng (Major/Critical) nào của Lô đang mở (`batch.hasActiveDeviation !== true`).
  5. Đã hoàn tất xác thực Ký số điện tử CFR Part 11 bởi tài khoản có vai trò `QA_DIRECTOR`.
- **Output**: `canRelease: boolean`. Nếu thiếu bất kỳ điều kiện nào ➔ Chặn thao tác, thông báo lý do cụ thể.
- **Test Cases**: `TC-BR-REL-001-A` (Thỏa 5 điều kiện ➔ Cho phép xuất xưởng), `TC-BR-REL-001-B` (Chất lượng không PASS ➔ Chặn xuất xưởng).

---

### BR-APP-001: Nguyên Tắc Chống Tự Phê Duyệt (Anti-Self-Approval / Four-Eyes Principle)

- **Mục đích**: Ngăn ngừa xung đột lợi ích và lỗi chủ quan của cá nhân.
- **Trigger**: Khi một người dùng mở giao diện Phê duyệt cho bất kỳ thực thể nào (TCCS, PKN, Lô).
- **Điều kiện**:
  ```
  IF (currentUser.id === entity.createdBy)
      THEN NÚT "PHÊ DUYỆT" BỊ VÔ HIỆU HÓA (DISABLED)
      Hiển thị thông báo: "Bạn không thể tự phê duyệt hồ sơ do chính mình tạo ra"
  ```
- **Test Cases**: `TC-BR-APP-001-A` (Người tạo mở trang duyệt ➔ Nút duyệt bị khóa).

---

### BR-APP-002: Bắt Buộc Lý Do Giải Trình Khi Từ Chối (Mandatory Rejection Justification)

- **Mục đích**: Đảm bảo tính minh bạch và có cơ sở pháp lý khi bác bỏ một hồ sơ chất lượng.
- **Trigger**: Khi người duyệt chọn hành động "Từ chối" (Reject).
- **Điều kiện**: Trường `rejectionReason` bắt buộc phải được nhập với độ dài tối thiểu 20 ký tự. Không được chứa các ký tự vô nghĩa (như `....`, `asdfgh`).
- **Test Cases**: `TC-BR-APP-002-A` (Để trống lý do ➔ Không cho phép gửi lệnh Từ chối).
