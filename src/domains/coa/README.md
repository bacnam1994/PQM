# CoA Domain (Vertical Slice 11)

## 1. Trách nhiệm & Phạm vi

- Quản lý việc sinh, ký duyệt điện tử (21 CFR Part 11) và thu hồi Phiếu Kiểm Nghiệm Phân Tích (Certificate of Analysis - CoA) theo chuẩn **GMP-WHO**, **ALCOA+** và **ICH Q10**.
- **Nguyên tắc bất biến BR-COA-001**: 100% dữ liệu trên CoA được trích xuất trực tiếp từ `EvaluationSnapshot` đã niêm phong chữ ký băm SHA-256. TUYỆT ĐỐI CẤM tự tính toán lại chỉ tiêu hoặc sửa đổi kết quả tại thời điểm in ấn / xuất bản.
- **Nguyên tắc BR-COA-002**: Tự động tổng hợp danh sách Footnote giải trình cho các chỉ tiêu được Miễn kiểm (`EXEMPTED`) hoặc Thay thế (`ALTERNATE`).
- **Nguyên tắc BR-COA-003**: Kiểm tra toàn vẹn băm ALCOA+ trước khi kết xuất, phát hiện và chặn đứng mọi hành vi can thiệp dữ liệu trái phép (Tamper Detection).
- **Nguyên tắc BR-COA-004**: Hỗ trợ tra cứu và xác thực CoA công khai minh bạch qua QR code (`CoAVerificationData`).

## 2. Cấu trúc thư mục

- `domain/`: Định nghĩa kiểu dữ liệu (`types.ts`), quy tắc toàn vẹn ALCOA+ và State Machine (`rules.ts`).
- `application/`: Application Service (`service.ts`) và Read Queries (`queries.ts`).
- `infrastructure/`: Repository bindings (`repository.ts`).
- `workflow/`: Định nghĩa canonical actions (`definitions.ts`).
- `tests/`: Bộ kiểm thử tự động toàn diện (`coaDomain.test.ts`).

## 3. Ranh giới kiến trúc

- Mọi đột biến CoA (`COA_GENERATE`, `COA_SIGN`, `COA_REVOKE`) đều được dispatch qua `WorkflowFacade`.
- UI truy cập thông qua `coaService` hoặc `coaQueries`.
