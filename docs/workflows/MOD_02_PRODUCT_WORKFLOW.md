# PHÂN HỆ 02: PRODUCT WORKFLOW

## (QUY TRÌNH QUẢN LÝ THÔNG TIN SẢN PHẨM)

> **Mã phân hệ**: `MOD-02`  
> **Tài liệu**: `docs/workflows/MOD_02_PRODUCT_WORKFLOW.md`  
> **Phạm vi**: Khởi tạo sản phẩm, mã SKU, số đăng ký lưu hành (SĐK/GPNK), dạng bào chế, quy cách đóng gói, vòng đời sản phẩm.

---

### 1. MỤC ĐÍCH (PURPOSE)

Xác lập hồ sơ định danh gốc của từng sản phẩm dược phẩm / thực phẩm bảo vệ sức khỏe. Là đối tượng cha (Parent Entity) liên kết trực tiếp với Công thức (Formula), Tiêu chuẩn cơ sở (TCCS), Hồ sơ Lô sản xuất (Batch) và Báo cáo chất lượng (CoA).

### 2. ĐỐI TƯỢNG THAM GIA (ACTORS)

- **R&D / Regulatory Affairs (RA)**: Khởi tạo thông tin đăng ký, tên thương mại, hoạt chất.
- **QA Manager**: Rà soát tính pháp lý (Số đăng ký, Hạn lưu hành), phê duyệt đưa sản phẩm vào hoạt động.
- **Production / QC**: Tham chiếu thông tin để tạo lệnh sản xuất và phiếu kiểm nghiệm.

### 3. SỰ KIỆN KÍCH HOẠT (TRIGGER)

- Khi tiếp nhận hồ sơ sản phẩm mới được cấp phép lưu hành hoặc sản phẩm đang nghiên cứu thử nghiệm (R&D).
- Khi gia hạn hoặc thay đổi số đăng ký thuốc/TPBVSK.

### 4. DỮ LIỆU ĐẦU VÀO (INPUT)

- `id`: Định danh duy nhất (UUID/NanoID).
- `code`: Mã sản phẩm nội bộ (Duy nhất, viết hoa, không dấu, ví dụ: `SP-HOAT-HUYET-01`).
- `name`: Tên thương mại chính thức theo giấy phép đăng ký.
- `registrationNumber`: Số đăng ký lưu hành hoặc Giấy phép nhập khẩu (VD: `VD-12345-20`).
- `registrationExpiry`: Ngày hết hạn số đăng ký.
- `dosageForm`: Dạng bào chế (Viên nén, Viên nang, Siro, Hỗn dịch...) tham chiếu từ `MOD-01`.
- `packaging`: Quy cách đóng gói (VD: `Hộp 3 vỉ x 10 viên`).
- `shelfLifeMonths`: Hạn sử dụng tiêu chuẩn (tính theo tháng).
- `storageCondition`: Điều kiện bảo quản tiêu chuẩn.
- `status`: Trạng thái (`DEVELOPMENT`, `ACTIVE`, `SUSPENDED`, `DISCONTINUED`).

### 5. ĐIỀU KIỆN TIÊN QUYẾT (PRECONDITIONS)

- Mã sản phẩm `code` chưa từng tồn tại trong hệ thống.
- Dạng bào chế phải thuộc danh mục chuẩn của `MOD-01`.

### 6. CÁC BƯỚC THỰC THI (STEPS)

1. **Soạn thảo hồ sơ**: Chuyên viên RA nhập thông tin sản phẩm tại màn hình `SC-02` / `SC-03`.
2. **Kiểm tra hợp lệ định dạng**: Hệ thống kiểm tra trùng mã `code`, định dạng ngày hết hạn số đăng ký.
3. **Thẩm định hồ sơ**: QA kiểm tra tính hợp lệ của Số đăng ký và Hạn lưu hành.
4. **Phê duyệt & Kích hoạt**: QA phê duyệt chuyển trạng thái sang `ACTIVE`.
5. **Khóa liên kết sản xuất**: Khi ở trạng thái `ACTIVE`, sản phẩm mới được phép tạo TCCS và Lệnh sản xuất Lô.

### 7. BẢNG QUYẾT ĐỊNH (DECISION TABLE)

| Điều kiện kiểm tra                                   | Hành vi của Hệ thống                                            | Trạng thái tiếp theo            |
| :--------------------------------------------------- | :-------------------------------------------------------------- | :------------------------------ |
| Số đăng ký đã hết hạn (`registrationExpiry < Today`) | Cảnh báo đỏ; Chặn tạo mới Lô sản xuất thương mại                | Cảnh báo `EXPIRED_REGISTRATION` |
| Sản phẩm ở trạng thái `SUSPENDED`                    | Chặn tạo Lô mới, chặn xuất xưởng (Release Gate) các Lô đang chờ | Giữ nguyên `SUSPENDED`          |
| Sản phẩm có các Lô đang lưu hành                     | CẤM xóa sản phẩm; chỉ cho phép chuyển sang `DISCONTINUED`       | `DISCONTINUED`                  |

### 8. VÒNG ĐỜI TRẠNG THÁI (STATE MACHINE)

```
[DEVELOPMENT] ──(Phê duyệt RA/QA)──► [ACTIVE] ──(Tạm đình chỉ)──► [SUSPENDED]
      │                                  │                              ▲
      │                                  ▼                              │
      └──────(Hủy đề án)────────► [DISCONTINUED] ◄──────────────────────┘
```

### 9. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-PRD-01`: Mã sản phẩm không được phép trùng lặp.
- `AC-PRD-02`: Chỉ sản phẩm có trạng thái `ACTIVE` và Số đăng ký còn hạn mới được phép tạo Lô sản xuất.
