# 📋 ĐỐI SOÁT BASELINE QUẢN TRỊ KỸ THUẬT PQM (PQM GOVERNANCE BASELINE V1)

> **Mã văn bản:** `PQM_GOVERNANCE_BASELINE_V1.md`  
> **Thời điểm ban hành:** 2026-09-27  
> **Trạng thái đối soát:** 100% IN COMPLIANCE (Đồng bộ tuyệt đối giữa Hiện trạng và Bộ quy tắc Quản trị)  
> **Phạm vi kiểm toán:** Toàn bộ 713 files mã nguồn, 16 Domain Slices, 42 Canonical Actions, 13 Repositories

---

## 1. HIỆN TRẠNG KIẾN TRÚC THỰC TẾ CỦA HỆ THỐNG (CURRENT ARCHITECTURE)

Hệ thống PQM sau khi hoàn thành 27 Phases Rebuild vận hành chính xác theo mô hình Clean Architecture & Domain-Driven Design (DDD):

- **Domain Layer (`src/domains/*/domain/`)**: 16 Domain Slices hoàn toàn độc lập, chứa các Entity types, Value objects, Pure business rules và State machines.
- **Application Layer (`src/domains/*/application/`, `src/workflow/`)**: Chứa các Application Services điều phối nghiệp vụ thông qua `WorkflowFacade.dispatch()`, kiểm soát OCC và Outbox Audit Trail.
- **Infrastructure Layer (`src/infrastructure/repositories/`, `src/domains/*/infrastructure/`)**: Chứa các triển khai Firebase Repositories cho 13 interface thuần túy.
- **UI Presentation Layer (`src/pages/`, `src/components/`, `src/hooks/`)**: Chỉ tiêu thụ Query Hooks và điều phối tác vụ qua `useWorkflowActions`.

---

## 2. CÁC LUỒNG VẬN HÀNH CHUẨN TẮC (CANONICAL FLOWS)

### 2.1. Canonical Execution Flow (Luồng thực thi chuẩn)

`UI (Click/Event) ➔ useWorkflowActions Hook ➔ WorkflowFacade.dispatch(actionId, payload) ➔ 12-Step Security Guard (RBAC, OCC, Reason, Signature) ➔ Domain Workflow Handlers / Application Service ➔ Domain Rules & FSM ➔ Repository Interface ➔ Infrastructure (Firebase RTDB) ➔ Outbox Audit Queue ➔ UI Result`

### 2.2. Canonical Mutation Flow (Luồng ghi dữ liệu)

`WorkflowFacade ➔ Guards ➔ AppService ➔ IRepository.save/update/delete ➔ Firebase RTDB + OutboxAuditQueue.enqueue()`

- Tuyệt đối không có direct write ngoài Repository Interface.

### 2.3. Canonical Read Flow (Luồng truy vấn dữ liệu)

`Page / Component ➔ Domain Query Hook (e.g. useProductQueries) ➔ Domain Query Class (e.g. productQueries.findAll) ➔ Repository Interface (e.g. IProductRepository.findAll) ➔ Firebase RTDB Cache / State`

- Tuyệt đối không qua mutation, bảo đảm 100% Read-Only.

---

## 3. CÁC CƠ QUAN QUYỀN LỰC ĐỘC TÔN (AUTHORITY INVARIANTS)

| Thẩm quyền (Authority)    | Thành phần sở hữu SSoT                                    | Cơ chế bảo vệ an ninh                                             |
| ------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| **Action Authority**      | `CANONICAL_ACTION_REGISTRY` (42 actions)                  | Cấm action ID tự chế (`noUnregisteredAction.test.ts`)             |
| **Workflow Authority**    | `WorkflowFacade` & `UnifiedWorkflowExecutor`              | Khung thực thi 12 bước fail-closed                                |
| **State Authority (FSM)** | `BatchStateMachine`, `TestResultStateMachine`, v.v.       | Cấm `adminOverride` (`noWorkflowBypass.test.ts`), 7 Release Gates |
| **Permission Authority**  | `PermissionService` & `rbacGuard`                         | 8 Canonical Roles chuẩn, cấm vai trò ma                           |
| **Repository Authority**  | 13 Repository Interfaces (`src/repositories/interfaces/`) | Cấm direct Firebase write (`noDirectFirebaseMutation.test.ts`)    |
| **Audit Authority**       | `OutboxAuditQueue` & `logAuditAction`                     | Lưu vết ALCOA+ không thể đảo ngược, awaited fail-closed           |

---

## 4. QUY TẮC ĐẶC THÙ CHO AI VÀ UI (AI & UI RULES)

- **AI Boundary**: AI tuyệt đối không có quyền mutation trực tiếp vào database. Mọi suy luận OCR, gợi ý mapping, dự báo hạn dùng đều xuất ra dạng `AIActionProposal` và lưu tạm trong `sessionStorage` (TTL 10 phút), bắt buộc con người xác nhận (Human-in-the-loop).
- **UI Boundary**: UI thuần túy hiển thị và điều hướng. Cấm gán trạng thái nghiệp vụ hoặc gọi trực tiếp repository.

---

## 5. CÁC NGOẠI LỆ ĐÃ ĐƯỢC PHÊ DUYỆT (KNOWN APPROVED EXCEPTIONS)

Toàn bộ 37 thin adapters trong `src/services/app/`, `src/services/`, `src/repositories/` được giữ lại có chủ đích (`EXPLICITLY RETAINED` per `PQM_LEGACY_REMOVAL_REGISTER_V1.md`) để bảo toàn 100% backward compatibility cho UI và legacy tests hiện hữu mà không tạo ra workflow thứ hai.

---

## 6. DANH MỤC CÁC CỔNG KIỂM SOÁT KIẾN TRÚC HIỆN CÓ (EXISTING ARCHITECTURE GATES)

1. `tests/architecture/noDirectFirebaseMutation.test.ts` (PASS)
2. `tests/architecture/noDirectRepositoryMutation.test.ts` (PASS)
3. `tests/architecture/noWorkflowBypass.test.ts` (PASS)
4. `tests/architecture/noUnregisteredAction.test.ts` (PASS)
5. `tests/architecture/noOrphanMutation.test.ts` (PASS)
6. `tests/architecture/noDuplicateAuthority.test.ts` (PASS)
7. `tests/architecture/dependencyDirection.test.ts` (PASS)
8. `tests/architecture/workflowTraceability.test.ts` (PASS)
9. `tests/architecture/workflowInventoryGate.test.ts` (PASS)
10. `tests/architecture/noOrphanWorkflowActions.test.ts` (PASS)
11. `tests/architecture/unifiedWorkflowArchitecture.test.ts` (PASS)
12. `tests/architecture/architectureRules.test.ts` (PASS)
13. `scripts/workflow/check_boundaries.cjs` (`npm run workflow:guard`) (PASS - 0 vi phạm / 713 files)

---

## 7. ĐÁNH GIÁ LỖ HỔNG KIẾN TRÚC CÒN LẠI (REMAINING ARCHITECTURE GAPS)

- **Số lượng Architecture Gaps còn lại**: **0 (Zero)**.
- Toàn bộ 18 Gaps trong `WORKFLOW_GAP_REGISTER.md` đã được chuyển sang trạng thái `RESOLVED`.
- Hệ thống đạt trạng thái sẵn sàng chuyển giao cho vận hành và phát triển bền vững theo bộ quy tắc quản trị mới.
