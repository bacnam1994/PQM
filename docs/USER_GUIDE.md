# HƯỚNG DẪN SỬ DỤNG HỆ THỐNG QUẢN LÝ CHẤT LƯỢNG (QMS)

Tài liệu này hướng dẫn sử dụng các tính năng nâng cao mới được cập nhật trong phiên bản 2.5.

---

## 1. NHẬT KÝ HỆ THỐNG (AUDIT LOG)

Tính năng **Audit Log** giúp Quản trị viên (Admin) giám sát toàn vẹn dữ liệu và theo dõi các thay đổi quan trọng trong hệ thống.

### 1.1 Truy cập
- Điều hướng đến trang **Cài đặt** (Settings).
- Cuộn xuống phần **Nhật ký hệ thống**.
- *Lưu ý: Chỉ tài khoản có quyền Admin mới thấy mục này.*

### 1.2 Các chức năng chính
- **Theo dõi thời gian thực:** Hệ thống tự động ghi lại các hành động:
  - `CREATE`: Tạo mới dữ liệu (Sản phẩm, Lô, TCCS...).
  - `UPDATE`: Cập nhật thông tin.
  - `DELETE`: Xóa dữ liệu.
  - `IMPORT`: Nhập liệu hàng loạt từ Excel.
  - `LOGIN/LOGOUT`: Đăng nhập/Đăng xuất.
- **Tìm kiếm & Lọc:**
  - Tìm kiếm theo nội dung chi tiết, email người dùng, hoặc ID đối tượng.
  - Lọc theo loại hành động để dễ dàng tra cứu.
- **Xuất báo cáo:** Nhấn nút **Xuất CSV** để tải về toàn bộ nhật ký đang hiển thị ra file Excel.

---

## 2. XUẤT DỮ LIỆU (EXPORT DATA)

Hệ thống hỗ trợ xuất dữ liệu ra định dạng CSV (tương thích Excel) tại các màn hình danh sách chính, phục vụ cho việc báo cáo và lưu trữ offline.

### 2.1 Các màn hình hỗ trợ
1.  **Danh sách Lô & Tồn kho (Batches):** Xuất thông tin lô, ngày SX/HD, sản lượng, trạng thái.
2.  **Kết quả Lab (Test Results):** Xuất danh sách phiếu kiểm nghiệm, kết quả đánh giá.
3.  **Nhật ký hệ thống (Audit Log):** Xuất lịch sử hoạt động.

### 2.2 Hướng dẫn thực hiện
1.  Tại màn hình danh sách, sử dụng các bộ lọc (Tìm kiếm, Ngày tháng, Trạng thái...) để lọc ra dữ liệu cần xuất.
2.  Nhấn nút **Xuất CSV** (biểu tượng Tải xuống) trên thanh công cụ.
3.  File `.csv` sẽ được tải về máy. Bạn có thể mở trực tiếp bằng Microsoft Excel hoặc Google Sheets.

> **Lưu ý:** File xuất ra sử dụng bảng mã UTF-8 with BOM, đảm bảo hiển thị đúng tiếng Việt trên Excel.

---

## 3. SAO LƯU & KHÔI PHỤC (BACKUP & RESTORE)

Chức năng này cho phép tạo bản sao đầy đủ của cơ sở dữ liệu để phòng ngừa rủi ro mất mát dữ liệu.

### 3.1 Sao lưu (Backup)
1.  Vào **Cài đặt** -> **Dữ liệu & Sao lưu**.
2.  Nhấn **Xuất dữ liệu (.json)**.
3.  File JSON chứa toàn bộ dữ liệu hệ thống sẽ được tải về. Hãy lưu trữ file này ở nơi an toàn.

### 3.2 Khôi phục (Restore)
1.  Vào **Cài đặt** -> **Dữ liệu & Sao lưu**.
2.  Nhấn **Khôi phục dữ liệu**.
3.  Chọn file `.json` đã sao lưu trước đó.
4.  Xác nhận hành động (Lưu ý: Dữ liệu hiện tại sẽ bị ghi đè hoàn toàn).

---

## 4. QUẢN LÝ NGUYÊN LIỆU (RAW MATERIALS)

Module mới giúp quản lý danh mục nguyên liệu tập trung, tách biệt khỏi công thức sản phẩm.

- **Truy cập:** Menu **Nguyên liệu**.
- **Chức năng:**
  - Thêm/Sửa/Xóa nguyên liệu.
  - Quản lý tên gọi khác (Aliases) để hỗ trợ tự động nhận diện khi nhập liệu.
  - Kiểm tra ràng buộc: Không cho phép xóa nguyên liệu đang được sử dụng trong Công thức sản phẩm.

---

*Tài liệu cập nhật ngày: 02/03/2026*