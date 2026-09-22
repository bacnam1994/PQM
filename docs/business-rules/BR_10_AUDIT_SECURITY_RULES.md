# BỘ QUY TẮC NGHIỆP VỤ 10: AUDIT & SECURITY RULES

## (QUY TẮC NHẬT KÝ KIỂM TOÁN & BẢO MẬT HỆ THỐNG)

> **Mã tài liệu**: `BR-CATALOG-10`  
> **Thư mục**: `docs/business-rules/BR_10_AUDIT_SECURITY_RULES.md`  
> **Phân hệ liên quan**: `MOD-16` (E-Signature) & `MOD-17` (Audit Trail)

---

### BR-AUD-001: Tính Bất Biến Tuyệt Đối Của Nhật Ký Kiểm Toán (Append-Only Audit Log)

- **Mục đích**: Bảo đảm tính toàn vẹn dữ liệu theo tiêu chuẩn ALCOA+ và hướng dẫn thanh tra dữ liệu điện tử của WHO/FDA.
- **Quy tắc an ninh**:
  - Các bản ghi trong `audit_logs/` chỉ được phép tạo mới (`CREATE`), **TUYỆT ĐỐI CẤM SỬA (`UPDATE`) VÀ CẤM XÓA (`DELETE`)**.
  - Quy tắc này được khóa cứng tại cả mã nguồn và cấu hình `database.rules.json`:
    ```json
    "audit_logs": {
      "$logId": {
        ".read": "auth != null",
        ".write": "!data.exists() && newData.exists()"
      }
    }
    ```
- **Test Cases**: `TC-BR-AUD-001-A` (Lệnh xóa Audit Log bị từ chối 100%).

---

### BR-AUD-002: Bắt Buộc Nhập Lý Do Khi Sửa Đổi Dữ Liệu (Mandatory Reason For Change)

- **Mục đích**: Đáp ứng yêu cầu kiểm toán giải trình của thanh tra dược.
- **Trigger**: Khi người dùng cập nhật bất kỳ trường dữ liệu nào trên một bản ghi đã từng được lưu (ví dụ: sửa kết quả chỉ tiêu trong bản thảo PKN).
- **Điều kiện**: Form yêu cầu người dùng nhập trường `changeReason` (Lý do sửa đổi). Cấm để trống hoặc nhập chuỗi ký tự vô nghĩa.
- **Test Cases**: `TC-BR-AUD-002-A` (Sửa dữ liệu mà không nhập lý do ➔ Chặn lưu).

---

### BR-SEC-001: Rào Chắn Release Gate Cấp Cơ Sở Dữ Liệu (Database Security Guard)

- **Mục đích**: Giải quyết dứt điểm lỗi `GAP-07`. Ngăn chặn việc bypass giao diện để gửi trực tiếp request đổi trạng thái Lô thành `RELEASED`.
- **Quy tắc bảo vệ trong `database.rules.json`**:
  - Khi bản ghi Lô chuyển sang `RELEASED`, cơ sở dữ liệu Firebase bắt buộc phải kiểm tra điều kiện:
    ```json
    "status": {
      ".validate": "newData.val() !== 'RELEASED' || (data.parent().child('qualityStatus').val() === 'PASS' && auth.token.role === 'qa_director')"
    }
    ```
- **Test Cases**: `TC-BR-SEC-001-A` (Gửi API đổi status thành RELEASED khi qualityStatus !== PASS ➔ Bị Firebase từ chối với lỗi Permission Denied).
