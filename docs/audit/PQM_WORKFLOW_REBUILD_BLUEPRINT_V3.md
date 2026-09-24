# PQM — BẢN THIẾT KẾ TÁI CẤU TRÚC WORKFLOW THỐNG NHẤT (UNIFIED WORKFLOW REBUILD BLUEPRINT V3)

> **Phiên bản:** 3.0.0-REBUILD-BLUEPRINT  
> **Ngày lập:** 2026-09-24  
> **Mục tiêu:** Xóa bỏ triệt để 100% các hoạt động cục bộ ngoài quy trình; thống nhất mọi User Action và Mutation đi qua một Kiến trúc Quy trình Thống nhất (Unified Workflow Architecture).

---

## 1. MÔ HÌNH KIẾN TRÚC MỤC TIÊU (TARGET ARCHITECTURE)

```text
                                PQM APPLICATION
                                       │
                                       ▼
                             USER / SYSTEM ACTION
                                       │
                                       ▼
                              CANONICAL USE CASE
                                       │
                                       ▼
                          UNIFIED WORKFLOW EXECUTOR
                      executeWorkflowAction(envelope)
                                       │
             ┌─────────────────────────┼─────────────────────────┐
             ▼                         ▼                         ▼
       AUTHORIZATION             STATE MACHINE             BUSINESS RULE
       (RBAC / Perms)            (FSM Validation)          (GMP Invariants)
             │                         │                         │
             └─────────────────────────┼─────────────────────────┘
                                       ▼
                                 DOMAIN ENGINE
                       (Quality / Evaluation / Snapshot)
                                       │
                                       ▼
                           ATOMIC APPLICATION SERVICE
                         (Entity Orchestration / OCC)
                                       │
                                       ▼
                                   REPOSITORY
                         (Data Access / Query Policy)
                                       │
                                       ▼
                                    DATABASE
                            (Firebase RTDB / Storage)
                                       │
                         ┌─────────────┴─────────────┐
                         ▼                           ▼
                       AUDIT                   OBSERVABILITY
                 (ALCOA+ Trail)           (Metrics / Traceability)
```

---

## 2. CANONICAL WORKFLOW ACTION CATALOG (DANH MỤC HÀNH ĐỘNG CHUẨN HÓA)

Hệ thống quy tụ mọi hành động thay đổi dữ liệu có kiểm soát (Regulated Mutations) vào một Enum hành động chuẩn hóa `WorkflowAction`:

```typescript
export const WORKFLOW_ACTIONS = {
  // --- BATCH WORKFLOW ACTIONS ---
  BATCH_CREATE: 'BATCH_CREATE',
  BATCH_UPDATE: 'BATCH_UPDATE',
  BATCH_START_TESTING: 'BATCH_START_TESTING',
  BATCH_RELEASE: 'BATCH_RELEASE',
  BATCH_REJECT: 'BATCH_REJECT',
  BATCH_BLOCK: 'BATCH_BLOCK',
  BATCH_REOPEN: 'BATCH_REOPEN',
  BATCH_DELETE: 'BATCH_DELETE',

  // --- TEST RESULT WORKFLOW ACTIONS ---
  TEST_RESULT_CREATE: 'TEST_RESULT_CREATE',
  TEST_RESULT_UPDATE: 'TEST_RESULT_UPDATE',
  TEST_RESULT_SUBMIT_FOR_REVIEW: 'TEST_RESULT_SUBMIT_FOR_REVIEW',
  TEST_RESULT_REVISE_DRAFT: 'TEST_RESULT_REVISE_DRAFT',
  TEST_RESULT_FINALIZE: 'TEST_RESULT_FINALIZE',
  TEST_RESULT_APPROVE: 'TEST_RESULT_APPROVE',
  TEST_RESULT_SUPERSEDE: 'TEST_RESULT_SUPERSEDE',
  TEST_RESULT_DELETE: 'TEST_RESULT_DELETE',

  // --- TCCS WORKFLOW ACTIONS ---
  TCCS_CREATE: 'TCCS_CREATE',
  TCCS_UPDATE: 'TCCS_UPDATE',
  TCCS_SUBMIT_FOR_REVIEW: 'TCCS_SUBMIT_FOR_REVIEW',
  TCCS_APPROVE: 'TCCS_APPROVE',
  TCCS_ACTIVATE: 'TCCS_ACTIVATE',
  TCCS_ARCHIVE: 'TCCS_ARCHIVE',
  TCCS_DELETE: 'TCCS_DELETE',

  // --- PRODUCT & FORMULA & MATERIAL ---
  PRODUCT_CREATE: 'PRODUCT_CREATE',
  PRODUCT_UPDATE: 'PRODUCT_UPDATE',
  PRODUCT_DELETE: 'PRODUCT_DELETE',
  PRODUCT_BULK_IMPORT: 'PRODUCT_BULK_IMPORT',
  FORMULA_CREATE: 'FORMULA_CREATE',
  FORMULA_UPDATE: 'FORMULA_UPDATE',
  FORMULA_DELETE: 'FORMULA_DELETE',
  MATERIAL_CREATE: 'MATERIAL_CREATE',
  MATERIAL_UPDATE: 'MATERIAL_UPDATE',
  MATERIAL_DELETE: 'MATERIAL_DELETE',

  // --- COMPLIANCE (DEVIATION / CAPA / OOS / CHANGE CONTROL) ---
  DEVIATION_CREATE: 'DEVIATION_CREATE',
  DEVIATION_TRANSITION: 'DEVIATION_TRANSITION',
  DEVIATION_DELETE: 'DEVIATION_DELETE',
  CAPA_ACTION_CREATE: 'CAPA_ACTION_CREATE',
  CAPA_ACTION_COMPLETE: 'CAPA_ACTION_COMPLETE',
  CAPA_VERIFY_AND_CLOSE: 'CAPA_VERIFY_AND_CLOSE',
  OOS_INVESTIGATION_START: 'OOS_INVESTIGATION_START',
  OOS_PHASE_1_SUBMIT: 'OOS_PHASE_1_SUBMIT',
  OOS_PHASE_2_CONCLUDE: 'OOS_PHASE_2_CONCLUDE',
  CHANGE_REQUEST_CREATE: 'CHANGE_REQUEST_CREATE',
  CHANGE_REQUEST_TRANSITION: 'CHANGE_REQUEST_TRANSITION',
  CHANGE_ACTION_ADD: 'CHANGE_ACTION_ADD',
  CHANGE_ACTION_COMPLETE: 'CHANGE_ACTION_COMPLETE',

  // --- MASTER DATA & CRITERIA ---
  MASTER_CRITERION_CREATE: 'MASTER_CRITERION_CREATE',
  MASTER_CRITERION_UPDATE: 'MASTER_CRITERION_UPDATE',
  MASTER_CRITERION_DELETE: 'MASTER_CRITERION_DELETE',
  MASTER_CRITERION_RENAME: 'MASTER_CRITERION_RENAME',
  CRITERIA_ALIAS_CREATE: 'CRITERIA_ALIAS_CREATE',
  CRITERIA_ALIAS_CONFIRM: 'CRITERIA_ALIAS_CONFIRM',
  CRITERIA_ALIAS_DELETE: 'CRITERIA_ALIAS_DELETE',
  LABORATORY_CREATE: 'LABORATORY_CREATE',
  LABORATORY_UPDATE: 'LABORATORY_UPDATE',
  LABORATORY_DELETE: 'LABORATORY_DELETE',
  PHARMACOPOEIA_SAVE: 'PHARMACOPOEIA_SAVE',
  PHARMACOPOEIA_DELETE: 'PHARMACOPOEIA_DELETE',

  // --- SYSTEM & MAINTENANCE ---
  SYSTEM_AUTO_HEAL_EXECUTE: 'SYSTEM_AUTO_HEAL_EXECUTE',
  SYSTEM_DATABASE_RESTORE: 'SYSTEM_DATABASE_RESTORE',
  USER_ROLE_CHANGE: 'USER_ROLE_CHANGE',
  USER_DELETE: 'USER_DELETE',
} as const;

export type WorkflowActionType = (typeof WORKFLOW_ACTIONS)[keyof typeof WORKFLOW_ACTIONS];
```

---

## 3. KHẾ ƯỚC THỰC THI QUY TRÌNH THỐNG NHẤT (UNIFIED WORKFLOW EXECUTION CONTRACT)

Mọi thao tác thay đổi dữ liệu có kiểm soát phải đóng gói trong `WorkflowActionEnvelope`:

```typescript
export interface WorkflowActionEnvelope<T = any> {
  action: WorkflowActionType;
  entityType:
    | 'BATCH'
    | 'TEST_RESULT'
    | 'TCCS'
    | 'PRODUCT'
    | 'FORMULA'
    | 'MATERIAL'
    | 'DEVIATION'
    | 'CHANGE_REQUEST'
    | 'MASTER_DATA'
    | 'SYSTEM'
    | 'USER';
  entityId: string;
  actor: {
    uid: string;
    email: string;
    role: Role;
    isAdmin?: boolean;
  };
  payload: T;
  reason?: string;
  signature?: ElectronicSignature;
  expectedVersion?: number;
  correlationId?: string;
}

export interface WorkflowExecutionResult<R = any> {
  success: boolean;
  action: WorkflowActionType;
  entityId: string;
  fromState?: string;
  toState?: string;
  data?: R;
  auditLogId?: string;
  error?: string;
  timestamp: string;
  durationMs: number;
}
```

### Đường ống thực thi chuẩn 12 bước của `UnifiedWorkflowExecutor`:

1. **Resolve Actor**: Xác thực danh tính và quyền hạn người thực hiện (`actor.role`, `actor.uid`).
2. **Resolve Entity & Fresh DB Read**: Đọc bản ghi mới nhất từ CSDL authoritative (Fail-Closed).
3. **Optimistic Concurrency Control (OCC)**: So khớp `expectedVersion === current.version`.
4. **Authorization Guard**: Thẩm định quyền theo ma trận RBAC (`can(actor, action, entity)`).
5. **State Machine Transition Check**: Kiểm tra bước chuyển hợp lệ từ `current.status` sang `target.status`.
6. **Business Rules & Gates Verification**:
   - Nếu là `BATCH_RELEASE`: Kiểm tra bắt buộc 7 Release Gates (áp dụng bình đẳng cho mọi vai trò, **KHÔNG CÓ ADMIN BYPASS**).
   - Nếu là `TEST_RESULT_APPROVE`: Kiểm tra bắt buộc không còn chỉ tiêu `PENDING` và chữ ký số hợp lệ.
   - Nếu là `DEVIATION_CLOSE`: Kiểm tra mọi hành động CAPA đã hoàn tất.
7. **Domain Engine Processing**: Tính toán trạng thái tất định hoặc băm snapshot SHA-256 niêm phong.
8. **Atomic Multi-Path Persistence**: Thực thi ghi dữ liệu nguyên tử thông qua Repository chính thức.
9. **Single Source of Truth Audit Logging**: Tự động phát hành bản ghi Audit Trail ALCOA+ bất biến.
10. **Cache Invalidation & Delta Sync**: Làm mới TanStack Query Cache thông qua Query Keys chuẩn hóa.
11. **Telemetry & Execution Log**: Ghi nhận thời gian xử lý và mã tương quan `correlationId`.
12. **Return Canonical Result**: Trả về `WorkflowExecutionResult` có cấu trúc rõ ràng.

---

## 4. KẾ HOẠCH TÁI CẤU TRÚC THEO TỆP TIN (FILE REBUILD PLAN)

| Thao tác      | Tệp tin (File Path)                                                             | Rationale & Kế hoạch chi tiết                                                                                   |
| :------------ | :------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------- |
| **CREATE**    | `src/domain/workflow/UnifiedWorkflowExecutor.ts`                                | Bộ máy điều phối tập trung thực thi 12 bước cho toàn bộ 42 Workflow Actions                                     |
| **CREATE**    | `src/domain/workflow/workflowActionCatalog.ts`                                  | Khế ước hành động chuẩn hóa toàn diện cho tất cả các phân hệ                                                    |
| **CREATE**    | `src/repositories/IChangeControlRepository.ts`                                  | Interface Repository cho Change Control chuẩn GMP                                                               |
| **CREATE**    | `src/repositories/firebase/FirebaseChangeControlRepository.ts`                  | Triển khai lưu trữ Change Control trên Firebase RTDB (`change_requests/`), thay thế LocalStorage                |
| **CREATE**    | `src/repositories/IApprovalTaskRepository.ts`                                   | Interface lưu trữ nhiệm vụ xét duyệt nhiều cấp độ                                                               |
| **CREATE**    | `src/repositories/firebase/FirebaseApprovalTaskRepository.ts`                   | Lưu trữ bền vững `tccs_approval_tasks/` trên RTDB                                                               |
| **CREATE**    | `src/services/app/MasterCriterionAppService.ts`                                 | Application Service chuyên biệt cho Master Criteria & Rename Workflow                                           |
| **CREATE**    | `src/services/app/LaboratoryAppService.ts`                                      | Application Service quản lý Testing Laboratories thay thế direct writes trong Zustand                           |
| **CREATE**    | `src/services/app/PharmacopoeiaAppService.ts`                                   | Application Service quản lý Dược điển động có phân quyền và Audit Trail                                         |
| **MODIFY**    | `src/services/app/BatchAppService.ts`                                           | **Xóa bỏ Admin Bypass** tại Release Guard (dòng 250, 271); tích hợp `ReleaseService`                            |
| **MODIFY**    | `src/services/app/ReleaseService.ts`                                            | Xóa bỏ `!isAdmin` bypass tại dòng 107; kết nối làm động cơ đánh giá 7 Release Gates cho BatchAppService         |
| **MODIFY**    | `src/services/app/TCCSAppService.ts`                                            | Chuyển đổi 6 điểm ghi Firebase trực tiếp sang gọi qua `criteriaAliasRepository` và `aiLearnedMappingRepository` |
| **MODIFY**    | `src/services/app/ChangeControlAppService.ts`                                   | Chuyển đổi từ `localStorage` sang gọi `FirebaseChangeControlRepository`                                         |
| **MODIFY**    | `src/services/app/CoAService.ts`                                                | Kết nối chính thức với `CoAReportPage.tsx`, loại bỏ các đoạn code mồ côi                                        |
| **MODIFY**    | `src/hooks/queries/useDeviationQueries.ts`                                      | Loại bỏ việc gọi trực tiếp repository; định tuyến qua `deviationAppService`                                     |
| **MODIFY**    | `src/store/slices/systemSlice.ts`                                               | Loại bỏ các thao tác `firebaseSet(ref(db), null)`, xóa trắng root; định tuyến qua AppServices                   |
| **MODIFY**    | `src/pages/qa/TccsDetailPage.tsx`                                               | Lưu trữ nhiệm vụ duyệt TCCS vào RTDB thay vì chỉ lưu `useState` cục bộ                                          |
| **MODIFY**    | `src/pages/qa/CriteriaFormPage.tsx`                                             | Chuyển đổi luồng đổi tên chỉ tiêu hàng loạt qua `MasterCriterionAppService.renameCriterion`                     |
| **MODIFY**    | `src/pages/qa/CriteriaList.tsx`                                                 | Chuyển đổi luồng đổi tên chỉ tiêu qua AppService; loại bỏ direct script                                         |
| **MODIFY**    | `src/components/features/CoAReport.tsx`                                         | Enforce Fail-Closed: Cấm tự nội suy quy tắc thay thế khi thiếu snapshot hợp lệ                                  |
| **MODIFY**    | `src/hooks/test-results/useTestResultSave.ts`                                   | Thay thế `window.confirm()` bằng State-driven Modals; xóa bỏ duplicate audit log                                |
| **MODIFY**    | `src/pages/products/ProductFormPage.tsx`                                        | Xóa bỏ lời gọi `logAuditAction` trùng lặp từ UI component                                                       |
| **MODIFY**    | `src/pages/batches/BatchList/hooks/useBatchList.ts`                             | Xóa bỏ lời gọi `logAuditAction` trùng lặp và chuyển status qua Workflow Action                                  |
| **MODIFY**    | `src/components/features/AIAssistantChat.tsx`                                   | Chuyển thao tác tạo Lô nhanh thành Pre-filled Modal xác nhận thay vì ghi thẳng                                  |
| **MODIFY**    | `src/services/dataConsistencyService.ts`                                        | Đặt rào chắn QA Authorization cho `autoHealAllWithAI`                                                           |
| **MODIFY**    | `src/services/userService.ts`                                                   | Đóng gói audit logging qua `auditService` chuẩn thay vì push ad-hoc                                             |
| **DEPRECATE** | `src/services/databaseService.ts` (`clearDatabaseService`, `updateRootService`) | Đánh dấu `@deprecated @forbidden` các export nguy hiểm gây phá hủy cơ sở dữ liệu                                |
| **DEPRECATE** | `src/services/testResultService.ts` (`bulkRenameCriteriaInTestResults`)         | Đánh dấu `@deprecated` nhường chỗ cho `MasterCriterionAppService.renameCriterion`                               |

---

## 5. KẾ HOẠCH KIỂM THỬ WORKFLOW GRAPH (TESTING PLAN)

### 5.1. Unit Tests

- Thử nghiệm 100% các bước chuyển trạng thái (FSM) cho Batch, TestResult, Deviation, ChangeRequest.
- Thử nghiệm rào chắn 7 Release Gates: Bắt buộc không cho phép bất kỳ ai (kể cả Admin) xuất xưởng Lô khi thiếu kết quả kiểm nghiệm Đạt.
- Thử nghiệm OCC: Chặn cập nhật khi phiên bản dữ liệu bị cũ (`stale version`).

### 5.2. Integration Tests

- Luồng liên thông hoàn chỉnh: `UI Action → UnifiedWorkflowExecutor → Application Service → Domain Rule → Repository → Database → Audit`.
- Kiểm tra tính toàn vẹn của Audit Trail: Không có hành động nào bị ghi trùng lặp và không có mutation nào thiếu audit log.

### 5.3. Security & Bypass Tests

- Thử nghiệm gọi trực tiếp Repository mutation từ UI Component: Phải bị chặn bởi static architecture guard.
- Thử nghiệm gọi direct DB write `set(ref(db), null)`: Phải bị chặn hoặc loại bỏ.
- Thử nghiệm AI tự ý thay đổi dữ liệu: Phải bị chặn ở tầng kiểm soát.

### 5.4. E2E Tests (Playwright)

- Test chu trình nghiệp vụ khép kín từ Tạo sản phẩm -> TCCS -> Lô -> Nhập kiểm nghiệm -> Phê duyệt -> Xuất xưởng -> Ban hành CoA -> Quét QR xác thực.
- Test chu trình xử lý ngoại lệ: Kết quả rớt -> Kích hoạt OOS tự động -> Phân tích nguyên nhân -> Kế hoạch CAPA -> Đóng hồ sơ.
