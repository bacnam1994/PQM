# PQM Formula Domain (Vertical Slice 4)

## 1. Trách nhiệm kiến trúc

Quản lý cấu trúc công thức bào chế sản phẩm (`ProductFormula`), danh sách hoạt chất (`ingredients`), danh sách tá dược (`excipients`), chuẩn hóa làm sạch định lượng (`declaredContent`, `elementalContent`), RBAC và điều phối lưu trữ qua Canonical Workflow Kernel.

## 2. Cấu trúc thư mục

- `domain/types.ts`: Interface `ProductFormula`, `FormulaIngredient`, `IFormulaRepository`.
- `domain/rules.ts`: Pure Business Rules (`FormulaRules` - validate productId, sanitize định lượng).
- `application/service.ts`: `FormulaAppService` điều phối qua `WorkflowFacade.dispatch()`.
- `application/queries.ts`: `FormulaQueries` truy vấn công thức chỉ đọc an toàn.
- `infrastructure/repository.ts`: Binding với `IFormulaRepository` và `FirebaseFormulaRepository`.
- `workflow/definitions.ts`: Danh mục Canonical Action IDs (`FORMULA_CREATE`, `FORMULA_UPDATE`, `FORMULA_ARCHIVE`).
- `tests/formulaDomain.test.ts`: Bộ kiểm thử chuyên sâu cho Formula domain.

## 3. Ranh giới kiến trúc bất biến

- UI layer không được truy cập trực tiếp Firebase Formula Repository.
- Dữ liệu định lượng `declaredContent` bắt buộc phải là số thực hợp lệ trước khi lưu trữ (Sanitization Fail-Safe).
