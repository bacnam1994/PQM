# BỘ QUY TẮC NGHIỆP VỤ 02: TCCS RULES

## (QUY TẮC TIÊU CHUẨN CƠ SỞ & CHỈ TIÊU KIỂM NGHIỆM)

> **Mã tài liệu**: `BR-CATALOG-02`  
> **Thư mục**: `docs/business-rules/BR_02_TCCS_RULES.md`  
> **Phân hệ liên quan**: `MOD-03` (TCCS Workflow)

---

### BR-TCCS-001: Tính Đơn Nhất Của Bản TCCS Có Hiệu Lực (Single Active TCCS)

- **Mục đích**: Tránh việc công nhân sản xuất hoặc kiểm nghiệm viên áp dụng nhầm tiêu chuẩn chất lượng khi có nhiều phiên bản.
- **Trigger**: Khi QA phê duyệt (`APPROVE`) một bản TCCS mới cho sản phẩm tại `SC-06`.
- **Input**: `productId: string`, `newTccsId: string`.
- **Điều kiện & Quyết định**:
  - Tại một thời điểm, trên mỗi `productId`, chỉ được phép có **DUY NHẤT 1 bản TCCS có `isActive === true`**.
  - Ngay khi `newTccs` được kích hoạt (`isActive = true`):
    - Hệ thống tự động tìm bản TCCS cũ đang active của sản phẩm đó.
    - Đặt `oldTccs.isActive = false`.
    - Chuyển trạng thái `oldTccs.status = 'SUPERSEDED'`.
    - Ghi nhận ngày hết hiệu lực `oldTccs.supersededAt = ServerTimestamp()`.
- **Output**: Bản TCCS mới `ACTIVE`, bản cũ `SUPERSEDED`.
- **Test Cases**: `TC-BR-TCCS-001-A` (Kích hoạt bản mới ➔ Tự động hạ bản cũ).

---

### BR-TCCS-002: Bắt Buộc Định Danh Bất Biến Cho Từng Chỉ Tiêu (Criterion ID Invariance)

- **Mục đích**: Giải quyết dứt điểm lỗi `GAP-01`: Loại bỏ việc dùng chuỗi tên chỉ tiêu (`string name`) làm khóa định danh, ngăn ngừa đứt gãy liên kết khi đổi tên hoặc sai khác chính tả.
- **Trigger**: Khi khởi tạo hoặc cập nhật danh mục chỉ tiêu trong TCCS (`SC-06`).
- **Input**: `criteria: Criterion[]`.
- **Điều kiện & Quyết định**:
  - Mỗi phần tử chỉ tiêu **BẮT BUỘC** phải có trường `id: string` (chuẩn UUID v4 hoặc NanoID 21 ký tự).
  - Mã `id` này là **BẤT BIẾN** trong suốt vòng đời của chỉ tiêu đó qua các phiên bản TCCS.
  - Tên chỉ tiêu (`name`) chỉ là nhãn hiển thị (Display Label).
  - Trong cùng 1 TCCS, cấm tồn tại 2 chỉ tiêu có cùng `id` hoặc cùng `name` sau khi đã `normalizeName()`.
- **Output**: Mọi liên kết (Alternate Rule, PKN Result, CoA) đều trỏ theo `criterionId`.
- **Test Cases**: `TC-BR-TCCS-002-A` (Thiếu ID ➔ Báo lỗi Schema), `TC-BR-TCCS-002-B` (Trùng tên chỉ tiêu ➔ Chặn lưu).

---

### BR-TCCS-003: Cấm Sửa Trực Tiếp TCCS Đã Phát Sinh Lô (Frozen Spec Enforcement)

- **Mục đích**: Đảm bảo nguyên tắc Toàn vẹn dữ liệu (Data Integrity). Tiêu chuẩn của các lô đã sản xuất trong quá khứ không bao giờ bị thay đổi khi phòng R&D cập nhật tiêu chuẩn mới.
- **Trigger**: Khi người dùng cố gắng lưu chỉnh sửa TCCS tại `SC-06`.
- **Input**: `tccsId: string`.
- **Điều kiện & Quyết định**:
  ```
  IF (Tồn tại bất kỳ Lô nào có batch.tccsId === tccsId)
      THEN CẤM CẬP NHẬT TRỰC TIẾP (FORBIDDEN MUTATION)
      Hệ thống bắt buộc người dùng thực hiện chức năng: "Tạo phiên bản mới (Clone to v+1)"
  ELSE
      Cho phép cập nhật trực tiếp bản thảo (DRAFT)
  ```
- **UI Behavior**: Nếu TCCS đã có Lô liên kết, các trường nhập liệu bị khóa (`read-only`), hiển thị nút bấm màu tím: _"Tạo phiên bản mới (v2.0)"_.
- **Test Cases**: `TC-BR-TCCS-003-A` (Đã có lô ➔ Chặn sửa trực tiếp), `TC-BR-TCCS-003-B` (Chưa có lô ➔ Cho phép sửa).

---

### BR-TCCS-004: Xác Thực Cấu Trúc Hợp Lệ Của Quy Tắc Thay Thế (Alternate Rule Integrity)

- **Mục đích**: Ngăn ngừa cấu hình sai logic, đệ quy vô hạn hoặc trỏ vào chỉ tiêu không tồn tại.
- **Trigger**: Khi người dùng thêm hoặc sửa Alternate Rule trong TCCS Editor.
- **Input**: `rule: AlternateRule`, `criteria: Criterion[]`.
- **Điều kiện & Quyết định**:
  1. `rule.mainCriterionId` và `rule.altCriterionId` phải tồn tại trong mảng `criteria` của TCCS đó.
  2. `rule.mainCriterionId !== rule.altCriterionId` (Cấm một chỉ tiêu tự làm chỉ tiêu thay thế cho chính mình).
  3. Cấm quan hệ vòng lặp hai chiều (Circular Reference): Nếu đã có quy tắc `A ➔ B` thì cấm tạo quy tắc `B ➔ A`.
  4. Nếu kiểu quy tắc là `CONDITIONAL_CHECK`, trường `condition` bắt buộc phải có cấu trúc hợp lệ (Operator + TargetValue).
- **UI Behavior**: Hiển thị thông báo lỗi cụ thể ngay dưới bảng cấu hình quy tắc thay thế nếu vi phạm 1 trong 4 điều kiện trên.
- **Test Cases**: `TC-BR-TCCS-004-A` (Main trùng Alt ➔ Chặn), `TC-BR-TCCS-004-B` (Vòng lặp A-B-A ➔ Chặn), `TC-BR-TCCS-004-C` (Quy tắc hợp lệ ➔ Chấp nhận).
