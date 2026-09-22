# ACCEPTANCE_CRITERIA_MASTER: Tiêu Chí Chấp Nhận Nghiệm Thu BDD Gherkin Toàn Diện PQM

Tài liệu này là Bộ Tiêu Chí Chấp Nhận Nghiệm Thu Chính Thức (Official Acceptance Criteria / Test Specifications) được viết theo cú pháp BDD Gherkin chuẩn mực (`Feature`, `Scenario`, `Given`, `When`, `Then`, `And`), là hợp đồng kiểm thử ràng buộc giữa nghiệp vụ Dược phẩm và toàn bộ mã nguồn kiểm thử tự động (Automated Unit, Integration & E2E Tests).

---

## 1. PHẦN 1: MASTER DATA, PRODUCT, TCCS, FORMULA & RAW MATERIAL (Task 7.01)

```gherkin
Feature: Quản lý Dữ liệu Nền, Sản phẩm, TCCS, Công thức và Nguyên liệu

  Background:
    Given Hệ thống PQM đang hoạt động bình thường
    And Người dùng quản trị chất lượng "QA_MANAGER" đã xác thực danh tính

  # --- MASTER DATA ---
  Scenario: Ngăn chặn tạo mã danh mục trùng lặp
    Given Danh mục "Đơn vị đo" đã tồn tại mã "MG" (Milligram)
    When Người dùng cố gắng tạo thêm đơn vị đo mới với mã "mg" hoặc "MG"
    Then Hệ thống từ chối yêu cầu và trả về mã lỗi "ERR_MST_DUPLICATE_CODE"
    And Không có bản ghi mới nào được lưu vào cơ sở dữ liệu

  # --- PRODUCT ---
  Scenario: Khóa bất biến thông tin kỹ thuật sản phẩm sau khi đã ban hành Lô
    Given Sản phẩm "PRD-PARA500" đã có ít nhất một Lô sản xuất ở trạng thái "RELEASED"
    When Quản đốc sản xuất cố gắng sửa trực tiếp hạn dùng từ "36 tháng" thành "24 tháng" trên màn hình sản phẩm
    Then Hệ thống khóa trường thông tin này và hiển thị thông báo "Yêu cầu mở quy trình Change Control"
    And Bản ghi sản phẩm giữ nguyên giá trị 36 tháng

  # --- TCCS ---
  Scenario: Chụp Snapshot bất biến của TCCS khi tạo Lô sản xuất
    Given Sản phẩm "PRD-AMOX500" có bản TCCS "TCCS-AMOX-01" phiên bản 1 đang có hiệu lực
    When Người dùng tạo Lô "BAT-AMOX-001"
    Then Hồ sơ Lô được lưu kèm Snapshot nguyên vẹn của TCCS bản 1
    When R&D ban hành TCCS bản 2 với chỉ tiêu độ hòa tan siết chặt hơn
    Then Lô "BAT-AMOX-001" vẫn giữ nguyên Snapshot bản 1 và không bị áp dụng tiêu chuẩn của bản 2

  # --- FORMULA ---
  Scenario: Kiểm tra cân bằng định mức nguyên liệu công thức 100%
    Given Người dùng soạn thảo công thức viên nén Paracetamol 500mg
    When Tổng phần trăm các nguyên liệu nhập vào chỉ đạt 92%
    Then Hệ thống đánh dấu cảnh báo màu đỏ "Tổng tỷ lệ công thức chưa đủ 100%"
    And Nút "Gửi phê duyệt công thức" bị vô hiệu hóa

  # --- RAW MATERIAL ---
  Scenario: Chặn xuất kho nguyên liệu chưa qua kiểm nghiệm (Quarantine Guard)
    Given Lô hoạt chất "Paracetamol API" số lô nội bộ "RM-LOT-001" đang có trạng thái "QUARANTINE"
    When Phân xưởng sản xuất tạo phiếu yêu cầu xuất 100kg cho Lô sản xuất "BAT-001"
    Then Hệ thống từ chối cấp phát với lỗi "ERR_MAT_NOT_PASSED"
    And Số lượng tồn kho thực tế của lô nguyên liệu không thay đổi
```

---

## 2. PHẦN 2: BATCH, PKN, EVALUATION ENGINE & ALTERNATE RULES (Task 7.02)

```gherkin
Feature: Quản lý Lô, Phiếu Kiểm Nghiệm, Động Cơ Đánh Giá và Quy Tắc Thay Thế

  # --- BATCH ---
  Scenario: Tính toán tỷ lệ hoàn thành kiểm nghiệm độc lập với trạng thái Lô
    Given Lô "BAT-001" có trạng thái tác nghiệp trong DB là "TESTING"
    And Lô có tổng cộng 10 chỉ tiêu bắt buộc theo TCCS
    When Kỹ thuật viên hoàn tất 5 chỉ tiêu Đạt và 5 chỉ tiêu chưa kiểm
    Then Thuật toán "CanonicalStatusResolver.resolveBatchQuality" trả về tiến độ 50%
    And Trạng thái chất lượng tổng thể là "PENDING"
    And UI hiển thị nhãn màu vàng "Đang kiểm nghiệm (50%)" cạnh chữ TESTING

  # --- PKN & EDITOR ---
  Scenario: Hiển thị 100% chỉ tiêu từ Snapshot và khóa phiếu khi Submit
    Given Phiếu kiểm nghiệm của Lô "BAT-001" được mở trên giao diện PKN Editor
    Then Bảng hiển thị đầy đủ 10/10 chỉ tiêu theo Snapshot TCCS, không bị lọc ẩn
    When Kỹ thuật viên nhập đủ 10 kết quả và bấm "Nộp kết quả thẩm định"
    Then Trạng thái phiếu chuyển sang "SUBMITTED"
    And Toàn bộ các ô nhập dữ liệu của Kỹ thuật viên bị khóa dạng chỉ đọc (Read-only)

  # --- EVALUATION ENGINE (NO IMPLICIT PASS) ---
  Scenario: Không bao giờ ngầm định Pass khi chưa làm kiểm nghiệm
    Given Lô mới tạo "BAT-002" có 8 chỉ tiêu bắt buộc và chưa có kết quả nào
    When Hệ thống chạy tính toán chất lượng chuẩn tắc
    Then Kết quả trả về canonicalQualityStatus là "PENDING" (hoặc "NOT_EVALUATED")
    And Tuyệt đối không được trả về "PASS"

  # --- ALTERNATE RULES ---
  Scenario: Tự động giải cứu chỉ tiêu rớt lần 1 bằng phép thử lần 2 mở rộng (FAIL_RETRY)
    Given Chỉ tiêu "Độ tan rã lần 1" có kết quả không đạt ("FAIL")
    And Có quy tắc "ALT-DIS-01" cho phép thử lại lần 2 với cỡ mẫu 12 viên
    When Kỹ thuật viên nhập kết quả thử nghiệm lần 2 đạt chuẩn ("PASS")
    Then Trạng thái quy tắc chuyển sang "TRIGGERED_PASS"
    And Chỉ tiêu Độ tan rã được công nhận là "PASS"
    And CoA tự động sinh chú thích chân trang: "(*) Đạt sau khi thử nghiệm mở rộng"

  Scenario: Miễn kiểm nghiệm chỉ tiêu phụ khi chỉ tiêu chính an toàn (CONDITIONAL_CHECK)
    Given Quy tắc "ALT-MIC-01" quy định miễn kiểm Giới hạn vi sinh nếu nguyên liệu vô trùng
    When Hồ sơ xác nhận nguyên liệu vô trùng đạt yêu cầu
    Then Trạng thái chỉ tiêu Giới hạn vi sinh tự động chuyển sang "EXEMPTED"
    And Tiến độ hoàn thành của Lô được cộng đủ 100% mà không cần nhập số đo vi sinh
```

---

## 3. PHẦN 3: OOS, DEVIATION, CAPA, APPROVAL & RELEASE GATES (Task 7.03)

```gherkin
Feature: Quản lý Sự Cố Chất Lượng, Thẩm Duyệt Đa Cấp và 7 Cổng Xuất Xưởng

  # --- OOS ---
  Scenario: Tự động kích hoạt OOS và chặn Gate 3 khi chỉ tiêu định lượng rớt
    Given Kỹ thuật viên nhập kết quả hàm lượng là "88.0%" (Quy định: 90.0% - 110.0%)
    When Kỹ thuật viên bấm Lưu kết quả
    Then Chỉ tiêu tự động chuyển sang trạng thái "FAIL"
    And Một phiếu điều tra OOS mới tự động tạo ở trạng thái "OPEN"
    And Cổng kiểm soát xuất xưởng Release Gate 3 bị khóa màu đỏ

  # --- DEVIATION ---
  Scenario: Đánh giá rủi ro sai lệch theo ICH Q9 và chặn xuất xưởng
    Given Một sự cố sai lệch "Mất điện điều hòa phòng sạch 4 giờ" xảy ra
    When QA Specialist chấm điểm FMEA với Severity = 4, Probability = 3, Detectability = 3
    Then Điểm RPN tính ra là 36 và phân loại mức độ là "CRITICAL"
    And Cổng kiểm soát xuất xưởng Release Gate 4 bị khóa cho đến khi sự cố được QA duyệt đóng

  # --- CAPA ---
  Scenario: Đóng vòng lặp CAPA sau khi thẩm tra hiệu quả sau 3 tháng
    Given Một CAPA có 2 hành động khắc phục đã hoàn thành 100% bằng chứng
    When Đến hạn 90 ngày, QA Manager thẩm tra và xác nhận không có sự cố tương tự tái diễn
    Then QA Manager ký số phê duyệt đóng CAPA
    And Trạng thái CAPA chuyển sang "CLOSED"

  # --- APPROVAL & SOD ---
  Scenario: Chặn tuyệt đối hành vi tự thẩm duyệt (Segregation of Duties)
    Given Kỹ thuật viên "User_A" là người thực hiện phép thử và nộp phiếu "PKN-001"
    When "User_A" cố tình gọi API phê duyệt phiếu "PKN-001"
    Then Hệ thống chặn đứng yêu cầu với mã lỗi "ERR_SOD_VIOLATION"
    And Nhật ký an ninh ghi nhận cảnh báo "Cố gắng vi phạm nguyên tắc tách biệt trách nhiệm"

  # --- RELEASE GATES ---
  Scenario: Khóa nút xuất xưởng nếu 1 trong 7 Gates chưa đạt
    Given Lô "BAT-001" hoàn thành 100% chỉ tiêu đạt, không có OOS, nhưng Hồ sơ sản xuất (BPR) chưa được QA duyệt
    When Qualified Person mở màn hình Xuất xưởng
    Then Cổng Gate 6 (BPR Review) hiển thị màu đỏ "BPR_NOT_APPROVED"
    And Nút "Ký xuất xưởng" bị vô hiệu hóa kèm thông báo giải thích cụ thể
```

---

## 4. PHẦN 4: COA, SIGNATURE, AUDIT & AI GOVERNANCE (Task 7.04)

```gherkin
Feature: Xuất Bản CoA Bất Biến, Chữ Ký Số 21 CFR Part 11, Audit Trail ALCOA+ và Quản Trị AI

  # --- COA REPORT ---
  Scenario: CoA đọc 100% từ Snapshot và cấm tự tính toán lại
    Given Lô "BAT-001" đã được phê duyệt xuất xưởng và tạo CoA số "COA-2026-001"
    When Màn hình CoA View render dữ liệu
    Then Dữ liệu được nạp 100% từ đối tượng "CoASnapshotContract"
    And Không có bất kỳ logic so sánh min/max nào được chạy trong template in
    And Mã QR hiển thị dẫn tới trang tra cứu kèm mã băm SHA-256

  # --- ELECTRONIC SIGNATURE ---
  Scenario: Ký số 21 CFR Part 11 hợp lệ
    Given QA Manager chuẩn bị phê duyệt xuất bản phiếu kiểm nghiệm
    When Nhập đúng mật khẩu ký điện tử và chọn ý nghĩa "APPROVED"
    Then Chữ ký điện tử được gắn vào tài liệu kèm mã băm SHA-256 của toàn bộ nội dung
    And Trên bản in hiển thị rõ: "Ký điện tử bởi [Họ tên] vào lúc [ISO 8601 Timestamp]"

  # --- ALCOA+ AUDIT TRAIL ---
  Scenario: Phát hiện đứt gãy chuỗi kiểm toán khi database bị can thiệp lén
    Given Chuỗi Audit Trail đang có 500 bản ghi nối chuỗi mã băm toàn vẹn
    When Có ai đó truy cập database backend sửa giá trị bản ghi số 250
    Then Khi hệ thống chạy kiểm tra toàn vẹn định kỳ
    Then Hàm kiểm tra trả về "isChainIntact = false" và chỉ rõ vị trí hỏng tại bản ghi 251
    And Kích hoạt cảnh báo đỏ mức tối cao tới Quản trị viên hệ thống

  # --- AI GOVERNANCE ---
  Scenario: Rào chắn dược khoa loại bỏ gợi ý nhầm lẫn Định tính sang Định lượng
    Given Trợ lý AI OCR phân tích ảnh chụp phiếu kiểm nghiệm nguyên liệu
    And AI gợi ý ghép dòng text "Định tính IR: Phù hợp phổ chuẩn" vào chỉ tiêu "Hàm lượng (%)"
    When Hàm rào chắn "isCriteriaMatch" kiểm tra đề xuất
    Then Đề xuất bị loại bỏ hoàn toàn khỏi danh sách gợi ý hiển thị cho Kỹ thuật viên
    And Hệ thống không lưu bất kỳ thay đổi nào vào cơ sở dữ liệu nếu người dùng chưa bấm xác nhận
```
