# 📋 PQM ACTIVITY INVENTORY & COVERAGE REGISTER

> **Mã tài liệu**: `PQM-ACT-INV-001`  
> **Phiên bản**: `1.0.0-BASELINE`  
> **Thời điểm xuất**: `2026-09-27T01:47:04.813Z`  
> **Trạng thái Gate**: `PASSED` (Phân loại: **100%**)

---

## 1. TỔNG QUAN THỐNG KÊ (SYSTEM METRICS)

- **Tổng số Activities đã kiểm kê**: **74**
- **Hoạt động chưa map (UNMAPPED)**: **0**
- **Hoạt động mồ côi (ORPHAN)**: **0**
- **Tỷ lệ bao phủ phân loại**: **100%**

### 1.1. Phân bố theo Mức độ rủi ro (Risk Level)

| Mức độ rủi ro     | Số lượng | Tỷ lệ | Mô tả                                                                           |
| :---------------- | :------: | :---: | :------------------------------------------------------------------------------ |
| 🔴 **HIGH**       |    20    |  27%  | Tác động trực tiếp tới chất lượng thuốc, phát hành lô, phê duyệt hồ sơ pháp lý. |
| 🟡 **MEDIUM**     |    28    |  38%  | Sửa đổi thông tin master data, phân công nhiệm vụ, cập nhật tiến độ.            |
| 🟢 **LOW / NONE** |    26    |  35%  | Truy vấn dữ liệu, gợi ý AI proposal, xuất file báo cáo.                         |

### 1.2. Phân bố theo Thực thể (Entity Breakdown)

| Thực thể         | Số lượng hoạt động | Hành động đại diện         |
| :--------------- | :----------------: | :------------------------- |
| `MASTER_DATA`    |         24         | LAB_MASTER_CREATE          |
| `SYSTEM`         |         28         | SYSTEM_BACKUP_EXECUTE      |
| `APPROVAL_TASK`  |         1          | APPROVAL_TASK_DECIDE       |
| `BATCH`          |         8          | BATCH_DISPATCH_TESTING     |
| `CHANGE_REQUEST` |         1          | CHANGE_REQUEST_FMEA_ASSESS |
| `DEVIATION`      |         3          | DEVIATION_INVESTIGATE      |
| `FORMULA`        |         1          | FORMULA_UPDATE             |
| `MATERIAL`       |         1          | MATERIAL_DELETE            |
| `PRODUCT`        |         3          | PRODUCT_ARCHIVE            |
| `TCCS`           |         2          | TCCS_UPDATE_DRAFT          |
| `TEST_RESULT`    |         2          | TEST_RESULT_DELETE         |

### 1.3. Phân bố theo Vai trò thực hiện (Owner Roles)

| Vai trò       | Số lượng | Thẩm quyền cốt lõi                   |
| :------------ | :------: | :----------------------------------- |
| `QA`          |    44    | Quyền thao tác theo quy định ADR-001 |
| `ADMIN`       |    6     | Quyền thao tác theo quy định ADR-001 |
| `AI_ADVISORY` |    17    | Quyền thao tác theo quy định ADR-001 |
| `PRODUCTION`  |    1     | Quyền thao tác theo quy định ADR-001 |
| `USER`        |    5     | Quyền thao tác theo quy định ADR-001 |
| `SYSTEM`      |    1     | Quyền thao tác theo quy định ADR-001 |

---

## 2. BẢNG CHI TIẾT HOẠT ĐỘNG TOÀN HỆ THỐNG (ACTIVITY INVENTORY MATRIX)

| ID        | Trigger                 | Location                                                             | Entity           | Mutation? | Current Path                                   | Desired Canonical Action     | Owner         |   Risk   |       State       |
| :-------- | :---------------------- | :------------------------------------------------------------------- | :--------------- | :-------: | :--------------------------------------------- | :--------------------------- | :------------ | :------: | :---------------: |
| `ACT-001` | `APP_SERVICE_MUTATION`  | `src/services/app/LaboratoryAppService.ts:45`                        | `MASTER_DATA`    |    ✅     | `LaboratoryAppService.createLaboratory`        | `LAB_MASTER_CREATE`          | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-002` | `APP_SERVICE_MUTATION`  | `src/services/app/LaboratoryAppService.ts:81`                        | `MASTER_DATA`    |    ✅     | `LaboratoryAppService.updateLaboratory`        | `LAB_MASTER_UPDATE`          | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-003` | `APP_SERVICE_MUTATION`  | `src/services/app/LaboratoryAppService.ts:104`                       | `MASTER_DATA`    |    ✅     | `LaboratoryAppService.deleteLaboratory`        | `LAB_MASTER_UPDATE`          | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-004` | `APP_SERVICE_MUTATION`  | `src/services/app/MasterCriterionAppService.ts:35`                   | `MASTER_DATA`    |    ✅     | `MasterCriterionAppService.create`             | `CRITERIA_MASTER_CREATE`     | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-005` | `APP_SERVICE_MUTATION`  | `src/services/app/MasterCriterionAppService.ts:63`                   | `MASTER_DATA`    |    ✅     | `MasterCriterionAppService.update`             | `CRITERIA_MASTER_UPDATE`     | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-006` | `APP_SERVICE_MUTATION`  | `src/services/app/MasterCriterionAppService.ts:88`                   | `MASTER_DATA`    |    ✅     | `MasterCriterionAppService.delete`             | `CRITERIA_MASTER_UPDATE`     | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-007` | `APP_SERVICE_MUTATION`  | `src/services/app/MasterCriterionAppService.ts:115`                  | `MASTER_DATA`    |    ✅     | `MasterCriterionAppService.bulkRename`         | `CRITERIA_MASTER_UPDATE`     | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-008` | `APP_SERVICE_MUTATION`  | `src/services/app/PharmacopoeiaAppService.ts:45`                     | `MASTER_DATA`    |    ✅     | `PharmacopoeiaAppService.createStandard`       | `PHARMACOPOEIA_CREATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-009` | `APP_SERVICE_MUTATION`  | `src/services/app/PharmacopoeiaAppService.ts:74`                     | `MASTER_DATA`    |    ✅     | `PharmacopoeiaAppService.updateStandard`       | `PHARMACOPOEIA_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-010` | `APP_SERVICE_MUTATION`  | `src/services/app/PharmacopoeiaAppService.ts:101`                    | `MASTER_DATA`    |    ✅     | `PharmacopoeiaAppService.deleteStandard`       | `PHARMACOPOEIA_DELETE`       | `ADMIN`       |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-011` | `APP_SERVICE_MUTATION`  | `src/services/app/PharmacopoeiaAppService.ts:124`                    | `MASTER_DATA`    |    ✅     | `PharmacopoeiaAppService.seedDefaultStandards` | `PHARMACOPOEIA_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-012` | `APP_SERVICE_MUTATION`  | `src/services/app/SystemAppService.ts:65`                            | `SYSTEM`         |    ✅     | `SystemAppService.backupDatabase`              | `SYSTEM_BACKUP_EXECUTE`      | `ADMIN`       | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-013` | `APP_SERVICE_MUTATION`  | `src/services/app/SystemAppService.ts:96`                            | `SYSTEM`         |    ✅     | `SystemAppService.restoreDatabase`             | `SYSTEM_RESTORE_EXECUTE`     | `ADMIN`       |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-014` | `APP_SERVICE_MUTATION`  | `src/services/app/SystemAppService.ts:144`                           | `SYSTEM`         |    ✅     | `SystemAppService.wipeDatabase`                | `SYSTEM_WIPE_DEMO_EXECUTE`   | `ADMIN`       |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-015` | `APP_SERVICE_MUTATION`  | `src/services/app/SystemAppService.ts:185`                           | `SYSTEM`         |    ✅     | `SystemAppService.resetDemoData`               | `SYSTEM_WIPE_DEMO_EXECUTE`   | `ADMIN`       |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-016` | `REPOSITORY_WRITE`      | `src/repositories/firebase/BaseFirebaseRepository.ts:253`            | `SYSTEM`         |    ✅     | `BaseFirebaseRepository.save`                  | `SYSTEM_CONFIG_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-017` | `REPOSITORY_WRITE`      | `src/repositories/firebase/BaseFirebaseRepository.ts:262`            | `SYSTEM`         |    ✅     | `BaseFirebaseRepository.update`                | `SYSTEM_CONFIG_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-018` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseAILearnedMappingRepository.ts:24` | `SYSTEM`         |    ✅     | `FirebaseAILearnedMappingRepository.delete`    | `SYSTEM_CONFIG_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-019` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseApprovalTaskRepository.ts:32`     | `APPROVAL_TASK`  |    ✅     | `FirebaseApprovalTaskRepository.delete`        | `APPROVAL_TASK_DECIDE`       | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-020` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseBatchRepository.ts:43`            | `BATCH`          |    ✅     | `FirebaseBatchRepository.updateStatus`         | `BATCH_DISPATCH_TESTING`     | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-021` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseBatchRepository.ts:54`            | `BATCH`          |    ✅     | `FirebaseBatchRepository.updateProgress`       | `BATCH_UPDATE_METADATA`      | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-022` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseBatchRepository.ts:61`            | `BATCH`          |    ✅     | `FirebaseBatchRepository.delete`               | `BATCH_DELETE`               | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-023` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseChangeControlRepository.ts:26`    | `CHANGE_REQUEST` |    ✅     | `FirebaseChangeControlRepository.delete`       | `CHANGE_REQUEST_FMEA_ASSESS` | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-024` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseCriteriaAliasRepository.ts:23`    | `MASTER_DATA`    |    ✅     | `FirebaseCriteriaAliasRepository.delete`       | `CRITERIA_MASTER_UPDATE`     | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-025` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseDeviationRepository.ts:23`        | `DEVIATION`      |    ✅     | `FirebaseDeviationRepository.updateStatus`     | `DEVIATION_INVESTIGATE`      | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-026` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseDeviationRepository.ts:39`        | `DEVIATION`      |    ✅     | `FirebaseDeviationRepository.delete`           | `DEVIATION_INVESTIGATE`      | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-027` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseFormulaRepository.ts:24`          | `FORMULA`        |    ✅     | `FirebaseFormulaRepository.delete`             | `FORMULA_UPDATE`             | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-028` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseLaboratoryRepository.ts:13`       | `MASTER_DATA`    |    ✅     | `FirebaseLaboratoryRepository.delete`          | `LAB_MASTER_UPDATE`          | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-029` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseMasterCriterionRepository.ts:49`  | `MASTER_DATA`    |    ✅     | `FirebaseMasterCriterionRepository.delete`     | `CRITERIA_MASTER_UPDATE`     | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-030` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseMaterialRepository.ts:42`         | `MATERIAL`       |    ✅     | `FirebaseMaterialRepository.delete`            | `MATERIAL_DELETE`            | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-031` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebasePharmacopoeiaRepository.ts:13`    | `MASTER_DATA`    |    ✅     | `FirebasePharmacopoeiaRepository.delete`       | `PHARMACOPOEIA_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-032` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseProductRepository.ts:35`          | `PRODUCT`        |    ✅     | `FirebaseProductRepository.delete`             | `PRODUCT_ARCHIVE`            | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-033` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseTCCSRepository.ts:34`             | `TCCS`           |    ✅     | `FirebaseTCCSRepository.delete`                | `TCCS_UPDATE_DRAFT`          | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-034` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseTestResultRepository.ts:42`       | `TEST_RESULT`    |    ✅     | `FirebaseTestResultRepository.delete`          | `TEST_RESULT_DELETE`         | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-035` | `REPOSITORY_WRITE`      | `src/repositories/ILaboratoryRepository.ts:6`                        | `MASTER_DATA`    |    ✅     | `ILaboratoryRepository.save`                   | `LAB_MASTER_UPDATE`          | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-036` | `REPOSITORY_WRITE`      | `src/repositories/ILaboratoryRepository.ts:7`                        | `MASTER_DATA`    |    ✅     | `ILaboratoryRepository.update`                 | `LAB_MASTER_UPDATE`          | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-037` | `REPOSITORY_WRITE`      | `src/repositories/ILaboratoryRepository.ts:8`                        | `MASTER_DATA`    |    ✅     | `ILaboratoryRepository.delete`                 | `LAB_MASTER_UPDATE`          | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-038` | `REPOSITORY_WRITE`      | `src/repositories/interfaces/IBatchRepository.ts:12`                 | `BATCH`          |    ✅     | `IBatchRepository.updateStatus`                | `BATCH_DISPATCH_TESTING`     | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-039` | `REPOSITORY_WRITE`      | `src/repositories/interfaces/IBatchRepository.ts:13`                 | `BATCH`          |    ✅     | `IBatchRepository.updateProgress`              | `BATCH_UPDATE_METADATA`      | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-040` | `REPOSITORY_WRITE`      | `src/repositories/interfaces/IDeviationRepository.ts:10`             | `DEVIATION`      |    ✅     | `IDeviationRepository.updateStatus`            | `DEVIATION_INVESTIGATE`      | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-041` | `REPOSITORY_WRITE`      | `src/repositories/interfaces/IPharmacopoeiaRepository.ts:10`         | `MASTER_DATA`    |    ✅     | `IPharmacopoeiaRepository.save`                | `PHARMACOPOEIA_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-042` | `REPOSITORY_WRITE`      | `src/repositories/interfaces/IPharmacopoeiaRepository.ts:11`         | `MASTER_DATA`    |    ✅     | `IPharmacopoeiaRepository.update`              | `PHARMACOPOEIA_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-043` | `REPOSITORY_WRITE`      | `src/repositories/interfaces/IPharmacopoeiaRepository.ts:12`         | `MASTER_DATA`    |    ✅     | `IPharmacopoeiaRepository.delete`              | `PHARMACOPOEIA_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-044` | `REPOSITORY_WRITE`      | `src/repositories/IPharmacopoeiaRepository.ts:6`                     | `MASTER_DATA`    |    ✅     | `IPharmacopoeiaRepository.save`                | `PHARMACOPOEIA_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-045` | `REPOSITORY_WRITE`      | `src/repositories/IPharmacopoeiaRepository.ts:7`                     | `MASTER_DATA`    |    ✅     | `IPharmacopoeiaRepository.update`              | `PHARMACOPOEIA_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-046` | `REPOSITORY_WRITE`      | `src/repositories/IPharmacopoeiaRepository.ts:8`                     | `MASTER_DATA`    |    ✅     | `IPharmacopoeiaRepository.delete`              | `PHARMACOPOEIA_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-047` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/aiInsightsTool.ts:1`                          | `SYSTEM`         |    ❌     | `aiInsightsTool.execute`                       | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-048` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/autoHealingTool.ts:1`                         | `SYSTEM`         |    ❌     | `autoHealingTool.execute`                      | `SYSTEM_AUTO_HEAL_PROPOSE`   | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-049` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/batchActionTools.ts:1`                        | `BATCH`          |    ❌     | `batchActionTools.execute`                     | `AI_BATCH_CLEARANCE_PROPOSE` | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-050` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/batchSummaryTool.ts:1`                        | `SYSTEM`         |    ❌     | `batchSummaryTool.execute`                     | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-051` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/dataIntegrityTool.ts:1`                       | `SYSTEM`         |    ❌     | `dataIntegrityTool.execute`                    | `AI_DATA_INTEGRITY_SCAN`     | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-052` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/deviationReportTool.ts:1`                     | `SYSTEM`         |    ❌     | `deviationReportTool.execute`                  | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-053` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/labComparisonTool.ts:1`                       | `TEST_RESULT`    |    ❌     | `labComparisonTool.execute`                    | `AI_LAB_COMPARE`             | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-054` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/navigationTool.ts:1`                          | `SYSTEM`         |    ❌     | `navigationTool.execute`                       | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-055` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/nlQueryTool.ts:1`                             | `SYSTEM`         |    ❌     | `nlQueryTool.execute`                          | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-056` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/oosInvestigationTool.ts:1`                    | `SYSTEM`         |    ❌     | `oosInvestigationTool.execute`                 | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-057` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/pharmacopoeiaTool.ts:1`                       | `SYSTEM`         |    ❌     | `pharmacopoeiaTool.execute`                    | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-058` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/productionSynthesisTool.ts:1`                 | `SYSTEM`         |    ❌     | `productionSynthesisTool.execute`              | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-059` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/qualityReportTool.ts:1`                       | `SYSTEM`         |    ❌     | `qualityReportTool.execute`                    | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-060` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/qualityRiskTool.ts:1`                         | `SYSTEM`         |    ❌     | `qualityRiskTool.execute`                      | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-061` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/qualityTrendTool.ts:1`                        | `SYSTEM`         |    ❌     | `qualityTrendTool.execute`                     | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-062` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/rootCauseAnalysisTool.ts:1`                   | `SYSTEM`         |    ❌     | `rootCauseAnalysisTool.execute`                | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-063` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/stabilityPredictionTool.ts:1`                 | `BATCH`          |    ❌     | `stabilityPredictionTool.execute`              | `AI_STABILITY_PREDICT`       | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-064` | `UI_FORM_SUBMIT`        | `src/pages/batches/BatchFormPage.tsx:57`                             | `BATCH`          |    ✅     | `handleSave`                                   | `BATCH_CREATE`               | `PRODUCTION`  |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-065` | `UI_FORM_SUBMIT`        | `src/pages/products/MaterialFormPage.tsx:142`                        | `PRODUCT`        |    ✅     | `handleSave`                                   | `PRODUCT_UPDATE`             | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-066` | `UI_FORM_SUBMIT`        | `src/pages/products/ProductFormPage.tsx:181`                         | `PRODUCT`        |    ✅     | `handleSave`                                   | `PRODUCT_UPDATE`             | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-067` | `UI_FORM_SUBMIT`        | `src/pages/qa/CriteriaFormPage.tsx:173`                              | `SYSTEM`         |    ✅     | `handleSave`                                   | `SYSTEM_CONFIG_UPDATE`       | `USER`        | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-068` | `UI_FORM_SUBMIT`        | `src/pages/qa/ProductFormulaFormPage.tsx:165`                        | `SYSTEM`         |    ✅     | `handleSave`                                   | `SYSTEM_CONFIG_UPDATE`       | `USER`        | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-069` | `UI_FORM_SUBMIT`        | `src/pages/qa/TCCSFormPage.tsx:333`                                  | `TCCS`           |    ✅     | `handleSave`                                   | `TCCS_CREATE`                | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-070` | `UI_FORM_SUBMIT`        | `src/pages/system/components/PharmacopoeiaManager.tsx:107`           | `SYSTEM`         |    ✅     | `handleSave`                                   | `SYSTEM_CONFIG_UPDATE`       | `USER`        | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-071` | `FILE_EXPORT`           | `src/utils/excelExporter.ts:1`                                       | `SYSTEM`         |    ❌     | `exportToExcel`                                | `EXCEL_DATA_EXPORT`          | `USER`        |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-072` | `FILE_UPLOAD`           | `src/services/storageService.ts:1`                                   | `SYSTEM`         |    ✅     | `uploadFile`                                   | `FILE_STORAGE_UPLOAD`        | `USER`        | `MEDIUM` | `ADAPTER_BRIDGED` |
| `ACT-073` | `CLOUD_FUNCTION_CALL`   | `src/services/cloudFunctionsService.ts:1`                            | `SYSTEM`         |    ❌     | `callCloudFunction`                            | `CLOUD_FUNCTION_INVOKE`      | `SYSTEM`      |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-074` | `SYSTEM_BACKGROUND_JOB` | `src/services/dataConsistencyService.ts:1`                           | `SYSTEM`         |    ✅     | `executeAutoHealingPlan`                       | `SYSTEM_AUTO_HEAL_EXECUTE`   | `ADMIN`       |  `HIGH`  |  `LEGACY_DIRECT`  |

---

## 3. KẾT LUẬN & ĐIỀU KIỆN MỞ CỔNG (PHASE 0 GATE SIGN-OFF)

1. **Gate Criteria**: 100% Activities đã được phân loại; 0 Unmapped; 0 Orphan.
2. **Kế hoạch tiếp theo (Phase 1)**: Xây dựng workflow kernel thực thi (`UnifiedWorkflowExecutor` nâng cấp) và bộ adapters (`LegacyServiceAdapter`) làm cầu nối trước khi chuyển UI ở Phase 2.
