/**
 * LaboratoryAppService Adapter
 * Thin adapter re-exporting from canonical master-data domain (VS-13).
 * Preserves 100% backward compatibility for legacy imports.
 */

export {
  LaboratoryAppService,
  laboratoryAppService,
} from '../../domains/master-data/application/laboratoryService';
export type { TestingLaboratory, LabActionContext } from '../../domains/master-data/domain/types';
