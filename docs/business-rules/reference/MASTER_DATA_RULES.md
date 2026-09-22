# PQM — BỘ QUY TẮC NGHIỆP VỤ: MASTER DATA RULES

# (QUY TẮC DỮ LIỆU DANH MỤC GỐC & TỔ CHỨC)

> **Mã tài liệu**: `BR-CATALOG-MASTER-DATA`  
> **Thư mục**: `docs/business-rules/MASTER_DATA_RULES.md`  
> **Phân hệ**: `MOD-01` (Master Data & Organization Workflow)  
> **Tuân thủ**: GAMP 5, US FDA 21 CFR Part 11, Dược điển Việt Nam V

---

### BR-MST-001: Độc Lập & Toàn Vẹn Của Mã Danh Mục Gốc (Master Data Integrity)

- **Rule ID**: `BR-MST-001`
- **Purpose**: Đảm bảo tất cả các thực thể danh mục nền tảng (Phòng Lab, Dây chuyền, Đơn vị tính, Loại bao bì) có định danh duy nhất và không bị trùng lặp ngữ nghĩa.
- **Actor**: Quản trị viên hệ thống (`ADMIN`).
- **Trigger**: Khi tạo mới hoặc cập nhật một mục danh mục gốc trên giao diện Quản trị.
- **Input**: `entityType: string`, `code: string`, `name: string`.
- **Preconditions**: Người dùng đăng nhập với vai trò `ADMIN`.
- **Decision Logic**:
  ```
  codeNormalized = trim(toUpperCase(code))
  IF EXISTS(entity in MasterCollection WHERE toUpperCase(entity.code) == codeNormalized AND entity.id != currentId)
      THEN REJECT with error "Mã danh mục đã tồn tại trong hệ thống"
  ELSE
      ALLOW save
  ```
- **Decision Table**:
  | Trường hợp | Code nhập vào | Code đã có trên hệ thống | Kết quả thẩm định | Trạng thái |
  | :--- | :--- | :--- | :--- | :--- |
  | 1 | `LAB-QC` | `LAB-QC` | Từ chối | `DUPLICATE_CODE` |
  | 2 | `lab-qc` | `LAB-QC` | Từ chối (không phân biệt hoa thường) | `DUPLICATE_CODE` |
  | 3 | `LAB-MICRO` | `LAB-QC` | Chấp thuận | `SUCCESS` |
- **Output**: `isValid: boolean`, `errorCode?: string`.
- **State Transition**: Không thay đổi trạng thái quy trình.
- **UI Behavior**: Viền đỏ ô nhập `code`, hiển thị thông báo lỗi trực tiếp dưới trường nhập liệu, vô hiệu hóa nút "Lưu".
- **Report / CoA Behavior**: Không áp dụng.
- **Audit Requirement**: Ghi nhận hành động `CREATE_MASTER_DATA` hoặc `UPDATE_MASTER_DATA` vào chuỗi kiểm toán ALCOA+.
- **Forbidden Behavior**: Cấm tự động cắt bớt khoảng trắng mà không báo lỗi nếu code chứa ký tự đặc biệt không hợp lệ.
- **Exception Handling**: Nếu mất kết nối cơ sở dữ liệu, hiển thị banner lỗi mạng, không lưu tạm cục bộ đối với dữ liệu cấu hình hệ thống.
- **Test Cases**: `TC-BR-MST-001-A` (Code trùng lặp), `TC-BR-MST-001-B` (Code chữ thường), `TC-BR-MST-001-C` (Code hợp lệ).

---

### BR-MST-002: Phân Cấp & Phạm Vi Kiểm Nghiệm Của Phòng Lab (Laboratory Scope Enforcement)

- **Rule ID**: `BR-MST-002`
- **Purpose**: Đảm bảo phiếu kiểm nghiệm chỉ được giao và ký duyệt bởi đúng phòng kiểm nghiệm có năng lực được cấp phép (Hóa lý, Vi sinh, Độc chất).
- **Actor**: Trưởng phòng QC, Kỹ thuật viên Lab (`QC_ANALYST`, `LAB_MANAGER`).
- **Trigger**: Khi phân công phiếu kiểm nghiệm (`SC-11`) hoặc tạo phiếu mới.
- **Input**: `labId: string`, `criteriaCategory: string` (`PHYSICOCHEMICAL` | `MICROBIOLOGICAL` | `SAFETY`).
- **Preconditions**: Phòng Lab có trạng thái `status === 'ACTIVE'`.
- **Decision Logic**:
  ```
  lab = getLaboratory(labId)
  IF NOT lab.isAccredited
      THEN REJECT "Phòng kiểm nghiệm chưa được cấp chứng chỉ hiệu lực"
  IF criteriaCategory NOT IN lab.authorizedScopes
      THEN REJECT "Chỉ tiêu không thuộc phạm vi kiểm nghiệm được ủy quyền của phòng Lab này"
  ELSE
      ALLOW assignment
  ```
- **Decision Table**:
  | Chỉ tiêu | Loại | Phạm vi Lab A | Phạm vi Lab B | Phân công Lab A | Phân công Lab B |
  | :--- | :--- | :--- | :--- | :--- | :--- |
  | Định lượng | Hóa lý | Hóa lý | Vi sinh | Hợp lệ | Bị từ chối |
  | Giới hạn vi sinh | Vi sinh | Hóa lý | Vi sinh | Bị từ chối | Hợp lệ |
- **Output**: `canAssign: boolean`, `rejectionReason?: string`.
- **State Transition**: Không chuyển trạng thái Lô.
- **UI Behavior**: Bộ lọc danh sách phòng Lab chỉ hiển thị các đơn vị có phạm vi tương thích với loại chỉ tiêu cần kiểm.
- **Report / CoA Behavior**: Trên phiếu in CoA phải in rõ tên Phòng Lab chịu trách nhiệm thực hiện từng phép thử.
- **Audit Requirement**: Bắt buộc ghi log sự kiện phân công phiếu vào `audit_logs` với `actorId` và `labId`.
- **Forbidden Behavior**: Cấm gộp kết quả Vi sinh vào phiếu Hóa lý nếu hai phòng Lab hoạt động độc lập và có chứng chỉ riêng.
- **Exception Handling**: Trường hợp phòng Lab ngoài (Outsourced Lab / Viện kiểm nghiệm trung ương), bắt buộc đính kèm số chứng chỉ ISO/IEC 17025.
- **Test Cases**: `TC-BR-MST-002-A` (Phân công đúng phạm vi), `TC-BR-MST-002-B` (Phân công sai phạm vi).

---

### BR-MST-003: Chuẩn Hóa Danh Mục Đơn Vị Đo Lường Theo Dược Điển (Pharma Unit Normalization)

- **Rule ID**: `BR-MST-003`
- **Purpose**: Đảm bảo tất cả đơn vị đo lường trong TCCS, Phiếu kiểm nghiệm và Báo cáo CoA tuân thủ đúng chuẩn Dược điển (DĐVN V, USP, BP), ngăn chặn lỗi diễn giải sai hàm lượng.
- **Actor**: Toàn bộ người dùng (`QC`, `QA`, `R&D`).
- **Trigger**: Khi nhập chỉ tiêu trong TCCS hoặc kết quả kiểm nghiệm.
- **Input**: `rawUnit: string`.
- **Preconditions**: Chuỗi `rawUnit` không rỗng.
- **Decision Logic**:
  ```
  normalizedUnit = normalizeUnit(rawUnit)
  IF normalizedUnit == NULL
      THEN Báo lỗi đơn vị không xác định
  ELSE
      Gán đơn vị chuẩn (vd: mg/kg -> ppm; cfu/g -> CFU/g; g/100ml -> % (w/v))
  ```
- **Decision Table**:
  | Đơn vị nhập thô | Đơn vị chuẩn hóa | Ý nghĩa |
  | :--- | :--- | :--- |
  | `mg/kg`, `ug/g`, `ppm` | `ppm` | Phần triệu |
  | `cfu/g`, `CFU/g`, `kl/g` | `CFU/g` | Đơn vị khuẩn lạc trên gram |
  | `%`, `w/w`, `g/100g` | `% (w/w)` | Tỷ lệ khối lượng trên khối lượng |
  | `g/100ml`, `w/v` | `% (w/v)` | Tỷ lệ khối lượng trên thể tích |
- **Output**: `standardUnit: string`.
- **State Transition**: Không đổi trạng thái.
- **UI Behavior**: Tự động gợi ý và định dạng về đơn vị chuẩn khi người dùng rời khỏi ô nhập liệu (blur event).
- **Report / CoA Behavior**: Trên CoA chỉ in đơn vị chuẩn hóa, không in đơn vị thô gõ tay.
- **Audit Requirement**: Lưu cả giá trị gốc và đơn vị chuẩn hóa nếu có chuyển đổi tự động.
- **Forbidden Behavior**: Cấm tự ý chuyển đổi giữa các thứ nguyên khác nhau (ví dụ: cấm đổi từ `ppm` sang `CFU/g`).
- **Exception Handling**: Nếu người dùng nhập đơn vị chưa có trong từ điển Dược điển, yêu cầu xác nhận của Trưởng phòng QC trước khi lưu.
- **Test Cases**: `TC-BR-MST-003-A` (Chuẩn hóa ppm), `TC-BR-MST-003-B` (Chuẩn hóa CFU/g).
