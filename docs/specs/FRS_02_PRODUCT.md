# FRS-MOD-02: Đặc Tả Nghiệp Vụ Quản Lý Danh Mục Sản Phẩm (Product Management)

Tài liệu này quy định chi tiết chức năng quản lý Hồ sơ Sản phẩm (Master Product Dossier) theo tiêu chuẩn Dược điển và GMP.

---

## 1. Input & Data Schema

- `productCode`: Mã sản phẩm duy nhất (VD: `PRD-PARA500`).
- `productName`: Tên thương mại/biệt dược.
- `genericName`: Tên gốc/hoạt chất (INN).
- `dosageForm`: Dạng bào chế (Viên nén, nang mềm, siro...).
- `strength`: Hàm lượng hoạt chất (VD: 500mg/viên).
- `packagingSpecification`: Quy cách bao gói.
- `registrationNumber`: Số đăng ký lưu hành do Cục Quản lý Dược cấp.
- `shelfLifeMonths`: Tuổi thọ bảo quản (tháng).
- `storageConditions`: Điều kiện bảo quản tiêu chuẩn.

## 2. Validation Rules

- `productCode`: Bắt buộc, không dấu, viết hoa, không trùng lặp.
- `shelfLifeMonths`: Số nguyên dương từ 1 đến 120 tháng.
- `registrationNumber`: Bắt buộc đối với thành phẩm lưu hành.

## 3. Business Rules Reference

- `BR-PRD-001`: Tính duy nhất của mã sản phẩm và số đăng ký.
- `BR-PRD-002`: Bất biến thông tin kỹ thuật sau khi đã ban hành Lô sản xuất.
- `BR-PRD-003`: Tự động cảnh báo trước 90 ngày khi số đăng ký lưu hành sắp hết hạn.

## 4. State Management

- `ACTIVE`: Sản phẩm đang lưu hành và được phép tạo lô mới.
- `DISCONTINUED`: Ngừng sản xuất (không thể tạo lô mới, nhưng vẫn truy vấn lịch sử).

## 5. Service Layer Contract

```typescript
export interface ProductService {
  createProduct(data: ProductInput): Promise<ProductContract>;
  updateProduct(
    productId: string,
    data: Partial<ProductInput>,
    reason: string
  ): Promise<ProductContract>;
  getProductById(productId: string): Promise<ProductContract>;
  listProducts(filters?: ProductFilterParams): Promise<ProductContract[]>;
  checkRegistrationExpiry(): Promise<ProductExpiryAlert[]>;
}
```

## 6. Permission & RBAC

- Tạo/Sửa Sản phẩm: Chỉ vai trò `QA_MANAGER` hoặc `RND_MANAGER`.
- Xem Sản phẩm: Toàn bộ người dùng.

## 7. Error Handling

- `ERR_PRD_CODE_EXISTS`: Trùng lặp mã sản phẩm.
- `ERR_PRD_REG_EXPIRED`: Cảnh báo số đăng ký hết hạn.

## 8. Audit Trail Requirement

- Lưu vết mọi sự thay đổi thông tin sản phẩm (đặc biệt là hạn dùng và điều kiện bảo quản).

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Khởi tạo sản phẩm thành công
  Given Người dùng có quyền "QA_MANAGER"
  When Nhập đầy đủ thông tin thuốc "Paracetamol 500mg", mã "PRD-PARA500", tuổi thọ 36 tháng
  Then Hệ thống lưu sản phẩm thành công
  And Trạng thái sản phẩm là "ACTIVE"

Scenario: Cảnh báo số đăng ký sắp hết hạn
  Given Sản phẩm "PRD-AMOX500" có số đăng ký hết hạn sau 45 ngày
  When Hệ thống chạy kiểm tra định kỳ hàng ngày
  Then Một cảnh báo "EXPIRY_WARNING" được gửi tới QA Manager
```
