# PQM — WORKFLOW REPAIR REPORT

> **Báo cáo chi tiết công tác sửa chữa, refactor và hardening hệ thống Workflow**
> Ngày thực hiện: 21/09/2026

---

## 1. TỔNG QUAN

Đợt refactor toàn diện này giải quyết dứt điểm hiện tượng Workflow Status bị "đột biến" (unauthorized status mutation) do các luồng ngoài Workflow (Data Entry, OCR, AI Assistant, Generic CRUD) gây ra. Toàn bộ 22 mã vi phạm (WF-001 đến WF-022) đã được loại bỏ và bảo vệ bằng rào chắn kiến trúc đa tầng:

1. **Domain Layer**: `BatchStateMachine`, `TestResultWorkflowStateMachine`, `ReleaseRules`, `workflowActions`.
2. **Application Service Layer**: `BatchAppService`, `TestResultAppService`, Fresh DB read, OCC.
3. **Database Security Layer**: Firebase Realtime Database Security Rules (`database.rules.json`), `SecurityRulesValidator`.
4. **Static Architecture Guard**: `src/architecture/workflowMutationGuard.test.ts`.

---

## 2. CHI TIẾT CÁC SỬA ĐỔI CHÍNH THEO FILE

### 2.1. `src/hooks/test-results/useTestResultSave.ts`

- **Xóa**: Lệnh `updateBatchStatus(batchId, BATCH_STATUS.RELEASED)` khi phiếu đạt.
- **Xóa**: Lệnh `updateBatchStatus(batchId, BATCH_STATUS.REJECTED)` khi phiếu không đạt.
- **Sửa thông báo**: Cảnh báo phiếu FAIL được viết lại đúng quy chuẩn:
  > _"Phiếu kiểm nghiệm có kết quả QUALITY = FAIL. Việc lưu Phiếu sẽ không tự động thay đổi Workflow Status của Lô. Quyết định RELEASED / REJECTED / BLOCKED được thực hiện theo Workflow và thẩm quyền tương ứng."_

### 2.2. `src/hooks/test-results/useTestResultForm.ts`

- **Xóa**: Side effect tự động gọi `updateBatchStatus(batchId, BATCH_STATUS.TESTING)` khi mở form hoặc chọn Lô trong dropdown.
- Luồng chọn Lô chuyển thành thuần túy nạp dữ liệu (Load TCCS Snapshot, Test Results, Deviations) mà không làm biến đổi trạng thái Lô.

### 2.3. `src/services/app/BatchAppService.ts`

- **`createBatch()`**: Cưỡng chế `status = 'PENDING'` bất kể caller gửi vào trạng thái nào.
- **`updateBatch()`**: Bổ sung guard chống mutation status qua CRUD:
  ```ts
  if (old && batch.status && batch.status !== old.status) {
    throw new Error(
      'Không được thay đổi Workflow Status thông qua updateBatch(). Hãy sử dụng Workflow Action tương ứng.'
    );
  }
  ```
  Bảo toàn các trường `status`, `releasedAt`, `releasedBy`, `rejectReason`.
- **`updateStatus()`**:
  - Đọc fresh data từ cơ sở dữ liệu (`this.repo.findById(batchId)`).
  - Kiểm tra thẩm quyền QA/ADMIN cho các bước chuyển nhạy cảm.
  - Kiểm tra lý do giải trình bắt buộc cho `REJECTED`, `BLOCKED`, `REJECTED -> PENDING` (CAPA), `BLOCKED -> TESTING` (Retest Plan).
  - Kiểm tra chữ ký điện tử FDA 21 CFR Part 11 đối với xuất xưởng Lô (`RELEASED`).
  - Chạy thẩm tra qua Single Source of Truth `ReleaseRules.evaluateReleasePrerequisites()`.

### 2.4. `src/services/app/TestResultAppService.ts`

- **`updateWorkflowStatus()`**:
  - Đọc fresh TestResult từ cơ sở dữ liệu (`this.repo.findById(id)`).
  - Bắt buộc kiểm tra chữ ký điện tử 21 CFR Part 11 khi chuyển sang `APPROVED` (`options.signature`).
  - Kiểm tra tính toàn vẹn SHA-256 qua `signatureService.verifySignatureIntegrity()`.
  - Phân quyền nghiêm ngặt đối với `SUPERSEDED` (chỉ QA/ADMIN có lý do rõ ràng).

### 2.5. `src/domain/workflow/stateMachine.ts`

- Hoàn thiện ma trận phân quyền trong `BatchStateMachine` (`QA_ADMIN_REQUIRED_TRANSITIONS`).
- Bổ sung lý do bắt buộc cho `BLOCKED -> TESTING` và `REJECTED -> PENDING`.
- Bổ sung `ROLE_REQUIREMENTS` và reason check cho `TestResultWorkflowStateMachine` khi `SUPERSEDED`.

### 2.6. `src/domain/rules/BatchRules.ts`

- Hợp nhất Release Gate: `BatchRules.canRelease()` ủy quyền toàn bộ việc đánh giá cho `ReleaseRules.evaluateReleasePrerequisites()`, xóa bỏ hoàn toàn tình trạng hai nơi cùng đánh giá độc lập.

### 2.7. `src/services/ai/tools/batchActionTools.ts`, `useTestResultAIIntegration.ts`, `AIAssistantChat.tsx`

- Sửa toàn bộ các vị trí AI tạo Lô tự động từ `BATCH_STATUS.TESTING` sang `BATCH_STATUS.PENDING`.
- Cấm AI trực tiếp gọi `store.updateBatchStatus()`; chuyển thành Proposal Only yêu cầu Người dùng có thẩm quyền phê duyệt trực tiếp.

### 2.8. `database.rules.json` & `src/services/securityRulesValidator.ts`

- Tách biệt Batch Data Mutation và Batch Workflow Mutation.
- Chặn đứng 100% các kịch bản bypass: `PENDING -> RELEASED`, `TESTING -> PENDING`, `RELEASED -> TESTING/PENDING/REJECTED`, `REJECTED -> TESTING/RELEASED`.
- Bắt buộc Lô mới tạo phải có `status === 'PENDING'`.

---

## 3. KẾT QUẢ KIỂM THỬ VÀ NGHIỆM THU

- **Static Architecture Guards**: 7/7 tests passed (`src/architecture/workflowMutationGuard.test.ts`).
- **Workflow Regression Tests**: 20/20 tests passed (`tests/domain/workflowRegression.test.ts`).
- **Batch Workflow Tests**: 12/12 tests passed (`tests/domain/batchWorkflowRegression.test.ts`).
- **TestResult Workflow Tests**: 8/8 tests passed (`tests/domain/testResultWorkflowRegression.test.ts`).
- **Security Bypass Tests**: 18/18 tests passed (`tests/security/workflowBypass.test.ts`).
- **TypeScript Typecheck**: 0 errors (`npx tsc --noEmit`).
