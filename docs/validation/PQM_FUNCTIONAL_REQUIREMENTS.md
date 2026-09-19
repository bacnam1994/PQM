# PQM — BẢN ĐẶC TẢ YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS SPECIFICATION - FRS)

> **Mã tài liệu:** `PQM-CSV-FRS-001`  
> **Phiên bản:** `1.0.0`  
> **Giai đoạn:** `PHASE F — Computer System Validation`  
> **Ánh xạ từ:** `PQM-CSV-URS-001` | **Tuân thủ:** `GAMP 5 Module Specifications`

---

## 1. TỔNG QUAN

Tài liệu này chi tiết hóa các Yêu cầu Chức năng (Functional Requirements - FRS) từ các Yêu cầu Người dùng (URS), ánh xạ cụ thể tới các thành phần Domain, Service, State Machine và Guard trong mã nguồn hệ thống PQM.

---

## 2. CHI TIẾT CÁC YÊU CẦU CHỨC NĂNG

### 2.1. Nhóm Quản lý Sản phẩm (FRS-PRD)

- **FRS-PRD-001:** `ProductService.createProduct` phải xác thực đầu vào bằng Zod schema: `code` (chuỗi ký tự viết hoa không dấu, độ dài 3-20 ký tự), `name` (chuỗi ký tự, tối thiểu 2 từ), `registrationNo` (chuỗi ký tự hợp lệ).
- **FRS-PRD-002:** `ProductService` phải thực hiện truy vấn kiểm tra trùng lặp `code` qua `productRepository.findByCode` trước khi thêm mới. Nếu đã tồn tại, từ chối với lỗi `DUPLICATE_PRODUCT_CODE`.
- **FRS-PRD-003:** Chặn xóa vật lý sản phẩm nếu `batchRepository.countByProduct(productId) > 0` hoặc `tccsRepository.countByProduct(productId) > 0`.

### 2.2. Nhóm Tiêu chuẩn Cơ sở (FRS-TCS)

- **FRS-TCS-001:** `TCCSService.createTCCS` phải thẩm định cấu trúc danh sách chỉ tiêu kỹ thuật (`criteria`), mỗi chỉ tiêu phải có: `id`, `name`, `type` (`NUMERIC`, `TEXT`, `RANGE`), và tiêu chí chấp nhận định lượng.
- **FRS-TCS-002:** Khi một TCCS được kích hoạt (`activateTCCS`), hệ thống phải thực hiện transaction cập nhật TCCS hiện tại thành `status = 'ACTIVE'`, đồng thời cập nhật tất cả TCCS khác của cùng sản phẩm thành `status = 'OBSOLETE'`.

### 2.3. Nhóm Công thức & Nguyên liệu (FRS-FOR)

- **FRS-FOR-001:** `ProductFormulaService.saveFormula` phải kiểm tra tính hợp lệ của hàm lượng công bố (`declaredContent > 0`) và đơn vị tính hợp lệ.
- **FRS-FOR-002:** Mỗi thành phần nguyên liệu hoạt chất phải được map với ID chuẩn hóa từ từ điển `RawMaterial` thông qua `MaterialHarmonizerService`.

### 2.4. Nhóm Quản lý Lô Sản xuất (FRS-BAT)

- **FRS-BAT-001:** `BatchAppService.createBatch` bắt buộc kiểm tra:
  - `productId` tồn tại và đang hoạt động (`status === 'ACTIVE'`).
  - Lấy `activeTCCS` của sản phẩm. Nếu không có TCCS hiệu lực, chặn tạo lô với mã lỗi `MISSING_ACTIVE_TCCS`.
  - Lấy `productFormula` tương ứng. Nếu không có công thức, chặn tạo lô với mã lỗi `MISSING_PRODUCT_FORMULA`.
- **FRS-BAT-002:** `BatchAppService.createBatch` sao chép snapshot nguyên trạng của TCCS và Formula vào thuộc tính `tccsSnapshot` và `formulaSnapshot` của bản ghi Lô.
- **FRS-BAT-003:** Kiểm tra không trùng số lô `batchNo` cho cùng sản phẩm bằng indexed query.
- **FRS-BAT-004:** Khởi tạo `status = 'TESTING'`, `version = 1`, ghi vết nhật ký kiểm toán ALCOA+.

### 2.5. Nhóm Nhập & Thẩm định Phiếu Kiểm nghiệm (FRS-TST & FRS-QEV)

- **FRS-TST-001:** `TestResultAppService.createTestResult` phải liên kết với một `batchId` hợp lệ.
- **FRS-QEV-001:** `QualityEvaluationEngine.evaluateTestResult` tính toán kết quả thẩm định dựa trên từng chỉ tiêu so với giới hạn trong TCCS:
  - Nếu tất cả chỉ tiêu đạt: `overallStatus = 'PASS'`.
  - Nếu có ít nhất 1 chỉ tiêu không đạt: `overallStatus = 'FAIL'`.
  - Nếu có chỉ tiêu đang chờ kết quả: `overallStatus = 'PENDING'`.
  - Nếu thiếu dữ liệu hoặc không nhận diện được: `overallStatus = 'UNKNOWN'`.
- **FRS-QEV-002:** Cấm tuyệt đối việc suy diễn `PENDING` hoặc `UNKNOWN` thành `FAIL` hoặc `PASS`.
- **FRS-SNP-001:** `EvaluationSnapshotBuilder.createSnapshot` sinh snapshot bất biến chứa `overallStatus`, `criteriaSummary`, `evaluator`, `evaluationTimestamp`, và tính mã băm SHA-256 (`evaluationHash`).

### 2.6. Nhóm Phê duyệt & Rào chắn Xuất xưởng Lô (FRS-REL)

- **FRS-REL-001:** `TestResultWorkflowStateMachine` kiểm soát việc chuyển đổi trạng thái tài liệu:
  - `DRAFT` -> `SUBMITTED` (bởi Kiểm nghiệm viên).
  - `SUBMITTED` -> `FINAL` (khi đã hoàn tất thẩm định chất lượng và có Snapshot).
  - `FINAL` -> `APPROVED` (chỉ bởi người dùng có vai trò `QA` hoặc `ADMIN`).
- **FRS-REL-002:** `QualityWorkflowMatrixGuard.validateBatchRelease` thực thi rào chắn xuất xưởng 6 điểm kiểm tra bắt buộc:
  1. Thẩm quyền RBAC: Người thực hiện phải có vai trò `QA` hoặc `ADMIN`.
  2. Sự tồn tại của Lô: Lô phải tồn tại và đang ở trạng thái `TESTING`.
  3. Phiếu kiểm nghiệm có thẩm quyền: Phải có ít nhất 1 phiếu kiểm nghiệm chính thức.
  4. Trạng thái chất lượng: Phiếu kiểm nghiệm bắt buộc phải có `overallStatus === 'PASS'`.
  5. Tính toàn vẹn Snapshot: `evaluationSnapshot` phải tồn tại và mã băm SHA-256 phải khớp 100% với dữ liệu thực tế.
  6. Phê duyệt tài liệu: Phiếu kiểm nghiệm phải có `workflowStatus === 'APPROVED'` hoặc `RELEASED`.
- **FRS-REL-003:** Nếu vi phạm bất kỳ điểm nào, `QualityWorkflowMatrixGuard` lập tức từ chối xuất xưởng (`canRelease: false`) kèm danh sách lý do chi tiết (`blockingReasons`).

### 2.7. Nhóm Chữ ký Điện tử 21 CFR Part 11 (FRS-SIG)

- **FRS-SIG-001:** `SignatureService.sign` ghi nhận đối tượng `ElectronicSignature`:
  - `signerId`, `signerName`, `signerEmail`, `signerRole`.
  - `meaning` (lý do ký: ví dụ 'PHÊ DUYỆT XUẤT XƯỞNG LÔ').
  - `timestamp` (ISO 8601).
  - `checksum`: Mã SHA-256 băm từ toàn bộ nội dung dữ liệu được ký (`computeSignatureChecksum`).
- **FRS-SIG-002:** `SignatureService.verifySignature` thực hiện tính lại checksum của bản ghi dữ liệu và đối chiếu với `checksum` lưu trong chữ ký. Nếu khác biệt, báo lỗi `SIGNATURE_TAMPERED`.

### 2.8. Nhóm Phả hệ & Truy xuất Nguồn gốc (FRS-GEN)

- **FRS-GEN-001:** `buildBatchGenealogy` tổng hợp cấu trúc cây gồm: Node Lô (`BatchNode`), Node Sản phẩm (`ProductNode`), Node TCCS (`TccsNode`), Danh sách Node Nguyên liệu đầu vào (`RawMaterialNodes`), Danh sách Node Phiếu kiểm nghiệm (`TestResultNodes`), Node Chữ ký số và Node Quyết định xuất xưởng.
- **FRS-GEN-002:** Đảm bảo xử lý an toàn khi Lô chưa có dữ liệu nguyên liệu (`rawMaterials = []`) hoặc chưa có phiếu kiểm nghiệm (`testResults = []`).

### 2.9. Nhóm Nhật ký Kiểm toán ALCOA+ (FRS-AUD)

- **FRS-AUD-001:** `AuditService.logAction` ghi nhận mọi hành động nhạy cảm vào collection `audit_logs`:
  - `id`: Định danh duy nhất bản ghi kiểm toán.
  - `action`: Mã hành động (ví dụ: `BATCH_RELEASE`, `TEST_RESULT_APPROVE`, `CREATE_PRODUCT`).
  - `entityType` & `entityId`: Thực thể chịu tác động.
  - `actorId`, `actorEmail`, `actorRole`: Người thực hiện.
  - `details`: Thay đổi chi tiết gồm `oldValue`, `newValue`, `reason`.
  - `timestamp`: Thời gian ghi nhận tức thì (ISO 8601).
  - `hash`: Mã băm liên kết bảo vệ tính toàn vẹn (tamper-evident).
- **FRS-AUD-002:** Không cung cấp bất kỳ API hoặc hàm nào cho phép cập nhật (`update`) hoặc xóa (`delete`) trên collection `audit_logs`.

### 2.10. Nhóm Quản trị AI & Tự động Sửa sai (FRS-AIG)

- **FRS-AIG-001:** `aiActionGuard.validateAIAction` chặn tất cả các hành động nhạy cảm/regulated (`batch:release`, `test_result:approve`, `settings:update/auto_heal`).
- **FRS-AIG-002:** Khi AI gọi một công cụ regulated, hệ thống không được ghi vào DB mà phải sinh một đối tượng `AIActionProposal` ở trạng thái `PENDING_APPROVAL`, yêu cầu hiển thị hộp thoại xác nhận trên UI để người dùng có thẩm quyền quyết định.
- **FRS-AIG-003:** `AutoHealingFramework.executeAtomicHealingPlan` thực thi sửa lỗi dữ liệu theo cơ chế giao dịch All-or-Nothing (Atomic Transaction). Nếu có bất kỳ lỗi nào xảy ra trong quá trình commit, gọi hàm `rollbackHandler` và đánh dấu toàn bộ plan là `ROLLED_BACK`.
- **FRS-AIG-004:** Cấm tuyệt đối chiến lược tự động sửa đối với các trường kết quả gốc (`results`, `value`, `rawMeasurement`), chữ ký số (`signature`), và nhật ký kiểm toán (`NEVER_AUTO_HEAL`).
