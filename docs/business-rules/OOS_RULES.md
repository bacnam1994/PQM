# PQM — BỘ QUY TẮC NGHIỆP VỤ: OOS RULES

# (QUY TẮC ĐIỀU TRA KẾT QUẢ NGOÀI TIÊU CHUẨN - OUT OF SPECIFICATION)

> **Mã tài liệu**: `BR-CATALOG-OOS`  
> **Thư mục**: `docs/business-rules/OOS_RULES.md`  
> **Phân hệ**: `MOD-10` (OOS Workflow)  
> **Tuân thủ**: US FDA Guidance for Industry: Investigating Out-of-Specification (OOS) Test Results for Pharmaceutical Production, GAMP 5

---

### BR-OOS-001: Kích Hoạt Tự Động Hồ Sơ Điều Tra OOS (Mandatory OOS Trigger)

- **Rule ID**: `BR-OOS-001`
- **Purpose**: Đảm bảo không có bất kỳ kết quả kiểm nghiệm nào vượt tiêu chuẩn bị bỏ qua hoặc bị ỉm đi mà không lập hồ sơ điều tra chính thức theo hướng dẫn của FDA.
- **Actor**: Hệ thống (`SYSTEM`), Kiểm nghiệm viên QC (`QC_ANALYST`).
- **Trigger**: Khi một chỉ tiêu kiểm nghiệm được xác nhận có kết quả `isPass === false` (FAIL) mà không thuộc diện miễn kiểm.
- **Input**: `testResultId: string`, `failedCriterion: CriterionEvaluationDetail`, `batchId: string`.
- **Preconditions**: Kết quả kiểm nghiệm đã được thẩm định bởi `QualityEvaluationEngine`.
- **Decision Logic**:
  ```
  IF (criterion.status == 'FAIL' AND NOT isExemptedByAlternateRule)
      THEN TỰ ĐỘNG TẠO HỒ SƠ OOS (GENERATE_OOS_RECORD)
      oos.status = 'PHASE_1_LAB_INVESTIGATION'
      oos.batchId = batchId
      oos.testResultId = testResultId
      oos.failedCriteria = [failedCriterion]
      oos.createdAt = now()
      batch.hasBlockingOOS = true
  ```
- **Decision Table**:
  | Trạng thái chỉ tiêu | Thuộc quy tắc thay thế | Kích hoạt OOS | Trạng thái hồ sơ OOS |
  | :--- | :--- | :--- | :--- |
  | `FAIL` | Không | CÓ (Bắt buộc) | `PHASE_1_LAB_INVESTIGATION` |
  | `FAIL` | Có (FAIL_RETRY đang chờ thử lại) | Tạm hoãn (Chờ phép thử phụ) | `PENDING_RETRY` |
  | `FAIL` | Có (Cả 2 phép thử đều FAIL) | CÓ (Bắt buộc) | `PHASE_1_LAB_INVESTIGATION` |
  | `PASS` | Bất kỳ | KHÔNG | Không áp dụng |
- **Output**: `oosId: string`, `batch.hasBlockingOOS: boolean`.
- **State Transition**: Lô sản xuất bị gắn cờ `hasBlockingOOS = true`, tự động chặn Release Gate.
- **UI Behavior**: Hiển thị Modal thông báo cảnh báo đỏ trên giao diện nhập kết quả: _"Phát hiện kết quả Ngoài Tiêu Chuẩn (OOS). Hồ sơ điều tra OOS #[Mã] đã được tự động khởi tạo. Lô bị khóa xuất xưởng cho đến khi có kết luận điều tra."_
- **Report / CoA Behavior**: Cấm tuyệt đối xuất CoA khi có hồ sơ OOS đang mở (`OPEN`).
- **Audit Requirement**: Bắt buộc ghi log sự kiện `TRIGGER_OOS_INVESTIGATION` vào `audit_logs` với mã băm toàn vẹn.
- **Forbidden Behavior**: Tuyệt đối cấm xóa kết quả FAIL hoặc nhập đè kết quả PASS mà không qua quy trình điều tra OOS (Nghiêm cấm hành vi Testing into Compliance).
- **Exception Handling**: Nếu hệ thống gặp lỗi khi tạo bản ghi OOS, hủy bỏ thao tác lưu kết quả kiểm nghiệm để bảo toàn dữ liệu.
- **Test Cases**: `TC-BR-OOS-001-A` (Chỉ tiêu FAIL tự động tạo OOS), `TC-BR-OOS-001-B` (Chỉ tiêu PASS không kích hoạt OOS).

---

### BR-OOS-002: Điều Tra 2 Giai Đoạn & Chống Thử Nghiệm Cho Đến Khi Đạt (Two-Phase Investigation & Anti-Testing into Compliance)

- **Rule ID**: `BR-OOS-002`
- **Purpose**: Tuân thủ quy trình điều tra khoa học 2 giai đoạn của FDA: Giai đoạn 1 (Điều tra phòng thí nghiệm) phải kết luận rõ có lỗi Lab hay không trước khi mở Giai đoạn 2 (Điều tra dây chuyền sản xuất). Nghiêm cấm lấy mẫu thử lại tùy tiện cho đến khi có kết quả đạt.
- **Actor**: Trưởng phòng QC (`QC_MANAGER`), Trưởng phòng QA (`QA_MANAGER`).
- **Trigger**: Khi cập nhật tiến độ điều tra OOS (`SC-16`).
- **Input**: `oosId: string`, `phase1Findings: LabInvestigationFindings`.
- **Preconditions**: Hồ sơ OOS đang ở trạng thái `PHASE_1_LAB_INVESTIGATION`.
- **Decision Logic**:
  ```
  IF (phase1Findings.isLabErrorProven == true)
      // Lỗi rõ ràng do thiết bị hỏng, hóa chất hết hạn, pha chuẩn sai
      oos.conclusion = 'ASSIGNABLE_CAUSE_LAB_ERROR'
      oos.canInvalidateOriginalTest = true
      oos.status = 'APPROVED_FOR_RETEST'
  ELSE
      // Không chứng minh được lỗi phòng Lab
      oos.conclusion = 'NO_LAB_ERROR_FOUND'
      oos.canInvalidateOriginalTest = false
      oos.status = 'PHASE_2_MANUFACTURING_INVESTIGATION' // BẮT BUỘC ĐIỀU TRA XƯỞNG
  ```
- **Decision Table**:
  | Kết quả thẩm tra Lab | Có bằng chứng lỗi Lab | Hủy kết quả gốc? | Bước tiếp theo |
  | :--- | :--- | :--- | :--- |
  | Chứng minh có lỗi (hỏng cột HPLC, bọt khí) | Có (văn bản + ảnh chứng minh) | Cho phép (hủy hợp lệ) | Cho phép thử nghiệm lại có kiểm soát |
  | Nghi vấn / Không tìm ra lỗi Lab | Không | CẤM HỦY | Chuyển sang Điều tra Sản xuất (Phase 2) |
- **Output**: `oos.status: 'APPROVED_FOR_RETEST' | 'PHASE_2_MANUFACTURING_INVESTIGATION'`.
- **State Transition**: Chuyển giai đoạn điều tra OOS.
- **UI Behavior**: Form điều tra yêu cầu đính kèm bằng chứng cụ thể (ảnh chụp, file log thiết bị) nếu chọn "Nguyên nhân do lỗi phòng Lab". Nếu không có bằng chứng, hệ thống khóa không cho chọn kết luận này.
- **Report / CoA Behavior**: Kết quả OOS ban đầu luôn được lưu lại trong hồ sơ kiểm toán lịch sử, không bao giờ bị xóa trắng.
- **Audit Requirement**: Ghi log `CONCLUDE_OOS_PHASE_1` kèm chữ ký số của Trưởng phòng QC và QA.
- **Forbidden Behavior**: Tuyệt đối cấm kết luận "Lỗi thao tác kiểm nghiệm viên" chung chung mà không có bằng chứng khoa học chứng minh.
- **Exception Handling**: Nếu QA từ chối kết luận của QC, hồ sơ OOS bị trả về yêu cầu điều tra lại.
- **Test Cases**: `TC-BR-OOS-002-A` (Lỗi Lab có bằng chứng), `TC-BR-OOS-002-B` (Không có lỗi Lab chuyển Phase 2).
