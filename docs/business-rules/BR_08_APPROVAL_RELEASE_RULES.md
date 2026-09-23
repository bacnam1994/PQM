# BỘ QUY TẮC NGHIỆP VỤ 08: APPROVAL & RELEASE RULES

## (QUY TẮC PHÊ DUYỆT & CHỐT CHẶN XUẤT XƯỞNG LÔ)

> **Mã tài liệu**: `BR-CATALOG-08`  
> **Thư mục**: `docs/business-rules/BR_08_APPROVAL_RELEASE_RULES.md`  
> **Phân hệ liên quan**: `MOD-13` (Approval) & `MOD-14` (Release)

---

### BR-REL-001: 7 Cổng Kiểm Soát Tiên Quyết Bắt Buộc Để Xuất Xưởng Lô (7 Release Gates)

- **Mục đích**: Bảo đảm an toàn tuyệt đối cho người tiêu dùng và tuân thủ luật dược, GAMP 5 và FDA 21 CFR Part 11.
- **Trigger**: Khi QA Director / Authorized Person bấm nút "Ký lệnh xuất xưởng" tại `SC-10`.
- **7 Cổng kiểm soát bắt buộc (AND logic - Zero Bypass)**:
  1. **Gate 1 (Batch Lifecycle State)**: Lô đang ở trạng thái tác nghiệp hợp lệ (`TESTING` hoặc `QA_REVIEW`), không bị tạm đình chỉ (`HOLD`) hoặc từ chối (`REJECTED`).
  2. **Gate 2 (Canonical Quality Status)**: Đánh giá chất lượng chuẩn tắc của Lô phải là `PASS` (tuyệt đối cấm xuất xưởng nếu còn chỉ tiêu `FAIL`, `PENDING` hoặc `INDETERMINATE`).
  3. **Gate 3 (Criteria Completeness)**: 100% chỉ tiêu bắt buộc theo TCCS Snapshot đã được thử nghiệm và đánh giá đầy đủ (`completionPercentage === 100`).
  4. **Gate 4 (OOS Investigation Resolution)**: 100% hồ sơ sự cố ngoài tiêu chuẩn (OOS) liên quan đến Lô đã được điều tra xong và phê duyệt đóng bởi QA Manager (không có OOS nào ở trạng thái `OPEN` hoặc `IN_PROGRESS`).
  5. **Gate 5 (Deviation Containment)**: 100% phiếu sai lệch quy trình (Deviation) mức Major / Critical liên đới đã hoàn tất biện pháp cô lập rủi ro và được QA ký chấp thuận.
  6. **Gate 6 (Raw Materials & Batch Expiry)**: 100% nguyên vật liệu cấu thành trong công thức không bị quá hạn dùng tại thời điểm sản xuất, và bản thân Lô thành phẩm còn trong hạn sử dụng hợp lệ.
  7. **Gate 7 (Part 11 Electronic Signature & Authorization)**: Chữ ký số điện tử bắt buộc xác thực mật khẩu, ghi nhận vai trò được ủy quyền (`QA_DIRECTOR` hoặc `QUALIFIED_PERSON`), lý do ký xuất xưởng và mã băm toàn vẹn SHA-256.
- **Output**: `canRelease: boolean`. Nếu thiếu bất kỳ cổng nào trong 7 cổng ➔ Chặn thao tác, thông báo lý do cụ thể theo cổng vi phạm.
- **Test Cases**: `TC-BR-REL-001-A` (Thỏa mãn 7 cổng ➔ Cho phép xuất xưởng), `TC-BR-REL-001-B` (Chất lượng không PASS ➔ Chặn Gate 2), `TC-BR-REL-001-C` (OOS chưa đóng ➔ Chặn Gate 4), `TC-BR-REL-001-D` (BPR/NVL chưa đạt ➔ Chặn Gate 6).

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
