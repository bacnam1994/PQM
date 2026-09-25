# BẢNG ĐĂNG KÝ LỖ HỔNG & MÂU THUẪN KIẾN TRÚC PQM

## (WORKFLOW GAP & CONFLICT REGISTER)

> **Mã tài liệu**: `PQM-GAP-REG-001`  
> **Trạng thái**: ACTIVE (Baseline Audit)  
> **Ngày lập**: 22/09/2026  
> **Phạm vi đối chiếu**: [`PQM_SYSTEM_WORKFLOW_MASTER.md`](file:///D:/26%20Kiem%20nghiem/PQM/docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md) vs Thực trạng mã nguồn (`src/`)

---

## 1. TỔNG QUAN PHÂN LOẠI & TRẠNG THÁI KHOẢNG TRỐNG

| Mã Gap     | Phân loại            |   Mức độ    | Trạng thái  | Giải pháp & Bằng chứng xác minh                                                                                                                                                       |
| :--------- | :------------------- | :---------: | :---------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **GAP-01** | `IMPLEMENTED_WRONG`  | 🔴 CRITICAL | ✅ RESOLVED | Chuẩn hóa `Criterion.id` & `AlternateRule` tham chiếu qua ID (`ADR-001`).                                                                                                             |
| **GAP-02** | `CONFLICT`           | 🔴 CRITICAL | ✅ RESOLVED | `CoAReport` đọc trực tiếp từ `EvaluationSnapshot` bất biến đã khóa, cấm tự động nội suy.                                                                                              |
| **GAP-03** | `MISSING`            |   🔴 HIGH   | ✅ RESOLVED | `CriterionStateEngine` quản lý tiền định trạng thái chỉ tiêu (`SC-012_PKN_EDITOR_CONTRACT.md`).                                                                                       |
| **GAP-04** | `AMBIGUOUS`          |   🔴 HIGH   | ✅ RESOLVED | Cấu trúc điều kiện AST/JSON Schema cho `AlternateRule` (`ADR-001`).                                                                                                                   |
| **GAP-05** | `MISSING`            |   🔴 HIGH   | ✅ RESOLVED | Ban hành [`SC-012_PKN_EDITOR_CONTRACT.md`](./SC-012_PKN_EDITOR_CONTRACT.md) quy định rõ hành vi UI cho PKN Editor.                                                                    |
| **GAP-06** | `CONFLICT`           |  🟡 MEDIUM  | ✅ RESOLVED | Frozen Spec & Snapshotting gắn chặt Lô với `tccsSnapshotId` bất biến.                                                                                                                 |
| **GAP-07** | `CONFLICT`           |  🟡 MEDIUM  | ✅ RESOLVED | Quy tắc RTDB [`database.rules.json`](../../database.rules.json) chặn cứng `RELEASED` nếu `qualityStatus !== 'PASS'`; xác minh bởi 26/26 tests trong `securityRulesValidator.test.ts`. |
| **GAP-08** | `CONFLICT`           | 🔴 CRITICAL | ✅ RESOLVED | Loại bỏ 100% ghost roles trong Action Catalog, quy chuẩn theo 8 Canonical Roles (`ADR-001`, `workflowActionCatalog.ts`).                                                              |
| **GAP-09** | `ARCHITECTURAL_DEBT` | 🔴 CRITICAL | ✅ RESOLVED | Chuyển đổi 100% Mutation qua `WorkflowFacade.dispatch()` xuyên suốt Phase 1 - Phase 4.                                                                                                |
| **GAP-10** | `MISSING`            |  🟡 MEDIUM  | ✅ RESOLVED | Bổ sung Typed Confirmation Tokens (`CONFIRM_WIPE`, `CONFIRM_RESTORE`, `CONFIRM_RESET_DEMO`) trong `SystemAppService` và Action Guards.                                                |
| **GAP-11** | `IMPLEMENTED_WRONG`  |  🟡 MEDIUM  | ✅ RESOLVED | 100% AI tools bọc trong Proposal Envelope (`AIActionProposal`), thực thi qua Human-in-the-Loop Workflow.                                                                              |
| **GAP-12** | `MISSING`            | 🔴 CRITICAL | ✅ RESOLVED | Triển khai Fail-Closed Awaited Outbox Audit Queue với cơ chế rollback khi audit thất bại (`WorkflowKernelPhase1`).                                                                    |

---

## 2. CHI TIẾT CÁC LỖ HỔNG & BẰNG CHỨNG GIẢI QUYẾT

### 🔴 GAP-01: Phụ thuộc vào Tên chuỗi (String Name) thay vì Criterion ID

- **Trạng thái**: ✅ **ĐÃ GIẢI QUYẾT (RESOLVED)**
- **Vị trí**: [`src/types/tccs.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/types/tccs.ts), [`src/types/testResult.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/types/testResult.ts)
- **Giải pháp**: Chuẩn hóa `Criterion.id` là khóa chính bất biến (UUID/NanoID). `AlternateRule` liên kết qua `mainCriterionId` và `altCriterionId`. `criteriaAliasService` chuyển thành adapter hỗ trợ import legacy.

---

### 🔴 GAP-02: Màn hình CoA tự động gộp và nội suy dữ liệu thay vì lấy từ EvaluationSnapshot

- **Trạng thái**: ✅ **ĐÃ GIẢI QUYẾT (RESOLVED)**
- **Vị trí**: [`src/components/features/CoAReport.tsx`](file:///D:/26%20Kiem%20nghiem/PQM/src/components/features/CoAReport.tsx)
- **Giải pháp**: CoA chỉ render trực tiếp từ `EvaluationSnapshot` đã được ký và đóng băng (Frozen). Cấm giao diện tự tính toán hoặc bù đắp chỉ tiêu ảo.

---

### 🔴 GAP-03: Thiếu State Machine tường minh ở cấp Chỉ tiêu (Criterion-Level State Machine)

- **Trạng thái**: ✅ **ĐÃ GIẢI QUYẾT (RESOLVED)**
- **Vị trí**: [`src/types/testResult.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/types/testResult.ts), [`docs/workflow/SC-012_PKN_EDITOR_CONTRACT.md`](./SC-012_PKN_EDITOR_CONTRACT.md)
- **Giải pháp**: Thiết lập máy trạng thái chỉ tiêu `CriterionStateEngine` với các trạng thái tiền định: `NORMAL`, `TRIGGERED_PENDING`, `NOT_TRIGGERED`, `MANUAL_OVERRIDE`.

---

### 🔴 GAP-04: Cấu trúc điều kiện của AlternateRule dạng chuỗi tự do (Unstructured Condition)

- **Trạng thái**: ✅ **ĐÃ GIẢI QUYẾT (RESOLVED)**
- **Vị trí**: [`src/types/tccs.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/types/tccs.ts)
- **Giải pháp**: Chuẩn hóa điều kiện dạng AST/JSON Schema có cấu trúc (`operator`, `targetValue`, `targetValueMax`).

---

### 🔴 GAP-05: Thiếu Hợp đồng Hành vi Giao diện (UI Behavior Contract) cho PKN Editor

- **Trạng thái**: ✅ **ĐÃ GIẢI QUYẾT (RESOLVED)**
- **Vị trí ban hành**: [`docs/workflow/SC-012_PKN_EDITOR_CONTRACT.md`](./SC-012_PKN_EDITOR_CONTRACT.md)
- **Giải pháp**: Ban hành hợp đồng SC-012 quy định:
  1. `NOT_TRIGGERED`: Disabled input, huy hiệu xám "Miễn kiểm", TUYỆT ĐỐI KHÔNG ẩn dòng.
  2. `TRIGGERED_PENDING`: Viền cảnh báo vàng/cam, huy hiệu "Chờ kết quả", chặn Submit PKN.
  3. Quyền chỉnh sửa theo workflow status: Chỉ cho phép nhập liệu ở `DRAFT`/`REJECTED`/`IN_PROGRESS`; `SUBMITTED`/`APPROVED` bị khóa toàn bộ.

---

### 🟡 GAP-06: TCCS Versioning & Snapshotting chưa bất biến hoàn toàn

- **Trạng thái**: ✅ **ĐÃ GIẢI QUYẾT (RESOLVED)**
- **Vị trí**: [`src/services/dataConsistencyService.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/services/dataConsistencyService.ts)
- **Giải pháp**: Lô sản xuất liên kết chặt chẽ với `tccsSnapshotId` và bản sao lưu spec bất biến tại thời điểm sản xuất.

---

### 🟡 GAP-07: Quy trình Release Gate chưa có rào chắn chặn cứng tại Firebase Rules

- **Trạng thái**: ✅ **ĐÃ GIẢI QUYẾT (RESOLVED)**
- **Vị trí**: [`database.rules.json`](file:///D:/26%20Kiem%20nghiem/PQM/database.rules.json), [`src/services/securityRulesValidator.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/services/securityRulesValidator.ts)
- **Giải pháp**: Cấu hình rule RTDB chặn đứng trạng thái `RELEASED` nếu `qualityStatus !== 'PASS'`, không cho phép bất kỳ vai trò nào (kể cả admin/qa_manager) bypass qua SDK:
  `newData.child('status').val() !== 'RELEASED' || newData.child('qualityStatus').val() === 'PASS' || data.child('qualityStatus').val() === 'PASS'`
  Xác minh tự động bởi 26 unit tests trong `securityRulesValidator.test.ts`.

---

### 🔴 GAP-08: Thẩm quyền trong Action Catalog chứa vai trò ma (Ghost Roles)

- **Trạng thái**: ✅ **ĐÃ GIẢI QUYẾT (RESOLVED)**
- **Vị trí**: [`src/domain/workflow/workflowActionCatalog.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/domain/workflow/workflowActionCatalog.ts), [`docs/adr/ADR-001-WORKFLOW-CANONICAL-STANDARDS.md`](../adr/ADR-001-WORKFLOW-CANONICAL-STANDARDS.md)
- **Giải pháp**: Xóa bỏ toàn bộ vai trò tự do (`manager`, `lead`, `specialist`). 100% Action Catalog chỉ sử dụng 8 Canonical Roles: `ADMIN`, `QA`, `QC`, `LAB`, `PRODUCTION`, `USER`, `VIEWER`, `GUEST`.

---

### 🔴 GAP-09: 100% Mutation vẫn chạy trực tiếp (LEGACY_DIRECT) ngoài WorkflowFacade

- **Trạng thái**: ✅ **ĐÃ GIẢI QUYẾT (RESOLVED)**
- **Vị trí**: Xuyên suốt các App Services (`TestResultAppService`, `BatchAppService`, `DeviationAppService`, `InventoryAppService`, `ProductAppService`, `MaterialAppService`, `FormulaAppService`, `TCCSAppService`, `SystemAppService`)
- **Giải pháp**: Chuyển đổi toàn bộ các mutation sang `WorkflowFacade.dispatch()` với pipeline chuẩn: Role RBAC Guard ➔ Payload Validation ➔ Transaction ➔ Outbox Audit Logging ➔ Invalidation.

---

### 🟡 GAP-10: Thiếu Typed Confirmation Token cho thao tác phá hủy (Destructive Mutations)

- **Trạng thái**: ✅ **ĐÃ GIẢI QUYẾT (RESOLVED)**
- **Vị trí**: [`SystemAppService.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/services/app/SystemAppService.ts), [`MaterialAppService.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/services/app/MaterialAppService.ts)
- **Giải pháp**: Bắt buộc Typed Confirmation Tokens (`CONFIRM_WIPE`, `CONFIRM_RESTORE`, `CONFIRM_RESET_DEMO`) kèm lý do kiểm toán ALCOA+ và kiểm tra ràng buộc công thức (Formula integrity checks).

---

### 🟡 GAP-11: AI Tools chưa được bọc Proposal Envelope chuẩn

- **Trạng thái**: ✅ **ĐÃ GIẢI QUYẾT (RESOLVED)**
- **Vị trí**: [`src/services/ai/tools/`](file:///D:/26%20Kiem%20nghiem/PQM/src/services/ai/tools/)
- **Giải pháp**: Tách bạch 100% AI tools sang mô hình Advisory / Proposal Envelope (`AIActionProposal`), chỉ người có thẩm quyền mới được duyệt để dispatch action vào hệ thống.

---

### 🔴 GAP-12: Thiếu Outbox Pattern cho Audit Trail (Nguy cơ ALCOA+ Audit Loss)

- **Trạng thái**: ✅ **ĐÃ GIẢI QUYẾT (RESOLVED)**
- **Vị trí**: [`src/domain/workflow/UnifiedWorkflowExecutor.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/domain/workflow/UnifiedWorkflowExecutor.ts), [`src/workflow/core/AwaitedOutboxAuditQueue.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/workflow/core/AwaitedOutboxAuditQueue.ts)
- **Giải pháp**: Triển khai cơ chế Fail-Closed Awaited Outbox Audit: Nếu ghi nhật ký kiểm toán thất bại sau số lần retry, giao dịch nghiệp vụ sẽ bị hủy bỏ (rollback) để đảm bảo toàn vẹn dữ liệu ALCOA+.

---

## 3. BẢNG TỔNG KẾT ĐÁNH GIÁ CHU KỲ HOÀN THIỆN (PHASE 5 CERTIFICATION)

| Chỉ số                                                  |       Kết quả thực tế       |  Mục tiêu Gate   |  Trạng thái   |
| :------------------------------------------------------ | :-------------------------: | :--------------: | :-----------: |
| **Tổng số Activities đã quét & phân loại**              |           **122**           | Toàn bộ codebase | ✅ ĐẠT (PASS) |
| **Hoạt động chưa phân loại (UNMAPPED)**                 |            **0**            |      **0**       | ✅ ĐẠT (PASS) |
| **Hoạt động mồ côi (ORPHAN)**                           |            **0**            |      **0**       | ✅ ĐẠT (PASS) |
| **Tỷ lệ phân loại chuẩn hóa**                           |          **100%**           |     **100%**     | ✅ ĐẠT (PASS) |
| **Số Action IDs Canonical đã định nghĩa**               |           **92**            |  Đủ 100% domain  | ✅ ĐẠT (PASS) |
| **Khoảng trống kiến trúc (Gap Register)**               |   **12/12 Gaps RESOLVED**   |  100% đóng kín   | ✅ HOÀN THÀNH |
| **Số lượng Unit/Integration Tests**                     | **1,508 tests (159 files)** |    100% Pass     | ✅ ĐẠT (PASS) |
| **Kiểm tra kiểu TypeScript (`tsc --noEmit`)**           |        **0 Errors**         |      0 lỗi       | ✅ ĐẠT (PASS) |
| **Sinh tài liệu ma trận tự động (`workflow:generate`)** |   **3 Matrices Đồng bộ**    |   Tự động hóa    | ✅ ĐẠT (PASS) |
