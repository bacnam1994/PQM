# PHÂN HỆ 05: RAW MATERIAL & SUPPLIER WORKFLOW

## (QUY TRÌNH QUẢN LÝ NGUYÊN VẬT LIỆU & NHÀ CUNG CẤP)

> **Mã phân hệ**: `MOD-05`  
> **Tài liệu**: `docs/workflows/MOD_05_RAW_MATERIAL_WORKFLOW.md`  
> **Phạm vi**: Khởi tạo danh mục nguyên liệu, bao bì cấp 1/cấp 2, nhà cung cấp được phê duyệt (Approved Vendors), COA nguyên liệu đầu vào, trạng thái kiểm nghiệm nguyên liệu.

---

### 1. MỤC ĐÍCH (PURPOSE)

Kiểm soát chất lượng nguồn nguyên liệu đầu vào (Active Pharmaceutical Ingredients - API, tá dược, bao bì tiếp xúc trực tiếp). Đảm bảo chỉ những lô nguyên liệu đạt tiêu chuẩn và từ nhà cung cấp được QA phê duyệt mới được cấp phát đưa vào pha chế sản xuất thành phẩm.

### 2. ĐỐI TƯỢNG THAM GIA (ACTORS)

- **Kho NVL (Warehouse)**: Tiếp nhận nguyên liệu, dán nhãn biệt trữ (Quarantine).
- **QC Analyst**: Lấy mẫu, kiểm nghiệm theo Tiêu chuẩn nguyên liệu, nhập kết quả.
- **QA Manager**: Đánh giá nhà cung cấp, phê duyệt xuất xưởng nguyên liệu vào sản xuất.

### 3. SỰ KIỆN KÍCH HOẠT (TRIGGER)

- Khi nhập một lô nguyên liệu mới về kho nhà máy.
- Khi đánh giá định kỳ danh sách nhà cung cấp đạt chuẩn (Approved Vendor List - AVL).

### 4. DỮ LIỆU ĐẦU VÀO (INPUT)

- `id`: UUID của lô nguyên liệu.
- `materialCode`: Mã nguyên liệu nội bộ (VD: `NL-PARACETAMOL-01`).
- `materialName`: Tên nguyên liệu theo Dược điển.
- `supplierId`: ID nhà cung cấp được duyệt.
- `supplierBatchNumber`: Số lô của nhà sản xuất nguyên liệu.
- `internalBatchNumber`: Số kiểm nghiệm nội bộ của kho.
- `mfgDate`: Ngày sản xuất nguyên liệu.
- `expDate`: Hạn sử dụng nguyên liệu.
- `retestDate`: Ngày phải kiểm nghiệm lại (đối với hoạt chất dễ biến tính).
- `coaSupplierUrl`: File đính kèm COA của nhà sản xuất.
- `qcTestResultId`: ID phiếu kiểm nghiệm nhập kho nội bộ.
- `status`: Trạng thái (`QUARANTINE`, `RELEASED`, `REJECTED`, `EXPIRED`).

### 5. ĐIỀU KIỆN TIÊN QUYẾT (PRECONDITIONS)

- Nhà cung cấp phải nằm trong Danh mục Nhà cung cấp được phê duyệt (`AVL`) và chứng chỉ GMP/ISO còn hạn.

### 6. CÁC BƯỚC THỰC THI (STEPS)

1. **Nhập kho & Biệt trữ**: Kho tiếp nhận, hệ thống gán trạng thái `QUARANTINE`.
2. **Lấy mẫu kiểm nghiệm**: QC lấy mẫu theo quy trình lấy mẫu chuẩn (AQL / Dược điển).
3. **Thẩm định chất lượng**: Đánh giá theo tiêu chuẩn nguyên liệu.
4. **Quyết định sử dụng**:
   - Nếu Đạt ➔ QA chuyển sang trạng thái `RELEASED` (Cho phép xuất kho sản xuất).
   - Nếu Không đạt ➔ Chuyển sang `REJECTED` (Niêm phong, trả về nhà cung cấp).

### 7. VÒNG ĐỜI TRẠNG THÁI (STATE MACHINE)

```
[QUARANTINE] ──(Kiểm nghiệm ĐẠT)──► [RELEASED] ──(Hết hạn sử dụng)──► [EXPIRED]
      │                                    │
      └──(Kiểm nghiệm KHÔNG ĐẠT)           └────(Có sai lệch phát sinh)──► [BLOCKED]
                   │
                   ▼
              [REJECTED]
```

### 8. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-RAW-01`: Tuyệt đối cấm cấp phát nguyên liệu đang ở trạng thái `QUARANTINE` hoặc `REJECTED` vào lệnh sản xuất thành phẩm.
- `AC-RAW-02`: Hệ thống phải tự động cảnh báo và chặn xuất kho các lô nguyên liệu quá hạn kiểm nghiệm lại (`retestDate`).
