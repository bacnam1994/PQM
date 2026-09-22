# KẾ HOẠCH HÀNH ĐỘNG TOÀN DIỆN VIBECODING MASTER IMPLEMENTATION PLAN V2 (TODO.MD)

> **Mục tiêu**: Chuyển đổi toàn diện dự án PQM sang mô hình phát triển định hướng đặc tả bắt buộc:
> `Business Workflow` ➔ `Business Rules` ➔ `Domain Contracts` ➔ `Functional Specifications` ➔ `Screen Contracts` ➔ `Acceptance Criteria` ➔ `Implementation` ➔ `Automated Tests` ➔ `Traceability Audit`.
> Từ thời điểm này: **CODE CHỈ LÀ IMPLEMENTATION CỦA ĐẶC TẢ. WORKFLOW LÀ THẨM QUYỀN TỐI CAO.**

---

## 📊 TIẾN ĐỘ TỔNG QUAN 21 GIAI ĐOẠN (PHASE 0 ➔ PHASE 20)

| Giai đoạn    | Nội dung trọng tâm                                                                  |    Trạng thái     | Tiến độ  |
| :----------- | :---------------------------------------------------------------------------------- | :---------------: | :------: |
| **PHASE 0**  | **Workflow Readiness Audit (Đối chiếu 8 chiều & Lập Gap Register)**                 | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 1**  | **Business Rule Catalog (Xây dựng 21 danh mục quy tắc có Rule ID)**                 | ⏳ **TIẾP THEO**  |    0%    |
| **PHASE 2**  | **Domain Contracts (Chuẩn hóa 17 Contracts & Tách biệt Quality / Workflow)**        |      ⏳ Chờ       |    0%    |
| **PHASE 3**  | **State Machines (Đặc tả FSM độc lập: Batch, TestResult, Criterion, Alternate)**    |      ⏳ Chờ       |    0%    |
| **PHASE 4**  | **Functional Specification V2 (Đặc tả FRS cho 20 Modules nghiệp vụ)**               |      ⏳ Chờ       |    0%    |
| **PHASE 5**  | **E2E Business Scenarios (Xây dựng 18 Kịch bản Đoạn-Cuối-Đoạn S-001 -> S-018)**     |      ⏳ Chờ       |    0%    |
| **PHASE 6**  | **Screen Contracts (Xây dựng 25 Hợp đồng màn hình SC-01 -> SC-25)**                 |      ⏳ Chờ       |    0%    |
| **PHASE 7**  | **Acceptance Criteria (Xây dựng tiêu chí nghiệm thu Gherkin cho 100% Rules)**       |      ⏳ Chờ       |    0%    |
| **PHASE 8**  | **Traceability Matrix V2 (Ma trận truy xuất nguồn gốc 8 tầng khép kín)**            |      ⏳ Chờ       |    0%    |
| **PHASE 9**  | **Codebase Conformance Audit (Đối chiếu mã nguồn với toàn bộ Spec)**                |      ⏳ Chờ       |    0%    |
| **PHASE 10** | **Domain Engine Rebuild (Tái cấu trúc Domain Engine 10 tầng chuẩn mực)**            |      ⏳ Chờ       |    0%    |
| **PHASE 11** | **Test First (Triển khai Unit, Integration & E2E Tests trước khi sửa UI)**          |      ⏳ Chờ       |    0%    |
| **PHASE 12** | **Application Services (Chuẩn hóa các dịch vụ điều phối workflow)**                 |      ⏳ Chờ       |    0%    |
| **PHASE 13** | **PKN Implementation (Triển khai Phiếu kiểm nghiệm không filter mất chỉ tiêu)**     |      ⏳ Chờ       |    0%    |
| **PHASE 14** | **TCCS Implementation (Triển khai Tiêu chuẩn cơ sở có biểu thị Alternate Rule)**    |      ⏳ Chờ       |    0%    |
| **PHASE 15** | **CoA Implementation (Triển khai CoA đọc trực tiếp từ Snapshot đã niêm phong)**     |      ⏳ Chờ       |    0%    |
| **PHASE 16** | **Approval & Release (Triển khai Phê duyệt & 7 Release Gates có ký điện tử)**       |      ⏳ Chờ       |    0%    |
| **PHASE 17** | **OOS / Deviation / CAPA (Triển khai Điều tra ngoài tiêu chuẩn, Sai lệch & CAPA)**  |      ⏳ Chờ       |    0%    |
| **PHASE 18** | **Audit / Signature / Security (Chuỗi kiểm toán ALCOA+, Part 11 & Security Rules)** |      ⏳ Chờ       |    0%    |
| **PHASE 19** | **UI Rebuild (Tái thiết kế giao diện theo Screen Contracts - Presentation Only)**   |      ⏳ Chờ       |    0%    |
| **PHASE 20** | **Final Validation (Thẩm định cuối cùng, Build, Deploy Firebase, Backup & Export)** |      ⏳ Chờ       |    0%    |

---

## 📜 QUY TẮC BẤT BIẾN (VIBECODING HARD RULES)

1. ⛔ **RULE 1**: Không code nếu Business Rule chưa tồn tại trong tài liệu đặc tả.
2. ⛔ **RULE 2**: Không tự suy diễn nghiệp vụ từ code legacy.
3. ⛔ **RULE 3**: Không sửa workflow để làm code hiện tại pass test.
4. ⛔ **RULE 4**: Không đặt business logic hay authority trong UI.
5. ⛔ **RULE 5**: Không để CoA tự evaluate hay nội suy kết quả.
6. ⛔ **RULE 6**: Không để nhiều evaluator độc lập cùng quyết định quality (Single Source of Truth duy nhất).
7. ⛔ **RULE 7**: Không dùng boolean `isPass` làm canonical authority.
8. ⛔ **RULE 8**: Không biến missing data thành PASS.
9. ⛔ **RULE 9**: Không biến missing required data thành FAIL (phải bảo lưu PENDING).
10. ⛔ **RULE 10**: Không filter mất một criterion chỉ vì criterion đang NOT_TRIGGERED hoặc EXEMPTED.
11. ⛔ **RULE 11**: Nếu specification mâu thuẫn: `STOP ➔ REPORT CONFLICT ➔ DO NOT GUESS`.
12. ⛔ **RULE 12**: Mỗi thay đổi business logic bắt buộc cập nhật đồng bộ: `Workflow ➔ Business Rule ➔ Domain Contract ➔ FRS ➔ Screen Contract ➔ Acceptance Criteria ➔ Test ➔ Traceability Matrix`.

---

# CHI TIẾT TỪNG GIAI ĐOẠN HÀNH ĐỘNG

---

## 🔹 PHASE 0: WORKFLOW READINESS AUDIT [✅ HOÀN THÀNH 100%]

- [x] **Task 0.1**: Đọc và rà soát toàn bộ các văn kiện đặc tả hiện tại:
  - `docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md`
  - `docs/workflow/PQM_WORKFLOW_V2_BLUEPRINT.md`
  - `docs/validation/PQM_FUNCTIONAL_REQUIREMENTS.md`
- [x] **Task 0.2**: Đối chiếu 8 chiều: `MASTER WORKFLOW` vs `WORKFLOW V2` vs `FRS` vs `DOMAIN` vs `SERVICE` vs `UI` vs `REPORT` vs `TEST`.
- [x] **Task 0.3**: Phân loại toàn bộ các sai lệch theo 8 nhãn chuẩn: `CONFLICT`, `MISSING`, `AMBIGUOUS`, `DUPLICATED`, `IMPLEMENTED_WRONG`, `IMPLEMENTED_PARTIAL`, `LEGACY`, `UNTESTED`.
- [x] **Task 0.4**: Xuất bản văn kiện chính thức: [`docs/audit/PQM_WORKFLOW_GAP_REGISTER.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/audit/PQM_WORKFLOW_GAP_REGISTER.md).
- [x] **Task 0.5**: Tuyệt đối không can thiệp sửa đổi mã nguồn trong Phase 0.

---

## 🔹 PHASE 1: BUSINESS RULE CATALOG (21 CATALOGS) [⏳ TIẾP THEO]

_Mỗi Business Rule bắt buộc có: Rule ID, Purpose, Actor, Trigger, Input, Preconditions, Decision Logic, Decision Table, Output, State Transition, UI Behavior, Report/CoA Behavior, Audit Requirement, Forbidden Behavior, Exception Handling, Test Cases._

- [ ] **Task 1.01**: `docs/business-rules/MASTER_DATA_RULES.md`
- [ ] **Task 1.02**: `docs/business-rules/PRODUCT_RULES.md`
- [ ] **Task 1.03**: `docs/business-rules/TCCS_RULES.md`
- [ ] **Task 1.04**: `docs/business-rules/FORMULA_RULES.md`
- [ ] **Task 1.05**: `docs/business-rules/RAW_MATERIAL_RULES.md`
- [ ] **Task 1.06**: `docs/business-rules/BATCH_RULES.md`
- [ ] **Task 1.07**: `docs/business-rules/TEST_RESULT_RULES.md`
- [ ] **Task 1.08**: `docs/business-rules/QUALITY_EVALUATION_RULES.md`
- [ ] **Task 1.09**: `docs/business-rules/ALTERNATE_RULES.md`
- [ ] **Task 1.10**: `docs/business-rules/OOS_RULES.md`
- [ ] **Task 1.11**: `docs/business-rules/DEVIATION_RULES.md`
- [ ] **Task 1.12**: `docs/business-rules/CAPA_RULES.md`
- [ ] **Task 1.13**: `docs/business-rules/APPROVAL_RULES.md`
- [ ] **Task 1.14**: `docs/business-rules/RELEASE_RULES.md`
- [ ] **Task 1.15**: `docs/business-rules/COA_RULES.md`
- [ ] **Task 1.16**: `docs/business-rules/SIGNATURE_RULES.md`
- [ ] **Task 1.17**: `docs/business-rules/AUDIT_RULES.md`
- [ ] **Task 1.18**: `docs/business-rules/GENEALOGY_RULES.md`
- [ ] **Task 1.19**: `docs/business-rules/REPORTING_RULES.md`
- [ ] **Task 1.20**: `docs/business-rules/AI_RULES.md`
- [ ] **Task 1.21**: `docs/business-rules/RBAC_RULES.md`

---

## 🔹 PHASE 2: DOMAIN CONTRACTS (17 CONTRACTS) [⏳ CHỜ]

_Chuẩn hóa cấu trúc 17 thực thể cốt lõi, tách bạch tuyệt đối Quality Status (`PASS/FAIL/PENDING/UNKNOWN`), Execution State (`NOT_STARTED/REQUIRED/TESTING/COMPLETED/NOT_APPLICABLE/EXEMPTED`), Alternate State và Workflow Status._

- [ ] **Task 2.01**: Contract Product, TCCS, Criterion, AlternateRule
- [ ] **Task 2.02**: Contract ProductFormula, RawMaterial, Batch
- [ ] **Task 2.03**: Contract TestResult, CriterionResult, Evaluation, EvaluationSnapshot
- [ ] **Task 2.04**: Contract OOS, Deviation, CAPA, ApprovalTask
- [ ] **Task 2.05**: Contract ElectronicSignature, AuditRecord
- [ ] **Task 2.06**: Tài liệu tổng hợp `docs/contracts/DATA_CONTRACTS.md`

---

## 🔹 PHASE 3: STATE MACHINES [⏳ CHỜ]

_Đặc tả 4 FSM độc lập với đầy đủ: Trigger, Actor, Precondition, Allowed Transitions, Forbidden Transitions, Output, Audit._

- [ ] **Task 3.01**: Batch State Machine (`DRAFT -> TESTING -> QA_REVIEW -> APPROVED -> RELEASED` / `TESTING -> REJECTED`)
- [ ] **Task 3.02**: TestResult State Machine (`DRAFT -> SUBMITTED -> FINAL -> APPROVED`)
- [ ] **Task 3.03**: Criterion State Machine (`NOT_STARTED -> REQUIRED -> TESTING -> PASS / FAIL / PENDING`)
- [ ] **Task 3.04**: Alternate Rule State Machine (`NOT_APPLICABLE -> NOT_TRIGGERED -> TRIGGERED_PENDING -> TRIGGERED_PASS / TRIGGERED_FAIL`)
- [ ] **Task 3.05**: Ban hành tài liệu `docs/contracts/STATE_MACHINES.md`

---

## 🔹 PHASE 4: FUNCTIONAL SPECIFICATIONS V2 [⏳ CHỜ]

_Mỗi Module có FRS riêng: Input, Output, Validation, Business Rules, State, Service, Domain, Permission, Error, Audit, Acceptance Criteria._

- [ ] **Task 4.01**: FRS-MOD-01 đến FRS-MOD-05 (Master Data, Product, TCCS, Formula, Raw Material)
- [ ] **Task 4.02**: FRS-MOD-06 đến FRS-MOD-09 (Batch, PKN, Evaluation Engine, Alternate Rules)
- [ ] **Task 4.03**: FRS-MOD-10 đến FRS-MOD-15 (OOS, Deviation, CAPA, Approval, Release, CoA)
- [ ] **Task 4.04**: FRS-MOD-16 đến FRS-MOD-20 (Signature, Audit, Genealogy, Reporting, AI)

---

## 🔹 PHASE 5: E2E BUSINESS SCENARIOS (S-001 ➔ S-018) [⏳ CHỜ]

- [ ] **Task 5.01**: S-001 (Happy Path - Batch đạt) & S-002 (Batch không đạt)
- [ ] **Task 5.02**: S-003 (PKN chưa hoàn tất) & S-004 (Alternate Rule FAIL_RETRY)
- [ ] **Task 5.03**: S-005 (Alternate Rule CONDITIONAL_CHECK) & S-006 (Alternate Dependency Missing)
- [ ] **Task 5.04**: S-007 (TCCS Version Change) & S-008 (TestResult Approval)
- [ ] **Task 5.05**: S-009 (Batch Release) & S-010 (OOS Investigation)
- [ ] **Task 5.06**: S-011 (Deviation) & S-012 (CAPA)
- [ ] **Task 5.07**: S-013 (CoA Generation) & S-014 (Audit Trail)
- [ ] **Task 5.08**: S-015 (Electronic Signature) & S-016 (Concurrent Modification)
- [ ] **Task 5.09**: S-017 (Legacy Data) & S-018 (AI Advisory)

---

## 🔹 PHASE 6: SCREEN CONTRACTS (SC-01 ➔ SC-25) [⏳ CHỜ]

_Đặc tả 25 màn hình: Purpose, Actor, Permission, Data Source, States (Loading, Empty, Error, Normal), Form Fields, Actions, Validation, Business Rules, State Rendering, Navigation, Audit, Forbidden UI Behavior (Cấm UI tự evaluate)._

- [ ] **Task 6.01**: SC-01 đến SC-05 (Dashboard, Product List/Detail/Form, TCCS List)
- [ ] **Task 6.02**: SC-06 đến SC-10 (TCCS Detail/Form, Formula, Material, Batch List)
- [ ] **Task 6.03**: SC-11 đến SC-15 (Batch Detail, Batch Form, PKN List, PKN Form/Editor, CoA Report)
- [ ] **Task 6.04**: SC-16 đến SC-20 (OOS, Deviation, CAPA, Approval, Audit Log)
- [ ] **Task 6.05**: SC-21 đến SC-25 (Batch 360, Product 360, Trend Analysis, AI Assistant, System Settings)

---

## 🔹 PHASE 7: ACCEPTANCE CRITERIA (GHERKIN FORMAT) [⏳ CHỜ]

- [ ] **Task 7.01**: Acceptance Criteria cho Master Data, Product, TCCS, Formula, Material
- [ ] **Task 7.02**: Acceptance Criteria cho Batch, PKN, Evaluation Engine, Alternate Rules
- [ ] **Task 7.03**: Acceptance Criteria cho OOS, Deviation, CAPA, Approval, Release Gate
- [ ] **Task 7.04**: Acceptance Criteria cho CoA, Signature, Audit, AI Governance

---

## 🔹 PHASE 8: TRACEABILITY MATRIX V2 [⏳ CHỜ]

- [ ] **Task 8.01**: Ánh xạ 8 chiều: `Business Requirement ➔ Business Rule ➔ Domain Contract ➔ Functional Requirement ➔ Screen Contract ➔ Code ➔ Test ➔ Evidence`.
- [ ] **Task 8.02**: Ban hành `docs/traceability/PQM_TRACEABILITY_MATRIX_V2.md`.

---

## 🔹 PHASE 9: CODEBASE CONFORMANCE AUDIT [⏳ CHỜ]

- [ ] **Task 9.01**: Rà soát Domain, Services, Repositories, Hooks, Components, Pages, Reports, Tests, Security Rules.
- [ ] **Task 9.02**: Phân loại: `COMPLIANT`, `PARTIAL`, `CONFLICT`, `LEGACY`, `UNUSED`, `DUPLICATED`, `MISSING`.
- [ ] **Task 9.03**: Khóa danh mục cần refactor trước khi sửa code.

---

## 🔹 PHASE 10: DOMAIN ENGINE REBUILD [⏳ CHỜ]

- [ ] **Task 10.01**: Types & Enums
- [ ] **Task 10.02**: Validation Layer
- [ ] **Task 10.03**: State Machines Layer
- [ ] **Task 10.04**: Business Rules Engines
- [ ] **Task 10.05**: Criterion Evaluator & Alternate Rule Evaluator
- [ ] **Task 10.06**: Quality Evaluation Engine & Evaluation Snapshot Builder
- [ ] **Task 10.07**: Canonical Status Resolver (Single Source of Truth)

---

## 🔹 PHASE 11: TEST FIRST [⏳ CHỜ]

- [ ] **Task 11.01**: Unit Tests cho 100% Business Rules
- [ ] **Task 11.02**: Integration Tests cho State Machine & Snapshot Engine
- [ ] **Task 11.03**: E2E Automated Tests cho Scenarios S-001 -> S-018

---

## 🔹 PHASE 12: APPLICATION SERVICES [⏳ CHỜ]

- [ ] **Task 12.01**: Chuẩn hóa `BatchAppService`, `TestResultAppService`, `TCCSAppService`
- [ ] **Task 12.02**: Chuẩn hóa `ApprovalWorkflowService`, `ReleaseService`, `CoAService`
- [ ] **Task 12.03**: Chuẩn hóa `OOSService`, `DeviationService`, `CAPAService`, `AuditService`

---

## 🔹 PHASE 13: PKN IMPLEMENTATION [⏳ CHỜ]

- [ ] **Task 13.01**: PKN Editor hiển thị 100% tiêu chí từ TCCS Snapshot (không filter mất chỉ tiêu)
- [ ] **Task 13.02**: Badge trực quan: `PASS`, `FAIL`, `PENDING`, `MIỄN KIỂM`, `CHỜ KẾT QUẢ`

---

## 🔹 PHASE 14: TCCS IMPLEMENTATION [⏳ CHỜ]

- [ ] **Task 14.01**: TCCS Editor & Detail hiển thị rõ quan hệ `🔗 Có thay thế` / `↳ Phụ thuộc`
- [ ] **Task 14.02**: Tự động sinh khối "GHI CHÚ QUY TẮC THAY THẾ" chuẩn pháp lý

---

## 🔹 PHASE 15: COA IMPLEMENTATION [⏳ CHỜ]

- [ ] **Task 15.01**: CoA đọc 100% từ `EvaluationSnapshot` đã niêm phong, cấm tự evaluate lại
- [ ] **Task 15.02**: Sinh Footnote pháp lý tự động cho các chỉ tiêu miễn kiểm/thay thế

---

## 🔹 PHASE 16: APPROVAL & RELEASE GATES [⏳ CHỜ]

- [ ] **Task 16.01**: Pipeline phê duyệt phiếu kiểm nghiệm và ký số 21 CFR Part 11
- [ ] **Task 16.02**: Khóa chặt 7 Release Gates (Chất lượng ĐẠT, Snapshot toàn vẹn, không OOS mở)

---

## 🔹 PHASE 17: OOS / DEVIATION / CAPA [⏳ CHỜ]

- [ ] **Task 17.01**: Quy trình điều tra OOS kích hoạt tự động khi có chỉ tiêu FAIL
- [ ] **Task 17.02**: Luồng liên thông Deviation ➔ CAPA ➔ Quyết định QA

---

## 🔹 PHASE 18: AUDIT / SIGNATURE / SECURITY [⏳ CHỜ]

- [ ] **Task 18.01**: Khóa chuỗi băm ALCOA+ SHA-256 chống can thiệp
- [ ] **Task 18.02**: Rào chắn Firebase Rules & Storage Rules đồng bộ với Workflow

---

## 🔹 PHASE 19: UI REBUILD [⏳ CHỜ]

- [ ] **Task 19.01**: Tái cấu trúc 25 màn hình theo đúng Screen Contracts (Presentation Only)
- [ ] **Task 19.02**: Chuẩn hóa Design System, micro-animations, loading/empty/error states

---

## 🔹 PHASE 20: FINAL VALIDATION & RELEASE [⏳ CHỜ]

- [ ] **Task 20.01**: Chạy toàn diện TypeScript, Vitest, E2E, Architecture Guards
- [ ] **Task 20.02**: Build Production, Deploy Firebase Hosting, Commit & Push GitHub
- [ ] **Task 20.03**: Xuất bản `FULL_SOURCE_CODE.md` & `FULL_SOURCE_CODE.txt`

---

## 🏁 DEFINITION OF DONE

Một module hoặc phase chỉ được coi là hoàn tất khi thỏa mãn:

1. Workflow hoàn chỉnh, không có vùng xám.
2. Business Rules có ID duy nhất và bảng quyết định rõ ràng.
3. Domain Contract và State Machine hoàn chỉnh.
4. Functional Specification và Screen Contract hoàn chỉnh.
5. Acceptance Criteria chuẩn Gherkin.
6. 100% Unit Tests, Integration Tests và E2E Scenarios pass.
7. Ma trận truy xuất nguồn gốc (Traceability) được cập nhật khép kín.
8. UI không chứa business authority; Report/CoA không tự evaluate.
9. Rào chắn bảo mật và kiểm toán ALCOA+ toàn vẹn.
10. TypeScript không lỗi (`tsc --noEmit`), Build thành công.
