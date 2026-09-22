# BỘ QUY TẮC NGHIỆP VỤ 01: PRODUCT RULES

## (QUY TẮC QUẢN LÝ SẢN PHẨM & MÃ SẢN PHẨM)

> **Mã tài liệu**: `BR-CATALOG-01`  
> **Thư mục**: `docs/business-rules/BR_01_PRODUCT_RULES.md`  
> **Phân hệ liên quan**: `MOD-02` (Product Workflow)

---

### BR-PRD-001: Tính Duy Nhất Của Mã Sản Phẩm (Product Code Uniqueness)

- **Mục đích**: Đảm bảo mỗi sản phẩm trong danh mục có định danh nội bộ duy nhất, không trùng lặp, dùng làm khóa liên kết.
- **Trigger**: Khi người dùng nhập hoặc sửa `code` của sản phẩm tại màn hình `SC-02` / `SC-03`.
- **Input**: `code: string`, `productId?: string` (khi cập nhật).
- **Precondition**: `code` không được rỗng sau khi `trim()`.
- **Điều kiện & Quyết định**:
  - Chuẩn hóa: `normalizedCode = code.trim().toUpperCase()`.
  - Nếu tồn tại bất kỳ sản phẩm nào khác có `code.toUpperCase() === normalizedCode` ➔ **TỪ CHỐI (REJECT)**.
- **Output**: `isValid: boolean`, `errorMessage?: string`.
- **UI Behavior**: Báo đỏ viền input, hiển thị thông báo lỗi tức thì: _"Mã sản phẩm đã tồn tại trong hệ thống"_. Nút "Lưu" bị vô hiệu hóa (`disabled`).
- **Forbidden Behavior**: Không phân biệt chữ hoa/thường để tạo 2 mã trùng ngữ nghĩa (ví dụ: `SP01` và `sp01` là trùng nhau).
- **Audit Requirement**: Ghi nhận mã vi phạm nếu có nghi vấn can thiệp API.
- **Test Cases**: `TC-BR-PRD-001-A` (Code trùng lặp), `TC-BR-PRD-001-B` (Code chữ thường trùng chữ hoa), `TC-BR-PRD-001-C` (Code hợp lệ duy nhất).

---

### BR-PRD-002: Kiểm Soát Hạn Hiệu Lực Số Đăng Ký (Registration Expiry Enforcement)

- **Mục đích**: Ngăn ngừa việc lập lệnh sản xuất thương mại cho các sản phẩm đã hết hạn giấy phép lưu hành theo quy định của Cục Quản lý Dược.
- **Trigger**: Khi người dùng chọn Sản phẩm để tạo Lô sản xuất mới (`SC-09`).
- **Input**: `product.registrationExpiry: string (YYYY-MM-DD)`, `batch.mfgDate: string`.
- **Precondition**: Sản phẩm có `registrationExpiry`.
- **Điều kiện & Quyết định**:
  ```
  IF (batch.mfgDate > product.registrationExpiry)
      THEN Chặn tạo Lô thương mại
      Hiển thị trạng thái: REGISTRATION_EXPIRED
  ELSE
      Cho phép tiếp tục
  ```
- **Output**: `canProduce: boolean`.
- **UI Behavior**: Hiển thị Banner cảnh báo màu đỏ tại Form tạo Lô: _"Số đăng ký của sản phẩm đã hết hạn vào ngày [Ngày]. Không thể lập lệnh sản xuất thương mại."_
- **Exception**: Trường hợp Lô sản xuất thử nghiệm (R&D / Pilot) có cờ `isResearchBatch: true` thì được phép sản xuất nhưng tự động khóa chốt chặn Release Gate không cho ra thị trường.
- **Audit Requirement**: Ghi vết cảnh báo nếu cố tình chọn sản phẩm hết hạn.
- **Test Cases**: `TC-BR-PRD-002-A` (Sản xuất sau ngày hết hạn SĐK ➔ Chặn), `TC-BR-PRD-002-B` (Sản xuất trước ngày hết hạn ➔ Cho phép).

---

### BR-PRD-003: Chống Xóa Vật Lý Sản Phẩm Đã Phát Sinh Dữ Liệu (No Hard Delete)

- **Mục đích**: Bảo toàn tính toàn vẹn liên kết lịch sử lô và kiểm toán GMP.
- **Trigger**: Khi người dùng bấm nút "Xóa sản phẩm" tại `SC-02`.
- **Input**: `productId: string`.
- **Precondition**: Người dùng có quyền `ADMIN`.
- **Điều kiện & Quyết định**:
  ```
  IF (Đã tồn tại ít nhất 1 Lô sản xuất HOẶC 1 TCCS liên kết với productId)
      THEN CẤM XÓA VẬT LÝ (FORBIDDEN)
      Chỉ cho phép chuyển trạng thái sang DISCONTINUED (Ngưng kinh doanh)
  ELSE
      Cho phép xóa hoàn toàn (chỉ áp dụng cho sản phẩm thử nghiệm vừa tạo nhầm)
  ```
- **UI Behavior**: Modal xác nhận giải thích: _"Sản phẩm đã có dữ liệu sản xuất liên kết. Hệ thống sẽ chuyển trạng thái sang 'Ngưng hoạt động' để bảo toàn hồ sơ chất lượng."_
- **Test Cases**: `TC-BR-PRD-003-A` (Có lô ➔ Cấm xóa), `TC-BR-PRD-003-B` (Chưa có dữ liệu ➔ Cho phép xóa).
