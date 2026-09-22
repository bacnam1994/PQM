# PQM_CODEBASE_CONFORMANCE_AUDIT_V2: Báo Cáo Kiểm Toán Nhất Quán Đặc Tả & Tuân Thủ Mã Nguồn

> **Mã văn kiện:** `AUDIT-CONFORMANCE-V2-FINAL`  
> **Dự án:** Hệ thống Quản lý Chất lượng & Kiểm nghiệm Dược phẩm (PQM)  
> **Cột mốc:** VIBECODE STEP 1 — SPECIFICATION CONSISTENCY + CODEBASE CONFORMANCE AUDIT  
> **Mục tiêu:** Kiểm tra toàn diện 100% tài liệu đặc tả V2 (`docs/`) và đối chiếu với hiện trạng mã nguồn thực tế (`src/`, `tests/`), phát hiện triệt để mọi xung đột (Conflicts), liên kết gãy (Broken References), logic trùng lặp (Duplicated Logic), và thành phần thiếu hụt (Missing Implementation) để làm cơ sở cho STEP 2 (Rebuild Domain Engine).  
> **Quy tắc tuyệt đối:** KHÔNG sửa đổi business logic, KHÔNG refactor mã nguồn trong task này.

---

## A. Executive Summary (Tóm Tắt Báo Cáo Điều Hành)

Toàn bộ hệ thống tài liệu đặc tả V2 gồm **108 tài liệu kỹ thuật** (workflow, business-rules, contracts, functional-specs, screen-contracts, acceptance, scenarios, traceability, audit) và **501 tệp mã nguồn TypeScript/React** (`src/`), cùng **163 tệp kiểm thử tự động** (`tests/`, `src/**/__tests__/`) đã được rà soát, kiểm toán chéo và ánh xạ chi tiết từng dòng.

### Bảng Chỉ Số Đo Lường Tổng Thể:

| Hạng mục đo lường                                           | Số lượng ghi nhận | Ghi chú & Đánh giá rủi ro                                                                                                                                                                                                                                                                   |
| :---------------------------------------------------------- | :---------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Tổng số Specification Documents**                         |      **108**      | Bao gồm `docs/workflow/` (20), `docs/business-rules/` (32), `docs/contracts/` (18), `docs/functional-specs/` (3), `docs/specs/` (20), `docs/screen-contracts/` (5), `docs/acceptance/` (4), `docs/traceability/` (1), `docs/scenarios/` (1), `docs/audit/` (3), `docs/SYSTEM_LOGIC.md` (1). |
| **Tổng số Source Code Files (`src/`)**                      |      **501**      | Bao gồm domain (43), services (81), types (14), hooks (46), pages/components (287), utils/architecture (30).                                                                                                                                                                                |
| **Tổng số Test Files (`src/` & `tests/`)**                  |      **163**      | Gồm 93 unit suites trong `src/`, 42 regression suites trong `src/domain/evaluation/`, 28 test files trong `tests/`.                                                                                                                                                                         |
| **Tổng số Xung đột Đặc tả & Code (Conflicts)**              |      **14**       | Xung đột hệ thống quy tắc thay thế, máy trạng thái Lô và PKN, rào chắn 5 Cổng vs 7 Cổng, và hai hệ thống đánh số màn hình (`SC-xx`).                                                                                                                                                        |
| **Tổng số Logic nghiệp vụ Trùng lặp (Duplicated)**          |       **8**       | Đánh giá chỉ tiêu thay thế ở 3 nơi khác nhau; đánh giá công thức $\pm 20\%$ ở cả component, hook và domain; kiểm tra hoàn tất Lô ở cả hook và service.                                                                                                                                      |
| **Tổng số Triển khai Còn Thiếu (Missing Implementation)**   |      **11**       | Thiếu mã băm chuỗi Cryptographic Hash Chain (`hashChain.ts`), thiếu router cho OOS/CAPA/Approvals, thiếu thuật toán duyệt đồ thị DAG phả hệ, Hardcoded Gate 5 & Gate 6.                                                                                                                     |
| **Tổng số Liên kết Gãy (Broken References)**                |      **42**       | 21 đường dẫn tệp mã nguồn và 21 đường dẫn tệp test được RTM `PQM_TRACEABILITY_MATRIX_V2.md` tuyên bố nhưng hoàn toàn không tồn tại trong repository.                                                                                                                                        |
| **Tổng số Thành phần Cũ Cần Xử Lý (Legacy Implementation)** |      **19**       | Boolean `isPass` can thiệp vào thẩm quyền nghiệp vụ; magic strings (`"Miễn kiểm"`, `"Đạt (theo quy tắc thay thế)"`); Domain phụ thuộc `useUIStore`.                                                                                                                                         |

---

## B. Specification Consistency Matrix (Ma Trận Nhất Quán Giữa Các Tài Liệu Đặc Tả)

Bảng đối chiếu tính nhất quán nội tại giữa các tài liệu đặc tả kỹ thuật trong thư mục `docs/`:

|  STT   | Tài liệu Nguồn (Source)                                   | Tài liệu Đích (Target)                        |        Trạng thái         | Vấn đề phát hiện (Problem)                                                                                                                                                                                                                                                                                                                                                                                                              | Hành động khắc phục bắt buộc (Action)                                                                                                                          |
| :----: | :-------------------------------------------------------- | :-------------------------------------------- | :-----------------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | `docs/traceability/PQM_TRACEABILITY_MATRIX_V2.md`         | `docs/functional-specs/`                      |       `BROKEN_REF`        | Cột `[4]` tham chiếu `FRS_01_MASTER_DATA.md` đến `FRS_20_AI_ADVISORY.md`. Các file này nằm tại `docs/specs/`, trong khi `docs/functional-specs/` chỉ có `PQM_FUNCTIONAL_REQUIREMENTS_V2.md`.                                                                                                                                                                                                                                            | Chuẩn hóa ánh xạ: Chuyển hoặc đồng bộ danh mục FRS vào `docs/functional-specs/` hoặc sửa RTM trỏ chính xác về `docs/specs/`.                                   |
| **2**  | `docs/traceability/PQM_TRACEABILITY_MATRIX_V2.md`         | `src/` (Code Implementation)                  |       `BROKEN_REF`        | Cột `[6]` tham chiếu 18 file không tồn tại: `masterDataService.ts`, `productService.ts`, `tccsService.ts`, `formulaService.ts`, `materialService.ts`, `batchService.ts`, `oosService.ts`, `deviationService.ts`, `capaService.ts`, `approvalWorkflowService.ts`, `releaseService.ts`, `coaService.ts`, `canonicalStatusResolver.ts`, `alternateRulesEngine.ts`, `releaseGates.ts`, `hashChain.ts`, `graphTraversal.ts`, `rbacGuard.ts`. | Cập nhật lại cột `[6]` của RTM trỏ chính xác vào file hiện hữu (`src/services/app/...`, `src/domain/...`). Xóa tuyên bố "100% closure" ảo.                     |
| **3**  | `docs/traceability/PQM_TRACEABILITY_MATRIX_V2.md`         | `tests/` (Automated Tests)                    |       `BROKEN_REF`        | Cột `[7]` liệt kê hàng loạt file test không tồn tại: `src/services/__tests__/masterData.test.ts`, `product.test.ts`, `tccs.test.ts`, `canonicalStatusResolver.test.ts`, `src/domain/__tests__/alternateRulesEngine.test.ts`...                                                                                                                                                                                                          | Cập nhật RTM trỏ vào các file test thực tế đang chạy: `tests/scenarios/e2eScenarios.test.ts`, `src/domain/evaluation/*.test.ts`, `src/services/app/*.test.ts`. |
| **4**  | `docs/acceptance/TRACEABILITY_MATRIX_V2.md`               | `tests/` & `src/`                             |       `BROKEN_REF`        | Liệt kê các mã Test Case giả định dạng `TC-BR-TCCS-002-A`, `TC-BR-ALT-001-A`, `TC-BR-REL-001-A`... Không có bất kỳ test suite nào trong repo sử dụng các ID này.                                                                                                                                                                                                                                                                        | Ánh xạ lại các mã TC giả định sang Test Case Name thực tế trong `tests/unit/businessRules/` và `tests/scenarios/`.                                             |
| **5**  | `docs/business-rules/` (Bộ 10 file `BR_01` -> `BR_10`)    | `docs/business-rules/` (Bộ 21 file lẻ)        | `DUPLICATED` & `CONFLICT` | Tồn tại song song 2 bộ quy tắc: Bộ `BR_01_PRODUCT_RULES.md` ... `BR_10_AUDIT_SECURITY_RULES.md` dùng mã `BR-TCCS-xxx`, `BR-ALT-xxx`, `BR-TR-xxx`. Bộ `TCCS_RULES.md`, `ALTERNATE_RULES.md`... dùng mã `BR-TCS-xxx`, `BR-TST-xxx`. Một bên quy định trạng thái TCCS cũ là `SUPERSEDED`, bên kia quy định `OBSOLETE`.                                                                                                                     | Khóa một bộ duy nhất làm SSoT; thống nhất tiền tố mã luật (Rule IDs) chuẩn quốc tế: `BR-TCS-xxx` hoặc `BR-TCCS-xxx`.                                           |
| **6**  | `docs/screen-contracts/SCREEN_INVENTORY.md`               | `docs/contracts/SCREEN_CONTRACTS.md`          |        `CONFLICT`         | Hai tài liệu dùng 2 bảng mã màn hình khác nhau: Trong `SCREEN_INVENTORY.md`, `SC-10` là Batch Detail, `SC-12` là PKN Editor, `SC-14` là CoA Report. Trong `SCREEN_CONTRACTS.md`, `SC-10` là Batch List, `SC-14` là PKN Editor, `SC-15` là CoA Report.                                                                                                                                                                                   | Hợp nhất mã màn hình: Đồng bộ hóa toàn bộ tài liệu theo danh mục `SCREEN_INVENTORY.md` (SC-01 -> SC-25 chuẩn).                                                 |
| **7**  | `docs/functional-specs/PQM_FUNCTIONAL_REQUIREMENTS_V2.md` | `docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md` |        `CONFLICT`         | `FRS-REL-001` (dòng 85) mô tả: "Hệ thống kiểm tra đồng thời 5 điều kiện an toàn (5 Gates)". Trong khi Master Workflow và `ReleaseRules.ts` quy định chuẩn 7 Release Gates.                                                                                                                                                                                                                                                              | Cập nhật `FRS-REL-001` nâng cấp chuẩn 7 Release Gates đồng bộ với Master Workflow.                                                                             |
| **8**  | `docs/business-rules/BR_06_ALTERNATE_RULES.md`            | `docs/business-rules/ALTERNATE_RULES.md`      |        `CONFLICT`         | `BR_06` (dòng 22) quy định khi Main PASS thì Alt là `EXEMPTED`. `ALTERNATE_RULES.md` (dòng 23) và Master Workflow quy định khi Main PASS thì Alt là `NOT_APPLICABLE`.                                                                                                                                                                                                                                                                   | Chuẩn hóa theo Master Workflow: Main PASS thì Alt phải là `NOT_APPLICABLE` (không áp dụng).                                                                    |
| **9**  | `docs/contracts/STATE_MACHINES.md` (FSM 1 & 2)            | `docs/contracts/QUALITY_STATUS_CONTRACT.md`   |        `COMPLIANT`        | Định nghĩa phân tách rõ ràng giữa Workflow Status (`DRAFT`, `SUBMITTED`, `APPROVED`) và Quality Status (`PASS`, `FAIL`, `PENDING`).                                                                                                                                                                                                                                                                                                     | Duy trì làm thước đo chuẩn để kiểm toán mã nguồn.                                                                                                              |
| **10** | `docs/contracts/CRITERION_STATE_CONTRACT.md`              | `docs/contracts/QUALITY_STATUS_CONTRACT.md`   |         `PARTIAL`         | `CRITERION_STATE_CONTRACT` định nghĩa `CriterionExecutionState` gồm 6 trạng thái. Nhưng `QUALITY_STATUS_CONTRACT` lại gom một số trạng thái thực thi vào đánh giá chất lượng.                                                                                                                                                                                                                                                           | Tách bạch tuyệt đối: Execution State (Tiến độ thực nghiệm) và Canonical Quality Status (Kết luận dược điển).                                                   |

---

## C. Code Conformance Matrix (Ma Trận Tuân Thủ Giữa Đặc Tả Và Mã Nguồn)

Bảng đối chiếu từng phân hệ Business Rule với Hợp đồng Miền (Contracts), Mã nguồn thực tế (`src/`), Kiểm thử tự động (`tests/`) và Đánh giá tuân thủ:

| Phân hệ Nghiệp vụ                         | Business Rule                                                | Domain Contract                                              | Hiện trạng Mã nguồn (`src/`)                                                                                                                                           | Kiểm thử Tự động (`tests/`)                                                                                            |         Đánh giá          | Chi tiết Vấn đề & Ghi chú                                                                                                                                                                                                                                      |
| :---------------------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- | :-----------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Master Data & Thiết bị**             | `BR-MST-001`<br>`BR-MST-002`                                 | `DATA_CONTRACTS.md`                                          | `src/types/masterData.ts`<br>`src/services/laboratoryService.ts`                                                                                                       | `src/services/laboratoryService.test.ts`                                                                               |         `PARTIAL`         | Chưa có `MasterDataService` tập trung; danh mục thiết bị kiểm nghiệm chưa có bảng cấu hình riêng.                                                                                                                                                              |
| **2. Danh mục Sản phẩm**                  | `BR-PRD-001`<br>`BR-PRD-002`                                 | `PRODUCT_TCCS_CONTRACT.md`                                   | `src/types/product.ts`<br>`src/services/app/ProductAppService.ts`                                                                                                      | `src/services/app/ProductAppService.test.ts`                                                                           |        `COMPLIANT`        | Schema và Service tuân thủ tốt. Mã sản phẩm và dạng bào chế được chuẩn hóa.                                                                                                                                                                                    |
| **3. Tiêu chuẩn Cơ sở (TCCS)**            | `BR-TCS-001`<br>`BR-TCS-002`<br>`BR-TCS-003`                 | `PRODUCT_TCCS_CONTRACT.md`<br>`CRITERION_STATE_CONTRACT.md`  | `src/types/tccs.ts`<br>`src/services/app/TCCSAppService.ts`<br>`src/domain/rules/TCCSRules.ts`                                                                         | `tests/unit/businessRules/tccsRules.test.ts`<br>`src/services/app/TCCSAppService.test.ts`                              |         `PARTIAL`         | `Criterion.id` chưa được enforce triệt để ở UI form; một số hàm vẫn lookup theo `name` tiếng Việt thay vì UUID.                                                                                                                                                |
| **4. Công thức Sản phẩm (BOM)**           | `BR-FOR-001`<br>`BR-FOR-002`                                 | `FORMULA_MATERIAL_CONTRACT.md`                               | `src/types/product.ts` (`ProductFormula`)<br>`src/services/app/FormulaAppService.ts`                                                                                   | `src/services/app/FormulaAppService.test.ts`                                                                           |         `PARTIAL`         | Chưa tách file `src/types/formula.ts`. Logic tính $\pm 20\%$ bị duplicate ở nhiều nơi ngoài domain.                                                                                                                                                            |
| **5. Nguyên vật liệu & Kho**              | `BR-MAT-001`<br>`BR-MAT-002`                                 | `FORMULA_MATERIAL_CONTRACT.md`                               | `src/types/masterData.ts`<br>`src/services/app/MaterialAppService.ts`                                                                                                  | `src/services/app/MaterialAppService.test.ts`                                                                          |         `PARTIAL`         | Chưa tách `src/types/rawMaterial.ts`. Quản lý hạn retest chưa tích hợp cảnh báo vào State Machine.                                                                                                                                                             |
| **6. Hồ sơ Lô Sản phẩm (Batch)**          | `BR-BAT-001`<br>`BR-BAT-002`<br>`BR-BAT-003`                 | `BATCH_GENEALOGY_CONTRACT.md`<br>`STATE_MACHINES.md (FSM 1)` | `src/types/batch.ts`<br>`src/services/app/BatchAppService.ts`<br>`src/domain/rules/BatchRules.ts`<br>`src/domain/workflow/stateMachine.ts`                             | `tests/unit/businessRules/batchRules.test.ts`<br>`tests/domain/batchWorkflowRegression.test.ts`                        |        `CONFLICT`         | `BatchStateMachine` trong code chỉ có 5 trạng thái (`PENDING`, `TESTING`, `RELEASED`, `REJECTED`, `BLOCKED`), thiếu `DRAFT`, `IN_PRODUCTION`, `QA_REVIEW`, `APPROVED`, `HOLD`, `RECALLED` của FSM 1. ADMIN được bypass mọi trạng thái.                         |
| **7. Phiếu Kiểm Nghiệm (PKN)**            | `BR-TST-001`<br>`BR-TST-002`                                 | `TEST_RESULT_CONTRACT.md`<br>`STATE_MACHINES.md (FSM 2)`     | `src/types/testResult.ts`<br>`src/services/testResultService.ts`<br>`src/services/app/TestResultAppService.ts`<br>`src/domain/test-result/testResultStatusResolver.ts` | `tests/unit/businessRules/testResultRules.test.ts`<br>`src/services/app/TestResultAppService.test.ts`                  |        `CONFLICT`         | `TestResultStateMachine` trong code dùng `TestResultStatus` (`PENDING`, `PASS`, `FAIL`, `INVALID`, `SUPERSEDED`) — nhầm lẫn kết quả chất lượng (`PASS`/`FAIL`) làm trạng thái quy trình tài liệu.                                                              |
| **8. Đánh giá Chất lượng chuẩn tắc**      | `BR-QEV-001`<br>`BR-QEV-002`<br>`BR-QEV-003`                 | `QUALITY_STATUS_CONTRACT.md`<br>`STATE_MACHINES.md (FSM 3)`  | `src/domain/canonical/canonicalResolver.ts`<br>`src/domain/evaluation/QualityEvaluationEngine.ts`<br>`src/domain/evaluation/OverallResultEvaluator.ts`                 | `src/domain/evaluation/QualityEvaluationEngine.parity.test.ts`<br>`src/domain/canonical/canonicalArchitecture.test.ts` |         `PARTIAL`         | `QualityEvaluationEngine` import `useUIStore` (Domain phụ thuộc UI). `OverallResultEvaluator` vẫn dựa vào boolean `isPass === false`.                                                                                                                          |
| **9. Quy tắc Thay thế (Alternate Rules)** | `BR-ALT-001`<br>`BR-ALT-002`<br>`BR-ALT-003`<br>`BR-ALT-004` | `ALTERNATE_RULE_CONTRACT.md`<br>`STATE_MACHINES.md (FSM 4)`  | `src/domain/evaluation/AlternateRuleResolver.ts`<br>`src/domain/evaluation/AlternateRuleEvaluator.ts`<br>`src/hooks/test-results/useTestResultSave.ts`                 | `src/domain/evaluation/AlternateRuleResolver.test.ts`<br>`tests/e2e/e2eWorkflowScenarios.test.ts`                      | `CONFLICT` & `DUPLICATED` | Tồn tại 2 evaluator song song trong domain + 1 logic tự viết lại trong hook `useTestResultSave.ts`. `AlternateRuleEvaluator` ép kết quả rỗng thành `FAIL` thay vì `PENDING`. `AlternateRuleResolver` trả về `EXEMPTED` thay vì `NOT_APPLICABLE` khi Main PASS. |
| **10. Điều tra OOS (2 Giai đoạn)**        | `BR-OOS-001`<br>`BR-OOS-002`                                 | `QMS_INCIDENT_CONTRACT.md`                                   | `src/services/app/OOSService.ts`<br>`src/services/ai/oosInvestigationService.ts`                                                                                       | `tests/unit/services/oosCapaService.test.ts`                                                                           |         `PARTIAL`         | Không có bảng lưu trữ riêng và router riêng cho OOS; dữ liệu OOS đang ký sinh trong `QualityDeviation`. Header file tham chiếu tài liệu không tồn tại.                                                                                                         |
| **11. Sai lệch (Deviation - ICH Q9)**     | `BR-DEV-001`<br>`BR-DEV-002`                                 | `QMS_INCIDENT_CONTRACT.md`                                   | `src/types/deviation.ts`<br>`src/services/app/DeviationAppService.ts`                                                                                                  | `src/services/app/DeviationAppService.test.ts`<br>`src/pages/quality/deviations/deviationWorkflow.test.ts`             |        `COMPLIANT`        | Quản lý quy trình điều tra sai lệch, phân loại rủi ro Major/Critical và liên kết Lô đạt chuẩn.                                                                                                                                                                 |
| **12. Hành động CAPA khép kín**           | `BR-CAP-001`<br>`BR-CAP-002`                                 | `QMS_INCIDENT_CONTRACT.md`                                   | `src/services/app/CAPAService.ts`                                                                                                                                      | `tests/unit/services/oosCapaService.test.ts`                                                                           |         `PARTIAL`         | CAPA chưa có collection độc lập, ký sinh trong `deviation.capaActions`. Chưa có Effectiveness Check định kỳ sau 3-6 tháng theo ICH Q10.                                                                                                                        |
| **13. Đường ống Phê duyệt đa cấp**        | `BR-APP-001`<br>`BR-APP-002`                                 | `APPROVAL_CONTRACT.md`                                       | `src/types/approvalWorkflow.ts`<br>`src/services/app/ApprovalWorkflowService.ts`                                                                                       | `src/services/app/ApprovalWorkflowService.test.ts`                                                                     |         `PARTIAL`         | Service có rào chắn Segregation of Duties (SoD) tốt. Tuy nhiên chưa có màn hình router `/approvals` trong `App.tsx` như trong Screen Contract.                                                                                                                 |
| **14. 7 Cổng Kiểm Soát Xuất Xưởng**       | `BR-REL-001`<br>`BR-REL-002`                                 | `BATCH_GENEALOGY_CONTRACT.md`<br>`STATE_MACHINES.md (FSM 1)` | `src/domain/rules/ReleaseRules.ts`<br>`src/services/app/ReleaseService.ts`                                                                                             | `tests/unit/services/releaseService.test.ts`<br>`src/domain/rules/ReleaseRules.test.ts`                                |        `CONFLICT`         | Gate 5 (CAPA Containment) bị hardcode `true`. Gate 6 (BPR Review) tự động pass nếu thiếu dữ liệu. FRS-REL-001 ghi 5 cổng trong khi code và Master Workflow là 7 cổng.                                                                                          |
| **15. Phiếu CoA & Evaluation Snapshot**   | `BR-COA-001`<br>`BR-COA-002`                                 | `COA_SNAPSHOT_CONTRACT.md`                                   | `src/services/app/CoAService.ts`<br>`src/components/features/CoAReport.tsx`                                                                                            | `tests/unit/components/coaReport.test.ts`<br>`tests/unit/services/coaService.test.ts`                                  |        `CONFLICT`         | `CoAReport.tsx` hoàn toàn **KHÔNG ĐỌC** từ `batch.evaluationSnapshot`. Component tự tính lại công thức $\pm 20\%$, tự gọi `calculateOverallStatus()`, tự tính `isComplete` on-the-fly.                                                                         |
| **16. Chữ ký số 21 CFR Part 11**          | `BR-SIG-001`<br>`BR-SIG-002`                                 | `SIGNATURE_AUDIT_CONTRACT.md`                                | `src/types/signature.ts`<br>`src/services/signatureService.ts`                                                                                                         | `src/services/signatureService.test.ts`                                                                                |         `PARTIAL`         | Xác thực 2 yếu tố (mật khẩu) và kiểm tra role tốt. Thuật toán băm có đoạn fallback string đơn giản không chuẩn mật mã học (`sig-hash-...`).                                                                                                                    |
| **17. Nhật ký ALCOA+ & Hash Chain**       | `BR-AUD-001`<br>`BR-AUD-002`                                 | `SIGNATURE_AUDIT_CONTRACT.md`                                | `src/services/auditService.ts`                                                                                                                                         | `src/services/auditService.test.ts`<br>`src/services/auditHardeningService.test.ts`                                    |         `MISSING`         | Hoàn toàn chưa có cơ chế nối chuỗi mã băm Cryptographic Hash Chain (`previousHash -> hash`). Dữ liệu ghi vào Firebase RTDB bằng `push()` không có chữ ký niêm phong. File `src/utils/hashChain.ts` hoàn toàn không tồn tại.                                    |
| **18. Phả hệ Lô 2 chiều (DAG)**           | `BR-GEN-001`<br>`BR-GEN-002`                                 | `BATCH_GENEALOGY_CONTRACT.md`                                | `src/pages/batches/batch-360/components/BatchGenealogyTree.tsx`<br>`src/services/ai/batchGenealogyService.ts`                                                          | `src/pages/batches/batch-360/batchGenealogy.test.ts`                                                                   |         `PARTIAL`         | Chỉ hiển thị cây phả hệ đơn giản bằng UI tree và AI summary. Chưa có `src/services/genealogyService.ts` và thuật toán duyệt đồ thị Directed Acyclic Graph (DAG) `src/utils/graphTraversal.ts`.                                                                 |
| **19. Báo cáo PQR & SPC Shewhart**        | `BR-REP-001`<br>`BR-REP-002`                                 | `DATA_CONTRACTS.md`                                          | `src/utils/spcEngine.ts`<br>`src/pages/quality/trend/utils/spcHelpers.ts`<br>`src/pages/quality/summary-report/`                                                       | `src/utils/spcEngine.test.ts`<br>`src/pages/quality/trend/utils/spcHelpers.test.ts`                                    |        `COMPLIANT`        | Động cơ tính SPC, Shewhart, Cpk hoạt động chính xác, có kiểm thử đầy đủ. Tuy nhiên file không nằm tại `src/services/spcAnalysisService.ts` như RTM mô tả.                                                                                                      |
| **20. Trợ lý AI & Rào chắn Dược**         | `BR-AI-001`<br>`BR-AI-002`                                   | `AI_ADVISORY_CONTRACT.md`                                    | `src/services/ai/AIGateway.ts`<br>`src/services/ai/aiGovernanceService.ts`<br>`src/utils/aiMapping.ts`                                                                 | `src/services/ai/aiGovernanceService.test.ts`<br>`src/utils/aiMapping.test.ts`                                         |        `COMPLIANT`        | Rào chắn `isCriteriaMatch` và Governance Service ngăn chặn AI can thiệp vào thẩm quyền quyết định PASS/FAIL rất xuất sắc.                                                                                                                                      |
| **21. Phân quyền RBAC & SoD Guard**       | `BR-RBC-001`<br>`BR-RBC-002`                                 | `APPROVAL_CONTRACT.md`                                       | `src/services/permissionService.ts`<br>`src/store/slices/authSlice.ts`<br>`src/types/permissions.ts`                                                                   | `src/services/permissionService.test.ts`                                                                               |        `COMPLIANT`        | Hệ thống quyền hạn hạt nhân (granular permissions), ma trận vai trò QA/QC/Production/Admin tuân thủ tốt. Tuy nhiên file không nằm tại `src/security/rbacGuard.ts` như RTM mô tả.                                                                               |

---

## D. Critical Conflicts (Danh Mục Các Xung Đột Nghiêm Trọng)

### 1. CONFLICT-01: Xung Đột Trạng Thái Máy Trạng Thái Lô Sản Xuất (Batch FSM)

- **Rule ID liên quan:** `BR-BAT-002`, `BR-REL-001`
- **Tài liệu Đặc tả:** `docs/contracts/STATE_MACHINES.md` (FSM 1, dòng 18-26):
  Đặc tả 9 trạng thái: `DRAFT`, `IN_PRODUCTION`, `TESTING`, `QA_REVIEW`, `APPROVED`, `RELEASED`, `REJECTED`, `HOLD`, `RECALLED`.
  Quy tắc chuyển dịch: `TESTING -> QA_REVIEW -> APPROVED -> RELEASED`.
- **Hiện trạng Mã nguồn:** `src/domain/workflow/stateMachine.ts` (dòng 59-65) & `src/types/batch.ts` (dòng 14):
  Chỉ có 5 trạng thái: `PENDING`, `TESTING`, `RELEASED`, `REJECTED`, `BLOCKED`.
- **Hành vi Kỳ vọng (Expected Behavior):** Lô sau khi kiểm nghiệm xong 100% chỉ tiêu chuyển sang `QA_REVIEW`. QA thẩm tra xong chuyển `APPROVED`. Đủ 7 Gates mới chuyển `RELEASED`.
- **Hành vi Thực tế (Actual Behavior):** Lô nhảy thẳng từ `TESTING` sang `RELEASED`. Ngoài ra, hàm `getValidNextStates` (dòng 91-96) cho phép `ADMIN` nhảy sang bất kỳ trạng thái nào, phá vỡ toàn bộ rào chắn GMP.
- **Mức độ nghiêm trọng (Severity):** 🔴 **CRITICAL (GAMP 5 Category 4/5 Non-Conformance)**
- **Yêu cầu sửa đổi (Required Fix):** Cập nhật `BatchWorkflowStatus` và `BatchStateMachine` bổ sung đầy đủ 9 trạng thái chuẩn FSM 1; loại bỏ hoàn toàn cơ chế Admin tự do bypass workflow.

---

### 2. CONFLICT-02: Nhầm Lẫn Kết Quả Kỹ Thuật Làm Trạng Thái Vòng Đời Phiếu Kiểm Nghiệm (TestResult FSM)

- **Rule ID liên quan:** `BR-TST-001`, `BR-TST-002`
- **Tài liệu Đặc tả:** `docs/contracts/STATE_MACHINES.md` (FSM 2, dòng 75-80) & `docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md`:
  Workflow Status của Phiếu: `DRAFT -> SUBMITTED -> REVIEWED -> APPROVED -> REVOKED` (+ `REJECTED`).
  Bất biến: "APPROVED != PASS, RELEASED != PASS, REJECTED != FAIL".
- **Hiện trạng Mã nguồn:** `src/domain/workflow/stateMachine.ts` (dòng 297-300) & `src/domain/canonical/canonicalStatus.ts`:
  `TestResultStateMachine` sử dụng các trạng thái: `PENDING`, `PASS`, `FAIL`, `INVALID`, `SUPERSEDED`.
- **Hành vi Kỳ vọng (Expected Behavior):** Phiếu kiểm nghiệm được nộp (`SUBMITTED`), thẩm tra (`REVIEWED`), và phê duyệt (`APPROVED`) như một hồ sơ tài liệu, bất kể chất lượng bên trong là PASS hay FAIL (phiếu FAIL vẫn được Approved và lưu hồ sơ OOS).
- **Hành vi Thực tế (Actual Behavior):** Code dùng `PASS` và `FAIL` làm State Machine Transition cho Phiếu, làm mất khả năng phê duyệt một phiếu có kết quả kiểm nghiệm Không Đạt.
- **Mức độ nghiêm trọng (Severity):** 🔴 **CRITICAL**
- **Yêu cầu sửa đổi (Required Fix):** Tách bạch triệt để `TestResultWorkflowStatus` (`DRAFT`, `SUBMITTED`, `REVIEWED`, `APPROVED`, `REJECTED`) khỏi `CanonicalQualityStatus` (`PASS`, `FAIL`, `PENDING`).

---

### 3. CONFLICT-03: Vi Phạm Nguyên Tắc Bất Biến CoA — Client Component Tự Đánh Giá Lại Business Rule

- **Rule ID liên quan:** `BR-COA-001`, `BR-ALT-004`, `FRS-COA-001`
- **Tài liệu Đặc tả:** `docs/contracts/COA_SNAPSHOT_CONTRACT.md` & `docs/functional-specs/PQM_FUNCTIONAL_REQUIREMENTS_V2.md` (dòng 88-92):
  "Màn hình xem và in CoA chỉ đọc dữ liệu từ `batch.evaluationSnapshot`. Cấm mọi hành vi tính toán lại hoặc nội suy ở client".
- **Hiện trạng Mã nguồn:** `src/components/features/CoAReport.tsx` (dòng 435-490):
  Component chứa hook `conclusion = useMemo(...)` tự tính lại:
  1. Tự tính dải chấp nhận công thức: `min = basis * 0.8; max = basis * 1.2; isPass = actualVal >= min && actualVal <= max`.
  2. Tự gọi hàm `calculateOverallStatus(effectiveResults, tccs)`.
  3. Tự kiểm tra tính đầy đủ: `isComplete = mandatoryCriteria.every(...)`.
- **Hành vi Kỳ vọng (Expected Behavior):** `CoAReport.tsx` chỉ hiển thị các giá trị `isPass`, `overallQualityStatus`, và `footnotes` đã được đóng băng trong `EvaluationSnapshot`.
- **Hành vi Thực tế (Actual Behavior):** Giao diện in ấn tự re-evaluate dữ liệu; nếu logic client đổi hoặc dữ liệu nền đổi, bản in hôm nay sẽ khác bản in ngày mai dù lô không đổi (vi phạm Data Integrity ALCOA+).
- **Mức độ nghiêm trọng (Severity):** 🔴 **CRITICAL (Data Integrity Violation)**
- **Yêu cầu sửa đổi (Required Fix):** Tái cấu trúc `CoAReport.tsx` thành Pure Presentation Component, tiêu thụ 100% dữ liệu từ `EvaluationSnapshotContract`.

---

### 4. CONFLICT-04: Xung Đột Logic Alternate Rule Khi Chỉ Tiêu Phụ Chưa Có Kết Quả (Missing Dependent Result)

- **Rule ID liên quan:** `BR-ALT-001`
- **Tài liệu Đặc tả:** `docs/business-rules/ALTERNATE_RULES.md` (dòng 27-31) & Yêu cầu Audit Mục 4:
  `main FAIL + dependent missing → PENDING`.
  "Tuyệt đối cấm kết luận FAIL toàn phiếu khi chỉ tiêu chính FAIL nhưng chỉ tiêu phụ chưa có kết quả (phải bảo lưu PENDING)".
- **Hiện trạng Mã nguồn:** `src/domain/evaluation/AlternateRuleEvaluator.ts` (dòng 37-39):
  ```typescript
  if (altValue === undefined || altValue === null || String(altValue).trim() === '') {
    return { isPass: false, usedAlternate: false };
  }
  ```
- **Hành vi Kỳ vọng (Expected Behavior):** Động cơ trả về trạng thái `TRIGGERED_PENDING` và kết luận tổng thể của cụm là `PENDING`.
- **Hành vi Thực tế (Actual Behavior):** `AlternateRuleEvaluator` lập tức trả về `isPass: false` (FAIL), vô hiệu hóa quyền được thử nghiệm lại của kiểm nghiệm viên.
- **Mức độ nghiêm trọng (Severity):** 🔴 **CRITICAL (Logic Inversion)**
- **Yêu cầu sửa đổi (Required Fix):** Hợp nhất `AlternateRuleEvaluator` và `AlternateRuleResolver` thành một Single Engine duy nhất, xử lý chuẩn xác trạng thái `PENDING`.

---

### 5. CONFLICT-05: Sai Khác Trạng Thái Khi Main PASS Trong FAIL_RETRY (`EXEMPTED` vs `NOT_APPLICABLE`)

- **Rule ID liên quan:** `BR-ALT-001`, `CRITERION_STATE_CONTRACT.md`
- **Tài liệu Đặc tả:** Master Specification & `ALTERNATE_RULES.md` (dòng 23):
  `main PASS → dependent NOT_APPLICABLE`.
- **Hiện trạng Mã nguồn:** `src/domain/evaluation/AlternateRuleResolver.ts` (dòng 255) & `docs/business-rules/BR_06_ALTERNATE_RULES.md` (dòng 22):
  Gán `alternateState: 'EXEMPTED'`.
- **Hành vi Kỳ vọng (Expected Behavior):** Chỉ tiêu phụ của phép thử lặp lại (ví dụ Độ rã lần 2) không được áp dụng (`NOT_APPLICABLE`) vì phép thử lần 1 đã đạt; thuật ngữ `EXEMPTED` chỉ dành cho phép thử có điều kiện được miễn trừ (như Arsen vô cơ khi Arsen tổng số đạt an toàn).
- **Hành vi Thực tế (Actual Behavior):** Gán nhãn lẫn lộn giữa Miễn kiểm (`EXEMPTED`) và Không áp dụng (`NOT_APPLICABLE`).
- **Mức độ nghiêm trọng (Severity):** 🟠 **MAJOR**
- **Yêu cầu sửa đổi (Required Fix):** Chuẩn hóa enum trạng thái: `FAIL_RETRY` khi Main PASS -> `NOT_APPLICABLE`; `CONDITIONAL_CHECK` khi Condition False -> `EXEMPTED`.

---

### 6. CONFLICT-06: Xung Đột Hệ Thống Đánh Số Màn Giao Diện (`SC-xx`)

- **Tài liệu Đặc tả 1:** `docs/screen-contracts/SCREEN_INVENTORY.md` & `SC_10`, `SC_12`, `SC_14`:
  `SC-09` = Batch List, `SC-10` = Batch Detail, `SC-11` = PKN List, `SC-12` = PKN Editor, `SC-14` = CoA Report.
- **Tài liệu Đặc tả 2:** `docs/contracts/SCREEN_CONTRACTS.md` & `docs/traceability/PQM_TRACEABILITY_MATRIX_V2.md`:
  `SC-10` = Batch List, `SC-11` = Batch Detail, `SC-13` = PKN List, `SC-14` = PKN Editor, `SC-15` = CoA Report.
- **Hậu quả:** Gây nhầm lẫn nghiêm trọng khi triển khai: Khi tham chiếu `SC-14`, một tài liệu hiểu là CoA Report, tài liệu khác hiểu là PKN Editor.
- **Mức độ nghiêm trọng (Severity):** 🟠 **MAJOR**
- **Yêu cầu sửa đổi (Required Fix):** Thống nhất toàn hệ thống dùng bảng phân bổ chính thức của `docs/screen-contracts/SCREEN_INVENTORY.md`.

---

### 7. CONFLICT-07: Rào Chắn Xuất Xưởng Lô (5 Gates vs 7 Gates) & Hardcoded Gates Trong Code

- **Rule ID liên quan:** `BR-REL-001`, `FRS-REL-001`
- **Tài liệu Đặc tả:** `PQM_FUNCTIONAL_REQUIREMENTS_V2.md` mô tả 5 điều kiện an toàn (5 Gates). `PQM_SYSTEM_WORKFLOW_MASTER.md` và `ReleaseRules.ts` quy định 7 Release Gates.
- **Hiện trạng Mã nguồn:** `src/domain/rules/ReleaseRules.ts` (dòng 168-172):
  Gate 5 (CAPA Containment) bị hardcode: `const gate5Passed = true;`.
  Gate 6 (BPR Review) bị fallback tự động pass: `const bprApproved = ... : batch.status === 'TESTING' || batch.status === 'PENDING';`.
- **Hành vi Kỳ vọng (Expected Behavior):** Toàn bộ 7 Gates phải kiểm tra dữ liệu thực tế từ cơ sở dữ liệu (Gate 5 phải query CAPA mở, Gate 6 phải có bản ghi ký duyệt BPR).
- **Mức độ nghiêm trọng (Severity):** 🔴 **CRITICAL (GMP Release Gate Bypass)**
- **Yêu cầu sửa đổi (Required Fix):** Bỏ hardcode tại Gate 5 và Gate 6; cập nhật FRS-REL-001 thành 7 Gates đồng bộ với Master Workflow.

---

## E. Duplicate Business Logic (Danh Sách Logic Nghiệp Vụ Bị Trùng Lặp)

Các vị trí phát hiện hiện tượng trùng lặp logic đánh giá, vi phạm nguyên tắc Single Source of Truth (SSoT):

1. **Đánh giá Chỉ tiêu Thay thế (Alternate Rules Evaluation) — 3 NƠI TRÙNG LẶP:**
   - Vị trí 1: `src/domain/evaluation/AlternateRuleResolver.ts` (Class giải quyết trạng thái và tạo badge UI).
   - Vị trí 2: `src/domain/evaluation/AlternateRuleEvaluator.ts` (Class đánh giá trả về `{ isPass, usedAlternate }`).
   - Vị trí 3: `src/hooks/test-results/useTestResultSave.ts` (dòng 279-322: Tự viết vòng lặp kiểm tra `rulesMap`, gọi `evaluateCriterionSmart`, so sánh số `extractNum`).
   - _Hậu quả:_ Sửa logic ở một nơi sẽ gây phân mảnh và lỗi lệch kết quả giữa UI và Domain.

2. **Đánh giá Công thức Sản phẩm Dải Chấp Nhận $\pm 20\%$ — 3 NƠI TRÙNG LẶP:**
   - Vị trí 1: `src/components/features/CoAReport.tsx` (dòng 461-464: `isPass = actualVal >= min && actualVal <= max`).
   - Vị trí 2: `src/hooks/test-results/useTestResultSave.ts` (dòng 189-191: `isPass = actualVal >= basis * 0.8 && actualVal <= basis * 1.2`).
   - Vị trí 3: `src/utils/basisCalculation.ts` / `src/utils/testResultEvaluation.ts`.
   - _Hậu quả:_ Rủi ro sai số làm tròn số học và không đồng nhất kết quả giữa màn hình nhập và bản in CoA.

3. **Tính toán Tiến độ Hoàn thành Kiểm nghiệm Lô (% Completion) — 3 NƠI TRÙNG LẶP:**
   - Vị trí 1: `src/domain/canonical/canonicalResolver.ts` (`completion.percentage`).
   - Vị trí 2: `src/domain/evaluation/OverallResultEvaluator.ts` (`calculateCompletionStatus`).
   - Vị trí 3: `src/hooks/test-results/useTestResultSave.ts` (dòng 336-337: `newProgressPercent = Math.round((cumulativeCompleted / cumulativeTotal) * 100)`).
   - _Hậu quả:_ Xung đột số % hiển thị ở Badge danh sách lô và số % trong báo cáo thẩm định.

4. **Đánh giá Đạt/Không đạt Từng Chỉ tiêu (Criterion Range Evaluation) — 2 NƠI TRÙNG LẶP:**
   - Vị trí 1: `src/domain/evaluation/CriterionEvaluator.ts`.
   - Vị trí 2: `src/utils/criteriaEvaluation.ts` (Facade giữ lại các hàm cũ).

---

## F. Legacy Code Register (Danh Mục Mã Nguồn Cũ Cần Xử Lý)

Phân loại mã nguồn hiện tại theo 5 nhóm hành động: `KEEP`, `REFACTOR`, `REPLACE`, `DELETE`, `VERIFY`:

| Tệp / Thư mục Mã nguồn                               | Nhãn Phân Loại | Lý do & Kế hoạch xử lý tại Bước Rebuild Domain Engine                                                              |
| :--------------------------------------------------- | :------------: | :----------------------------------------------------------------------------------------------------------------- |
| `src/domain/canonical/canonicalResolver.ts`          |  **REFACTOR**  | Giữ lại cấu trúc cốt lõi, nâng cấp hỗ trợ đầy đủ 9 trạng thái Batch FSM và 6 trạng thái Quality Status chuẩn tắc.  |
| `src/domain/canonical/canonicalStatus.ts`            |  **REFACTOR**  | Đồng bộ hóa lại các enum `BatchWorkflowStatus`, `TestResultWorkflowStatus`, `CanonicalQualityStatus`.              |
| `src/domain/evaluation/QualityEvaluationEngine.ts`   |  **REFACTOR**  | Gỡ bỏ import `useUIStore` và phụ thuộc `window`; biến thành Pure Domain Facade độc lập với UI.                     |
| `src/domain/evaluation/AlternateRuleResolver.ts`     |  **REFACTOR**  | Hợp nhất logic từ `AlternateRuleEvaluator.ts`; sửa trả về `NOT_APPLICABLE` khi Main PASS; loại bỏ magic strings.   |
| `src/domain/evaluation/AlternateRuleEvaluator.ts`    |  **REPLACE**   | Thay thế và gộp hoàn toàn vào `AlternateRuleResolver.ts`; xóa bỏ logic ép rỗng thành FAIL.                         |
| `src/domain/evaluation/OverallResultEvaluator.ts`    |  **REFACTOR**  | Loại bỏ phụ thuộc vào boolean `isPass === false`; chuyển sang duyệt theo `CriterionQualityStatus`.                 |
| `src/domain/evaluation/EvaluationSnapshotBuilder.ts` |    **KEEP**    | Hàm xây dựng snapshot mã băm SHA-256 hoạt động rất chuẩn mực; giữ nguyên làm nền tảng ALCOA+.                      |
| `src/domain/rules/ReleaseRules.ts`                   |  **REFACTOR**  | Loại bỏ hardcode `true` tại Gate 5 và Gate 6; kết nối dữ liệu thực tế từ QMS Services.                             |
| `src/domain/workflow/stateMachine.ts`                |  **REPLACE**   | Thay thế `BatchStateMachine` và `TestResultStateMachine` để tuân thủ 100% FSM 1 & FSM 2 trong `STATE_MACHINES.md`. |
| `src/domain/workflow/criterionStateMachine.ts`       |    **KEEP**    | Logic chuyển dịch trạng thái cấp chỉ tiêu rất tốt; giữ nguyên.                                                     |
| `src/utils/criteriaEvaluation.ts`                    |   **DELETE**   | Legacy facade cũ; chuyển toàn bộ caller sang import trực tiếp từ `src/domain/evaluation/`.                         |
| `src/utils/testResultEvaluation.ts`                  |   **DELETE**   | Legacy facade cũ; chuyển toàn bộ caller sang Domain Engine.                                                        |
| `src/hooks/test-results/useTestResultSave.ts`        |  **REFACTOR**  | Gỡ bỏ toàn bộ logic tự tính completion % và alternate rules; chỉ gọi Application Service / Domain Engine.          |
| `src/components/features/CoAReport.tsx`              |  **REFACTOR**  | Xóa sạch `conclusion = useMemo(...)`, xóa logic tự tính $\pm 20\%$; chỉ đọc từ `evaluationSnapshot`.               |
| `src/services/app/OOSService.ts`                     |  **REFACTOR**  | Sửa header comment; chuẩn bị tách OOS thành Entity độc lập thay vì ký sinh trong Deviation.                        |
| `src/services/app/CAPAService.ts`                    |  **REFACTOR**  | Sửa header comment; chuẩn bị tích hợp Effectiveness Review sau 3-6 tháng.                                          |
| `src/services/signatureService.ts`                   |  **REFACTOR**  | Xóa fallback băm đơn giản (`sig-hash-...`); dùng chuẩn Canonical JSON Web Crypto SHA-256.                          |
| `src/services/auditService.ts`                       |  **REFACTOR**  | Bổ sung thuật toán nối chuỗi mã băm Cryptographic Hash Chain (`previousHash`).                                     |
| `src/services/permissionService.ts`                  |    **KEEP**    | Hệ thống RBAC và SoD kiểm tra quyền rất chặt chẽ; tiếp tục duy trì.                                                |
| `src/utils/aiMapping.ts`                             |    **KEEP**    | Rào chắn `isCriteriaMatch` phân định định tính / định lượng cực kỳ hiệu quả; giữ nguyên.                           |
| `src/utils/spcEngine.ts`                             |    **KEEP**    | Thuật toán tính toán thống kê và 8 quy tắc Nelson hoạt động chính xác; giữ nguyên.                                 |

---

## G. Missing Implementation (Danh Mục Các Thành Phần Chưa Được Triển Khai)

Các chức năng và hợp đồng đã được quy định trong Đặc tả V2 nhưng hoàn toàn chưa có trong mã nguồn:

1. **Mã băm chuỗi Cryptographic Hash Chain (`src/utils/hashChain.ts`):**
   - _Đặc tả:_ `docs/contracts/SIGNATURE_AUDIT_CONTRACT.md` & `BR-AUD-001`.
   - _Hiện trạng:_ File hoàn toàn chưa tồn tại; `auditService.ts` chỉ thực hiện `push()` bản ghi đơn thuần lên RTDB mà không nối `previousHash`.
2. **Dịch vụ Quản lý Phả hệ và Thuật toán Duyệt Đồ thị DAG (`src/utils/graphTraversal.ts` & `src/services/genealogyService.ts`):**
   - _Đặc tả:_ `docs/contracts/BATCH_GENEALOGY_CONTRACT.md` & `BR-GEN-001`.
   - _Hiện trạng:_ File chưa tồn tại; phả hệ hiện tại chỉ render đơn giản bằng cây giao diện mà không có động cơ kiểm tra chu trình (Cycle Detection).
3. **Thực thể và Bộ lưu trữ OOS Độc lập (`src/types/oos.ts` & Collection `oos_investigations/`):**
   - _Đặc tả:_ `docs/contracts/QMS_INCIDENT_CONTRACT.md` & `BR-OOS-001`.
   - _Hiện trạng:_ Đang lưu lẫn trong `QualityDeviation` với `sourceType = 'OOS'`.
4. **Thực thể và Bộ lưu trữ CAPA Độc lập (`src/types/capa.ts` & Collection `capa_plans/`):**
   - _Đặc tả:_ `docs/contracts/QMS_INCIDENT_CONTRACT.md` & `BR-CAP-001`.
   - _Hiện trạng:_ Đang lưu dưới dạng mảng con `capaActions` bên trong tài liệu Deviation.
5. **Định tuyến Giao diện Màn hình Thiếu trong `src/App.tsx`:**
   - Tuyến `/oos` (SC-15): Chưa có route độc lập.
   - Tuyến `/capa` (SC-17): Chưa có route độc lập.
   - Tuyến `/approvals` (SC-18): Chưa có route độc lập cho Trung tâm phê duyệt tập trung.
   - Tuyến `/signatures` (SC-19): Chưa có route tra cứu lịch sử chữ ký số.
   - Tuyến `/ai-copilot` (SC-23): Chưa có route toàn màn hình.
6. **Kiểm tra Dữ liệu Thực tế cho Gate 5 & Gate 6 trong Release Service:**
   - Gate 5: Cần kiểm tra bảng CAPA để đảm bảo không còn hành động khẩn cấp nào chưa xong.
   - Gate 6: Cần kiểm tra trường `bprReviewStatus === 'APPROVED'` từ hồ sơ sản xuất điện tử.

---

## H. Rebuild Dependency Graph (Đồ Thị Phụ Thuộc Tái Thiết Kế Domain Engine)

Để thực hiện **STEP 2 — DOMAIN ENGINE REBUILD** mà không làm đứt gãy hệ thống và bảo đảm 100% test pass, thứ tự thi công bắt buộc phải tuân theo Đồ thị Phụ thuộc Phẳng (Strict Layered Dependency Order):

```text
[TẦNG 1: TYPES & SCHEMAS]
   1. src/types/testResult.ts (CanonicalQualityStatus: PASS | FAIL | PENDING | NOT_APPLICABLE | EXEMPTED | NOT_EXECUTED)
   2. src/types/batch.ts (BatchWorkflowStatus: DRAFT | IN_PRODUCTION | TESTING | QA_REVIEW | APPROVED | RELEASED | REJECTED | HOLD | RECALLED)
   3. src/types/approvalWorkflow.ts & src/types/signature.ts
   4. src/types/oos.ts & src/types/capa.ts (Tách độc lập)
           ↓
[TẦNG 2: MATHEMATICAL NORMALIZATION & VALIDATION]
   5. src/domain/evaluation/ValueNormalizer.ts (Số học, dấu thập phân, ND, POS)
   6. src/domain/evaluation/SpecificationParser.ts (Phân tích cú pháp tiêu chuẩn Dược)
   7. src/domain/validation/validationEngine.ts
           ↓
[TẦNG 3: STATE MACHINES (FSM)]
   8. src/domain/workflow/criterionStateMachine.ts (CriterionExecutionState & AlternateCriterionState)
   9. src/domain/workflow/stateMachine.ts (BatchStateMachine 9 trạng thái & TestResultStateMachine 5 trạng thái tài liệu)
           ↓
[TẦNG 4: CRITERION EVALUATOR]
   10. src/domain/evaluation/CriterionEvaluator.ts (Đánh giá chỉ tiêu đơn lẻ: Định lượng, Định tính, Giới hạn, Vi sinh)
           ↓
[TẦNG 5: UNIFIED ALTERNATE RULE ENGINE]
   11. src/domain/evaluation/AlternateRuleResolver.ts (Hợp nhất: FAIL_RETRY & CONDITIONAL_CHECK, SSoT độc quyền)
           ↓
[TẦNG 6: OVERALL QUALITY EVALUATION ENGINE]
   12. src/domain/evaluation/OverallResultEvaluator.ts (Thẩm định tổng thể toàn phiếu, bảo toàn PENDING khi thiếu kết quả phụ)
   13. src/domain/evaluation/QualityEvaluationEngine.ts (Domain Facade độc lập, loại bỏ hoàn toàn useUIStore)
           ↓
[TẦNG 7: CANONICAL STATUS RESOLVER & RELEASE GATES]
   14. src/domain/canonical/canonicalResolver.ts (Phân giải chất lượng Lô, Multi-Lab Authoritative Selection)
   15. src/domain/rules/ReleaseRules.ts (7 Release Gates độc lập, không hardcode)
           ↓
[TẦNG 8: CRYPTOGRAPHIC SNAPSHOTS & AUDIT HARDENING]
   16. src/domain/evaluation/EvaluationSnapshotBuilder.ts (Mã băm SHA-256 niêm phong bất biến)
   17. src/utils/hashChain.ts (Nối chuỗi mã băm ALCOA+)
           ↓
[TẦNG 9: APPLICATION SERVICES]
   18. src/services/app/TestResultAppService.ts & BatchAppService.ts
   19. src/services/app/ReleaseService.ts & ApprovalWorkflowService.ts
   20. src/services/app/CoAService.ts, OOSService.ts, CAPAService.ts
           ↓
[TẦNG 10: PRESENTATION & UI HOOKS]
   21. src/hooks/test-results/useTestResultSave.ts & useTestResultForm.ts (Gỡ bỏ business logic)
   22. src/components/features/CoAReport.tsx (Chỉ đọc từ EvaluationSnapshot)
   23. Đồng bộ hóa Route trong src/App.tsx theo Screen Inventory V2
```

---

## I. Kết Luận & Khuyến Nghị Cho Bước Tiếp Theo

1. Toàn bộ mã nguồn PQM đã có nền tảng giải thuật rất mạnh (đặc biệt là `EvaluationSnapshotBuilder`, `isCriteriaMatch` guard và bộ regression test suites).
2. Tuy nhiên, tình trạng **xung đột trạng thái (FSM)**, **trùng lặp logic đánh giá giữa Domain - Hook - Component**, và **RTM chứa các broken references giả định** cần được chuẩn hóa triệt để.
3. Báo cáo này chính thức hoàn tất mục tiêu kiểm toán của **VIBECODE STEP 1**.
4. Dự án sẵn sàng chuyển giao sang **STEP 2 — DOMAIN ENGINE REBUILD** theo đúng Đồ thị Phụ thuộc đã xác lập ở Mục H.
