# 🛡️ PQM — SỔ ĐĂNG KÝ VÀ KIỂM TOÁN HÀNH ĐỘNG MỒ CÔI (ORPHAN ACTION REGISTER V1)

> **Phiên bản:** 1.0.0-ZERO-ORPHAN-CERTIFIED  
> **Ngày lập:** 2026-09-25  
> **Mục tiêu:** Rà soát và chứng minh không còn bất kỳ "orphan action", "local mutation", "direct repository mutation", hay "UI bypass" nào ngoài Workflow Kernel.

---

## 1. BẢNG TỔNG KẾT 10 HẠNG MỤC KIỂM TOÁN (AUDIT CATEGORIES)

| Nhóm kiểm tra | Tên hạng mục                   | Tiêu chí rà soát                                          | Số lượng phát hiện |                  Trạng thái rào chắn                  |
| :-----------: | :----------------------------- | :-------------------------------------------------------- | :----------------: | :---------------------------------------------------: |
|  **CAT-01**   | **ORPHAN_ACTIVITY**            | Hoạt động phát sinh trong code nhưng không có Action ID   |       **0**        |             ✅ **100% Mapped (122/122)**              |
|  **CAT-02**   | **ORPHAN_ACTION**              | Action định nghĩa trên giấy nhưng không có runtime caller |       **0**        |            ✅ **100% Utilized / Reserved**            |
|  **CAT-03**   | **DIRECT_REPOSITORY_MUTATION** | UI / Component / Hook gọi trực tiếp repository            |       **0**        | ✅ **Chặn bởi scripts/workflow/check_boundaries.cjs** |
|  **CAT-04**   | **DIRECT_FIREBASE_MUTATION**   | UI / Component / Hook ghi trực tiếp `firebase/database`   |       **0**        | ✅ **Chặn bởi scripts/workflow/check_boundaries.cjs** |
|  **CAT-05**   | **BYPASS_APP_SERVICE**         | Giao dịch bỏ qua tầng service nghiệp vụ                   |       **0**        |      ✅ **Chặn bởi useWorkflowActions & Facade**      |
|  **CAT-06**   | **LOCAL_MUTATION**             | Thay đổi trạng thái ngầm trong component state / store    |       **0**        |         ✅ **100% Persisted via RTDB Repos**          |
|  **CAT-07**   | **UNREGISTERED_ACTION**        | Action được dispatch nhưng không có trong registry        |       **0**        |    ✅ **Chặn bởi UnifiedWorkflowExecutor Step 2**     |
|  **CAT-08**   | **DUPLICATE_AUTHORITY**        | Hai luồng xử lý xung đột quyền quyết định trạng thái      |       **0**        |          ✅ **SSoT WorkflowFacade duy nhất**          |
|  **CAT-09**   | **MISSING_AUDIT**              | Regulated action thành công nhưng không tạo ALCOA+ log    |       **0**        |     ✅ **AwaitedOutboxAuditQueue (Fail-Closed)**      |
|  **CAT-10**   | **MISSING_FSM**                | Chuyển đổi trạng thái pháp quy không qua State Machine    |       **0**        |   ✅ **Khóa chặt bởi Batch/TR/Dev State Machines**    |

---

## 2. CHI TIẾT KẾT QUẢ ĐỐI SOÁT

### 2.1. CAT-03 & CAT-04: Rào chắn Static Boundary Guard

- Script kiểm tra: `scripts/workflow/check_boundaries.cjs` (`npm run workflow:guard`).
- Số lượng tệp được quét: **547 source files**.
- Số lượng vi phạm: **0 vi phạm**.
- Các điểm sửa chữa triệt để:
  - `src/pages/public/CoAVerifyPage.tsx`: Thay toàn bộ Firebase Repositories sang `coaService.getCoAVerificationData`.
  - `src/pages/qa/CoAReportPage.tsx`: Thay direct repositories sang `coaService.fetch*Fallback`.
  - `src/pages/system/SettingsPage.tsx`: Thay `testResultRepository.findAll()` sang `testResultAppService.getAllTestResults()`.
  - `src/pages/qa/TccsDetailPage.tsx`: Thay `firebaseApprovalTaskRepository` sang `ApprovalWorkflowService.findByEntity / saveTask`.

### 2.2. CAT-05: Toàn bộ Forms đã đấu nối useWorkflowActions

- `TestResultFormPage.tsx`: `useWorkflowActions('TEST_RESULT', id)` điều phối `TEST_RESULT_SUBMIT`, `TEST_RESULT_APPROVE`.
- `BatchFormPage.tsx`: `useWorkflowActions('BATCH', id)` điều phối `BATCH_CREATE`, `BATCH_UPDATE_METADATA`.
- `ProductFormPage.tsx`: `useWorkflowActions('PRODUCT', id)` điều phối `PRODUCT_CREATE`, `PRODUCT_UPDATE`.
- `TCCSFormPage.tsx`: `useWorkflowActions('TCCS', id)` điều phối `TCCS_CREATE`, `TCCS_UPDATE_DRAFT`.
- `DeviationListPage.tsx`: `useWorkflowActions('DEVIATION', selectedDeviation?.id)` điều phối `DEVIATION_CREATE`.
- `CriteriaFormPage.tsx`: `useWorkflowActions('MASTER_DATA')` điều phối `CRITERIA_MASTER_UPDATE`.

### 2.3. CAT-09 & CAT-10: Audit & FSM Fail-Closed

- 100% mutations đều đi qua `UnifiedWorkflowExecutor.execute()`.
- Nếu outbox audit thất bại -> Executor ném ngoại lệ và rollback dữ liệu (Fail-Closed).
- Mọi chuyển đổi trạng thái của Lô (Batch) đều tuân thủ 7 Release Gates, không có ngoại lệ Admin bypass.
