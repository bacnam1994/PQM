# PHÂN HỆ 04: PRODUCT FORMULA WORKFLOW

## (QUY TRÌNH QUẢN LÝ CÔNG THỨC SẢN PHẨM & ĐỊNH MỨC)

> **Mã phân hệ**: `MOD-04`  
> **Tài liệu**: `docs/workflows/MOD_04_FORMULA_WORKFLOW.md`  
> **Phạm vi**: Khởi tạo công thức sản phẩm, định mức thành phần hoạt chất/tá dược, tỷ lệ tính toán hàm lượng trên CoA, quản lý phiên bản công thức.

---

### 1. MỤC ĐÍCH (PURPOSE)

Quản lý cấu trúc thành phần định tính và định lượng của sản phẩm. Công thức là cơ sở để:

1. Tính toán lượng nguyên liệu cần cân trong Lệnh sản xuất Lô.
2. Đối chiếu hàm lượng hoạt chất công bố (Declared Content) trên Phiếu phân tích kết quả (CoA).
3. Hỗ trợ thuật toán tự động ánh xạ chỉ tiêu kiểm nghiệm với hoạt chất tương ứng trong công thức (Elemental/Compound Calculation Basis).

### 2. ĐỐI TƯỢNG THAM GIA (ACTORS)

- **R&D Formulation Specialist**: Thiết lập bảng thành phần, tỷ lệ hao hụt, hàm lượng ghi nhãn.
- **QA Manager**: Phê duyệt công thức sản xuất gốc (Master Formula).
- **Production Supervisor**: Sử dụng công thức để tính toán cấp phát nguyên vật liệu.

### 3. SỰ KIỆN KÍCH HOẠT (TRIGGER)

- Khi tiếp nhận công thức chuyển giao công nghệ sản phẩm mới.
- Khi có sự điều chỉnh công thức (tối ưu tá dược, thay đổi hàm lượng hoạt chất do đăng ký lại).

### 4. DỮ LIỆU ĐẦU VÀO (INPUT)

- `id`: UUID của công thức.
- `productId`: ID sản phẩm cha.
- `version`: Phiên bản công thức (VD: `1.0`).
- `batchSizeStandard`: Cỡ lô chuẩn (VD: `100,000 viên` hoặc `500 kg`).
- `ingredients`: Danh sách thành phần:
  - `id`: UUID thành phần trong công thức.
  - `rawMaterialId`: ID nguyên liệu gốc trong kho (`MOD-05`).
  - `name`: Tên thành phần/hoạt chất (VD: `Cao Đinh lăng`, `Ginkgo Biloba`).
  - `standardAmount`: Khối lượng/hàm lượng chuẩn trên 1 đơn vị thành phẩm hoặc trên cỡ lô chuẩn.
  - `unit`: Đơn vị tính (`mg`, `g`, `ml`, `IU`).
  - `isKeyIngredient`: Đánh dấu là Hoạt chất chính cần kiểm nghiệm định lượng trên CoA.
  - `declaredContent`: Hàm lượng công bố trên nhãn.
  - `overagePercent`: Tỷ lệ bù hao hụt cho phép (nếu có).

### 5. ĐIỀU KIỆN TIÊN QUYẾT (PRECONDITIONS)

- Sản phẩm cha phải tồn tại và ở trạng thái `ACTIVE`.
- Các nguyên vật liệu trong bảng thành phần phải có mã trong Master Data (`MOD-05`).

### 6. CÁC BƯỚC THỰC THI (STEPS)

1. **Thiết lập công thức**: R&D khai báo danh sách thành phần và hàm lượng tại `SC-07`.
2. **Kiểm tra cân bằng khối lượng**: Hệ thống đối chiếu tổng khối lượng thành phần với khối lượng viên/thể tích thành phẩm đóng gói.
3. **Thẩm định & Phê duyệt**: QA Manager đối chiếu với Hồ sơ Đăng ký thuốc / Tiêu chuẩn kỹ thuật.
4. **Kích hoạt & Đóng băng**: Công thức chuyển sang `ACTIVE`. Khi tạo Lô, bản snapshot của công thức được lưu cùng hồ sơ lô.

### 7. VÒNG ĐỜI TRẠNG THÁI (STATE MACHINE)

```
[DRAFT] ──(Ký duyệt QA)──► [ACTIVE] ──(Thay đổi công thức)──► [SUPERSEDED]
   │                                                               ▲
   └────────(Hủy bỏ)────────► [ARCHIVED] ◄─────────────────────────┘
```

### 8. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-FRM-01`: Công thức bắt buộc phải định danh rõ hoạt chất chính (`isKeyIngredient`).
- `AC-FRM-02`: Bảng công thức khi đã liên kết với Lô sản xuất không được phép chỉnh sửa trực tiếp.
