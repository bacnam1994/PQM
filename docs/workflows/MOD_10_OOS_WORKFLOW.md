# PHÂN HỆ 10: OOS (OUT OF SPECIFICATION) WORKFLOW

## (QUY TRÌNH QUẢN LÝ KẾT QUẢ NGOÀI TIÊU CHUẨN)

> **Mã phân hệ**: `MOD-10`  
> **Tài liệu**: `docs/workflows/MOD_10_OOS_WORKFLOW.md`  
> **Phạm vi**: Khởi tạo hồ sơ OOS khi phát hiện chỉ tiêu kiểm nghiệm không đạt, điều tra nguyên nhân phòng lab (Phase I), điều tra nguyên nhân sản xuất (Phase II), kết luận và liên kết hành động khắc phục CAPA.

---

### 1. MỤC ĐÍCH (PURPOSE)

Tuân thủ hướng dẫn điều tra OOS của FDA và cGMP:

1. Đảm bảo mọi kết quả không đạt đều được ghi nhận ngay lập tức, không được phép thử nghiệm lại tùy tiện để lấy kết quả đạt (Testing into compliance).
2. Phân định rõ lỗi do thao tác phân tích/thiết bị phòng lab hay lỗi thực sự từ chất lượng sản phẩm.
3. Chặn đứng hoàn toàn việc xuất xưởng bất kỳ Lô nào đang có hồ sơ OOS mở.

### 2. SỰ KIỆN KÍCH HOẠT (TRIGGER)

- Khi Động cơ Đánh giá Chất lượng (`QualityEvaluationEngine`) xác định một chỉ tiêu có kết quả `FAIL` chính thức (không có quy tắc thay thế hoặc quy tắc thay thế cũng `FAIL`).

### 3. VÒNG ĐỜI TRẠNG THÁI OOS (STATE MACHINE)

```
[INITIATED] (Khởi tạo hồ sơ OOS tự động)
     │
     ▼
[PHASE_1_LAB] (Điều tra phòng kiểm nghiệm: Hóa chất, Thiết bị, Chuẩn, Tính toán)
     ├── (Xác nhận do lỗi Lab) ──────────────────────────► [INVALIDATED]
     │                                                        │ (Cho phép thử lại)
     ▼ (Không tìm thấy lỗi Lab)                               ▼
[PHASE_2_MFG] (Điều tra xưởng sản xuất)                   [RETEST_PERMITTED]
     │
     ├── (Xác nhận lỗi sản xuất / Chất lượng hỏng) ──────► [CONFIRMED_OOS]
     │                                                        │
     │                                                        ▼
     └────────────────────────────────────────────────► [CAPA_PENDING] ──► [CLOSED]
```

### 4. BẢNG QUYẾT ĐỊNH (DECISION TABLE)

| Tình huống điều tra                                                   | Kết luận                                         | Quyết định với Lô sản xuất                                                   |
| :-------------------------------------------------------------------- | :----------------------------------------------- | :--------------------------------------------------------------------------- |
| Tìm thấy bằng chứng rõ ràng về lỗi phòng lab (cân sai, dung môi hỏng) | `INVALIDATED` (Hủy kết quả ban đầu)              | Cho phép Kiểm nghiệm viên mới thực hiện phép thử lại; Lô vẫn bị giữ biệt trữ |
| Không tìm thấy lỗi phòng lab; Lỗi do pha chế/nguyên liệu              | `CONFIRMED_OOS` (Xác nhận chất lượng không đạt)  | **Lô bị chuyển ngay sang trạng thái `REJECTED`** (Từ chối xuất xưởng)        |
| Hồ sơ OOS đang mở (`INITIATED`, `PHASE_1_LAB`, `PHASE_2_MFG`)         | Bất kỳ ai cố tình bấm nút "Xuất xưởng" (Release) | **HỆ THỐNG CHẶN CỨNG (Release Gate Block)**, báo lỗi 403                     |

### 5. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-OOS-01`: Hệ thống tự động mở hồ sơ OOS khi phát sinh chỉ tiêu `FAIL`.
- `AC-OOS-02`: Lô có hồ sơ OOS chưa đóng thì Release Gate bị khóa cứng 100%.
- `AC-OOS-03`: Kết quả OOS chỉ được hủy (`INVALIDATED`) khi có chữ ký phê duyệt của cả QC Manager và QA Manager.
