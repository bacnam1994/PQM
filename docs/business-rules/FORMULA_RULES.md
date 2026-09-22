# PQM — BỘ QUY TẮC NGHIỆP VỤ: FORMULA RULES

# (QUY TẮC CÔNG THỨC SẢN PHẨM & CƠ SỞ TÍNH TOÁN)

> **Mã tài liệu**: `BR-CATALOG-FORMULA`  
> **Thư mục**: `docs/business-rules/FORMULA_RULES.md`  
> **Phân hệ**: `MOD-04` (Formula Workflow)  
> **Tuân thủ**: GAMP 5, Dược điển Việt Nam V, Hồ sơ Đăng ký Thuốc

---

### BR-FOR-001: Khai Báo Hàm Lượng Công Bố & Cơ Sở Tính Toán (Declared vs Elemental Basis)

- **Rule ID**: `BR-FOR-001`
- **Purpose**: Đảm bảo cơ sở tính toán hàm lượng hoạt chất (dạng muối, dạng ngậm nước hay dạng nguyên tố quy đổi) được khai báo minh bạch, làm căn cứ cho việc tính toán % đạt trong kiểm nghiệm.
- **Actor**: Kỹ thuật viên R&D, QC Trưởng (`RD_SPECIALIST`, `QC_MANAGER`).
- **Trigger**: Khi tạo hoặc chỉnh sửa thành phần trong Công thức sản phẩm (`SC-07`).
- **Input**: `ingredient.name: string`, `declaredContent: number`, `unit: string`, `basis: 'DECLARED' | 'ELEMENTAL'`.
- **Preconditions**: `declaredContent > 0` và `unit` thuộc danh mục đơn vị hợp lệ.
- **Decision Logic**:
  ```
  IF (declaredContent <= 0)
      THEN REJECT "Hàm lượng công bố phải lớn hơn 0"
  IF (basis == 'ELEMENTAL' AND ingredient.elementalConversionFactor == NULL)
      THEN REJECT "Tính toán theo nguyên tố bắt buộc phải có hệ số quy đổi (Conversion Factor)"
  ELSE
      ALLOW save
  ```
- **Decision Table**:
  | Thành phần | Hàm lượng | Đơn vị | Cơ sở tính | Hệ số quy đổi | Kết quả |
  | :--- | :--- | :--- | :--- | :--- | :--- |
  | Paracetamol | 500 | mg | `DECLARED` | Không cần | Chấp thuận |
  | Kẽm gluconat | 70 | mg | `ELEMENTAL` | 0.143 (ra 10mg Zn) | Chấp thuận |
  | Kẽm gluconat | 70 | mg | `ELEMENTAL` | NULL | Từ chối (`MISSING_FACTOR`) |
  | Vitamin C | 0 | mg | `DECLARED` | Không cần | Từ chối (`INVALID_CONTENT`) |
- **Output**: `isValid: boolean`, `standardContentText: string`.
- **State Transition**: Không chuyển trạng thái.
- **UI Behavior**: Khi người dùng chọn cơ sở tính toán là `ELEMENTAL`, form tự động mở thêm trường nhập "Hệ số quy đổi / Hàm lượng nguyên tố tương đương" và hiển thị nhãn tính toán minh họa.
- **Report / CoA Behavior**: Trên CoA hiển thị rõ: "Kẽm (tương đương 10mg Zn từ Kẽm gluconat)".
- **Audit Requirement**: Ghi nhận `CREATE_FORMULA_ITEM` hoặc `UPDATE_FORMULA_ITEM`.
- **Forbidden Behavior**: Cấm chọn tính theo nguyên tố mà để trống hệ số quy đổi.
- **Exception Handling**: Khi có lỗi tính toán chia cho 0, trả về lỗi validation có cấu trúc.
- **Test Cases**: `TC-BR-FOR-001-A` (Hàm lượng <= 0), `TC-BR-FOR-001-B` (Elemental thiếu hệ số), `TC-BR-FOR-001-C` (Hợp lệ).

---

### BR-FOR-002: Đóng Băng Bản Sao Công Thức Tại Thời Điểm Tạo Lô (Formula Snapshot Invariance)

- **Rule ID**: `BR-FOR-002`
- **Purpose**: Đảm bảo nguyên tắc bất biến trong GMP: Mỗi Lô sản xuất phải được gắn vĩnh viễn với bản sao công thức (`formulaSnapshot`) tại thời điểm tạo Lô, không bị ảnh hưởng bởi các thay đổi công thức sau này.
- **Actor**: Hệ thống (`SYSTEM`), Kế hoạch sản xuất (`PLANNER`).
- **Trigger**: Khi tạo mới Lô sản xuất (`SC-09`).
- **Input**: `batchId: string`, `productId: string`.
- **Preconditions**: Sản phẩm có công thức hiệu lực (`status === 'ACTIVE'`).
- **Decision Logic**:
  ```
  activeFormula = getActiveFormula(productId)
  IF (activeFormula == NULL)
      THEN REJECT "Sản phẩm chưa có công thức sản xuất hiệu lực"
  snapshot = cloneDeep(activeFormula)
  snapshot.snapshotTimestamp = now()
  snapshot.formulaHash = sha256(snapshot)
  batch.formulaSnapshot = snapshot
  batch.formulaSnapshotHash = snapshot.formulaHash
  ```
- **Decision Table**:
  | Trạng thái Công thức SP | Có công thức ACTIVE | Hành động tạo Lô | Kết quả xử lý |
  | :--- | :--- | :--- | :--- |
  | Có công thức ACTIVE | Có | Tạo Lô | Nhân bản và băm SHA-256 nhúng vào Lô |
  | Chỉ có DRAFT | Không | Tạo Lô | Chặn lập Lô (`MISSING_ACTIVE_FORMULA`) |
  | Chưa có công thức | Không | Tạo Lô | Chặn lập Lô (`MISSING_FORMULA`) |
- **Output**: `formulaSnapshot: ProductFormula`, `formulaSnapshotHash: string`.
- **State Transition**: Khởi tạo Lô thành công.
- **UI Behavior**: Hiển thị thông tin công thức đã đóng băng trong tab "Hồ sơ 360°" và "Gia phả Lô".
- **Report / CoA Behavior**: Khi tính toán phần trăm theo hàm lượng công bố, luôn đối chiếu với `batch.formulaSnapshot`.
- **Audit Requirement**: Ghi vết `ATTACH_FORMULA_SNAPSHOT` vào nhật ký kiểm toán ALCOA+.
- **Forbidden Behavior**: Tuyệt đối cấm trỏ con trỏ (reference pointer) động tới công thức hiện hành mà không đóng băng snapshot.
- **Exception Handling**: Nếu quá trình tạo mã băm hash thất bại, hủy transaction tạo lô.
- **Test Cases**: `TC-BR-FOR-002-A` (Tạo lô khi thiếu công thức), `TC-BR-FOR-002-B` (Đóng băng và kiểm tra tính bất biến khi sửa công thức gốc).
