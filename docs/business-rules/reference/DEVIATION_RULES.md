# PQM — BỘ QUY TẮC NGHIỆP VỤ: DEVIATION RULES

# (QUY TẮC XỬ LÝ SAI LỆCH SẢN XUẤT & KIỂM NGHIỆM)

> **Mã tài liệu**: `BR-CATALOG-DEVIATION`  
> **Thư mục**: `docs/business-rules/DEVIATION_RULES.md`  
> **Phân hệ**: `MOD-11` (Deviation Workflow)  
> **Tuân thủ**: GAMP 5, PIC/S GMP Guide, US FDA 21 CFR Part 211

---

### BR-DEV-001: Phân Loại Mức Độ Nghiêm Trọng Của Sai Lệch (Deviation Severity Classification)

- **Rule ID**: `BR-DEV-001`
- **Purpose**: Đảm bảo mọi sự cố hoặc sai lệch trong quá trình sản xuất/kiểm nghiệm được phân loại rủi ro chính xác (`CRITICAL`, `MAJOR`, `MINOR`) làm cơ sở cho việc chặn xuất xưởng Lô.
- **Actor**: QA Giám sát (`QA_OFFICER`), Người phát hiện sự cố.
- **Trigger**: Khi ghi nhận sự cố bất thường tại xưởng hoặc phòng kiểm nghiệm (`SC-17`).
- **Input**: `deviation.title: string`, `deviation.description: string`, `deviation.impactAssessment: string`.
- **Preconditions**: Người dùng đăng nhập có quyền ghi nhận sai lệch.
- **Decision Logic**:
  ```
  IF (Ảnh hưởng trực tiếp đến tính an toàn, hiệu lực, chất lượng thuốc hoặc tính mạng người dùng)
      THEN severity = 'CRITICAL'
      Tự động khóa Lô: batch.status = 'BLOCKED'
  ELSE IF (Ảnh hưởng đến chỉ tiêu chất lượng không then chốt hoặc thông số quy trình quan trọng)
      THEN severity = 'MAJOR'
      Chặn xuất xưởng Lô: batch.hasOpenMajorDeviation = true
  ELSE
      severity = 'MINOR' // Sai sót thủ tục, không ảnh hưởng chất lượng
  ```
- **Decision Table**:
  | Tính chất sự cố | Mức độ nghiêm trọng | Tác động lên Lô | Ảnh hưởng Release Gate |
  | :--- | :--- | :--- | :--- |
  | Nhiệt độ sấy vượt ngưỡng phá hủy hoạt chất | `CRITICAL` | Khóa Lô (`BLOCKED`) | Chặn cứng xuất xưởng |
  | Hỏng cân trong công đoạn định lượng | `MAJOR` | Tạm giữ (`HOLD`) | Chặn xuất xưởng cho đến khi xử lý xong |
  | Ghi nhầm ngày viết nhật ký thao tác | `MINOR` | Không khóa | Cho phép xuất xưởng nếu đã đính chính |
- **Output**: `deviation.severity: 'CRITICAL' | 'MAJOR' | 'MINOR'`.
- **State Transition**: Nếu `CRITICAL`, Lô chuyển sang `BLOCKED`.
- **UI Behavior**: Badge sai lệch hiển thị màu tương ứng: `CRITICAL` (Đỏ sẫm), `MAJOR` (Cam), `MINOR` (Vàng). Lô bị khóa có icon ổ khóa màu tím.
- **Report / CoA Behavior**: Thông tin mã sai lệch hiển thị trong Hồ sơ 360° của Lô.
- **Audit Requirement**: Bắt buộc ghi nhận log `LOG_DEVIATION` kèm mức độ nghiêm trọng.
- **Forbidden Behavior**: Cấm tự ý hạ cấp từ `CRITICAL` xuống `MINOR` để dễ dàng duyệt xuất xưởng Lô.
- **Exception Handling**: Việc thay đổi mức độ nghiêm trọng bắt buộc phải có phê duyệt và giải trình văn bản của Giám đốc QA.
- **Test Cases**: `TC-BR-DEV-001-A` (Sai lệch CRITICAL tự động khóa Lô), `TC-BR-DEV-001-B` (Sai lệch MINOR không khóa Lô).

---

### BR-DEV-002: Rào Chắn Đóng Sai Lệch Trước Khi Xuất Xưởng (No Open Deviations at Release Gate)

- **Rule ID**: `BR-DEV-002`
- **Purpose**: Đảm bảo không một Lô sản xuất nào được phép xuất xưởng ra thị trường khi vẫn còn hồ sơ sai lệch chưa được điều tra và đóng chính thức (`status !== 'CLOSED'`).
- **Actor**: QA Xuất xưởng (`QA_RELEASE_OFFICER`), Hệ thống Release Gate.
- **Trigger**: Khi QA thực hiện thẩm định điều kiện xuất xưởng Lô (`SC-14` / `SC-10`).
- **Input**: `batchId: string`.
- **Preconditions**: Lô đang ở trạng thái `TESTING` hoặc `APPROVED`.
- **Decision Logic**:
  ```
  openDeviations = deviationRepository.findOpenByBatch(batchId)
  IF (openDeviations.length > 0)
      hasCriticalOrMajor = openDeviations.some(d => d.severity IN ['CRITICAL', 'MAJOR'])
      IF (hasCriticalOrMajor)
          THEN REJECT_RELEASE "Còn tồn tại sai lệch nghiêm trọng chưa đóng"
          canRelease = false
      ELSE IF (openDeviations.every(d => d.severity == 'MINOR' AND d.dispositionApproved == true))
          THEN ALLOW_RELEASE_WITH_JUSTIFICATION
  ELSE
      ALLOW_RELEASE
  ```
- **Decision Table**:
  | Số sai lệch mở | Mức độ nghiêm trọng cao nhất | Phê duyệt xử lý sơ bộ | Đủ điều kiện xuất xưởng? |
  | :--- | :--- | :--- | :--- |
  | ≥ 1 | `CRITICAL` | Bất kỳ | KHÔNG (Chặn tuyệt đối) |
  | ≥ 1 | `MAJOR` | Chưa duyệt | KHÔNG (Chặn tuyệt đối) |
  | ≥ 1 | `MINOR` | Đã có phê duyệt QA | CÓ (Yêu cầu ghi chú lý do) |
  | 0 | Không có | Không áp dụng | CÓ |
- **Output**: `canRelease: boolean`, `blockingDeviations: Deviation[]`.
- **State Transition**: Nếu vi phạm, cấm chuyển trạng thái Lô sang `RELEASED`.
- **UI Behavior**: Nút "Ký xuất xưởng" bị vô hiệu hóa, hiển thị danh sách các sai lệch đang mở cần xử lý trong bảng checklist điều kiện xuất xưởng.
- **Report / CoA Behavior**: Không xuất CoA khi Release Gate bị chặn bởi sai lệch.
- **Audit Requirement**: Ghi nhận kiểm tra sai lệch trong biên bản thẩm định xuất xưởng điện tử.
- **Forbidden Behavior**: Cấm đóng khống sai lệch khi chưa hoàn thành hành động khắc phục tức thời.
- **Exception Handling**: Khi có yêu cầu xuất hàng đặc biệt, bắt buộc có quyết định của Hội đồng Chất lượng.
- **Test Cases**: `TC-BR-DEV-002-A` (Chặn xuất xưởng khi có sai lệch CRITICAL mở).
