# KẾ HOẠCH HÀNH ĐỘNG TOÀN DIỆN VIBECODING MASTER IMPLEMENTATION PLAN V2 (TODO.MD)

> **Mục tiêu**: Chuyển đổi toàn diện dự án PQM sang mô hình phát triển định hướng đặc tả bắt buộc:
> `Business Workflow` ➔ `Business Rules` ➔ `Domain Contracts` ➔ `Functional Specifications` ➔ `Screen Contracts` ➔ `Acceptance Criteria` ➔ `Implementation` ➔ `Automated Tests` ➔ `Traceability Audit`.
> Từ thời điểm này: **CODE CHỈ LÀ IMPLEMENTATION CỦA ĐẶC TẢ. WORKFLOW LÀ THẨM QUYỀN TỐI CAO.**

---

## 📊 TIẾN ĐỘ TỔNG QUAN 21 GIAI ĐOẠN (PHASE 0 ➔ PHASE 20)

| Giai đoạn    | Nội dung trọng tâm                                                                  |    Trạng thái     | Tiến độ  |
| :----------- | :---------------------------------------------------------------------------------- | :---------------: | :------: |
| **PHASE 0**  | **Workflow Readiness Audit (Đối chiếu 8 chiều & Lập Gap Register)**                 | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 1**  | **Business Rule Catalog (Xây dựng 21 danh mục quy tắc có Rule ID)**                 | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 2**  | **Domain Contracts (Chuẩn hóa 17 Contracts & Tách biệt Quality / Workflow)**        | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 3**  | **State Machines (Đặc tả FSM độc lập: Batch, TestResult, Criterion, Alternate)**    | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 4**  | **Functional Specification V2 (Đặc tả FRS cho 20 Modules nghiệp vụ)**               | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 5**  | **E2E Business Scenarios (Xây dựng 18 Kịch bản Đoạn-Cuối-Đoạn S-001 -> S-018)**     | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 6**  | **Screen Contracts (Xây dựng 25 Hợp đồng màn hình SC-01 -> SC-25)**                 | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 7**  | **Acceptance Criteria (Xây dựng tiêu chí nghiệm thu Gherkin cho 100% Rules)**       | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 8**  | **Traceability Matrix V2 (Ma trận truy xuất nguồn gốc 8 tầng khép kín)**            | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 9**  | **Codebase Conformance Audit (Đối chiếu mã nguồn với toàn bộ Spec)**                | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 10** | **Domain Engine Rebuild (Tái cấu trúc Domain Engine 10 tầng chuẩn mực)**            | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 11** | **Test First (Triển khai Unit, Integration & E2E Tests trước khi sửa UI)**          | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 12** | **Application Services (Chuẩn hóa các dịch vụ điều phối workflow)**                 | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 13** | **PKN Implementation (Triển khai Phiếu kiểm nghiệm không filter mất chỉ tiêu)**     | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 14** | **TCCS Implementation (Triển khai Tiêu chuẩn cơ sở có biểu thị Alternate Rule)**    | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 15** | **CoA Implementation (Triển khai CoA đọc trực tiếp từ Snapshot đã niêm phong)**     | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 16** | **Approval & Release (Triển khai Phê duyệt & 7 Release Gates có ký điện tử)**       | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 17** | **OOS / Deviation / CAPA (Triển khai Điều tra ngoài tiêu chuẩn, Sai lệch & CAPA)**  | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 18** | **Audit / Signature / Security (Chuỗi kiểm toán ALCOA+, Part 11 & Security Rules)** | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 19** | **UI Rebuild (Tái thiết kế giao diện theo Screen Contracts - Presentation Only)**   | ✅ **HOÀN THÀNH** | **100%** |
| **PHASE 20** | **Final Validation (Thẩm định cuối cùng, Build, Deploy Firebase, Backup & Export)** | ✅ **HOÀN THÀNH** | **100%** |

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

## 🔹 PHASE 1: BUSINESS RULE CATALOG (21 CATALOGS) [✅ HOÀN THÀNH]

_Mỗi Business Rule bắt buộc có: Rule ID, Purpose, Actor, Trigger, Input, Preconditions, Decision Logic, Decision Table, Output, State Transition, UI Behavior, Report/CoA Behavior, Audit Requirement, Forbidden Behavior, Exception Handling, Test Cases._

- [x] **Task 1.01**: [`docs/business-rules/MASTER_DATA_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/MASTER_DATA_RULES.md) (BR-MST-001 -> BR-MST-003)
- [x] **Task 1.02**: [`docs/business-rules/PRODUCT_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/PRODUCT_RULES.md) (BR-PRD-001 -> BR-PRD-003)
- [x] **Task 1.03**: [`docs/business-rules/TCCS_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/TCCS_RULES.md) (BR-TCS-001 -> BR-TCS-003)
- [x] **Task 1.04**: [`docs/business-rules/FORMULA_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/FORMULA_RULES.md) (BR-FOR-001 -> BR-FOR-002)
- [x] **Task 1.05**: [`docs/business-rules/RAW_MATERIAL_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/RAW_MATERIAL_RULES.md) (BR-MAT-001 -> BR-MAT-002)
- [x] **Task 1.06**: [`docs/business-rules/BATCH_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/BATCH_RULES.md) (BR-BAT-001 -> BR-BAT-003)
- [x] **Task 1.07**: [`docs/business-rules/TEST_RESULT_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/TEST_RESULT_RULES.md) (BR-TST-001 -> BR-TST-002)
- [x] **Task 1.08**: [`docs/business-rules/QUALITY_EVALUATION_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/QUALITY_EVALUATION_RULES.md) (BR-QEV-001 -> BR-QEV-002)
- [x] **Task 1.09**: [`docs/business-rules/ALTERNATE_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/ALTERNATE_RULES.md) (BR-ALT-001 -> BR-ALT-002)
- [x] **Task 1.10**: [`docs/business-rules/OOS_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/OOS_RULES.md) (BR-OOS-001 -> BR-OOS-002)
- [x] **Task 1.11**: [`docs/business-rules/DEVIATION_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/DEVIATION_RULES.md) (BR-DEV-001 -> BR-DEV-002)
- [x] **Task 1.12**: [`docs/business-rules/CAPA_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/CAPA_RULES.md) (BR-CAP-001 -> BR-CAP-002)
- [x] **Task 1.13**: [`docs/business-rules/APPROVAL_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/APPROVAL_RULES.md) (BR-APP-001 -> BR-APP-002)
- [x] **Task 1.14**: [`docs/business-rules/RELEASE_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/RELEASE_RULES.md) (BR-REL-001 -> BR-REL-002)
- [x] **Task 1.15**: [`docs/business-rules/COA_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/COA_RULES.md) (BR-COA-001 -> BR-COA-002)
- [x] **Task 1.16**: [`docs/business-rules/SIGNATURE_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/SIGNATURE_RULES.md) (BR-SIG-001 -> BR-SIG-002)
- [x] **Task 1.17**: [`docs/business-rules/AUDIT_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/AUDIT_RULES.md) (BR-AUD-001 -> BR-AUD-002)
- [x] **Task 1.18**: [`docs/business-rules/GENEALOGY_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/GENEALOGY_RULES.md) (BR-GEN-001 -> BR-GEN-002)
- [x] **Task 1.19**: [`docs/business-rules/REPORTING_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/REPORTING_RULES.md) (BR-REP-001 -> BR-REP-002)
- [x] **Task 1.20**: [`docs/business-rules/AI_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/AI_RULES.md) (BR-AI-001 -> BR-AI-002)
- [x] **Task 1.21**: [`docs/business-rules/RBAC_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/RBAC_RULES.md) (BR-RBC-001 -> BR-RBC-002)

---

## 🔹 PHASE 2: DOMAIN CONTRACTS (17 CONTRACTS) [✅ HOÀN THÀNH]

_Chuẩn hóa cấu trúc 17 thực thể cốt lõi, tách bạch tuyệt đối Quality Status (`PASS/FAIL/PENDING/UNKNOWN`), Execution State (`NOT_STARTED/REQUIRED/TESTING/COMPLETED/NOT_APPLICABLE/EXEMPTED`), Alternate State và Workflow Status._

- [x] **Task 2.01**: Contract Product, TCCS, Criterion, AlternateRule ([`CRITERION_STATE_CONTRACT.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/CRITERION_STATE_CONTRACT.md), [`ALTERNATE_RULE_CONTRACT.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/ALTERNATE_RULE_CONTRACT.md), [`PRODUCT_TCCS_CONTRACT.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/PRODUCT_TCCS_CONTRACT.md))
- [x] **Task 2.02**: Contract ProductFormula, RawMaterial, Batch ([`FORMULA_MATERIAL_CONTRACT.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/FORMULA_MATERIAL_CONTRACT.md), [`BATCH_GENEALOGY_CONTRACT.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/BATCH_GENEALOGY_CONTRACT.md))
- [x] **Task 2.03**: Contract TestResult, CriterionResult, Evaluation, EvaluationSnapshot ([`TEST_RESULT_CONTRACT.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/TEST_RESULT_CONTRACT.md), [`QUALITY_STATUS_CONTRACT.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/QUALITY_STATUS_CONTRACT.md), [`WORKFLOW_STATUS_CONTRACT.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/WORKFLOW_STATUS_CONTRACT.md), [`COA_SNAPSHOT_CONTRACT.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/COA_SNAPSHOT_CONTRACT.md))
- [x] **Task 2.04**: Contract OOS, Deviation, CAPA, ApprovalTask ([`QMS_INCIDENT_CONTRACT.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/QMS_INCIDENT_CONTRACT.md), [`APPROVAL_CONTRACT.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/APPROVAL_CONTRACT.md))
- [x] **Task 2.05**: Contract ElectronicSignature, AuditRecord, AI Advisory ([`SIGNATURE_AUDIT_CONTRACT.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/SIGNATURE_AUDIT_CONTRACT.md), [`AI_ADVISORY_CONTRACT.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/AI_ADVISORY_CONTRACT.md))
- [x] **Task 2.06**: Tài liệu tổng hợp [`docs/contracts/DATA_CONTRACTS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/DATA_CONTRACTS.md)

---

## 🔹 PHASE 3: STATE MACHINES [✅ HOÀN THÀNH]

_Đặc tả 4 FSM độc lập với đầy đủ: Trigger, Actor, Precondition, Allowed Transitions, Forbidden Transitions, Output, Audit._

- [x] **Task 3.01**: Batch State Machine (`DRAFT -> TESTING -> QA_REVIEW -> APPROVED -> RELEASED` / `TESTING -> REJECTED`) ([`STATE_MACHINES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/STATE_MACHINES.md#1-fsm-1-batch-workflow-finite-state-machine))
- [x] **Task 3.02**: TestResult State Machine (`DRAFT -> SUBMITTED -> FINAL -> APPROVED`) ([`STATE_MACHINES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/STATE_MACHINES.md#2-fsm-2-testresult-workflow-finite-state-machine))
- [x] **Task 3.03**: Criterion State Machine (`NOT_STARTED -> REQUIRED -> TESTING -> PASS / FAIL / PENDING`) ([`STATE_MACHINES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/STATE_MACHINES.md#3-fsm-3-criterion-state-finite-state-machine))
- [x] **Task 3.04**: Alternate Rule State Machine (`NOT_APPLICABLE -> NOT_TRIGGERED -> TRIGGERED_PENDING -> TRIGGERED_PASS / TRIGGERED_FAIL`) ([`STATE_MACHINES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/STATE_MACHINES.md#4-fsm-4-alternate-rule-finite-state-machine))
- [x] **Task 3.05**: Ban hành tài liệu [`docs/contracts/STATE_MACHINES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/STATE_MACHINES.md)

---

## 🔹 PHASE 4: FUNCTIONAL SPECIFICATIONS V2 [✅ HOÀN THÀNH]

_Mỗi Module có FRS riêng: Input, Output, Validation, Business Rules, State, Service, Domain, Permission, Error, Audit, Acceptance Criteria._

- [x] **Task 4.01**: FRS-MOD-01 đến FRS-MOD-05 (Master Data, Product, TCCS, Formula, Raw Material) ([`FRS_01`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_01_MASTER_DATA.md), [`FRS_02`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_02_PRODUCT.md), [`FRS_03`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_03_TCCS.md), [`FRS_04`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_04_FORMULA.md), [`FRS_05`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_05_RAW_MATERIAL.md))
- [x] **Task 4.02**: FRS-MOD-06 đến FRS-MOD-09 (Batch, PKN, Evaluation Engine, Alternate Rules) ([`FRS_06`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_06_BATCH.md), [`FRS_07`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_07_TEST_RESULT.md), [`FRS_08`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_08_QUALITY_EVALUATION.md), [`FRS_09`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_09_ALTERNATE_RULES.md))
- [x] **Task 4.03**: FRS-MOD-10 đến FRS-MOD-15 (OOS, Deviation, CAPA, Approval, Release, CoA) ([`FRS_10`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_10_OOS.md), [`FRS_11`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_11_DEVIATION.md), [`FRS_12`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_12_CAPA.md), [`FRS_13`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_13_APPROVAL_PIPELINE.md), [`FRS_14`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_14_BATCH_RELEASE.md), [`FRS_15`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_15_COA_REPORT.md))
- [x] **Task 4.04**: FRS-MOD-16 đến FRS-MOD-20 (Signature, Audit, Genealogy, Reporting, AI) ([`FRS_16`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_16_SIGNATURE_SECURITY.md), [`FRS_17`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_17_AUDIT_TRAIL.md), [`FRS_18`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_18_GENEALOGY_TRACEABILITY.md), [`FRS_19`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_19_REPORTING_SPC.md), [`FRS_20`](file:///d:/26%20Kiem%20nghiem/PQM/docs/specs/FRS_20_AI_ADVISORY.md))

---

## 🔹 PHASE 5: E2E BUSINESS SCENARIOS (S-001 ➔ S-018) [✅ HOÀN THÀNH]

- [x] **Task 5.01**: S-001 (Happy Path - Batch đạt) & S-002 (Batch không đạt) ([`E2E_BUSINESS_SCENARIOS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/scenarios/E2E_BUSINESS_SCENARIOS.md#s-001-happy-path---lo-san-xuat-dat-chat-luong-hoan-hao))
- [x] **Task 5.02**: S-003 (PKN chưa hoàn tất) & S-004 (Alternate Rule FAIL_RETRY) ([`E2E_BUSINESS_SCENARIOS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/scenarios/E2E_BUSINESS_SCENARIOS.md#s-003-testing-incomplete---lo-chua-hoan-tat-kiem-nghiem))
- [x] **Task 5.03**: S-005 (Alternate Rule CONDITIONAL_CHECK) & S-006 (Alternate Dependency Missing) ([`E2E_BUSINESS_SCENARIOS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/scenarios/E2E_BUSINESS_SCENARIOS.md#s-005-alternate-rule---mien-kiem-co-dieu-kien-conditional_check))
- [x] **Task 5.04**: S-007 (TCCS Version Change) & S-008 (TestResult Approval) ([`E2E_BUSINESS_SCENARIOS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/scenarios/E2E_BUSINESS_SCENARIOS.md#s-007-tccs-version-change--snapshot-immutability))
- [x] **Task 5.05**: S-009 (Batch Release) & S-010 (OOS Investigation) ([`E2E_BUSINESS_SCENARIOS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/scenarios/E2E_BUSINESS_SCENARIOS.md#s-009-batch-release-gates---7-cong-kiem-soat-xuat-xuong))
- [x] **Task 5.06**: S-011 (Deviation) & S-012 (CAPA) ([`E2E_BUSINESS_SCENARIOS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/scenarios/E2E_BUSINESS_SCENARIOS.md#s-011-deviation-management---xu-ly-su-co-sai-lech-quy-trinh))
- [x] **Task 5.07**: S-013 (CoA Generation) & S-014 (Audit Trail) ([`E2E_BUSINESS_SCENARIOS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/scenarios/E2E_BUSINESS_SCENARIOS.md#s-013-immutable-coa-generation--qr-verification))
- [x] **Task 5.08**: S-015 (Electronic Signature) & S-016 (Concurrent Modification) ([`E2E_BUSINESS_SCENARIOS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/scenarios/E2E_BUSINESS_SCENARIOS.md#s-015-21-cfr-part-11-electronic-signature))
- [x] **Task 5.09**: S-017 (Legacy Data) & S-018 (AI Advisory) ([`E2E_BUSINESS_SCENARIOS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/scenarios/E2E_BUSINESS_SCENARIOS.md#s-017-legacy-data-ingestion--sanitation))

---

## 🔹 PHASE 6: SCREEN CONTRACTS (SC-01 ➔ SC-25) [✅ HOÀN THÀNH]

_Đặc tả 25 màn hình: Purpose, Actor, Permission, Data Source, States (Loading, Empty, Error, Normal), Form Fields, Actions, Validation, Business Rules, State Rendering, Navigation, Audit, Forbidden UI Behavior (Cấm UI tự evaluate)._

- [x] **Task 6.01**: SC-01 đến SC-05 (Dashboard, Product List/Detail/Form, TCCS List) ([`SCREEN_CONTRACTS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/SCREEN_CONTRACTS.md#sc-01-bang-dieu-khien-tong-quan-quality-executive-dashboard))
- [x] **Task 6.02**: SC-06 đến SC-10 (TCCS Detail/Form, Formula, Material, Batch List) ([`SCREEN_CONTRACTS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/SCREEN_CONTRACTS.md#sc-06-chi-tiet-tieu-chuan-co-so-tccs-detail--criteria-view))
- [x] **Task 6.03**: SC-11 đến SC-15 (Batch Detail, Batch Form, PKN List, PKN Form/Editor, CoA Report) ([`SCREEN_CONTRACTS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/SCREEN_CONTRACTS.md#sc-11-ho-so-chi-tiet-lo-batch-dossier--360-overview))
- [x] **Task 6.04**: SC-16 đến SC-20 (OOS, Deviation, CAPA, Approval, Audit Log) ([`SCREEN_CONTRACTS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/SCREEN_CONTRACTS.md#sc-16-quan-ly-dieu-tra-ket-qua-ngoai-tieu-chuan-oos-investigation-view))
- [x] **Task 6.05**: SC-21 đến SC-25 (Batch 360, Product 360, Trend Analysis, AI Assistant, System Settings) ([`SCREEN_CONTRACTS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/SCREEN_CONTRACTS.md#sc-21-mang-luoi-pha-he-lo-batch-360-genealogy-graph))

---

## 🔹 PHASE 7: ACCEPTANCE CRITERIA (GHERKIN FORMAT) [✅ HOÀN THÀNH]

- [x] **Task 7.01**: Acceptance Criteria cho Master Data, Product, TCCS, Formula, Material ([`ACCEPTANCE_CRITERIA_MASTER.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/acceptance/ACCEPTANCE_CRITERIA_MASTER.md#1-phan-1-master-data-product-tccs-formula--raw-material-task-701))
- [x] **Task 7.02**: Acceptance Criteria cho Batch, PKN, Evaluation Engine, Alternate Rules ([`ACCEPTANCE_CRITERIA_MASTER.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/acceptance/ACCEPTANCE_CRITERIA_MASTER.md#2-phan-2-batch-pkn-evaluation-engine--alternate-rules-task-702))
- [x] **Task 7.03**: Acceptance Criteria cho OOS, Deviation, CAPA, Approval, Release Gate ([`ACCEPTANCE_CRITERIA_MASTER.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/acceptance/ACCEPTANCE_CRITERIA_MASTER.md#3-phan-3-oos-deviation-capa-approval--release-gates-task-703))
- [x] **Task 7.04**: Acceptance Criteria cho CoA, Signature, Audit, AI Governance ([`ACCEPTANCE_CRITERIA_MASTER.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/acceptance/ACCEPTANCE_CRITERIA_MASTER.md#4-phan-4-coa-signature-audit--ai-governance-task-704))

---

## 🔹 PHASE 8: TRACEABILITY MATRIX V2 [✅ HOÀN THÀNH]

- [x] **Task 8.01**: Ánh xạ 8 chiều: `Business Requirement ➔ Business Rule ➔ Domain Contract ➔ Functional Requirement ➔ Screen Contract ➔ Code ➔ Test ➔ Evidence`
- [x] **Task 8.02**: Ban hành [`docs/traceability/PQM_TRACEABILITY_MATRIX_V2.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/traceability/PQM_TRACEABILITY_MATRIX_V2.md)

---

## 🔹 PHASE 9: CODEBASE CONFORMANCE AUDIT [✅ HOÀN THÀNH]

- [x] **Task 9.01**: Rà soát 9 phân vùng: Domain, Services, Repositories, Hooks, Components, Pages, Reports, Tests, Security Rules.
- [x] **Task 9.02**: Phân loại: `COMPLIANT`, `PARTIAL`, `CONFLICT`, `LEGACY`, `UNUSED`, `DUPLICATED`, `MISSING`.
- [x] **Task 9.03**: Khóa danh mục cần refactor trước khi sửa code ([`CODEBASE_CONFORMANCE_REPORT.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/audit/CODEBASE_CONFORMANCE_REPORT.md)).

---

## 🔹 PHASE 10: DOMAIN ENGINE REBUILD [✅ HOÀN THÀNH]

- [x] **Task 10.01**: Types & Enums (`src/types/batch.ts`, `src/types/testResult.ts`, `src/types/tccs.ts`)
- [x] **Task 10.02**: Validation Layer (`src/domain/validation/validationEngine.ts`)
- [x] **Task 10.03**: State Machines Layer (`src/domain/workflow/stateMachine.ts`, `src/domain/workflow/criterionStateMachine.ts`)
- [x] **Task 10.04**: Business Rules Engines (`src/domain/rules/ReleaseRules.ts` - 7 Release Gates, `BatchRules.ts`, `TestResultRules.ts`)
- [x] **Task 10.05**: Criterion Evaluator & Alternate Rule Evaluator (`src/domain/evaluation/CriterionEvaluator.ts`, `AlternateRuleEvaluator.ts`)
- [x] **Task 10.06**: Quality Evaluation Engine & Evaluation Snapshot Builder (`src/domain/evaluation/QualityEvaluationEngine.ts`, `EvaluationSnapshotBuilder.ts`)
- [x] **Task 10.07**: Canonical Status Resolver (Single Source of Truth: `src/domain/canonical/canonicalResolver.ts`)

---

## 🔹 PHASE 11: TEST FIRST [✅ HOÀN THÀNH]

- [x] **Task 11.01**: Unit Tests cho 100% Business Rules (`tests/unit/businessRules/batchRules.test.ts`, `testResultRules.test.ts`, `tccsRules.test.ts`)
- [x] **Task 11.02**: Integration Tests cho State Machine & Snapshot Engine (`tests/integration/stateMachineSnapshot.test.ts`)
- [x] **Task 11.03**: E2E Automated Tests cho Scenarios S-001 -> S-018 (`tests/scenarios/e2eScenarios.test.ts`)

---

## 🔹 PHASE 12: APPLICATION SERVICES [✅ HOÀN THÀNH]

- [x] **Task 12.01**: Chuẩn hóa `BatchAppService`, `TestResultAppService`, `TCCSAppService` (OCC, Schema snapshotting, SSoT)
- [x] **Task 12.02**: Chuẩn hóa `ApprovalWorkflowService`, `ReleaseService`, `CoAService` (`ReleaseService.ts`, `CoAService.ts`)
- [x] **Task 12.03**: Chuẩn hóa `OOSService`, `DeviationService`, `CAPAService`, `AuditService` (`OOSService.ts`, `CAPAService.ts`)

---

## 🔹 PHASE 13: PKN IMPLEMENTATION [✅ HOÀN THÀNH]

- [x] **Task 13.01**: PKN Editor hiển thị 100% tiêu chí từ TCCS Snapshot (không filter mất chỉ tiêu)
- [x] **Task 13.02**: Badge trực quan: `PASS`, `FAIL`, `PENDING`, `MIỄN KIỂM`, `CHỜ KẾT QUẢ` (`CriteriaInputGroup.test.tsx`)

---

## 🔹 PHASE 14: TCCS IMPLEMENTATION [✅ HOÀN THÀNH]

- [x] **Task 14.01**: TCCS Editor & Detail hiển thị rõ quan hệ `🔗 Có thay thế` / `↳ Phụ thuộc` (`TccsDetailPage.tsx`, `TccsMainCriteriaTable.tsx`)
- [x] **Task 14.02**: Tự động sinh khối "GHI CHÚ QUY TẮC THAY THẾ" chuẩn pháp lý (`tccsWorkflow.test.ts`)

---

## 🔹 PHASE 15: COA IMPLEMENTATION [✅ HOÀN THÀNH]

- [x] **Task 15.01**: CoA đọc 100% từ `EvaluationSnapshot` đã niêm phong, cấm tự evaluate lại (SC-14, BR-COA-001) — Banner DRAFT khi chưa có snapshot
- [x] **Task 15.02**: Sinh Footnote pháp lý tự động cho các chỉ tiêu miễn kiểm/thay thế — Khối Kết luận + 3 Chữ ký + ALCOA+ SHA-256
- [x] **6 tests (TC-COA-015-01 → TC-COA-015-02)**: PASS 100%

---

## 🔹 PHASE 16: APPROVAL & RELEASE GATES [✅ HOÀN THÀNH]

- [x] **Task 16.01**: Pipeline phê duyệt phiếu kiểm nghiệm và ký số 21 CFR Part 11 (`BR-APP-001`, `BR-APP-002`, `FRS-MOD-13`, SoD `ERR_SOD_VIOLATION`, `revokeApproval`, Rejection reason validation)
- [x] **Task 16.02**: Khóa chặt 7 Release Gates (`BR-REL-001` mã lỗi `ERR_*`, `BR-REL-002` `executeBatchHold`, `executeBatchRecall`, BPR Review gate `ERR_BPR_NOT_APPROVED`)
- [x] **29 tests (ApprovalWorkflowService + ReleaseRules + releaseService)**: PASS 100%

---

## 🔹 PHASE 17: OOS / DEVIATION / CAPA [✅ HOÀN THÀNH]

- [x] **Task 17.01**: Quy trình điều tra OOS kích hoạt tự động khi có chỉ tiêu FAIL (`BR-OOS-001`, `OOSService` Phase 1 Lab Investigation & Phase 2 Manufacturing Investigation, khóa Gate 3)
- [x] **Task 17.02**: Luồng liên thông Deviation ➔ CAPA ➔ Quyết định QA (`BR-DEV-001`, `BR-DEV-002`, `BR-CAP-001`, `BR-CAP-002`, `verifyAndCloseCAPA`, closed-loop CAPA)

---

## 🔹 PHASE 18: AUDIT / SIGNATURE / SECURITY [✅ HOÀN THÀNH]

- [x] **Task 18.01**: Khóa chuỗi băm ALCOA+ SHA-256 chống can thiệp (`auditHardeningService.ts`, `verifyAuditChainIntegrity`, cryptographic hash chaining)
- [x] **Task 18.02**: Rào chắn Firebase Rules & Storage Rules đồng bộ với Workflow (`database.rules.json`, `securityRulesValidator.test.ts` 25 tests pass)

---

## 🔹 PHASE 19: UI REBUILD [✅ HOÀN THÀNH]

- [x] **Task 19.01**: Tái cấu trúc 25 màn hình theo đúng Screen Contracts (Presentation Only, SC-01 -> SC-25, Single Source of Truth từ Domain Resolver)
- [x] **Task 19.02**: Chuẩn hóa Design System, micro-animations, loading/empty/error states, dynamic badge `BatchTestingQABadge`

---

## 🔹 PHASE 20: FINAL VALIDATION & RELEASE [✅ HOÀN THÀNH]

- [x] **Task 20.01**: Chạy toàn diện TypeScript (`tsc --noEmit` 0 lỗi), Vitest (138 test files, 1289 tests passed 100%), Architecture Guards
- [x] **Task 20.02**: Build Production, Deploy Firebase Hosting thành công (`https://v-biotech.web.app`), Commit & Push GitHub
- [x] **Task 20.03**: Xuất bản `FULL_SOURCE_CODE.md` & `FULL_SOURCE_CODE.txt` (`npm run export:source`)

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
