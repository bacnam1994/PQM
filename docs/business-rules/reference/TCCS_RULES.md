# PQM — BỘ QUY TẮC NGHIỆP VỤ: TCCS RULES

# (QUY TẮC TIÊU CHUẨN CƠ SỞ & TIÊU CHÍ KỸ THUẬT)

> **Mã tài liệu**: `BR-CATALOG-TCCS`  
> **Thư mục**: `docs/business-rules/TCCS_RULES.md`  
> **Phân hệ**: `MOD-03` (TCCS Workflow)  
> **Tuân thủ**: GAMP 5, Dược điển Việt Nam V, ISO 17025

---

### BR-TCS-001: Tính Đơn Nhất Của Tiêu Chuẩn Hiệu Lực (Single Active Spec Per Product)

- **Rule ID**: `BR-TCS-001`
- **Purpose**: Đảm bảo mỗi sản phẩm tại một thời điểm chỉ có DUY NHẤT một Tiêu chuẩn cơ sở ở trạng thái HIỆU LỰC (`ACTIVE`), tránh xung đột tiêu chuẩn kiểm nghiệm.
- **Actor**: Trưởng phòng QA (`QA_MANAGER`).
- **Trigger**: Khi bấm nút "Kích hoạt TCCS" tại `SC-05` / `SC-06`.
- **Input**: `tccsId: string`, `productId: string`.
- **Preconditions**: TCCS phải được phê duyệt hợp lệ và có đầy đủ tiêu chí kỹ thuật.
- **Decision Logic**:
  ```
  activeList = findTCCS(productId, status == 'ACTIVE')
  FOR EACH oldTCCS in activeList:
      UPDATE oldTCCS.status = 'OBSOLETE'
      oldTCCS.obsoletedAt = now()
  UPDATE targetTCCS.status = 'ACTIVE'
  targetTCCS.activatedAt = now()
  ```
- **Decision Table**:
  | Trạng thái TCCS mục tiêu | Số TCCS đang ACTIVE của SP | Hành động | Trạng thái sau xử lý |
  | :--- | :--- | :--- | :--- |
  | `DRAFT` / `APPROVED` | 1 (bản cũ) | Kích hoạt | Bản cũ chuyển `OBSOLETE`, bản mới chuyển `ACTIVE` |
  | `DRAFT` / `APPROVED` | 0 | Kích hoạt | Bản mới chuyển `ACTIVE` |
  | `ACTIVE` | 1 (chính nó) | Kích hoạt | Bỏ qua (không thay đổi) |
- **Output**: `isActivated: boolean`, `previousTccsId?: string`.
- **State Transition**: `targetTCCS.status: APPROVED -> ACTIVE`; `oldTCCS.status: ACTIVE -> OBSOLETE`.
- **UI Behavior**: Tự động chuyển đổi badge trạng thái trên màn hình danh sách TCCS. Bản cũ đổi màu sang xám nhạt (`HẾT HIỆU LỰC`), bản mới đổi màu xanh lá (`HIỆU LỰC`).
- **Report / CoA Behavior**: Lô tạo sau thời điểm kích hoạt sẽ áp dụng TCCS mới này.
- **Audit Requirement**: Ghi log `ACTIVATE_TCCS` kèm danh sách TCCS cũ bị chuyển thành `OBSOLETE`.
- **Forbidden Behavior**: Tuyệt đối cấm tồn tại 2 TCCS cùng có `status === 'ACTIVE'` cho cùng một `productId`.
- **Exception Handling**: Nếu cập nhật bản cũ thất bại, rollback giao dịch, không kích hoạt bản mới (All-or-Nothing).
- **Test Cases**: `TC-BR-TCS-001-A` (Kích hoạt TCCS mới), `TC-BR-TCS-001-B` (Chuyển bản cũ thành OBSOLETE).

---

### BR-TCS-002: Ràng Buộc Hợp Lệ Của Ngưỡng Định Lượng (Numeric Limit Invariance)

- **Rule ID**: `BR-TCS-002`
- **Purpose**: Đảm bảo các chỉ tiêu loại số (`NUMBER`) có khoảng giới hạn toán học và dược điển hợp lệ (`min <= max`), không thể nhập đảo ngược hoặc vô lý.
- **Actor**: Kỹ thuật viên R&D, QC phụ trách soạn thảo (`RD_SPECIALIST`, `QC_ANALYST`).
- **Trigger**: Khi nhập hoặc chỉnh sửa chỉ tiêu trong bảng tiêu chuẩn TCCS (`SC-06`).
- **Input**: `criterion.type: 'NUMBER'`, `criterion.min?: number`, `criterion.max?: number`.
- **Preconditions**: Chỉ tiêu có `type === 'NUMBER'`.
- **Decision Logic**:
  ```
  IF (min == NULL AND max == NULL)
      THEN REJECT "Chỉ tiêu định lượng bắt buộc phải có ít nhất một cận (Min hoặc Max)"
  IF (min != NULL AND max != NULL AND min > max)
      THEN REJECT "Giá trị cận dưới (Min) không được lớn hơn cận trên (Max)"
  IF (min < 0 OR max < 0) AND criterion.allowsNegative != true
      THEN REJECT "Chỉ tiêu hàm lượng/độ tinh khiết không được âm"
  ```
- **Decision Table**:
  | Min | Max | Loại phép thử | Kết quả | Trạng thái |
  | :--- | :--- | :--- | :--- | :--- |
  | 95 | 105 | Định lượng | Chấp thuận | `VALID` |
  | 105 | 95 | Định lượng | Từ chối (`min > max`) | `INVALID_LIMIT` |
  | NULL | 5.0 | Tạp chất (≤ 5.0) | Chấp thuận | `VALID` |
  | 90.0 | NULL | Hoạt tính (≥ 90.0) | Chấp thuận | `VALID` |
  | NULL | NULL | Định lượng | Từ chối (thiếu cả 2) | `MISSING_LIMIT` |
- **Output**: `isValid: boolean`, `validationMessage?: string`.
- **State Transition**: Không đổi trạng thái.
- **UI Behavior**: Hiển thị viền đỏ và thông báo lỗi trực tiếp tại dòng chỉ tiêu, không cho phép bấm "Lưu bảng chỉ tiêu".
- **Report / CoA Behavior**: Trên CoA hiển thị dạng khoảng: `95.0 ~ 105.0` hoặc `≤ 5.0` hoặc `≥ 90.0`.
- **Audit Requirement**: Không lưu các giá trị vi phạm vào cơ sở dữ liệu.
- **Forbidden Behavior**: Cấm lưu chỉ tiêu định lượng mà để trống cả Min lẫn Max dưới dạng chuỗi rỗng.
- **Exception Handling**: Nếu người dùng nhập chuỗi không phải số (như `"abc"`), parser tự động báo lỗi định dạng số.
- **Test Cases**: `TC-BR-TCS-002-A` (Min > Max), `TC-BR-TCS-002-B` (Chỉ có Max), `TC-BR-TCS-002-C` (Hợp lệ Min-Max).

---

### BR-TCS-003: Tính Bất Biến Của TCCS Khi Đã Gắn Với Lô (No Mutation on Referenced TCCS)

- **Rule ID**: `BR-TCS-003`
- **Purpose**: Đảm bảo nguyên tắc bảo toàn dữ liệu gốc (ALCOA+ Original & Complete): Không một ai được chỉnh sửa chỉ tiêu của TCCS đã được Lô sản xuất đưa vào kiểm nghiệm.
- **Actor**: Toàn bộ người dùng (`ADMIN`, `QA`, `R&D`).
- **Trigger**: Khi bấm nút "Sửa TCCS" hoặc gửi API update TCCS.
- **Input**: `tccsId: string`.
- **Preconditions**: TCCS tồn tại trong cơ sở dữ liệu.
- **Decision Logic**:
  ```
  referencedBatchesCount = batchRepository.countByTCCS(tccsId)
  IF (referencedBatchesCount > 0)
      THEN KHÓA CHỈNH SỬA TRỰC TIẾP (FROZEN)
      Bắt buộc tạo phiên bản mới: createNewVersion(tccsId, version + 1)
  ELSE
      Cho phép sửa nếu là TCCS nháp chưa liên kết
  ```
- **Decision Table**:
  | Số Lô đang dùng TCCS | Hành động Sửa trực tiếp | Quyết định | Hướng xử lý |
  | :--- | :--- | :--- | :--- |
  | > 0 | Cố gắng sửa chỉ tiêu | Bị chặn (`LOCKED_BY_BATCH`) | Điều hướng sang "Nhân bản / Tạo phiên bản mới" |
  | 0 | Sửa chỉ tiêu | Cho phép | Cập nhật trực tiếp và lưu vết |
- **Output**: `canDirectEdit: boolean`, `requireNewVersion: boolean`.
- **State Transition**: Nếu tạo bản mới, chuyển sang luồng DRAFT của phiên bản kế tiếp.
- **UI Behavior**: Khóa toàn bộ ô nhập trên form TCCS (`read-only`), hiển thị thông báo màu vàng: _"Tiêu chuẩn này đã được áp dụng cho [N] Lô sản xuất. Bạn không thể sửa trực tiếp mà phải tạo phiên bản mới."_ Kèm nút "Tạo phiên bản mới".
- **Report / CoA Behavior**: Lô cũ luôn liên kết đúng với TCCS nguyên thủy tại thời điểm sản xuất.
- **Audit Requirement**: Ghi log kiểm toán `CREATE_TCCS_VERSION` khi nhân bản.
- **Forbidden Behavior**: Tuyệt đối cấm cập nhật đè (`IN-PLACE UPDATE`) lên danh sách chỉ tiêu của TCCS đã phát sinh Lô.
- **Exception Handling**: Nếu có xung đột khóa lạc quan (OCC), reload lại dữ liệu mới nhất từ server.
- **Test Cases**: `TC-BR-TCS-003-A` (Chặn sửa TCCS đã có Lô), `TC-BR-TCS-003-B` (Cho phép tạo bản mới).
