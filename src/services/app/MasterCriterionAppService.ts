/**
 * PQM V4 - Master Criterion Application Service Adapter
 * Thin adapter re-exporting from canonical master-data domain (VS-13).
 * Preserves 100% backward compatibility for legacy imports.
 */

export {
  MasterCriterionAppService,
  masterCriterionAppService,
} from '../../domains/master-data/application/masterCriterionService';
export type {
  MasterCriterion,
  MasterCriterionCategory,
  BulkRenameCriteriaResult,
} from '../../domains/master-data/domain/types';
