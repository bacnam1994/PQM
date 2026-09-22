# PQM — BỘ QUY TẮC NGHIỆP VỤ: TEST RESULT RULES

# (QUY TẮC PHIẾU KIỂM NGHIỆM & KẾT QUẢ LAB)

> **Mã tài liệu**: `BR-CATALOG-TEST-RESULT`  
> **Thư mục**: `docs/business-rules/TEST_RESULT_RULES.md`  
> **Phân hệ**: `MOD-07` (Test Result / PKN Workflow)  
> **Tuân thủ**: GAMP 5, US FDA 21 CFR Part 11, ISO/IEC 17025

---

### BR-TST-001: Tính Đầy Đủ & Không Ẩn Chỉ Tiêu Bắt Buộc (No Filter on Required Criteria)

- **Rule ID**: `BR-TST-001`
- **Purpose**: Đảm bảo toàn bộ chỉ tiêu kỹ thuật đã định nghĩa trong TCCS Snapshot phải được hiển thị đầy đủ 100% trên giao diện Phiếu kiểm nghiệm (`CriteriaInputGroup`), tuyệt đối cấm ẩn dòng (filter out) chỉ vì chỉ tiêu đó chưa đến lượt kiểm hoặc là chỉ tiêu phụ thuộc.
- **Actor**: Kiểm nghiệm viên (`QC_ANALYST`), Hệ thống UI (`UI_COMPONENT`).
- **Trigger**: Khi mở màn hình nhập hoặc xem Phiếu kiểm nghiệm (`SC-12`).
- **Input**: `tccsSnapshot.criteria: Criterion[]`.
- **Preconditions**: TCCS Snapshot tồn tại trên Lô.
- **Decision Logic**:
  ```
  renderedList = tccsSnapshot.criteria // RENDER 100% KHÔNG QUA BỘ LỌC .filter(!isAlt)
  FOR EACH c in renderedList:
      state = AlternateRuleResolver.resolveCriterionState(c, existingResults, rules)
      c.uiState = state // 'NOT_TRIGGERED', 'TRIGGERED_PENDING', 'TRIGGERED_PASS', 'EXEMPTED'
      IF state == 'NOT_TRIGGERED' OR state == 'EXEMPTED':
          c.isDisabled = true
          c.displayBadge = '[MIỄN KIỂM]'
      ELSE IF state == 'TRIGGERED_PENDING':
          c.isDisabled = false
          c.displayBadge = '[CHỜ KẾT QUẢ]'
  ```
- **Decision Table**:
  | Loại chỉ tiêu | Trạng thái quy tắc thay thế | Hiển thị trên UI | Trạng thái ô nhập liệu | Nhãn hiển thị |
  | :--- | :--- | :--- | :--- | :--- |
  | Chỉ tiêu chính | Bình thường | Luôn hiển thị | Mở (Enabled) | Tiêu chuẩn theo TCCS |
  | Chỉ tiêu phụ | Chưa kích hoạt (`NOT_TRIGGERED`) | Luôn hiển thị | Khóa (Disabled) | `[MIỄN KIỂM]` |
  | Chỉ tiêu phụ | Đã kích hoạt (`TRIGGERED_PENDING`) | Luôn hiển thị | Mở (Enabled) | `[CHỜ KẾT QUẢ]` |
  | Chỉ tiêu phụ | Đã đạt (`TRIGGERED_PASS`) | Luôn hiển thị | Mở/Khóa tùy quyền | `[ĐẠT (THAY THẾ)]` |
- **Output**: `visibleCriteriaCount === totalCriteriaCount` (Tỷ lệ 100%).
- **State Transition**: Không chuyển trạng thái Lô.
- **UI Behavior**: Không có chỉ tiêu nào bị biến mất khỏi bảng nhập liệu. Các chỉ tiêu phụ chưa kích hoạt hiển thị nhãn xám dịu mắt và khóa ô gõ giá trị, kèm tooltip giải thích lý do miễn kiểm.
- **Report / CoA Behavior**: Trên CoA chỉ in các chỉ tiêu chính và chỉ tiêu phụ đã thực sự kiểm nghiệm hoặc được miễn kiểm theo luật.
- **Audit Requirement**: Không ghi log khi chỉ render giao diện.
- **Forbidden Behavior**: Tuyệt đối cấm viết `criteria.filter(c => !isAlternate(c))` làm biến mất chỉ tiêu của TCCS.
- **Exception Handling**: Nếu không tải được danh mục chỉ tiêu từ snapshot, hiển thị trạng thái Error State toàn trang, cấm nhập liệu.
- **Test Cases**: `TC-BR-TST-001-A` (Hiển thị đủ 100% chỉ tiêu), `TC-BR-TST-001-B` (Khóa ô nhập khi NOT_TRIGGERED).

---

### BR-TST-002: Bất Biến Chống Sửa Phiếu Đã Niêm Phong Snapshot (Locked Snapshot Invariance)

- **Rule ID**: `BR-TST-002`
- **Purpose**: Tuân thủ nguyên tắc ALCOA+ Accurate & Enduring: Khi phiếu kiểm nghiệm đã hoàn tất thẩm định và sinh `EvaluationSnapshot` có mã băm SHA-256, toàn bộ kết quả của phiếu đó bị khóa bất biến, không một ai được sửa đè giá trị.
- **Actor**: Toàn bộ người dùng (`QC_ANALYST`, `QC_MANAGER`, `ADMIN`).
- **Trigger**: Khi cố gắng gửi yêu cầu cập nhật kết quả kiểm nghiệm trên phiếu đã có Snapshot.
- **Input**: `testResultId: string`, `newResults: TestResultEntry[]`.
- **Preconditions**: `testResult.evaluationSnapshot != NULL` và `testResult.workflowStatus IN ['FINAL', 'APPROVED', 'RELEASED']`.
- **Decision Logic**:
  ```
  IF (testResult.evaluationSnapshot != NULL)
      isHashValid = verifyEvaluationSnapshotIntegrity(testResult.evaluationSnapshot)
      IF (isHashValid)
          THEN CẤM SỬA TRỰC TIẾP (FORBIDDEN IN-PLACE UPDATE)
          Yêu cầu: Phải lập phiếu kiểm nghiệm lại (Re-test / Revision) với số version mới
      ELSE
          CẢNH BÁO CAN THIỆP MẬT MÃ (TAMPER_DETECTED)
  ```
- **Decision Table**:
  | Trạng thái Phiếu | Có EvaluationSnapshot | Toàn vẹn mã băm | Hành động Sửa trực tiếp | Kết quả |
  | :--- | :--- | :--- | :--- | :--- |
  | `DRAFT` | Chưa có | Không áp dụng | Cho phép sửa | Cập nhật và lưu vết |
  | `FINAL` | Có | Khớp mã băm | Sửa trực tiếp | Từ chối (`SNAPSHOT_LOCKED`) |
  | `APPROVED` | Có | Khớp mã băm | Sửa trực tiếp | Từ chối nghiêm ngặt (`DOCUMENT_APPROVED`) |
  | Bất kỳ | Có | Sai lệch mã băm | Bất kỳ | Báo động an ninh (`TAMPER_DETECTED`) |
- **Output**: `canUpdate: boolean`, `requireRevision: boolean`.
- **State Transition**: Nếu tạo bản sửa đổi, chuyển sang `revision + 1` với trạng thái `DRAFT`.
- **UI Behavior**: Chuyển toàn bộ form sang chế độ xem (`view-only`), ẩn nút "Lưu", chỉ hiển thị nút "Yêu cầu kiểm nghiệm lại / Tạo bản sửa đổi (Revision)".
- **Report / CoA Behavior**: CoA luôn đọc từ Snapshot niêm phong, không bị ảnh hưởng bởi các hành vi sửa đè.
- **Audit Requirement**: Ghi log an ninh nếu phát hiện hành vi cố ý gọi API ghi đè phiếu đã khóa.
- **Forbidden Behavior**: Tuyệt đối cấm cập nhật đè (`updateItem`) vào mảng `results` của phiếu đã có snapshot.
- **Exception Handling**: Khi có sai sót trong quá trình nhập liệu ban đầu, bắt buộc lập phiếu sai lệch (Deviation Report) có QA phê duyệt để mở luồng kiểm nghiệm lại.
- **Test Cases**: `TC-BR-TST-002-A` (Chặn sửa phiếu FINAL có snapshot), `TC-BR-TST-002-B` (Phát hiện can thiệp sửa đổi hash).
