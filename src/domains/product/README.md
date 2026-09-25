# PRODUCT DOMAIN BOUNDED CONTEXT

## 1. Phân Tầng Kiến Trúc (Architecture Slices)

- `domain/`: Kiểu dữ liệu (`types.ts`) và quy chuẩn nghiệp vụ thuần túy (`rules.ts`). Zero I/O.
- `application/`: `ProductAppService` và `ProductQueries`. Mọi mutation được điều phối qua `WorkflowFacade.dispatch()`.
- `infrastructure/`: `IProductRepository` kết nối tới `FirebaseProductRepository`.
- `workflow/`: Định nghĩa các Action ID gắn kết (`PRODUCT_CREATE`, `PRODUCT_UPDATE`, `PRODUCT_ARCHIVE`).
- `tests/`: Bộ kiểm thử đơn vị và tích hợp cho Product Domain.

## 2. Ranh Giới Bất Biến (Invariants)

1. Không import Firebase trực tiếp trong Domain và UI Pages của Product.
2. Mọi thay đổi dữ liệu (Create, Update, Delete, Bulk) bắt buộc thông qua `ProductAppService` và `WorkflowFacade`.
3. Cập nhật sản phẩm bắt buộc phải có kiểm tra OCC (`validateOptimisticLock`) và tăng phiên bản (`nextVersion`).
