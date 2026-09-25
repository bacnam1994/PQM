# 📋 PQM ACTIVITY INVENTORY & COVERAGE REGISTER

> **Mã tài liệu**: `PQM-ACT-INV-001`  
> **Phiên bản**: `1.0.0-BASELINE`  
> **Thời điểm xuất**: `2026-09-25T03:00:04.071Z`  
> **Trạng thái Gate**: `PASSED` (Phân loại: **100%**)

---

## 1. TỔNG QUAN THỐNG KÊ (SYSTEM METRICS)

- **Tổng số Activities đã kiểm kê**: **122**
- **Hoạt động chưa map (UNMAPPED)**: **0**
- **Hoạt động mồ côi (ORPHAN)**: **0**
- **Tỷ lệ bao phủ phân loại**: **100%**

### 1.1. Phân bố theo Mức độ rủi ro (Risk Level)

| Mức độ rủi ro     | Số lượng | Tỷ lệ | Mô tả                                                                           |
| :---------------- | :------: | :---: | :------------------------------------------------------------------------------ |
| 🔴 **HIGH**       |    42    |  34%  | Tác động trực tiếp tới chất lượng thuốc, phát hành lô, phê duyệt hồ sơ pháp lý. |
| 🟡 **MEDIUM**     |    54    |  44%  | Sửa đổi thông tin master data, phân công nhiệm vụ, cập nhật tiến độ.            |
| 🟢 **LOW / NONE** |    26    |  21%  | Truy vấn dữ liệu, gợi ý AI proposal, xuất file báo cáo.                         |

### 1.2. Phân bố theo Thực thể (Entity Breakdown)

| Thực thể         | Số lượng hoạt động | Hành động đại diện    |
| :--------------- | :----------------: | :-------------------- |
| `BATCH`          |         16         | BATCH_CREATE          |
| `CAPA`           |         3          | SYSTEM_CONFIG_UPDATE  |
| `CHANGE_REQUEST` |         6          | CHANGE_REQUEST_CREATE |
| `COA`            |         3          | COA_GENERATE          |
| `DEVIATION`      |         9          | DEVIATION_CREATE      |
| `FORMULA`        |         4          | FORMULA_CREATE        |
| `MASTER_DATA`    |         21         | LAB_MASTER_CREATE     |
| `MATERIAL`       |         4          | MATERIAL_CREATE       |
| `OOS`            |         3          | SYSTEM_CONFIG_UPDATE  |
| `PRODUCT`        |         7          | PRODUCT_CREATE        |
| `SYSTEM`         |         28         | SYSTEM_BACKUP_EXECUTE |
| `TCCS`           |         11         | TCCS_CREATE           |
| `TEST_RESULT`    |         6          | TEST_RESULT_CREATE    |
| `APPROVAL_TASK`  |         1          | APPROVAL_TASK_DECIDE  |

### 1.3. Phân bố theo Vai trò thực hiện (Owner Roles)

| Vai trò       | Số lượng | Thẩm quyền cốt lõi                   |
| :------------ | :------: | :----------------------------------- |
| `PRODUCTION`  |    5     | Quyền thao tác theo quy định ADR-001 |
| `ADMIN`       |    11    | Quyền thao tác theo quy định ADR-001 |
| `QA`          |    79    | Quyền thao tác theo quy định ADR-001 |
| `QC`          |    1     | Quyền thao tác theo quy định ADR-001 |
| `LAB`         |    3     | Quyền thao tác theo quy định ADR-001 |
| `AI_ADVISORY` |    17    | Quyền thao tác theo quy định ADR-001 |
| `USER`        |    5     | Quyền thao tác theo quy định ADR-001 |
| `SYSTEM`      |    1     | Quyền thao tác theo quy định ADR-001 |

---

## 2. BẢNG CHI TIẾT HOẠT ĐỘNG TOÀN HỆ THỐNG (ACTIVITY INVENTORY MATRIX)

| ID        | Trigger                 | Location                                                             | Entity           | Mutation? | Current Path                                   | Desired Canonical Action         | Owner         |   Risk   |       State       |
| :-------- | :---------------------- | :------------------------------------------------------------------- | :--------------- | :-------: | :--------------------------------------------- | :------------------------------- | :------------ | :------: | :---------------: |
| `ACT-001` | `APP_SERVICE_MUTATION`  | `src/services/app/BatchAppService.ts:28`                             | `BATCH`          |    ✅     | `BatchAppService.createBatch`                  | `BATCH_CREATE`                   | `PRODUCTION`  |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-002` | `APP_SERVICE_MUTATION`  | `src/services/app/BatchAppService.ts:43`                             | `BATCH`          |    ✅     | `BatchAppService.updateBatch`                  | `BATCH_UPDATE_METADATA`          | `PRODUCTION`  | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-003` | `APP_SERVICE_MUTATION`  | `src/services/app/BatchAppService.ts:63`                             | `BATCH`          |    ✅     | `BatchAppService.updateStatus`                 | `BATCH_UPDATE_METADATA`          | `PRODUCTION`  | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-004` | `APP_SERVICE_MUTATION`  | `src/services/app/BatchAppService.ts:109`                            | `BATCH`          |    ✅     | `BatchAppService.updateProgress`               | `BATCH_UPDATE_METADATA`          | `PRODUCTION`  | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-005` | `APP_SERVICE_MUTATION`  | `src/services/app/BatchAppService.ts:119`                            | `BATCH`          |    ✅     | `BatchAppService.deleteBatch`                  | `BATCH_DELETE`                   | `ADMIN`       |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-006` | `APP_SERVICE_MUTATION`  | `src/services/app/CAPAService.ts:27`                                 | `CAPA`           |    ✅     | `CAPAService.addCapaAction`                    | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-007` | `APP_SERVICE_MUTATION`  | `src/services/app/CAPAService.ts:71`                                 | `CAPA`           |    ✅     | `CAPAService.completeCapaAction`               | `CAPA_EXECUTE`                   | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-008` | `APP_SERVICE_MUTATION`  | `src/services/app/CAPAService.ts:95`                                 | `CAPA`           |    ✅     | `CAPAService.verifyAndCloseCAPA`               | `CAPA_VERIFY`                    | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-009` | `APP_SERVICE_MUTATION`  | `src/services/app/ChangeControlAppService.ts:111`                    | `CHANGE_REQUEST` |    ✅     | `ChangeControlAppService.createChangeRequest`  | `CHANGE_REQUEST_CREATE`          | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-010` | `APP_SERVICE_MUTATION`  | `src/services/app/ChangeControlAppService.ts:123`                    | `CHANGE_REQUEST` |    ✅     | `ChangeControlAppService.assessFMEARisk`       | `CHANGE_REQUEST_FMEA_ASSESS`     | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-011` | `APP_SERVICE_MUTATION`  | `src/services/app/ChangeControlAppService.ts:140`                    | `CHANGE_REQUEST` |    ✅     | `ChangeControlAppService.addActionItem`        | `CHANGE_REQUEST_ADD_ACTION`      | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-012` | `APP_SERVICE_MUTATION`  | `src/services/app/ChangeControlAppService.ts:159`                    | `CHANGE_REQUEST` |    ✅     | `ChangeControlAppService.completeActionItem`   | `CHANGE_REQUEST_COMPLETE_ACTION` | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-013` | `APP_SERVICE_MUTATION`  | `src/services/app/ChangeControlAppService.ts:181`                    | `CHANGE_REQUEST` |    ✅     | `ChangeControlAppService.updateStatus`         | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-014` | `APP_SERVICE_MUTATION`  | `src/services/app/CoAService.ts:178`                                 | `COA`            |    ✅     | `CoAService.generateCoAPayloadAsync`           | `COA_GENERATE`                   | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-015` | `APP_SERVICE_MUTATION`  | `src/services/app/CoAService.ts:209`                                 | `COA`            |    ✅     | `CoAService.signCoA`                           | `COA_SIGN`                       | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-016` | `APP_SERVICE_MUTATION`  | `src/services/app/CoAService.ts:260`                                 | `COA`            |    ✅     | `CoAService.revokeCoA`                         | `COA_REVOKE`                     | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-017` | `APP_SERVICE_MUTATION`  | `src/services/app/DeviationAppService.ts:44`                         | `DEVIATION`      |    ✅     | `DeviationAppService.createDeviation`          | `DEVIATION_CREATE`               | `QC`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-018` | `APP_SERVICE_MUTATION`  | `src/services/app/DeviationAppService.ts:51`                         | `DEVIATION`      |    ✅     | `DeviationAppService.autoLogFromOOS`           | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-019` | `APP_SERVICE_MUTATION`  | `src/services/app/DeviationAppService.ts:62`                         | `DEVIATION`      |    ✅     | `DeviationAppService.updateStatus`             | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-020` | `APP_SERVICE_MUTATION`  | `src/services/app/DeviationAppService.ts:74`                         | `DEVIATION`      |    ✅     | `DeviationAppService.addCAPAItem`              | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-021` | `APP_SERVICE_MUTATION`  | `src/services/app/DeviationAppService.ts:85`                         | `DEVIATION`      |    ✅     | `DeviationAppService.completeCAPAItem`         | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-022` | `APP_SERVICE_MUTATION`  | `src/services/app/DeviationAppService.ts:92`                         | `DEVIATION`      |    ✅     | `DeviationAppService.deleteDeviation`          | `DEVIATION_DELETE`               | `ADMIN`       |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-023` | `APP_SERVICE_MUTATION`  | `src/services/app/FormulaAppService.ts:80`                           | `FORMULA`        |    ✅     | `FormulaAppService.createFormula`              | `FORMULA_CREATE`                 | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-024` | `APP_SERVICE_MUTATION`  | `src/services/app/FormulaAppService.ts:110`                          | `FORMULA`        |    ✅     | `FormulaAppService.updateFormula`              | `FORMULA_UPDATE`                 | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-025` | `APP_SERVICE_MUTATION`  | `src/services/app/FormulaAppService.ts:137`                          | `FORMULA`        |    ✅     | `FormulaAppService.deleteFormula`              | `FORMULA_ARCHIVE`                | `ADMIN`       |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-026` | `APP_SERVICE_MUTATION`  | `src/services/app/LaboratoryAppService.ts:45`                        | `MASTER_DATA`    |    ✅     | `LaboratoryAppService.createLaboratory`        | `LAB_MASTER_CREATE`              | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-027` | `APP_SERVICE_MUTATION`  | `src/services/app/LaboratoryAppService.ts:81`                        | `MASTER_DATA`    |    ✅     | `LaboratoryAppService.updateLaboratory`        | `LAB_MASTER_UPDATE`              | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-028` | `APP_SERVICE_MUTATION`  | `src/services/app/LaboratoryAppService.ts:104`                       | `MASTER_DATA`    |    ✅     | `LaboratoryAppService.deleteLaboratory`        | `LAB_MASTER_UPDATE`              | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-029` | `APP_SERVICE_MUTATION`  | `src/services/app/MasterCriterionAppService.ts:35`                   | `MASTER_DATA`    |    ✅     | `MasterCriterionAppService.create`             | `CRITERIA_MASTER_CREATE`         | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-030` | `APP_SERVICE_MUTATION`  | `src/services/app/MasterCriterionAppService.ts:63`                   | `MASTER_DATA`    |    ✅     | `MasterCriterionAppService.update`             | `CRITERIA_MASTER_UPDATE`         | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-031` | `APP_SERVICE_MUTATION`  | `src/services/app/MasterCriterionAppService.ts:88`                   | `MASTER_DATA`    |    ✅     | `MasterCriterionAppService.delete`             | `CRITERIA_MASTER_UPDATE`         | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-032` | `APP_SERVICE_MUTATION`  | `src/services/app/MasterCriterionAppService.ts:115`                  | `MASTER_DATA`    |    ✅     | `MasterCriterionAppService.bulkRename`         | `CRITERIA_MASTER_UPDATE`         | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-033` | `APP_SERVICE_MUTATION`  | `src/services/app/MaterialAppService.ts:27`                          | `MATERIAL`       |    ✅     | `MaterialAppService.createMaterial`            | `MATERIAL_CREATE`                | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-034` | `APP_SERVICE_MUTATION`  | `src/services/app/MaterialAppService.ts:55`                          | `MATERIAL`       |    ✅     | `MaterialAppService.updateMaterial`            | `MATERIAL_UPDATE`                | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-035` | `APP_SERVICE_MUTATION`  | `src/services/app/MaterialAppService.ts:84`                          | `MATERIAL`       |    ✅     | `MaterialAppService.deleteMaterial`            | `MATERIAL_DELETE`                | `ADMIN`       |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-036` | `APP_SERVICE_MUTATION`  | `src/services/app/OOSService.ts:39`                                  | `OOS`            |    ✅     | `OOSService.triggerOOSInvestigation`           | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-037` | `APP_SERVICE_MUTATION`  | `src/services/app/OOSService.ts:66`                                  | `OOS`            |    ✅     | `OOSService.submitPhase1Investigation`         | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-038` | `APP_SERVICE_MUTATION`  | `src/services/app/OOSService.ts:103`                                 | `OOS`            |    ✅     | `OOSService.concludeOOSInvestigation`          | `OOS_CONCLUDE`                   | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-039` | `APP_SERVICE_MUTATION`  | `src/services/app/PharmacopoeiaAppService.ts:45`                     | `MASTER_DATA`    |    ✅     | `PharmacopoeiaAppService.createStandard`       | `PHARMACOPOEIA_CREATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-040` | `APP_SERVICE_MUTATION`  | `src/services/app/PharmacopoeiaAppService.ts:74`                     | `MASTER_DATA`    |    ✅     | `PharmacopoeiaAppService.updateStandard`       | `PHARMACOPOEIA_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-041` | `APP_SERVICE_MUTATION`  | `src/services/app/PharmacopoeiaAppService.ts:101`                    | `MASTER_DATA`    |    ✅     | `PharmacopoeiaAppService.deleteStandard`       | `PHARMACOPOEIA_DELETE`           | `ADMIN`       |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-042` | `APP_SERVICE_MUTATION`  | `src/services/app/PharmacopoeiaAppService.ts:124`                    | `MASTER_DATA`    |    ✅     | `PharmacopoeiaAppService.seedDefaultStandards` | `PHARMACOPOEIA_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-043` | `APP_SERVICE_MUTATION`  | `src/services/app/ProductAppService.ts:27`                           | `PRODUCT`        |    ✅     | `ProductAppService.createProduct`              | `PRODUCT_CREATE`                 | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-044` | `APP_SERVICE_MUTATION`  | `src/services/app/ProductAppService.ts:58`                           | `PRODUCT`        |    ✅     | `ProductAppService.updateProduct`              | `PRODUCT_UPDATE`                 | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-045` | `APP_SERVICE_MUTATION`  | `src/services/app/ProductAppService.ts:96`                           | `PRODUCT`        |    ✅     | `ProductAppService.deleteProduct`              | `PRODUCT_ARCHIVE`                | `ADMIN`       |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-046` | `APP_SERVICE_MUTATION`  | `src/services/app/ProductAppService.ts:120`                          | `PRODUCT`        |    ✅     | `ProductAppService.bulkCreateProducts`         | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-047` | `APP_SERVICE_MUTATION`  | `src/services/app/ReleaseService.ts:76`                              | `BATCH`          |    ✅     | `ReleaseService.releaseBatch`                  | `BATCH_RELEASE_APPROVE`          | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-048` | `APP_SERVICE_MUTATION`  | `src/services/app/ReleaseService.ts:161`                             | `BATCH`          |    ✅     | `ReleaseService.executeBatchHold`              | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-049` | `APP_SERVICE_MUTATION`  | `src/services/app/ReleaseService.ts:215`                             | `BATCH`          |    ✅     | `ReleaseService.executeBatchRecall`            | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-050` | `APP_SERVICE_MUTATION`  | `src/services/app/SystemAppService.ts:65`                            | `SYSTEM`         |    ✅     | `SystemAppService.backupDatabase`              | `SYSTEM_BACKUP_EXECUTE`          | `ADMIN`       | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-051` | `APP_SERVICE_MUTATION`  | `src/services/app/SystemAppService.ts:96`                            | `SYSTEM`         |    ✅     | `SystemAppService.restoreDatabase`             | `SYSTEM_RESTORE_EXECUTE`         | `ADMIN`       |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-052` | `APP_SERVICE_MUTATION`  | `src/services/app/SystemAppService.ts:144`                           | `SYSTEM`         |    ✅     | `SystemAppService.wipeDatabase`                | `SYSTEM_WIPE_DEMO_EXECUTE`       | `ADMIN`       |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-053` | `APP_SERVICE_MUTATION`  | `src/services/app/SystemAppService.ts:185`                           | `SYSTEM`         |    ✅     | `SystemAppService.resetDemoData`               | `SYSTEM_WIPE_DEMO_EXECUTE`       | `ADMIN`       |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-054` | `APP_SERVICE_MUTATION`  | `src/services/app/TCCSAppService.ts:43`                              | `TCCS`           |    ✅     | `TCCSAppService.createTCCS`                    | `TCCS_CREATE`                    | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-055` | `APP_SERVICE_MUTATION`  | `src/services/app/TCCSAppService.ts:101`                             | `TCCS`           |    ✅     | `TCCSAppService.updateTCCS`                    | `TCCS_UPDATE_DRAFT`              | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-056` | `APP_SERVICE_MUTATION`  | `src/services/app/TCCSAppService.ts:191`                             | `TCCS`           |    ✅     | `TCCSAppService.deleteTCCS`                    | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-057` | `APP_SERVICE_MUTATION`  | `src/services/app/TCCSAppService.ts:241`                             | `TCCS`           |    ✅     | `TCCSAppService.addAiLearnedMapping`           | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-058` | `APP_SERVICE_MUTATION`  | `src/services/app/TCCSAppService.ts:288`                             | `TCCS`           |    ✅     | `TCCSAppService.addCriteriaAlias`              | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-059` | `APP_SERVICE_MUTATION`  | `src/services/app/TCCSAppService.ts:314`                             | `TCCS`           |    ✅     | `TCCSAppService.updateCriteriaAlias`           | `TCCS_UPDATE_DRAFT`              | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-060` | `APP_SERVICE_MUTATION`  | `src/services/app/TCCSAppService.ts:340`                             | `TCCS`           |    ✅     | `TCCSAppService.deleteCriteriaAlias`           | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-061` | `APP_SERVICE_MUTATION`  | `src/services/app/TCCSAppService.ts:363`                             | `TCCS`           |    ✅     | `TCCSAppService.confirmCriteriaAlias`          | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-062` | `APP_SERVICE_MUTATION`  | `src/services/app/TCCSAppService.ts:376`                             | `TCCS`           |    ✅     | `TCCSAppService.addAliasToExisting`            | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-063` | `APP_SERVICE_MUTATION`  | `src/services/app/TestResultAppService.ts:30`                        | `TEST_RESULT`    |    ✅     | `TestResultAppService.createTestResult`        | `TEST_RESULT_CREATE`             | `LAB`         |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-064` | `APP_SERVICE_MUTATION`  | `src/services/app/TestResultAppService.ts:44`                        | `TEST_RESULT`    |    ✅     | `TestResultAppService.updateTestResult`        | `TEST_RESULT_ENTRY_INPUT`        | `LAB`         |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-065` | `APP_SERVICE_MUTATION`  | `src/services/app/TestResultAppService.ts:63`                        | `TEST_RESULT`    |    ✅     | `TestResultAppService.updateWorkflowStatus`    | `TEST_RESULT_ENTRY_INPUT`        | `LAB`         |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-066` | `APP_SERVICE_MUTATION`  | `src/services/app/TestResultAppService.ts:86`                        | `TEST_RESULT`    |    ✅     | `TestResultAppService.deleteTestResult`        | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-067` | `REPOSITORY_WRITE`      | `src/repositories/BatchRepository.ts:12`                             | `BATCH`          |    ✅     | `BatchRepository.updateStatus`                 | `BATCH_DISPATCH_TESTING`         | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-068` | `REPOSITORY_WRITE`      | `src/repositories/BatchRepository.ts:13`                             | `BATCH`          |    ✅     | `BatchRepository.updateProgress`               | `BATCH_UPDATE_METADATA`          | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-069` | `REPOSITORY_WRITE`      | `src/repositories/firebase/BaseFirebaseRepository.ts:253`            | `SYSTEM`         |    ✅     | `BaseFirebaseRepository.save`                  | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-070` | `REPOSITORY_WRITE`      | `src/repositories/firebase/BaseFirebaseRepository.ts:262`            | `SYSTEM`         |    ✅     | `BaseFirebaseRepository.update`                | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-071` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseAILearnedMappingRepository.ts:24` | `SYSTEM`         |    ✅     | `FirebaseAILearnedMappingRepository.delete`    | `SYSTEM_CONFIG_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-072` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseApprovalTaskRepository.ts:32`     | `APPROVAL_TASK`  |    ✅     | `FirebaseApprovalTaskRepository.delete`        | `APPROVAL_TASK_DECIDE`           | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-073` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseBatchRepository.ts:43`            | `BATCH`          |    ✅     | `FirebaseBatchRepository.updateStatus`         | `BATCH_DISPATCH_TESTING`         | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-074` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseBatchRepository.ts:54`            | `BATCH`          |    ✅     | `FirebaseBatchRepository.updateProgress`       | `BATCH_UPDATE_METADATA`          | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-075` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseBatchRepository.ts:61`            | `BATCH`          |    ✅     | `FirebaseBatchRepository.delete`               | `BATCH_DELETE`                   | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-076` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseChangeControlRepository.ts:26`    | `CHANGE_REQUEST` |    ✅     | `FirebaseChangeControlRepository.delete`       | `CHANGE_REQUEST_FMEA_ASSESS`     | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-077` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseCriteriaAliasRepository.ts:23`    | `MASTER_DATA`    |    ✅     | `FirebaseCriteriaAliasRepository.delete`       | `CRITERIA_MASTER_UPDATE`         | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-078` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseDeviationRepository.ts:23`        | `DEVIATION`      |    ✅     | `FirebaseDeviationRepository.updateStatus`     | `DEVIATION_INVESTIGATE`          | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-079` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseDeviationRepository.ts:39`        | `DEVIATION`      |    ✅     | `FirebaseDeviationRepository.delete`           | `DEVIATION_INVESTIGATE`          | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-080` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseFormulaRepository.ts:24`          | `FORMULA`        |    ✅     | `FirebaseFormulaRepository.delete`             | `FORMULA_UPDATE`                 | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-081` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseLaboratoryRepository.ts:13`       | `MASTER_DATA`    |    ✅     | `FirebaseLaboratoryRepository.delete`          | `LAB_MASTER_UPDATE`              | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-082` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseMasterCriterionRepository.ts:49`  | `MASTER_DATA`    |    ✅     | `FirebaseMasterCriterionRepository.delete`     | `CRITERIA_MASTER_UPDATE`         | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-083` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseMaterialRepository.ts:42`         | `MATERIAL`       |    ✅     | `FirebaseMaterialRepository.delete`            | `MATERIAL_DELETE`                | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-084` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebasePharmacopoeiaRepository.ts:13`    | `MASTER_DATA`    |    ✅     | `FirebasePharmacopoeiaRepository.delete`       | `PHARMACOPOEIA_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-085` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseProductRepository.ts:35`          | `PRODUCT`        |    ✅     | `FirebaseProductRepository.delete`             | `PRODUCT_ARCHIVE`                | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-086` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseTCCSRepository.ts:34`             | `TCCS`           |    ✅     | `FirebaseTCCSRepository.delete`                | `TCCS_UPDATE_DRAFT`              | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-087` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseTestResultRepository.ts:42`       | `TEST_RESULT`    |    ✅     | `FirebaseTestResultRepository.delete`          | `TEST_RESULT_DELETE`             | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-088` | `REPOSITORY_WRITE`      | `src/repositories/IDeviationRepository.ts:10`                        | `DEVIATION`      |    ✅     | `IDeviationRepository.updateStatus`            | `DEVIATION_INVESTIGATE`          | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-089` | `REPOSITORY_WRITE`      | `src/repositories/ILaboratoryRepository.ts:6`                        | `MASTER_DATA`    |    ✅     | `ILaboratoryRepository.save`                   | `LAB_MASTER_UPDATE`              | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-090` | `REPOSITORY_WRITE`      | `src/repositories/ILaboratoryRepository.ts:7`                        | `MASTER_DATA`    |    ✅     | `ILaboratoryRepository.update`                 | `LAB_MASTER_UPDATE`              | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-091` | `REPOSITORY_WRITE`      | `src/repositories/ILaboratoryRepository.ts:8`                        | `MASTER_DATA`    |    ✅     | `ILaboratoryRepository.delete`                 | `LAB_MASTER_UPDATE`              | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-092` | `REPOSITORY_WRITE`      | `src/repositories/IPharmacopoeiaRepository.ts:6`                     | `MASTER_DATA`    |    ✅     | `IPharmacopoeiaRepository.save`                | `PHARMACOPOEIA_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-093` | `REPOSITORY_WRITE`      | `src/repositories/IPharmacopoeiaRepository.ts:7`                     | `MASTER_DATA`    |    ✅     | `IPharmacopoeiaRepository.update`              | `PHARMACOPOEIA_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-094` | `REPOSITORY_WRITE`      | `src/repositories/IPharmacopoeiaRepository.ts:8`                     | `MASTER_DATA`    |    ✅     | `IPharmacopoeiaRepository.delete`              | `PHARMACOPOEIA_UPDATE`           | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-095` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/aiInsightsTool.ts:1`                          | `SYSTEM`         |    ❌     | `aiInsightsTool.execute`                       | `AI_NATURAL_QUERY`               | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-096` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/autoHealingTool.ts:1`                         | `SYSTEM`         |    ❌     | `autoHealingTool.execute`                      | `SYSTEM_AUTO_HEAL_PROPOSE`       | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-097` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/batchActionTools.ts:1`                        | `BATCH`          |    ❌     | `batchActionTools.execute`                     | `AI_BATCH_CLEARANCE_PROPOSE`     | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-098` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/batchSummaryTool.ts:1`                        | `SYSTEM`         |    ❌     | `batchSummaryTool.execute`                     | `AI_NATURAL_QUERY`               | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-099` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/dataIntegrityTool.ts:1`                       | `SYSTEM`         |    ❌     | `dataIntegrityTool.execute`                    | `AI_DATA_INTEGRITY_SCAN`         | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-100` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/deviationReportTool.ts:1`                     | `SYSTEM`         |    ❌     | `deviationReportTool.execute`                  | `AI_NATURAL_QUERY`               | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-101` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/labComparisonTool.ts:1`                       | `TEST_RESULT`    |    ❌     | `labComparisonTool.execute`                    | `AI_LAB_COMPARE`                 | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-102` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/navigationTool.ts:1`                          | `SYSTEM`         |    ❌     | `navigationTool.execute`                       | `AI_NATURAL_QUERY`               | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-103` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/nlQueryTool.ts:1`                             | `SYSTEM`         |    ❌     | `nlQueryTool.execute`                          | `AI_NATURAL_QUERY`               | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-104` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/oosInvestigationTool.ts:1`                    | `SYSTEM`         |    ❌     | `oosInvestigationTool.execute`                 | `AI_NATURAL_QUERY`               | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-105` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/pharmacopoeiaTool.ts:1`                       | `SYSTEM`         |    ❌     | `pharmacopoeiaTool.execute`                    | `AI_NATURAL_QUERY`               | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-106` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/productionSynthesisTool.ts:1`                 | `SYSTEM`         |    ❌     | `productionSynthesisTool.execute`              | `AI_NATURAL_QUERY`               | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-107` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/qualityReportTool.ts:1`                       | `SYSTEM`         |    ❌     | `qualityReportTool.execute`                    | `AI_NATURAL_QUERY`               | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-108` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/qualityRiskTool.ts:1`                         | `SYSTEM`         |    ❌     | `qualityRiskTool.execute`                      | `AI_NATURAL_QUERY`               | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-109` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/qualityTrendTool.ts:1`                        | `SYSTEM`         |    ❌     | `qualityTrendTool.execute`                     | `AI_NATURAL_QUERY`               | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-110` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/rootCauseAnalysisTool.ts:1`                   | `SYSTEM`         |    ❌     | `rootCauseAnalysisTool.execute`                | `AI_NATURAL_QUERY`               | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-111` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/stabilityPredictionTool.ts:1`                 | `BATCH`          |    ❌     | `stabilityPredictionTool.execute`              | `AI_STABILITY_PREDICT`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-112` | `UI_FORM_SUBMIT`        | `src/pages/batches/BatchFormPage.tsx:50`                             | `BATCH`          |    ✅     | `handleSave`                                   | `BATCH_CREATE`                   | `PRODUCTION`  |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-113` | `UI_FORM_SUBMIT`        | `src/pages/products/MaterialFormPage.tsx:142`                        | `PRODUCT`        |    ✅     | `handleSave`                                   | `PRODUCT_UPDATE`                 | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-114` | `UI_FORM_SUBMIT`        | `src/pages/products/ProductFormPage.tsx:174`                         | `PRODUCT`        |    ✅     | `handleSave`                                   | `PRODUCT_UPDATE`                 | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-115` | `UI_FORM_SUBMIT`        | `src/pages/qa/CriteriaFormPage.tsx:170`                              | `SYSTEM`         |    ✅     | `handleSave`                                   | `SYSTEM_CONFIG_UPDATE`           | `USER`        | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-116` | `UI_FORM_SUBMIT`        | `src/pages/qa/ProductFormulaFormPage.tsx:165`                        | `SYSTEM`         |    ✅     | `handleSave`                                   | `SYSTEM_CONFIG_UPDATE`           | `USER`        | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-117` | `UI_FORM_SUBMIT`        | `src/pages/qa/TCCSFormPage.tsx:331`                                  | `TCCS`           |    ✅     | `handleSave`                                   | `TCCS_CREATE`                    | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-118` | `UI_FORM_SUBMIT`        | `src/pages/system/components/PharmacopoeiaManager.tsx:107`           | `SYSTEM`         |    ✅     | `handleSave`                                   | `SYSTEM_CONFIG_UPDATE`           | `USER`        | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-119` | `FILE_EXPORT`           | `src/utils/excelExporter.ts:1`                                       | `SYSTEM`         |    ❌     | `exportToExcel`                                | `EXCEL_DATA_EXPORT`              | `USER`        |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-120` | `FILE_UPLOAD`           | `src/services/storageService.ts:1`                                   | `SYSTEM`         |    ✅     | `uploadFile`                                   | `FILE_STORAGE_UPLOAD`            | `USER`        | `MEDIUM` | `ADAPTER_BRIDGED` |
| `ACT-121` | `CLOUD_FUNCTION_CALL`   | `src/services/cloudFunctionsService.ts:1`                            | `SYSTEM`         |    ❌     | `callCloudFunction`                            | `CLOUD_FUNCTION_INVOKE`          | `SYSTEM`      |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-122` | `SYSTEM_BACKGROUND_JOB` | `src/services/dataConsistencyService.ts:1`                           | `SYSTEM`         |    ✅     | `executeAutoHealingPlan`                       | `SYSTEM_AUTO_HEAL_EXECUTE`       | `ADMIN`       |  `HIGH`  |  `LEGACY_DIRECT`  |

---

## 3. KẾT LUẬN & ĐIỀU KIỆN MỞ CỔNG (PHASE 0 GATE SIGN-OFF)

1. **Gate Criteria**: 100% Activities đã được phân loại; 0 Unmapped; 0 Orphan.
2. **Kế hoạch tiếp theo (Phase 1)**: Xây dựng workflow kernel thực thi (`UnifiedWorkflowExecutor` nâng cấp) và bộ adapters (`LegacyServiceAdapter`) làm cầu nối trước khi chuyển UI ở Phase 2.
