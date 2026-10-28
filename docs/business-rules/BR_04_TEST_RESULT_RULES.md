# BỘ QUY TẮC NGHIỆP VỤ 04: TEST RESULT RULES

## (QUY TẮC PHIẾU KIỂM NGHIỆM & NHẬP LIỆU PHÒNG THÍ NGHIỆM)

> **Mã tài liệu**: `BR-CATALOG-04`  
> **Thư mục**: `docs/business-rules/BR_04_TEST_RESULT_RULES.md`  
> **Phân hệ liên quan**: `MOD-07` (Test Result Workflow)

---

### BR-TR-001: Chốt Chặn Nộp Phiếu Kiểm Nghiệm (Submission Gate Enforcement)

- **Mục đích**: Ngăn ngừa việc nộp các phiếu kiểm nghiệm dở dang, thiếu kết quả bắt buộc hoặc đang chờ kết quả chỉ tiêu thay thế.
- **Trigger**: Khi Kiểm nghiệm viên bấm nút "Gửi thẩm tra" (Submit) tại `SC-12`.
- **Input**: `testResult: TestResult`, `tccsSnapshot: TCCS`.
- **Điều kiện & Quyết định**:
  1. Mọi chỉ tiêu bắt buộc (`isRequired === true`) trong TCCS Snapshot đều phải có giá trị khác rỗng (`value !== null && value !== undefined && value !== ''`).
  2. **Không có bất kỳ chỉ tiêu nào đang ở trạng thái `TRIGGERED_PENDING`** (Chỉ tiêu thay thế đã kích hoạt nhưng chưa nhập kết quả thử nghiệm bổ sung).
  3. Nếu vi phạm 1 trong 2 điều kiện trên ➔ **CHẶN NỘP PHIẾU (SUBMISSION BLOCKED)**.
- **UI Behavior**: Nút "Gửi thẩm tra" bị vô hiệu hóa; hiển thị danh sách các chỉ tiêu còn thiếu với biểu tượng cảnh báo màu vàng.
- **Test Cases**: `TC-BR-TR-001-A` (Chỉ tiêu phụ đang chờ kết quả ➔ Chặn Submit), `TC-BR-TR-001-B` (Đủ kết quả ➔ Cho phép Submit).

---

### BR-TR-002: Đóng Băng Evaluation Snapshot Khi Ký Duyệt (Frozen Snapshot On Approval)

- **Mục đích**: Lưu giữ vĩnh viễn bằng chứng kỹ thuật tại thời điểm phê duyệt, phục vụ in CoA và thanh tra GMP.
- **Trigger**: Khi QA Manager thực hiện ký số điện tử phê duyệt Phiếu kiểm nghiệm (`status ➔ APPROVED`).
- **Input**: `testResult: TestResult`.
- **Điều kiện & Quyết định**:
  - Động cơ `QualityEvaluationEngine` thực hiện thẩm định lần cuối toàn bộ mảng kết quả.
  - Sinh đối tượng `evaluationSnapshot`:
    ```typescript
    {
      engineVersion: "3.0.0-CANONICAL",
      testResultId: testResult.id,
      batchId: testResult.batchId,
      evaluatedAt: ServerTimestamp(),
      evaluatedBy: currentUser.id,
      overallStatus: canonicalQualityStatus, // PASS | FAIL
      criterionResults: frozenCriterionResults,
      evaluationHash: calculateSHA256(frozenData)
    }
    ```
  - Ghi đè `testResult.evaluationSnapshot = evaluationSnapshot`.
  - Khóa toàn bộ trường dữ liệu của phiếu sang chế độ Read-Only.
- **Output**: Bản Snapshot bất biến có mã băm SHA-256.
- **Test Cases**: `TC-BR-TR-002-A` (Ký duyệt ➔ Snapshot được tạo với đầy đủ mã băm SHA-256).

---

### BR-TR-003: Cơ Chế Thay Thế Phiếu (Superseded Policy)

- **Mục đích**: Tuân thủ nguyên tắc không xóa sửa dữ liệu đã phê duyệt. Khi phát hiện sai sót sau khi duyệt, bắt buộc phải phát hành phiếu mới đính chính.
- **Trigger**: Khi QA Manager phê duyệt một Phiếu kiểm nghiệm mới để thay thế phiếu cũ đã `APPROVED`.
- **Input**: `oldTestResultId: string`, `newTestResultId: string`, `justification: string`.
- **Điều kiện & Quyết định**:
  - Phiếu cũ chuyển trạng thái sang `SUPERSEDED` (Bị thay thế).
  - Phiếu cũ được ghi nhận: `supersededBy = newTestResultId`, `supersededReason = justification`.
  - Phiếu cũ không bị xóa, vẫn hiển thị trong lịch sử hồ sơ lô kèm dấu triện mờ: _"SUPERSEDED"_.
- **Test Cases**: `TC-BR-TR-003-A` (Phiếu mới duyệt ➔ Phiếu cũ chuyển SUPERSEDED).
