# ĐẶC TẢ YÊU CẦU CHỨC NĂNG HỆ THỐNG V2 (FRS V2)

## (FUNCTIONAL REQUIREMENTS SPECIFICATION)

> **Mã tài liệu**: `SPEC-FRS-V2-01`  
> **Thư mục**: `docs/functional-specs/PQM_FUNCTIONAL_REQUIREMENTS_V2.md`  
> **Ánh xạ từ**: Business Rule Catalog (`docs/business-rules/`) & Domain Contracts (`docs/contracts/`)

---

## 1. NHÓM CHỨC NĂNG QUẢN LÝ TIÊU CHUẨN CƠ SỞ (TCCS)

### FRS-TCCS-001: Quản lý Danh mục Chỉ tiêu với UUID Bất biến

- **Mô tả**: Khi người dùng thêm chỉ tiêu mới vào TCCS, hệ thống tự động sinh `criterionId` (UUID v4) và gán vĩnh viễn cho chỉ tiêu đó.
- **Quy tắc thỏa mãn**: `BR-TCCS-002`.
- **Ràng buộc**: Hệ thống từ chối lưu nếu có chỉ tiêu thiếu ID hoặc trùng tên trong cùng một TCCS.

### FRS-TCCS-002: Cấu hình Quy tắc Chỉ tiêu Thay thế Có Cấu trúc

- **Mô tả**: Trình biên tập TCCS (`SC-06`) cung cấp giao diện trực quan để người dùng thiết lập quan hệ thay thế:
  - Chọn Chỉ tiêu chính (Dropdown danh sách chỉ tiêu có trong TCCS).
  - Chọn Chỉ tiêu phụ (Dropdown, loại trừ chỉ tiêu chính đã chọn).
  - Chọn Loại quy tắc (`FAIL_RETRY` hoặc `CONDITIONAL_CHECK`).
  - Nếu chọn `CONDITIONAL_CHECK`: Cung cấp bộ chọn toán tử (`>`, `<`, `==`, `BETWEEN`) và ô nhập ngưỡng kích hoạt.
- **Quy tắc thỏa mãn**: `BR-TCCS-004`.

### FRS-TCCS-003: Đóng Băng TCCS & Tự Động Kế Thừa Phiên Bản

- **Mô tả**: Khi một bản TCCS đã có Lô sản xuất liên kết, nút "Lưu" trực tiếp bị ẩn; hệ thống cung cấp nút "Tạo phiên bản mới (v+1)" để người dùng sao chép sang bản thảo mới.
- **Quy tắc thỏa mãn**: `BR-TCCS-003`.

---

## 2. NHÓM CHỨC NĂNG HỒ SƠ LÔ SẢN XUẤT (BATCH)

### FRS-BAT-001: Tự Động Tạo TCCS Snapshot Khi Khởi Tạo Lô

- **Mô tả**: Tại thời điểm người dùng tạo Lô thành công, hệ thống tự động thực hiện deep clone bản TCCS đang `ACTIVE` và nhúng vào `batch.tccsSnapshot`.
- **Quy tắc thỏa mãn**: `BR-BAT-001`.

### FRS-BAT-002: Phân Tách Tuyệt Đối Quality Status và Workflow Status

- **Mô tả**: Mọi API và Service của Lô không cho phép cập nhật trực tiếp trường `batch.qualityStatus`. Trường này được tính toán độc quyền bởi `QualityEvaluationEngine`.
- **Quy tắc thỏa mãn**: `BR-BAT-002`.

### FRS-BAT-003: Cơ Chế Khóa Dữ Liệu Bất Biến (Data Locking)

- **Mô tả**: Khi `batch.status === 'APPROVED'` hoặc `'RELEASED'`, API từ chối toàn bộ các thao tác chỉnh sửa thông tin sản xuất của lô.
- **Quy tắc thỏa mãn**: `BR-BAT-003`.

---

## 3. NHÓM CHỨC NĂNG PHIẾU KIỂM NGHIỆM & ĐÁNH GIÁ CHẤT LƯỢNG

### FRS-QEV-001: Đánh Giá Chỉ Tiêu Chuẩn Hóa Theo Thời Gian Thực

- **Mô tả**: Khi người dùng nhập giá trị vào ô input của chỉ tiêu, hệ thống tự động gọi `CriterionEvaluator` để so sánh với $min, max$ hoặc $expectedText$ và hiển thị nhãn Đạt / Không đạt ngay tức thì.
- **Quy tắc thỏa mãn**: `BR-QEV-001`, `BR-QEV-003`.

### FRS-QEV-002: Phân Giải Tự Động Quy Tắc Thay Thế

- **Mô tả**: Khi chỉ tiêu chính có kết quả `FAIL` trong quy tắc `FAIL_RETRY`, hệ thống tự động:
  1. Đổi trạng thái của chỉ tiêu phụ từ `NOT_TRIGGERED` sang `TRIGGERED_PENDING`.
  2. Mở khóa ô nhập liệu của chỉ tiêu phụ.
  3. Cập nhật trạng thái toàn phiếu sang `PENDING`.
- **Quy tắc thỏa mãn**: `BR-ALT-001`, `BR-ALT-003`.

### FRS-QEV-003: Chặn Nộp Phiếu (Submit Gate)

- **Mô tả**: Nút "Gửi thẩm tra" (Submit) bị vô hiệu hóa khi còn bất kỳ chỉ tiêu bắt buộc nào chưa có kết quả hoặc có chỉ tiêu thay thế đang ở trạng thái `TRIGGERED_PENDING`.
- **Quy tắc thỏa mãn**: `BR-TR-001`.

### FRS-QEV-004: Tạo Evaluation Snapshot Kèm Mã Băm Khi Ký Duyệt

- **Mô tả**: Khi QA Manager ký duyệt phiếu kiểm nghiệm, hệ thống tự động trích xuất toàn bộ kết quả, tính toán mã băm SHA-256 và lưu đối tượng `evaluationSnapshot` vào bản ghi phiếu kiểm nghiệm.
- **Quy tắc thỏa mãn**: `BR-TR-002`.

---

## 4. NHÓM CHỨC NĂNG RELEASE GATE & BÁO CÁO COA

### FRS-REL-001: Rào Chắn Xuất Xưởng Lô 7 Cổng (7 Release Gates)

- **Mô tả**: Hệ thống kiểm tra đồng thời 7 cổng kiểm soát an toàn (7 Release Gates) trước khi cho phép QA Director / Authorized Person ký lệnh xuất xưởng (`RELEASED`):
  1. **Gate 1 (Batch Lifecycle State)**: Lô đang ở trạng thái tác nghiệp hợp lệ (`TESTING` hoặc `QA_REVIEW`), không bị tạm đình chỉ (`HOLD`) hoặc từ chối (`REJECTED`).
  2. **Gate 2 (Canonical Quality Status)**: Đánh giá chất lượng chuẩn tắc của Lô phải là `PASS` (tuyệt đối cấm xuất xưởng nếu còn chỉ tiêu `FAIL`, `PENDING` hoặc `INDETERMINATE`).
  3. **Gate 3 (Criteria Completeness)**: 100% chỉ tiêu bắt buộc theo TCCS Snapshot đã được thử nghiệm và đánh giá đầy đủ (`completionPercentage === 100`).
  4. **Gate 4 (OOS Investigation Resolution)**: 100% hồ sơ sự cố ngoài tiêu chuẩn (OOS) liên quan đến Lô đã được điều tra xong và phê duyệt đóng bởi QA Manager (không có OOS nào ở trạng thái `OPEN` hoặc `IN_PROGRESS`).
  5. **Gate 5 (Deviation Containment)**: 100% phiếu sai lệch quy trình (Deviation) mức Major / Critical liên đới đã hoàn tất biện pháp cô lập rủi ro và được QA ký chấp thuận.
  6. **Gate 6 (Raw Materials & Batch Expiry)**: 100% nguyên vật liệu cấu thành trong công thức không bị quá hạn dùng tại thời điểm sản xuất, và bản thân Lô thành phẩm còn trong hạn sử dụng hợp lệ.
  7. **Gate 7 (Part 11 Electronic Signature & Authorization)**: Chữ ký số điện tử bắt buộc xác thực mật khẩu, ghi nhận vai trò được ủy quyền (`QA_DIRECTOR` hoặc `QUALIFIED_PERSON`), lý do ký xuất xưởng và mã băm toàn vẹn SHA-256.
- **Ràng buộc an ninh**: Nếu bất kỳ cổng nào trong 7 cổng trên không thỏa mãn, nút "Ký lệnh xuất xưởng" tại `SC-10` bị khóa cứng; hành vi bypass ở backend/API bị chặn hoàn toàn.
- **Quy tắc thỏa mãn**: `BR-REL-001`, `BR-REL-002`, `BR-SEC-001`.

### FRS-COA-001: Xuất Bản Báo Cáo CoA Độc Quyền Từ Snapshot

- **Mô tả**: Màn hình xem và in CoA (`SC-14`) chỉ đọc dữ liệu từ `batch.evaluationSnapshot`. Cấm mọi hành vi tính toán lại hoặc nội suy ở client.
- **Quy tắc thỏa mãn**: `BR-COA-001`, `BR-COA-002`, `BR-ALT-004`.
