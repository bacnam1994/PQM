# BỘ QUY TẮC NGHIỆP VỤ 03: BATCH RULES

## (QUY TẮC QUẢN LÝ HỒ SƠ LÔ SẢN XUẤT)

> **Mã tài liệu**: `BR-CATALOG-03`  
> **Thư mục**: `docs/business-rules/BR_03_BATCH_RULES.md`  
> **Phân hệ liên quan**: `MOD-06` (Batch Workflow)

---

### BR-BAT-001: Đóng Băng TCCS Snapshot Khi Khởi Tạo Lô (TCCS Freezing on Batch Creation)

- **Mục đích**: Giải quyết dứt điểm lỗi `GAP-06`. Neo giữ vĩnh viễn bộ tiêu chuẩn chất lượng tại thời điểm Lô được sản xuất.
- **Trigger**: Khi bản ghi Lô được tạo mới thành công tại `SC-09`.
- **Input**: `batch.productId: string`.
- **Điều kiện & Quyết định**:
  - Hệ thống truy vấn bản TCCS đang `ACTIVE` của sản phẩm đó.
  - Tự động sao chép nguyên trạng 100% nội dung của bản TCCS (Bao gồm toàn bộ mảng `criteria`, `alternateRules`, `version`, `issueDate`) thành đối tượng `tccsSnapshot`.
  - Nhúng đối tượng `tccsSnapshot` này trực tiếp vào bản ghi của Lô: `batch.tccsSnapshot = deepClone(activeTccs)`.
  - Ghi nhận `batch.tccsSnapshotVersion = activeTccs.version`.
- **Output**: Bản sao TCCS bất biến gắn chặt với Lô.
- **Quy tắc bất biến**: Mọi phép thử nghiệm và đánh giá chất lượng của Lô này từ nay về sau **CHỈ ĐƯỢC PHÉP ĐỌC TỪ `batch.tccsSnapshot`**, tuyệt đối không đọc từ TCCS hiện hành ngoài cơ sở dữ liệu.
- **Test Cases**: `TC-BR-BAT-001-A` (Tạo lô ➔ Snapshot được tạo nguyên vẹn), `TC-BR-BAT-001-B` (Sửa TCCS ngoài danh mục ➔ Lô cũ không bị ảnh hưởng).

---

### BR-BAT-002: Độc Lập Giữa Quality Status Và Workflow Status (Quality ≠ Workflow)

- **Mục đích**: Chống nhầm lẫn giữa tiến độ thủ tục giấy tờ với chất lượng kỹ thuật của sản phẩm.
- **Quy tắc chuyển đổi cấm kỵ (Forbidden Aliasing)**:
  - Tuyệt đối không bao giờ được suy diễn `APPROVED` nghĩa là `PASS`.
  - Tuyệt đối không bao giờ được suy diễn `REJECTED` nghĩa là `FAIL`.
  - Tuyệt đối không bao giờ được gán `batch.status = 'PASSED'` (Thuộc tính này không tồn tại trong Canonical Model).
- **Bảng ánh xạ độc lập**:

| Trường                | Ý nghĩa                      | Các giá trị hợp lệ                                                                 | Quyền quyết định                              |
| :-------------------- | :--------------------------- | :--------------------------------------------------------------------------------- | :-------------------------------------------- |
| `batch.qualityStatus` | Thẩm định kỹ thuật phòng lab | `PASS`, `FAIL`, `PENDING`, `UNKNOWN`                                               | **Chỉ do QualityEvaluationEngine quyết định** |
| `batch.status`        | Tiến độ quản trị / phê duyệt | `DRAFT`, `IN_PROGRESS`, `COMPLETED`, `APPROVED`, `RELEASED`, `REJECTED`, `BLOCKED` | **Do QA/Production theo thẩm quyền RBAC**     |

- **Test Cases**: `TC-BR-BAT-002-A` (Lô chất lượng FAIL nhưng hồ sơ APPROVED với biên bản nhượng bộ ➔ qualityStatus vẫn là FAIL).

---

### BR-BAT-003: Cơ Chế Khóa Dữ Liệu Bất Biến (Data Locking Enforcement)

- **Mục đích**: Bảo vệ hồ sơ Lô khỏi mọi hành vi chỉnh sửa sau khi đã được phê duyệt hoặc xuất xưởng.
- **Trigger**: Khi có yêu cầu cập nhật bất kỳ trường dữ liệu nào của Lô.
- **Input**: `batch: Batch`, `updatePayload: Partial<Batch>`.
- **Điều kiện & Quyết định**:
  ```
  IF (batch.status === 'APPROVED' || batch.status === 'RELEASED')
      THEN TỪ CHỐI CẬP NHẬT (403 FORBIDDEN - DATA LOCKED)
      Ngoại lệ duy nhất: Quyền phong tỏa khẩn cấp (Chuyển sang BLOCKED kèm lý do)
  ELSE
      Cho phép cập nhật theo phân quyền thông thường
  ```
- **UI Behavior**: Form chi tiết Lô tự động chuyển sang chế độ Xem (`View-Only`), toàn bộ nút Lưu / Sửa bị ẩn đi.
- **Test Cases**: `TC-BR-BAT-003-A` (Lô RELEASED ➔ Cố tình gửi lệnh cập nhật ➔ Bị từ chối).
