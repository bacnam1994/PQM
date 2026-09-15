/**
 * PQM Domain Layer - 12 Core Canonical Models
 * Centralized Domain Architecture Entry Point
 */

// Model 1: Canonical Data Model
export * from './canonical/baseEntity';

// Model 2: Canonical Status Model & Resolver
export * from './canonical/canonicalStatus';
export * from './canonical/canonicalResolver';

// Model 3: Entity Identity Model
export * from './identity/entityIdentity';

// Model 4: Data Lineage Model
export * from './lineage/dataLineageModel';

// Model 5: 3-Tier Validation Model
export * from './validation/validationEngine';

// Model 6: Business Rule Engine
export * from './rules';

// Model 7: Consistency & Reconciliation Model
export * from './consistency/consistencyModel';

// Model 8: Auto-Healing Model
export * from './healing/autoHealingFramework';

// Model 9: Audit Trail Model (ALCOA+)
export * from './audit/alcoaAuditModel';

// Model 10: Workflow & State Machine
export * from './workflow/stateMachine';

// Model 11: Concurrency & Versioning Model
export * from './concurrency/concurrencyModel';

// Model 12: Observability & Diagnostics Model
export * from './observability/observabilityModel';
