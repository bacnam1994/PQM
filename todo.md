# 📋 ACTION PLAN – PQM GLOBAL BATCH WORKFLOW & DATA INTEGRITY HARDENING

> **Dự án:** PQM (Product Quality Management)  
> **Tài liệu mục tiêu:** Kế hoạch hành động chuẩn hóa toàn bộ vòng đời Batch & bảo toàn tính toàn vẹn dữ liệu  
> **Nguyên tắc cốt lõi:** DATA MODEL → CANONICAL RELATIONSHIP → CANONICAL QUALITY DECISION → CANONICAL RELEASE DECISION → WORKFLOW → PERSISTENCE → AUDIT → TEST  
> **Trạng thái khởi tạo:** 2026-10-01 | **Bắt đầu:** PHASE 1

---

## 🎯 0. MỤC TIÊU TỔNG THỂ (10 MỤC TIÊU BẮT BIẾN)

- [x] **Mục tiêu 1:** Một Batch chỉ có **MỘT** cách xác định quan hệ với `TestResult`.
- [x] **Mục tiêu 2:** Một `Release Decision` duy nhất được sử dụng ở mọi tầng (Domain, Workflow, Service, UI).
- [x] **Mục tiêu 3:** UI **tuyệt đối không** tự quyết định nghiệp vụ release hay bypass rules.
- [x] **Mục tiêu 4:** State Machine **không bị bypass** qua bất kỳ cờ tạm nào (`conditionsMet: true`).
- [x] **Mục tiêu 5:** Release metadata (`version`, `releasedAt`, `releasedBy`, `rejectReason`) phải persist đầy đủ vào Firebase RTDB.
- [x] **Mục tiêu 6:** Không có auto-signature giả (`sig_auto_*`, checksum giả mạo).
- [x] **Mục tiêu 7:** Không có false orphan do partial snapshot hoặc dữ liệu đang tải.
- [x] **Mục tiêu 8:** Không có mutation thành công nhưng workflow trả `FAIL` vì audit (chống split-brain).
- [x] **Mục tiêu 9:** Triển khai Optimistic Concurrency Control (OCC) thực sự ở tầng Firebase, loại bỏ race condition khi nhiều người cùng thao tác.
- [x] **Mục tiêu 10:** Mọi bug phát hiện phải có regression tests bảo vệ (45+ test cases).

---

## 📊 BẢNG THEO DÕI TIẾN ĐỘ 19 PHASES

|  Phase   | Phân kỳ nhiệm vụ                              | Trọng tâm thực hiện                                                                             |  Trạng thái   |
| :------: | :-------------------------------------------- | :---------------------------------------------------------------------------------------------- | :-----------: |
| **P-01** | **Freeze Data Healing**                       | Tạm dừng toàn bộ auto-heal/mutation khi read; phân loại 7 nhóm quan hệ                          | ✅ Hoàn thành |
| **P-02** | **Canonical Batch ↔ TestResult Relationship** | Xây dựng API `resolveBatchTestRelationship(batch, testResult)` duy nhất                         | ✅ Hoàn thành |
| **P-03** | **Sửa Mâu thuẫn Legacy Relationship**         | Thống nhất resolver, validity, quality engine và release gates cùng chung kết quả               | ✅ Hoàn thành |
| **P-04** | **Tạo Canonical Release Decision**            | Xây dựng `BatchReleaseDecisionService` / `resolveBatchReleaseDecision()` duy nhất               | ✅ Hoàn thành |
| **P-05** | **Chuẩn hóa 7 Release Gates**                 | Triển khai 7 gates SSoT thực sự, fail-closed khi thiếu dữ liệu, xóa bypass                      | ✅ Hoàn thành |
| **P-06** | **State Machine Không Bị Bypass**             | Xóa `conditionsMet: true`, State Machine chỉ nhận Canonical Release Decision                    | ✅ Hoàn thành |
| **P-07** | **Signature Hardening**                       | Xóa `sig_auto_*`, bắt buộc chữ ký số hợp lệ, checksum, actor, role, audit link                  | ✅ Hoàn thành |
| **P-08** | **Fix Firebase Release Persistence**          | `FirebaseBatchRepository.updateStatus` persist đầy đủ version, release metadata                 | ✅ Hoàn thành |
| **P-09** | **Implement Real OCC**                        | Triển khai OCC tại repository Firebase (transaction / version check), chặn ghi đè               | ✅ Hoàn thành |
| **P-10** | **Fix Mutation/Audit Split-Brain**            | Đảm bảo atomicity / outbox pattern giữa mutation và audit trail, retry idempotent               | ✅ Hoàn thành |
| **P-11** | **Data Freshness / Orphan Detection**         | Phân biệt `DATA_UNAVAILABLE` khi loading/partial và `TRUE_ORPHAN` khi đủ dataset                | ✅ Hoàn thành |
| **P-12** | **Không Auto-Heal Khi Read**                  | Tách bạch hoàn toàn: Read-only audit vs Repair workflow (Diagnose → Review → Approve → Execute) | ✅ Hoàn thành |
| **P-13** | **Repair Dữ Liệu Hiện Tại**                   | Xuất audit report phân loại và công cụ sửa lỗi có kiểm soát ALCOA+                              | ✅ Hoàn thành |
| **P-14** | **Test Matrix Toàn Diện**                     | 45 regression test cases phân bổ 6 nhóm: Relationship, Release, FSM, Persistence, OCC, Audit    | ✅ Hoàn thành |
| **P-15** | **End-to-End Test**                           | Kịch bản trọn vẹn: Create Batch → TCCS → Test Result → Release → Reload → Recall                | ✅ Hoàn thành |
| **P-16** | **UI Hardening**                              | UI chỉ render canonical decision, hiển thị 7 gates, relationship badge, không tự tính           | ✅ Hoàn thành |
| **P-17** | **Static Code Audit**                         | Rà soát toàn bộ repo loại bỏ pattern nguy hiểm (`endsWith`, `sig_auto_`, bypasses)              | ✅ Hoàn thành |
| **P-18** | **Acceptance Criteria Verification**          | Đối chiếu checklist 16 tiêu chí nghiệm thu khắt khe                                             | ✅ Hoàn thành |
| **P-19** | **Báo Cáo Nghiệm Thu Toàn Diện**              | Báo cáo chi tiết: Root cause, before/after, file list, test results, risks                      | ✅ Hoàn thành |

---

## 🛠️ CHI TIẾT CÁC PHÂN KỲ THỰC HIỆN

### 🛑 PHASE 1 – FREEZE DATA HEALING

- [x] Rà soát tất cả các điểm auto-heal ngầm trong code:
  - `src/services/dataConsistencyService.ts`
  - `src/domain/batch/batchIntegrityValidator.ts`
  - `src/domain/batch/batchTestResultResolver.ts`
- [x] **TẠM DỪNG** ngay lập tức:
  - Auto-heal Batch/TestResult khi load/read
  - Bulk migration batchId tự động
  - Bulk delete orphan tự động
  - Tự động thay đổi relationship khi audit
  - Tự động gán TestResult vào Batch
- [x] Thiết lập hệ thống phân loại 7 nhóm trạng thái liên kết:
  - `TRUE_ORPHAN`
  - `FALSE_ORPHAN_PARTIAL_SNAPSHOT`
  - `PRIMARY_MATCH`
  - `LEGACY_BATCHNO_MATCH`
  - `EXPLICIT_RELATIONSHIP_MATCH`
  - `AMBIGUOUS_MATCH`
  - `UNRESOLVED`
- [x] Cam kết: Audit/read operation tuyệt đối không được mutate dữ liệu.

---

### 🔗 PHASE 2 – THIẾT LẬP CANONICAL BATCH ↔ TESTRESULT RELATIONSHIP

- [x] File trọng tâm:
  - `src/domain/batch/batchTestResultResolver.ts`
  - `src/domain/batch/batchIntegrityValidator.ts`
  - `src/domain/canonical/canonicalResolver.ts`
  - `src/services/testResultService.ts`
  - `src/services/dataConsistencyService.ts`
  - `src/pages/batches/BatchList/hooks/useBatchList.ts`
- [x] Tạo API chuẩn hóa duy nhất:
  ```typescript
  resolveBatchTestRelationship(batch: Batch, testResult: TestResult): BatchTestRelationshipResult
  ```
- [x] Chuẩn hóa thứ tự ưu tiên quan hệ:
  1. `testResult.batchId === batch.id` → `PRIMARY`
  2. Explicit relationship ID hợp lệ → `EXPLICIT_RELATIONSHIP`
  3. Legacy batchNo (`testResult.batchId === batch.batchNo` hoặc `testResult.batchNo === batch.batchNo`) → `LEGACY_BATCH_NO`
  4. Không khớp → `UNRESOLVED`
  5. Suffix matching: **CHỈ DÙNG CHO DIAGNOSTIC/CẢNH BÁO**, tuyệt đối **KHÔNG** làm authoritative relationship.
- [x] Xóa bỏ toàn bộ các câu lệnh so sánh rời rạc trong code (`r.batchId === batchId`, `endsWith(...)`, `batch.batchNo === r.batchId`). Mọi nơi bắt buộc gọi canonical resolver.

---

### ⚖️ PHASE 3 – SỬA MÂU THUẪN LEGACY RELATIONSHIP

- [x] Phân tích mâu thuẫn kiến trúc:
  - `batchTestResultResolver` chấp nhận `LEGACY_BATCH_NO`
  - nhưng `isValidTestResultForBatch()` và `CanonicalStatusResolver.resolveBatchQuality()` chỉ chấp nhận `testResult.batchId === batch.id`.
- [x] Tái cấu trúc đồng nhất:
  - Relationship resolution
  - TestResult validity
  - Authoritative TestResult selection
  - Quality calculation
  - Release decision
- [x] Đảm bảo 100%: Khi Resolver xác định `MATCH` (kể cả Legacy hợp lệ theo chính sách), Quality Engine **phải** cùng công nhận `MATCH`.

---

### 🏛️ PHASE 4 – TẠO CANONICAL RELEASE DECISION

- [x] Tạo Domain Service duy nhất: `BatchReleaseDecisionService` / `resolveBatchReleaseDecision()`
- [x] Định nghĩa Output Contract bắt buộc:
  ```typescript
  interface BatchReleaseDecision {
    eligible: boolean;
    batchId: string;
    batchNo: string;
    currentStatus: BatchStatus;
    nextStatus: BatchStatus;
    testResultResolution: BatchTestRelationshipResult;
    qualityDecision: QualityEvaluationResult;
    gates: ReleaseGateResult[];
    blockers: string[];
    warnings: string[];
    requiredSignature: boolean;
    requiredRole: UserRole[];
    dataFreshness: DataFreshnessState;
    decisionTrace: string[];
  }
  ```
- [x] Thay thế triệt để các nguồn tính toán release phân tán trong:
  - UI (`BatchList`, `BatchDetail`, Action Modals)
  - `BatchRules`, `ReleaseRules`
  - Workflow Handlers (`BATCH_RELEASE_APPROVE`, `BATCH_RELEASE_REJECT`)
  - Workflow Executor & Integrity Validator
- [x] Quy tắc: UI chỉ nhận output và render; UI không tự chạy logic release.

---

### 🛡️ PHASE 5 – CHUẨN HÓA 7 RELEASE GATES

- [x] Thiết lập 7 Gates thành Single Source of Truth (SSoT):
  - **Gate 1:** Test completion = 100% (mọi chỉ tiêu bắt buộc đều có kết quả)
  - **Gate 2:** Canonical Quality = `PASS`
  - **Gate 3:** Không có OOS mở (`status !== 'CLOSED'`)
  - **Gate 4:** Không có Critical Deviation mở
  - **Gate 5:** CAPA thực sự đạt điều kiện (loại bỏ `const gate5Passed = true`)
  - **Gate 6:** BPR thực sự được QA APPROVED (loại bỏ `undefined BPR => PASS`)
  - **Gate 7:** Role + Digital Signature + Expiry hợp lệ
- [x] Triển khai nguyên tắc **FAIL CLOSED**: Nếu thiếu dữ liệu bắt buộc → Trả kết quả `FAIL`/`BLOCKED`, tuyệt đối không tự suy đoán `PASS`.

---

### 🔄 PHASE 6 – STATE MACHINE KHÔNG ĐƯỢC BYPASS

- [x] Loại bỏ hoàn toàn logic bypass: `conditionsMet: status === 'RELEASED' ? true : undefined`
- [x] Cấm Handler tự truyền cờ bypass vào State Machine.
- [x] State Machine chỉ chấp nhận chuyển trạng thái sang `RELEASED` khi nhận `BatchReleaseDecision.eligible === true`.
- [x] Chuẩn hóa Flow thực thi tuần tự:
  ```text
  current state
  → calculate decision
  → validate transition
  → validate release gates
  → validate signature
  → OCC (verify & increment version)
  → atomic mutation
  → audit commit
  ```

---

### ✍️ PHASE 7 – SIGNATURE HARDENING

- [x] Xóa sạch mọi mã sinh chữ ký tự động giả lập: `sig_auto_*`, `checksum: 'valid-checksum'`.
- [x] Bắt buộc quy trình kiểm tra chữ ký nghiêm ngặt cho `BATCH_RELEASE_APPROVE`:
  - [x] Signature record tồn tại và đúng cấu trúc ALCOA+
  - [x] Khớp đúng `documentType === 'BATCH_RELEASE'`
  - [x] Khớp đúng `batchId` và `batchVersion`
  - [x] Khớp đúng `signerId` và `signerRole` (QA Manager / Authorized Person)
  - [x] SHA-256 integrity checksum hợp lệ (bảo toàn payload)
  - [x] Timestamp hợp lệ trong khung thời gian cho phép
  - [x] Chống Replay Attack (chữ ký chưa từng được sử dụng cho release khác)
  - [x] Có Audit Trail record tương ứng được ghi nhận
- [x] Nếu thiếu hoặc sai bất kỳ tiêu chí nào → `FAIL IMMEDIATELY`, không fallback.

---

### 💾 PHASE 8 – FIX FIREBASE RELEASE PERSISTENCE

- [x] File trọng tâm: `src/repositories/firebase/FirebaseBatchRepository.ts` (và `src/infrastructure/repositories/`)
- [x] Khắc phục lỗi `updateStatus()` chỉ ghi một vài trường cơ bản:
  - Cập nhật đầy đủ:
    - `status`
    - `version`
    - `updatedAt`
    - `releasedAt`
    - `releasedBy`
    - `rejectReason`
    - `releaseDecisionSnapshot` / workflow metadata cần thiết
- [x] Đảm bảo: Reload dữ liệu từ Firebase phải cho kết quả giống 100% trước khi reload.

---

### 🔒 PHASE 9 – IMPLEMENT REAL OCC (OPTIMISTIC CONCURRENCY CONTROL)

- [x] Chấm dứt việc chỉ kiểm tra `batch.version` trên bộ nhớ client (in-memory).
- [x] Triển khai OCC tại tầng Firebase Realtime Database:
  - Đọc `currentVersion` hiện tại từ Firebase
  - Thực hiện mutation nguyên tử (atomic transaction hoặc conditional update)
  - Chỉ commit nếu version Firebase khớp với `expectedVersion`
  - Cập nhật `newVersion = currentVersion + 1`
  - Nếu version đã thay đổi bởi tác vụ khác → Báo lỗi `CONCURRENCY_CONFLICT` và rollback.
- [x] Ngăn chặn triệt để tình huống 2 người dùng cùng release một lúc dẫn đến double-mutation.

---

### ⚡ PHASE 10 – FIX MUTATION / AUDIT SPLIT-BRAIN

- [x] Loại bỏ tình trạng split-brain: Mutation Database thành công nhưng Audit ghi thất bại dẫn đến Workflow trả `FAIL` trong khi DB đã `RELEASED`.
- [x] Kiến trúc xử lý:
  - Thiết kế Durable Outbox Pattern / Transactional Audit phù hợp với Firebase RTDB.
  - Chuẩn hóa Audit Event Payload:
    - `executionId`
    - `eventId`
    - `entityId`
    - `actionId`
    - `actor`
    - `fromState`
    - `toState`
    - `version`
    - `timestamp`
    - `correlationId`
  - Cơ chế Retry Audit phải đảm bảo **Idempotent** (chống trùng lặp audit log khi thử lại).

---

### 🌐 PHASE 11 – DATA FRESHNESS / ORPHAN DETECTION

- [x] Ngăn ngừa kết luận ORPHAN sai lệch (False Orphan):
  - Khi batches đang `LOADING`
  - Khi testResults đang `LOADING`
  - Khi snapshot dữ liệu là `PARTIAL`
  - Khi đang `OFFLINE`
  - Khi Firebase query/pagination chưa hoàn tất
- [x] Trạng thái trả về bắt buộc: `DATA_UNAVAILABLE` thay vì `ORPHAN`.
- [x] Chỉ kết luận `TRUE_ORPHAN` khi:
  - Dataset Batch & TestResult đã xác nhận nạp đầy đủ 100%
  - Canonical Relationship Resolver không tìm thấy bất kỳ match nào
  - Không có pending sync hay loading indicator nào đang kích hoạt.

---

### 👁️ PHASE 12 – KHÔNG AUTO-HEAL KHI READ (READ-ONLY AUDIT)

- [x] Khóa các functions sau về chế độ thuần READ:
  - `auditDataConsistency()`
  - `buildTestResultIndex()`
  - `resolveTestResultsForBatch()`
  - `evaluateBatchReleaseIntegrity()`
- [x] Tuyệt đối cấm sửa `batchId`, xóa record, đổi status khi đang query/render.
- [x] Tách hẳn module Repair thành workflow độc lập 5 bước:
      `DIAGNOSE` → `REVIEW` → `APPROVE` → `EXECUTE` → `VERIFY`.

---

### 🩺 PHASE 13 – REPAIR DỮ LIỆU HIỆN TẠI

- [x] Chỉ kích hoạt SAU KHI hoàn thành Phase 1 đến Phase 12.
- [x] Xây dựng Data Audit Report:
  - `totalTestResults`
  - `primaryMatches`
  - `legacyMatches`
  - `trueOrphans`
  - `falseOrphans`
  - `ambiguous`
  - `unresolved`
- [x] Xuất danh sách kiểm toán chi tiết:
  - `testResultId`, `currentBatchId`, `currentBatchNo`, `resolvedBatchId`, `resolutionType`, `confidence`, `reason`
- [x] Tuyệt đối không tự động sửa `AMBIGUOUS`. Chỉ sửa `PRIMARY_CONFIRMED` và `LEGACY_CONFIRMED` kèm audit trail đầy đủ.

---

### 🧪 PHASE 14 – TEST MATRIX TOÀN DIỆN (45 TEST CASES)

- [x] **Nhóm A: Relationship (9 tests)**
  - [x] 1. `batchId = batch.id`
  - [x] 2. `batchId = batchNo`
  - [x] 3. `batchId` không hợp lệ
  - [x] 4. `batchId` rỗng
  - [x] 5. Suffix collision (trùng đuôi chuỗi)
  - [x] 6. Duplicate `batchNo`
  - [x] 7. Partial snapshot handling
  - [x] 8. Delayed loading / async freshness
  - [x] 9. Offline mode behavior
- [x] **Nhóm B: Release Decision & Gates (14 tests)**
  - [x] 10. No test result
  - [x] 11. Legacy test result resolution
  - [x] 12. PASS test result
  - [x] 13. FAIL test result
  - [x] 14. Incomplete test completion (< 100%)
  - [x] 15. OOS record open
  - [x] 16. Critical deviation open
  - [x] 17. CAPA not fulfilled
  - [x] 18. BPR not QA-approved
  - [x] 19. Expired batch
  - [x] 20. Wrong signer role
  - [x] 21. Missing signature
  - [x] 22. Invalid signature checksum
  - [x] 23. Replay signature attempt
- [x] **Nhóm C: State Machine & Workflow (7 tests)**
  - [x] 24. `PENDING` → `TESTING`
  - [x] 25. `TESTING` → `RELEASED`
  - [x] 26. `TESTING` → `REJECTED`
  - [x] 27. `TESTING` → `BLOCKED`
  - [x] 28. `RELEASED` → `BLOCKED` / `RECALL`
  - [x] 29. `REJECTED` → `RELEASED` must FAIL
  - [x] 30. Invalid transitions must FAIL
- [x] **Nhóm D: Firebase Persistence (6 tests)**
  - [x] 31. `status` persisted accurately
  - [x] 32. `version` increment persisted
  - [x] 33. `releasedAt` persisted
  - [x] 34. `releasedBy` persisted
  - [x] 35. `rejectReason` persisted
  - [x] 36. Reload after release yields 100% identical state
- [x] **Nhóm E: Concurrency & OCC (4 tests)**
  - [x] 37. Simultaneous release from two actors
  - [x] 38. Stale version rejection
  - [x] 39. Duplicate submit handling
  - [x] 40. Double-click release protection
- [x] **Nhóm F: Audit & Outbox (5 tests)**
  - [x] 41. Mutation success + Audit success
  - [x] 42. Mutation failure handling
  - [x] 43. Audit retry idempotency
  - [x] 44. Duplicate audit prevention
  - [x] 45. Audit failure must not create split-brain or misleading result

---

### 🚀 PHASE 15 – END-TO-END (E2E) TEST

- [x] Kịch bản trọn vẹn 1:
      `CREATE BATCH` → `ASSIGN TCCS` → `CREATE TEST RESULT` → `FINALIZE TEST RESULT` → `APPROVE TEST RESULT` → `QUALITY DECISION` → `RELEASE CHECK` → `E-SIGNATURE` → `RELEASE` → `FIREBASE RELOAD` → `VERIFY ALL METADATA & AUDIT`
- [x] Kịch bản trọn vẹn 2:
      `RECALL / BLOCK` → `VERIFY STATE MACHINE` → `VERIFY AUDIT TRAIL` → `VERIFY OCC VERSION`

---

### 🖥️ PHASE 16 – UI REFACTOR & ENHANCEMENT

- [x] Rà soát toàn bộ UI components trong `src/pages/batches/`:
  - `BatchList`, `BatchDetail`, Action Modals, Release Gates Modal.
- [x] Loại bỏ triệt để mọi logic đánh giá release riêng lẻ trong UI.
- [x] UI chỉ tiêu thụ kết quả từ `BatchReleaseDecision`:
  - Hiển thị chi tiết từng Gate (PASS / FAIL / PENDING) kèm lý do rõ ràng
  - Hiển thị badge loại liên kết (`PRIMARY`, `LEGACY`, `UNRESOLVED`)
  - Hiển thị `DATA_UNAVAILABLE` thay vì `ORPHAN` khi dữ liệu đang tải
  - Thêm filter cho trạng thái `BLOCKED` / `RECALLED`
  - Disable nút Release và hiển thị tooltip blockers nếu chưa đủ điều kiện.

---

### 🔍 PHASE 17 – REPOSITORY-WIDE STATIC AUDIT

- [x] Quét toàn bộ repository và loại bỏ triệt để các antipattern:
  - `r.batchId === batchId`
  - `r.batchId === batch.id`
  - `endsWith(batchId)` / `endsWith(batch.id)`
  - `gate5Passed = true`
  - `sig_auto_`
  - `conditionsMet: true`
  - `status === 'RELEASED' ? true`
  - Trực tiếp mutate batch status ngoài Workflow
  - UI tự gọi ReleaseRules
  - Tự sinh version ngoài OCC authority
- [x] Mỗi trường hợp phát hiện phải:
  1. Chứng minh được là hợp lệ, HOẶC
  2. Refactor ngay về canonical service tương ứng.

---

### ✅ PHASE 18 – BẢNG ĐỐI CHIẾU TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- [x] Không còn nhiều resolver Batch/TestResult độc lập.
- [x] Không còn UI tự quyết định release.
- [x] Không còn `CanonicalStatusResolver` bỏ qua quan hệ LEGACY trái với policy.
- [x] Không còn suffix matching được dùng làm authoritative relationship.
- [x] Không còn false orphan do partial snapshot.
- [x] Không còn auto signature giả lập.
- [x] Không còn hardcoded CAPA gate.
- [x] Không còn `undefined BPR => PASS`.
- [x] Không còn `conditionsMet = true` để bypass release gates.
- [x] Release metadata persist đầy đủ 100% lên Firebase RTDB.
- [x] OCC thực sự bảo vệ concurrent update.
- [x] Mutation/Audit không còn split-brain.
- [x] Có đầy đủ 45 regression tests P0/P1 pass 100%.
- [x] E2E release test pass 100%.
- [x] Có data integrity report trước khi chạy repair.
- [x] Không có migration dữ liệu tự động trước khi audit.
- [x] Reload application/Firebase không làm thay đổi kết quả quyết định.

---

### 📄 PHASE 19 – BÁO CÁO NGHIỆM THU BẮT BUỘC

- [x] Soạn thảo báo cáo chi tiết bao gồm:
  1. Root cause analysis
  2. Danh sách files changed & functions changed
  3. Chi tiết thay đổi kiến trúc (Architecture Changes)
  4. Bảng so sánh hành vi Trước / Sau (Before vs After Behavior)
  5. Danh sách tests bổ sung và kết quả thực thi
  6. Remaining risks & giải pháp giảm thiểu
  7. Data migration report & danh sách records cần manual review
  8. Phân định rõ ràng: Bug nào đã sửa, Bug nào cùng root cause, Bug nào là triệu chứng (symptom), Tại sao không tái diễn ở tầng khác.

---

## 📌 THỨ TỰ THỰC HIỆN BẮT BUỘC

```text
PHASE 1 (Freeze Auto-Heal)
  ↓
PHASE 2 (Canonical Relationship)
  ↓
PHASE 3 (Fix Legacy Contradiction)
  ↓
PHASE 4 (Canonical Release Decision)
  ↓
PHASE 5 (7 Release Gates)
  ↓
PHASE 6 (State Machine)
  ↓
PHASE 7 (Signature Hardening)
  ↓
PHASE 8 (Firebase Persistence)
  ↓
PHASE 9 (OCC)
  ↓
PHASE 10 (Audit/Outbox)
  ↓
PHASE 11 (Data Freshness)
  ↓
PHASE 12 (Read-only Audit)
  ↓
PHASE 13 (Data Repair)
  ↓
PHASE 14 (Regression Tests)
  ↓
PHASE 15 (E2E)
  ↓
PHASE 16 (UI)
  ↓
PHASE 17 (Static Code Audit)
  ↓
PHASE 18 & 19 (Acceptance & Final Report)
```

_Ghi chú: Tuyệt đối không được đảo lộn thứ tự thực hiện._
