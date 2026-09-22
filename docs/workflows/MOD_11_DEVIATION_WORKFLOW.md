# PHÂN HỆ 11: DEVIATION WORKFLOW

## (QUY TRÌNH QUẢN LÝ SAI LỆCH SẢN XUẤT & KIỂM NGHIỆM)

> **Mã phân hệ**: `MOD-11`  
> **Tài liệu**: `docs/workflows/MOD_11_DEVIATION_WORKFLOW.md`  
> **Phạm vi**: Ghi nhận sự cố, phân loại mức độ sai lệch (Minor, Major, Critical), đánh giá rủi ro ảnh hưởng đến chất lượng sản phẩm, phê duyệt biện pháp xử lý tạm thời và kết luận.

---

### 1. MỤC ĐÍCH (PURPOSE)

Kiểm soát toàn diện mọi tình huống phát sinh ngoài quy trình tiêu chuẩn (SOP) hoặc lệnh sản xuất (ví dụ: mất điện trong quá trình sấy, nhiệt độ bảo quản vượt ngưỡng cho phép, rách màng lọc). Đảm bảo mọi sai lệch đều được đánh giá tác động kỹ thuật trước khi đưa ra quyết định đối với Lô hàng.

### 2. PHÂN LOẠI MỨC ĐỘ SAI LỆCH (SEVERITY CLASSIFICATION)

- **MINOR (Nhẹ)**: Không ảnh hưởng trực tiếp đến chất lượng, độ an toàn hay hiệu quả của sản phẩm (Ví dụ: Nhầm mẫu nhãn thùng carton bên ngoài đã được phát hiện trước khi đóng gói).
- **MAJOR (Nặng)**: Có khả năng ảnh hưởng đến chất lượng sản phẩm nếu không có biện pháp xử lý kịp thời (Ví dụ: Thời gian trộn kéo dài vượt 20% quy định).
- **CRITICAL (Nghiêm trọng)**: Trực tiếp đe dọa đến tính an toàn của người sử dụng hoặc vi phạm nghiêm trọng giấy phép lưu hành (Ví dụ: Nhiễm chéo hoạt chất lạ, nhiệt độ tiệt trùng không đạt yêu cầu).

### 3. VÒNG ĐỜI TRẠNG THÁI (STATE MACHINE)

```
[REPORTED] ──(Đánh giá sơ bộ)──► [UNDER_INVESTIGATION] ──(Đề xuất xử lý)──► [QA_REVIEW]
                                                                               │
[CLOSED] ◄──(Hoàn tất khắc phục)── [APPROVED] ◄────────(QA Phê duyệt)──────────┘
```

### 4. TÁC ĐỘNG ĐẾN LÔ SẢN XUẤT & RELEASE GATE

- Khi một Lô phát sinh sai lệch mức độ **MAJOR** hoặc **CRITICAL**, hệ thống tự động:
  1. Gán cờ cảnh báo `hasActiveDeviation: true` lên bản ghi Lô.
  2. Khóa trạng thái xuất xưởng của Lô (`Release Gate Block`).
  3. Lô chỉ được phép chuyển sang `RELEASED` khi hồ sơ sai lệch đã được QA Manager phê duyệt chuyển sang trạng thái `CLOSED` với kết luận _"Chấp nhận xuất xưởng kèm biện pháp phòng ngừa"_.

### 5. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-DEV-01`: Sai lệch mức độ CRITICAL tự động phong tỏa Lô sản xuất liên quan.
- `AC-DEV-02`: Bắt buộc phải có phân tích nguyên nhân gốc rễ (Root Cause Analysis) đối với sai lệch MAJOR và CRITICAL.
