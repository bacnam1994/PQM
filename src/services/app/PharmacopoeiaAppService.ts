/**
 * PharmacopoeiaAppService Adapter
 * Thin adapter re-exporting from canonical master-data domain (VS-13).
 * Preserves 100% backward compatibility for legacy imports.
 */

export {
  PharmacopoeiaAppService,
  pharmacopoeiaAppService,
} from '../../domains/master-data/application/pharmacopoeiaService';
export type {
  PharmacopoeiaStandard,
  PharmacopoeiaActionContext,
} from '../../domains/master-data/domain/types';
