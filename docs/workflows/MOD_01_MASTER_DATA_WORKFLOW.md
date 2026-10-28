# PHÂN HỆ 01: MASTER DATA & ORGANIZATION WORKFLOW

## (QUY TRÌNH QUẢN LÝ DỮ LIỆU DANH MỤC CHÙNG & TỔ CHỨC)

> **Mã phân hệ**: `MOD-01`  
> **Tài liệu**: `docs/workflows/MOD_01_MASTER_DATA_WORKFLOW.md`  
> **Phạm vi**: Danh mục Dược điển, Phòng kiểm nghiệm (Lab), Đơn vị tính (Unit), Dạng bào chế, Nhà cung cấp, Nhà máy.

---

### 1. MỤC ĐÍCH (PURPOSE)

Thiết lập và duy trì tập hợp dữ liệu nền tảng chuẩn hóa (Single Source of Truth) phục vụ toàn bộ các phân hệ trong PQM. Đảm bảo tính nhất quán danh mục, ngăn ngừa việc nhập liệu tự do tùy tiện làm sai lệch các thuật toán so khớp, phân tích xu hướng chất lượng và truy xuất nguồn gốc.

### 2. ĐỐI TƯỢNG THAM GIA (ACTORS)

- **System Admin**: Quản trị cấu hình hệ thống, danh mục cơ bản.
- **QA Manager**: Thẩm định và phê duyệt các danh mục kỹ thuật (Dược điển, Phòng Lab chỉ định).
- **System Engine**: Tự động xác thực tính duy nhất và toàn vẹn của mã danh mục.

### 3. SỰ KIỆN KÍCH HOẠT (TRIGGER)

- Khi doanh nghiệp bổ sung hoặc cập nhật tiêu chuẩn Dược điển mới (DĐVN V, USP, BP, JP...).
- Khi doanh nghiệp ký hợp đồng hoặc công nhận thêm Phòng kiểm nghiệm ngoại kiểm (Outsource Lab).
- Khi phát sinh đơn vị đo lường mới trong nghiên cứu hoặc sản xuất.

### 4. DỮ LIỆU ĐẦU VÀO (INPUT)

- Mã danh mục (Code) – Viết hoa, không dấu, không khoảng trắng, duy nhất (VD: `DĐVN_V`, `LAB_QUATEST1`).
- Tên hiển thị (Name) – Tiếng Việt có dấu chuẩn hóa.
- Nhóm phân loại (Category).
- Trạng thái hoạt động (`isActive: boolean`).
- Metadata đi kèm: Địa chỉ, chứng chỉ công nhận (ISO 17025, GLP), người liên hệ.

### 5. ĐIỀU KIỆN TIÊN QUYẾT (PRECONDITIONS)

- Người thao tác có quyền `ADMIN` hoặc `QA_MANAGER`.
- Mã danh mục chưa từng tồn tại trên toàn hệ thống.

### 6. CÁC BƯỚC THỰC THI (STEPS)

1. **Khởi tạo**: Người dùng chọn chức năng thêm mới trong Cài đặt Hệ thống (`SC-25`).
2. **Xác thực mã định danh**: Hệ thống kiểm tra trùng lặp `code` theo thời gian thực (Case-insensitive).
3. **Thẩm tra nghiệp vụ**: Kiểm tra tính hợp lệ của giấy phép/chứng chỉ (đối với Phòng Lab ngoại kiểm).
4. **Lưu & Đóng băng phiên bản**: Ghi dữ liệu vào node Master Data tương ứng, gán `createdAt`, `createdBy`.
5. **Kích hoạt sử dụng**: Đối tượng chuyển sang trạng thái `ACTIVE` và xuất hiện trong dropdown của các phân hệ nghiệp vụ khác.

### 7. BẢNG QUYẾT ĐỊNH (DECISION TABLE)

| Điều kiện                                     | Hành động của Hệ thống                                  | Trạng thái tiếp theo            |
| :-------------------------------------------- | :------------------------------------------------------ | :------------------------------ |
| Mã `code` đã tồn tại trong danh mục           | Báo lỗi 409 Conflict, chặn lưu                          | Giữ nguyên trạng thái Form nhập |
| Đơn vị đo lường không thuộc hệ SI / Dược điển | Cảnh báo yêu cầu xác nhận của QA Manager                | Chờ xác nhận                    |
| Phòng Lab hết hạn chứng chỉ GLP/ISO           | Đánh dấu cảnh báo đỏ, không cho chọn làm Lab chính thức | `EXPIRED` / `RESTRICTED`        |

### 8. VÒNG ĐỜI TRẠNG THÁI (STATE MACHINE)

```
[DRAFT] ──(Tạo mới)──► [ACTIVE] ──(Khóa/Ngưng dùng)──► [INACTIVE]
                           │                               │
                           └────────(Hết hạn chứng chỉ)──► [EXPIRED]
```

### 9. DỮ LIỆU ĐẦU RA (OUTPUT)

- Bản ghi Master Data có mã định danh bất biến (Immutable ID/Code).
- Sự kiện kích hoạt cập nhật cache ở client.

### 10. XỬ LÝ NGOẠI LỆ (EXCEPTION HANDLING)

- **Xóa danh mục đang được sử dụng**: CẤM XÓA VĨNH VIỄN (Hard Delete). Chỉ được phép chuyển sang `INACTIVE`. Các bản ghi quá khứ (Lô, PKN, TCCS) vẫn giữ nguyên tham chiếu toàn vẹn.

### 11. YÊU CẦU KIỂM TOÁN (AUDIT REQUIREMENT)

- Mọi thao tác Thêm / Sửa / Vô hiệu hóa Master Data đều phải ghi ALCOA+ Audit Trail: Actor, Timestamp, Old Value, New Value, Lý do thay đổi.

### 12. BẢO MẬT & PHÂN QUYỀN (SECURITY / RBAC)

- **Xem danh mục**: Mọi người dùng đã xác thực (`Authenticated Users`).
- **Sửa/Tạo danh mục**: `ADMIN` và `QA_MANAGER`.
- Chặn ghi trực tiếp tại Firebase Database Rules.

### 13. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-MD-01`: Mã danh mục phải là duy nhất trên toàn hệ thống.
- `AC-MD-02`: Tuyệt đối không xóa vật lý các bản ghi danh mục đã có dữ liệu giao dịch liên kết.
