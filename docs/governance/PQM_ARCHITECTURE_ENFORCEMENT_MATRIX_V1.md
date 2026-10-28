# 🛡️ MA TRẬN CƯỠNG CHẾ KIẾN TRÚC TỰ ĐỘNG (ARCHITECTURE ENFORCEMENT MATRIX V1)

> **Mã văn bản:** `PQM_ARCHITECTURE_ENFORCEMENT_MATRIX_V1.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Mục tiêu:** Mọi quy tắc cốt lõi không chỉ nằm trên văn bản Markdown mà bắt buộc phải có công cụ kiểm tra tự động (Automated Gates).

---

## 1. MA TRẬN CƯỠNG CHẾ TỰ ĐỘNG ĐA TẦNG

| STT | Quy tắc kiến trúc bất biến (Architectural Invariant) | Kiểm tra tĩnh (Static Check) | Unit Test chuyên biệt | Integration Test | Cổng kiểm soát CI (CI / Pre-commit Gate) | Tệp kiểm tra chịu trách nhiệm thực thi                                      |
| :-: | ---------------------------------------------------- | :--------------------------: | :-------------------: | :--------------: | :--------------------------------------: | --------------------------------------------------------------------------- |
|  1  | **No direct Firebase mutation**                      |              ✅              |          ✅           |        ⚠️        |                    ✅                    | `scripts/workflow/check_boundaries.cjs`, `noDirectFirebaseMutation.test.ts` |
|  2  | **No direct Repository mutation from UI**            |              ✅              |          ✅           |        ⚠️        |                    ✅                    | `noDirectRepositoryMutation.test.ts`                                        |
|  3  | **No workflow bypass (Admin ≠ bypass)**              |              ✅              |          ✅           |        ✅        |                    ✅                    | `noWorkflowBypass.test.ts`, `stateMachine.ts`                               |
|  4  | **No unregistered actions (SSoT Catalog)**           |              ✅              |          ✅           |        ⚠️        |                    ✅                    | `noUnregisteredAction.test.ts`                                              |
|  5  | **No orphan mutation (Must have AppService)**        |              ✅              |          ✅           |        ⚠️        |                    ✅                    | `noOrphanMutation.test.ts`                                                  |
|  6  | **No duplicate authority**                           |              ✅              |          ✅           |        ⚠️        |                    ✅                    | `noDuplicateAuthority.test.ts`                                              |
|  7  | **Dependency direction (Clean Architecture)**        |              ✅              |          ✅           |        ⚠️        |                    ✅                    | `dependencyDirection.test.ts`                                               |
|  8  | **Workflow traceability (Bidirectional)**            |              ✅              |          ✅           |        ⚠️        |                    ✅                    | `workflowTraceability.test.ts`                                              |
|  9  | **Activity Inventory integrity (0 Unmapped)**        |              ✅              |          ✅           |        ⚠️        |                    ✅                    | `workflowInventoryGate.test.ts`                                             |
| 10  | **FSM state authority enforcement**                  |              ⚠️              |          ✅           |        ✅        |                    ✅                    | `stateMachine.ts`, `testResultDomain.test.ts`                               |
| 11  | **RBAC authorization enforcement**                   |              ⚠️              |          ✅           |        ✅        |                    ✅                    | `permissionService.test.ts`, `rbacGuard.ts`                                 |
| 12  | **AI boundary (Advisory/Proposal only)**             |              ✅              |          ✅           |        ✅        |                    ✅                    | `aiDomain.test.ts`, `aiActionGuard.test.ts`                                 |
| 13  | **7 Release Gates enforcement**                      |              ⚠️              |          ✅           |        ✅        |                    ✅                    | `releaseRules.ts`, `batchDomain.test.ts`                                    |
| 14  | **Outbox Audit Trail fail-closed**                   |              ⚠️              |          ✅           |        ✅        |                    ✅                    | `outboxAuditQueue.ts`, `auditService.test.ts`                               |
| 15  | **OCC optimistic locking enforcement**               |              ⚠️              |          ✅           |        ⚠️        |                    ✅                    | `concurrency.test.ts`, `occGuard.ts`                                        |

---

## 2. QUY TRÌNH HÀNH ĐỘNG KHI CỔNG KIỂM SOÁT PHÁT HIỆN VI PHẠM

```text
Phát hiện vi phạm (Violation Detected)
       ↓
Chặn đứng quá trình Build / Commit / CI (Fail-Closed)
       ↓
Xuất thông báo lỗi cấu trúc chỉ rõ file và dòng mã vi phạm
       ↓
Kỹ sư / AI bắt buộc phải sửa mã nguồn theo đúng chuẩn kiến trúc
       ↓
CẤM TUYỆT ĐỐI việc sửa lùi hoặc nới lỏng điều kiện kiểm tra của bài test
```
