/**
 * PQM REBUILD - BATCH APP SERVICE ADAPTER
 *
 * Re-export từ canonical domain: `src/domains/batch/application/service`
 * Bảo toàn 100% backward compatibility cho UI và legacy tests.
 *
 * Architectural Invariant Checkers (WF-005):
 * Không được thay đổi Workflow Status thông qua updateBatch()
 * if (batch.status !== old.status) { ... }
 */

export * from '../../domains/batch/application/service';
