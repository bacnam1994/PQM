# HỢP ĐỒNG HÀNH VI GIAO DIỆN SC-12: TRÌNH NHẬP LIỆU PHIẾU KIỂM NGHIỆM

## (SCREEN CONTRACT SC-12: TEST RESULT / PKN EDITOR)

> **Mã màn hình**: `SC-12`  
> **Route URL**: `/test-results/editor/:id?`  
> **Component tương ứng**: `src/components/features/CriteriaInputGroup.tsx`, `TestResultDetail.tsx`  
> **Tầm quan trọng**: 🔴 **CRITICAL - ĐÓNG BĂNG HÀNH VI ĐỂ KHÔNG TÁI DIỄN LỖI CHỈ TIÊU THAY THẾ**

---

### 1. DỮ LIỆU ĐẦU VÀO (INPUT PROPS)

- `tccsSnapshot: TCCS`: Bản sao TCCS của Lô (Bao gồm danh mục `criteria` và `alternateRules`).
- `testResult: TestResult`: Bản ghi phiếu kiểm nghiệm đang biên tập.
- `existingHistory: TestResult[]`: Lịch sử các lần kiểm nghiệm trước đó của Lô.

---

### 2. QUY TẮC HIỂN THỊ DANH MỤC CHỈ TIÊU (NO FILTERING MANDATE)

> ⛔ **CẤM TUYỆT ĐỐI**: Không được dùng `criteria.filter(...)` để loại bỏ bất kỳ chỉ tiêu nào khỏi danh sách hiển thị, kể cả khi chỉ tiêu đó chưa được kích hoạt hoặc đang ở trạng thái miễn kiểm.

- Số lượng thẻ chỉ tiêu (Criteria Rows) render trên màn hình **BẮT BUỘC PHẢI BẰNG ĐÚNG 100%** tổng số chỉ tiêu có trong `tccsSnapshot.mainQualityCriteria` + `tccsSnapshot.safetyCriteria`.

---

### 3. MA TRẬN TRẠNG THÁI HIỂN THỊ VÀ HÀNH VI Ô NHẬP LIỆU (UI STATE MATRIX)

| Trạng thái Alternate Rule                         | Hiển thị Viền & Nền                                | Trạng thái ô `input`  | Placeholder                  | Badge hiển thị                             | Hành vi Nút "Gửi thẩm tra"                    |
| :------------------------------------------------ | :------------------------------------------------- | :-------------------- | :--------------------------- | :----------------------------------------- | :-------------------------------------------- |
| **`NOT_APPLICABLE`** (Chỉ tiêu thường)            | Viền xám nhạt, nền trắng                           | `enabled`             | _"Nhập kết quả..."_          | Theo kết quả ($PASS/FAIL/PENDING$)         | Cho phép Submit nếu đã nhập đủ                |
| **`NOT_TRIGGERED`** (Chỉ tiêu phụ chưa kích hoạt) | Viền xám, nền xám nhạt (`bg-slate-50`)             | **`disabled = true`** | _"Miễn kiểm (tự động)"_      | `[MIỄN KIỂM]` (Màu xanh teal nhạt)         | Không ảnh hưởng tiến độ nộp phiếu             |
| **`TRIGGERED_PENDING`** (Đã kích hoạt, chưa nhập) | Viền cam đậm (`border-amber-400`), nền vàng nhạt   | **`enabled = true`**  | _"Bắt buộc nhập kết quả..."_ | `[CHỜ KẾT QUẢ]` (Màu cam, nhấp nháy pulse) | **CHẶN SUBMIT HOÀN TOÀN** (`disabled = true`) |
| **`TRIGGERED_PASS`** (Đã nhập kết quả phụ ĐẠT)    | Viền xanh lá (`border-emerald-300`), nền xanh nhạt | `enabled = true`      | -                            | `[ĐẠT (THAY THẾ)]` (Màu xanh lá đậm)       | Cho phép Submit nếu các chỉ tiêu khác đạt     |
| **`TRIGGERED_FAIL`** (Đã nhập kết quả phụ K.ĐẠT)  | Viền đỏ (`border-red-400`), nền đỏ nhạt            | `enabled = true`      | -                            | `[K.ĐẠT]` (Màu đỏ tươi)                    | Chuyển trạng thái phiếu sang FAIL             |

---

### 4. QUY ĐỊNH BẢO TOÀN SỐ 0 TRÊN FORM NHẬP

- Khi Kiểm nghiệm viên gõ `0` hoặc `0.0`:
  - Ô input giữ nguyên số `0`.
  - Hệ thống tự động nhận diện đây là giá trị hợp lệ, đánh giá Đạt (nếu trong ngưỡng $0 \le max$), không bao giờ hiện placeholder rỗng.

---

### 5. LƯỢNG GIÁ ĐẦU RA (OUTPUT)

- Khi Kiểm nghiệm viên bấm "Lưu bản thảo": Cập nhật mảng `results` trong Firebase.
- Khi bấm "Gửi thẩm tra": Phiếu chuyển sang trạng thái `SUBMITTED`, toàn bộ các ô input tự động chuyển sang chế độ `readOnly`.
