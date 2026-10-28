# FRS-MOD-07: Đặc Tả Nghiệp Vụ Phiếu Kiểm Nghiệm (Test Result Sheet Management)

Tài liệu này quy định chi tiết chức năng nhập liệu kết quả kiểm nghiệm, tính toán tự động, thẩm định dữ liệu gốc và quản lý vòng đời Phiếu Kiểm Nghiệm (PKN).

---

## 1. Input & Data Schema

- `batchId`: Mã định danh lô hàng cần thử nghiệm.
- `sampleReceiptDate`: Ngày nhận mẫu phòng thí nghiệm.
- `sampleQuantity`: Lượng mẫu tiếp nhận (VD: 100 viên).
- `results[]`: Danh sách kết quả chi tiết từng chỉ tiêu:
  - `criterionId`: ID chỉ tiêu tương ứng trong Snapshot TCCS của Lô.
  - `numericValue`: Kết quả đo dạng số (đối với chỉ tiêu định lượng).
  - `textValue`: Kết quả quan sát dạng chữ (đối với chỉ tiêu định tính).
  - `analystId`: ID Kỹ thuật viên trực tiếp thực hiện phép thử.
  - `testingDate`: Ngày thực hiện.
  - `testingEquipment`: Thiết bị đo sử dụng (mã máy chuẩn hóa).
  - `rawNotes`: Ghi chú số liệu thô hoặc dung sai chuẩn độ.

## 2. Validation Rules

- 100% các chỉ tiêu trong Snapshot TCCS của Lô phải được hiển thị trên phiếu (Không được filter ẩn chỉ tiêu).
- Giá trị đo định lượng phải là số hợp lệ, tuân thủ đúng số chữ số có nghĩa theo quy định Dược điển.
- Kỹ thuật viên phải ký cam kết khi nộp phiếu (`SUBMIT`).

## 3. Business Rules Reference

- `BR-TST-001`: Hiển thị 100% chỉ tiêu theo TCCS Snapshot, cấm bỏ sót.
- `BR-TST-002`: Khóa dữ liệu nhập của Kỹ thuật viên khi đã bấm "Nộp thẩm định" (`SUBMITTED`).
- `BR-APP-001`: Quy trình phê duyệt đa cấp và nguyên tắc Bốn mắt (Four-Eyes Principle).

## 4. State Management

- Tuân thủ FSM 2 (`TestResult Workflow FSM`): `DRAFT` -> `SUBMITTED` -> `REVIEWED` -> `APPROVED` (hoặc `REJECTED`, `REVOKED`).

## 5. Service Layer Contract

```typescript
export interface TestResultService {
  initializeSheetForBatch(batchId: string): Promise<TestResultContract>;
  updateCriterionResult(
    sheetId: string,
    criterionId: string,
    resultData: CriterionResultInput
  ): Promise<TestResultContract>;
  submitSheet(sheetId: string, analystCredentials: AuthInput): Promise<TestResultContract>;
  reviewSheet(
    sheetId: string,
    reviewerId: string,
    isPassed: boolean,
    comments?: string
  ): Promise<TestResultContract>;
  approveSheet(sheetId: string, approverCredentials: AuthInput): Promise<TestResultContract>;
  reopenSheetForEdit(sheetId: string, qaReason: string): Promise<TestResultContract>;
}
```

## 6. Permission & RBAC

- Nhập kết quả: `ANALYST` (chỉ nhập khi ở trạng thái `DRAFT`).
- Thẩm định (Review): `QA_REVIEWER` (nghiêm cấm tự thẩm định nếu trùng `analystId`).
- Phê duyệt (Approve): `QA_MANAGER` (có chữ ký điện tử).

## 7. Error Handling

- `ERR_TST_INCOMPLETE`: Báo lỗi khi nộp phiếu mà chưa hoàn thành đủ các chỉ tiêu bắt buộc.
- `ERR_SOD_VIOLATION`: Báo lỗi khi người nhập tự bấm duyệt phiếu của mình.

## 8. Audit Trail Requirement

- Ghi nhận chi tiết mọi sự thay đổi từng con số kết quả (trước/sau), ID người sửa, thời điểm và lý do.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Khóa phiếu sau khi Kỹ thuật viên nộp thẩm định
  Given Phiếu kiểm nghiệm "PKN-2026-001" đang ở trạng thái "DRAFT"
  When Kỹ thuật viên hoàn tất 10 chỉ tiêu và bấm "Nộp kết quả thẩm định"
  Then Trạng thái phiếu chuyển sang "SUBMITTED"
  And Giao diện khóa toàn bộ ô nhập liệu của Kỹ thuật viên
  And Phiếu xuất hiện trên hàng đợi thẩm định của QA Reviewer
```
