# PHÂN HỆ 16: ELECTRONIC SIGNATURE WORKFLOW

## (QUY TRÌNH CHỮ KÝ ĐIỆN TỬ TUÂN THỦ FDA 21 CFR PART 11)

> **Mã phân hệ**: `MOD-16`  
> **Tài liệu**: `docs/workflows/MOD_16_ESIGNATURE_WORKFLOW.md`  
> **Phạm vi**: Cơ chế ký số điện tử cho TCCS, Phiếu kiểm nghiệm, Hồ sơ Lô, Lệnh xuất xưởng, lưu trữ bằng chứng xác thực và chống chối bỏ (Non-repudiation).

---

### 1. MỤC ĐÍCH (PURPOSE)

Đáp ứng toàn diện các quy định của Cục Quản lý Thực phẩm và Dược phẩm Hoa Kỳ (FDA 21 CFR Part 11) và Luật Giao dịch Điện tử về chữ ký điện tử trong môi trường sản xuất dược phẩm. Đảm bảo chữ ký điện tử có giá trị pháp lý tương đương chữ ký tay trên giấy.

---

### 2. CÁC YẾU TỐ BẮT BUỘC CỦA CHỮ KÝ ĐIỆN TỬ (CFR PART 11 REQUIREMENTS)

Mỗi lần ký số, hệ thống yêu cầu người dùng xác nhận tại Modal Ký số (`SC-18` / `SC-19`) gồm:

1. **Xác thực danh tính**: Tên đăng nhập và Mật khẩu / Mã PIN bảo mật cấp 2.
2. **Tuyên bố ý nghĩa chữ ký (Signature Meaning)**: Người dùng phải chọn một trong các ý nghĩa pháp lý chuẩn:
   - `AUTHOR`: "Tôi là người lập và chịu trách nhiệm về tính chính xác của dữ liệu này."
   - `REVIEWER`: "Tôi đã thẩm tra phương pháp thử và số liệu tính toán."
   - `APPROVER`: "Tôi phê duyệt nội dung kỹ thuật theo thẩm quyền được giao."
   - `RELEASE_AUTHORITY`: "Tôi ký lệnh xuất xưởng cho phép lưu hành lô sản phẩm."
3. **Mã băm toàn vẹn dữ liệu (Document Content Hash)**:
   - Hệ thống tính toán mã băm SHA-256 trên toàn bộ nội dung của thực thể tại thời điểm ký.
   - Nếu có bất kỳ sự thay đổi nào đối với dữ liệu sau khi ký, mã băm sẽ không còn khớp và hệ thống lập tức cảnh báo: _"Chữ ký đã bị vô hiệu do dữ liệu bị sửa đổi trái phép"_.

---

### 3. VÒNG ĐỜI VÀ LƯU TRỮ CHỮ KÝ

- Chữ ký điện tử được lưu trữ bất biến cùng với bản ghi trong cơ sở dữ liệu:
  - `signerId`: ID người ký.
  - `signerName`: Họ tên đầy đủ.
  - `signerRole`: Vai trò tại thời điểm ký.
  - `meaning`: Ý nghĩa chữ ký.
  - `signedAt`: Dấu thời gian chuẩn UTC từ máy chủ (Server Timestamp).
  - `contentHash`: Mã băm SHA-256 của dữ liệu đã ký.
  - `ipAddress` & `userAgent`: Thông tin môi trường ký.

---

### 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-SIG-01`: Cấm lưu chữ ký nếu người dùng không nhập đúng mật khẩu/PIN xác thực.
- `AC-SIG-02`: Chữ ký bắt buộc phải chứa đầy đủ: Danh tính, Dấu thời gian máy chủ, Ý nghĩa chữ ký và Mã băm dữ liệu.
