# PQM — BỘ QUY TẮC NGHIỆP VỤ: CAPA RULES

# (QUY TẮC HÀNH ĐỘNG KHẮC PHỤC & PHÒNG NGỪA)

> **Mã tài liệu**: `BR-CATALOG-CAPA`  
> **Thư mục**: `docs/business-rules/CAPA_RULES.md`  
> **Phân hệ**: `MOD-12` (CAPA Workflow)  
> **Tuân thủ**: GAMP 5, ISO 9001:2015, US FDA 21 CFR Part 820 / 211

---

### BR-CAP-001: Bắt Buộc Khởi Tạo CAPA Cho Sự Cố Tái Diễn Hoặc Nghiêm Trọng (Mandatory CAPA Trigger)

- **Rule ID**: `BR-CAP-001`
- **Purpose**: Đảm bảo các sai lệch nghiêm trọng hoặc các sự cố chất lượng có tính chu kỳ/tái diễn nhiều lần phải được điều tra nguyên nhân gốc rễ (Root Cause Analysis) và lập kế hoạch hành động khắc phục phòng ngừa dài hạn.
- **Actor**: Trưởng ban Đảm bảo Chất lượng (`QA_MANAGER`).
- **Trigger**: Khi đóng hồ sơ OOS hoặc khi một sai lệch được phân loại là `CRITICAL` hoặc có tính tái diễn (`isRecurrent === true`).
- **Input**: `sourceType: 'OOS' | 'DEVIATION' | 'AUDIT'`, `sourceId: string`.
- **Preconditions**: Hồ sơ nguồn đã được xác minh tính hợp lệ.
- **Decision Logic**:
  ```
  IF (source.severity == 'CRITICAL' OR source.isRecurrent == true)
      THEN BẮT BUỘC KHỞI TẠO CAPA (TRIGGER_MANDATORY_CAPA)
      capa.status = 'ROOT_CAUSE_ANALYSIS'
      capa.dueDate = now() + 30_DAYS
  ELSE
      CAPA là tùy chọn (OPTIONAL) dựa trên đánh giá rủi ro của QA
  ```
- **Decision Table**:
  | Nguồn phát sinh | Mức độ nghiêm trọng | Tính tái diễn | Bắt buộc CAPA? |
  | :--- | :--- | :--- | :--- |
  | Sai lệch (Deviation) | `CRITICAL` | Bất kỳ | CÓ (Bắt buộc 100%) |
  | Sai lệch (Deviation) | `MAJOR` | Tái diễn ≥ 2 lần/năm | CÓ (Bắt buộc) |
  | OOS xác nhận | Sản xuất | Bất kỳ | CÓ (Bắt buộc) |
  | Sai lệch (Deviation) | `MINOR` | Đơn lẻ | Không (Tùy chọn) |
- **Output**: `capaId: string`, `isCAPAMandatory: boolean`.
- **State Transition**: Khởi tạo CAPA ở trạng thái `DRAFT` ➔ `ROOT_CAUSE_ANALYSIS`.
- **UI Behavior**: Khi đóng Deviation nghiêm trọng, màn hình tự động hiển thị nút liên kết "Lập kế hoạch CAPA liên kết" và đánh dấu cảnh báo nếu chưa lập.
- **Report / CoA Behavior**: Mã CAPA hiển thị trong báo cáo thẩm định chất lượng định kỳ PQR.
- **Audit Requirement**: Ghi log `CREATE_CAPA_PLAN` liên kết chặt chẽ với mã sự cố nguồn.
- **Forbidden Behavior**: Cấm đóng hồ sơ sai lệch nghiêm trọng mà không giải trình lý do tại sao không lập CAPA.
- **Exception Handling**: Nếu không hoàn thành phân tích nguyên nhân gốc rễ trong vòng 30 ngày, hệ thống tự động gửi cảnh báo quá hạn tới Giám đốc Nhà máy.
- **Test Cases**: `TC-BR-CAP-001-A` (Sai lệch CRITICAL bắt buộc CAPA), `TC-BR-CAP-001-B` (Sai lệch MINOR không ép CAPA).

---

### BR-CAP-002: Đánh Giá Hiệu Quả Trước Khi Đóng CAPA (Effectiveness Verification Before Closure)

- **Rule ID**: `BR-CAP-002`
- **Purpose**: Đảm bảo CAPA không bị đóng chỉ vì "đã hoàn thành các hành động trên giấy", mà bắt buộc phải có thời gian theo dõi thực tế và đánh giá hiệu quả (Effectiveness Check) chứng minh sự cố không còn tái diễn.
- **Actor**: QA Thẩm định hiệu quả (`QA_EFFECTIVENESS_LEAD`).
- **Trigger**: Khi bấm nút "Đóng CAPA" tại `SC-18`.
- **Input**: `capaId: string`, `verificationEvidence: EffectivenessReport`.
- **Preconditions**: Toàn bộ các hành động khắc phục/phòng ngừa con (`ActionItems`) đã hoàn thành 100%.
- **Decision Logic**:
  ```
  IF (capa.actionItems.some(item => item.status != 'COMPLETED'))
      THEN REJECT "Còn hành động khắc phục chưa hoàn thành"
  IF (capa.effectivenessCheck.isConducted != true)
      THEN REJECT "Chưa tiến hành đánh giá hiệu quả sau can thiệp"
  IF (capa.effectivenessCheck.hasRecurrence == true)
      THEN REJECT "Sự cố vẫn tái diễn, CAPA không đạt hiệu quả"
      Yêu cầu: Phân tích lại nguyên nhân gốc rễ
  ELSE
      capa.status = 'CLOSED'
  ```
- **Decision Table**:
  | Các hành động con | Đã kiểm tra hiệu quả thực tế | Sự cố có tái diễn không? | Quyết định đóng CAPA |
  | :--- | :--- | :--- | :--- |
  | Chưa xong hết | Chưa | Không áp dụng | Từ chối (`ACTIONS_INCOMPLETE`) |
  | Xong 100% | Chưa | Không áp dụng | Từ chối (`MISSING_EFFECTIVENESS_CHECK`) |
  | Xong 100% | Đã kiểm tra (sau 3 tháng) | CÓ tái diễn | Từ chối (`CAPA_INEFFECTIVE` - Mở lại điều tra) |
  | Xong 100% | Đã kiểm tra | KHÔNG tái diễn | Chấp thuận ĐÓNG (`CLOSED`) |
- **Output**: `isClosed: boolean`, `capa.status: 'CLOSED' | 'INEFFECTIVE'`.
- **State Transition**: `MONITORING -> CLOSED` HOẶC `MONITORING -> INEFFECTIVE`.
- **UI Behavior**: Nút "Đóng CAPA" bị khóa và chuyển màu xám nếu chưa đính kèm báo cáo đánh giá hiệu quả.
- **Report / CoA Behavior**: Thống kê tỷ lệ CAPA hiệu quả trong báo cáo Quản trị.
- **Audit Requirement**: Bắt buộc ghi log `CLOSE_CAPA` kèm chữ ký số thẩm định hiệu quả.
- **Forbidden Behavior**: Tuyệt đối cấm đóng CAPA ngay trong ngày hoàn thành hành động khắc phục mà không có giai đoạn quan sát thực tế (Monitoring Phase).
- **Exception Handling**: Nếu hết hạn theo dõi mà chưa có dữ liệu đánh giá, hệ thống đưa vào danh sách cảnh báo trễ hạn.
- **Test Cases**: `TC-BR-CAP-002-A` (Chặn đóng CAPA khi chưa kiểm tra hiệu quả), `TC-BR-CAP-002-B` (Đóng hợp lệ khi không tái diễn).
