# 🔒 SỔ ĐĂNG KÝ THẨM QUYỀN ĐỘC TÔN (PQM CANONICAL AUTHORITY REGISTRY V1)

> **Mã văn bản:** `PQM_CANONICAL_AUTHORITY_REGISTRY_V1.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Nguyên tắc bất biến:** Mỗi loại Authority chỉ được có DUY NHẤT 1 Canonical Owner (0 Duplicate Authority).

---

## 1. BẢNG PHÂN ĐỊNH CHỦ SỞ HỮU ĐỘC TÔN (AUTHORITY OWNER REGISTRY)

| STT | Loại thẩm quyền (Authority Type) | Chủ sở hữu chuẩn tắc độc tôn (Canonical Owner)                             | Phạm vi & Trách nhiệm (Scope & Responsibility)                                                    | Điều cấm kỵ (Strictly Prohibited)                                    |
| :-: | -------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
|  1  | **Action Authority**             | `CANONICAL_ACTION_REGISTRY` (`src/workflow/definitions/index.ts`)          | Định danh toàn bộ các hành vi nghiệp vụ hợp lệ và metadata (RBAC, Risk, Audit, FSM).              | Cấm tạo Action ID tự do trong UI/Hook/Services.                      |
|  2  | **Workflow Authority**           | `WorkflowFacade` & `UnifiedWorkflowExecutor`                               | Điều phối tiến trình 12 bước quy chuẩn, kích hoạt Guards và điều hướng Handlers.                  | Cấm tạo workflow thứ hai hoặc bypass workflow.                       |
|  3  | **Permission Authority**         | `PermissionService` (`src/services/permissionService.ts`) & RBAC Guards    | Đánh giá năng lực thực thi (`can`, `canReleaseBatch`, `hasRole`) dựa trên 8 Canonical Roles.      | UI không tự quyết định quyền (chỉ ẩn/hiện/disable).                  |
|  4  | **Administrative State**         | Domain State Machines (`src/domain/workflow/stateMachine.ts`, Domain FSMs) | Quyết định bước chuyển trạng thái vòng đời của thực thể (Batch, TestResult, Deviation, etc.).     | Cấm tạo `localStatus`, `uiStatus` hoặc ép buộc trạng thái ngoài FSM. |
|  5  | **Technical Quality Status**     | `QualityEvaluationEngine` & `CanonicalStatusResolver`                      | Tính toán tất định kết quả chất lượng (`PASS`, `FAIL`, `PENDING`, `UNKNOWN`) từ dữ liệu chỉ tiêu. | Cấm lưu cứng quality status độc lập hoặc ghi đè từ UI.               |
|  6  | **Business Rule**                | Domain Rules (`src/domains/*/domain/rules.ts`)                             | Quy tắc nghiệp vụ thuần túy (ICH Q10, FDA 21 CFR Part 11, 7 Release Gates, SoD).                  | Cấm nhúng business rule vào UI components hay hooks.                 |
|  7  | **Validation Authority**         | Canonical Validation Layer (Zod Schemas & Domain Validators)               | Thẩm định tính hợp lệ của dữ liệu đầu vào trước khi thực thi nghiệp vụ.                           | Không được chỉ validate hời hợt ở form giao diện.                    |
|  8  | **Persistence Authority**        | 13 Repository Interfaces (`src/repositories/interfaces/`)                  | Quản lý lưu trữ bền vững (Save, Update, Delete) cho từng loại Aggregate Root.                     | Cấm ghi dữ liệu trực tiếp vào Firebase ngoài Repository.             |
|  9  | **Audit Authority**              | `OutboxAuditQueue` & `logAuditAction` (`src/workflow/events/`)             | Ghi nhận nhật ký kiểm toán ALCOA+ toàn vẹn, awaited fail-closed.                                  | Cấm tự phát sinh audit logs trùng lặp hoặc tự chế ở UI.              |
| 10  | **Signature Authority**          | `SignatureService` (`src/services/signatureService.ts`)                    | Xác thực và niêm phong chữ ký điện tử số hóa chuẩn FDA 21 CFR Part 11.                            | Cấm coi cờ boolean `signed: true` là chữ ký số.                      |
| 11  | **Event Authority**              | Outbox Queue & Event Contracts (`src/workflow/contracts/events.ts`)        | Phát hành và đồng bộ hóa các sự kiện miền sau khi giao dịch thành công.                           | Cấm emit event tùy tiện không có payload type chuẩn.                 |
| 12  | **AI Proposal Authority**        | `AIActionGuard` & `AIDraftManager` (`src/domains/ai/application/`)         | Đề xuất khuyến nghị (Advisory/Proposal), quản lý bản thảo tạm thời trong `sessionStorage`.        | Cấm AI tự động ghi dữ liệu hoặc tự duyệt trạng thái.                 |
| 13  | **Derived Data Authority**       | `CanonicalStatusResolver` & Dynamic Projectors                             | Tính toán động các chỉ số dẫn xuất trong RAM (`passRate`, `isFullyTested`, SPC, phả hệ).          | Cấm lưu trữ derived data thành trường cứng có thẩm quyền trong DB.   |
| 14  | **UI State Authority**           | Presentation Layer (`src/store/useUIStore.ts`, Local `useState`)           | Trạng thái thuần túy giao diện (mở modal, chọn tab, phân trang, sorting, theme).                  | Cấm UI state can thiệp hoặc thay thế business state.                 |

---

## 2. NGUYÊN TẮC BẤT BIẾN

1. **Một thẩm quyền — Một chủ sở hữu duy nhất**: Nếu một chức năng cần thẩm định nghiệp vụ hoặc thay đổi trạng thái, bắt buộc phải ủy nhiệm cho Canonical Owner tương ứng trong bảng trên.
2. **Kiểm tra tự động chống trùng lặp thẩm quyền**: Bất kỳ vi phạm nào tạo ra cơ quan thẩm quyền thứ hai đều bị chặn đứng bởi bài kiểm tra tự động `tests/architecture/noDuplicateAuthority.test.ts`.
