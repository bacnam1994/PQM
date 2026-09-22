# FRS-MOD-04: Đặc Tả Nghiệp Vụ Quản Lý Công Thức Sản Xuất (Master Formula BOM)

Tài liệu này quy định chi tiết chức năng xây dựng và phê duyệt Công thức sản xuất gốc (Master Batch Formula / Bill of Materials - BOM).

---

## 1. Input & Data Schema

- `productId`: ID sản phẩm áp dụng.
- `versionNumber`: Phiên bản công thức.
- `batchSizeStandard`: Cỡ lô sản xuất quy chuẩn (VD: 200,000 viên hoặc 1,000 lít).
- `batchSizeUnit`: Đơn vị tính cỡ lô (viên, lít, kg, tuýp).
- `ingredients[]`: Danh sách thành phần nguyên vật liệu:
  - `materialId`: ID nguyên vật liệu trong danh mục.
  - `quantityPerBatch`: Số lượng tiêu chuẩn cho 1 cỡ lô.
  - `unit`: Đơn vị đo lường tương ứng.
  - `percentage`: Tỷ lệ % trong công thức.
  - `isKeyActiveIngredient`: Cờ đánh dấu hoạt chất chính.

## 2. Validation Rules

- Không được có 2 nguyên liệu trùng nhau trong cùng một công thức.
- Phải có ít nhất 1 hoạt chất chính (`isKeyActiveIngredient === true`).
- Số lượng nguyên liệu phải là số dương lớn hơn 0.
- Cỡ lô chuẩn phải là số dương lớn hơn 0.

## 3. Business Rules Reference

- `BR-FOR-001`: Tổng tỷ lệ thành phần phải bảo đảm tính toàn vẹn (100% $\pm$ dung sai tá dược độn).
- `BR-FOR-002`: Khóa bất biến công thức khi đã được phê duyệt áp dụng cho sản xuất.

## 4. State Management

- `DRAFT`: Đang xây dựng bởi phòng Nghiên cứu Phát triển (R&D).
- `APPROVED`: Đã được phê duyệt bởi Trưởng phòng Kỹ thuật / Sản xuất và QA Manager.
- `OBSOLETE`: Bị thay thế bằng công thức cải tiến.

## 5. Service Layer Contract

```typescript
export interface FormulaService {
  createDraftFormula(
    productId: string,
    batchSize: number,
    unit: string
  ): Promise<ProductFormulaContract>;
  addIngredient(formulaId: string, ingredient: IngredientInput): Promise<ProductFormulaContract>;
  removeIngredient(formulaId: string, materialId: string): Promise<ProductFormulaContract>;
  approveFormula(formulaId: string, approverId: string): Promise<ProductFormulaContract>;
  getActiveFormulaByProduct(productId: string): Promise<ProductFormulaContract>;
}
```

## 6. Permission & RBAC

- Tạo/Sửa: `RND_SPECIALIST`.
- Phê duyệt: `QA_MANAGER` & `PRODUCTION_DIRECTOR`.

## 7. Error Handling

- `ERR_FOR_DUPLICATE_MATERIAL`: Trùng lặp nguyên liệu trong công thức.
- `ERR_FOR_NO_ACTIVE_INGREDIENT`: Thiếu hoạt chất chính.

## 8. Audit Trail Requirement

- Lưu vết chi tiết từng thay đổi về định lượng nguyên vật liệu.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Phê duyệt công thức sản xuất chuẩn
  Given Công thức bản thảo cho thuốc "Paracetamol 500mg" có 1 hoạt chất và 4 tá dược
  When QA Manager và Giám đốc sản xuất ký phê duyệt
  Then Công thức chuyển sang trạng thái "APPROVED"
  And Hệ thống có thể dùng công thức này để tự động tính định mức cân nguyên liệu cho Lô mới
```
