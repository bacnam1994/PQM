# PQM — KẾ HOẠCH REBUILD TOÀN DIỆN THEO WORKFLOW

Repository: `bacnam1994/PQM`  
Trạng thái hiện tại: **PHASE 15 (APPROVAL DOMAIN REBUILD - VS-12) — COMPLETED | NEXT: PHASE 16 (MASTER DATA DOMAIN REBUILD - VS-13)**

---

## 📊 BẢNG THEO DÕI TIẾN ĐỘ 27 PHASES REBUILD

|  Phase   | Phân kỳ                             | Nhiệm vụ cốt lõi                                                                                   |      Trạng thái       | Artifact bàn giao                                        |
| :------: | :---------------------------------- | :------------------------------------------------------------------------------------------------- | :-------------------: | :------------------------------------------------------- |
| **P-01** | **Freeze Contract**                 | Freeze Action IDs, Payloads, FSM, Permissions, RBAC, Signature, Reason, Idempotency, OCC           |   ✅ **HOÀN THÀNH**   | `ADR-REBUILD-WORKFLOW-CONTRACT-FREEZE.md`                |
| **P-02** | **Source Classification**           | Phân loại toàn bộ file source sang UI, APP, WORKFLOW, DOMAIN, REPO, INFRA, UTIL, TYPE              |   ✅ **HOÀN THÀNH**   | `docs/audit/PQM_REBUILD_SOURCE_MIGRATION_MAP_V1.md`      |
| **P-03** | **Dependency Graph**                | Lập đồ thị phụ thuộc đơn hướng: UI → App → Workflow → Domain → Repo → Infra                        |   ✅ **HOÀN THÀNH**   | `docs/audit/PQM_REBUILD_SOURCE_MIGRATION_MAP_V1.md`      |
| **P-04** | **Rebuild Workflow Kernel**         | Chuẩn hóa contracts, registry, kernel, guards, handlers, events trong `src/workflow/`              |   ✅ **HOÀN THÀNH**   | `src/workflow/kernel/`, `guards/`, `registry/`           |
| **P-05** | **Rebuild Repository Boundary**     | Tách Interface (`src/repositories/interfaces/`) khỏi Firebase (`src/infrastructure/repositories/`) |   ✅ **HOÀN THÀNH**   | `src/repositories/interfaces/`, `infrastructure/`        |
| **P-06** | **Rebuild Domain Slices (1-16)**    | Di chuyển 16 lát dọc độc lập theo template DDD (Domain / App / Workflow / Infra / Tests)           | 🟡 **ĐANG THỰC HIỆN** | Tuần tự theo 16 Vertical Slices (VS-01 -> VS-11 ĐÃ XONG) |
| **P-07** | **Product Domain Rebuild**          | Audit → Move → Rewire → Test → Verify cho toàn bộ Product CRUD, FSM, Approval, Bulk, AI            |   ✅ **HOÀN THÀNH**   | `src/domains/product/`                                   |
| **P-08** | **Material Domain Rebuild**         | Audit → Move → Rewire → Test → Verify cho Material CRUD, Status, Approval, Import, Bulk            |   ✅ **HOÀN THÀNH**   | `src/domains/material/`                                  |
| **P-09** | **TCCS Domain Rebuild**             | Rebuild TCCS CREATE, UPDATE, SUBMIT, APPROVE, REJECT, REVISE. Zero bypass approval                 |   ✅ **HOÀN THÀNH**   | `src/domains/tccs/`                                      |
| **P-10** | **Formula Domain Rebuild**          | Chuẩn hóa Formula Entity, Validation, Version authority, FSM, Repo, Workflow                       |   ✅ **HOÀN THÀNH**   | `src/domains/formula/`                                   |
| **P-11** | **Batch Domain Rebuild**            | Rebuild Batch FSM (Hold, Start, Release, Cancel, Close, Reopen), 7 Release Gates, AI Quick Batch   |   ✅ **HOÀN THÀNH**   | `src/domains/batch/`                                     |
| **P-12** | **Test Result Domain Rebuild**      | Rebuild Test Result Draft, Submit, Finalize, Approve, Reject, Supersede, Quality Evaluation        |   ✅ **HOÀN THÀNH**   | `src/domains/test-result/`                               |
| **P-13** | **Deviation / OOS / CAPA**          | Tách bạch Deviation, OOS, CAPA thành 3 domain riêng biệt có FSM, rules, services độc lập           |   ✅ **HOÀN THÀNH**   | `src/domains/deviation/`, `oos/`, `capa/`                |
| **P-14** | **Change Request Rebuild**          | Chuẩn hóa Change Request & Change Action FSM, đồng nhất State Authority                            |   ✅ **HOÀN THÀNH**   | `src/domains/change-request/`                            |
| **P-15** | **CoA & Approval Rebuild**          | Tách Document Generation, Approval, Release, Signature, ALCOA+ Audit Trail                         |   ✅ **HOÀN THÀNH**   | `src/domains/coa/` (Xong), `approval/` (Xong)            |
| **P-16** | **Master Data & System**            | Rebuild Users, Roles, Criteria, Labs, Pharmacopoeia, Settings, Destructive Tokens                  |   📋 Chờ kích hoạt    | `src/domains/master-data/`, `system/`                    |
| **P-17** | **AI Boundary Rebuild**             | Cách ly AI Proposal tools, Human-in-the-loop confirmation, Zero direct repository mutation         |   📋 Chờ kích hoạt    | `src/interfaces/ai/`                                     |
| **P-18** | **UI / Pages / Hooks Rebuild**      | Page → Feature Hook → Workflow/Application API. Zero direct Firebase/Repo mutation                 |   📋 Chờ kích hoạt    | `src/ui/`                                                |
| **P-19** | **Xóa Legacy (Cleanup)**            | Xóa an toàn mã cũ đã di chuyển thành công (MIGRATED, REMOVED, EXPLICITLY RETAINED)                 |   📋 Chờ kích hoạt    | `docs/audit/PQM_LEGACY_REMOVAL_REGISTER_V1.md`           |
| **P-20** | **Import / Export / Bulk Rebuild**  | Đảm bảo CSV/Excel Import, Bulk Create/Release/Delete tuân thủ 100% canonical workflow              |   📋 Chờ kích hoạt    | Bulk workflow isolation                                  |
| **P-21** | **Automated Architecture Gates**    | Bổ sung tests tự động chặn direct repo mutation, bypass, orphan mutation trên CI                   |   📋 Chờ kích hoạt    | `tests/architecture/` suite                              |
| **P-22** | **Domain-by-Domain Regression**     | Chạy toàn bộ test suites sau mỗi domain slice migration                                            |   📋 Chờ kích hoạt    | Regression check                                         |
| **P-23** | **Full Application Regression**     | Chạy Full E2E & Business Journeys (S-001 -> S-006, Lifecycle Journey, Security Rules)              |   📋 Chờ kích hoạt    | Full test pass                                           |
| **P-24** | **Final Source Audit**              | Lập báo cáo đối soát 100% mã nguồn cũ sang mã nguồn mới, 0 file chưa phân loại                     |   📋 Chờ kích hoạt    | `docs/audit/PQM_REBUILD_FINAL_SOURCE_AUDIT_V1.md`        |
| **P-25** | **Final Workflow Audit**            | Chứng minh 2 chiều: Activity ➔ Workflow ➔ Repo và Repo mutation ➔ Workflow ➔ Action                |   📋 Chờ kích hoạt    | `docs/audit/PQM_REBUILD_FINAL_WORKFLOW_AUDIT_V1.md`      |
| **P-26** | **Final Metrics & Certification**   | Đo lường toàn bộ chỉ số Zero Orphan, Zero Bypass, Zero Direct Mutation, 100% Coverage              |   📋 Chờ kích hoạt    | `docs/audit/PQM_REBUILD_FINAL_CERTIFICATION_V1.md`       |
| **P-27** | **Rebuild Certification & Tagging** | Ký duyệt nghiệm thu hoàn tất Rebuild, commit hoàn tất và gắn tag phiên bản kiến trúc               |   📋 Chờ kích hoạt    | Hoàn tất                                                 |

---

## 🧭 BẢNG THEO DÕI 16 VERTICAL SLICES (PHASE 6 DOMAIN REBUILD)

|  Thứ tự   | Domain Slice       | Mã nguồn hiện tại (`src/`)                                                                                                     | Thư mục mục tiêu (`src/domains/`)       |    Trạng thái     |    Mức rủi ro     |
| :-------: | :----------------- | :----------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------- | :---------------: | :---------------: |
| **VS-01** | **Product**        | `services/app/ProductAppService.ts`, `repositories/ProductRepository.ts`, `pages/products/`                                    | `src/domains/product/`                  | ✅ **HOÀN THÀNH** |   🟡 Trung bình   |
| **VS-02** | **Material**       | `services/app/MaterialAppService.ts`, `repositories/MaterialRepository.ts`, `pages/products/materials/`                        | `src/domains/material/`                 | ✅ **HOÀN THÀNH** |   🟡 Trung bình   |
| **VS-03** | **TCCS**           | `services/app/TCCSAppService.ts`, `repositories/TCCSRepository.ts`, `pages/qa/TCCS*`                                           | `src/domains/tccs/`                     | ✅ **HOÀN THÀNH** |   🔴 Cao (GMP)    |
| **VS-04** | **Formula**        | `services/app/FormulaAppService.ts`, `repositories/FormulaRepository.ts`, `pages/products/formula/`                            | `src/domains/formula/`                  | ✅ **HOÀN THÀNH** |   🟡 Trung bình   |
| **VS-05** | **Batch**          | `services/app/BatchAppService.ts`, `services/app/ReleaseService.ts`, `repositories/BatchRepository.ts`                         | `src/domains/batch/`                    | ✅ **HOÀN THÀNH** | 🔴 Rất cao (GMP)  |
| **VS-06** | **Test Result**    | `services/app/TestResultAppService.ts`, `repositories/TestResultRepository.ts`, `pages/qa/TestResult*`                         | `src/domains/test-result/`              | ✅ **HOÀN THÀNH** | 🔴 Rất cao (GMP)  |
| **VS-07** | **Deviation**      | `services/app/DeviationAppService.ts`, `repositories/IDeviationRepository.ts`, `pages/qa/Deviation*`                           | `src/domains/deviation/`                | ✅ **HOÀN THÀNH** |   🔴 Cao (GMP)    |
| **VS-08** | **OOS**            | `services/app/OOSService.ts`, `components/features/OOSInvestigationModal.tsx`                                                  | `src/domains/oos/`                      | ✅ **HOÀN THÀNH** |   🔴 Cao (GMP)    |
| **VS-09** | **CAPA**           | `services/app/CAPAService.ts`, `domain/capa/`                                                                                  | `src/domains/capa/`                     | ✅ **HOÀN THÀNH** |   🔴 Cao (GMP)    |
| **VS-10** | **Change Request** | `services/app/ChangeControlAppService.ts`, `repositories/IChangeControlRepository.ts`                                          | `src/domains/change-request/`           | ✅ **HOÀN THÀNH** |   🔴 Cao (GMP)    |
| **VS-11** | **CoA**            | `services/app/CoAService.ts`, `pages/qa/CoAReportPage.tsx`, `pages/public/CoAVerifyPage.tsx`                                   | `src/domains/coa/`                      | ✅ **HOÀN THÀNH** |   🔴 Cao (GMP)    |
| **VS-12** | **Approval**       | `services/app/ApprovalWorkflowService.ts`, `repositories/IApprovalTaskRepository.ts`                                           | `src/domains/approval/`                 | ✅ **HOÀN THÀNH** |   🔴 Cao (GMP)    |
| **VS-13** | **Master Data**    | `services/app/MasterCriterionAppService.ts`, `services/app/PharmacopoeiaAppService.ts`, `services/app/LaboratoryAppService.ts` | `src/domains/master-data/`              | 🟡 **TIẾP THEO**  |   🟡 Trung bình   |
| **VS-14** | **System**         | `services/app/SystemAppService.ts`, `services/userService.ts`, `services/permissionService.ts`                                 | `src/domains/system/`                   | 📋 Chờ kích hoạt  |   🟡 Trung bình   |
| **VS-15** | **AI Boundary**    | `services/ai/`, `architecture/aiGovernance*`                                                                                   | `src/domains/ai/` hoặc `interfaces/ai/` | 📋 Chờ kích hoạt  |  🔴 Cao (Safety)  |
| **VS-16** | **Auth**           | `services/authService.ts`, `providers/AuthProvider.tsx`, `pages/auth/`                                                         | `src/domains/auth/`                     | 📋 Chờ kích hoạt  | 🔴 Cao (Security) |

---

## I. MỤC TIÊU REBUILD

Tái cấu trúc toàn bộ source code PQM để đạt kiến trúc:

```text
UI / Page
    ↓
Application / Workflow Facade
    ↓
Canonical Workflow Action
    ↓
Guard / Authorization / Validation
    ↓
Application Service
    ↓
Domain / State Machine
    ↓
Repository Interface
    ↓
Infrastructure
    ↓
Firebase / Persistence
```

Sau rebuild:

```text
ONE ACTIVITY
    ↓
ONE CANONICAL ACTION
    ↓
ONE WORKFLOW PATH
    ↓
ONE BUSINESS AUTHORITY
```

Mục tiêu cuối:

```text
ORPHAN ACTION              = 0
WORKFLOW BYPASS            = 0
UNREGISTERED ACTION        = 0
UNMAPPED MUTATION          = 0
DUPLICATE BUSINESS LOGIC   = 0
DUPLICATE STATE AUTHORITY  = 0
DIRECT UI MUTATION         = 0
DIRECT AI MUTATION         = 0
BROKEN IMPORT              = 0
CIRCULAR DEPENDENCY        = 0
```

---

# II. NGUYÊN TẮC BẤT BIẾN

Trong toàn bộ quá trình rebuild:

### 1. Không thay đổi behavior

Không được tự ý thay đổi:

- business rules
- workflow semantics
- state transition
- permission
- RBAC
- audit semantics
- validation rules
- calculation
- Firebase schema
- dữ liệu hiện có
- UI behavior
- user-facing functionality

Rebuild trước hết là:

```text
ARCHITECTURE REFACTOR
```

không phải:

```text
BUSINESS LOGIC REWRITE
```

---

### 2. Không di chuyển mù

Không được:

```text
mv files
→ sửa import
→ build
→ coi như hoàn thành
```

Mỗi module phải:

```text
AUDIT
→ CLASSIFY
→ MOVE
→ REWIRE
→ TEST
→ VERIFY
→ REMOVE LEGACY
```

---

### 3. Không tạo workflow thứ hai

Trong quá trình rebuild, tuyệt đối không tạo:

```text
NewWorkflow
AlternativeWorkflow
TemporaryWorkflow
RebuildWorkflow
V2Workflow
```

Mọi workflow mới phải sử dụng canonical workflow system hiện tại.

---

# III. TARGET ARCHITECTURE

Cấu trúc mục tiêu:

```text
src/
│
├── workflow/
│   ├── contracts/
│   │   ├── actions.ts
│   │   ├── events.ts
│   │   └── workflow.ts
│   │
│   ├── registry/
│   │   ├── index.ts
│   │   └── actionRegistry.ts
│   │
│   ├── kernel/
│   │   ├── workflowExecutor.ts
│   │   ├── workflowContext.ts
│   │   └── workflowResult.ts
│   │
│   ├── guards/
│   │   ├── authorization/
│   │   ├── validation/
│   │   ├── state/
│   │   └── integrity/
│   │
│   ├── handlers/
│   │
│   └── events/
│
├── domains/
│   ├── product/
│   ├── material/
│   ├── tccs/
│   ├── formula/
│   ├── batch/
│   ├── test-result/
│   ├── deviation/
│   ├── oos/
│   ├── capa/
│   ├── change-request/
│   ├── coa/
│   ├── approval/
│   ├── master-data/
│   └── system/
│
├── application/
│   ├── product/
│   ├── material/
│   ├── tccs/
│   ├── formula/
│   ├── batch/
│   ├── test-result/
│   ├── deviation/
│   ├── oos/
│   ├── capa/
│   ├── change-request/
│   ├── coa/
│   └── master-data/
│
├── infrastructure/
│   ├── firebase/
│   ├── repositories/
│   ├── audit/
│   └── storage/
│
├── repositories/
│   └── interfaces/
│
├── ui/
│   ├── pages/
│   ├── components/
│   └── hooks/
│
└── shared/
    ├── types/
    ├── utils/
    ├── constants/
    └── errors/
```

Nếu repository hiện tại đã có các layer tương đương, **ưu tiên hợp nhất và đổi tên có kiểm soát**, không tạo bản sao song song.

---

# IV. PHASE 1 — FREEZE CONTRACT

Trước khi move source:

Tạo:

```text
docs/adr/ADR-REBUILD-WORKFLOW-CONTRACT-FREEZE.md
```

Freeze:

```text
Action ID
Entity
Input
Output
Permission
Guard
State
Transition
Audit
Signature
Reason
Idempotency
OCC
Error semantics
```

Tạo snapshot:

```text
docs/audit/PQM_REBUILD_ACTION_CONTRACT_SNAPSHOT_V1.md
```

Mục tiêu:

```text
REBUILD được phép thay đổi location
nhưng không được thay đổi contract
```

---

# V. PHASE 2 — SOURCE CLASSIFICATION

Quét toàn bộ:

```text
src/
functions/
tests/
```

Phân loại từng file:

```text
UI
UI_HOOK
APPLICATION
WORKFLOW
DOMAIN
STATE_MACHINE
REPOSITORY
INFRASTRUCTURE
UTILITY
TYPE
TEST
LEGACY
DUPLICATE
UNUSED
```

Tạo:

```text
docs/audit/PQM_SOURCE_CLASSIFICATION_V1.md
```

Mỗi file phải có:

```text
Current Path
Target Path
Layer
Domain
Owner
Dependency
Migration Phase
Status
```

---

# VI. PHASE 3 — XÂY DỰNG DEPENDENCY MAP

Tạo:

```text
docs/audit/PQM_REBUILD_DEPENDENCY_GRAPH_V1.md
```

Xác định:

```text
UI
 ↓
Application
 ↓
Workflow
 ↓
Domain
 ↓
Repository
 ↓
Infrastructure
```

Tìm:

- circular dependency
- reverse dependency
- hidden Firebase dependency
- UI dependency vào repository
- domain dependency vào Firebase
- workflow dependency vào UI
- service gọi chéo không qua application boundary

Không move source trước khi biết dependency graph.

---

# VII. PHASE 4 — REBUILD WORKFLOW KERNEL

Ổn định:

```text
src/workflow/
```

Chuẩn hóa:

```text
contracts
registry
kernel
guards
handlers
events
```

## Workflow Handler chỉ làm orchestration

Mẫu:

```text
dispatch
→ validate context
→ authorize
→ guard
→ call application service
→ persist
→ audit
→ emit event
→ return result
```

Không nhét business logic lớn vào handler.

Không cho handler trực tiếp thao tác Firebase nếu application/service boundary đã tồn tại.

---

# VIII. PHASE 5 — REBUILD REPOSITORY BOUNDARY

Tách:

```text
Repository Interface
```

khỏi:

```text
Firebase Implementation
```

Ví dụ:

```text
repositories/interfaces/BatchRepository.ts
```

và:

```text
infrastructure/repositories/firebaseBatchRepository.ts
```

Application/domain chỉ biết:

```text
BatchRepository
```

không biết:

```text
Firebase
```

---

# IX. PHASE 6 — REBUILD DOMAIN THEO VERTICAL SLICE

Không rebuild toàn bộ source cùng lúc.

Thứ tự:

```text
1. Product
2. Material
3. TCCS
4. Formula
5. Batch
6. Test Result
7. Deviation
8. OOS
9. CAPA
10. Change Request
11. CoA
12. Approval
13. Master Data
14. System
15. AI
16. Auth
```

---

# X. DOMAIN REBUILD TEMPLATE

Mỗi domain phải đạt cấu trúc:

```text
domains/<domain>/
│
├── domain/
│   ├── types.ts
│   ├── rules.ts
│   └── state-machine.ts
│
├── application/
│   ├── service.ts
│   └── queries.ts
│
├── workflow/
│   ├── definitions.ts
│   ├── handlers.ts
│   └── guards.ts
│
├── infrastructure/
│   └── repository.ts
│
├── tests/
│
└── README.md
```

Nếu workflow đã được centralized trong `src/workflow`, không tạo workflow implementation thứ hai trong domain.

Khi đó domain chỉ chứa:

```text
workflow metadata / domain bindings
```

và canonical workflow vẫn nằm trong workflow kernel.

---

# XI. PHASE 7 — PRODUCT REBUILD

Thực hiện:

```text
AUDIT
→ MOVE
→ REWIRE
→ TEST
→ VERIFY
```

Kiểm tra toàn bộ:

```text
Create Product
Update Product
Delete Product
Approve Product
Import Product
Bulk Product operations
Product status changes
AI-assisted Product operations
```

Mọi mutation:

```text
UI
→ Workflow
→ Product Service
→ Product Repository
```

Sau khi PASS:

```text
remove duplicate implementation
remove obsolete imports
run tests
commit
```

Commit:

```text
refactor(rebuild): migrate product domain to canonical architecture
```

---

# XII. PHASE 8 — MATERIAL

Áp dụng cùng template.

Kiểm tra:

```text
Create
Update
Delete
Import
Status transition
Approval
Bulk operations
```

Commit:

```text
refactor(rebuild): migrate material domain
```

---

# XIII. PHASE 9 — TCCS

Đặc biệt kiểm tra:

```text
TCCS_CREATE
TCCS_UPDATE
TCCS_SUBMIT
TCCS_APPROVE
TCCS_REJECT
TCCS_REVISE
```

Không được tồn tại approval path thứ hai.

Kiểm tra:

```text
RBAC
FSM
Audit
Signature
Reason
```

---

# XIV. PHASE 10 — FORMULA

Chuẩn hóa:

```text
Formula entity
Formula validation
Formula version
Formula approval
Formula state
Formula repository
Formula workflow
```

Đặc biệt kiểm tra version authority.

Không để UI tự quyết định formula state.

---

# XV. PHASE 11 — BATCH

Đây là domain quan trọng.

Kiểm tra:

```text
Create Batch
Update Batch
Start
Hold
Release
Cancel
Close
Reopen
Bulk operations
AI Quick Batch
```

Mọi transition phải qua state machine canonical.

Không được:

```text
UI → update status
```

---

# XVI. PHASE 12 — TEST RESULT

Chuẩn hóa:

```text
TEST_RESULT_SAVE_DRAFT
TEST_RESULT_SUBMIT
TEST_RESULT_FINALIZE
TEST_RESULT_APPROVE
TEST_RESULT_REJECT
TEST_RESULT_SUPERSEDE
```

Phân biệt rõ:

```text
LOCAL UI STATE
```

và:

```text
PERSISTED BUSINESS STATE
```

Chỉ persisted business state mới đi qua workflow mutation boundary.

---

# XVII. PHASE 13 — DEVIATION / OOS / CAPA

Tách rõ:

```text
Deviation
OOS
CAPA
```

Không dùng service chung nếu business semantics khác nhau.

Mỗi entity có:

```text
state
rules
workflow
service
repository
audit
tests
```

Kiểm tra các mutation:

```text
Open
Investigate
Assign
Update
Review
Approve
Reject
Close
Reopen
```

---

# XVIII. PHASE 14 — CHANGE REQUEST (✅ ĐÃ HOÀN THÀNH - COMMIT VS-10)

Đã hoàn thành tái cấu trúc canonical change-request domain theo DDD / Clean Architecture:

- `src/domains/change-request/domain/types.ts`: Chuẩn hóa thực thể Change Request, FMEA Risk Assessment, Change Action Items.
- `src/domains/change-request/domain/rules.ts`: State Machine FSM (`ChangeRequestStateMachine`), kiểm tra điều kiện đóng thay đổi (QA/Admin + hoàn tất mọi actions), tính toán FMEA RPN/Risk Level.
- `src/domains/change-request/application/service.ts`: `ChangeControlAppService` ủy quyền toàn bộ đột biến qua `WorkflowFacade.dispatch()`.
- `src/domains/change-request/application/queries.ts`: `ChangeControlQueries` (getAll, getById, getByStatus, getByProductId).
- `src/domains/change-request/infrastructure/repository.ts`: Binding `IChangeControlRepository` với `FirebaseChangeControlRepository`.
- `src/domains/change-request/workflow/definitions.ts`: Định danh canonical workflow action IDs & nhãn trạng thái/nhóm thay đổi.
- `src/domains/change-request/tests/changeRequestDomain.test.ts`: 100% pass bộ kiểm thử tự động.
- `src/services/app/ChangeControlAppService.ts` & `src/repositories/IChangeControlRepository.ts`: Thin adapter duy trì 100% backward compatibility.

---

# XIX. PHASE 15 — COA / APPROVAL (VS-11 COA: ✅ ĐÃ HOÀN THÀNH | VS-12 APPROVAL: 🟡 TIẾP THEO)

### 1. CoA Domain (`src/domains/coa/`) - ✅ ĐÃ HOÀN THÀNH (VS-11)

- `src/domains/coa/domain/types.ts`: Định nghĩa `CoADocumentPayload`, `CoAFootnote`, `CoAVerificationData`, `CoACriterionEntry`.
- `src/domains/coa/domain/rules.ts`: Thẩm định tính toàn vẹn chữ ký băm SHA-256 (`CoARules.verifySnapshotIntegrity`), tổng hợp tự động Footnote cho chỉ tiêu Miễn kiểm/Thay thế (`CoARules.buildCriteriaAndFootnotes`), kiểm tra độ dài lý do thu hồi (`validateRevocationReason`), FSM (`CoAStateMachine`: GENERATED ➔ SIGNED ➔ REVOKED).
- `src/domains/coa/application/service.ts`: `CoAService` điều phối `generateCoAPayload` (100% từ EvaluationSnapshot niêm phong), `generateCoAPayloadAsync`, `signCoA` (21 CFR Part 11 e-Signature), `revokeCoA`, `getCoAVerificationData` qua `WorkflowFacade`.
- `src/domains/coa/application/queries.ts`: `CoAQueries` (getVerificationData, getDocumentPayload).
- `src/domains/coa/infrastructure/repository.ts`: Binding các repositories & signatureService.
- `src/domains/coa/workflow/definitions.ts`: Định danh canonical workflow action IDs (`COA_GENERATE`, `COA_SIGN`, `COA_REVOKE`) & nhãn trạng thái.
- `src/domains/coa/tests/coaDomain.test.ts`: 100% pass unit tests (ALCOA+ tamper detection, footnotes, e-signature, verification).
- `src/services/app/CoAService.ts`: Thin adapter duy trì 100% backward compatibility.

### 2. Approval Domain (`src/domains/approval/`) - ✅ ĐÃ HOÀN THÀNH (VS-12)

Đã hoàn thành tách bạch và chuẩn hóa quy trình phê duyệt đa cấp (Approval Tasks) chuẩn GMP:

- `src/domains/approval/domain/types.ts`: Định nghĩa `ApprovalTask`, `ApprovalStep`, `ApprovalLogEntry`, `ApprovalEntityType`, `ApprovalOverallStatus`, `StepDecision`.
- `src/domains/approval/domain/rules.ts`: Rào chắn SoD (`verifySoDCompliance`), cấu hình bước chuẩn (`getDefaultStepsForEntity`), tiền điều kiện quyết định (`validateStepDecisionPreconditions`: quyền vai trò, e-Signature CFR Part 11, lý do từ chối >= 10 ký tự), tiền điều kiện thu hồi (`validateRevocationPreconditions`: QA/Admin, chặn Lô RELEASED, lý do >= 30 ký tự per BR-APP-002), và State Machine (`ApprovalTaskStateMachine`).
- `src/domains/approval/application/service.ts`: `ApprovalWorkflowService` điều phối qua `ApprovalWorkflowHandlers` và `WorkflowFacade.dispatch()`.
- `src/domains/approval/application/queries.ts`: `ApprovalQueries` (findByEntity, findByAssignee, findById, findAll, findPendingTasks).
- `src/domains/approval/infrastructure/repository.ts`: Binding `IApprovalTaskRepository` với `firebaseApprovalTaskRepository`.
- `src/domains/approval/workflow/definitions.ts`: Định danh canonical workflow action IDs (`APPROVAL_TASK_CREATE`, `APPROVAL_TASK_DECIDE`, `APPROVAL_TASK_CANCEL`) & nhãn trạng thái.
- `src/domains/approval/tests/approvalDomain.test.ts`: 100% pass 15 unit tests.
- `src/services/app/ApprovalWorkflowService.ts`: Thin adapter duy trì 100% backward compatibility.

---

# XX. PHASE 16 — MASTER DATA / SYSTEM

Rebuild:

```text
Users
Roles
Permissions
Settings
Master data
System configuration
```

Phân biệt:

```text
SYSTEM INFRASTRUCTURE
```

và:

```text
BUSINESS MUTATION
```

Không đưa mọi thao tác kỹ thuật vào business workflow chỉ để đạt con số workflow coverage.

---

# XXI. PHASE 17 — AI

AI phải được đưa về đúng boundary:

```text
AI
 ↓
Analyze
 ↓
Proposal
 ↓
Human confirmation
 ↓
Canonical Workflow
```

AI không được:

```text
write repository
update Firebase
change business state
approve
release
```

trực tiếp.

---

# XXII. PHASE 18 — UI / PAGES / HOOKS

Sau khi domain/application đã ổn định mới rebuild UI layer.

Mục tiêu:

```text
Page
 ↓
Feature Hook
 ↓
Workflow/Application API
```

Không:

```text
Page
 ↓
Firebase
```

Không:

```text
Hook
 ↓
Repository mutation
```

Hook chỉ quản lý:

```text
query
loading
mutation invocation
cache
UI state
```

Business rule nằm ngoài hook.

---

# XXIII. PHASE 19 — XÓA LEGACY

Chỉ xóa sau khi:

```text
new path PASS
tests PASS
runtime PASS
traceability PASS
```

Mỗi legacy module phải có một trong ba trạng thái:

```text
MIGRATED
REMOVED
EXPLICITLY RETAINED
```

Không được còn:

```text
UNKNOWN
```

Tạo:

```text
docs/audit/PQM_LEGACY_REMOVAL_REGISTER_V1.md
```

---

# XXIV. PHASE 20 — IMPORT / EXPORT / BULK ACTIONS

Đây là nhóm thường bị bỏ sót.

Kiểm tra:

```text
CSV import
Excel import
Bulk create
Bulk update
Bulk delete
Bulk approval
Bulk release
Export
Template generation
```

Nguyên tắc:

```text
Bulk operation
```

không phải lý do để bypass workflow.

Có thể dùng:

```text
Batch workflow execution
```

nhưng từng business mutation vẫn phải có canonical authorization/audit semantics.

---

# XXV. PHASE 21 — AUTOMATED ARCHITECTURE GATES

Tạo hoặc chuẩn hóa:

```text
tests/architecture/
```

Bắt buộc:

```text
noDirectFirebaseMutation.test.ts
noDirectRepositoryMutation.test.ts
noWorkflowBypass.test.ts
noUnregisteredAction.test.ts
noOrphanMutation.test.ts
noDuplicateAuthority.test.ts
dependencyDirection.test.ts
workflowTraceability.test.ts
```

CI phải fail khi vi phạm.

---

# XXVI. PHASE 22 — DOMAIN-BY-DOMAIN REGRESSION

Sau mỗi domain:

```text
npm test
npm run typecheck
npm run build
```

và domain-specific tests.

Không đợi đến cuối mới chạy toàn bộ test.

Mỗi domain hoàn thành phải tạo checkpoint commit.

---

# XXVII. PHASE 23 — FULL APPLICATION REGRESSION

Sau khi tất cả domain đã rebuild:

Kiểm tra toàn bộ luồng:

```text
Authentication
Product
Material
TCCS
Formula
Batch
Test Result
Deviation
OOS
CAPA
Change Request
CoA
Approval
Master Data
AI
Audit
```

Kiểm tra:

```text
Create
Read
Update
Delete
Submit
Approve
Reject
Release
Hold
Reopen
Close
Import
Bulk
AI proposal
```

---

# XXVIII. PHASE 24 — FINAL SOURCE AUDIT

Tạo:

```text
docs/audit/PQM_REBUILD_FINAL_SOURCE_AUDIT_V1.md
```

Kiểm tra:

```text
Old source path
New source path
Old caller
New caller
Workflow
Application service
Repository
Test
Status
```

Không còn source chưa phân loại.

---

# XXIX. PHASE 25 — FINAL WORKFLOW AUDIT

Tạo:

```text
docs/audit/PQM_REBUILD_FINAL_WORKFLOW_AUDIT_V1.md
```

Chứng minh hai chiều:

```text
ACTIVITY
 ↓
ACTION
 ↓
WORKFLOW
 ↓
HANDLER
 ↓
SERVICE
 ↓
DOMAIN
 ↓
REPOSITORY
```

và:

```text
REPOSITORY MUTATION
 ↓
CALLER
 ↓
SERVICE
 ↓
WORKFLOW
 ↓
ACTION
```

Hai chiều đều phải PASS.

---

# XXX. PHASE 26 — FINAL METRICS

Tạo:

```text
docs/audit/PQM_REBUILD_FINAL_CERTIFICATION_V1.md
```

Bắt buộc:

```text
Source files classified              = 100%
Activities mapped                   = 100%
Mutation actions registered         = 100%
Workflow coverage                   = 100%
Repository mutations traced         = 100%

Orphan actions                      = 0
Workflow bypasses                   = 0
Unregistered actions                = 0
Unmapped mutations                  = 0
Duplicate authorities               = 0
Direct UI mutations                 = 0
Direct AI mutations                 = 0
Circular dependencies               = 0
Broken imports                      = 0
Legacy UNKNOWN                      = 0

Unit tests                          = PASS
Integration tests                   = PASS
Workflow tests                      = PASS
Architecture tests                  = PASS
E2E tests                           = PASS
Typecheck                           = PASS
Build                               = PASS
```

---

# XXXI. PHASE 27 — REBUILD CERTIFICATION

Chỉ được đánh dấu:

```text
PQM_REBUILD_STATUS = COMPLETE
```

khi toàn bộ:

```text
AUDIT
IMPLEMENT
TEST
TRACE
VERIFY
CLEANUP
```

đều PASS.

Commit cuối:

```text
feat(rebuild): complete workflow-centric source architecture
```

Tag version mới.

---

# XXXII. QUY TẮC COMMIT

Không tạo commit khổng lồ.

Mỗi domain:

```text
1. refactor(rebuild): prepare <domain>
2. refactor(rebuild): migrate <domain> application layer
3. refactor(rebuild): migrate <domain> repository boundary
4. test(rebuild): enforce <domain> workflow boundary
5. refactor(rebuild): remove <domain> legacy implementation
```

Nếu thay đổi nhỏ có thể squash, nhưng không được mất khả năng rollback từng domain.

---

# XXXIII. QUY TẮC ROLLBACK

Mỗi domain phải có khả năng rollback độc lập.

Nếu:

```text
Domain A PASS
Domain B FAIL
```

thì:

```text
A giữ nguyên
B rollback
```

Không rollback toàn bộ repository.

---

# XXXIV. QUY TẮC KHÔNG ĐƯỢC VI PHẠM

Trong quá trình rebuild, Vibecode KHÔNG được:

1. Tạo workflow thứ hai.
2. Tạo repository mutation mới ngoài boundary.
3. Thay đổi Firebase schema nếu không có yêu cầu riêng.
4. Thay đổi business rule.
5. Thay đổi RBAC.
6. Thay đổi FSM semantics.
7. Xóa code chỉ vì "không thấy được sử dụng".
8. Xóa legacy trước khi traceability PASS.
9. Bỏ test để build xanh.
10. Disable architecture gate.
11. Dùng `any` để che lỗi type.
12. Bypass workflow để xử lý nhanh.
13. Tạo temporary implementation mà không có kế hoạch loại bỏ.
14. Đổi Action ID chỉ để thuận tiện refactor.
15. Đưa business logic vào UI/hook.

---

# XXXV. CÁCH VIBECODE PHẢI THỰC HIỆN

Mỗi task phải bắt đầu bằng:

```text
INSPECT CURRENT CODE
```

Sau đó:

```text
IDENTIFY DEPENDENCIES
```

Sau đó:

```text
PLAN MOVE
```

Sau đó mới:

```text
IMPLEMENT
```

Sau implementation:

```text
TEST
TYPECHECK
BUILD
ARCHITECTURE CHECK
TRACEABILITY CHECK
```

Cuối task phải báo:

```text
FILES MOVED:
FILES CREATED:
FILES DELETED:
IMPORTS UPDATED:
WORKFLOW ACTIONS:
TESTS:
TYPECHECK:
BUILD:
ARCHITECTURE:
TRACEABILITY:
REMAINING LEGACY:
BLOCKERS:
COMMIT:
```

---

# XXXVI. TASK ĐẦU TIÊN GIAO CHO VIBECODE

KHÔNG bắt đầu bằng Product ngay.

Trước tiên thực hiện:

```text
REBUILD PHASE 1 — SOURCE TREE PREPARATION
```

Yêu cầu:

1. Đọc toàn bộ workflow architecture hiện tại.
2. Đọc source classification hiện tại.
3. Đọc dependency graph hiện tại.
4. Kiểm tra target architecture.
5. Map toàn bộ current path → target path.
6. Không move file business code trong task này.
7. Không thay đổi behavior.
8. Không thay đổi workflow contract.
9. Không xóa code.

Tạo:

```text
docs/audit/PQM_REBUILD_SOURCE_MIGRATION_MAP_V1.md
```

Format:

```text
CURRENT PATH
→ TARGET PATH
→ DOMAIN
→ LAYER
→ DEPENDENCIES
→ WORKFLOW ACTIONS
→ MIGRATION ORDER
→ RISK
```

Sau khi tạo migration map:

```text
RUN TYPECHECK
RUN TEST
RUN BUILD
```

Nếu tất cả PASS:

```text
COMMIT:
docs(rebuild): add source migration map
```

Sau đó **dừng lại và báo cáo**.

Không tự động chuyển sang migration Product trong cùng task.

---

# XXXVII. TASK TIẾP THEO

Sau khi Migration Map PASS:

```text
REBUILD PHASE 2 — WORKFLOW KERNEL
```

Sau đó lần lượt:

```text
PHASE 3  — Repository boundary
PHASE 4  — Product
PHASE 5  — Material
PHASE 6  — TCCS
PHASE 7  — Formula
PHASE 8  — Batch
PHASE 9  — Test Result
PHASE 10 — Deviation
PHASE 11 — OOS
PHASE 12 — CAPA
PHASE 13 — Change Request
PHASE 14 — CoA
PHASE 15 — Approval
PHASE 16 — Master Data
PHASE 17 — System
PHASE 18 — AI
PHASE 19 — UI / Hooks
PHASE 20 — Legacy Removal
PHASE 21 — Architecture Gates
PHASE 22 — Full Regression
PHASE 23 — Final Certification
```

---

# XXXVIII. ĐIỀU KIỆN HOÀN THÀNH CUỐI CÙNG

PQM chỉ được coi là REBUILD COMPLETE khi kiến trúc thực tế đạt:

```text
                    ┌──────────────────┐
                    │       UI         │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │ Workflow / App   │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │ Canonical Action │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │ Guards / RBAC    │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │ Application      │
                    │ Service          │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │ Domain / FSM     │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │ Repository       │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │ Infrastructure   │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │ Firebase         │
                    └──────────────────┘
```

Không còn đường tắt.

Không còn business mutation cô lập.

Không còn workflow song song.

Không còn service là "authority ngầm".

Không còn UI quyết định business state.

Không còn repository là business authority.

Kết quả cuối cùng phải là:

```text
ALL APPLICATION ACTIVITIES
        ↓
CANONICAL WORKFLOW SYSTEM
        ↓
DOMAIN-CENTRIC SOURCE TREE
        ↓
TRACEABLE
TESTABLE
REBUILDABLE
MAINTAINABLE
```

**Bắt đầu ngay từ `REBUILD PHASE 1 — SOURCE TREE PREPARATION`; chỉ tạo Migration Map và kiểm chứng baseline trước, chưa move code trong task đầu tiên.**
