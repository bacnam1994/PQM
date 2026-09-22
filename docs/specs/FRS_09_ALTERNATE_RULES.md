# FRS-MOD-09: Đặc Tả Nghiệp Vụ Chỉ Tiêu Thay Thế & Thử Nghiệm Lại (Alternate & Retry Rules Engine)

Tài liệu này quy định chi tiết chức năng thực thi động cơ Quy tắc Chỉ tiêu Thay thế (Alternate Rules Engine), xử lý các tình huống thử lại (FAIL_RETRY), miễn kiểm tra có điều kiện (CONDITIONAL_CHECK) và sinh footnote pháp lý.

---

## 1. Input & Data Schema

- `ruleConfig`: Cấu hình quy tắc thay thế lấy từ Snapshot TCCS của Lô.
- `primaryResult`: Kết quả đo thực tế của chỉ tiêu chính.
- `substituteResult`: Kết quả đo của chỉ tiêu thay thế / mở rộng (nếu đã thực hiện).

## 2. Validation Rules

- Không cấu hình quan hệ vòng lặp đệ quy.
- Cả hai chỉ tiêu liên kết phải cùng thuộc Snapshot TCCS của sản phẩm.
- Chỉ tiêu phụ chỉ được phép kích hoạt khi điều kiện của chỉ tiêu chính thỏa mãn.

## 3. Business Rules Reference

- `BR-ALT-001`: Quy trình xử lý tự động khi chỉ tiêu sơ bộ Fail cho phép thử lại lần 2 (`FAIL_RETRY`).
- `BR-ALT-002`: Quy trình miễn kiểm nghiệm có điều kiện (`CONDITIONAL_CHECK`).
- `BR-COA-002`: Tự động đánh dấu footnote `(*)` và in văn bản giải trình chân trang CoA.

## 4. State Management

- Tuân thủ FSM 4 (`Alternate Rule FSM`): `NOT_TRIGGERED` -> `TRIGGERED_PENDING` -> `TRIGGERED_PASS` / `TRIGGERED_FAIL` (hoặc `NOT_APPLICABLE`).

## 5. Service Layer Contract

```typescript
export interface AlternateRulesEngine {
  evaluateRuleState(
    config: AlternateRuleConfig,
    primary: CriterionResultItem,
    substitute?: CriterionResultItem
  ): AlternateRuleExecutionContract;

  generateLegalFootnote(ruleExecutions: AlternateRuleExecutionContract[]): CoAFootnoteBlock[];
}
```

## 6. Permission & RBAC

- Động cơ giải quyết quy tắc nằm hoàn toàn ở tầng Core Domain.
- Kỹ thuật viên không có quyền tự chuyển trạng thái quy tắc bằng tay; trạng thái chuyển dịch tự động dựa trên kết quả số liệu thực nghiệm đo được.

## 7. Error Handling

- `ERR_ALT_CIRCULAR_DEPENDENCY`: Phát hiện vòng lặp quan hệ thay thế.
- `ERR_ALT_SUBSTITUTE_MISSING`: Chỉ tiêu phụ chưa được thực hiện khi chỉ tiêu chính đã rớt.

## 8. Audit Trail Requirement

- Ghi nhận chi tiết căn cứ kích hoạt quy tắc và kết quả thẩm tra vào hồ sơ lô.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Chỉ tiêu chính rớt nhưng lần 2 đạt tiêu chuẩn (FAIL_RETRY)
  Given Chỉ tiêu "Độ rã lần 1" có kết quả "FAIL"
  And Có quy tắc "ALT-DIS-01" cho phép thử lại lần 2 với 12 viên
  When Kỹ thuật viên nhập kết quả lần 2 đạt chuẩn ("PASS")
  Then Trạng thái quy tắc chuyển sang "TRIGGERED_PASS"
  And Chỉ tiêu tổng thể được công nhận là "PASS"
  And CoA tự động sinh chú thích chân trang: "(*) Đạt sau khi thử nghiệm mở rộng theo Dược điển"
```
