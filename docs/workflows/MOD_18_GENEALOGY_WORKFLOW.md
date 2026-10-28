# PHÂN HỆ 18: GENEALOGY & TRACEABILITY WORKFLOW

## (QUY TRÌNH TRUY XUẤT NGUỒN GỐC & CÂY PHẢ HỆ LÔ SẢN XUẤT)

> **Mã phân hệ**: `MOD-18`  
> **Tài liệu**: `docs/workflows/MOD_18_GENEALOGY_WORKFLOW.md`  
> **Phạm vi**: Cấu trúc liên kết phả hệ (Batch Genealogy), truy xuất ngược (Backward Trace), truy xuất xuôi (Forward Trace), cô lập nhanh phạm vi ảnh hưởng khi thu hồi sản phẩm.

---

### 1. MỤC ĐÍCH (PURPOSE)

Đáp ứng tiêu chuẩn thực hành sản xuất tốt (WHO-GMP, EU-GMP) về khả năng truy xuất nguồn gốc hai chiều tức thì trong vòng dưới 2 giờ khi có yêu cầu thu hồi thuốc khẩn cấp:

1. **Truy xuất ngược (Backward)**: Từ một hộp thuốc trên thị trường ➔ Tra cứu được Số lô thành phẩm ➔ Lô bán thành phẩm ➔ Các lô nguyên vật liệu và nhà cung cấp tương ứng.
2. **Truy xuất xuôi (Forward)**: Từ một lô nguyên liệu bị phát hiện nhiễm độc tố/hỏng ➔ Tìm ra ngay lập tức tất cả các lô thành phẩm đã sử dụng lô nguyên liệu này để phong tỏa.

---

### 2. MÔ HÌNH CÂY PHẢ HỆ 2 CHIỀU (GENEALOGY MODEL)

```
[Nhà cung cấp A] ──► [Lô API Paracetamol #P01] ────┐
                                                   ├──► [Lô Bán TP Cốm #B01] ──► [Lô Thành phẩm #TP01]
[Nhà cung cấp B] ──► [Lô Tá dược Tinh bột #T02] ───┘                                     │
                                                                                         ▼
                                                                             [Đại lý / Bệnh viện X, Y]
```

---

### 3. CÁC TÍNH NĂNG CỐT LÕI

1. **Trực quan hóa Cây phả hệ (Genealogy Graph)**: Hiển thị sơ đồ dạng cây tương tác tại màn hình `SC-21`.
2. **Nút bấm "Kích hoạt điều tra thu hồi" (Recall Scope Analyzer)**: Chỉ định 1 lô nguyên liệu hoặc bán thành phẩm, hệ thống tự động quét đồ thị và liệt kê danh sách toàn bộ các Lô thành phẩm liên quan.

---

### 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-GEN-01`: Hệ thống phải truy xuất được danh sách nguyên liệu của lô thành phẩm trong thời gian dưới 3 giây.
- `AC-GEN-02`: Từ một lô nguyên liệu, hệ thống phải xác định chính xác 100% các lô thành phẩm liên quan.
