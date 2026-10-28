# Change Request Domain (Vertical Slice 10)

## 1. Trách nhiệm & Phạm vi

- Quản lý toàn diện quy trình kiểm soát Yêu cầu Thay đổi (Change Request - CR) trong sản xuất, kiểm nghiệm và tiêu chuẩn chất lượng theo chuẩn **GMP-WHO**, **ICH Q10** (Pharmaceutical Quality System) và **ICH Q9** (Quality Risk Management).
- Quy trình chuẩn hóa: `DRAFT ➔ IMPACT_ASSESSMENT (FMEA) ➔ QA_REVIEW ➔ APPROVED ➔ IMPLEMENTATION ➔ EFFECTIVENESS_VERIFICATION ➔ CLOSED`.
- Quản lý đánh giá rủi ro FMEA (Severity, Probability, Detectability, RPN, Risk Level).
- Theo dõi danh mục hành động (Action Items) và đảm bảo nguyên tắc: không đóng CR khi còn hành động chưa hoàn thành.
- Đóng CR bắt buộc có thẩm quyền QA/Admin.

## 2. Cấu trúc thư mục

- `domain/`: Định nghĩa kiểu dữ liệu (`types.ts`), quy tắc nghiệp vụ FMEA và trạng thái (`rules.ts`).
- `application/`: Application Service (`service.ts`) và Read Queries (`queries.ts`).
- `infrastructure/`: Repository binding với Firebase Realtime Database (`repository.ts`).
- `workflow/`: Định nghĩa hành động canonical và nhãn hiển thị (`definitions.ts`).
- `tests/`: Bộ kiểm thử tự động toàn diện (`changeRequestDomain.test.ts`).

## 3. Quy tắc ranh giới (Boundaries)

- Mọi thao tác ghi/đổi trạng thái phải qua `WorkflowFacade.dispatch()`.
- UI truy cập thông qua `changeControlAppService` hoặc `changeControlQueries`.
- Không direct mutation vào Firebase ngoài Repository.
