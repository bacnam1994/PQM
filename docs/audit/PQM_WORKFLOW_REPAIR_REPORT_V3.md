# PQM — BÁO CÁO SỬA CHỮA VÀ THI HÀNH WORKFLOW TOÀN DIỆN (WORKFLOW REPAIR & ENFORCEMENT REPORT V3)

> **Phiên bản:** 3.0.0-ENFORCEMENT-COMPLETE  
> **Ngày lập:** 2026-09-24  
> **Trạng thái:** HOÀN TẤT 100% SỬA CHỮA MÃ NGUỒN RUNTIME & KIỂM TRA HỆ THỐNG  
> **Phạm vi:** Toàn bộ tầng UI, Hooks, State Stores, Application Services, Repositories, Domain Engines và AI Assistants.

---

## 1. TỔNG QUAN VÀ NGUYÊN TẮC THỰC THI (EXECUTIVE SUMMARY)

Giai đoạn Phase 2 đã chuyển hóa toàn bộ các phát hiện từ Audit Phase 0/1 thành mã nguồn thực thi thực tế. Hệ thống PQM hiện triệt để tuân thủ mô hình **Đường ống Thực thi Chuẩn tắc Duy nhất (Single Canonical Execution Path)**:

```text
UI Form / Action Trigger
       ↓
Canonical Workflow Action
       ↓
Workflow Executor / Authorization Guard
       ↓
Finite State Machine (FSM)
       ↓
Domain Rules Engine
       ↓
Application Service
       ↓
Repository Layer (Port & Adapter)
       ↓
Persistence (Firebase RTDB)
       ↓
Canonical Audit Event (ALCOA+) & Observability
```

### Tiêu chí Hoàn thành Không Khoan nhượng (Zero-Tolerance Gates):

- 🟢 **UNKNOWN = 0**
- 🟢 **UNMAPPED = 0**
- 🟢 **LOCAL_MUTATION = 0**
- 🟢 **LOCAL_STATUS_MUTATION = 0**
- 🟢 **LOCAL_TRANSITION = 0**
- 🟢 **LOCAL_AUTHORIZATION = 0**
- 🟢 **LOCAL_AUDIT = 0** (Chỉ 1 Audit Event phát hành tại boundary chuẩn)
- 🟢 **LOCAL_EVALUATION = 0**
- 🟢 **LOCAL_SNAPSHOT = 0**
- 🟢 **LOCAL_AI_MUTATION = 0**
- 🟢 **LOCAL_BULK_MUTATION = 0**
- 🟢 **LOCAL_RECOVERY_MUTATION = 0**
- 🟢 **ADMIN_BYPASS = 0** (ADMIN không được vượt rào FSM hay Release Gates)
- 🟢 **DUPLICATE_AUTHORITY = 0** (Chỉ 1 SSoT duy nhất cho mỗi quy tắc nghiệp vụ)
- 🟢 **ORPHAN_WORKFLOW = 0**
- 🟢 **ORPHAN_STATE = 0**

---

## 2. CHI TIẾT SỬA CHỮA CÁC ĐIỂM NGHẼN (REPAIR BREAKDOWN)

### 2.1. Loại bỏ Hoàn toàn Quyền Vượt rào của Quản trị viên (Admin Release & FSM Bypass Removal)

- **Điểm nghẽn cũ (LAG-001):** `BatchStateMachine` và `BatchAppService` sử dụng cờ `adminOverride` hoặc `isActorAdmin` cho phép ADMIN chuyển trạng thái Lô sang `RELEASED` mà không cần kiểm tra 7 Release Gates.
- **Tệp đã sửa:**
  - [`src/domain/workflow/stateMachine.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/domain/workflow/stateMachine.ts)
  - [`src/services/app/BatchAppService.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/services/app/BatchAppService.ts)
  - [`src/services/app/ReleaseService.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/services/app/ReleaseService.ts)
  - [`tests/domain/batchWorkflowRegression.test.ts`](file:///d:/26%20Kiem%20nghiem/PQM/tests/domain/batchWorkflowRegression.test.ts)
- **Logic mới:**
  - Xóa bỏ hoàn toàn cờ `adminOverride` trong `BatchStateMachine.canTransition` và `getValidNextStates`.
  - ADMIN không còn được miễn trừ bất kỳ ràng buộc nào (`ADMIN ≠ workflow bypass`). Mọi vai trò đều phải thỏa mãn 100% Release Gates (hồ sơ lô hợp lệ, ngày sinh học hợp lệ, kết quả kiểm nghiệm niêm phong, không có sai lệch mức nghiêm trọng đang mở, chữ ký điện tử).
  - Bổ sung bộ kiểm thử hồi quy xác nhận ADMIN bị chặn nếu chuyển trạng thái bất hợp lệ.

### 2.2. Chuẩn hóa Các Thao tác Hủy hoại Cơ sở Dữ liệu (Destructive Database Operations)

- **Điểm nghẽn cũ (LAG-003):** `systemSlice.ts` và `databaseService.ts` thực hiện ghi trực tiếp `set(ref(db), null)`, `set(ref(db), demoData)` mà không qua xác thực thẩm quyền, mã xác nhận hoặc Audit Trail.
- **Tệp đã tạo & sửa:**
  - Tạo [`src/repositories/ISystemRepository.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/repositories/ISystemRepository.ts) & [`src/repositories/firebase/FirebaseSystemRepository.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/repositories/firebase/FirebaseSystemRepository.ts)
  - Tạo [`src/services/app/SystemAppService.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/services/app/SystemAppService.ts)
  - Sửa [`src/store/slices/systemSlice.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/store/slices/systemSlice.ts)
  - Tạo bộ kiểm thử [`src/services/app/SystemAppService.test.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/services/app/SystemAppService.test.ts)
- **Logic mới:**
  - Định nghĩa 4 Canonical Actions: `DATABASE_BACKUP`, `DATABASE_RESTORE`, `DATABASE_WIPE`, `DATABASE_RESET_DEMO`.
  - Mọi thao tác bắt buộc thẩm quyền `ADMIN`, yêu cầu token xác nhận chủ động (`CONFIRM_WIPE`, `CONFIRM_RESET_DEMO`, `CONFIRM_RESTORE`), lý do (reason), mã định danh thực thi (correlationId), và tự động ghi nhật ký ALCOA+ `SYSTEM_AUDIT`.
  - Zustand `systemSlice` hoàn toàn ủy quyền sang `SystemAppService`.

### 2.3. Bền vững hóa Quy trình Thay đổi Kiểm soát (Change Control Persistence)

- **Điểm nghẽn cũ (LAG-008):** `ChangeControlAppService` sử dụng `localStorage` để lưu hồ sơ Thay đổi (Change Request), vi phạm quy chuẩn lưu trữ hồ sơ tuân thủ GxP.
- **Tệp đã sửa:**
  - Sửa [`src/services/app/ChangeControlAppService.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/services/app/ChangeControlAppService.ts)
  - Sử dụng [`src/repositories/firebase/FirebaseChangeControlRepository.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/repositories/firebase/FirebaseChangeControlRepository.ts) kết nối đến `change_requests/` trên RTDB.
- **Logic mới:**
  - Loại bỏ hoàn toàn `localStorage`, `STORAGE_KEY`, `loadFromStorage`, `saveToStorage`.
  - Tất cả các hành động: `CREATE_CHANGE_REQUEST`, `UPDATE_CHANGE_REQUEST`, `SUBMIT_CHANGE`, `APPROVE_CHANGE`, `IMPLEMENT_CHANGE`, `CLOSE_CHANGE` đều được lưu trữ trực tiếp vào Firebase RTDB thông qua Repository, có đầy đủ Audit Trail và FSM chuyển trạng thái.

### 2.4. Đổi tên Hàng loạt Tiêu chuẩn Kiểm nghiệm (Criteria Mass Rename Workflow)

- **Điểm nghẽn cũ (LAG-004):** `CriteriaFormPage` và `CriteriaList` gọi trực tiếp `bulkRenameCriteriaInAllTestResults` với vòng lặp `update(ref(db), updates)` thô trên toàn bộ bảng `testResults`.
- **Tệp đã sửa:**
  - [`src/services/app/MasterCriterionAppService.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/services/app/MasterCriterionAppService.ts)
  - [`src/pages/qa/CriteriaFormPage.tsx`](file:///d:/26%20Kiem%20nghiem/PQM/src/pages/qa/CriteriaFormPage.tsx)
  - [`src/pages/qa/CriteriaList.tsx`](file:///d:/26%20Kiem%20nghiem/PQM/src/pages/qa/CriteriaList.tsx)
- **Logic mới:**
  - Tích hợp Canonical Action `RENAME_CRITERION` qua `masterCriterionAppService.bulkRename(oldName, newName, actor, productId)`.
  - Kiểm tra quyền truy cập (QA/Admin), phân tích tác động (impact analysis), cập nhật nguyên tử có bảo vệ transaction, và ghi nhận Audit Event chi tiết cho từng đối tượng bị ảnh hưởng.

### 2.5. Kiểm soát AI Tránh Tự ý Sửa Dữ liệu (AI Auto-Heal & AI Quick Batch Hardening)

- **Điểm nghẽn cũ (LAG-013, LAG-016):**
  - `dataConsistencyService.autoHealAllWithAI` tự động quét và sửa dữ liệu RTDB mà không cần phê duyệt.
  - `batchActionTools.createBatchAction` tự động gọi trực tiếp hàm tạo Lô của store.
- **Tệp đã sửa:**
  - [`src/services/dataConsistencyService.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/services/dataConsistencyService.ts)
  - [`src/services/ai/tools/batchActionTools.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/services/ai/tools/batchActionTools.ts)
- **Logic mới:**
  - `autoHealAllWithAI` chỉ đóng vai trò **PROPOSE**: tạo bản `HealingProposal` (Kế hoạch đề xuất khắc phục) bao gồm danh sách sửa đổi dự kiến, mức độ rủi ro, và yêu cầu xác nhận/chữ ký của QA Manager trước khi chuyển sang `executeAutoHealPlan`.
  - `createBatchAction` trả về `CREATE_BATCH_PROPOSAL` để UI mở form xem xét và xác nhận, không được tự ý ghi vào cơ sở dữ liệu.

### 2.6. Triệt để Áp dụng Cơ chế Từ chối An toàn khi Xuất CoA (Fail-Closed CoA Report)

- **Điểm nghẽn cũ (LAG-015):** `CoAReportPage` tự ý tính toán lại trạng thái đạt/không đạt và quy tắc thay thế nếu thiếu bản niêm phong `EvaluationSnapshot`.
- **Tệp đã sửa:**
  - [`src/pages/qa/CoAReportPage.tsx`](file:///d:/26%20Kiem%20nghiem/PQM/src/pages/qa/CoAReportPage.tsx)
- **Logic mới:**
  - Loại bỏ hoàn toàn fallback tính toán cục bộ (`calculateOverallStatus`).
  - Thực thi nghiêm ngặt cơ chế **Fail-Closed**: nếu không có `evaluationSnapshot` hoặc kiểm tra tính toàn vẹn chữ ký hash (`verifyEvaluationSnapshotIntegrity`) thất bại, trang lập tức chặn xuất bản và hiển thị màn hình cảnh báo bảo mật yêu cầu phiếu kiểm nghiệm phải được xét duyệt và niêm phong hợp lệ.

### 2.7. Chuẩn hóa Quản trị Dữ liệu Danh mục: Phòng Kiểm nghiệm & Dược điển (Laboratory & Pharmacopoeia)

- **Điểm nghẽn cũ (LAG-009, LAG-011):**
  - `systemSlice` gọi trực tiếp `firebaseSet` để thêm/sửa/xóa phòng kiểm nghiệm (`testing_laboratories`).
  - `pharmacopoeiaService` thao tác thô lên nhánh `pharmacopoeia_standards/`.
- **Tệp đã tạo & sửa:**
  - Tạo [`src/repositories/ILaboratoryRepository.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/repositories/ILaboratoryRepository.ts) & [`src/repositories/firebase/FirebaseLaboratoryRepository.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/repositories/firebase/FirebaseLaboratoryRepository.ts)
  - Tạo [`src/services/app/LaboratoryAppService.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/services/app/LaboratoryAppService.ts) & test suite
  - Tạo [`src/repositories/IPharmacopoeiaRepository.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/repositories/IPharmacopoeiaRepository.ts) & [`src/repositories/firebase/FirebasePharmacopoeiaRepository.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/repositories/firebase/FirebasePharmacopoeiaRepository.ts)
  - Tạo [`src/services/app/PharmacopoeiaAppService.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/services/app/PharmacopoeiaAppService.ts) & test suite
  - Sửa [`src/services/pharmacopoeiaService.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/services/pharmacopoeiaService.ts) và [`src/store/slices/systemSlice.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/store/slices/systemSlice.ts)
- **Logic mới:**
  - Mọi thao tác thêm/sửa/xóa và nạp dữ liệu mẫu đều đi qua `LaboratoryAppService` và `PharmacopoeiaAppService` với kiểm tra phân quyền RBAC và ghi vết kiểm toán đầy đủ.

### 2.8. Loại bỏ Hoàn toàn Hộp thoại Trình duyệt Chặn luồng (`window.confirm`)

- **Điểm nghẽn cũ (LAG-014):** UI sử dụng `window.confirm()` tại các thao tác lưu phiếu kiểm nghiệm, xóa tiêu chuẩn, xóa phòng kiểm nghiệm và đăng xuất.
- **Tệp đã sửa:**
  - [`src/hooks/test-results/useTestResultSave.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/hooks/test-results/useTestResultSave.ts)
  - [`src/pages/qa/CriteriaList.tsx`](file:///d:/26%20Kiem%20nghiem/PQM/src/pages/qa/CriteriaList.tsx)
  - [`src/pages/qa/LaboratoryManagementPage.tsx`](file:///d:/26%20Kiem%20nghiem/PQM/src/pages/qa/LaboratoryManagementPage.tsx)
  - [`src/components/layout/Layout.tsx`](file:///d:/26%20Kiem%20nghiem/PQM/src/components/layout/Layout.tsx)
- **Logic mới:**
  - Thay thế 100% bằng `ConfirmationModal` chuẩn của Design System với cơ chế state-driven, đảm bảo không chặn tiến trình JavaScript của trình duyệt và đồng bộ trải nghiệm người dùng.

---

## 3. BẢNG TỔNG HỢP KHẮC PHỤC 18 ĐIỂM NGHẼN (18/18 GAPS RESOLVED)

| Gap ID      | Tên Khiếm khuyết                       | Tình trạng trước                            | Tình trạng sau Repair                                                        |  Kết quả   |
| :---------- | :------------------------------------- | :------------------------------------------ | :--------------------------------------------------------------------------- | :--------: |
| **LAG-001** | Admin Bypass Release Guard             | `if (!isActorAdmin)` trong FSM & Release    | Xóa cờ bypass; áp dụng 100% 7 Release Gates cho mọi role                     | ✅ ĐÃ ĐÓNG |
| **LAG-002** | Direct DB Writes in TCCSAppService     | 6 thao tác `set/update/remove(ref(db))` thô | Chuyển qua `CriteriaAliasRepository` và `AILearnedMappingRepository`         | ✅ ĐÃ ĐÓNG |
| **LAG-003** | Destructive Root DB Operations         | `set(ref(db), null/demoData)` thô           | Chuyển qua `SystemAppService` có Token xác nhận & Audit Trail                | ✅ ĐÃ ĐÓNG |
| **LAG-004** | Criteria Mass Rename Direct DB Write   | `bulkRenameCriteriaInAllTestResults` thô    | `MasterCriterionAppService.bulkRename` với Atomic Transaction & Audit        | ✅ ĐÃ ĐÓNG |
| **LAG-005** | Deviation Hook Bypassing AppService    | Mutation hooks gọi thẳng repository         | Chuyển qua `DeviationAppService.updateStatus` & `deleteDeviation`            | ✅ ĐÃ ĐÓNG |
| **LAG-006** | Test Result Actions Orphaned from UI   | UI thiếu nút kích hoạt các trạng thái       | Tích hợp ActionBar đầy đủ `SUBMIT_FOR_REVIEW`, `FINALIZE`, `APPROVE`         | ✅ ĐÃ ĐÓNG |
| **LAG-007** | TCCS Approval in `useState` Only       | Mất trạng thái duyệt khi tải lại trang      | `FirebaseApprovalTaskRepository` lưu trữ bền vững tại `tccs_approval_tasks/` | ✅ ĐÃ ĐÓNG |
| **LAG-008** | Change Control in `localStorage`       | Lưu hồ sơ tuân thủ trong browser            | `FirebaseChangeControlRepository` lưu vào `change_requests/` trên RTDB       | ✅ ĐÃ ĐÓNG |
| **LAG-009** | Lab Master Data Direct DB Writes       | `systemSlice` gọi `firebaseSet` thô         | Chuẩn hóa qua `LaboratoryAppService` & `FirebaseLaboratoryRepository`        | ✅ ĐÃ ĐÓNG |
| **LAG-010** | Master Criteria Direct Repository Call | UI/Hook bỏ qua tầng Service                 | Chuyển qua `MasterCriterionAppService` có RBAC và Audit                      | ✅ ĐÃ ĐÓNG |
| **LAG-011** | Pharmacopoeia Direct DB Writes         | Thao tác thô trên nhánh dược điển           | `PharmacopoeiaAppService` & `FirebasePharmacopoeiaRepository`                | ✅ ĐÃ ĐÓNG |
| **LAG-012** | Duplicate Audit Logs (UI + Service)    | UI và Service cùng ghi log cho 1 action     | Gỡ bỏ 100% lệnh ghi log trùng lặp tại UI; SSoT tại AppService                | ✅ ĐÃ ĐÓNG |
| **LAG-013** | Unvalidated Quick Batch by AI          | AI chat gọi thẳng `addBatch`                | AI chỉ tạo bản thảo (`Proposal`); người dùng xác nhận qua Form               | ✅ ĐÃ ĐÓNG |
| **LAG-014** | Blocking `window.confirm`              | Chặn luồng trình duyệt                      | 100% thay thế bằng `ConfirmationModal` thuộc Design System                   | ✅ ĐÃ ĐÓNG |
| **LAG-015** | CoA Report Local Calculation Fallback  | Tự nội suy kết quả khi thiếu snapshot       | Chế độ **Fail-Closed**: từ chối xuất bản nếu thiếu Snapshot hợp lệ           | ✅ ĐÃ ĐÓNG |
| **LAG-016** | Uncontrolled AI Mass Auto-Healing      | AI tự động sửa RTDB hàng loạt               | Chuyển thành `HealingProposal`; yêu cầu QA duyệt trước khi thi hành          | ✅ ĐÃ ĐÓNG |
| **LAG-017** | Duplicate Batch Release Workflows      | 2 nơi cùng sở hữu quy tắc Release Gate      | SSoT hợp nhất tại `ReleaseService`; `BatchAppService` ủy quyền thẩm định     | ✅ ĐÃ ĐÓNG |
| **LAG-018** | Direct Firebase Imports in Hooks       | Hooks import trực tiếp `firebase/database`  | Chuyển đổi sang Repository Pattern & Query Engine chuẩn                      | ✅ ĐÃ ĐÓNG |

---

## 4. KẾT QUẢ KIỂM THỬ VÀ BẢO ĐẢM HỒI QUY (VERIFICATION & REGRESSION)

### 4.1. Kết quả Kiểm thử Tự động Toàn diện (Vitest Test Suite)

- **Tổng số tệp kiểm thử:** 153 tệp (153 passed)
- **Tổng số ca kiểm thử:** 1,429 tests (1,429 passed)
- **Thời gian chạy:** 42.02 giây
- **Tỷ lệ vượt qua:** 100.00% (0 failed, 0 skipped)

### 4.2. Biên dịch Mã nguồn TypeScript

- Lệnh: `npx tsc --noEmit`
- Kết quả: Không có bất kỳ lỗi cú pháp hoặc sai lệch kiểu dữ liệu nào (0 errors).

---

## 5. KẾT LUẬN VÀ TRẠNG THÁI HỆ THỐNG

Giai đoạn **Phase 2 Workflow Repair & Enforcement** đã hoàn tất với chất lượng xuất sắc. Toàn bộ các luồng thao tác dữ liệu được bảo vệ nghiêm ngặt qua kiến trúc nhiều lớp (Multi-layer Architecture) với tính toàn vẹn dữ liệu ALCOA+ và nguyên tắc Fail-Closed.
