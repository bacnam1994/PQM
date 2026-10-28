# Master Data Domain (Vertical Slice 13)

## 1. Trách nhiệm & Phạm vi

- Quản lý danh mục Dữ liệu Chủ (Master Data) phục vụ chuẩn hóa toàn hệ thống theo chuẩn **GMP-WHO**, **ALCOA+** và **ICH Q10**.
- **Chỉ tiêu mẫu (Master Criteria)**: Quản lý danh mục tên chuẩn, mã, phân loại chỉ tiêu kỹ thuật; hỗ trợ đổi tên đồng loạt toàn bộ hồ sơ kiểm nghiệm lịch sử kèm Audit Trail bất biến.
- **Tiêu chuẩn Dược điển (Pharmacopoeia Standards)**: Quản lý 31+ tiêu chuẩn DĐVN V, USP, BP, EP động; rào chắn thẩm quyền QA/ADMIN và cơ chế seed mặc định có kiểm soát.
- **Đơn vị / Phòng kiểm nghiệm (Testing Laboratories)**: Quản lý danh mục đơn vị ngoại kiểm (Eurofins, Quatest 3, CASE, NIFC, Pasteur...) và nội kiểm V-Biotech; quản lý danh sách bí danh (aliases) phục vụ fuzzy matching và AI OCR extraction.

## 2. Cấu trúc thư mục

- `domain/`: Định nghĩa thực thể, kiểu dữ liệu (`types.ts`), quy tắc nghiệp vụ và xác thực thẩm quyền (`rules.ts`).
- `application/`:
  - `masterCriterionService.ts`: Application service cho Chỉ tiêu mẫu.
  - `pharmacopoeiaService.ts`: Application service cho Dược điển.
  - `laboratoryService.ts`: Application service cho Phòng kiểm nghiệm.
  - `queries.ts`: Truy vấn dữ liệu đồng nhất (`MasterDataQueries`).
- `infrastructure/`: Repository bindings cho Firebase RTDB (`repository.ts`).
- `workflow/`: Định nghĩa canonical action IDs (`definitions.ts`).
- `tests/`: Bộ kiểm thử tự động toàn diện (`masterDataDomain.test.ts`).

## 3. Ranh giới kiến trúc

- Mọi thao tác ghi nhận Master Data đều phải tuân thủ nghiêm ngặt RBAC (QA/ADMIN) và ghi log kiểm toán ALCOA+.
- UI truy cập thông qua các application services (`masterCriterionAppService`, `pharmacopoeiaAppService`, `laboratoryAppService`) hoặc `masterDataQueries`. Tuyệt đối cấm import trực tiếp Firebase Repositories từ giao diện.
