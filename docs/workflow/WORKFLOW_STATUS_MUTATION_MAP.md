# PQM — WORKFLOW STATUS MUTATION MAP

> **Bản đồ kiểm soát toàn bộ các điểm thay đổi Workflow Status trong hệ thống PQM**
> Tuân thủ chuẩn mực PQM System Workflow Master và FDA 21 CFR Part 11 / GMP-WHO Annex 11.

---

## 1. NGUYÊN TẮC BẤT BIẾN

1. **Ba trục hoàn toàn độc lập**:
   - **Completion Status**: Tỷ lệ phần trăm chỉ tiêu đã phân tích (`percentage`, `isComplete`).
   - **Quality Status**: Kết luận chất lượng kỹ thuật (`PASS`, `FAIL`, `PENDING`, `UNKNOWN`, `INCOMPLETE`).
   - **Workflow Status**: Quyết định xuất xưởng / lưu chuyển nghiệp vụ (`PENDING`, `TESTING`, `BLOCKED`, `RELEASED`, `REJECTED`).
2. **Không có bất kỳ sự tự động suy luận nào**:
   - $100\% \not\to \text{RELEASED}$
   - $\text{PASS} \not\to \text{RELEASED}$
   - $\text{FAIL} \not\to \text{REJECTED}$
   - $\text{PENDING} \not\to \text{REJECTED}$
   - $\text{UNKNOWN} \not\to \text{REJECTED}$
3. **Cổng kiểm soát duy nhất**:
   - Mọi thay đổi Workflow Status của Batch phải đi qua: `BatchAppService.updateStatus()`.
   - Mọi thay đổi Workflow Status của TestResult phải đi qua: `TestResultAppService.updateWorkflowStatus()`.

---

## 2. MA TRẬN PHÂN LOẠI CALLER (CALLER MUTATION MAP)

| Caller                          | Vị trí (File & Line)                                                    | Mutation mục tiêu                           |  Được phép?   | Route chuẩn hóa                                     |
| :------------------------------ | :---------------------------------------------------------------------- | :------------------------------------------ | :-----------: | :-------------------------------------------------- |
| **TestResult Save Hook**        | `src/hooks/test-results/useTestResultSave.ts`                           | Batch $\to$ `RELEASED`                      |  ❌ **CẤM**   | Xóa hoàn toàn. Chỉ Release qua Release Gate.        |
| **TestResult Save Hook**        | `src/hooks/test-results/useTestResultSave.ts`                           | Batch $\to$ `REJECTED`                      |  ❌ **CẤM**   | Xóa hoàn toàn. Chỉ Reject qua QA Reject Action.     |
| **TestResult Save Hook**        | `src/hooks/test-results/useTestResultSave.ts`                           | Batch $\to$ `TESTING`                       |  ❌ **CẤM**   | Xóa hoàn toàn side effect.                          |
| **Batch Selection**             | `src/hooks/test-results/useTestResultForm.ts`                           | Batch $\to$ `TESTING`                       |  ❌ **CẤM**   | Xóa hoàn toàn side effect. Chỉ đọc và hiển thị.     |
| **AI Create Batch**             | `src/services/ai/tools/batchActionTools.ts:96`                          | Batch $\to$ `TESTING`                       |  ❌ **CẤM**   | Khởi tạo bắt buộc `PENDING`.                        |
| **AI Form Auto-Create**         | `src/pages/qa/test-result-form/hooks/useTestResultAIIntegration.ts:372` | Batch $\to$ `TESTING`                       |  ❌ **CẤM**   | Khởi tạo bắt buộc `PENDING`.                        |
| **AI Chat Auto-Create**         | `src/components/features/AIAssistantChat.tsx:794`                       | Batch $\to$ `TESTING`                       |  ❌ **CẤM**   | Khởi tạo bắt buộc `PENDING`.                        |
| **AI updateBatchStatus**        | `src/services/ai/tools/batchActionTools.ts:204`                         | Batch $\to$ `RELEASED`/`REJECTED`/`TESTING` |  ❌ **CẤM**   | Proposal-only. AI không trực tiếp gọi store/repo.   |
| **Generic Batch CRUD**          | `src/services/app/BatchAppService.ts:105` (`updateBatch`)               | Batch $\to$ status mutation                 |  ❌ **CẤM**   | Chặn đứng bằng guard `batch.status !== old.status`. |
| **Direct Firebase Write**       | `database.rules.json` / Generic Save                                    | Bypass FSM transitions                      |  ❌ **CẤM**   | Rules từ chối các bước nhảy trái phép.              |
| **Batch Action: START_TESTING** | `src/domain/workflow/workflowActions.ts`                                | `PENDING` $\to$ `TESTING`                   | ✅ **HỢP LỆ** | `BatchAppService.updateStatus` (LAB/PROD/QA).       |
| **Batch Action: RELEASE_BATCH** | `src/domain/workflow/workflowActions.ts`                                | `TESTING` $\to$ `RELEASED`                  | ✅ **HỢP LỆ** | QA/ADMIN + 7 Release Gates + E-Sign.                |
| **Batch Action: REJECT_BATCH**  | `src/domain/workflow/workflowActions.ts`                                | `TESTING`/`PENDING` $\to$ `REJECTED`        | ✅ **HỢP LỆ** | QA/ADMIN + Lý do giải trình bắt buộc + E-Sign.      |
| **Batch Action: BLOCK_BATCH**   | `src/domain/workflow/workflowActions.ts`                                | `TESTING`/`RELEASED` $\to$ `BLOCKED`        | ✅ **HỢP LỆ** | QA/ADMIN + Lý do giải trình/thu hồi bắt buộc.       |
| **Batch Action: REOPEN_BATCH**  | `src/domain/workflow/workflowActions.ts`                                | `REJECTED` $\to$ `PENDING`                  | ✅ **HỢP LỆ** | QA/ADMIN + Lý do xét duyệt CAPA bắt buộc.           |
| **Batch Action: UNBLOCK_BATCH** | `src/domain/workflow/workflowActions.ts`                                | `BLOCKED` $\to$ `TESTING`                   | ✅ **HỢP LỆ** | QA/ADMIN + Kế hoạch kiểm nghiệm lại (Retest Plan).  |
| **TestResult SUBMIT**           | `src/services/app/TestResultAppService.ts`                              | `DRAFT` $\to$ `SUBMITTED`                   | ✅ **HỢP LỆ** | LAB / QC / QA.                                      |
| **TestResult FINALIZE**         | `src/services/app/TestResultAppService.ts`                              | `SUBMITTED` $\to$ `FINAL`                   | ✅ **HỢP LỆ** | QC / QA / ADMIN.                                    |
| **TestResult APPROVE**          | `src/services/app/TestResultAppService.ts`                              | `FINAL` $\to$ `APPROVED`                    | ✅ **HỢP LỆ** | QA / ADMIN + Chữ ký số 21 CFR Part 11.              |
| **TestResult SUPERSEDE**        | `src/services/app/TestResultAppService.ts`                              | `APPROVED` $\to$ `SUPERSEDED`               | ✅ **HỢP LỆ** | QA / ADMIN + Lý do kiểm nghiệm lại.                 |

---

## 3. KIẾN TRÚC THỰC THI CHUẨN MỰC

```text
DATA ENTRY (Form/OCR/Import)
    ↓
EVALUATION (CriterionEvaluator / AlternateRuleEvaluator)
    ↓
QUALITY STATUS (PASS / FAIL / PENDING / UNKNOWN)
    ↓
EXPLICIT WORKFLOW ACTION REQUEST (UI / Human Intent)
    ↓
AUTHORIZATION & RBAC (can() - QA/ADMIN)
    ↓
STATE MACHINE ENFORCEMENT (BatchStateMachine / TestResultWorkflowStateMachine)
    ↓
BUSINESS PREREQUISITES & 7 GATES (ReleaseRules.evaluateReleasePrerequisites())
    ↓
ELECTRONIC SIGNATURE (FDA 21 CFR Part 11 / SHA-256 Checksum)
    ↓
DATABASE MUTATION (Repository Level)
    ↓
AUDIT TRAIL LOGGING (ALCOA+ Immutable Ledger)
```
