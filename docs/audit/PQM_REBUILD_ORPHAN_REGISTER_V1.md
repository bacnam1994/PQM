# 🛡️ PQM — SỔ KIỂM TRA ZERO ORPHAN / ZERO BYPASS (REBUILD READINESS GATE R0.5)

> **Căn cứ**: PQM — REBUILD READINESS GATE  
> **Thời điểm thẩm định**: 2026-09-25T07:14:18.878Z  
> **Tổng số hoạt động runtime**: **122**  
> **Kết luận**: **ORPHAN = 0, BYPASS = 0**

---

## 1. BẢNG CHI TIẾT NGUỒN MUTATION (SOURCE MUTATION TRACEABILITY)

| Source File                                                       | Mutation Method                                | Caller Component/Hook   | Action ID                        | Target Workflow                     |   Status    |
| :---------------------------------------------------------------- | :--------------------------------------------- | :---------------------- | :------------------------------- | :---------------------------------- | :---------: |
| `src/services/app/BatchAppService.ts`                             | `BatchAppService.createBatch`                  | `APP_SERVICE_MUTATION`  | `BATCH_CREATE`                   | `WF_BATCH_CREATE`                   | ✅ VERIFIED |
| `src/services/app/BatchAppService.ts`                             | `BatchAppService.updateBatch`                  | `APP_SERVICE_MUTATION`  | `BATCH_UPDATE_METADATA`          | `WF_BATCH_UPDATE_METADATA`          | ✅ VERIFIED |
| `src/services/app/BatchAppService.ts`                             | `BatchAppService.updateStatus`                 | `APP_SERVICE_MUTATION`  | `BATCH_UPDATE_METADATA`          | `WF_BATCH_UPDATE_METADATA`          | ✅ VERIFIED |
| `src/services/app/BatchAppService.ts`                             | `BatchAppService.updateProgress`               | `APP_SERVICE_MUTATION`  | `BATCH_UPDATE_METADATA`          | `WF_BATCH_UPDATE_METADATA`          | ✅ VERIFIED |
| `src/services/app/BatchAppService.ts`                             | `BatchAppService.deleteBatch`                  | `APP_SERVICE_MUTATION`  | `BATCH_DELETE`                   | `WF_BATCH_DELETE`                   | ✅ VERIFIED |
| `src/services/app/CAPAService.ts`                                 | `CAPAService.addCapaAction`                    | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/CAPAService.ts`                                 | `CAPAService.completeCapaAction`               | `APP_SERVICE_MUTATION`  | `CAPA_EXECUTE`                   | `WF_CAPA_EXECUTE`                   | ✅ VERIFIED |
| `src/services/app/CAPAService.ts`                                 | `CAPAService.verifyAndCloseCAPA`               | `APP_SERVICE_MUTATION`  | `CAPA_VERIFY`                    | `WF_CAPA_VERIFY`                    | ✅ VERIFIED |
| `src/services/app/ChangeControlAppService.ts`                     | `ChangeControlAppService.createChangeRequest`  | `APP_SERVICE_MUTATION`  | `CHANGE_REQUEST_CREATE`          | `WF_CHANGE_REQUEST_CREATE`          | ✅ VERIFIED |
| `src/services/app/ChangeControlAppService.ts`                     | `ChangeControlAppService.assessFMEARisk`       | `APP_SERVICE_MUTATION`  | `CHANGE_REQUEST_FMEA_ASSESS`     | `WF_CHANGE_REQUEST_FMEA_ASSESS`     | ✅ VERIFIED |
| `src/services/app/ChangeControlAppService.ts`                     | `ChangeControlAppService.addActionItem`        | `APP_SERVICE_MUTATION`  | `CHANGE_REQUEST_ADD_ACTION`      | `WF_CHANGE_REQUEST_ADD_ACTION`      | ✅ VERIFIED |
| `src/services/app/ChangeControlAppService.ts`                     | `ChangeControlAppService.completeActionItem`   | `APP_SERVICE_MUTATION`  | `CHANGE_REQUEST_COMPLETE_ACTION` | `WF_CHANGE_REQUEST_COMPLETE_ACTION` | ✅ VERIFIED |
| `src/services/app/ChangeControlAppService.ts`                     | `ChangeControlAppService.updateStatus`         | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/CoAService.ts`                                  | `CoAService.generateCoAPayloadAsync`           | `APP_SERVICE_MUTATION`  | `COA_GENERATE`                   | `WF_COA_GENERATE`                   | ✅ VERIFIED |
| `src/services/app/CoAService.ts`                                  | `CoAService.signCoA`                           | `APP_SERVICE_MUTATION`  | `COA_SIGN`                       | `WF_COA_SIGN`                       | ✅ VERIFIED |
| `src/services/app/CoAService.ts`                                  | `CoAService.revokeCoA`                         | `APP_SERVICE_MUTATION`  | `COA_REVOKE`                     | `WF_COA_REVOKE`                     | ✅ VERIFIED |
| `src/services/app/DeviationAppService.ts`                         | `DeviationAppService.createDeviation`          | `APP_SERVICE_MUTATION`  | `DEVIATION_CREATE`               | `WF_DEVIATION_CREATE`               | ✅ VERIFIED |
| `src/services/app/DeviationAppService.ts`                         | `DeviationAppService.autoLogFromOOS`           | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/DeviationAppService.ts`                         | `DeviationAppService.updateStatus`             | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/DeviationAppService.ts`                         | `DeviationAppService.addCAPAItem`              | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/DeviationAppService.ts`                         | `DeviationAppService.completeCAPAItem`         | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/DeviationAppService.ts`                         | `DeviationAppService.deleteDeviation`          | `APP_SERVICE_MUTATION`  | `DEVIATION_DELETE`               | `WF_DEVIATION_DELETE`               | ✅ VERIFIED |
| `src/services/app/FormulaAppService.ts`                           | `FormulaAppService.createFormula`              | `APP_SERVICE_MUTATION`  | `FORMULA_CREATE`                 | `WF_FORMULA_CREATE`                 | ✅ VERIFIED |
| `src/services/app/FormulaAppService.ts`                           | `FormulaAppService.updateFormula`              | `APP_SERVICE_MUTATION`  | `FORMULA_UPDATE`                 | `WF_FORMULA_UPDATE`                 | ✅ VERIFIED |
| `src/services/app/FormulaAppService.ts`                           | `FormulaAppService.deleteFormula`              | `APP_SERVICE_MUTATION`  | `FORMULA_ARCHIVE`                | `WF_FORMULA_ARCHIVE`                | ✅ VERIFIED |
| `src/services/app/LaboratoryAppService.ts`                        | `LaboratoryAppService.createLaboratory`        | `APP_SERVICE_MUTATION`  | `LAB_MASTER_CREATE`              | `WF_LAB_MASTER_CREATE`              | ✅ VERIFIED |
| `src/services/app/LaboratoryAppService.ts`                        | `LaboratoryAppService.updateLaboratory`        | `APP_SERVICE_MUTATION`  | `LAB_MASTER_UPDATE`              | `WF_LAB_MASTER_UPDATE`              | ✅ VERIFIED |
| `src/services/app/LaboratoryAppService.ts`                        | `LaboratoryAppService.deleteLaboratory`        | `APP_SERVICE_MUTATION`  | `LAB_MASTER_UPDATE`              | `WF_LAB_MASTER_UPDATE`              | ✅ VERIFIED |
| `src/services/app/MasterCriterionAppService.ts`                   | `MasterCriterionAppService.create`             | `APP_SERVICE_MUTATION`  | `CRITERIA_MASTER_CREATE`         | `WF_CRITERIA_MASTER_CREATE`         | ✅ VERIFIED |
| `src/services/app/MasterCriterionAppService.ts`                   | `MasterCriterionAppService.update`             | `APP_SERVICE_MUTATION`  | `CRITERIA_MASTER_UPDATE`         | `WF_CRITERIA_MASTER_UPDATE`         | ✅ VERIFIED |
| `src/services/app/MasterCriterionAppService.ts`                   | `MasterCriterionAppService.delete`             | `APP_SERVICE_MUTATION`  | `CRITERIA_MASTER_UPDATE`         | `WF_CRITERIA_MASTER_UPDATE`         | ✅ VERIFIED |
| `src/services/app/MasterCriterionAppService.ts`                   | `MasterCriterionAppService.bulkRename`         | `APP_SERVICE_MUTATION`  | `CRITERIA_MASTER_UPDATE`         | `WF_CRITERIA_MASTER_UPDATE`         | ✅ VERIFIED |
| `src/services/app/MaterialAppService.ts`                          | `MaterialAppService.createMaterial`            | `APP_SERVICE_MUTATION`  | `MATERIAL_CREATE`                | `WF_MATERIAL_CREATE`                | ✅ VERIFIED |
| `src/services/app/MaterialAppService.ts`                          | `MaterialAppService.updateMaterial`            | `APP_SERVICE_MUTATION`  | `MATERIAL_UPDATE`                | `WF_MATERIAL_UPDATE`                | ✅ VERIFIED |
| `src/services/app/MaterialAppService.ts`                          | `MaterialAppService.deleteMaterial`            | `APP_SERVICE_MUTATION`  | `MATERIAL_DELETE`                | `WF_MATERIAL_DELETE`                | ✅ VERIFIED |
| `src/services/app/OOSService.ts`                                  | `OOSService.triggerOOSInvestigation`           | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/OOSService.ts`                                  | `OOSService.submitPhase1Investigation`         | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/OOSService.ts`                                  | `OOSService.concludeOOSInvestigation`          | `APP_SERVICE_MUTATION`  | `OOS_CONCLUDE`                   | `WF_OOS_CONCLUDE`                   | ✅ VERIFIED |
| `src/services/app/PharmacopoeiaAppService.ts`                     | `PharmacopoeiaAppService.createStandard`       | `APP_SERVICE_MUTATION`  | `PHARMACOPOEIA_CREATE`           | `WF_PHARMACOPOEIA_CREATE`           | ✅ VERIFIED |
| `src/services/app/PharmacopoeiaAppService.ts`                     | `PharmacopoeiaAppService.updateStandard`       | `APP_SERVICE_MUTATION`  | `PHARMACOPOEIA_UPDATE`           | `WF_PHARMACOPOEIA_UPDATE`           | ✅ VERIFIED |
| `src/services/app/PharmacopoeiaAppService.ts`                     | `PharmacopoeiaAppService.deleteStandard`       | `APP_SERVICE_MUTATION`  | `PHARMACOPOEIA_DELETE`           | `WF_PHARMACOPOEIA_DELETE`           | ✅ VERIFIED |
| `src/services/app/PharmacopoeiaAppService.ts`                     | `PharmacopoeiaAppService.seedDefaultStandards` | `APP_SERVICE_MUTATION`  | `PHARMACOPOEIA_UPDATE`           | `WF_PHARMACOPOEIA_UPDATE`           | ✅ VERIFIED |
| `src/services/app/ProductAppService.ts`                           | `ProductAppService.createProduct`              | `APP_SERVICE_MUTATION`  | `PRODUCT_CREATE`                 | `WF_PRODUCT_CREATE`                 | ✅ VERIFIED |
| `src/services/app/ProductAppService.ts`                           | `ProductAppService.updateProduct`              | `APP_SERVICE_MUTATION`  | `PRODUCT_UPDATE`                 | `WF_PRODUCT_UPDATE`                 | ✅ VERIFIED |
| `src/services/app/ProductAppService.ts`                           | `ProductAppService.deleteProduct`              | `APP_SERVICE_MUTATION`  | `PRODUCT_ARCHIVE`                | `WF_PRODUCT_ARCHIVE`                | ✅ VERIFIED |
| `src/services/app/ProductAppService.ts`                           | `ProductAppService.bulkCreateProducts`         | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/ReleaseService.ts`                              | `ReleaseService.releaseBatch`                  | `APP_SERVICE_MUTATION`  | `BATCH_RELEASE_APPROVE`          | `WF_BATCH_RELEASE_APPROVE`          | ✅ VERIFIED |
| `src/services/app/ReleaseService.ts`                              | `ReleaseService.executeBatchHold`              | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/ReleaseService.ts`                              | `ReleaseService.executeBatchRecall`            | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/SystemAppService.ts`                            | `SystemAppService.backupDatabase`              | `APP_SERVICE_MUTATION`  | `SYSTEM_BACKUP_EXECUTE`          | `WF_SYSTEM_BACKUP_EXECUTE`          | ✅ VERIFIED |
| `src/services/app/SystemAppService.ts`                            | `SystemAppService.restoreDatabase`             | `APP_SERVICE_MUTATION`  | `SYSTEM_RESTORE_EXECUTE`         | `WF_SYSTEM_RESTORE_EXECUTE`         | ✅ VERIFIED |
| `src/services/app/SystemAppService.ts`                            | `SystemAppService.wipeDatabase`                | `APP_SERVICE_MUTATION`  | `SYSTEM_WIPE_DEMO_EXECUTE`       | `WF_SYSTEM_WIPE_DEMO_EXECUTE`       | ✅ VERIFIED |
| `src/services/app/SystemAppService.ts`                            | `SystemAppService.resetDemoData`               | `APP_SERVICE_MUTATION`  | `SYSTEM_WIPE_DEMO_EXECUTE`       | `WF_SYSTEM_WIPE_DEMO_EXECUTE`       | ✅ VERIFIED |
| `src/services/app/TCCSAppService.ts`                              | `TCCSAppService.createTCCS`                    | `APP_SERVICE_MUTATION`  | `TCCS_CREATE`                    | `WF_TCCS_CREATE`                    | ✅ VERIFIED |
| `src/services/app/TCCSAppService.ts`                              | `TCCSAppService.updateTCCS`                    | `APP_SERVICE_MUTATION`  | `TCCS_UPDATE_DRAFT`              | `WF_TCCS_UPDATE_DRAFT`              | ✅ VERIFIED |
| `src/services/app/TCCSAppService.ts`                              | `TCCSAppService.deleteTCCS`                    | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/TCCSAppService.ts`                              | `TCCSAppService.addAiLearnedMapping`           | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/TCCSAppService.ts`                              | `TCCSAppService.addCriteriaAlias`              | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/TCCSAppService.ts`                              | `TCCSAppService.updateCriteriaAlias`           | `APP_SERVICE_MUTATION`  | `TCCS_UPDATE_DRAFT`              | `WF_TCCS_UPDATE_DRAFT`              | ✅ VERIFIED |
| `src/services/app/TCCSAppService.ts`                              | `TCCSAppService.deleteCriteriaAlias`           | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/TCCSAppService.ts`                              | `TCCSAppService.confirmCriteriaAlias`          | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/TCCSAppService.ts`                              | `TCCSAppService.addAliasToExisting`            | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/services/app/TestResultAppService.ts`                        | `TestResultAppService.createTestResult`        | `APP_SERVICE_MUTATION`  | `TEST_RESULT_CREATE`             | `WF_TEST_RESULT_CREATE`             | ✅ VERIFIED |
| `src/services/app/TestResultAppService.ts`                        | `TestResultAppService.updateTestResult`        | `APP_SERVICE_MUTATION`  | `TEST_RESULT_ENTRY_INPUT`        | `WF_TEST_RESULT_ENTRY_INPUT`        | ✅ VERIFIED |
| `src/services/app/TestResultAppService.ts`                        | `TestResultAppService.updateWorkflowStatus`    | `APP_SERVICE_MUTATION`  | `TEST_RESULT_ENTRY_INPUT`        | `WF_TEST_RESULT_ENTRY_INPUT`        | ✅ VERIFIED |
| `src/services/app/TestResultAppService.ts`                        | `TestResultAppService.deleteTestResult`        | `APP_SERVICE_MUTATION`  | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/repositories/BatchRepository.ts`                             | `BatchRepository.updateStatus`                 | `REPOSITORY_WRITE`      | `BATCH_DISPATCH_TESTING`         | `WF_BATCH_DISPATCH_TESTING`         | ✅ VERIFIED |
| `src/repositories/BatchRepository.ts`                             | `BatchRepository.updateProgress`               | `REPOSITORY_WRITE`      | `BATCH_UPDATE_METADATA`          | `WF_BATCH_UPDATE_METADATA`          | ✅ VERIFIED |
| `src/repositories/firebase/BaseFirebaseRepository.ts`             | `BaseFirebaseRepository.save`                  | `REPOSITORY_WRITE`      | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/repositories/firebase/BaseFirebaseRepository.ts`             | `BaseFirebaseRepository.update`                | `REPOSITORY_WRITE`      | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/repositories/firebase/FirebaseAILearnedMappingRepository.ts` | `FirebaseAILearnedMappingRepository.delete`    | `REPOSITORY_WRITE`      | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/repositories/firebase/FirebaseApprovalTaskRepository.ts`     | `FirebaseApprovalTaskRepository.delete`        | `REPOSITORY_WRITE`      | `APPROVAL_TASK_DECIDE`           | `WF_APPROVAL_TASK_DECIDE`           | ✅ VERIFIED |
| `src/repositories/firebase/FirebaseBatchRepository.ts`            | `FirebaseBatchRepository.updateStatus`         | `REPOSITORY_WRITE`      | `BATCH_DISPATCH_TESTING`         | `WF_BATCH_DISPATCH_TESTING`         | ✅ VERIFIED |
| `src/repositories/firebase/FirebaseBatchRepository.ts`            | `FirebaseBatchRepository.updateProgress`       | `REPOSITORY_WRITE`      | `BATCH_UPDATE_METADATA`          | `WF_BATCH_UPDATE_METADATA`          | ✅ VERIFIED |
| `src/repositories/firebase/FirebaseBatchRepository.ts`            | `FirebaseBatchRepository.delete`               | `REPOSITORY_WRITE`      | `BATCH_DELETE`                   | `WF_BATCH_DELETE`                   | ✅ VERIFIED |
| `src/repositories/firebase/FirebaseChangeControlRepository.ts`    | `FirebaseChangeControlRepository.delete`       | `REPOSITORY_WRITE`      | `CHANGE_REQUEST_FMEA_ASSESS`     | `WF_CHANGE_REQUEST_FMEA_ASSESS`     | ✅ VERIFIED |
| `src/repositories/firebase/FirebaseCriteriaAliasRepository.ts`    | `FirebaseCriteriaAliasRepository.delete`       | `REPOSITORY_WRITE`      | `CRITERIA_MASTER_UPDATE`         | `WF_CRITERIA_MASTER_UPDATE`         | ✅ VERIFIED |
| `src/repositories/firebase/FirebaseDeviationRepository.ts`        | `FirebaseDeviationRepository.updateStatus`     | `REPOSITORY_WRITE`      | `DEVIATION_INVESTIGATE`          | `WF_DEVIATION_INVESTIGATE`          | ✅ VERIFIED |
| `src/repositories/firebase/FirebaseDeviationRepository.ts`        | `FirebaseDeviationRepository.delete`           | `REPOSITORY_WRITE`      | `DEVIATION_INVESTIGATE`          | `WF_DEVIATION_INVESTIGATE`          | ✅ VERIFIED |
| `src/repositories/firebase/FirebaseFormulaRepository.ts`          | `FirebaseFormulaRepository.delete`             | `REPOSITORY_WRITE`      | `FORMULA_UPDATE`                 | `WF_FORMULA_UPDATE`                 | ✅ VERIFIED |
| `src/repositories/firebase/FirebaseLaboratoryRepository.ts`       | `FirebaseLaboratoryRepository.delete`          | `REPOSITORY_WRITE`      | `LAB_MASTER_UPDATE`              | `WF_LAB_MASTER_UPDATE`              | ✅ VERIFIED |
| `src/repositories/firebase/FirebaseMasterCriterionRepository.ts`  | `FirebaseMasterCriterionRepository.delete`     | `REPOSITORY_WRITE`      | `CRITERIA_MASTER_UPDATE`         | `WF_CRITERIA_MASTER_UPDATE`         | ✅ VERIFIED |
| `src/repositories/firebase/FirebaseMaterialRepository.ts`         | `FirebaseMaterialRepository.delete`            | `REPOSITORY_WRITE`      | `MATERIAL_DELETE`                | `WF_MATERIAL_DELETE`                | ✅ VERIFIED |
| `src/repositories/firebase/FirebasePharmacopoeiaRepository.ts`    | `FirebasePharmacopoeiaRepository.delete`       | `REPOSITORY_WRITE`      | `PHARMACOPOEIA_UPDATE`           | `WF_PHARMACOPOEIA_UPDATE`           | ✅ VERIFIED |
| `src/repositories/firebase/FirebaseProductRepository.ts`          | `FirebaseProductRepository.delete`             | `REPOSITORY_WRITE`      | `PRODUCT_ARCHIVE`                | `WF_PRODUCT_ARCHIVE`                | ✅ VERIFIED |
| `src/repositories/firebase/FirebaseTCCSRepository.ts`             | `FirebaseTCCSRepository.delete`                | `REPOSITORY_WRITE`      | `TCCS_UPDATE_DRAFT`              | `WF_TCCS_UPDATE_DRAFT`              | ✅ VERIFIED |
| `src/repositories/firebase/FirebaseTestResultRepository.ts`       | `FirebaseTestResultRepository.delete`          | `REPOSITORY_WRITE`      | `TEST_RESULT_DELETE`             | `WF_TEST_RESULT_DELETE`             | ✅ VERIFIED |
| `src/repositories/IDeviationRepository.ts`                        | `IDeviationRepository.updateStatus`            | `REPOSITORY_WRITE`      | `DEVIATION_INVESTIGATE`          | `WF_DEVIATION_INVESTIGATE`          | ✅ VERIFIED |
| `src/repositories/ILaboratoryRepository.ts`                       | `ILaboratoryRepository.save`                   | `REPOSITORY_WRITE`      | `LAB_MASTER_UPDATE`              | `WF_LAB_MASTER_UPDATE`              | ✅ VERIFIED |
| `src/repositories/ILaboratoryRepository.ts`                       | `ILaboratoryRepository.update`                 | `REPOSITORY_WRITE`      | `LAB_MASTER_UPDATE`              | `WF_LAB_MASTER_UPDATE`              | ✅ VERIFIED |
| `src/repositories/ILaboratoryRepository.ts`                       | `ILaboratoryRepository.delete`                 | `REPOSITORY_WRITE`      | `LAB_MASTER_UPDATE`              | `WF_LAB_MASTER_UPDATE`              | ✅ VERIFIED |
| `src/repositories/IPharmacopoeiaRepository.ts`                    | `IPharmacopoeiaRepository.save`                | `REPOSITORY_WRITE`      | `PHARMACOPOEIA_UPDATE`           | `WF_PHARMACOPOEIA_UPDATE`           | ✅ VERIFIED |
| `src/repositories/IPharmacopoeiaRepository.ts`                    | `IPharmacopoeiaRepository.update`              | `REPOSITORY_WRITE`      | `PHARMACOPOEIA_UPDATE`           | `WF_PHARMACOPOEIA_UPDATE`           | ✅ VERIFIED |
| `src/repositories/IPharmacopoeiaRepository.ts`                    | `IPharmacopoeiaRepository.delete`              | `REPOSITORY_WRITE`      | `PHARMACOPOEIA_UPDATE`           | `WF_PHARMACOPOEIA_UPDATE`           | ✅ VERIFIED |
| `src/services/ai/tools/aiInsightsTool.ts`                         | `aiInsightsTool.execute`                       | `AI_TOOL_EXECUTE`       | `AI_NATURAL_QUERY`               | `WF_AI_NATURAL_QUERY`               | ✅ VERIFIED |
| `src/services/ai/tools/autoHealingTool.ts`                        | `autoHealingTool.execute`                      | `AI_TOOL_EXECUTE`       | `SYSTEM_AUTO_HEAL_PROPOSE`       | `WF_SYSTEM_AUTO_HEAL_PROPOSE`       | ✅ VERIFIED |
| `src/services/ai/tools/batchActionTools.ts`                       | `batchActionTools.execute`                     | `AI_TOOL_EXECUTE`       | `AI_BATCH_CLEARANCE_PROPOSE`     | `WF_AI_BATCH_CLEARANCE_PROPOSE`     | ✅ VERIFIED |
| `src/services/ai/tools/batchSummaryTool.ts`                       | `batchSummaryTool.execute`                     | `AI_TOOL_EXECUTE`       | `AI_NATURAL_QUERY`               | `WF_AI_NATURAL_QUERY`               | ✅ VERIFIED |
| `src/services/ai/tools/dataIntegrityTool.ts`                      | `dataIntegrityTool.execute`                    | `AI_TOOL_EXECUTE`       | `AI_DATA_INTEGRITY_SCAN`         | `WF_AI_DATA_INTEGRITY_SCAN`         | ✅ VERIFIED |
| `src/services/ai/tools/deviationReportTool.ts`                    | `deviationReportTool.execute`                  | `AI_TOOL_EXECUTE`       | `AI_NATURAL_QUERY`               | `WF_AI_NATURAL_QUERY`               | ✅ VERIFIED |
| `src/services/ai/tools/labComparisonTool.ts`                      | `labComparisonTool.execute`                    | `AI_TOOL_EXECUTE`       | `AI_LAB_COMPARE`                 | `WF_AI_LAB_COMPARE`                 | ✅ VERIFIED |
| `src/services/ai/tools/navigationTool.ts`                         | `navigationTool.execute`                       | `AI_TOOL_EXECUTE`       | `AI_NATURAL_QUERY`               | `WF_AI_NATURAL_QUERY`               | ✅ VERIFIED |
| `src/services/ai/tools/nlQueryTool.ts`                            | `nlQueryTool.execute`                          | `AI_TOOL_EXECUTE`       | `AI_NATURAL_QUERY`               | `WF_AI_NATURAL_QUERY`               | ✅ VERIFIED |
| `src/services/ai/tools/oosInvestigationTool.ts`                   | `oosInvestigationTool.execute`                 | `AI_TOOL_EXECUTE`       | `AI_NATURAL_QUERY`               | `WF_AI_NATURAL_QUERY`               | ✅ VERIFIED |
| `src/services/ai/tools/pharmacopoeiaTool.ts`                      | `pharmacopoeiaTool.execute`                    | `AI_TOOL_EXECUTE`       | `AI_NATURAL_QUERY`               | `WF_AI_NATURAL_QUERY`               | ✅ VERIFIED |
| `src/services/ai/tools/productionSynthesisTool.ts`                | `productionSynthesisTool.execute`              | `AI_TOOL_EXECUTE`       | `AI_NATURAL_QUERY`               | `WF_AI_NATURAL_QUERY`               | ✅ VERIFIED |
| `src/services/ai/tools/qualityReportTool.ts`                      | `qualityReportTool.execute`                    | `AI_TOOL_EXECUTE`       | `AI_NATURAL_QUERY`               | `WF_AI_NATURAL_QUERY`               | ✅ VERIFIED |
| `src/services/ai/tools/qualityRiskTool.ts`                        | `qualityRiskTool.execute`                      | `AI_TOOL_EXECUTE`       | `AI_NATURAL_QUERY`               | `WF_AI_NATURAL_QUERY`               | ✅ VERIFIED |
| `src/services/ai/tools/qualityTrendTool.ts`                       | `qualityTrendTool.execute`                     | `AI_TOOL_EXECUTE`       | `AI_NATURAL_QUERY`               | `WF_AI_NATURAL_QUERY`               | ✅ VERIFIED |
| `src/services/ai/tools/rootCauseAnalysisTool.ts`                  | `rootCauseAnalysisTool.execute`                | `AI_TOOL_EXECUTE`       | `AI_NATURAL_QUERY`               | `WF_AI_NATURAL_QUERY`               | ✅ VERIFIED |
| `src/services/ai/tools/stabilityPredictionTool.ts`                | `stabilityPredictionTool.execute`              | `AI_TOOL_EXECUTE`       | `AI_STABILITY_PREDICT`           | `WF_AI_STABILITY_PREDICT`           | ✅ VERIFIED |
| `src/pages/batches/BatchFormPage.tsx`                             | `handleSave`                                   | `UI_FORM_SUBMIT`        | `BATCH_CREATE`                   | `WF_BATCH_CREATE`                   | ✅ VERIFIED |
| `src/pages/products/MaterialFormPage.tsx`                         | `handleSave`                                   | `UI_FORM_SUBMIT`        | `PRODUCT_UPDATE`                 | `WF_PRODUCT_UPDATE`                 | ✅ VERIFIED |
| `src/pages/products/ProductFormPage.tsx`                          | `handleSave`                                   | `UI_FORM_SUBMIT`        | `PRODUCT_UPDATE`                 | `WF_PRODUCT_UPDATE`                 | ✅ VERIFIED |
| `src/pages/qa/CriteriaFormPage.tsx`                               | `handleSave`                                   | `UI_FORM_SUBMIT`        | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/pages/qa/ProductFormulaFormPage.tsx`                         | `handleSave`                                   | `UI_FORM_SUBMIT`        | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/pages/qa/TCCSFormPage.tsx`                                   | `handleSave`                                   | `UI_FORM_SUBMIT`        | `TCCS_CREATE`                    | `WF_TCCS_CREATE`                    | ✅ VERIFIED |
| `src/pages/system/components/PharmacopoeiaManager.tsx`            | `handleSave`                                   | `UI_FORM_SUBMIT`        | `SYSTEM_CONFIG_UPDATE`           | `WF_SYSTEM_CONFIG_UPDATE`           | ✅ VERIFIED |
| `src/utils/excelExporter.ts`                                      | `exportToExcel`                                | `FILE_EXPORT`           | `EXCEL_DATA_EXPORT`              | `WF_EXCEL_DATA_EXPORT`              | ✅ VERIFIED |
| `src/services/storageService.ts`                                  | `uploadFile`                                   | `FILE_UPLOAD`           | `FILE_STORAGE_UPLOAD`            | `WF_FILE_STORAGE_UPLOAD`            | ✅ VERIFIED |
| `src/services/cloudFunctionsService.ts`                           | `callCloudFunction`                            | `CLOUD_FUNCTION_CALL`   | `CLOUD_FUNCTION_INVOKE`          | `WF_CLOUD_FUNCTION_INVOKE`          | ✅ VERIFIED |
| `src/services/dataConsistencyService.ts`                          | `executeAutoHealingPlan`                       | `SYSTEM_BACKGROUND_JOB` | `SYSTEM_AUTO_HEAL_EXECUTE`       | `WF_SYSTEM_AUTO_HEAL_EXECUTE`       | ✅ VERIFIED |

---

## 2. TỔNG KẾT ĐÁNH GIÁ CHỈ SỐ

- **Số lượng ORPHAN**: **0**
- **Số lượng BYPASS**: **0**
- **Số lượng UNREGISTERED ACTION**: **0**
- **Số lượng UNMAPPED MUTATION**: **0**
- **Số lượng DUPLICATE AUTHORITY**: **0**

Tất cả các lệnh mutation từ UI đều được chứng minh đi qua:
`UI/Hook -> Workflow Action -> Guard -> Application Service -> Repository -> Firebase`
