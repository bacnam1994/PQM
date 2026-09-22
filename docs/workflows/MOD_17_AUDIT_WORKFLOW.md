# PHÂN HỆ 17: AUDIT TRAIL WORKFLOW

## (QUY TRÌNH NHẬT KÝ KIỂM TOÁN BẤT BIẾN ALCOA+)

> **Mã phân hệ**: `MOD-17`  
> **Tài liệu**: `docs/workflows/MOD_17_AUDIT_WORKFLOW.md`  
> **Phạm vi**: Ghi nhận tự động vết kiểm toán cho mọi hành động hệ thống, đảm bảo tính toàn vẹn dữ liệu (Data Integrity) theo chuẩn ALCOA+ và hướng dẫn kiểm toán GMP.

---

### 1. MỤC ĐÍCH (PURPOSE)

Cung cấp bằng chứng pháp lý độc lập và không thể chối bỏ về toàn bộ lịch sử hoạt động của hệ thống PQM. Cho phép thanh tra y tế hoặc cơ quan quản lý tái hiện lại 100% dòng thời gian của bất kỳ lô sản phẩm, phép thử hay quyết định xuất xưởng nào.

---

### 2. NGUYÊN TẮC ALCOA+ TRONG THIẾT KẾ AUDIT TRAIL

| Chữ cái | Nguyên tắc                      | Cách thức PQM hiện thực hóa                                             |
| :-----: | :------------------------------ | :---------------------------------------------------------------------- |
|  **A**  | **Attributable** (Quy kết được) | Mỗi thao tác bắt buộc gắn chặt với `userId`, `userEmail`, `role`        |
|  **L**  | **Legible** (Đọc được)          | Lưu dạng JSON có cấu trúc kèm văn bản giải thích bằng ngôn ngữ tự nhiên |
|  **C**  | **Contemporaneous** (Đồng thời) | Ghi log ngay tại thời điểm thực hiện thao tác qua Server Timestamp      |
|  **O**  | **Original** (Nguyên bản)       | Lưu giữ nguyên trạng dữ liệu gốc trước khi sửa đổi (`oldValue`)         |
|  **A**  | **Accurate** (Chính xác)        | Đầy đủ trường dữ liệu bị thay đổi, lý do thay đổi và địa chỉ IP         |
|  **+**  | **Complete & Enduring**         | Lưu vĩnh viễn, không bao giờ bị xóa trong suốt vòng đời sản phẩm        |

---

### 3. CẤU TRÚC BẢN GHI AUDIT TRAIL (AUDIT RECORD SCHEMA)

```json
{
  "id": "AUDIT-240922-00192",
  "timestamp": "2026-09-22T03:38:00.000Z",
  "actor": {
    "id": "usr_analyst_01",
    "name": "Nguyễn Văn A",
    "role": "QC_ANALYST"
  },
  "action": "UPDATE_CRITERION_VALUE",
  "entityType": "TEST_RESULT",
  "entityId": "pkn_2409001_01",
  "details": {
    "field": "results[2].value",
    "criteriaName": "Độ ẩm",
    "oldValue": "8.5",
    "newValue": "7.8",
    "reason": "Nhập đính chính theo phiếu ghi kết quả gốc cân sấy mẻ 2"
  },
  "context": {
    "ipAddress": "192.168.1.105",
    "userAgent": "Mozilla/5.0 ...",
    "correlationId": "txn_892348234"
  }
}
```

---

### 4. BẢO MẬT TUYỆT ĐỐI (APPEND-ONLY PRIVILEGE)

- **CẤM XÓA VÀ CẤM SỬA**:
  - Thư mục lưu trữ `audit_logs/` trong Firebase Database được cấu hình quyền bảo vệ cấp cơ sở dữ liệu:
    ```json
    ".write": "newData.exists() && !data.exists()"
    ```
    _(Chỉ cho phép thêm bản ghi mới, tuyệt đối không cho phép cập nhật hay xóa bản ghi cũ, kể cả tài khoản Quản trị viên cao cấp nhất - Super Admin)_.

---

### 5. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-AUD-01`: Mọi thay đổi dữ liệu trên Lô, TCCS và PKN đều tự động sinh bản ghi Audit Trail.
- `AC-AUD-02`: Tuyệt đối không một người dùng nào có thể sửa hoặc xóa bản ghi Audit Trail.
