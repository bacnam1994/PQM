# PQM — BỘ QUY TẮC NGHIỆP VỤ: BATCH RULES

# (QUY TẮC QUẢN LÝ LÔ SẢN XUẤT & VÒNG ĐỜI LÔ)

> **Mã tài liệu**: `BR-CATALOG-BATCH`  
> **Thư mục**: `docs/business-rules/BATCH_RULES.md`  
> **Phân hệ**: `MOD-06` (Batch Workflow)  
> **Tuân thủ**: GAMP 5, US FDA 21 CFR Part 211, Dược điển Việt Nam V

---

### BR-BAT-001: Khởi Tạo Trạng Thái Lô Bắt Buộc Là PENDING (Initial State Invariance)

- **Rule ID**: `BR-BAT-001`
- **Purpose**: Đảm bảo mọi Lô sản xuất khi mới tạo lập trên hệ thống luôn ở trạng thái Chờ kiểm (`status === 'PENDING'`), ngăn ngừa hiện tượng tự nhảy sang `TESTING` hoặc `RELEASED`.
- **Actor**: Kế hoạch sản xuất (`PLANNER`), Hệ thống (`SYSTEM`).
- **Trigger**: Khi bấm "Tạo Lô sản xuất" tại `SC-09` hoặc qua AI Proposal.
- **Input**: `batchNo: string`, `productId: string`, `mfgDate: string`, `expDate: string`.
- **Preconditions**: Sản phẩm tồn tại và đang ở trạng thái `ACTIVE`.
- **Decision Logic**:
  ```
  batch.status = 'PENDING'
  batch.version = 1
  batch.createdAt = now()
  batch.tccsSnapshot = fetchActiveTCCSSnapshot(productId)
  IF (batch.tccsSnapshot == NULL)
      THEN REJECT "Không thể tạo Lô khi sản phẩm chưa có TCCS hiệu lực"
  ALLOW create
  ```
- **Decision Table**:
  | Dữ liệu đầu vào | Trạng thái yêu cầu khởi tạo | Kết quả thực thi | Trạng thái gán vào DB |
  | :--- | :--- | :--- | :--- |
  | Đầy đủ, hợp lệ | Bất kỳ (kể cả client gửi `TESTING`) | Cưỡng chế | `PENDING` |
  | Thiếu TCCS | Bất kỳ | Từ chối | `MISSING_ACTIVE_TCCS` |
- **Output**: `batch: Batch`, `status: 'PENDING'`.
- **State Transition**: `Khởi tạo -> PENDING`.
- **UI Behavior**: Lô mới hiển thị trong danh sách với Badge màu vàng nhạt `CHỜ KIỂM` (`PENDING`).
- **Report / CoA Behavior**: Lô `PENDING` không được phép xuất CoA thương mại.
- **Audit Requirement**: Ghi nhận sự kiện `CREATE_BATCH` kèm danh tính người tạo và mã băm snapshot.
- **Forbidden Behavior**: Tuyệt đối cấm tạo mới Lô với trạng thái `RELEASED` hoặc `TESTING`.
- **Exception Handling**: Nếu client gửi kèm trạng thái khác `PENDING`, server tự động ghi đè về `PENDING`.
- **Test Cases**: `TC-BR-BAT-001-A` (Tạo lô thành công PENDING), `TC-BR-BAT-001-B` (Client cố tạo lô RELEASED -> Bị ép về PENDING).

---

### BR-BAT-002: Bất Biến Quality ≠ Workflow Trong Quản Lý Lô (Decoupled Quality & Workflow)

- **Rule ID**: `BR-BAT-002`
- **Purpose**: Bảo đảm nguyên tắc cốt lõi của PQM: Trạng thái chất lượng (Quality Status) và Trạng thái quy trình (Workflow Status) là hai thực thể độc lập. Việc lưu hay cập nhật kết quả kiểm nghiệm (kể cả PASS hay FAIL) TUYỆT ĐỐI KHÔNG tự động chuyển trạng thái Lô sang `RELEASED` hay `REJECTED`.
- **Actor**: Kiểm nghiệm viên QC (`QC_ANALYST`), Trưởng phòng QC (`QC_MANAGER`).
- **Trigger**: Khi lưu hoặc gửi duyệt Phiếu kiểm nghiệm (`SC-12`).
- **Input**: `batchId: string`, `testResult.overallStatus: 'PASS' | 'FAIL' | 'PENDING'`.
- **Preconditions**: Lô đang ở trạng thái `TESTING`.
- **Decision Logic**:

  ```
  // Cập nhật trạng thái chất lượng tính toán (Canonical Quality)
  batch.qualityStatus = CanonicalStatusResolver.resolveBatchQuality(batch, testResults)

  // TUYỆT ĐỐI KHÔNG THAY ĐỔI batch.status (Workflow State giữ nguyên)
  ASSERT batch.status == 'TESTING'
  ```

- **Decision Table**:
  | Trạng thái Lô hiện tại | Kết quả phiếu kiểm nghiệm vừa lưu | Trạng thái chất lượng tính toán | Trạng thái Lô sau khi lưu phiếu |
  | :--- | :--- | :--- | :--- |
  | `TESTING` | `PASS` (100% chỉ tiêu đạt) | `PASS` | Giữ nguyên `TESTING` (Kèm nhãn động: "Đã kiểm xong - Chờ QA duyệt") |
  | `TESTING` | `FAIL` (Có chỉ tiêu rớt) | `FAIL` | Giữ nguyên `TESTING` (Kích hoạt luồng OOS/CAPA, không tự đổi `REJECTED`) |
  | `TESTING` | `PENDING` (Chưa kiểm xong) | `INCOMPLETE` | Giữ nguyên `TESTING` |
- **Output**: `batch.status: 'TESTING'`, `batch.qualityStatus: CanonicalBatchQualityStatus`.
- **State Transition**: Không có chuyển dịch trạng thái quy trình tự động.
- **UI Behavior**: Nếu `qualityStatus === 'PASS'` và `percentage === 100`, hiển thị nhãn màu xanh dương "Đã kiểm xong - Chờ QA duyệt" bên cạnh chữ `TESTING`. Nếu `FAIL`, hiển thị cảnh báo OOS nhưng không tự nhảy trạng thái của Lô.
- **Report / CoA Behavior**: Chỉ xuất CoA thương mại khi Lô đã được QA chính thức ký duyệt xuất xưởng (`status === 'RELEASED'`).
- **Audit Requirement**: Ghi log cập nhật kết quả kiểm nghiệm, không phát sinh log thay đổi trạng thái Lô.
- **Forbidden Behavior**: Cấm gọi hàm `updateBatchStatus('RELEASED')` hoặc `updateBatchStatus('REJECTED')` từ tầng lưu phiếu kiểm nghiệm (`useTestResultSave`).
- **Exception Handling**: Mọi nỗ lực mutate trạng thái Lô ngoài luồng bị chặn đứng bởi `QualityWorkflowMatrixGuard`.
- **Test Cases**: `TC-BR-BAT-002-A` (Lưu phiếu PASS giữ nguyên TESTING), `TC-BR-BAT-002-B` (Lưu phiếu FAIL không tự động REJECT lô).

---

### BR-BAT-003: Chống Xóa Lô Đã Có Dữ Liệu Hoặc Đã Xuất Xưởng (Batch Immutability & Anti-Deletion)

- **Rule ID**: `BR-BAT-003`
- **Purpose**: Tuân thủ luật dược GMP và nguyên tắc ALCOA+ Enduring: Lô sản xuất đã phát sinh phiếu kiểm nghiệm hoặc đã xuất xưởng tuyệt đối không được phép xóa vật lý khỏi hệ thống.
- **Actor**: Quản trị viên (`ADMIN`).
- **Trigger**: Khi bấm nút "Xóa Lô" tại `SC-10` / `SC-11`.
- **Input**: `batchId: string`.
- **Preconditions**: Người dùng có quyền `ADMIN`.
- **Decision Logic**:
  ```
  batch = getBatch(batchId)
  IF (batch.status == 'RELEASED')
      THEN CẤM XÓA TUYỆT ĐỐI (LÔ ĐÃ RA THỊ TRƯỜNG, CHỈ ĐƯỢC THU HỒI / RECALL)
  testCount = testResultRepository.countByBatch(batchId)
  IF (testCount > 0)
      THEN CẤM XÓA VẬT LÝ (ĐÃ PHÁT SINH KẾT QUẢ LAB)
  IF (batch.status == 'PENDING' AND testCount == 0)
      THEN CHO PHÉP XÓA (Kèm ghi nhận lý do và log kiểm toán)
  ```
- **Decision Table**:
  | Trạng thái Lô | Số phiếu kiểm nghiệm | Yêu cầu xóa | Quyết định |
  | :--- | :--- | :--- | :--- |
  | `RELEASED` | Bất kỳ | Xóa | Chặn tuyệt đối (`CANNOT_DELETE_RELEASED_BATCH`) |
  | `TESTING` | > 0 | Xóa | Chặn tuyệt đối (`BATCH_HAS_TEST_RESULTS`) |
  | `PENDING` | 0 | Xóa | Cho phép xóa (Ghi log kiểm toán ALCOA+) |
- **Output**: `canDelete: boolean`, `errorCode?: string`.
- **State Transition**: Nếu xóa hợp lệ, bản ghi bị xóa khỏi danh sách hoạt động.
- **UI Behavior**: Vô hiệu hóa hoặc ẩn nút "Xóa" đối với các lô `RELEASED` hoặc đã có phiếu kiểm nghiệm. Hiển thị thông báo giải thích rõ quy định GMP.
- **Report / CoA Behavior**: Lô đã xuất xưởng không bao giờ biến mất khỏi báo cáo PQR (Product Quality Review).
- **Audit Requirement**: Ghi log `DELETE_BATCH` với đầy đủ thông tin người thực hiện và snapshot dữ liệu trước khi xóa.
- **Forbidden Behavior**: Cấm thực hiện lệnh SQL/Firebase xóa cứng bỏ qua kiểm tra rào chắn.
- **Exception Handling**: Nếu có lỗi khi xóa các bản ghi phụ trợ, hủy bỏ toàn bộ thao tác.
- **Test Cases**: `TC-BR-BAT-003-A` (Chặn xóa Lô RELEASED), `TC-BR-BAT-003-B` (Chặn xóa Lô đã có phiếu kiểm nghiệm).
