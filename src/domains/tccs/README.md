# PQM TCCS Domain (Vertical Slice 3 - High-GMP)

## 1. Trách nhiệm kiến trúc

Quản lý toàn bộ vòng đời của Tiêu chuẩn cơ sở (TCCS), cấu trúc chỉ tiêu kiểm nghiệm (`Criterion`), máy trạng thái TCCS, Single Active Version per Product, phát hiện thay đổi tên chỉ tiêu và tự động đồng bộ hóa bảng bí danh (`CriteriaAlias`), cùng ánh xạ học máy (`AILearnedMapping`).

## 2. Cấu trúc thư mục

- `domain/types.ts`: Interface TCCS, Criterion, CriteriaAlias, AILearnedMapping và Repository contracts.
- `domain/rules.ts`: Pure Business Rules (`TCCSRules` - validate mã TCCS, liên kết sản phẩm, ràng buộc toàn vẹn lô sản xuất, resolve active version).
- `application/service.ts`: `TCCSAppService` điều phối qua `WorkflowFacade.dispatch()`.
- `application/queries.ts`: `TCCSQueries` truy vấn TCCS an toàn và chỉ đọc.
- `infrastructure/repository.ts`: Cầu nối với `ITCCSRepository`, `ICriteriaAliasRepository`, `IAILearnedMappingRepository`.
- `workflow/definitions.ts`: Danh mục Canonical Action IDs (`TCCS_CREATE`, `TCCS_UPDATE_DRAFT`, `TCCS_SUBMIT`, `TCCS_APPROVE`, `TCCS_REJECT`, `TCCS_REVISE`, `TCCS_OBSOLETE`, `CRITERIA_ALIAS_MAP`).
- `tests/tccsDomain.test.ts`: Bộ kiểm thử chuyên sâu cho TCCS domain.

## 3. Ranh giới kiến trúc bất biến

- Không cho phép xóa TCCS khi có bất kỳ lô sản xuất nào (`Batch`) đang tham chiếu.
- Tại một thời điểm, chỉ có duy nhất 1 bản TCCS ở trạng thái Active cho mỗi sản phẩm (Single Active Version).
- Mọi thao tác cập nhật tên chỉ tiêu phải tự động kích hoạt tiến trình kiểm tra và đồng bộ hóa Criteria Alias.
