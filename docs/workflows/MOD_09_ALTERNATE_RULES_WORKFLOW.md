# PHÂN HỆ 09: ALTERNATE RULES WORKFLOW

## (QUY TRÌNH QUY TẮC CHỈ TIÊU THAY THẾ & PHỤ THUỘC)

> **Mã phân hệ**: `MOD-09`  
> **Tài liệu**: `docs/workflows/MOD_09_ALTERNATE_RULES_WORKFLOW.md`  
> **Phạm vi**: Cơ chế phân giải quy tắc thay thế trong kiểm nghiệm dược phẩm (FAIL_RETRY, CONDITIONAL_CHECK), máy trạng thái phân cấp chỉ tiêu, quy định hiển thị UI và thể hiện trên hồ sơ CoA.

---

### 1. MỤC ĐÍCH (PURPOSE)

Chuẩn hóa nghiệp vụ kiểm nghiệm đặc thù trong ngành dược:

1. **Kiểm tra lặp lại khi không đạt (FAIL_RETRY)**: Ví dụ: Phép thử độ rã lần 1 không đạt (6 viên) ➔ Phải kiểm nghiệm tiếp lần 2 (thêm 12 viên). Nếu lần 2 đạt thì lô vẫn đạt.
2. **Kiểm tra có điều kiện (CONDITIONAL_CHECK)**: Ví dụ: Chỉ kiểm nghiệm giới hạn kim loại nặng khi chỉ tiêu Tro toàn phần vượt quá 1.0%; hoặc nếu Tổng số vi sinh vật hiếu khí $\le 100$ CFU/g thì được miễn kiểm chỉ tiêu vi khuẩn chịu nhiệt.

### 2. HAI LOẠI QUY TẮC CHÍNH

#### A. Loại 1: `FAIL_RETRY` (Kiểm lại khi rớt)

- **Quy tắc**:
  - Nếu **Chỉ tiêu chính (Main)** = `PASS` ➔ **Chỉ tiêu phụ (Alt)** = `EXEMPTED` (Miễn kiểm).
  - Nếu **Chỉ tiêu chính (Main)** = `FAIL`:
    - Chỉ tiêu phụ chuyển sang trạng thái `REQUIRED` (Bắt buộc phải kiểm).
    - Nếu chưa nhập kết quả phụ ➔ Trạng thái là `TRIGGERED_PENDING` (Toàn phiếu là `PENDING`).
    - Nếu kết quả phụ = `PASS` ➔ Toàn bộ cụm chỉ tiêu = `TRIGGERED_PASS` (Đạt theo quy tắc thay thế).
    - Nếu kết quả phụ = `FAIL` ➔ Toàn bộ cụm chỉ tiêu = `TRIGGERED_FAIL` (Chính thức rớt, kích hoạt OOS).

#### B. Loại 2: `CONDITIONAL_CHECK` (Kiểm tra theo ngưỡng điều kiện)

- **Quy tắc**:
  - Nếu kết quả **Chỉ tiêu chính** thỏa mãn điều kiện kích hoạt (Ví dụ: `Độ ẩm > 8.0%`):
    - Chỉ tiêu phụ trở thành `REQUIRED` (Bắt buộc phải kiểm).
    - Khi chưa có kết quả phụ ➔ `TRIGGERED_PENDING` (Toàn phiếu là `PENDING`).
    - Có kết quả phụ đạt ➔ `TRIGGERED_PASS`.
    - Có kết quả phụ không đạt ➔ `TRIGGERED_FAIL`.
  - Nếu kết quả **Chỉ tiêu chính** KHÔNG thỏa mãn điều kiện kích hoạt:
    - Chỉ tiêu phụ = `EXEMPTED` (Miễn kiểm).

---

### 3. VÒNG ĐỜI TRẠNG THÁI QUY TẮC THAY THẾ (ALTERNATE STATE MACHINE)

```
                       [NOT_APPLICABLE] (Chỉ tiêu độc lập)
                              │
                              ▼
                     [NOT_TRIGGERED]
              (Chỉ tiêu chính chưa có kết quả
               hoặc điều kiện chưa được kích hoạt)
                              │
             ┌────────────────┴────────────────┐
             │                                 │
     (Chỉ tiêu chính PASS              (Chỉ tiêu chính FAIL
     hoặc không thỏa điều kiện)         hoặc thỏa điều kiện kích hoạt)
             │                                 │
             ▼                                 ▼
        [EXEMPTED]                    [TRIGGERED_PENDING]
  (Chính thức miễn kiểm,               (Bắt buộc phải kiểm nghiệm,
   Không ảnh hưởng kết quả)             Phiếu kiểm nghiệm chuyển PENDING)
                                               │
                              ┌────────────────┴────────────────┐
                              │                                 │
                     (Kết quả phụ PASS)                (Kết quả phụ FAIL)
                              │                                 │
                              ▼                                 ▼
                      [TRIGGERED_PASS]                  [TRIGGERED_FAIL]
                   (Đạt theo quy tắc thay thế)       (Không đạt chính thức)
```

---

### 4. HỢP ĐỒNG HÀNH VI GIAO DIỆN BẮT BUỘC (UI BEHAVIOR CONTRACT)

1. **QUY TẮC CẤM FILTER (CẤM ẨN CHỈ TIÊU)**:
   - **Tuyệt đối không bao giờ được lọc ẩn (filter out) một chỉ tiêu khỏi danh sách** chỉ vì nó đang ở trạng thái `NOT_TRIGGERED` hoặc `EXEMPTED`. Toàn bộ chỉ tiêu trong TCCS phải luôn được hiển thị minh bạch.
2. **Hiển thị theo trạng thái**:
   - `NOT_TRIGGERED`: Ô nhập liệu bị vô hiệu hóa (`disabled`), placeholder hiển thị _"Miễn kiểm (tự động)"_, badge hiển thị màu xám/xanh nhạt _"MIỄN KIỂM"_.
   - `TRIGGERED_PENDING`: Ô nhập liệu được mở khóa (`enabled`), border đổi màu cam/vàng cảnh báo, placeholder hiển thị _"Bắt buộc nhập kết quả..."_, badge nhấp nháy _"CHỜ KẾT QUẢ"_. Nút nộp phiếu (Submit) bị vô hiệu hóa.
   - `TRIGGERED_PASS`: Badge hiển thị màu xanh lá _"ĐẠT (THAY THẾ)"_ kèm ghi chú lý do.
   - `TRIGGERED_FAIL`: Badge hiển thị màu đỏ _"K.ĐẠT"_ kèm cảnh báo OOS.

---

### 5. QUY TẮC THỂ HIỆN TRÊN PHIẾU PHÂN TÍCH (COA BEHAVIOR CONTRACT)

- Trên bảng kết quả CoA in ra:
  - Nếu chỉ tiêu ở trạng thái `EXEMPTED`: Cột kết quả ghi rõ: `"Đạt (*)"` hoặc `"- (*)"`. Dưới chân trang tự động in dòng chú thích: _"(_) Miễn thử nghiệm theo quy tắc thay thế của TCCS khi chỉ tiêu [Tên chỉ tiêu chính] đã đạt"\*.
  - Nếu chỉ tiêu ở trạng thái `TRIGGERED_PASS`: Cột kết quả ghi giá trị thực tế của lần thử thay thế kèm ghi chú tham chiếu.
  - **Cấm CoA tự nội suy**: Dữ liệu này phải được lấy trực tiếp từ `EvaluationSnapshot`, cấm giao diện CoA tự tính lại logic Alternate Rules.

---

### 6. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-ALT-01`: Khi chỉ tiêu chính ĐẠT, chỉ tiêu phụ thuộc `FAIL_RETRY` bắt buộc chuyển sang `EXEMPTED`.
- `AC-ALT-02`: Khi chỉ tiêu chính KHÔNG ĐẠT, chỉ tiêu phụ bắt buộc chuyển sang `TRIGGERED_PENDING` và chặn mọi thao tác Submit/Approve/Release cho đến khi có kết quả phụ.
- `AC-ALT-03`: Mọi chỉ tiêu phải luôn hiển thị trên UI, không bao giờ bị ẩn.
- `AC-ALT-04`: CoA phải đọc trạng thái Alternate từ Snapshot, không được tự động tính toán.
