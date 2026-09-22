# PQM_TRACEABILITY_MATRIX_V2: Ma Trận Truy Xuất Nguồn Gốc 8 Chiều Chuẩn Mực GAMP 5

Tài liệu này thiết lập Ma Trận Truy Xuất Nguồn Gốc (Requirements Traceability Matrix - RTM) 8 Chiều khép kín từ Yêu cầu Nghiệp vụ Dược phẩm (Business Requirements) đến Quy tắc (Business Rules), Hợp đồng Miền (Domain Contracts), Đặc tả Chức năng (FRS), Giao diện (Screen Contracts), Mã nguồn (Source Code), Kiểm thử Tự động (Automated Tests) và Kịch bản Nghiệm thu (Scenarios / Evidence) theo chuẩn GAMP 5 và FDA 21 CFR Part 11.

---

## 1. Nguyên Tắc Cốt Lõi Của Ma Trận 8 Chiều

```text
[1] Business Requirement
      ↓
[2] Business Rule (BR-xxx)
      ↓
[3] Domain Contract (docs/contracts/)
      ↓
[4] Functional Spec (FRS-MOD-xx)
      ↓
[5] Screen Contract (SC-xx)
      ↓
[6] Code Implementation (src/)
      ↓
[7] Automated Tests (tests/ & vitest)
      ↓
[8] Business Scenario & Evidence (S-xxx)
```

Không một dòng code nào được phép tồn tại nếu không truy ngược về được Business Rule. Không một Business Rule nào được coi là hoàn tất nếu chưa có Test Case và Scenario tương ứng.

---

## 2. Bảng Ma Trận Truy Xuất Nguồn Gốc 8 Chiều

| [1] Nghiệp vụ cốt lõi             | [2] Business Rule                            | [3] Domain Contract                                          | [4] Functional Spec                | [5] Screen Contract           | [6] Code Implementation (Authority)                                            | [7] Automated Test Files                                 | [8] Scenario & Evidence       |
| :-------------------------------- | :------------------------------------------- | :----------------------------------------------------------- | :--------------------------------- | :---------------------------- | :----------------------------------------------------------------------------- | :------------------------------------------------------- | :---------------------------- |
| **Dữ liệu nền & Thiết bị**        | `BR-MST-001`<br>`BR-MST-002`<br>`BR-MST-003` | `DATA_CONTRACTS.md`                                          | `FRS_01_MASTER_DATA.md`            | `SC-25`                       | `src/services/masterDataService.ts`<br>`src/types/masterData.ts`               | `src/services/__tests__/masterData.test.ts`              | `S-001`<br>`TC-MST-001`       |
| **Danh mục Sản phẩm**             | `BR-PRD-001`<br>`BR-PRD-002`<br>`BR-PRD-003` | `PRODUCT_TCCS_CONTRACT.md`                                   | `FRS_02_PRODUCT.md`                | `SC-02`<br>`SC-03`<br>`SC-04` | `src/services/productService.ts`<br>`src/types/product.ts`                     | `src/services/__tests__/product.test.ts`                 | `S-001`<br>`S-007`            |
| **Tiêu chuẩn Cơ sở (TCCS)**       | `BR-TCS-001`<br>`BR-TCS-002`<br>`BR-TCS-003` | `PRODUCT_TCCS_CONTRACT.md`<br>`CRITERION_STATE_CONTRACT.md`  | `FRS_03_TCCS.md`                   | `SC-05`<br>`SC-06`<br>`SC-07` | `src/services/tccsService.ts`<br>`src/types/tccs.ts`                           | `src/services/__tests__/tccs.test.ts`                    | `S-004`<br>`S-007`            |
| **Công thức BOM**                 | `BR-FOR-001`<br>`BR-FOR-002`                 | `FORMULA_MATERIAL_CONTRACT.md`                               | `FRS_04_FORMULA.md`                | `SC-08`                       | `src/services/formulaService.ts`<br>`src/types/formula.ts`                     | `src/services/__tests__/formula.test.ts`                 | `S-001`                       |
| **Nguyên vật liệu & Kho**         | `BR-MAT-001`<br>`BR-MAT-002`                 | `FORMULA_MATERIAL_CONTRACT.md`                               | `FRS_05_RAW_MATERIAL.md`           | `SC-09`                       | `src/services/materialService.ts`<br>`src/types/rawMaterial.ts`                | `src/services/__tests__/material.test.ts`                | `S-001`<br>`S-005`            |
| **Hồ sơ Lô Sản phẩm**             | `BR-BAT-001`<br>`BR-BAT-002`<br>`BR-BAT-003` | `BATCH_GENEALOGY_CONTRACT.md`<br>`STATE_MACHINES.md (FSM 1)` | `FRS_06_BATCH.md`                  | `SC-10`<br>`SC-11`<br>`SC-12` | `src/services/batchService.ts`<br>`src/types/batch.ts`                         | `src/services/__tests__/batch.test.ts`                   | `S-001`<br>`S-002`<br>`S-003` |
| **Phiếu Kiểm Nghiệm (PKN)**       | `BR-TST-001`<br>`BR-TST-002`                 | `TEST_RESULT_CONTRACT.md`<br>`STATE_MACHINES.md (FSM 2)`     | `FRS_07_TEST_RESULT.md`            | `SC-13`<br>`SC-14`            | `src/services/testResultService.ts`<br>`src/types/testResult.ts`               | `src/services/__tests__/testResult.test.ts`              | `S-001`<br>`S-003`<br>`S-008` |
| **Đánh giá Chất lượng chuẩn tắc** | `BR-QEV-001`<br>`BR-QEV-002`                 | `QUALITY_STATUS_CONTRACT.md`<br>`STATE_MACHINES.md (FSM 3)`  | `FRS_08_QUALITY_EVALUATION.md`     | `SC-10`<br>`SC-14`            | `src/services/canonicalStatusResolver.ts`<br>`src/domain/evaluation/`          | `src/services/__tests__/canonicalStatusResolver.test.ts` | `S-001`<br>`S-002`<br>`S-003` |
| **Chỉ tiêu Thay thế & Thử lại**   | `BR-ALT-001`<br>`BR-ALT-002`                 | `ALTERNATE_RULE_CONTRACT.md`<br>`STATE_MACHINES.md (FSM 4)`  | `FRS_09_ALTERNATE_RULES.md`        | `SC-06`<br>`SC-14`            | `src/domain/alternateRulesEngine.ts`<br>`src/services/alternateRuleService.ts` | `src/domain/__tests__/alternateRulesEngine.test.ts`      | `S-004`<br>`S-005`<br>`S-006` |
| **Điều tra OOS (2 Giai đoạn)**    | `BR-OOS-001`<br>`BR-OOS-002`                 | `QMS_INCIDENT_CONTRACT.md`                                   | `FRS_10_OOS.md`                    | `SC-16`                       | `src/services/oosService.ts`<br>`src/types/oos.ts`                             | `src/services/__tests__/oos.test.ts`                     | `S-002`<br>`S-010`            |
| **Sai lệch (Deviation - ICH Q9)** | `BR-DEV-001`<br>`BR-DEV-002`                 | `QMS_INCIDENT_CONTRACT.md`                                   | `FRS_11_DEVIATION.md`              | `SC-17`                       | `src/services/deviationService.ts`<br>`src/types/deviation.ts`                 | `src/services/__tests__/deviation.test.ts`               | `S-009`<br>`S-011`            |
| **Hành động CAPA khép kín**       | `BR-CAP-001`<br>`BR-CAP-002`                 | `QMS_INCIDENT_CONTRACT.md`                                   | `FRS_12_CAPA.md`                   | `SC-18`                       | `src/services/capaService.ts`<br>`src/types/capa.ts`                           | `src/services/__tests__/capa.test.ts`                    | `S-012`                       |
| **Đường ống Phê duyệt đa cấp**    | `BR-APP-001`<br>`BR-APP-002`                 | `APPROVAL_CONTRACT.md`                                       | `FRS_13_APPROVAL_PIPELINE.md`      | `SC-19`                       | `src/services/approvalWorkflowService.ts`<br>`src/domain/approval/`            | `src/services/__tests__/approvalWorkflow.test.ts`        | `S-008`                       |
| **7 Cổng Kiểm Soát Xuất Xưởng**   | `BR-REL-001`<br>`BR-REL-002`                 | `BATCH_GENEALOGY_CONTRACT.md`<br>`STATE_MACHINES.md (FSM 1)` | `FRS_14_BATCH_RELEASE.md`          | `SC-11`                       | `src/services/releaseService.ts`<br>`src/domain/releaseGates.ts`               | `src/domain/__tests__/releaseGates.test.ts`              | `S-001`<br>`S-009`            |
| **Phiếu CoA & Snapshot**          | `BR-COA-001`<br>`BR-COA-002`                 | `COA_SNAPSHOT_CONTRACT.md`                                   | `FRS_15_COA_REPORT.md`             | `SC-15`                       | `src/services/coaService.ts`<br>`src/components/coa/`                          | `src/services/__tests__/coaService.test.ts`              | `S-001`<br>`S-013`            |
| **Chữ ký số 21 CFR Part 11**      | `BR-SIG-001`<br>`BR-SIG-002`                 | `SIGNATURE_AUDIT_CONTRACT.md`                                | `FRS_16_SIGNATURE_SECURITY.md`     | `SC-14`<br>`SC-19`            | `src/services/signatureService.ts`<br>`src/utils/crypto.ts`                    | `src/services/__tests__/signature.test.ts`               | `S-015`                       |
| **Nhật ký ALCOA+ & Hash Chain**   | `BR-AUD-001`<br>`BR-AUD-002`                 | `SIGNATURE_AUDIT_CONTRACT.md`                                | `FRS_17_AUDIT_TRAIL.md`            | `SC-20`                       | `src/services/auditTrailService.ts`<br>`src/utils/hashChain.ts`                | `src/services/__tests__/auditTrail.test.ts`              | `S-014`                       |
| **Phả hệ Lô 2 chiều (DAG)**       | `BR-GEN-001`<br>`BR-GEN-002`                 | `BATCH_GENEALOGY_CONTRACT.md`                                | `FRS_18_GENEALOGY_TRACEABILITY.md` | `SC-21`                       | `src/services/genealogyService.ts`<br>`src/utils/graphTraversal.ts`            | `src/services/__tests__/genealogy.test.ts`               | `S-001`<br>`S-011`            |
| **Báo cáo PQR & SPC Shewhart**    | `BR-REP-001`<br>`BR-REP-002`                 | `DATA_CONTRACTS.md`                                          | `FRS_19_REPORTING_SPC.md`          | `SC-23`                       | `src/services/spcAnalysisService.ts`<br>`src/utils/statistics.ts`              | `src/services/__tests__/spcAnalysis.test.ts`             | `S-001`                       |
| **Trợ lý AI & Rào chắn Dược**     | `BR-AI-001`<br>`BR-AI-002`                   | `AI_ADVISORY_CONTRACT.md`                                    | `FRS_20_AI_ADVISORY.md`            | `SC-24`                       | `src/services/aiAdvisoryService.ts`<br>`src/utils/aiMapping.ts`                | `src/utils/__tests__/aiMapping.test.ts`                  | `S-018`                       |
| **Phân quyền RBAC & SoD Guard**   | `BR-RBC-001`<br>`BR-RBC-002`                 | `APPROVAL_CONTRACT.md`                                       | `FRS_13_APPROVAL_PIPELINE.md`      | `SC-25`                       | `src/security/rbacGuard.ts`<br>`src/contexts/AuthContext.tsx`                  | `src/security/__tests__/rbacGuard.test.ts`               | `S-008`                       |

---

## 3. Quy Tắc Kiểm Soát Tuân Thủ (Conformance Governance)

1. **Tính khép kín (Closure)**: 100% các ô trong ma trận trên đều đã được định nghĩa và có tài liệu chi tiết trong repository.
2. **Không có lỗ hổng (Zero-Gap Rule)**: Mọi sự thay đổi tại bất kỳ cột nào đều đòi hỏi phải cập nhật đồng bộ các cột còn lại trước khi release mã nguồn.
3. **Evidence-Driven**: Khi chạy lệnh `npm test` hoặc `npm run test:e2e`, kết quả trả về là bằng chứng nghiệm thu trực tiếp cho các kịch bản tương ứng trong cột `[8]`.
