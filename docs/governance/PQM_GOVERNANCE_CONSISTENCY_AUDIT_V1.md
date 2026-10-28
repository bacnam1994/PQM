# 🔍 BÁO CÁO ĐỐI SOÁT TÍNH NHẤT QUÁN QUẢN TRỊ KỸ THUẬT (PQM GOVERNANCE CONSISTENCY AUDIT V1)

> **Mã văn bản:** `PQM_GOVERNANCE_CONSISTENCY_AUDIT_V1.md`  
> **Phiên bản:** 1.0.0-AUDIT  
> **Thời điểm ban hành:** 2026-09-27  
> **Phạm vi đối soát:** Toàn bộ tài liệu chuẩn tắc (`docs/workflow/*`, `docs/adr/*`, `docs/governance/*`, `src/workflow/*`, `src/domain/*`, `tests/architecture/*`)  
> **Mục tiêu:** Phát hiện và khóa lại toàn bộ các điểm mâu thuẫn ngữ nghĩa, thẩm quyền kép hoặc sai lệch từ vựng trước khi ban hành chính thức.

---

## 1. PHƯƠNG PHÁP ĐỐI SOÁT CHÉO ĐA NGUỒN (CROSS-DOCUMENT CONSISTENCY MATRIX)

Chúng tôi đã tiến hành quét và so sánh chéo 11 nguồn tài liệu chuẩn tắc và triển khai mã nguồn:

1. `docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md` (Master Workflow Specification)
2. `docs/workflow/PQM_SOURCE_OF_TRUTH_MATRIX.md` (SSoT Core Matrix)
3. `docs/workflow/PQM_STATE_TRANSITION_MATRIX.md` (FSM Transitions)
4. `docs/workflow/PQM_WORKFLOW_FAILURE_MATRIX.md` (Failure Handling Lifecycle)
5. `docs/workflow/PQM_WORKFLOW_OBSERVABILITY.md` (Telemetry & Audit)
6. `docs/adr/ADR-001-WORKFLOW-CANONICAL-STANDARDS.md` (Constitutional Vocabulary & Contracts)
7. `src/workflow/definitions/index.ts` (`CANONICAL_ACTION_REGISTRY`)
8. `src/domain/workflow/stateMachine.ts` (Core State Machines)
9. `src/services/permissionService.ts` (RBAC Capability Evaluator)
10. `src/repositories/interfaces/` (13 Persistence Boundaries)
11. `tests/architecture/` (12 Architecture Automated Gates)

---

## 2. BẢNG PHÂN TÍCH XUNG ĐỘT & GIẢI PHÁP ĐỀ XUẤT (CONFLICT LOG)

| Conflict ID  | Nguồn A (Source A)                        | Nguồn B (Source B)                    | Nội dung sai lệch / Mâu thuẫn (Conflict)                                                                                                                                                | Tác động (Impact)                                                                             | Giải pháp chuẩn tắc (Proposed Resolution)                                                                                                                                         | Thẩm quyền phê duyệt (Authority) | Mức độ nghiêm trọng (Severity) |
| :----------: | ----------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------: | :----------------------------: |
| **CONF-001** | `ADR-001` Mục 2                           | `ACTIVITY_INVENTORY.md` cũ & comments | Đôi khi `SYSTEM` và `AI_ADVISORY` bị gộp chung vào bảng vai trò (Roles) cùng với 8 vai trò con người.                                                                                   | Nhầm lẫn giữa phân quyền đăng nhập (User Login RBAC) và tác nhân hệ thống/AI (System Actors). | Phân định tuyệt đối trong `PQM_ACTOR_MODEL_V1.md`: 8 **Human Business Roles** (ADMIN, QA, QC, LAB, PRODUCTION, USER, VIEWER, GUEST) và 2 **System Actors** (SYSTEM, AI_ADVISORY). |        ADR-001 / Level 3         |           🟡 MEDIUM            |
| **CONF-002** | `stateMachine.ts` (`VALID_TRANSITIONS`)   | `PQM_STATE_TRANSITION_MATRIX.md`      | Mã định danh hành động trong bảng FSM cũ ghi là `START_TESTING`, `RELEASE_BATCH`, trong khi `CANONICAL_ACTION_REGISTRY` chuẩn hóa là `BATCH_DISPATCH_TESTING`, `BATCH_RELEASE_APPROVE`. | Sai lệch tên hành động giữa tài liệu chuyển đổi trạng thái FSM và Action Registry.            | Chuẩn hóa 100% tài liệu FSM sử dụng `WorkflowActionId` chuẩn theo `CANONICAL_ACTION_REGISTRY`.                                                                                    |    Action Registry / Level 3     |           🟡 MEDIUM            |
| **CONF-003** | `TestResultStatus`                        | `TestResultWorkflowStatus`            | Hệ thống có 2 máy trạng thái cho Test Result: 1 máy trạng thái kỹ thuật (`PENDING` ➔ `PASS`/`FAIL`) và 1 máy trạng thái hành chính (`DRAFT` ➔ `SUBMITTED` ➔ `FINAL` ➔ `APPROVED`).      | Nếu không định nghĩa rõ sẽ gây nhầm lẫn "Trạng thái nào là FSM chính thức".                   | Phân định rạch ròi: `TestResultStatus` là Technical Quality State; `TestResultWorkflowStatus` là Administrative Document Lifecycle. Cả hai cùng được quản lý bởi Kernel.          |        Model 10 / Level 2        |             🟢 LOW             |
| **CONF-004** | Legacy Catalog `workflowActionCatalog.ts` | `CANONICAL_ACTION_REGISTRY`           | `workflowActionCatalog.ts` (V3 cũ) còn chứa một số action ID dạng `TCCS_ACTIVATE`, `FORMULA_DELETE` không còn tồn tại trong Registry V5.                                                | Rủi ro hiểu nhầm nếu kỹ sư mới đọc catalog cũ.                                                | Đã cách ly trong `noUnregisteredAction.test.ts`. Khóa chính thức `CANONICAL_ACTION_REGISTRY` tại `src/workflow/definitions/index.ts` là SSoT duy nhất.                            |             Level 3              |             🟢 LOW             |

---

## 3. TỔNG KẾT KẾT QUẢ ĐỐI SOÁT

- **Tổng số mâu thuẫn phát hiện (Total Conflicts)**: 4 mục (đều ở mức Low/Medium, đã có giải pháp phân định chuẩn xác).
- **Mâu thuẫn nghiêm trọng (Critical Conflicts)**: **0 (Zero)**.
- **Xung đột thẩm quyền kép (Duplicate Authorities)**: **0 (Zero)**.
- **Hành động mồ côi (Orphan Actions)**: **0 (Zero)**.
- **Thao tác ghi mồ côi (Untraced Mutations)**: **0 (Zero)**.

**KẾT LUẬN**: Hệ thống PQM hiện tại đạt tính nhất quán kiến trúc cao, không có mâu thuẫn nghiêm trọng cản trở việc khóa chặt bộ quy tắc quản trị kỹ thuật.
