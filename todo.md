# KẾ HOẠCH HÀNH ĐỘNG TOÀN DIỆN TÁI CẤU TRÚC PQM (TODO.MD)

> **Mục tiêu**: Thiết lập hệ thống đặc tả 5 tầng (Level 0 - Level 5) chuẩn mực cho PQM, xóa bỏ hoàn toàn hiện tượng code đi trước đặc tả, giải quyết triệt để các xung đột logic (chỉ tiêu thay thế, status resolver, data snapshot...) và tái cấu trúc hệ thống một cách có kỷ luật.

---

## 📊 TIẾN ĐỘ TỔNG QUAN

| Giai đoạn       | Nội dung trọng tâm                                                 |    Trạng thái     | Tiến độ  |
| :-------------- | :----------------------------------------------------------------- | :---------------: | :------: |
| **Giai đoạn A** | **Tái lập Đặc tả & Chuẩn mực (Phase 0 – Phase 6)**                 | ✅ **HOÀN THÀNH** | **100%** |
| **Giai đoạn B** | **Tái kiến trúc Implementation & Core Engine (Phase 7 – Phase 9)** |  ⏳ **SẴN SÀNG**  |    0%    |
| **Giai đoạn C** | **Tái cấu trúc Giao diện UI/UX & Polish (Phase 10)**               |      ⏳ Chờ       |    0%    |

---

## 📜 QUY TẮC BẤT BIẾN (IMMUTABLE RULES)

1. ⛔ **AI KHÔNG ĐƯỢC VIẾT CODE NẾU BUSINESS WORKFLOW & SPEC CHƯA ĐƯỢC ĐẶC TẢ.**
2. ⛔ **AI KHÔNG ĐƯỢC TỰ SUY DIỄN BUSINESS RULE TỪ CODE CŨ.**
3. ⛔ **CODE LÀ BƯỚC CUỐI, KHÔNG PHẢI BƯỚC ĐẦU.**
4. 📋 Luồng bắt buộc: `QUESTION / AUDIT` ➔ `WORKFLOW` ➔ `BUSINESS RULE` ➔ `CONTRACT` ➔ `ACCEPTANCE CRITERIA` ➔ `IMPLEMENT` ➔ `TEST`.

---

# GIAI ĐOẠN A: TÁI LẬP ĐẶC TẢ & CHUẨN MỰC HỆ THỐNG [HOÀN THÀNH 100%]

## 🔹 Phase 0: Workflow Audit & Phân Tích Khoảng Trống (Gap Register) [HOÀN THÀNH 100%]

- [x] **Task 0.1**: Khảo sát toàn diện `PQM_SYSTEM_WORKFLOW_MASTER.md` hiện tại và đối chiếu với codebase thực tế.
- [x] **Task 0.2**: Lập danh mục xung đột / vùng xám / lỗi triển khai: `docs/workflow/WORKFLOW_GAP_REGISTER.md`.
  - Phân loại rõ: `MISSING`, `CONFLICT`, `AMBIGUOUS`, `IMPLEMENTED_WRONG`, `LEGACY`.
- [x] **Task 0.3**: Xây dựng kiến trúc khung `docs/workflow/PQM_WORKFLOW_V2_BLUEPRINT.md`.
- [x] **Task 0.4**: Thiết lập cấu trúc thư mục tài liệu đặc tả:
  - `docs/business-rules/`
  - `docs/contracts/`
  - `docs/functional-specs/`
  - `docs/screen-contracts/`
  - `docs/acceptance/`

---

## 🔹 Phase 1: Rebuild Business Workflow theo 20 Phân Hệ Nghiệp Vụ [HOÀN THÀNH 100%]

_(Viết tài liệu quy trình thực thi chuẩn: Actor, Trigger, Precondition, Steps, Decision, State, Output, Exception, Audit)_

- [x] **Task 1.01**: Module 01 - Master Data & Organization Workflow (`docs/workflows/MOD_01_MASTER_DATA_WORKFLOW.md`)
- [x] **Task 1.02**: Module 02 - Product Workflow (`docs/workflows/MOD_02_PRODUCT_WORKFLOW.md`)
- [x] **Task 1.03**: Module 03 - TCCS Workflow (`docs/workflows/MOD_03_TCCS_WORKFLOW.md`)
- [x] **Task 1.04**: Module 04 - Formula Workflow (`docs/workflows/MOD_04_FORMULA_WORKFLOW.md`)
- [x] **Task 1.05**: Module 05 - Raw Material Workflow (`docs/workflows/MOD_05_RAW_MATERIAL_WORKFLOW.md`)
- [x] **Task 1.06**: Module 06 - Batch Workflow (`docs/workflows/MOD_06_BATCH_WORKFLOW.md`)
- [x] **Task 1.07**: Module 07 - Test Result / PKN Workflow (`docs/workflows/MOD_07_TEST_RESULT_WORKFLOW.md`)
- [x] **Task 1.08**: Module 08 - Quality Evaluation Engine Workflow (`docs/workflows/MOD_08_QUALITY_EVALUATION_WORKFLOW.md`)
- [x] **Task 1.09**: Module 09 - Alternate Rules Workflow (`docs/workflows/MOD_09_ALTERNATE_RULES_WORKFLOW.md`)
- [x] **Task 1.10**: Module 10 - OOS / Out-Of-Specification Workflow (`docs/workflows/MOD_10_OOS_WORKFLOW.md`)
- [x] **Task 1.11**: Module 11 - Deviation Workflow (`docs/workflows/MOD_11_DEVIATION_WORKFLOW.md`)
- [x] **Task 1.12**: Module 12 - CAPA Workflow (`docs/workflows/MOD_12_CAPA_WORKFLOW.md`)
- [x] **Task 1.13**: Module 13 - Approval Workflow (`docs/workflows/MOD_13_APPROVAL_WORKFLOW.md`)
- [x] **Task 1.14**: Module 14 - Release Workflow (`docs/workflows/MOD_14_RELEASE_WORKFLOW.md`)
- [x] **Task 1.15**: Module 15 - CoA Workflow (`docs/workflows/MOD_15_COA_WORKFLOW.md`)
- [x] **Task 1.16**: Module 16 - Electronic Signature Workflow (`docs/workflows/MOD_16_ESIGNATURE_WORKFLOW.md`)
- [x] **Task 1.17**: Module 17 - Audit Trail Workflow (`docs/workflows/MOD_17_AUDIT_WORKFLOW.md`)
- [x] **Task 1.18**: Module 18 - Genealogy / Traceability Workflow (`docs/workflows/MOD_18_GENEALOGY_WORKFLOW.md`)
- [x] **Task 1.19**: Module 19 - Reporting & Analytics Workflow (`docs/workflows/MOD_19_REPORTING_WORKFLOW.md`)
- [x] **Task 1.20**: Module 20 - AI Assistant Workflow (`docs/workflows/MOD_20_AI_WORKFLOW.md`)

---

## 🔹 Phase 2: Xây Dựng Business Rule Catalog (`docs/business-rules/`) [HOÀN THÀNH 100%]

_(Đặc tả chi tiết từng quy tắc: Rule ID, Trigger, Input, Precondition, Condition, Decision, Output, Transition, UI Behavior, Report, Exception, Test Cases)_

- [x] **Task 2.1**: `BR_01_PRODUCT_RULES.md` (Quy tắc Sản phẩm & Mã sản phẩm: BR-PRD-001, BR-PRD-002, BR-PRD-003)
- [x] **Task 2.2**: `BR_02_TCCS_RULES.md` (Quy tắc Tiêu chuẩn, Phiên bản, Kế thừa, Hiệu lực: BR-TCCS-001, BR-TCCS-002, BR-TCCS-003, BR-TCCS-004)
- [x] **Task 2.3**: `BR_03_BATCH_RULES.md` (Quy tắc Lô, Khóa dữ liệu, Quá hạn: BR-BAT-001, BR-BAT-002, BR-BAT-003)
- [x] **Task 2.4**: `BR_04_TEST_RESULT_RULES.md` (Quy tắc Phiếu kiểm nghiệm, Quyền nhập, Điều kiện nộp: BR-TR-001, BR-TR-002, BR-TR-003)
- [x] **Task 2.5**: `BR_05_QUALITY_EVALUATION_RULES.md` (Quy tắc Đánh giá Đạt/Không Đạt, No Implicit Pass/Fail: BR-QEV-001, BR-QEV-002, BR-QEV-003, BR-QEV-004)
- [x] **Task 2.6**: `BR_06_ALTERNATE_RULES.md` (Quy tắc Chỉ tiêu Thay thế: BR-ALT-001 FAIL_RETRY, BR-ALT-002 CONDITIONAL, BR-ALT-003 No Filtering, BR-ALT-004 CoA Footnote)
- [x] **Task 2.7**: `BR_07_OOS_DEVIATION_RULES.md` (Quy tắc Xử lý Ngoài tiêu chuẩn & Sai lệch: BR-OOS-001, BR-OOS-002)
- [x] **Task 2.8**: `BR_08_APPROVAL_RELEASE_RULES.md` (Quy tắc Phê duyệt, Release Gate, Bất khả xâm phạm: BR-REL-001, BR-APP-001, BR-APP-002)
- [x] **Task 2.9**: `BR_09_COA_REPORT_RULES.md` (Quy tắc Hiển thị CoA, Không được tính toán lại, Lấy từ Snapshot: BR-COA-001, BR-COA-002, BR-COA-003)
- [x] **Task 2.10**: `BR_10_AUDIT_SECURITY_RULES.md` (Quy tắc Ghi nhật ký kiểm toán, RBAC, Data Integrity: BR-AUD-001, BR-AUD-002, BR-SEC-001)

---

## 🔹 Phase 3: Xây Dựng Domain Contracts & State Machines (`docs/contracts/`) [HOÀN THÀNH 100%]

- [x] **Task 3.1**: `STATE_MACHINES.md`:
  - Batch State Machine
  - TestResult State Machine
  - **CriterionResult State Machine** (NOT_STARTED ➔ REQUIRED ➔ TESTING ➔ PASS / FAIL / PENDING / NOT_APPLICABLE / EXEMPTED)
  - **AlternateRule State Machine** (NOT_APPLICABLE ➔ NOT_TRIGGERED ➔ TRIGGERED_PENDING ➔ TRIGGERED_PASS ➔ TRIGGERED_FAIL)
  - OOS / CAPA State Machine
- [x] **Task 3.2**: `DATA_CONTRACTS.md`:
  - Criterion Entity & Specifications Schema (Bắt buộc `id` bất biến)
  - AlternateRule Entity Schema (Cấu trúc `StructuredCondition` có toán tử)
  - CriterionResult / TestResultEntry Entity Schema
  - EvaluationSnapshot Contract (Bất biến, SHA-256 Hash, Versioning)
  - Batch & TestResult Canonical Schema
- [x] **Task 3.3**: `SERVICE_CONTRACTS.md` (Giao diện chuẩn giữa Core Engine, Persistence, và UI).

---

## 🔹 Phase 4: Xây Dựng Functional Requirements Specification (FRS V2) [HOÀN THÀNH 100%]

- [x] **Task 4.1**: Chuẩn hóa toàn bộ `PQM_FUNCTIONAL_REQUIREMENTS_V2.md` ánh xạ trực tiếp từ Business Rule.
- [x] **Task 4.2**: Lập danh sách Kịch bản End-to-End (`docs/functional-specs/E2E_SCENARIOS.md`):
  - Scenario S-001: Luồng chuẩn Lô đạt (Happy Pass flow)
  - Scenario S-002: Chỉ tiêu chính FAIL ➔ Kích hoạt chỉ tiêu thay thế Đạt (FAIL_RETRY)
  - Scenario S-003: Chỉ tiêu thay thế thiếu kết quả ➔ PENDING, chặn Submit và chặn Release
  - Scenario S-004: OOS Flow & CAPA điều tra (Confirmed OOS ➔ Lô REJECTED)
  - Scenario S-005: Phong tỏa khẩn cấp Lô sau xuất xưởng (Emergency Recall)
  - Scenario S-006: Xuất CoA từ Snapshot bất biến và đối chiếu mã QR công khai

---

## 🔹 Phase 5: Xây Dựng Screen Contracts (`docs/screen-contracts/`) [HOÀN THÀNH 100%]

- [x] **Task 5.1**: `SCREEN_INVENTORY.md` — Lập danh mục định danh 25 màn hình PQM.
- [x] **Task 5.2**: Xây dựng UI Behavior Contract cho từng màn hình trọng yếu:
  - `SC_12_PKN_EDITOR_CONTRACT.md` (Quy tắc cấm filter, hiển thị Alternate Badge, bảo toàn số 0)
  - `SC_14_COA_REPORT_CONTRACT.md` (Đọc độc quyền từ Snapshot, cấm tính toán lại, footnote tự động)
  - `SC_10_BATCH_DETAIL_CONTRACT.md` (Widget 5 đèn Release Gate, nút Ký lệnh xuất xưởng, nút Phong tỏa)

---

## 🔹 Phase 6: Acceptance Criteria & Traceability Matrix (`docs/acceptance/`) [HOÀN THÀNH 100%]

- [x] **Task 6.1**: Xây dựng bộ tiêu chí nghiệm thu Gherkin: `ACCEPTANCE_CRITERIA.md` (AC-ALT-001 đến 005, AC-REL-001 đến 002, AC-COA-001).
- [x] **Task 6.2**: Lập Ma trận Truy xuất Nguồn gốc Chức năng: `TRACEABILITY_MATRIX_V2.md`
      _(Business Requirement ➔ Business Rule ➔ FRS ➔ Domain Contract ➔ State Machine ➔ UI Screen ➔ Test Case)_.

---

# GIAI ĐOẠN B: TÁI KIẾN TRÚC IMPLEMENTATION & CORE ENGINE

## 🔹 Phase 7: Hiện Thực Hóa Domain Engine & Resolvers (Không dính UI)

- [x] **Task 7.1**: Triển khai Domain Types & Enums chuẩn xác theo `DATA_CONTRACTS.md`.
- [x] **Task 7.2**: Hiện thực hóa State Machine Engine cấp Criterion và AlternateRule.
- [x] **Task 7.3**: Hoàn thiện Business Rule Engine & Canonical Quality Evaluation Engine.
- [x] **Task 7.4**: Chuẩn hóa Evaluation Snapshot Service (Đóng băng dữ liệu, tạo Hash).
- [x] **Task 7.5**: Tái cấu trúc Application Services (BatchService, TestResultService, CoaService).

---

## 🔹 Phase 8: Bộ Kiểm Thử Đa Tầng Toàn Diện (Testing the Workflow)

- [x] **Task 8.1**: Bộ Unit Test cho từng Business Rule (100% test cases trong BR Catalog).
- [x] **Task 8.2**: Bộ Integration Test cho State Machine & Snapshot Engine.
- [x] **Task 8.3**: Bộ E2E Automated Test (Playwright / Vitest Scenario S-001 ➔ S-006).

---

## 🔹 Phase 9: Workflow ↔ Code Audit & Verification

- [x] **Task 9.1**: Audit chéo 100% giữa Business Rules và Implementation Code.
- [x] **Task 9.2**: Xác nhận không còn bất kỳ bypass, implicit pass, hoặc UI calculation nào.
- [x] **Task 9.3**: Đóng băng Core Domain & Engine.

---

# GIAI ĐOẠN C: TÁI CẤU TRÚC GIAO DIỆN UI/UX

## 🔹 Phase 10: Tái Thiết Toàn Diện UI Theo Screen Contracts

- [x] **Task 10.1**: Tái cấu trúc TCCS Editor (quản lý chỉ tiêu, alternate rules UX mượt mà).
- [x] **Task 10.2**: Tái cấu trúc PKN Editor (tuân thủ 100% Screen Contract, hiển thị minh bạch mọi chỉ tiêu).
- [x] **Task 10.3**: Chuẩn hóa Màn hình Xem/In CoA (lấy trực tiếp từ snapshot, không tính lại).
- [x] **Task 10.4**: Tái thiết kế Batch Detail, Dashboard, OOS, Approval.
- [x] **Task 10.5**: Hoàn thiện Visual Hierarchy, Animations, Responsive & Design System.
- [x] **Task 10.6**: Build, Deploy Firebase, Push GitHub & Export `FULL_SOURCE_CODE.md`.
- [x] **Task 10.7**: Render Dynamic QA Badge (Nhãn động hỗ trợ QA: "Đã kiểm xong - Chờ QA duyệt" màu xanh dương bên cạnh chữ `TESTING` khi `percentage === 100` và `batchQualityStatus === 'PASS'`, giữ nguyên status DB là `TESTING`).
