# PQM — BỘ QUY TẮC NGHIỆP VỤ: ALTERNATE RULES

# (QUY TẮC CHỈ TIÊU THAY THẾ & KIỂM TRA CÓ ĐIỀU KIỆN)

> **Mã tài liệu**: `BR-CATALOG-ALTERNATE-RULES`  
> **Thư mục**: `docs/business-rules/ALTERNATE_RULES.md`  
> **Phân hệ**: `MOD-09` (Alternate Rules Workflow)  
> **Tuân thủ**: GAMP 5, Dược điển Việt Nam V, USP-NF Phép thử thay thế

---

### BR-ALT-001: Quy Tắc Thử Nghiệm Lại Khi Rớt (FAIL_RETRY Alternate Rule)

- **Rule ID**: `BR-ALT-001`
- **Purpose**: Điều phối quy trình Dược điển cho phép kiểm nghiệm lại bằng phương pháp thứ 2 (hoặc chỉ tiêu thay thế) khi chỉ tiêu chính ban đầu không đạt.
- **Actor**: Động cơ quy tắc (`AlternateRuleResolver`), Kiểm nghiệm viên QC (`QC_ANALYST`).
- **Trigger**: Khi chỉ tiêu chính (Main Criterion) có kết quả đánh giá là `FAIL`.
- **Input**: `mainResult: CriterionResult`, `altRule: AlternateRule (type == 'FAIL_RETRY')`, `altResult?: CriterionResult`.
- **Preconditions**: Quy tắc thay thế ở trạng thái `enabled === true`.
- **Decision Logic**:
  ```
  IF (mainResult.status == 'PASS')
      THEN altCriterion.state = 'NOT_APPLICABLE'
      altCriterion.isExempted = true
      altCriterion.uiStatus = 'MIỄN KIỂM'
      ruleVerdict = 'PASS'
  ELSE IF (mainResult.status == 'FAIL')
      IF (altResult == NULL OR altResult.value == NULL)
          THEN altCriterion.state = 'TRIGGERED_PENDING'
          altCriterion.uiStatus = 'CHỜ KẾT QUẢ'
          ruleVerdict = 'PENDING' // CHỜ KIỂM PHỤ, KHÔNG ĐƯỢC ÉP FAIL
      ELSE IF (altResult.status == 'PASS')
          THEN altCriterion.state = 'TRIGGERED_PASS'
          altCriterion.uiStatus = 'ĐẠT (THAY THẾ)'
          ruleVerdict = 'PASS' // CỨU XÉT THÀNH CÔNG
      ELSE
          THEN altCriterion.state = 'TRIGGERED_FAIL'
          altCriterion.uiStatus = 'KHÔNG ĐẠT'
          ruleVerdict = 'FAIL' // CẢ 2 ĐỀU RỚT
  ```
- **Decision Table**:
  | Chỉ tiêu chính (Main) | Chỉ tiêu phụ (Alt) | Alternate Rule State | Kết luận quy tắc | Hành vi giao diện |
  | :--- | :--- | :--- | :--- | :--- |
  | `PASS` | Chưa nhập / Bỏ qua | `NOT_APPLICABLE` | `PASS` | Khóa ô nhập phụ, nhãn `[MIỄN KIỂM]` |
  | `FAIL` | Chưa có kết quả | `TRIGGERED_PENDING` | `PENDING` | Mở ô nhập phụ, nhãn `[CHỜ KẾT QUẢ]` |
  | `FAIL` | `PASS` | `TRIGGERED_PASS` | `PASS` | Nhãn `[ĐẠT (THAY THẾ)]`, ghi chú footnote |
  | `FAIL` | `FAIL` | `TRIGGERED_FAIL` | `FAIL` | Báo đỏ `[KHÔNG ĐẠT]`, kích hoạt OOS |
- **Output**: `ruleVerdict: 'PASS' | 'FAIL' | 'PENDING'`, `altState: AlternateCriterionState`.
- **State Transition**: `NOT_TRIGGERED -> TRIGGERED_PENDING -> TRIGGERED_PASS / TRIGGERED_FAIL`.
- **UI Behavior**: Không ẩn dòng chỉ tiêu phụ. Khi chỉ tiêu chính PASS, dòng chỉ tiêu phụ mờ đi và có nhãn `[MIỄN KIỂM]`. Khi chỉ tiêu chính FAIL, dòng phụ sáng lên kèm viền cam nổi bật và nhãn `[CHỜ KẾT QUẢ]`.
- **Report / CoA Behavior**: Trên CoA in kết quả của chỉ tiêu phụ đạt kèm dòng chú thích pháp lý (Footnote): _"(\*) Chỉ tiêu đạt theo quy tắc thử nghiệm lại [Tên quy tắc] khi chỉ tiêu chính không đạt."_
- **Audit Requirement**: Bắt buộc ghi log sự kiện `TRIGGER_FAIL_RETRY_RULE` với kết quả của cả hai lần thử.
- **Forbidden Behavior**: Tuyệt đối cấm kết luận `FAIL` toàn phiếu khi chỉ tiêu chính FAIL nhưng chỉ tiêu phụ chưa có kết quả (phải bảo lưu `PENDING`).
- **Exception Handling**: Nếu phương pháp thử thay thế cũng không thể thực hiện do hỏng thiết bị, giữ `PENDING` và mở báo cáo sai lệch kỹ thuật.
- **Test Cases**: `TC-BR-ALT-001-A` (Main PASS -> Alt miễn kiểm), `TC-BR-ALT-001-B` (Main FAIL + Alt trống -> PENDING), `TC-BR-ALT-001-C` (Main FAIL + Alt PASS -> PASS).

---

### BR-ALT-002: Quy Tắc Kiểm Tra Có Điều Kiện (CONDITIONAL_CHECK Alternate Rule)

- **Rule ID**: `BR-ALT-002`
- **Purpose**: Điều phối quy trình tiêu chuẩn (ví dụ: Arsen tổng số TC1 và Arsen vô cơ TC2). Nếu TC1 ĐẠT và vượt ngưỡng cho phép thì bắt buộc kiểm tra thêm TC2; nếu TC1 ĐẠT và dưới ngưỡng thì TC2 được MIỄN KIỂM; nếu TC1 KHÔNG ĐẠT thì lập tức FAIL độc lập.
- **Actor**: Động cơ quy tắc (`AlternateRuleResolver`), Hệ thống thẩm định.
- **Trigger**: Khi nhập kết quả chỉ tiêu chính có cấu hình điều kiện kích hoạt.
- **Input**: `mainResult: CriterionResult`, `condition: StructuredCondition`, `altResult?: CriterionResult`.
- **Preconditions**: Quy tắc thay thế có `type === 'CONDITIONAL_CHECK'`.
- **Decision Logic**:
  ```
  // BẤT BIẾN: NẾU TC1 RỚT THÌ FAIL LẬP TỨC ĐỘC LẬP
  IF (mainResult.status == 'FAIL')
      THEN overallVerdict = 'FAIL'
      EXIT

  isTriggered = evaluateCondition(condition, mainResult.value)
  IF (NOT isTriggered)
      THEN altCriterion.state = 'EXEMPTED'
      altCriterion.isExempted = true
      altCriterion.uiStatus = 'MIỄN KIỂM'
      overallVerdict = 'PASS' // MIỄN KIỂM TUYỆT ĐỐI TC2
  ELSE
      IF (altResult == NULL OR altResult.value == NULL)
          THEN altCriterion.state = 'TRIGGERED_PENDING'
          altCriterion.uiStatus = 'CHỜ KẾT QUẢ'
          overallVerdict = 'PENDING'
      ELSE IF (altResult.status == 'PASS')
          THEN altCriterion.state = 'TRIGGERED_PASS'
          overallVerdict = 'PASS'
      ELSE
          THEN altCriterion.state = 'TRIGGERED_FAIL'
          overallVerdict = 'FAIL'
  ```
- **Decision Table**:
  | TC1 (Arsen tổng số ≤ 5) | Ngưỡng kích hoạt (> 1.5) | Kích hoạt TC2? | TC2 (Arsen vô cơ ≤ 1.5) | Kết luận tổng thể |
  | :--- | :--- | :--- | :--- | :--- |
  | `1.2` (ĐẠT) | Không kích hoạt (≤ 1.5) | KHÔNG | Bỏ trống / Bất kỳ | `PASS` (TC2 Miễn kiểm) |
  | `2.0` (ĐẠT) | Kích hoạt (> 1.5) | CÓ | Bỏ trống | `PENDING` (Chờ kết quả TC2) |
  | `2.0` (ĐẠT) | Kích hoạt (> 1.5) | CÓ | `1.0` (ĐẠT) | `PASS` |
  | `2.0` (ĐẠT) | Kích hoạt (> 1.5) | CÓ | `2.5` (KHÔNG ĐẠT) | `FAIL` |
  | `6.0` (KHÔNG ĐẠT) | Vượt giới hạn TCCS | Không áp dụng | Bất kỳ | `FAIL` (Độc lập ngay từ TC1) |
- **Output**: `overallVerdict: 'PASS' | 'FAIL' | 'PENDING'`, `altState: AlternateCriterionState`.
- **State Transition**: `NOT_TRIGGERED -> EXEMPTED` HOẶC `TRIGGERED_PENDING -> TRIGGERED_PASS / TRIGGERED_FAIL`.
- **UI Behavior**: Khi TC1 ≤ 1.5, TC2 bị khóa và hiện nhãn xanh lá `[MIỄN KIỂM]`. Khi TC1 > 1.5, TC2 mở khóa, hiển thị nhãn màu cam `[CHỜ KẾT QUẢ]`.
- **Report / CoA Behavior**: Trên CoA, nếu TC2 được miễn kiểm, in giá trị `Miễn kiểm` kèm footnote căn cứ tiêu chuẩn Dược điển.
- **Audit Requirement**: Ghi nhận sự kiện thẩm định điều kiện trong `EvaluationDecisionTrace`.
- **Forbidden Behavior**: Cấm hành vi coi việc TC1 > 1.5 là FAIL khi chưa có kết quả của TC2.
- **Exception Handling**: Nếu giá trị nhập vào TC1 không parse được sang số để so sánh ngưỡng, chặn lưu và yêu cầu nhập số hợp lệ.
- **Test Cases**: `TC-BR-ALT-002-A` (TC1 đạt <= ngưỡng -> Miễn kiểm TC2), `TC-BR-ALT-002-B` (TC1 đạt > ngưỡng + TC2 đạt -> PASS), `TC-BR-ALT-002-C` (TC1 rớt -> FAIL lập tức).
