# FRS-MOD-08: Đặc Tả Nghiệp Vụ Đánh Giá Chất Lượng Chuẩn Tắc (Canonical Quality Evaluation Engine)

Tài liệu này quy định chi tiết chức năng tính toán chất lượng của Lô hàng (Canonical Status Resolver / Evaluation Engine), ranh giới với trạng thái tác nghiệp và quy chuẩn hiển thị giao diện.

---

## 1. Input & Data Schema

- `batch`: Đối tượng Lô sản phẩm cần đánh giá.
- `testResults[]`: Toàn bộ các kết quả kiểm nghiệm hiện có của Lô.
- `tccsSnapshot`: Bản chụp TCCS đang áp dụng cho Lô.
- `alternateRuleExecutions[]`: Trạng thái các quy tắc thay thế đã xử lý.

## 2. Validation Rules

- Động cơ đánh giá (Evaluation Engine) là một hàm thuần túy (Deterministic Pure Function): Với cùng một tập đầu vào, luôn trả về cùng một kết quả duy nhất.
- Không đọc trạng thái từ UI state; chỉ đọc từ Domain Snapshot và Test Results đã lưu.

## 3. Business Rules Reference

- `BR-QEV-001`: Đánh giá chất lượng chuẩn tắc `CanonicalStatusResolver.resolveBatchQuality` độc lập hoàn toàn với `WorkflowStatus`.
- `BR-QEV-002`: Nguyên tắc Không suy diễn (No Implicit Pass / No Implicit Fail) và chỉ tiêu rớt là Lô rớt.
- `BR-ALT-001` & `BR-ALT-002`: Tích hợp tự động giải quyết các quy tắc thay thế.

## 4. State Management

- Trả về đối tượng `CanonicalBatchEvaluationContract` với các enum chuẩn tắc:
  - `overallQualityStatus`: `PASS` | `FAIL` | `PENDING` | `INDETERMINATE`.
  - `completionPercentage`: 0 - 100%.

## 5. Service Layer Contract

```typescript
export interface CanonicalStatusResolver {
  resolveCriterionQuality(
    spec: CriterionSpec,
    result: CriterionResultInput
  ): CriterionEvaluationResult;
  resolveBatchQuality(
    batch: BatchContract,
    testResults: CriterionResultItem[],
    tccs: TCCSSnapshot
  ): CanonicalBatchEvaluationContract;
}
```

## 6. Permission & RBAC

- Động cơ chạy tự động ở tầng Domain / Application Service.
- Mọi người dùng đều có thể kích hoạt chế độ xem kết quả đánh giá (Read-only Calculation).
- UI chỉ nhận kết quả để render Badge, tuyệt đối không tự viết code logic so sánh min/max.

## 7. Error Handling

- `ERR_EVAL_SPEC_INVALID`: Tiêu chuẩn kỹ thuật trong TCCS bị sai định dạng số/chữ.
- `ERR_EVAL_MISSING_RESULT`: Thiếu kết quả chỉ tiêu bắt buộc khi đánh giá cuối cùng.

## 8. Audit Trail Requirement

- Kết quả đánh giá được niêm phong vào `EvaluationSnapshot` khi QA ký duyệt xuất xưởng Lô.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Render Badge động cho QA khi kiểm nghiệm xong 100% và Đạt
  Given Lô "BAT-001" có trạng thái tác nghiệp trong DB là "TESTING"
  And 100% chỉ tiêu theo TCCS đã được đo và có kết quả nằm trong khoảng cho phép
  When UI gọi hàm "CanonicalStatusResolver.resolveBatchQuality"
  Then Thuật toán trả về overallQualityStatus là "PASS" và percentage là 100
  And UI hiển thị nhãn màu xanh dương: "Đã kiểm xong - Chờ QA duyệt" bên cạnh chữ "TESTING"
  And Trạng thái trong cơ sở dữ liệu của Lô vẫn giữ nguyên là "TESTING"
```
