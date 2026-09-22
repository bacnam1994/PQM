# REPORTING_RULES: Danh Mục Quy Tắc Báo Cáo Chất Lượng & Phân Tích Xu Hướng (Reporting & Trend Analysis Rules)

Tài liệu này chuẩn hóa toàn bộ các quy tắc nghiệp vụ về Báo cáo Đánh giá Chất lượng Sản phẩm Định kỳ (PQR - Periodic Quality Review / APQR - Annual Product Quality Review) và Phân tích Xu hướng Thống kê Kiểm soát Quá trình (SPC - Statistical Process Control) theo tiêu chuẩn Dược điển và ICH Q10.

---

## 1. BR-REP-001: Quy Chuẩn Báo Cáo Đánh Giá Chất Lượng Định Kỳ (PQR / APQR Compliance Rule)

- **Rule ID**: `BR-REP-001`
- **Purpose**: Đảm bảo báo cáo PQR được tổng hợp tự động, chính xác từ dữ liệu thực tế của toàn bộ các lô sản xuất trong kỳ đánh giá, không bỏ sót bất kỳ lô nào (kể cả lô bị loại bỏ hoặc thu hồi), phục vụ đánh giá năng lực quy trình sản xuất và chất lượng sản phẩm định kỳ hàng năm.
- **Actor**: `QA_Specialist` (Người khởi tạo báo cáo), `QA_Manager` (Người duyệt báo cáo).
- **Trigger**: Định kỳ hàng năm, hàng quý hoặc theo yêu cầu thanh tra GMP.
- **Input**:
  - `productId`: Mã sản phẩm đánh giá.
  - `startDate`, `endDate`: Khoảng thời gian đánh giá (thông thường 12 tháng).
  - `includeRejected`: Bắt buộc là `true` (Không được loại trừ các lô hỏng/bị từ chối).
- **Preconditions**: Sản phẩm có phát sinh ít nhất 1 lô sản xuất trong khoảng thời gian được chỉ định.
- **Decision Logic**:
  - Báo cáo PQR bắt buộc phải tự động tổng hợp đầy đủ các phần cốt lõi sau:
    1. **Tổng quan sản lượng và lô**: Tổng số lô bắt đầu sản xuất, số lô xuất xưởng (`RELEASED`), số lô bị từ chối (`REJECTED`), số lô đang bảo lưu (`HOLD`).
    2. **Kiểm soát chất lượng (QC Testing Data)**: Toàn bộ dữ liệu kiểm nghiệm của các chỉ tiêu trọng yếu (Hàm lượng hoạt chất, Độ hòa tan, Độ rã, Tạp chất liên quan, pH, v.v.) của toàn bộ các lô.
    3. **Tính toán Năng lực Quy trình (Process Capability Metrics)**:
       - Độ lệch chuẩn ($\sigma$), Giá trị trung bình ($\bar{X}$).
       - Chỉ số năng lực quy trình tiềm năng $C_p = \frac{USL - LSL}{6\sigma}$.
       - Chỉ số năng lực quy trình thực tế $C_{pk} = \min\left(\frac{USL - \bar{X}}{3\sigma}, \frac{\bar{X} - LSL}{3\sigma}\right)$.
    4. **Tổng hợp Sự cố Chất lượng**:
       - Số lượng OOS phát sinh và tỷ lệ OOS do nguyên nhân phòng kiểm nghiệm vs nguyên nhân sản xuất.
       - Số lượng Sai lệch (Deviations) phân loại theo Mức độ nghiêm trọng (Minor, Major, Critical).
       - Số lượng Khiếu nại chất lượng từ thị trường và việc thu hồi sản phẩm (nếu có).
    5. **Đánh giá CAPA & Thay đổi (Change Controls)**: Tình trạng triển khai các hành động khắc phục và các thay đổi công thức/quy trình/tiêu chuẩn trong kỳ.
- **Decision Table**:

| Chỉ số $C_{pk}$          | Đánh giá năng lực quy trình                           | Khuyến nghị hành động hệ thống                                      |
| :----------------------- | :---------------------------------------------------- | :------------------------------------------------------------------ |
| $C_{pk} \ge 1.33$        | Quy trình năng lực tốt (Capable & Stable)             | Duy trì kiểm soát bình thường                                       |
| $1.00 \le C_{pk} < 1.33$ | Quy trình đạt mức chấp nhận được nhưng tiềm ẩn rủi ro | Cảnh báo: Đề xuất siết chặt giới hạn cảnh báo nội bộ (Alert Limits) |
| $C_{pk} < 1.00$          | Quy trình không đủ năng lực (Incapable)               | **BÁO ĐỘNG ĐỎ**: Bắt buộc mở CAPA cải tiến quy trình                |

- **Output**:
  - Báo cáo PQR điện tử hoàn chỉnh kèm biểu đồ phân phối chuẩn (Gaussian distribution) và thẻ chỉ số thống kê.
- **State Transition**: `DRAFT` -> `UNDER_REVIEW` -> `APPROVED`.
- **UI Behavior**:
  - Giao diện Dashboard trực quan hiển thị thẻ tổng hợp KPI chất lượng, biểu đồ đường trend theo thời gian, và biểu đồ cột so sánh sai lệch.
  - Cho phép xuất file PDF/Excel định dạng chuẩn mẫu GMP có logo và chữ ký số.
- **Report / CoA Behavior**: PQR độc lập với CoA nhưng là căn cứ quan sát tổng thể chất lượng của tất cả CoA đã phát hành.
- **Audit Requirement**: Lưu vết ngày tạo báo cáo, người tổng hợp, các tham số đầu vào và phiên bản dữ liệu được snapshot tại thời điểm kết xuất.
- **Forbidden Behavior**: Tuyệt đối cấm tính năng "loại bỏ lô bất thường" (cherry-picking / outlier removal) ra khỏi tính toán PQR mà không có biên bản giải trình khoa học được QA phê duyệt.
- **Exception Handling**: Nếu số lượng lô nhỏ hơn 10 lô/năm (sản phẩm ít sản xuất), hệ thống phải gắn nhãn cảnh báo "Mẫu số nhỏ - Chỉ số Cpk chỉ mang tính tham khảo thống kê".
- **Test Cases**:
  - `TC-REP-001-A`: Tổng hợp PQR cho sản phẩm có lô bị Rejected phải bao gồm cả lô Rejected trong bảng tổng hợp, không được làm tròn số.
  - `TC-REP-001-B`: Công thức tính toán $C_{pk}$ trả về kết quả chính xác theo chuẩn thống kê.

---

## 2. BR-REP-002: Kiểm Soát Quá Trình Bằng Thống Kê & Phát Hiện Xu Hướng Bất Thường (SPC Trend Analysis Rule)

- **Rule ID**: `BR-REP-002`
- **Purpose**: Tự động phát hiện các xu hướng bất thường, trôi dạt dữ liệu (trend / drift) trong kết quả kiểm nghiệm trước khi sản phẩm thực sự vượt ngưỡng OOS, áp dụng quy tắc kiểm soát thống kê phương Tây (Western Electric / Nelson Rules).
- **Actor**: `System` (Tự động phân tích khi có kết quả mới).
- **Trigger**: Khi một kết quả kiểm nghiệm định lượng trọng yếu được phê duyệt.
- **Input**:
  - `criterionCode`: Mã chỉ tiêu định lượng (ví dụ: Hàm lượng `ASSAY`, Tạp chất `IMP_TOTAL`).
  - `historicalResults[]`: Chuỗi kết quả theo thời gian của tối thiểu 10 lô gần nhất.
  - `newResultValue`: Giá trị kết quả kiểm nghiệm mới nhất.
- **Preconditions**: Chỉ áp dụng cho các chỉ tiêu có kiểu dữ liệu là Số thực (Numeric).
- **Decision Logic**:
  - Tính toán Giới hạn Kiểm soát Thống kê (Action Limits / Warning Limits) dựa trên dữ liệu lịch sử:
    - $\bar{X}$ (Giá trị trung bình), $\sigma$ (Độ lệch chuẩn).
    - $UWL$ (Upper Warning Limit) $= \bar{X} + 2\sigma$, $LWL$ (Lower Warning Limit) $= \bar{X} - 2\sigma$.
    - $UCL$ (Upper Control Limit) $= \bar{X} + 3\sigma$, $LCL$ (Lower Control Limit) $= \bar{X} - 3\sigma$.
  - Áp dụng 3 quy tắc cảnh báo xu hướng (Nelson / Western Electric Rules):
    1. **Rule 1 (Out of Control Limit)**: 1 điểm nằm ngoài vùng $3\sigma$ ($> UCL$ hoặc $< LCL$).
    2. **Rule 2 (Run of 7 / Trend)**: 7 điểm liên tiếp liên tục tăng dần hoặc 7 điểm liên tiếp liên tục giảm dần (Trôi dạt quy trình).
    3. **Rule 3 (Bias / Shift)**: 8 điểm liên tiếp cùng nằm về một phía so với đường trung bình $\bar{X}$ (Dịch chuyển tâm quy trình).
- **Decision Table**:

| Tình trạng dữ liệu điểm đo      | Quy tắc vi phạm    | Đánh giá trạng thái xu hướng                 | Hành động hệ thống                                   |
| :------------------------------ | :----------------- | :------------------------------------------- | :--------------------------------------------------- |
| Nằm trong khoảng $\pm 2\sigma$  | Không vi phạm      | Ổn định (`NORMAL`)                           | Lưu trữ bình thường                                  |
| Nằm giữa $2\sigma$ và $3\sigma$ | Vượt Warning Limit | Cảnh báo sớm (`WARNING_TREND`)               | Gửi thông báo cho QA giám sát                        |
| Vượt ngưỡng $\pm 3\sigma$       | Rule 1             | Mất kiểm soát (`OUT_OF_STATISTICAL_CONTROL`) | Kích hoạt cảnh báo OOT (Out of Trend)                |
| 7 điểm tăng/giảm liên tiếp      | Rule 2             | Trôi dạt (`DRIFT_DETECTED`)                  | Kích hoạt cảnh báo OOT, khuyến nghị rà soát thiết bị |

- **Output**:
  - Đối tượng cảnh báo `TrendAlert`: `severity` (`LOW`, `MEDIUM`, `HIGH`), `violatedRule`, `affectedBatches[]`.
- **State Transition**: Không áp dụng.
- **UI Behavior**:
  - Vẽ biểu đồ Kiểm soát chất lượng (Shewhart Control Chart) dạng tương tác với các đường LSL, USL, LCL, UCL, LWL, UWL.
  - Điểm vi phạm cảnh báo được đánh dấu chấm tròn đỏ nhấp nháy trên biểu đồ kèm popup giải thích chi tiết quy tắc vi phạm.
- **Report / CoA Behavior**: Không ảnh hưởng trực tiếp đến CoA của lô đạt tiêu chuẩn, nhưng được lưu vào Hồ sơ Đánh giá Xu hướng Lô.
- **Audit Requirement**: Mọi cảnh báo OOT (Out of Trend) được lưu lại và yêu cầu QA xác nhận đã xem xét (Acknowledge).
- **Forbidden Behavior**: Tuyệt đối cấm xóa cảnh báo OOT mà không có ghi chú giải trình lý do từ chối cảnh báo.
- **Exception Handling**: Nếu chuỗi dữ liệu chưa đủ 10 lô, chỉ hiển thị biểu đồ phân tán mà không kích hoạt các quy tắc Nelson.
- **Test Cases**:
  - `TC-REP-002-A`: Phát hiện chính xác cảnh báo Shift khi có 8 lô liên tiếp nằm trên đường trung bình.
  - `TC-REP-002-B`: Phát hiện cảnh báo OOT khi 1 giá trị nằm ngoài vùng $3\sigma$ dù vẫn nằm trong khoảng chỉ tiêu TCCS.
