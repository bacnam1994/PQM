/**
 * PQM V4 Platform - Change Control Application Service Adapter
 * Thin adapter re-exporting from canonical change-request domain (VS-10).
 * Preserves 100% backward compatibility for legacy imports.
 */

export {
  ChangeControlAppService,
  changeControlAppService,
} from '../../domains/change-request/application/service';
