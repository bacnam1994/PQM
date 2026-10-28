# BỘ TIÊU CHÍ NGHIỆM THU HỆ THỐNG GHERKIN (ACCEPTANCE CRITERIA)

## (LEVEL 5: TESTABLE ACCEPTANCE CRITERIA)

> **Mã tài liệu**: `ACCEPTANCE-CRITERIA-V2`  
> **Thư mục**: `docs/acceptance/ACCEPTANCE_CRITERIA.md`  
> **Định dạng**: Gherkin Standard (Given - When - Then)  
> **Mục tiêu**: Cơ sở tự động hóa kiểm thử để chứng minh mã nguồn tuân thủ 100% đặc tả trước khi release.

---

## 1. TIÊU CHÍ NGHIỆM THU QUY TẮC CHỈ TIÊU THAY THẾ (ALTERNATE RULES)

### 🎯 AC-ALT-001: Chỉ tiêu chính ĐẠT ➔ Chỉ tiêu phụ Miễn kiểm

```gherkin
Feature: Quy tắc thử nghiệm thay thế FAIL_RETRY

  Scenario: Chỉ tiêu chính đạt yêu cầu thì chỉ tiêu phụ tự động được miễn kiểm
    Given Một Lô sản xuất áp dụng TCCS có quy tắc FAIL_RETRY giữa Chỉ tiêu chính A và Chỉ tiêu phụ B
    And Phiếu kiểm nghiệm đang ở trạng thái DRAFT
    When Kiểm nghiệm viên nhập kết quả của Chỉ tiêu A nằm trong giới hạn tiêu chuẩn
    And Hệ thống thực hiện thẩm định
    Then Chỉ tiêu A có kết quả là PASS
    And Chỉ tiêu B tự động chuyển trạng thái sang EXEMPTED
    And Ô nhập liệu của Chỉ tiêu B bị vô hiệu hóa (disabled)
    And Nhãn của Chỉ tiêu B hiển thị là "MIỄN KIỂM"
    And Trạng thái chất lượng tổng thể của phiếu là PASS (nếu các chỉ tiêu khác đều đạt)
```

---

### 🎯 AC-ALT-002: Chỉ tiêu chính RỚT ➔ Kích hoạt chỉ tiêu phụ bắt buộc

```gherkin
  Scenario: Chỉ tiêu chính không đạt thì kích hoạt chỉ tiêu phụ và chuyển trạng thái sang PENDING
    Given Một Lô sản xuất có quy tắc FAIL_RETRY giữa Chỉ tiêu A và Chỉ tiêu B
    When Kiểm nghiệm viên nhập kết quả của Chỉ tiêu A vượt ngưỡng tiêu chuẩn (FAIL)
    Then Chỉ tiêu A hiển thị nhãn "K.ĐẠT" màu đỏ
    And Chỉ tiêu B tự động chuyển trạng thái từ NOT_TRIGGERED sang TRIGGERED_PENDING
    And Ô nhập liệu của Chỉ tiêu B được mở khóa (enabled)
    And Viền ô nhập của Chỉ tiêu B đổi sang màu cam cảnh báo
    And Nhãn của Chỉ tiêu B hiển thị là "CHỜ KẾT QUẢ" (nhấp nháy)
    And Trạng thái chất lượng tổng thể của phiếu là PENDING
    And Nút "Gửi thẩm tra" (Submit) bị vô hiệu hóa
```

---

### 🎯 AC-ALT-003: Chỉ tiêu phụ ĐẠT ➔ Cứu thành công chỉ tiêu chính

```gherkin
  Scenario: Nhập kết quả đạt cho chỉ tiêu phụ giúp phiếu kiểm nghiệm đạt chuẩn
    Given Chỉ tiêu A đang FAIL và Chỉ tiêu B đang ở trạng thái TRIGGERED_PENDING
    When Kiểm nghiệm viên nhập kết quả cho Chỉ tiêu B nằm trong giới hạn tiêu chuẩn
    Then Chỉ tiêu B hiển thị nhãn "ĐẠT (THAY THẾ)" màu xanh lá
    And Động cơ tổng hợp xác nhận cụm chỉ tiêu này ĐẠT theo quy tắc thay thế
    And Trạng thái chất lượng tổng thể của phiếu chuyển từ PENDING sang PASS
    And Nút "Gửi thẩm tra" (Submit) được kích hoạt trở lại
```

---

### 🎯 AC-ALT-004: Cả Chỉ tiêu chính và Chỉ tiêu phụ đều RỚT ➔ Kích hoạt OOS

```gherkin
  Scenario: Cả hai lần thử đều không đạt dẫn đến phiếu kiểm nghiệm FAIL chính thức
    Given Chỉ tiêu A đang FAIL và Chỉ tiêu B đang ở trạng thái TRIGGERED_PENDING
    When Kiểm nghiệm viên nhập kết quả cho Chỉ tiêu B vượt ngưỡng tiêu chuẩn (FAIL)
    Then Chỉ tiêu B hiển thị nhãn "K.ĐẠT"
    And Toàn bộ cụm chỉ tiêu bị đánh giá là TRIGGERED_FAIL
    And Trạng thái chất lượng tổng thể của phiếu là FAIL
    And Hệ thống tự động tạo hồ sơ OOS liên kết với Lô và Phiếu kiểm nghiệm này
```

---

### 🎯 AC-ALT-005: Hiển thị minh bạch toàn bộ chỉ tiêu trên giao diện (Cấm ẩn)

```gherkin
  Scenario: Giao diện luôn hiển thị đầy đủ mọi chỉ tiêu không phụ thuộc vào trạng thái
    Given Bản TCCS của Lô có tổng cộng 12 chỉ tiêu (bao gồm 2 chỉ tiêu phụ thuộc thay thế)
    When Mở form nhập liệu phiếu kiểm nghiệm SC-12
    Then Màn hình phải render chính xác 12 dòng chỉ tiêu
    And Tuyệt đối không có chỉ tiêu nào bị ẩn (filter out) khỏi DOM
```

---

## 2. TIÊU CHÍ NGHIỆM THU CHỐT CHẶN XUẤT XƯỞNG (RELEASE GATE)

### 🎯 AC-REL-001: Chặn xuất xưởng nếu chất lượng không PASS

```gherkin
Feature: Chốt chặn an toàn xuất xưởng (Release Gate)

  Scenario: Lô có trạng thái chất lượng PENDING hoặc FAIL không bao giờ được Release
    Given Một Lô sản xuất đang ở trạng thái COMPLETED hoặc APPROVED
    And batch.qualityStatus đang là PENDING hoặc FAIL
    When Người dùng có vai trò QA Director xem trang chi tiết Lô SC-10
    Then Đèn tín hiệu số 1 "Chất lượng Kỹ thuật" hiển thị màu Đỏ hoặc Vàng
    And Nút "Ký Lệnh Xuất Xưởng" bị vô hiệu hóa hoàn toàn
    And Nếu gửi trực tiếp lệnh ghi qua API, Firebase Rules từ chối với lỗi Permission Denied
```

---

### 🎯 AC-REL-002: Xuất xưởng thành công khi thỏa mãn 5 điều kiện

```gherkin
  Scenario: Lô thỏa mãn toàn bộ 5 tiêu chí được phép chuyển sang RELEASED
    Given batch.qualityStatus === 'PASS'
    And Toàn bộ các Phiếu kiểm nghiệm con đều APPROVED và có EvaluationSnapshot
    And Không có hồ sơ OOS nào của Lô đang mở
    And Không có sai lệch nghiêm trọng nào của Lô đang mở
    And Người dùng hiện tại có vai trò QA Director
    When QA Director bấm nút "Ký Lệnh Xuất Xưởng" và xác thực chữ ký số FDA CFR Part 11 thành công
    Then batch.status chuyển sang RELEASED
    And Toàn bộ dữ liệu của Lô và PKN bị khóa bất biến (Data Locked)
    And Một bản ghi ALCOA+ Audit Trail được ghi nhận
```

---

## 3. TIÊU CHÍ NGHIỆM THU XUẤT COA TỪ SNAPSHOT

### 🎯 AC-COA-001: CoA chỉ đọc từ Snapshot đã đóng băng

```gherkin
Feature: Thể hiện phiếu phân tích kết quả CoA

  Scenario: In CoA chính thức phải lấy số liệu từ Evaluation Snapshot
    Given Lô đã được ký duyệt và xuất xưởng thành công, có EvaluationSnapshot hợp lệ
    When Mở màn hình xem CoA SC-14
    Then Toàn bộ các dòng kết quả được render chính xác từ snapshot.criterionResults
    And Giao diện không thực hiện bất kỳ phép tính toán so sánh lại nào
    And Chân trang in dòng chú thích tự động cho các chỉ tiêu được miễn kiểm
    And Mã QR in ra trỏ đúng về URL xác thực công khai của hệ thống
```
