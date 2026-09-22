# FRS-MOD-01: Đặc Tả Nghiệp Vụ Quản Trị Dữ Liệu Nền (Master Data Management)

Tài liệu này quy định chi tiết chức năng quản trị danh mục dữ liệu dùng chung (Master Data: Đơn vị đo, Nhà cung ứng, Thiết bị kiểm nghiệm, Dạng bào chế) theo tiêu chuẩn GAMP 5.

---

## 1. Input & Data Schema

- `category`: Phân loại danh mục (`UNIT`, `SUPPLIER`, `EQUIPMENT`, `DOSAGE_FORM`).
- `code`: Mã định danh chuẩn hóa (In hoa, không dấu, viết liền/dấu gạch dưới, VD: `MG`, `SUP_DHG_01`).
- `name`: Tên hiển thị đầy đủ (VD: `Milligram`, `Công ty CP Dược Hậu Giang`).
- `description`: Mô tả chi tiết hoặc thông số kỹ thuật.
- `metadata`: Cấu trúc JSON mở rộng tùy theo danh mục (ví dụ: chu kỳ bảo dưỡng thiết bị, địa chỉ nhà cung ứng).

## 2. Validation Rules

- `code` là bắt buộc, độ dài từ 2 đến 30 ký tự, chỉ chứa `[A-Z0-9_-]`, duy nhất trong cùng danh mục.
- `name` không được để trống, không chứa ký tự điều khiển nguy hiểm (XSS/SQL injection protection).
- Không cho phép nhập mã trùng lặp (Case-insensitive check).

## 3. Business Rules Reference

- `BR-MST-001`: Mã danh mục phải là duy nhất và chuẩn hóa.
- `BR-MST-002`: Cấm xóa vật lý khi dữ liệu nền đã được liên kết với bất kỳ Lô, TCCS, hoặc Công thức nào.
- `BR-MST-003`: Kiểm soát chu kỳ hiệu chuẩn định kỳ của thiết bị kiểm nghiệm.

## 4. State Management

- `ACTIVE`: Đang áp dụng bình thường.
- `INACTIVE`: Tạm ngừng áp dụng (không xuất hiện trong dropdown chọn mới, nhưng vẫn hiển thị ở hồ sơ cũ).

## 5. Service Layer Contract

```typescript
export interface MasterDataService {
  createItem(category: string, data: MasterDataInput): Promise<MasterDataItem>;
  updateItem(id: string, data: Partial<MasterDataInput>, reason: string): Promise<MasterDataItem>;
  deactivateItem(id: string, reason: string): Promise<void>;
  listByCategory(category: string, includeInactive?: boolean): Promise<MasterDataItem[]>;
}
```

## 6. Permission & RBAC

- Quyền Xem: Toàn bộ người dùng đăng nhập (`ANALYST`, `QA`, `PRODUCTION`).
- Quyền Tạo / Sửa / Vô hiệu hóa: Chỉ dành cho `QA_MANAGER` và `SYSTEM_ADMIN`.

## 7. Error Handling

- `ERR_MST_DUPLICATE_CODE`: Báo lỗi khi mã đã tồn tại.
- `ERR_MST_IN_USE`: Báo lỗi khi cố gắng vô hiệu hóa danh mục đang có giao dịch mở.

## 8. Audit Trail Requirement

- Bắt buộc ghi nhận vết kiểm toán ALCOA+ cho mọi thao tác Thêm / Sửa / Khóa kèm lý do.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Thêm mới đơn vị đo hợp lệ
  Given Người dùng đăng nhập với quyền "QA_MANAGER"
  When Người dùng thêm đơn vị đo với mã "MCG" và tên "Microgram"
  Then Hệ thống lưu thành công và trả về mã trạng thái 201
  And Một bản ghi Audit Trail được tạo ghi nhận người tạo

Scenario: Cấm xóa đơn vị đo đã phát sinh giao dịch kiểm nghiệm
  Given Đơn vị đo "MG" đang được dùng trong TCCS "TCCS-PARA-01"
  When Quản trị viên cố gắng xóa vĩnh viễn đơn vị "MG"
  Then Hệ thống từ chối với lỗi "ERR_MST_IN_USE"
  And Trạng thái của đơn vị đo vẫn là "ACTIVE"
```
