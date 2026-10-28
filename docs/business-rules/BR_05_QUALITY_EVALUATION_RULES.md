# BỘ QUY TẮC NGHIỆP VỤ 05: QUALITY EVALUATION RULES

## (QUY TẮC ĐỘNG CƠ THẨM ĐỊNH CHẤT LƯỢNG CHUẨN HÓA)

> **Mã tài liệu**: `BR-CATALOG-05`  
> **Thư mục**: `docs/business-rules/BR_05_QUALITY_EVALUATION_RULES.md`  
> **Phân hệ liên quan**: `MOD-08` (Quality Evaluation Engine Workflow)

---

### BR-QEV-001: Thẩm Định Chỉ Tiêu Số Học (Numeric Acceptance Criteria Evaluation)

- **Mục đích**: Đảm bảo các phép so sánh số học tuân thủ chính xác giới hạn dung sai, không bị ảnh hưởng bởi sai số dấu phẩy động (Floating point precision).
- **Trigger**: Khi nhập hoặc thẩm định giá trị của chỉ tiêu kiểu `NUMBER`.
- **Input**: `rawValue: string | number`, `criterion: Criterion (min?, max?)`.
- **Công thức & Bảng quyết định**:
  1. Parse giá trị: `val = parseNumeric(rawValue)`. Nếu không thể parse thành số hợp lệ ➔ Báo lỗi định dạng (`INVALID_NUMBER`).
  2. Trường hợp khoảng 2 đầu ($min$ và $max$):
     $$min - \epsilon \le val \le max + \epsilon \implies PASS \quad (\epsilon = 10^{-9})$$
  3. Trường hợp cận trên ($max$ có, $min$ rỗng):
     $$val \le max + \epsilon \implies PASS$$
  4. Trường hợp cận dưới ($min$ có, $max$ rỗng):
     $$val \ge min - \epsilon \implies PASS$$
- **Output**: `isPass: boolean`.
- **Test Cases**: `TC-BR-QEV-001-A` (Giá trị tại đúng cận min/max ➔ PASS), `TC-BR-QEV-001-B` (Vượt 0.0001 ➔ FAIL).

---

### BR-QEV-002: Bảo Toàn Tính Hợp Lệ Của Số 0 (Zero Preservation Rule)

- **Mục đích**: Ngăn ngừa lỗi kinh điển trong lập trình JavaScript khi `0` bị coi là `falsy`, dẫn đến việc đánh đồng giá trị `0` (ví dụ: `0 CFU/g`, `0% tạp chất`) với việc chưa nhập kết quả.
- **Trigger**: Khi Động cơ kiểm tra tính rỗng của giá trị.
- **Quy tắc bất biến**:
  ```typescript
  function isValueEmpty(val: any): boolean {
    if (val === 0 || val === '0' || val === 0.0) return false; // HỢP LỆ, KHÔNG RỖNG
    if (val === null || val === undefined) return true;
    if (typeof val === 'string' && val.trim() === '') return true;
    return false;
  }
  ```
- **Output**: Giá trị `0` luôn được coi là kết quả thực chứng đã nhập và tiến hành thẩm định bình thường.
- **Test Cases**: `TC-BR-QEV-002-A` (Nhập số 0 cho chỉ tiêu vi sinh ➔ Thẩm định đạt, không bị coi là thiếu kết quả).

---

### BR-QEV-003: Thẩm Định Chỉ Tiêu Văn Bản (Text Semantic Matching)

- **Mục đích**: So khớp chỉ tiêu cảm quan (Màu sắc, Mùi vị, Hình thức) không bị phụ thuộc vào chữ hoa/thường hoặc khoảng trắng thừa.
- **Trigger**: Khi thẩm định chỉ tiêu kiểu `TEXT`.
- **Input**: `value: string`, `expectedText: string`.
- **Quy tắc xử lý**:
  - Chuẩn hóa: `normVal = value.trim().toLowerCase()`, `normExp = expectedText.trim().toLowerCase()`.
  - Nếu `normVal === normExp` ➔ `PASS`.
  - Nếu giá trị chứa các từ khóa biểu thị trạng thái không đạt: `"đục"`, `"kết tủa lạ"`, `"biến màu"`, `"mốc"` ➔ `FAIL`.
- **Output**: `isPass: boolean | null`.
- **Test Cases**: `TC-BR-QEV-003-A` (So khớp văn bản không phân biệt hoa thường).

---

### BR-QEV-004: Tổng Hợp Trạng Thái Chất Lượng Toàn Phiếu (No Implicit Pass / No Implicit Fail)

- **Mục đích**: Quyết định kết luận cuối cùng của phiếu kiểm nghiệm một cách tiền định, không phụ thuộc thứ tự duyệt mảng.
- **Thuật toán thứ tự ưu tiên**:

  ```
  1. IF (results.length === 0)
         RETURN 'UNKNOWN'

  2. IF (Tồn tại ít nhất 1 chỉ tiêu FAIL mà KHÔNG CÓ quy tắc thay thế cứu vãn)
         RETURN 'FAIL'

  3. IF (Tồn tại chỉ tiêu bắt buộc chưa nhập HOẶC chỉ tiêu thay thế đang TRIGGERED_PENDING)
         RETURN 'PENDING'

  4. IF (Tất cả chỉ tiêu tham gia đánh giá đều có kết quả VÀ tất cả đều PASS)
         RETURN 'PASS'

  5. ELSE
         RETURN 'UNKNOWN'
  ```

- **Output**: `CanonicalQualityStatus` (`PASS`, `FAIL`, `PENDING`, `UNKNOWN`).
- **Test Cases**: `TC-BR-QEV-004-A` (Chỉ tiêu thiếu ➔ PENDING, không thể PASS), `TC-BR-QEV-004-B` (Có 1 chỉ tiêu FAIL ➔ FAIL).
