# PQM — BỘ QUY TẮC NGHIỆP VỤ: QUALITY EVALUATION RULES

# (QUY TẮC ĐÁNH GIÁ CHẤT LƯỢNG TẤT ĐỊNH & THẨM ĐỊNH CANONICAL)

> **Mã tài liệu**: `BR-CATALOG-QUALITY-EVALUATION`  
> **Thư mục**: `docs/business-rules/QUALITY_EVALUATION_RULES.md`  
> **Phân hệ**: `MOD-08` (Quality Evaluation Engine Workflow)  
> **Tuân thủ**: GAMP 5, Dược điển Việt Nam V, US FDA 21 CFR Part 211

---

### BR-QEV-001: Chuẩn Hóa 4 Trạng Thái Chất Lượng Tất Định (4-State Deterministic Quality)

- **Rule ID**: `BR-QEV-001`
- **Purpose**: Đảm bảo kết quả đánh giá chất lượng chỉ thuộc 1 trong 4 trạng thái chuẩn tắc (`PASS | FAIL | PENDING | UNKNOWN`), loại bỏ hoàn toàn việc dùng boolean `isPass` làm thẩm quyền tối cao và ngăn chặn việc tự động ép thiếu dữ liệu thành FAIL.
- **Actor**: Động cơ thẩm định (`QualityEvaluationEngine`), `CanonicalStatusResolver`.
- **Trigger**: Khi tính toán kết quả chỉ tiêu, phiếu kiểm nghiệm hoặc toàn Lô sản xuất.
- **Input**: Danh sách kết quả chỉ tiêu (`CriterionResult[]`), tiêu chuẩn TCCS Snapshot.
- **Preconditions**: Tiêu chuẩn kỹ thuật TCCS có cấu trúc hợp lệ.
- **Decision Logic**:
  ```
  IF (Có ít nhất 1 chỉ tiêu FAIL mà không có quy tắc thay thế cứu xét hợp lệ)
      THEN overallStatus = 'FAIL'
  ELSE IF (Tất cả chỉ tiêu bắt buộc đều PASS hoặc EXEMPTED)
      THEN overallStatus = 'PASS'
  ELSE IF (Còn chỉ tiêu bắt buộc chưa có kết quả hoặc đang chờ thử nghiệm lại)
      THEN overallStatus = 'PENDING'
  ELSE
      overallStatus = 'UNKNOWN'
  ```
- **Decision Table**:
  | Chỉ tiêu ĐẠT | Chỉ tiêu RỚT (FAIL) | Chỉ tiêu CHỜ (PENDING) | Chỉ tiêu LỖI (UNKNOWN) | Trạng thái tổng thể |
  | :--- | :--- | :--- | :--- | :--- |
  | 100% | 0 | 0 | 0 | `PASS` |
  | Bất kỳ | ≥ 1 | Bất kỳ | Bất kỳ | `FAIL` |
  | < 100% | 0 | ≥ 1 | 0 | `PENDING` |
  | < 100% | 0 | 0 | ≥ 1 | `UNKNOWN` |
  | 0 | 0 | 0 | 0 | `UNKNOWN` |
- **Output**: `overallStatus: 'PASS' | 'FAIL' | 'PENDING' | 'UNKNOWN'`.
- **State Transition**: Cập nhật trạng thái chất lượng tính toán (`qualityStatus`), không đổi `workflowStatus`.
- **UI Behavior**: Render badge màu chuẩn mực: `PASS` (Xanh lá), `FAIL` (Đỏ), `PENDING` (Vàng cam), `UNKNOWN` (Xám).
- **Report / CoA Behavior**: Chỉ in phiếu CoA chính thức khi `overallStatus === 'PASS'`.
- **Audit Requirement**: Đóng gói toàn bộ cây quyết định vào `EvaluationDecisionTrace`.
- **Forbidden Behavior**: Tuyệt đối cấm suy diễn ngầm `PENDING` (chưa làm xong) thành `FAIL` (đánh rớt oan) hoặc thành `PASS` (thông qua khống).
- **Exception Handling**: Nếu có chỉ tiêu không parse được kiểu dữ liệu, đánh dấu chỉ tiêu đó là `UNKNOWN` và toàn phiếu thành `UNKNOWN`, không ép FAIL.
- **Test Cases**: `TC-BR-QEV-001-A` (Tất cả PASS), `TC-BR-QEV-001-B` (Có 1 FAIL), `TC-BR-QEV-001-C` (Thiếu 1 chỉ tiêu -> PENDING).

---

### BR-QEV-002: Độc Quyền Thẩm Quyền Đánh Giá Của CanonicalStatusResolver (SSoT Authority)

- **Rule ID**: `BR-QEV-002`
- **Purpose**: Triệt tiêu hoàn toàn hiện tượng phân mảnh logic đánh giá. Chỉ DUY NHẤT `CanonicalStatusResolver.resolveBatchQuality` được quyền phán quyết chất lượng của Lô. Giao diện (UI), Service ngoài và AI TUYỆT ĐỐI KHÔNG được tự viết công thức tính riêng.
- **Actor**: Toàn bộ hệ thống mã nguồn (`ALL_COMPONENTS`).
- **Trigger**: Tại bất kỳ màn hình nào cần hiển thị trạng thái chất lượng của Lô (Batch List, Batch Detail, Batch 360, CoA).
- **Input**: `batch: Batch`, `testResults: TestResult[]`, `tccs: TCCS`.
- **Preconditions**: Đối tượng Lô tồn tại.
- **Decision Logic**:
  ```
  resolution = CanonicalStatusResolver.resolveBatchQuality(batch, testResults, tccs)
  UI.render(resolution.batchQualityStatus, resolution.completion)
  ```
- **Decision Table**:
  | Thành phần gọi | Được tự viết if-else tính PASS/FAIL | Bắt buộc gọi CanonicalStatusResolver |
  | :--- | :--- | :--- |
  | UI Component | CẤM TUYỆT ĐỐI | BẮT BUỘC 100% |
  | AI Assistant | CẤM TUYỆT ĐỐI | BẮT BUỘC 100% |
  | Report Generator | CẤM TUYỆT ĐỐI | BẮT BUỘC 100% (Đọc từ Snapshot) |
- **Output**: `BatchQualityResolutionResult`.
- **State Transition**: Không đổi trạng thái.
- **UI Behavior**: Hiển thị kết quả đồng nhất 100% giữa tất cả các màn hình trong ứng dụng.
- **Report / CoA Behavior**: Kết quả trên CoA khớp hoàn toàn với kết quả hiển thị trên bảng điều khiển QA.
- **Audit Requirement**: Ghi nhận phiên bản của Resolver (`resolverVersion`) vào bản ghi kiểm toán.
- **Forbidden Behavior**: Cấm viết các hàm local như `const isBatchPass = () => results.every(r => r.isPass)` trong component UI.
- **Exception Handling**: Nếu thiếu dữ liệu để resolve, trả về `INCOMPLETE` hoặc `INVALID`, không crash ứng dụng.
- **Test Cases**: `TC-BR-QEV-002-A` (Kiểm tra tính nhất quán kết quả giữa UI và Domain Engine).
