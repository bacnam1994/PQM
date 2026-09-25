# PQM Material Domain (Vertical Slice 2)

## 1. Trách nhiệm kiến trúc

Quản lý toàn bộ danh mục nguyên liệu (`RawMaterial`), truy vấn, ràng buộc toàn vẹn với công thức (`ProductFormula`) và phân phối các thao tác thay đổi trạng thái qua Canonical Workflow Kernel.

## 2. Cấu trúc thư mục

- `domain/types.ts`: Interface và định nghĩa dữ liệu nguyên liệu.
- `domain/rules.ts`: Pure Business Rules (`MaterialRules` - kiểm tra tên, kiểm tra ràng buộc công thức).
- `application/service.ts`: `MaterialAppService` điều phối qua `WorkflowFacade.dispatch()`.
- `application/queries.ts`: `MaterialQueries` xử lý các tác vụ đọc chỉ tiêu/nguyên liệu không gây đột biến dữ liệu.
- `infrastructure/repository.ts`: Cầu nối với `IMaterialRepository` và Firebase implementation.
- `workflow/definitions.ts`: Định nghĩa danh sách Action IDs chuẩn (`MATERIAL_CREATE`, `MATERIAL_UPDATE`, `MATERIAL_DELETE`).
- `tests/materialDomain.test.ts`: Bộ kiểm thử chuyên biệt cho miền nguyên liệu.

## 3. Ranh giới kiến trúc bất biến

- UI layer không được gọi trực tiếp Firebase Repository mà phải qua `MaterialAppService` hoặc `MaterialQueries`.
- Không được xóa nguyên liệu khi đang được sử dụng trong bất kỳ công thức sản phẩm nào.
