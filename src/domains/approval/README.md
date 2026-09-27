# Approval Domain (Vertical Slice 12)

## 1. Trách nhiệm & Phạm vi

- Quản lý quy trình phê duyệt đa cấp (Multi-stage Approval Pipeline) theo chuẩn **GMP-WHO**, **21 CFR Part 11**, **EU GMP Annex 11** và **ALCOA+**.
- **Nguyên tắc Tách biệt Trách nhiệm (Segregation of Duties - SoD)**: Chặn người khởi tạo / người thực hiện tự kiểm tra hoặc tự phê duyệt bản ghi của chính mình.
- **Ràng buộc Chữ ký số (Electronic Signature)**: Bắt buộc có chữ ký số điện tử hợp lệ (kiểm chứng băm toàn vẹn) đối với các bước phê duyệt của vai trò QA hoặc quyết định `APPROVE`.
- **Rào chắn Thu hồi Phê duyệt (BR-APP-002)**: Chỉ QA hoặc ADMIN mới có thẩm quyền thu hồi/hủy phê duyệt; lý do thu hồi bắt buộc tối thiểu 30 ký tự giải trình kỹ thuật; nghiêm cấm hủy duyệt nếu Lô sản xuất liên quan đã Xuất xưởng (`RELEASED`) trừ khi Lô đã được đưa về `HOLD` hoặc `RECALLED/BLOCKED`.
- **Quy tắc Từ chối Phê duyệt**: Bắt buộc nhập lý do tối thiểu 10 ký tự giải trình cụ thể.

## 2. Cấu trúc thư mục

- `domain/`: Định nghĩa thực thể ApprovalTask, ApprovalStep (`types.ts`), quy tắc SoD, tiền điều kiện và State Machine FSM (`rules.ts`).
- `application/`: Application Service (`service.ts`) và Read Queries (`queries.ts`).
- `infrastructure/`: Repository bindings (`repository.ts`).
- `workflow/`: Định nghĩa canonical action IDs và nhãn hiển thị trạng thái (`definitions.ts`).
- `tests/`: Bộ kiểm thử tự động toàn diện (`approvalDomain.test.ts`).

## 3. Ranh giới kiến trúc

- Mọi đột biến phê duyệt (`APPROVAL_TASK_CREATE`, `APPROVAL_TASK_DECIDE`, `APPROVAL_TASK_CANCEL`) đều được điều phối qua `WorkflowFacade.dispatch()`.
- UI truy cập thông qua `approvalWorkflowService` hoặc `approvalQueries`. Tuyệt đối không import trực tiếp Firebase Repositories.
