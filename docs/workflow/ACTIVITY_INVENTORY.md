# 📋 PQM ACTIVITY INVENTORY & COVERAGE REGISTER

> **Mã tài liệu**: `PQM-ACT-INV-001`  
> **Phiên bản**: `1.0.0-BASELINE`  
> **Thời điểm xuất**: `2026-09-27T02:11:31.337Z`  
> **Trạng thái Gate**: `PASSED` (Phân loại: **100%**)

---

## 1. TỔNG QUAN THỐNG KÊ (SYSTEM METRICS)

- **Tổng số Activities đã kiểm kê**: **59**
- **Hoạt động chưa map (UNMAPPED)**: **0**
- **Hoạt động mồ côi (ORPHAN)**: **0**
- **Tỷ lệ bao phủ phân loại**: **100%**

### 1.1. Phân bố theo Mức độ rủi ro (Risk Level)

| Mức độ rủi ro     | Số lượng | Tỷ lệ | Mô tả                                                                           |
| :---------------- | :------: | :---: | :------------------------------------------------------------------------------ |
| 🔴 **HIGH**       |    16    |  27%  | Tác động trực tiếp tới chất lượng thuốc, phát hành lô, phê duyệt hồ sơ pháp lý. |
| 🟡 **MEDIUM**     |    20    |  34%  | Sửa đổi thông tin master data, phân công nhiệm vụ, cập nhật tiến độ.            |
| 🟢 **LOW / NONE** |    23    |  39%  | Truy vấn dữ liệu, gợi ý AI proposal, xuất file báo cáo.                         |

### 1.2. Phân bố theo Thực thể (Entity Breakdown)

| Thực thể         | Số lượng hoạt động | Hành động đại diện         |
| :--------------- | :----------------: | :------------------------- |
| `SYSTEM`         |         24         | SYSTEM_CONFIG_UPDATE       |
| `APPROVAL_TASK`  |         1          | APPROVAL_TASK_DECIDE       |
| `BATCH`          |         8          | BATCH_DISPATCH_TESTING     |
| `CHANGE_REQUEST` |         1          | CHANGE_REQUEST_FMEA_ASSESS |
| `MASTER_DATA`    |         13         | CRITERIA_MASTER_UPDATE     |
| `DEVIATION`      |         3          | DEVIATION_INVESTIGATE      |
| `FORMULA`        |         1          | FORMULA_UPDATE             |
| `MATERIAL`       |         1          | MATERIAL_DELETE            |
| `PRODUCT`        |         3          | PRODUCT_ARCHIVE            |
| `TCCS`           |         2          | TCCS_UPDATE_DRAFT          |
| `TEST_RESULT`    |         2          | TEST_RESULT_DELETE         |

### 1.3. Phân bố theo Vai trò thực hiện (Owner Roles)

| Vai trò       | Số lượng | Thẩm quyền cốt lõi                   |
| :------------ | :------: | :----------------------------------- |
| `QA`          |    34    | Quyền thao tác theo quy định ADR-001 |
| `AI_ADVISORY` |    17    | Quyền thao tác theo quy định ADR-001 |
| `PRODUCTION`  |    1     | Quyền thao tác theo quy định ADR-001 |
| `USER`        |    5     | Quyền thao tác theo quy định ADR-001 |
| `SYSTEM`      |    1     | Quyền thao tác theo quy định ADR-001 |
| `ADMIN`       |    1     | Quyền thao tác theo quy định ADR-001 |

---

## 2. BẢNG CHI TIẾT HOẠT ĐỘNG TOÀN HỆ THỐNG (ACTIVITY INVENTORY MATRIX)

| ID        | Trigger                 | Location                                                             | Entity           | Mutation? | Current Path                                | Desired Canonical Action     | Owner         |   Risk   |       State       |
| :-------- | :---------------------- | :------------------------------------------------------------------- | :--------------- | :-------: | :------------------------------------------ | :--------------------------- | :------------ | :------: | :---------------: |
| `ACT-001` | `REPOSITORY_WRITE`      | `src/repositories/firebase/BaseFirebaseRepository.ts:253`            | `SYSTEM`         |    ✅     | `BaseFirebaseRepository.save`               | `SYSTEM_CONFIG_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-002` | `REPOSITORY_WRITE`      | `src/repositories/firebase/BaseFirebaseRepository.ts:262`            | `SYSTEM`         |    ✅     | `BaseFirebaseRepository.update`             | `SYSTEM_CONFIG_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-003` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseAILearnedMappingRepository.ts:24` | `SYSTEM`         |    ✅     | `FirebaseAILearnedMappingRepository.delete` | `SYSTEM_CONFIG_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-004` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseApprovalTaskRepository.ts:32`     | `APPROVAL_TASK`  |    ✅     | `FirebaseApprovalTaskRepository.delete`     | `APPROVAL_TASK_DECIDE`       | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-005` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseBatchRepository.ts:43`            | `BATCH`          |    ✅     | `FirebaseBatchRepository.updateStatus`      | `BATCH_DISPATCH_TESTING`     | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-006` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseBatchRepository.ts:54`            | `BATCH`          |    ✅     | `FirebaseBatchRepository.updateProgress`    | `BATCH_UPDATE_METADATA`      | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-007` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseBatchRepository.ts:61`            | `BATCH`          |    ✅     | `FirebaseBatchRepository.delete`            | `BATCH_DELETE`               | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-008` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseChangeControlRepository.ts:26`    | `CHANGE_REQUEST` |    ✅     | `FirebaseChangeControlRepository.delete`    | `CHANGE_REQUEST_FMEA_ASSESS` | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-009` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseCriteriaAliasRepository.ts:23`    | `MASTER_DATA`    |    ✅     | `FirebaseCriteriaAliasRepository.delete`    | `CRITERIA_MASTER_UPDATE`     | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-010` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseDeviationRepository.ts:23`        | `DEVIATION`      |    ✅     | `FirebaseDeviationRepository.updateStatus`  | `DEVIATION_INVESTIGATE`      | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-011` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseDeviationRepository.ts:39`        | `DEVIATION`      |    ✅     | `FirebaseDeviationRepository.delete`        | `DEVIATION_INVESTIGATE`      | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-012` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseFormulaRepository.ts:24`          | `FORMULA`        |    ✅     | `FirebaseFormulaRepository.delete`          | `FORMULA_UPDATE`             | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-013` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseLaboratoryRepository.ts:13`       | `MASTER_DATA`    |    ✅     | `FirebaseLaboratoryRepository.delete`       | `LAB_MASTER_UPDATE`          | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-014` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseMasterCriterionRepository.ts:49`  | `MASTER_DATA`    |    ✅     | `FirebaseMasterCriterionRepository.delete`  | `CRITERIA_MASTER_UPDATE`     | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-015` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseMaterialRepository.ts:42`         | `MATERIAL`       |    ✅     | `FirebaseMaterialRepository.delete`         | `MATERIAL_DELETE`            | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-016` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebasePharmacopoeiaRepository.ts:13`    | `MASTER_DATA`    |    ✅     | `FirebasePharmacopoeiaRepository.delete`    | `PHARMACOPOEIA_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-017` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseProductRepository.ts:35`          | `PRODUCT`        |    ✅     | `FirebaseProductRepository.delete`          | `PRODUCT_ARCHIVE`            | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-018` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseTCCSRepository.ts:34`             | `TCCS`           |    ✅     | `FirebaseTCCSRepository.delete`             | `TCCS_UPDATE_DRAFT`          | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-019` | `REPOSITORY_WRITE`      | `src/repositories/firebase/FirebaseTestResultRepository.ts:42`       | `TEST_RESULT`    |    ✅     | `FirebaseTestResultRepository.delete`       | `TEST_RESULT_DELETE`         | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-020` | `REPOSITORY_WRITE`      | `src/repositories/ILaboratoryRepository.ts:6`                        | `MASTER_DATA`    |    ✅     | `ILaboratoryRepository.save`                | `LAB_MASTER_UPDATE`          | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-021` | `REPOSITORY_WRITE`      | `src/repositories/ILaboratoryRepository.ts:7`                        | `MASTER_DATA`    |    ✅     | `ILaboratoryRepository.update`              | `LAB_MASTER_UPDATE`          | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-022` | `REPOSITORY_WRITE`      | `src/repositories/ILaboratoryRepository.ts:8`                        | `MASTER_DATA`    |    ✅     | `ILaboratoryRepository.delete`              | `LAB_MASTER_UPDATE`          | `QA`          |  `LOW`   |  `LEGACY_DIRECT`  |
| `ACT-023` | `REPOSITORY_WRITE`      | `src/repositories/interfaces/IBatchRepository.ts:12`                 | `BATCH`          |    ✅     | `IBatchRepository.updateStatus`             | `BATCH_DISPATCH_TESTING`     | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-024` | `REPOSITORY_WRITE`      | `src/repositories/interfaces/IBatchRepository.ts:13`                 | `BATCH`          |    ✅     | `IBatchRepository.updateProgress`           | `BATCH_UPDATE_METADATA`      | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-025` | `REPOSITORY_WRITE`      | `src/repositories/interfaces/IDeviationRepository.ts:10`             | `DEVIATION`      |    ✅     | `IDeviationRepository.updateStatus`         | `DEVIATION_INVESTIGATE`      | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-026` | `REPOSITORY_WRITE`      | `src/repositories/interfaces/IPharmacopoeiaRepository.ts:10`         | `MASTER_DATA`    |    ✅     | `IPharmacopoeiaRepository.save`             | `PHARMACOPOEIA_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-027` | `REPOSITORY_WRITE`      | `src/repositories/interfaces/IPharmacopoeiaRepository.ts:11`         | `MASTER_DATA`    |    ✅     | `IPharmacopoeiaRepository.update`           | `PHARMACOPOEIA_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-028` | `REPOSITORY_WRITE`      | `src/repositories/interfaces/IPharmacopoeiaRepository.ts:12`         | `MASTER_DATA`    |    ✅     | `IPharmacopoeiaRepository.delete`           | `PHARMACOPOEIA_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-029` | `REPOSITORY_WRITE`      | `src/repositories/IPharmacopoeiaRepository.ts:6`                     | `MASTER_DATA`    |    ✅     | `IPharmacopoeiaRepository.save`             | `PHARMACOPOEIA_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-030` | `REPOSITORY_WRITE`      | `src/repositories/IPharmacopoeiaRepository.ts:7`                     | `MASTER_DATA`    |    ✅     | `IPharmacopoeiaRepository.update`           | `PHARMACOPOEIA_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-031` | `REPOSITORY_WRITE`      | `src/repositories/IPharmacopoeiaRepository.ts:8`                     | `MASTER_DATA`    |    ✅     | `IPharmacopoeiaRepository.delete`           | `PHARMACOPOEIA_UPDATE`       | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-032` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/aiInsightsTool.ts:1`                          | `SYSTEM`         |    ❌     | `aiInsightsTool.execute`                    | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-033` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/autoHealingTool.ts:1`                         | `SYSTEM`         |    ❌     | `autoHealingTool.execute`                   | `SYSTEM_AUTO_HEAL_PROPOSE`   | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-034` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/batchActionTools.ts:1`                        | `BATCH`          |    ❌     | `batchActionTools.execute`                  | `AI_BATCH_CLEARANCE_PROPOSE` | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-035` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/batchSummaryTool.ts:1`                        | `SYSTEM`         |    ❌     | `batchSummaryTool.execute`                  | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-036` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/dataIntegrityTool.ts:1`                       | `SYSTEM`         |    ❌     | `dataIntegrityTool.execute`                 | `AI_DATA_INTEGRITY_SCAN`     | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-037` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/deviationReportTool.ts:1`                     | `SYSTEM`         |    ❌     | `deviationReportTool.execute`               | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-038` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/labComparisonTool.ts:1`                       | `TEST_RESULT`    |    ❌     | `labComparisonTool.execute`                 | `AI_LAB_COMPARE`             | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-039` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/navigationTool.ts:1`                          | `SYSTEM`         |    ❌     | `navigationTool.execute`                    | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-040` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/nlQueryTool.ts:1`                             | `SYSTEM`         |    ❌     | `nlQueryTool.execute`                       | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-041` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/oosInvestigationTool.ts:1`                    | `SYSTEM`         |    ❌     | `oosInvestigationTool.execute`              | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-042` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/pharmacopoeiaTool.ts:1`                       | `SYSTEM`         |    ❌     | `pharmacopoeiaTool.execute`                 | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-043` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/productionSynthesisTool.ts:1`                 | `SYSTEM`         |    ❌     | `productionSynthesisTool.execute`           | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-044` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/qualityReportTool.ts:1`                       | `SYSTEM`         |    ❌     | `qualityReportTool.execute`                 | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-045` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/qualityRiskTool.ts:1`                         | `SYSTEM`         |    ❌     | `qualityRiskTool.execute`                   | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-046` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/qualityTrendTool.ts:1`                        | `SYSTEM`         |    ❌     | `qualityTrendTool.execute`                  | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-047` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/rootCauseAnalysisTool.ts:1`                   | `SYSTEM`         |    ❌     | `rootCauseAnalysisTool.execute`             | `AI_NATURAL_QUERY`           | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-048` | `AI_TOOL_EXECUTE`       | `src/services/ai/tools/stabilityPredictionTool.ts:1`                 | `BATCH`          |    ❌     | `stabilityPredictionTool.execute`           | `AI_STABILITY_PREDICT`       | `AI_ADVISORY` |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-049` | `UI_FORM_SUBMIT`        | `src/pages/batches/BatchFormPage.tsx:57`                             | `BATCH`          |    ✅     | `handleSave`                                | `BATCH_CREATE`               | `PRODUCTION`  |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-050` | `UI_FORM_SUBMIT`        | `src/pages/products/MaterialFormPage.tsx:142`                        | `PRODUCT`        |    ✅     | `handleSave`                                | `PRODUCT_UPDATE`             | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-051` | `UI_FORM_SUBMIT`        | `src/pages/products/ProductFormPage.tsx:181`                         | `PRODUCT`        |    ✅     | `handleSave`                                | `PRODUCT_UPDATE`             | `QA`          | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-052` | `UI_FORM_SUBMIT`        | `src/pages/qa/CriteriaFormPage.tsx:173`                              | `SYSTEM`         |    ✅     | `handleSave`                                | `SYSTEM_CONFIG_UPDATE`       | `USER`        | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-053` | `UI_FORM_SUBMIT`        | `src/pages/qa/ProductFormulaFormPage.tsx:165`                        | `SYSTEM`         |    ✅     | `handleSave`                                | `SYSTEM_CONFIG_UPDATE`       | `USER`        | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-054` | `UI_FORM_SUBMIT`        | `src/pages/qa/TCCSFormPage.tsx:333`                                  | `TCCS`           |    ✅     | `handleSave`                                | `TCCS_CREATE`                | `QA`          |  `HIGH`  |  `LEGACY_DIRECT`  |
| `ACT-055` | `UI_FORM_SUBMIT`        | `src/pages/system/components/PharmacopoeiaManager.tsx:107`           | `SYSTEM`         |    ✅     | `handleSave`                                | `SYSTEM_CONFIG_UPDATE`       | `USER`        | `MEDIUM` |  `LEGACY_DIRECT`  |
| `ACT-056` | `FILE_EXPORT`           | `src/utils/excelExporter.ts:1`                                       | `SYSTEM`         |    ❌     | `exportToExcel`                             | `EXCEL_DATA_EXPORT`          | `USER`        |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-057` | `FILE_UPLOAD`           | `src/services/storageService.ts:1`                                   | `SYSTEM`         |    ✅     | `uploadFile`                                | `FILE_STORAGE_UPLOAD`        | `USER`        | `MEDIUM` | `ADAPTER_BRIDGED` |
| `ACT-058` | `CLOUD_FUNCTION_CALL`   | `src/services/cloudFunctionsService.ts:1`                            | `SYSTEM`         |    ❌     | `callCloudFunction`                         | `CLOUD_FUNCTION_INVOKE`      | `SYSTEM`      |  `LOW`   | `ADAPTER_BRIDGED` |
| `ACT-059` | `SYSTEM_BACKGROUND_JOB` | `src/services/dataConsistencyService.ts:1`                           | `SYSTEM`         |    ✅     | `executeAutoHealingPlan`                    | `SYSTEM_AUTO_HEAL_EXECUTE`   | `ADMIN`       |  `HIGH`  |  `LEGACY_DIRECT`  |

---

## 3. KẾT LUẬN & ĐIỀU KIỆN MỞ CỔNG (PHASE 0 GATE SIGN-OFF)

1. **Gate Criteria**: 100% Activities đã được phân loại; 0 Unmapped; 0 Orphan.
2. **Kế hoạch tiếp theo (Phase 1)**: Xây dựng workflow kernel thực thi (`UnifiedWorkflowExecutor` nâng cấp) và bộ adapters (`LegacyServiceAdapter`) làm cầu nối trước khi chuyển UI ở Phase 2.
