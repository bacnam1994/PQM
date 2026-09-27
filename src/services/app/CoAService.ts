/**
 * PQM V4 Platform - CoA Service Adapter
 * Thin adapter re-exporting from canonical coa domain (VS-11).
 * Preserves 100% backward compatibility for legacy imports.
 */

export { CoAService, coaService } from '../../domains/coa/application/service';

export type {
  CoAVerificationData,
  CoAFootnote,
  CoADocumentPayload,
} from '../../domains/coa/domain/types';
