# HỢP ĐỒNG HÀNH VI GIAO DIỆN SC-10: CHI TIẾT LÔ SẢN XUẤT & RELEASE GATE

## (SCREEN CONTRACT SC-10: BATCH DETAIL & RELEASE GATE)

> **Mã màn hình**: `SC-10`  
> **Route URL**: `/batches/:id`  
> **Component tương ứng**: `src/pages/BatchDetail.tsx`, `src/components/features/AIBatchClearanceModal.tsx`  
> **Tầm quan trọng**: 🔴 **CRITICAL - RÀO CHẮN XUẤT XƯỞNG LÔ RA THỊ TRƯỜNG**

---

### 1. DỮ LIỆU ĐẦU VÀO (INPUT DATA)

- `batch: Batch`: Dữ liệu lô bao gồm `status`, `qualityStatus`, `tccsSnapshot`, `hasActiveOOS`, `hasActiveDeviation`.
- `testResults: TestResult[]`: Toàn bộ các phiếu kiểm nghiệm của Lô.
- `currentUser: User`: Thông tin người dùng hiện tại (xác thực vai trò QA Director).

---

### 2. HIỂN THỊ TRUNG TÂM RELEASE GATE (RELEASE GATE WIDGET)

Tại góc trên bên phải màn hình chi tiết Lô, hệ thống hiển thị Khối kiểm soát xuất xưởng (Release Gate Card) với 5 đèn tín hiệu:

| Đèn kiểm tra                | Điều kiện kiểm tra                     |                     Trạng thái Đèn                      |
| :-------------------------- | :------------------------------------- | :-----------------------------------------------------: |
| **1. Chất lượng Kỹ thuật**  | `batch.qualityStatus === 'PASS'`       | 🟢 Xanh nếu PASS / 🔴 Đỏ nếu FAIL / 🟡 Vàng nếu PENDING |
| **2. Phiếu kiểm nghiệm**    | Tất cả PKN đều `APPROVED`              |     🟢 Xanh nếu đủ / 🔴 Đỏ nếu còn phiếu chưa duyệt     |
| **3. Hồ sơ OOS**            | Không có OOS đang mở (`!hasActiveOOS`) |         🟢 Xanh nếu sạch / 🔴 Đỏ nếu có OOS mở          |
| **4. Sai lệch (Deviation)** | Không có sai lệch Major/Critical mở    |       🟢 Xanh nếu sạch / 🔴 Đỏ nếu có sai lệch mở       |
| **5. Thẩm quyền Ký số**     | `currentUser.role === 'qa_director'`   |   🟢 Xanh nếu đúng quyền / ⚪ Xám nếu không đủ quyền    |

---

### 3. HÀNH VI NÚT "XUẤT XƯỞNG LÔ" (RELEASE BUTTON BEHAVIOR)

- **KHI CẢ 5 ĐÈN ĐỀU XANH (🟢)**:
  - Nút "Ký Lệnh Xuất Xưởng" hiển thị trạng thái `ENABLED`, màu xanh ngọc bích sang trọng.
  - Bấm nút ➔ Mở Modal Ký số điện tử FDA CFR Part 11 (`SC-18`).
- **KHI CÓ ÍT NHẤT 1 ĐÈN ĐỎ HOẶC VÀNG (🔴 / 🟡)**:
  - Nút "Ký Lệnh Xuất Xưởng" bị **VÔ HIỆU HÓA HOÀN TOÀN** (`disabled = true`).
  - Hover vào nút hiển thị tooltip chỉ rõ lý do chưa thể xuất xưởng.

---

### 4. HÀNH VI NÚT "PHONG TỎA KHẨN CẤP" (EMERGENCY BLOCK)

- Khi Lô đang ở trạng thái `RELEASED`:
  - Xuất hiện nút màu đỏ nổi bật: _"Phong tỏa Lô khẩn cấp"_.
  - Bấm nút ➔ Yêu cầu nhập lý do giải trình bắt buộc (tối thiểu 20 ký tự).
  - Xác nhận ➔ Lô chuyển sang `BLOCKED`, vô hiệu hóa tính hợp lệ của mã QR trên CoA in ra ngay lập tức.
