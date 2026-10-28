# PHÂN HỆ 08: QUALITY EVALUATION ENGINE WORKFLOW

## (QUY TRÌNH ĐỘNG CƠ THẨM ĐỊNH CHẤT LƯỢNG CHUẨN HÓA)

> **Mã phân hệ**: `MOD-08`  
> **Tài liệu**: `docs/workflows/MOD_08_QUALITY_EVALUATION_WORKFLOW.md`  
> **Phạm vi**: Thuật toán đánh giá từng chỉ tiêu kỹ thuật, xử lý số học và chuỗi ký tự, bảo toàn số 0 hợp lệ, tổng hợp trạng thái chất lượng toàn phiếu/lô, nguyên tắc No Implicit Pass / No Implicit Fail.

---

### 1. MỤC ĐÍCH (PURPOSE)

Xác lập thẩm quyền tính toán duy nhất và tập trung (Canonical Business Authority) cho việc đánh giá chất lượng kỹ thuật trong PQM. Tuyệt đối loại bỏ việc UI, Helper hay Mẫu in CoA tự viết logic so sánh kết quả.

### 2. NGUYÊN TẮC CỐT LÕI (CORE PRINCIPLES)

#### A. No Implicit Pass (Không Đạt Ngầm)

- Thiếu kết quả, kết quả để trống, hoặc kết quả không xác định **KHÔNG BAO GIỜ** được coi là `PASS`.
- Bất kỳ chỉ tiêu bắt buộc nào chưa có giá trị đều giữ trạng thái `PENDING`.

#### B. No Implicit Fail (Không Rớt Ngầm)

- Không được tự động gán `FAIL` khi chưa hoàn thành chu trình thẩm định (ví dụ: chỉ tiêu thay thế đang trong quá trình thử nghiệm).
- Chỉ kết luận `FAIL` khi có giá trị thực chứng vượt ngưỡng tiêu chuẩn và không có quy tắc cứu vãn hợp lệ.

#### C. Bảo toàn Số 0 Hợp lệ (Zero Preservation)

- Giá trị `0`, `0.0`, `0 CFU/g` là giá trị thực chứng hợp lệ, tuyệt đối không bị thuật toán đánh đồng với `null`, `undefined` hoặc chuỗi rỗng `""`.

### 3. QUY TẮC ĐÁNH GIÁ CHI TIẾT TỪNG CHỈ TIÊU

#### A. Chỉ tiêu Dạng Số (`NUMBER`)

1. **Khoảng 2 đầu (`min` và `max` đều có)**:
   - Công thức: $min \le value \le max \implies PASS$
   - Ngược lại $\implies FAIL$.
2. **Cận trên (`max` có, `min` rỗng)**:
   - Công thức: $value \le max \implies PASS$ (Ví dụ: Giới hạn tạp chất $\le 0.5\%$, Nhiễm khuẩn $\le 1000$ CFU/g).
   - Ngược lại $\implies FAIL$.
3. **Cận dưới (`min` có, `max` rỗng)**:
   - Công thức: $value \ge min \implies PASS$ (Ví dụ: Định lượng hoạt chất $\ge 90.0\%$).
   - Ngược lại $\implies FAIL$.

#### B. Chỉ tiêu Dạng Văn bản (`TEXT`)

1. **Chuẩn hóa trước khi so sánh**:
   - Cắt bỏ khoảng trắng thừa đầu cuối (`trim`).
   - Không phân biệt chữ hoa, chữ thường (`toLowerCase`).
2. **So khớp ngữ nghĩa**:
   - Nếu giá trị nhập khớp với `expectedText` hoặc nằm trong danh mục từ điển tương đương $\implies PASS$.
   - Nếu giá trị biểu thị trạng thái không đạt (ví dụ: "Đục", "Có cặn lạ", "Màu sắc biến đổi") $\implies FAIL$.

### 4. THUẬT TOÁN TỔNG HỢP TRẠNG THÁI TOÀN PHIẾU (OVERALL RESOLVER)

Trạng thái chất lượng toàn phiếu (`overallQualityStatus`) được tính toán tiền định theo thứ tự ưu tiên:

```
IF (Tất cả chỉ tiêu tham gia đánh giá đều có kết quả VÀ tất cả đều PASS)
    THEN overall = PASS

ELSE IF (Có ít nhất một chỉ tiêu FAIL VÀ chỉ tiêu đó KHÔNG ĐƯỢC CỨU bởi Alternate Rule)
    THEN overall = FAIL

ELSE IF (Có chỉ tiêu bắt buộc chưa nhập HOẶC có chỉ tiêu thay thế đang TRIGGERED_PENDING)
    THEN overall = PENDING

ELSE
    overall = UNKNOWN
```

### 5. DỮ LIỆU ĐẦU RA (OUTPUT)

- Kết quả phân giải chi tiết của từng chỉ tiêu:
  - `criterionId`: ID chỉ tiêu.
  - `isPass`: boolean | null.
  - `normalizedValue`: Giá trị sau chuẩn hóa.
  - `ruleApplied`: Tên quy tắc được áp dụng.
- Trạng thái tổng hợp toàn phiếu: `CanonicalQualityStatus` (`PASS`, `FAIL`, `PENDING`, `UNKNOWN`).

### 6. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-QEV-01`: Giá trị `0` không bao giờ bị coi là rỗng.
- `AC-QEV-02`: Nếu một chỉ tiêu bắt buộc bị bỏ trống, trạng thái toàn phiếu bắt buộc là `PENDING`, không được là `PASS` hay `FAIL`.
- `AC-QEV-03`: Toàn bộ UI và Báo cáo phải hiển thị kết quả từ Engine này, không tự so sánh `min/max`.
