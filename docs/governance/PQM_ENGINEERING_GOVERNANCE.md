# 🏛️ HIẾN PHÁP QUẢN TRỊ KỸ THUẬT HỆ THỐNG PQM (ENGINEERING GOVERNANCE)

> **Mã văn bản:** `PQM_ENGINEERING_GOVERNANCE.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Cơ sở nền tảng:** Clean Architecture, Domain-Driven Design (DDD), Master Workflow (`ADR-001`, `PQM_SYSTEM_WORKFLOW_MASTER.md`), 21 CFR Part 11, ICH Q10, GMP-WHO  
> **Đối tượng áp dụng:** Toàn bộ kỹ sư phát triển phần mềm, AI Coding Assistants (Vibecode/Antigravity) và Reviewers

---

## 1. NGUYÊN TẮC TỐI THƯỢNG (SUPREME INVARIANT)

Mọi hoạt động phát triển, sửa lỗi, tối ưu hay mở rộng tính năng trong hệ thống PQM bắt buộc phải tuân thủ nghiêm ngặt **Luồng Thực thi Chuẩn tắc duy nhất (Canonical Execution Flow)**:

```text
       ┌────────────────────────┐
       │        UI Layer        │ (Pages / Components)
       └───────────┬────────────┘
                   │ invokes
                   ▼
       ┌────────────────────────┐
       │   Feature Hook Layer   │ (useWorkflowActions / queries)
       └───────────┬────────────┘
                   │ dispatches
                   ▼
       ┌────────────────────────┐
       │    Workflow Kernel     │ (WorkflowFacade.dispatch(actionId, payload))
       └───────────┬────────────┘
                   │ evaluates
                   ▼
       ┌────────────────────────┐
       │ 12-Step Security Guard │ (RBAC, OCC, Reason, Signature 21 CFR Part 11)
       └───────────┬────────────┘
                   │ routes
                   ▼
       ┌────────────────────────┐
       │  Application Service   │ (Domain App Service / Workflow Handlers)
       └───────────┬────────────┘
                   │ enforces
                   ▼
       ┌────────────────────────┐
       │   Domain Layer & FSM   │ (Domain Rules, Entity State Machine)
       └───────────┬────────────┘
                   │ persists
                   ▼
       ┌────────────────────────┐
       │  Repository Interface  │ (Pure Contract in src/repositories/interfaces/)
       └───────────┬────────────┘
                   │ implements
                   ▼
       ┌────────────────────────┐
       │ Infrastructure Layer   │ (Firebase Repository Implementation)
       └───────────┬────────────┘
                   │ writes
                   ▼
       ┌────────────────────────┐
       │  Firebase RTDB / Ext   │ (Realtime Database & Outbox Audit Queue)
       └────────────────────────┘
```

**CẤM TUYỆT ĐỐI CÁC ĐƯỜNG TẮT (PROHIBITED SHORTCUTS):**

- ❌ `UI ➔ Firebase`: Không được gọi trực tiếp `firebase/database` `set()`, `update()`, `push()`, `remove()` từ UI.
- ❌ `UI ➔ Repository Mutation`: Không được gọi trực tiếp `repository.save()`, `repository.delete()` từ UI hoặc Hooks.
- ❌ `UI ➔ Business State Decision`: UI không được tự quyết định trạng thái (ví dụ tự ý gán `status = 'APPROVED'`).
- ❌ `AI ➔ Direct Mutation`: Cấm tuyệt đối AI tự ý ghi dữ liệu vào Firebase/Repository mà không qua Human Confirmation.
- ❌ `Hook ➔ Business Rules`: Hook không được chứa logic chuyển trạng thái hoặc thẩm định chất lượng.

---

## 2. NGUYÊN TẮC SINGLE SOURCE OF TRUTH (SSOT)

Mỗi khái niệm trong PQM chỉ có một nguồn sự thật duy nhất và tối cao:

| Khái niệm                | Nguồn sự thật duy nhất (Single Source of Truth)                           | Ràng buộc cấm                                               |
| ------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Action Authority**     | `CANONICAL_ACTION_REGISTRY` (`src/workflow/definitions/index.ts`)         | Cấm tự tạo Action ID tự do trong UI/Hook/Service            |
| **State Authority**      | Domain State Machine (`src/domain/workflow/stateMachine.ts`, Domain FSMs) | Cấm tạo `localStatus`, `uiStatus`, `tempStatus` để thay thế |
| **Permission Authority** | RBAC Guard & Permission Matrix (`src/services/permissionService.ts`)      | UI chỉ được ẩn/hiện/disable, không được tự suy diễn quyền   |
| **Validation Authority** | Domain Rules (`src/domains/*/domain/rules.ts`)                            | Không được chỉ validate hời hợt ở UI form                   |
| **Persistence Boundary** | 13 Repository Interfaces (`src/repositories/interfaces/`)                 | Cấm ghi database bên ngoài Repository Pattern               |
| **Audit Authority**      | Outbox Audit Queue (`src/workflow/events/outboxAuditQueue.ts`)            | Cấm gọi logAuditAction trùng lặp hoặc tự chế ở UI           |

---

## 3. QUY TẮC "ONE BUSINESS ACTION = ONE CANONICAL PATH"

Mỗi nghiệp vụ chỉ được có **duy nhất 1 đường thực thi chuẩn**:

- 1 Canonical Action ID
- 1 Workflow Registry Entry
- 1 Handler / Application Service method
- 1 Domain Rule & FSM evaluation
- 1 Repository Persistence Boundary
- 1 ALCOA+ Audit Trail Record

Không được tồn tại các workflow phân nhánh song song như `AdminBatchApprove`, `QuickBatchApprove`, `AIBatchApprove`. Mọi entry point bắt buộc phải hội tụ về Canonical Path.

---

## 4. BỘ TIÊU CHUẨN CỔNG AN TOÀN (QUALITY GATES)

Mọi commit, pull request hoặc bàn giao mã nguồn phải vượt qua 5 cổng kiểm soát tự động:

1. `npm run workflow:guard`: 0 vi phạm ranh giới kiến trúc trên toàn bộ mã nguồn.
2. `tests/architecture/` (12 test suites, 46 tests): PASS 100%.
3. `npx tsc --noEmit`: 0 lỗi biên dịch TypeScript.
4. `npm test -- --run`: PASS 100% toàn bộ unit, integration, và domain regression tests.
5. `npm run build`: Build production hoàn thành sạch sẽ, không có cảnh báo nghiêm trọng.

---

## 5. HỆ THỐNG TÀI LIỆU QUẢN TRỊ KỸ THUẬT

Bộ quy tắc quản trị kỹ thuật PQM bao gồm các tài liệu chuyên đề chi tiết:

- [`PQM_VIBECODE_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/governance/PQM_VIBECODE_RULES.md): Sổ tay bắt buộc dành cho AI & kỹ sư phát triển trước mỗi task.
- [`PQM_ARCHITECTURE_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/governance/PQM_ARCHITECTURE_RULES.md): Ranh giới phân tầng và hướng phụ thuộc Clean Architecture.
- [`PQM_WORKFLOW_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/governance/PQM_WORKFLOW_RULES.md): Quy chuẩn Kernel 12 bước, Action Registry và Outbox Audit.
- [`PQM_STATE_MACHINE_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/governance/PQM_STATE_MACHINE_RULES.md): Máy trạng thái FSM, tính Fail-Closed và 7 Release Gates.
- [`PQM_DATA_MUTATION_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/governance/PQM_DATA_MUTATION_RULES.md): Quy tắc ghi dữ liệu, OCC, Idempotency và Repository Boundary.
- [`PQM_AI_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/governance/PQM_AI_RULES.md): Ranh giới an toàn AI Advisory, Proposal Pattern và cách ly bản thảo.
- [`PQM_UI_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/governance/PQM_UI_RULES.md): Ranh giới UI Components và React Hooks.
- [`PQM_TESTING_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/governance/PQM_TESTING_RULES.md): Tiêu chuẩn kiểm thử đa tầng và bảo vệ chống hồi quy.
- [`PQM_SECURITY_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/governance/PQM_SECURITY_RULES.md): Rào chắn RBAC, 21 CFR Part 11, Chữ ký số và Confirmation Tokens.
- [`PQM_CHANGE_MANAGEMENT.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/governance/PQM_CHANGE_MANAGEMENT.md): Giao thức quản lý thay đổi tính năng, sửa lỗi, refactor và schema migration.
