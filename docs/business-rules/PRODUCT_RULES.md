# PQM — BỘ QUY TẮC NGHIỆP VỤ: PRODUCT RULES

# (QUY TẮC QUẢN LÝ SẢN PHẨM & MÃ SẢN PHẨM)

> **Mã tài liệu**: `BR-CATALOG-PRODUCT`  
> **Thư mục**: `docs/business-rules/PRODUCT_RULES.md`  
> **Phân hệ**: `MOD-02` (Product Workflow)  
> **Tuân thủ**: GAMP 5, Thông tư 32/2018/TT-BYT Đăng ký thuốc

---

### BR-PRD-001: Tính Duy Nhất Của Mã Sản Phẩm (Product Code Uniqueness)

- **Rule ID**: `BR-PRD-001`
- **Purpose**: Đảm bảo mỗi sản phẩm trong danh mục có định danh nội bộ duy nhất, không trùng lặp, dùng làm khóa liên kết toàn vẹn dữ liệu.
- **Actor**: Quản trị viên (`ADMIN`), Nhân viên R&D (`RD_SPECIALIST`).
- **Trigger**: Khi nhập hoặc sửa trường `code` của sản phẩm tại `SC-02` / `SC-03`.
- **Input**: `code: string`, `productId?: string` (khi cập nhật).
- **Preconditions**: `code` không được để trống sau khi loại bỏ khoảng trắng (`trim()`).
- **Decision Logic**:
  ```
  normalizedCode = code.trim().toUpperCase()
  IF EXISTS(product in Products WHERE toUpperCase(product.code) == normalizedCode AND product.id != productId)
      THEN REJECT "Mã sản phẩm đã tồn tại trong hệ thống"
  ELSE
      ALLOW save
  ```
- **Decision Table**:
  | Code nhập | Code hiện có trên hệ thống | Trùng ID | Kết quả | Trạng thái |
  | :--- | :--- | :--- | :--- | :--- |
  | `SP001` | `SP001` | Không | Từ chối | `DUPLICATE_CODE` |
  | `sp001` | `SP001` | Không | Từ chối | `DUPLICATE_CODE` |
  | `SP001` | `SP001` | Có (chính nó) | Chấp thuận | `SUCCESS` |
  | `SP002` | `SP001` | Không | Chấp thuận | `SUCCESS` |
- **Output**: `isValid: boolean`, `errorMessage?: string`.
- **State Transition**: Không thay đổi trạng thái quy trình.
- **UI Behavior**: Viền đỏ trường nhập liệu `Mã sản phẩm`, hiển thị thông báo lỗi tức thì bên dưới, vô hiệu hóa nút "Lưu".
- **Report / CoA Behavior**: Mã sản phẩm hiển thị trên phần đầu của phiếu CoA và hồ sơ Lô.
- **Audit Requirement**: Bắt buộc ghi log `CREATE_PRODUCT` hoặc `UPDATE_PRODUCT` với mã sản phẩm cũ/mới.
- **Forbidden Behavior**: Cấm phân biệt chữ hoa/chữ thường để tạo 2 mã có cùng ngữ nghĩa (ví dụ `para500` và `PARA500` là trùng nhau).
- **Exception Handling**: Nếu hệ thống mất kết nối server, chặn lưu và hiển thị thông báo kết nối.
- **Test Cases**: `TC-BR-PRD-001-A` (Code trùng), `TC-BR-PRD-001-B` (Code hoa/thường), `TC-BR-PRD-001-C` (Code hợp lệ).

---

### BR-PRD-002: Kiểm Soát Hạn Hiệu Lực Số Đăng Ký (Registration Expiry Enforcement)

- **Rule ID**: `BR-PRD-002`
- **Purpose**: Ngăn ngừa việc lập lệnh sản xuất thương mại cho các sản phẩm đã hết hạn giấy phép lưu hành theo quy định của Cục Quản lý Dược.
- **Actor**: Kế hoạch sản xuất (`PLANNER`), QA Xuất xưởng (`QA_OFFICER`).
- **Trigger**: Khi chọn Sản phẩm để lập Lô sản xuất mới (`SC-09`).
- **Input**: `product.registrationExpiry: string (YYYY-MM-DD)`, `batch.mfgDate: string`.
- **Preconditions**: Sản phẩm có thông tin `registrationExpiry`.
- **Decision Logic**:
  ```
  IF (batch.mfgDate > product.registrationExpiry)
      THEN Chặn lập Lô thương mại
      Gán cảnh báo: REGISTRATION_EXPIRED
  ELSE
      Cho phép lập Lô
  ```
- **Decision Table**:
  | Ngày sản xuất | Ngày hết hạn SĐK | Loại Lô | Kết quả |
  | :--- | :--- | :--- | :--- |
  | 2026-10-01 | 2026-09-30 | Thương mại | Từ chối (`REGISTRATION_EXPIRED`) |
  | 2026-09-01 | 2026-09-30 | Thương mại | Chấp thuận |
  | 2026-10-01 | 2026-09-30 | Thử nghiệm (R&D) | Chấp thuận (có cờ cảnh báo) |
- **Output**: `canProduce: boolean`, `warningLevel: 'NONE' | 'WARNING' | 'BLOCKING'`.
- **State Transition**: Nếu vi phạm, Lô không được chuyển sang `TESTING`.
- **UI Behavior**: Hiển thị Banner cảnh báo màu đỏ tại Form tạo Lô: _"Số đăng ký của sản phẩm đã hết hạn vào ngày [Ngày]. Không thể lập lệnh sản xuất thương mại."_
- **Report / CoA Behavior**: In rõ số đăng ký và ngày cấp phép trên CoA.
- **Audit Requirement**: Ghi vết cảnh báo vào nhật ký kiểm toán nếu người dùng cố gắng chọn sản phẩm hết hạn SĐK.
- **Forbidden Behavior**: Cấm người dùng thông thường tự ý sửa ngày sản xuất lùi về quá khứ để lách ngày hết hạn SĐK.
- **Exception Handling**: Lô thử nghiệm nghiên cứu (`isResearchBatch: true`) được phép sản xuất nhưng bị khóa cứng không cho ra thị trường (`RELEASE_BLOCKED`).
- **Test Cases**: `TC-BR-PRD-002-A` (Sản xuất sau hạn SĐK), `TC-BR-PRD-002-B` (Sản xuất trước hạn SĐK).

---

### BR-PRD-003: Chống Xóa Vật Lý Sản Phẩm Đã Có Dữ Liệu (No Hard Delete on Products)

- **Rule ID**: `BR-PRD-003`
- **Purpose**: Bảo toàn tính toàn vẹn liên kết lịch sử Lô, tiêu chuẩn cơ sở và nhật ký kiểm toán GMP (Data Integrity & Lineage).
- **Actor**: Quản trị viên (`ADMIN`).
- **Trigger**: Khi bấm nút "Xóa sản phẩm" tại `SC-02`.
- **Input**: `productId: string`.
- **Preconditions**: Người dùng có quyền `ADMIN`.
- **Decision Logic**:
  ```
  hasBatches = batchRepository.countByProduct(productId) > 0
  hasTCCS = tccsRepository.countByProduct(productId) > 0
  IF (hasBatches OR hasTCCS)
      THEN CẤM XÓA VẬT LÝ (FORBIDDEN)
      Chuyển hướng sang hành động: DISCONTINUE (Ngừng kinh doanh / Lưu trữ)
  ELSE
      Cho phép xóa nếu là bản ghi nháp chưa từng liên kết
  ```
- **Decision Table**:
  | Số Lô liên kết | Số TCCS liên kết | Hành động Xóa | Kết quả xử lý |
  | :--- | :--- | :--- | :--- |
  | > 0 | Bất kỳ | Xóa | Chặn, gợi ý chuyển `DISCONTINUED` |
  | 0 | > 0 | Xóa | Chặn, gợi ý chuyển `DISCONTINUED` |
  | 0 | 0 | Xóa | Cho phép xóa vật lý (kèm ghi log kiểm toán) |
- **Output**: `canDelete: boolean`, `actionType: 'HARD_DELETE' | 'SOFT_DISCONTINUE'`.
- **State Transition**: `status -> 'DISCONTINUED'`.
- **UI Behavior**: Nếu sản phẩm đã có dữ liệu, nút "Xóa" được thay thế bằng nút "Ngừng sản xuất / Lưu trữ". Nếu cố gọi API xóa, hiển thị Modal cảnh báo chặn cứng.
- **Report / CoA Behavior**: Sản phẩm đã ngưng sản xuất vẫn hiển thị đầy đủ trong các báo cáo lịch sử và CoA cũ.
- **Audit Requirement**: Ghi log `DISCONTINUE_PRODUCT` kèm lý do bắt buộc từ Admin.
- **Forbidden Behavior**: Tuyệt đối không cho phép dùng lệnh xóa trực tiếp (`DELETE CASCADE`) làm mất lịch sử Lô.
- **Exception Handling**: Khi có lỗi cơ sở dữ liệu, giữ nguyên trạng thái sản phẩm và báo lỗi.
- **Test Cases**: `TC-BR-PRD-003-A` (Chặn xóa SP đã có Lô), `TC-BR-PRD-003-B` (Cho phép xóa SP nháp không có Lô).
