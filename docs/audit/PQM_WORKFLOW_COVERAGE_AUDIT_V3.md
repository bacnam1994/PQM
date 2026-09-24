# PQM — BÁO CÁO KIỂM TOÀN BỘ WORKFLOW COVERAGE (WORKFLOW COVERAGE AUDIT V3)

> **Phiên bản:** 3.0.0-AUDIT-FREEZE  
> **Ngày lập:** 2026-09-24  
> **Trạng thái:** HOÀN THÀNH QUÉT MÃ NGUỒN THỰC TẾ (PHASE 1 ĐẾN PHASE 7)  
> **Nguyên tắc thẩm định:** Coverage chỉ được tính là `FULL` khi chuỗi:  
> `UI → Action → App Service → Workflow → Authorization → Domain Rule → Repository → Audit → DB Guard → Test` đều hoàn chỉnh.

---

## 1. MA TRẬN WORKFLOW COVERAGE (WORKFLOW COVERAGE MATRIX)

| Activity                             | Current Path                                                   | Expected Workflow         | FSM         | App Service             | Domain Rule        | Auth            | Audit           | DB Guard      | Test    | Coverage               |
| :----------------------------------- | :------------------------------------------------------------- | :------------------------ | :---------- | :---------------------- | :----------------- | :-------------- | :-------------- | :------------ | :------ | :--------------------- |
| **ACT-PROD-001 (Create Product)**    | UI → Form → AppService → Repo → DB                             | PROD_CREATION             | N/A         | ProductAppService       | Required fields    | RBAC            | Double (UI+Svc) | App Check     | Unit    | PARTIAL                |
| **ACT-PROD-002 (Update Product)**    | UI → Form → AppService → Repo → DB                             | PROD_UPDATE               | N/A         | ProductAppService       | OCC Lock           | RBAC            | Double (UI+Svc) | App Check     | Unit    | PARTIAL                |
| **ACT-PROD-003 (Delete Product)**    | UI → List → AppService → Repo → databaseService (Cascade)      | PROD_DELETE               | N/A         | ProductAppService       | Cascade rule       | RBAC            | Svc Log         | App Check     | Unit    | PARTIAL                |
| **ACT-PROD-004 (Bulk Import)**       | UI → Quick Text → bulkAddProducts → Repo → Multi-path DB       | PROD_BULK_IMPORT          | N/A         | ProductAppService       | None (Unvalidated) | RBAC            | Single Log      | App Check     | Missing | LOCAL / GAP            |
| **ACT-TCCS-001 (Create TCCS)**       | UI → Form → AppService → Repo → DB                             | TCCS_CREATION             | N/A         | TCCSAppService          | Uniqueness         | RBAC            | Svc Log         | App Check     | Unit    | PARTIAL                |
| **ACT-TCCS-002 (Update TCCS)**       | UI → Form → AppService → Direct DB (ref(db))                   | TCCS_UPDATE               | N/A         | TCCSAppService          | Active swap        | RBAC            | Svc Log         | Bypassed Repo | Unit    | PARTIAL                |
| **ACT-TCCS-004 (Approve TCCS)**      | UI → Detail → ApprovalWorkflowService → React useState         | TCCS_APPROVAL             | Task FSM    | ApprovalWorkflowService | 2-Step Gate        | RBAC            | In-memory       | Unsaved       | Unit    | LOCAL / GAP            |
| **ACT-FORM-001 (Create Formula)**    | UI → Form → AppService → Repo → DB                             | FORMULA_CREATION          | N/A         | FormulaAppService       | Unique Prod        | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-FORM-002 (Update Formula)**    | UI → Form → AppService → Repo → DB                             | FORMULA_UPDATE            | N/A         | FormulaAppService       | Field check        | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-FORM-003 (Delete Formula)**    | UI → Form → AppService → Repo → DB                             | FORMULA_DELETE            | N/A         | FormulaAppService       | None               | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-MATR-001 (Create Material)**   | UI → Form → AppService → Repo → DB                             | MATERIAL_CREATION         | N/A         | MaterialAppService      | CAS validate       | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-MATR-002 (Update Material)**   | UI → Form → AppService → Repo → DB                             | MATERIAL_UPDATE           | N/A         | MaterialAppService      | CAS validate       | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-MATR-003 (Delete Material)**   | UI → Form → AppService → Repo → DB                             | MATERIAL_DELETE           | N/A         | MaterialAppService      | None               | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-BTCH-001 (Create Batch)**      | UI → Form → AppService → Repo → DB                             | BATCH_CREATION            | PENDING     | BatchAppService         | Date/Yield         | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-BTCH-002 (Update Batch)**      | UI → Form → AppService → Repo → DB                             | BATCH_UPDATE              | Preserved   | BatchAppService         | OCC/Locked         | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-BTCH-003 (Start Testing)**     | UI → Detail → AppService.updateStatus → Repo                   | START_TESTING             | Batch FSM   | BatchAppService         | Allowed roles      | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-BTCH-004 (Release Batch)**     | UI → Detail/List → AppService.updateStatus → Repo              | RELEASE_BATCH             | Batch FSM   | BatchAppService         | 7 Gates            | Admin Bypass    | Svc Log         | App Check     | Unit    | PARTIAL (Admin Bypass) |
| **ACT-BTCH-005 (Reject Batch)**      | UI → Detail/List → AppService.updateStatus → Repo              | REJECT_BATCH              | Batch FSM   | BatchAppService         | Reason req         | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-BTCH-006 (Block Batch)**       | UI → Detail/List → AppService.updateStatus → Repo              | BLOCK_BATCH               | Batch FSM   | BatchAppService         | Reason req         | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-BTCH-007 (Reopen Batch)**      | UI → Detail/List → AppService.updateStatus → Repo              | REOPEN_BATCH              | Batch FSM   | BatchAppService         | Reason req         | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-BTCH-008 (Delete Batch)**      | UI → List → AppService.deleteBatch → Repo                      | BATCH_DELETE              | Cannot Rel  | BatchAppService         | Not Released       | RBAC            | Double (UI+Svc) | App Check     | Unit    | PARTIAL (Double Log)   |
| **ACT-BTCH-012 (AI Quick Batch)**    | AI Chat → AppStore.addBatch → AppService                       | BATCH_CREATION            | PENDING     | BatchAppService         | Quick payload      | None            | Svc Log         | App Check     | Missing | PARTIAL                |
| **ACT-TEST-001 (Create Result)**     | UI → useTestResultSave → AppService → Repo                     | TEST_RESULT_CREATION      | Undefined   | TestResultAppService    | Lab & Date         | RBAC            | Double (UI+Svc) | App Check     | Unit    | PARTIAL                |
| **ACT-TEST-002 (Update Result)**     | UI → useTestResultSave → AppService → Repo                     | TEST_RESULT_UPDATE        | Preserved   | TestResultAppService    | OCC & Lock         | RBAC            | Double (UI+Svc) | App Check     | Unit    | PARTIAL                |
| **ACT-TEST-003 (Delete Result)**     | UI → List → AppService.deleteTestResult → Repo                 | TEST_RESULT_DELETE        | Not Appr    | TestResultAppService    | Not Released       | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-TEST-004 (Submit Review)**     | Service Only (TestResultAppService.updateWorkflowStatus)       | SUBMIT_FOR_REVIEW         | TR FSM      | TestResultAppService    | Status check       | RBAC            | Svc Log         | None          | Unit    | ORPHAN ACTION (No UI)  |
| **ACT-TEST-005 (Finalize TR)**       | Service Only (TestResultAppService.updateWorkflowStatus)       | FINALIZE_RESULT           | TR FSM      | TestResultAppService    | Quality matrix     | RBAC            | Svc Log         | None          | Unit    | ORPHAN ACTION (No UI)  |
| **ACT-TEST-006 (Approve TR)**        | Service Only (TestResultAppService.updateWorkflowStatus)       | APPROVE_RESULT            | TR FSM      | TestResultAppService    | E-Sign req         | RBAC            | Svc Log         | None          | Unit    | ORPHAN ACTION (No UI)  |
| **ACT-TEST-007 (Supersede TR)**      | Service Only (TestResultAppService.updateWorkflowStatus)       | SUPERSEDE_RESULT          | TR FSM      | TestResultAppService    | Reason req         | RBAC            | Svc Log         | None          | Unit    | ORPHAN ACTION (No UI)  |
| **ACT-TEST-008 (Save Incomplete)**   | UI → `window.confirm` → Save Draft                             | DRAFT_CONFIRMATION        | N/A         | None (UI Hook)          | Progress %         | UI Only         | None            | None          | Unit    | LOCAL UI LOGIC         |
| **ACT-EVAL-001 (Criterion Eval)**    | Engine Pure Function                                           | CRITERION_EVAL            | N/A         | None (Pure Domain)      | Specs & Limits     | None            | None            | None          | Unit    | FULL                   |
| **ACT-EVAL-002 (Overall Eval)**      | Engine Pure Function                                           | OVERALL_EVAL              | N/A         | None (Pure Domain)      | PASS/FAIL/PEND     | None            | None            | None          | Unit    | FULL                   |
| **ACT-EVAL-003 (Snapshot Seal)**     | Engine Pure Function                                           | SNAPSHOT_SEALING          | Sealed      | None (Pure Domain)      | SHA-256 FIPS       | None            | None            | None          | Unit    | FULL                   |
| **ACT-EVAL-004 (Snapshot Verify)**   | Crypto Verification Function                                   | INTEGRITY_VERIFY          | Verified    | None (Pure Domain)      | Hash Match         | None            | None            | None          | Unit    | FULL                   |
| **ACT-ALTR-001 (FAIL_RETRY)**        | Alternate Engine                                               | ALTERNATE_RESOLVE         | N/A         | None (Pure Domain)      | 5-Tier Specs       | None            | None            | None          | Unit    | FULL                   |
| **ACT-ALTR-002 (CONDITIONAL)**       | Alternate Engine                                               | ALTERNATE_RESOLVE         | N/A         | None (Pure Domain)      | Condition Val      | None            | None            | None          | Unit    | FULL                   |
| **ACT-DEV-001 (Create Deviation)**   | UI → Form → AppService → Repo → DB                             | DEVIATION_CREATION        | LOGGED      | DeviationAppService     | Title/Source       | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-DEV-002 (Auto OOS Dev)**       | TestResultAppService → DeviationAppService                     | DEVIATION_AUTO_OOS        | LOGGED      | DeviationAppService     | Fail trigger       | System          | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-DEV-003 (Status Transition)**  | UI → Modal → AppService.updateStatus → Repo                    | DEVIATION_TRANSITION      | Dev FSM     | DeviationAppService     | Notes & Role       | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-DEV-004 (Hook Status Bypass)** | Hook → firebaseDeviationRepository.updateStatus                | BYPASS DEVIATION WORKFLOW | Bypassed    | None (Bypassed)         | None               | None            | None            | None          | Missing | CRITICAL GAP           |
| **ACT-DEV-005 (Hook Delete Bypass)** | Hook → firebaseDeviationRepository.delete                      | BYPASS DEVIATION WORKFLOW | Bypassed    | None (Bypassed)         | None               | None            | None            | None          | Missing | CRITICAL GAP           |
| **ACT-CAPA-001 (Add CAPA Item)**     | UI → Modal → CAPAService → DeviationAppService                 | CAPA_ACTION_CREATE        | PENDING     | CAPAService             | Due Date           | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-CAPA-002 (Complete CAPA)**     | UI → Button → CAPAService → DeviationAppService                | CAPA_ACTION_COMPLETE      | COMPLETED   | CAPAService             | Evidence           | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-CAPA-003 (Verify & Close)**    | UI → Modal → CAPAService → DeviationAppService                 | CAPA_CLOSE                | CLOSED      | CAPAService             | Verification       | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-OOS-001 (Trigger OOS)**        | Service → OOSService → DeviationAppService                     | OOS_INVESTIGATION_START   | LOGGED      | OOSService              | Fail Criteria      | System          | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-OOS-002 (Phase 1 Invest)**     | UI → Modal → OOSService → DeviationAppService                  | OOS_PHASE_1_SUBMIT        | UNDER_INV   | OOSService              | Lab error          | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-OOS-003 (Phase 2 Invest)**     | UI → Modal → OOSService → DeviationAppService                  | OOS_PHASE_2_CONCLUDE      | CLOSED      | OOSService              | Root Cause         | RBAC            | Svc Log         | App Check     | Unit    | FULL                   |
| **ACT-CHG-001 (Create CR)**          | UI → Form → AppService → localStorage                          | CHANGE_CONTROL_CREATE     | DRAFT       | ChangeControlAppService | Required           | None            | Svc Log         | LocalStorage  | Unit    | LOCAL / GAP            |
| **ACT-CHG-002 (Update CR Status)**   | UI → Modal → AppService → localStorage                         | CHANGE_CONTROL_STATUS     | CR FSM      | ChangeControlAppService | Notes              | None            | Svc Log         | LocalStorage  | Unit    | LOCAL / GAP            |
| **ACT-CHG-003 (Add CR Action)**      | UI → Form → AppService → localStorage                          | CR_ACTION_CREATE          | PENDING     | ChangeControlAppService | Deadlines          | None            | Svc Log         | LocalStorage  | Unit    | LOCAL / GAP            |
| **ACT-CHG-004 (Complete Action)**    | UI → Button → AppService → localStorage                        | CR_ACTION_COMPLETE        | COMPLETED   | ChangeControlAppService | Evidence           | None            | Svc Log         | LocalStorage  | Unit    | LOCAL / GAP            |
| **ACT-COA-001 (CoA Payload)**        | Service (CoAService.generateCoAPayload)                        | COA_GENERATION            | Locked      | CoAService              | Snapshot Check     | RBAC            | None            | None          | Unit    | ORPHAN SERVICE         |
| **ACT-COA-002 (CoA Render)**         | UI → CoAReport.tsx (Fallback recalculation)                    | COA_RENDER                | Fallback    | None (Local Component)  | Ad-hoc Rules       | None            | None            | None          | Unit    | LOCAL CALC GAP         |
| **ACT-LAB-001 (Create Lab)**         | UI → Modal → systemSlice.addTestingLaboratory → RTDB           | LAB_CREATION              | None        | None (Bypassed)         | None               | Admin UI        | None            | None          | Unit    | GAP (Direct Write)     |
| **ACT-LAB-002 (Update Lab)**         | UI → Modal → systemSlice.updateTestingLaboratory → RTDB        | LAB_UPDATE                | None        | None (Bypassed)         | None               | Admin UI        | None            | None          | Unit    | GAP (Direct Write)     |
| **ACT-LAB-003 (Delete Lab)**         | UI → Button → systemSlice.deleteTestingLaboratory → RTDB       | LAB_DELETE                | None        | None (Bypassed)         | None               | Admin UI        | None            | None          | Unit    | GAP (Direct Write)     |
| **ACT-CRIT-001 (Create MasterCrit)** | UI → Modal → masterCriterionRepository.save → RTDB             | MASTER_CRITERIA_CREATE    | None        | None (Bypassed)         | None               | Admin UI        | None            | None          | Unit    | GAP (Bypassed)         |
| **ACT-CRIT-002 (Update MasterCrit)** | UI → Modal → masterCriterionRepository.update → RTDB           | MASTER_CRITERIA_UPDATE    | None        | None (Bypassed)         | None               | Admin UI        | None            | None          | Unit    | GAP (Bypassed)         |
| **ACT-CRIT-003 (Delete MasterCrit)** | UI → Button → masterCriterionRepository.delete → RTDB          | MASTER_CRITERIA_DELETE    | None        | None (Bypassed)         | None               | Admin UI        | None            | None          | Unit    | GAP (Bypassed)         |
| **ACT-CRIT-004 (Bulk Rename)**       | UI → Form → bulkRenameCriteriaInAllTestResults → Multi-DB      | CRITERIA_RENAME_MUTATION  | None        | None (UI Script)        | Mass updates       | None            | UI Single       | None          | Missing | CRITICAL GAP           |
| **ACT-CRIT-005 (Create Alias)**      | UI → Modal → TCCSAppService → Direct DB (ref(db))              | ALIAS_CREATION            | None        | TCCSAppService          | Clean alias        | RBAC            | Svc Log         | Bypassed Repo | Unit    | PARTIAL                |
| **ACT-CRIT-006 (Confirm Alias)**     | UI → Button → TCCSAppService → Direct DB (ref(db))             | ALIAS_CONFIRMATION        | Confirmed   | TCCSAppService          | Flag               | RBAC            | Svc Log         | Bypassed Repo | Unit    | PARTIAL                |
| **ACT-CRIT-007 (Delete Alias)**      | UI → Button → TCCSAppService → Direct DB (ref(db))             | ALIAS_DELETION            | Deleted     | TCCSAppService          | ID check           | RBAC            | Svc Log         | Bypassed Repo | Unit    | PARTIAL                |
| **ACT-AI-005 (AI Learned Map)**      | Auto / Save → TCCSAppService → Direct DB (ref(db))             | AI_MAPPING_LEARN          | Frequency   | TCCSAppService          | Incr frequency     | None            | Svc Log         | Bypassed Repo | Unit    | PARTIAL                |
| **ACT-AI-006 (AI Auto-Heal)**        | AI Call / Manual → dataConsistencyService.autoHealAllWithAI    | MASS_REPAIR               | Repaired    | None (Service Script)   | Mass Mutate        | None            | Svc Log         | None          | Unit    | CRITICAL GAP           |
| **ACT-SYS-001 (Update Role)**        | UI → UserManagement → userService.updateUserRole → RTDB        | USER_ROLE_MUTATION        | Role FSM    | userService             | Admin Check        | Admin UI        | Ad-hoc Log      | None          | Unit    | PARTIAL                |
| **ACT-SYS-002 (Delete User)**        | UI → UserManagement → userService.deleteUser → RTDB            | USER_DELETION             | Deleted     | userService             | Admin Check        | Admin UI        | Ad-hoc Log      | None          | Unit    | PARTIAL                |
| **ACT-SYS-003 (Save Pharma)**        | UI → Modal → pharmacopoeiaService.savePharmacopoeiaStandard    | PHARMA_SAVE               | None        | None (Direct DB)        | None               | None            | None            | None          | Unit    | GAP (Direct Write)     |
| **ACT-SYS-004 (Delete Pharma)**      | UI → Button → pharmacopoeiaService.deletePharmacopoeiaStandard | PHARMA_DELETE             | None        | None (Direct DB)        | None               | None            | None            | None          | Unit    | GAP (Direct Write)     |
| **ACT-SYS-005 (Seed Pharma)**        | UI → Button → pharmacopoeiaService.seedDefaultPharmacopoeia    | PHARMA_SEED               | None        | None (Direct DB)        | None               | None            | None            | None          | Unit    | GAP (Direct Write)     |
| **ACT-SYS-007 (Restore Backup)**     | UI → Settings → systemSlice.loadBackup → set(ref(db), restore) | DATABASE_RESTORE          | Overwritten | None (Zustand Direct)   | None               | Admin UI        | None            | None          | Missing | CRITICAL GAP           |
| **ACT-SYS-008 (Clear All DB)**       | UI → Settings → systemSlice.clearAllData → set(ref(db), null)  | DATABASE_WIPE             | Nullified   | None (Zustand Direct)   | None               | Admin UI        | None            | None          | Missing | CRITICAL GAP           |
| **ACT-SYS-009 (Reset Demo DB)**      | UI → Settings → systemSlice.resetToDemoData → set(ref(db))     | DATABASE_DEMO_SEED        | Overwritten | None (Zustand Direct)   | None               | None            | None            | None          | Missing | CRITICAL GAP           |
| **ACT-SYS-010 (Auto-Heal Plan)**     | UI → DataConsistencyCenter → executeAutoHealPlan → Multi-Svc   | DATA_CONSISTENCY_HEAL     | Healed      | dataConsistencyService  | Multi-checks       | Admin UI        | Svc Log         | None          | Unit    | Controlled             |
| **ACT-SYS-011 (Cron Auto-Heal)**     | Cloud Function → db.ref().update(updates)                      | CLOUD_AUTO_HEAL           | Healed      | Cloud Function          | Suffix match       | Service Account | Cron Log        | None          | Unit    | Controlled             |
| **ACT-SYS-012 (Orphan Wipe)**        | Unused Export: `databaseService.clearDatabaseService`          | UNUSED_WIPE               | Destructive | None (Orphan)           | set(ref(db), null) | None            | None            | None          | Unit    | CRITICAL ORPHAN        |
| **ACT-SYS-013 (Orphan Update)**      | Unused Export: `databaseService.updateRootService`             | UNUSED_UPDATE             | Destructive | None (Orphan)           | update(ref(db))    | None            | None            | None          | Unit    | CRITICAL ORPHAN        |

---

## 2. PHÂN LOẠI 8 NHÓM HOẠT ĐỘNG (THE 8 ACTIVITY GROUPS)

### A. FULLY WORKFLOW CONTROLLED (18 Hoạt động)

- `ACT-FORM-001`, `ACT-FORM-002`, `ACT-FORM-003` (Formula Lifecycle)
- `ACT-MATR-001`, `ACT-MATR-002`, `ACT-MATR-003` (Material Lifecycle)
- `ACT-BTCH-001`, `ACT-BTCH-002`, `ACT-BTCH-003`, `ACT-BTCH-005`, `ACT-BTCH-006`, `ACT-BTCH-007` (Batch Lifecycle trừ Release)
- `ACT-TEST-003` (Test Result Delete)
- `ACT-EVAL-001`, `ACT-EVAL-002`, `ACT-EVAL-003`, `ACT-EVAL-004` (Deterministic Quality Evaluation & Snapshot)
- `ACT-ALTR-001`, `ACT-ALTR-002` (Deterministic Alternate Rule Resolver)
- `ACT-DEV-001`, `ACT-DEV-002`, `ACT-DEV-003` (Deviation Lifecycle)
- `ACT-CAPA-001`, `ACT-CAPA-002`, `ACT-CAPA-003` (CAPA Lifecycle)
- `ACT-OOS-001`, `ACT-OOS-002`, `ACT-OOS-003` (OOS Lifecycle)

### B. PARTIALLY WORKFLOW CONTROLLED (15 Hoạt động)

- `ACT-PROD-001`, `ACT-PROD-002` (Product Create/Update có Duplicate Audit Log từ UI)
- `ACT-PROD-003` (Product Delete có Cascade Service nhưng thiếu Transaction an toàn)
- `ACT-TCCS-001`, `ACT-TCCS-002` (TCCS Update ghi trực tiếp Firebase DB `ref(db)` thay vì qua Repository)
- `ACT-BTCH-004` (Batch Release bị Admin Bypass 7 Release Gates)
- `ACT-BTCH-008` (Batch Delete có Duplicate Audit Log từ UI)
- `ACT-BTCH-012` (AI Quick Batch tạo Lô không qua validation đầy đủ của UI)
- `ACT-TEST-001`, `ACT-TEST-002` (Test Result Create/Update chưa gán `workflowStatus` và có Double Audit)
- `ACT-CRIT-005`, `ACT-CRIT-006`, `ACT-CRIT-007` (Criteria Alias CRUD đi thẳng `ref(db)` trong TCCSAppService)
- `ACT-AI-005` (AI Learned Mapping đi thẳng `ref(db)`)
- `ACT-SYS-001`, `ACT-SYS-002` (User Management gọi trực tiếp Firebase và ghi log tùy biến)

### C. LOCALLY CONTROLLED (11 Hoạt động)

- `ACT-TCCS-004` (TCCS Approval chỉ lưu trong React `useState`, không lưu vào CSDL)
- `ACT-TEST-008` (Test Result lưu thiếu chỉ tiêu hỏi qua `window.confirm` thay vì modal chuẩn)
- `ACT-COA-002` (CoA Render tự tính toán lại quy tắc thay thế và deduplication khi thiếu snapshot)
- `ACT-CHG-001`, `ACT-CHG-002`, `ACT-CHG-003`, `ACT-CHG-004` (Change Control lưu vào trình duyệt `localStorage`)
- `ACT-CRIT-004` (Criteria Mass Rename chạy vòng lặp cập nhật hàng trăm phiếu từ component UI)
- `ACT-SYS-007`, `ACT-SYS-008`, `ACT-SYS-009` (Backup Restore, Wipe DB, Reset Demo gọi trực tiếp `firebaseSet` từ store)

### D. DUPLICATED WORKFLOW (2 Hoạt động)

- `ACT-BTCH-004` vs `ACT-BTCH-011`: Cả `BatchAppService.updateStatus('RELEASED')` và `ReleaseService.releaseBatch` cùng chứa logic thẩm định xuất xưởng Lô.
- `ProductFormPage` / `useBatchList` / `useTestResultSave` ghi nhật ký Audit song song với Application Services.

### E. LEGACY WORKFLOW (3 Hoạt động)

- `testResultService.ts`: Chứa `fetchTestResultsByBatchId`, `fetchTestResultById`, `fetchTestResultsByProductId` gộp store/cache/DB từ trước thời kỳ TanStack Query v5.
- `databaseService.ts`: Chứa `deleteProductService`, `deleteBatchService`, `deleteTestResultService` kế thừa phương pháp cascade cũ.

### F. ORPHAN ACTION (4 Hoạt động)

- `ACT-TEST-004` (`SUBMIT_FOR_REVIEW`)
- `ACT-TEST-005` (`FINALIZE_RESULT`)
- `ACT-TEST-006` (`APPROVE_RESULT`)
- `ACT-TEST-007` (`SUPERSEDE_RESULT`)
  Đã có đầy đủ Action Contract và State Machine trong Domain & Service, nhưng UI hoàn toàn không có nút hoặc luồng để kích hoạt!

### G. ORPHAN SERVICE (4 Hoạt động)

- `ReleaseService.ts`: Đã viết hoàn chỉnh nhưng không component nào import hoặc gọi đến.
- `CoAService.ts`: Đã viết hoàn chỉnh `generateCoAPayload` nhưng `CoAReportPage` không dùng.
- `databaseService.clearDatabaseService` & `databaseService.updateRootService`: Các hàm xóa/ghi đè root không được sử dụng nhưng mở toang cửa nguy hiểm.
- `useDeviationQueries.ts` (`useUpdateDeviationStatusMutation`, `useDeleteDeviationMutation`): Mutation hooks mồ côi bypass `DeviationAppService`.

### H. ORPHAN STATE (2 Hoạt động)

- `TestResult.workflowStatus`: Có định nghĩa 6 trạng thái trong FSM (`DRAFT`, `SUBMITTED`, `FINAL`, `APPROVED`, `RELEASED`, `SUPERSEDED`), nhưng trong dữ liệu lưu thực tế thường bị để trống (`undefined`) do UI chỉ lưu `overallStatus` (Quality Status).
- `TCCS.status`: TCCS Form & Detail không quản lý workflow status chính thức (`DRAFT`, `SUBMITTED`, `APPROVED`, `ACTIVE`, `SUPERSEDED`) mà chỉ có cờ nhị phân `isActive: boolean`.

---

## 3. CHỈ SỐ WORKFLOW COVERAGE HIỆN TẠI (CURRENT METRICS)

$$\text{Canonical Workflow Coverage} = \frac{\text{Fully Controlled Activities (18)}}{\text{Total Regulated Activities (62)}} = 29.0\%$$

$$\text{Supervised Coverage (Fully + Partially)} = \frac{18 + 15}{62} = 53.2\%$$

**Mục tiêu sau Rebuild:** **100%** Canonical Workflow Coverage, triệt tiêu 100% các hoạt động thuộc nhóm C, D, E, F, G, H.
