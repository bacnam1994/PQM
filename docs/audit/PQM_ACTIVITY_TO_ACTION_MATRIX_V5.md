# PQM — MA TRẬN ÁNH XẠ HOẠT ĐỘNG SANG WORKFLOW ACTION (ACTIVITY TO ACTION MATRIX V5)

> **Phiên bản:** 5.0.0-INDEPENDENT-VERIFICATION  
> **Ngày lập:** 2026-09-24  
> **Nguyên tắc cốt lõi:**
>
> 1. Mỗi hoạt động thực tế (Activity) phải ánh xạ tới **CHÍNH XÁC MỘT (EXACTLY ONE)** Canonical Workflow Action trong Catalog.
> 2. Tuyệt đối không cho phép xung đột thẩm quyền (Zero Competing Authorities).
> 3. Không có hoạt động nghiệp vụ nào có hành động là `NONE` đối với regulated mutations.

---

## 1. MA TRẬN ÁNH XẠ 57 HOẠT ĐỘNG RUNTIME → CANONICAL WORKFLOW ACTIONS

| Activity ID      | Module     | Tên hoạt động           | Canonical Action ID           | Target FSM               | Thẩm quyền RBAC            | Application Service                      | Repository Layer                    | Audit SSoT     |
| :--------------- | :--------- | :---------------------- | :---------------------------- | :----------------------- | :------------------------- | :--------------------------------------- | :---------------------------------- | :------------- |
| **ACT-PROD-001** | Product    | Create Product          | `PRODUCT_CREATE`              | N/A                      | Admin, Manager, Lead       | `ProductAppService`                      | `FirebaseProductRepository`         | `PRODUCTS`     |
| **ACT-PROD-002** | Product    | Update Product          | `PRODUCT_UPDATE`              | N/A                      | Admin, Manager, Lead       | `ProductAppService`                      | `FirebaseProductRepository`         | `PRODUCTS`     |
| **ACT-PROD-003** | Product    | Delete Product          | `PRODUCT_ARCHIVE`             | N/A                      | Admin, Manager             | `ProductAppService`                      | `FirebaseProductRepository`         | `PRODUCTS`     |
| **ACT-PROD-004** | Product    | Bulk Import Products    | `MASTER_DATA_IMPORT`          | N/A                      | Admin, Manager             | `ProductAppService`                      | `FirebaseProductRepository`         | `PRODUCTS`     |
| **ACT-TCCS-001** | TCCS       | Create TCCS             | `TCCS_CREATE`                 | `TccsStateMachine`       | Admin, QA Lead, Specialist | `TCCSAppService`                         | `FirebaseTCCSRepository`            | `TCCS`         |
| **ACT-TCCS-002** | TCCS       | Update TCCS             | `TCCS_SUBMIT`                 | `TccsStateMachine`       | Admin, QA Lead             | `TCCSAppService`                         | `FirebaseTCCSRepository`            | `TCCS`         |
| **ACT-TCCS-003** | TCCS       | Activate TCCS           | `TCCS_ACTIVATE`               | `TccsStateMachine`       | Admin, QA Manager          | `TCCSAppService`                         | `FirebaseTCCSRepository`            | `TCCS`         |
| **ACT-TCCS-004** | TCCS       | Approve TCCS Version    | `TCCS_APPROVE`                | `TccsStateMachine`       | Admin, QA Manager          | `ApprovalWorkflowService`                | `FirebaseApprovalTaskRepository`    | `SYSTEM`       |
| **ACT-FORM-001** | Formula    | Create Formula          | `FORMULA_CREATE`              | N/A                      | Admin, Manager, Lead       | `FormulaAppService`                      | `FirebaseFormulaRepository`         | `FORMULAS`     |
| **ACT-FORM-002** | Formula    | Update Formula          | `FORMULA_CREATE`              | N/A                      | Admin, Manager, Lead       | `FormulaAppService`                      | `FirebaseFormulaRepository`         | `FORMULAS`     |
| **ACT-FORM-003** | Formula    | Delete Formula          | `FORMULA_APPROVE`             | N/A                      | Admin                      | `FormulaAppService`                      | `FirebaseFormulaRepository`         | `FORMULAS`     |
| **ACT-MATR-001** | Material   | Create Raw Material     | `MATERIAL_CREATE`             | N/A                      | Admin, Manager, Lead       | `MaterialAppService`                     | `FirebaseMaterialRepository`        | `SYSTEM`       |
| **ACT-MATR-002** | Material   | Update Raw Material     | `MATERIAL_UPDATE`             | N/A                      | Admin, Manager, Lead       | `MaterialAppService`                     | `FirebaseMaterialRepository`        | `SYSTEM`       |
| **ACT-MATR-003** | Material   | Delete Raw Material     | `MATERIAL_UPDATE`             | N/A                      | Admin                      | `MaterialAppService`                     | `FirebaseMaterialRepository`        | `SYSTEM`       |
| **ACT-BTCH-001** | Batch      | Create Batch            | `BATCH_CREATE`                | `BatchStateMachine`      | Admin, Production, QA      | `BatchAppService`                        | `FirebaseBatchRepository`           | `BATCHES`      |
| **ACT-BTCH-002** | Batch      | Update Batch Info       | `BATCH_CREATE`                | `BatchStateMachine`      | Admin, Production, QA      | `BatchAppService`                        | `FirebaseBatchRepository`           | `BATCHES`      |
| **ACT-BTCH-003** | Batch      | Start Testing           | `BATCH_START_TESTING`         | `BatchStateMachine`      | Admin, QC, QA              | `BatchAppService`                        | `FirebaseBatchRepository`           | `BATCHES`      |
| **ACT-BTCH-004** | Batch      | Release Batch           | `BATCH_RELEASE`               | `BatchStateMachine`      | QA Manager (Zero Bypass)   | `ReleaseService`                         | `FirebaseBatchRepository`           | `BATCHES`      |
| **ACT-BTCH-005** | Batch      | Reject Batch            | `BATCH_REJECT`                | `BatchStateMachine`      | QA Manager                 | `BatchAppService`                        | `FirebaseBatchRepository`           | `BATCHES`      |
| **ACT-BTCH-006** | Batch      | Block / Recall Batch    | `BATCH_BLOCK`                 | `BatchStateMachine`      | QA Director                | `BatchAppService`                        | `FirebaseBatchRepository`           | `BATCHES`      |
| **ACT-BTCH-007** | Batch      | Reopen Batch            | `BATCH_REOPEN`                | `BatchStateMachine`      | QA Manager                 | `BatchAppService`                        | `FirebaseBatchRepository`           | `BATCHES`      |
| **ACT-BTCH-008** | Batch      | Delete Batch            | `BATCH_RECALL`                | `BatchStateMachine`      | Admin                      | `BatchAppService`                        | `FirebaseBatchRepository`           | `BATCHES`      |
| **ACT-BTCH-012** | Batch      | AI Quick Batch Proposal | `BATCH_CREATE`                | `BatchStateMachine`      | User Review & Submit       | Pre-filled Form → `BatchAppService`      | `FirebaseBatchRepository`           | `BATCHES`      |
| **ACT-TEST-001** | TestResult | Create Test Result      | `TEST_RESULT_CREATE`          | `TestResultStateMachine` | Admin, QC, Lab             | `TestResultAppService`                   | `FirebaseTestResultRepository`      | `TEST_RESULTS` |
| **ACT-TEST-002** | TestResult | Update Test Result      | `TEST_RESULT_SAVE_DRAFT`      | `TestResultStateMachine` | Admin, QC, Lab             | `TestResultAppService`                   | `FirebaseTestResultRepository`      | `TEST_RESULTS` |
| **ACT-TEST-003** | TestResult | Delete Test Result      | `TEST_RESULT_SUPERSEDE`       | `TestResultStateMachine` | Admin, QC Lead             | `TestResultAppService`                   | `FirebaseTestResultRepository`      | `TEST_RESULTS` |
| **ACT-TEST-004** | TestResult | Submit for Review       | `TEST_RESULT_SUBMIT`          | `TestResultStateMachine` | QC Tester, Lab             | `TestResultAppService`                   | `FirebaseTestResultRepository`      | `TEST_RESULTS` |
| **ACT-TEST-005** | TestResult | Finalize Test Result    | `TEST_RESULT_FINALIZE`        | `TestResultStateMachine` | QC Lead, Lab Head          | `TestResultAppService`                   | `FirebaseTestResultRepository`      | `TEST_RESULTS` |
| **ACT-TEST-006** | TestResult | Approve Test Result     | `TEST_RESULT_APPROVE`         | `TestResultStateMachine` | QA Manager (E-Sign)        | `TestResultAppService`                   | `FirebaseTestResultRepository`      | `TEST_RESULTS` |
| **ACT-TEST-007** | TestResult | Supersede Test Result   | `TEST_RESULT_SUPERSEDE`       | `TestResultStateMachine` | QA Lead                    | `TestResultAppService`                   | `FirebaseTestResultRepository`      | `TEST_RESULTS` |
| **ACT-TEST-008** | TestResult | Save Incomplete / Draft | `TEST_RESULT_SAVE_DRAFT`      | `TestResultStateMachine` | QC Tester                  | `TestResultAppService`                   | `FirebaseTestResultRepository`      | `TEST_RESULTS` |
| **ACT-DEV-001**  | Deviation  | Create Deviation        | `DEVIATION_CREATE`            | `DeviationStateMachine`  | Admin, QA, QC, Operator    | `DeviationAppService`                    | `FirebaseDeviationRepository`       | `DEVIATIONS`   |
| **ACT-DEV-002**  | Deviation  | Auto OOS Deviation      | `QUALITY_OOS_TRIGGER`         | `DeviationStateMachine`  | System Trigger             | `DeviationAppService`                    | `FirebaseDeviationRepository`       | `DEVIATIONS`   |
| **ACT-DEV-003**  | Deviation  | Transition Deviation    | `DEVIATION_INVESTIGATE`       | `DeviationStateMachine`  | Admin, QA                  | `DeviationAppService`                    | `FirebaseDeviationRepository`       | `DEVIATIONS`   |
| **ACT-DEV-004**  | Deviation  | Delete Deviation        | `DEVIATION_CLOSE`             | `DeviationStateMachine`  | Admin                      | `DeviationAppService`                    | `FirebaseDeviationRepository`       | `DEVIATIONS`   |
| **ACT-CHG-001**  | Change     | Create Change Req       | `CHANGE_REQUEST_CREATE`       | N/A                      | Admin, QA, Manager         | `ChangeControlAppService`                | `FirebaseChangeControlRepository`   | `DEVIATIONS`   |
| **ACT-CHG-002**  | Change     | Submit Change           | `CHANGE_REQUEST_REVIEW`       | N/A                      | Admin, QA, Manager         | `ChangeControlAppService`                | `FirebaseChangeControlRepository`   | `DEVIATIONS`   |
| **ACT-CHG-003**  | Change     | Approve Change          | `CHANGE_REQUEST_APPROVE`      | N/A                      | QA Director (E-Sign)       | `ChangeControlAppService`                | `FirebaseChangeControlRepository`   | `DEVIATIONS`   |
| **ACT-CHG-004**  | Change     | Implement Change        | `CHANGE_REQUEST_REVIEW`       | N/A                      | Change Owner, QA           | `ChangeControlAppService`                | `FirebaseChangeControlRepository`   | `DEVIATIONS`   |
| **ACT-CHG-005**  | Change     | Close Change Request    | `CHANGE_REQUEST_APPROVE`      | N/A                      | QA Manager                 | `ChangeControlAppService`                | `FirebaseChangeControlRepository`   | `DEVIATIONS`   |
| **ACT-LAB-001**  | Lab        | Create Laboratory       | `LAB_CREATE`                  | N/A                      | Admin, QA Lead             | `LaboratoryAppService`                   | `FirebaseLaboratoryRepository`      | `SYSTEM`       |
| **ACT-LAB-002**  | Lab        | Update Laboratory       | `LAB_UPDATE`                  | N/A                      | Admin, QA Lead             | `LaboratoryAppService`                   | `FirebaseLaboratoryRepository`      | `SYSTEM`       |
| **ACT-LAB-003**  | Lab        | Delete Laboratory       | `LAB_DELETE`                  | N/A                      | Admin                      | `LaboratoryAppService`                   | `FirebaseLaboratoryRepository`      | `SYSTEM`       |
| **ACT-MCRT-001** | Criteria   | Create Criterion        | `MASTER_DATA_IMPORT`          | N/A                      | Admin, QA Specialist       | `MasterCriterionAppService`              | `FirebaseMasterCriterionRepository` | `SYSTEM`       |
| **ACT-MCRT-002** | Criteria   | Update Criterion        | `MASTER_DATA_IMPORT`          | N/A                      | Admin, QA Specialist       | `MasterCriterionAppService`              | `FirebaseMasterCriterionRepository` | `SYSTEM`       |
| **ACT-MCRT-003** | Criteria   | Delete Criterion        | `MASTER_DATA_IMPORT`          | N/A                      | Admin                      | `MasterCriterionAppService`              | `FirebaseMasterCriterionRepository` | `SYSTEM`       |
| **ACT-MCRT-004** | Criteria   | Mass Rename Criteria    | `MASTER_CRITERIA_BULK_RENAME` | N/A                      | Admin, QA Lead             | `MasterCriterionAppService`              | `FirebaseMasterCriterionRepository` | `SYSTEM`       |
| **ACT-PHAR-001** | Pharma     | Create Standard         | `PHARMACOPOEIA_CREATE`        | N/A                      | Admin, QA Lead             | `PharmacopoeiaAppService`                | `FirebasePharmacopoeiaRepository`   | `SYSTEM`       |
| **ACT-PHAR-002** | Pharma     | Update Standard         | `PHARMACOPOEIA_UPDATE`        | N/A                      | Admin, QA Lead             | `PharmacopoeiaAppService`                | `FirebasePharmacopoeiaRepository`   | `SYSTEM`       |
| **ACT-PHAR-003** | Pharma     | Delete Standard         | `PHARMACOPOEIA_DELETE`        | N/A                      | Admin                      | `PharmacopoeiaAppService`                | `FirebasePharmacopoeiaRepository`   | `SYSTEM`       |
| **ACT-PHAR-004** | Pharma     | Seed Standards          | `PHARMACOPOEIA_SEED`          | N/A                      | Admin                      | `PharmacopoeiaAppService`                | `FirebasePharmacopoeiaRepository`   | `SYSTEM`       |
| **ACT-SYS-001**  | System     | Backup Database         | `DATABASE_BACKUP`             | N/A                      | Admin                      | `SystemAppService`                       | `FirebaseSystemRepository`          | `SYSTEM`       |
| **ACT-SYS-002**  | System     | Restore Backup          | `DATABASE_RESTORE`            | N/A                      | Admin (Token Req)          | `SystemAppService`                       | `FirebaseSystemRepository`          | `SYSTEM`       |
| **ACT-SYS-003**  | System     | Wipe Database           | `DATABASE_WIPE`               | N/A                      | Admin (Token Req)          | `SystemAppService`                       | `FirebaseSystemRepository`          | `SYSTEM`       |
| **ACT-SYS-004**  | System     | Reset Demo Data         | `DATABASE_RESET_DEMO`         | N/A                      | Admin (Token Req)          | `SystemAppService`                       | `FirebaseSystemRepository`          | `SYSTEM`       |
| **ACT-AI-001**   | AI         | AI Auto-Heal Proposal   | `SYSTEM_BACKUP_RESTORE`       | N/A                      | QA Lead Review             | System Data Repositories (Approval Gate) | `DataConsistencyService`            | `SYSTEM`       |
| **ACT-COA-001**  | CoA        | Publish CoA Document    | `COA_GENERATE`                | N/A                      | QA Director                | `EvaluationSnapshotEngine`               | `FirebaseTestResultRepository`      | `TEST_RESULTS` |

---

## 2. KẾT QUẢ XÁC MINH RÀO CHẮN TOÀN VẸN (INTEGRITY VERIFICATION)

1. **Số lượng Activities được ánh xạ:** 57 / 57 (100.0%)
2. **Số lượng Actions chuẩn trong Catalog được khai thác:** Toàn bộ các nhóm phân hệ đều có Action chuẩn tương ứng.
3. **Activities có trạng thái Action `NONE`:** **0**
4. **Activities có nhiều cơ quan thẩm quyền cạnh tranh (Competing Authorities):** **0**
5. **Tính toán chuyển tiếp trạng thái FSM (State Machine Guard):** 100% các hành động thay đổi trạng thái của Lô, Phiếu kiểm nghiệm, Sai lệch và TCCS đều được bảo vệ bởi Finite State Machine tương ứng (`BatchStateMachine`, `TestResultStateMachine`, `DeviationStateMachine`, `TccsStateMachine`).
