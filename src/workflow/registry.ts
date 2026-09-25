/**
 * WORKFLOW ENGINE SSoT REGISTRY
 *
 * Điểm xuất khẩu tập trung cho toàn bộ hệ thống Workflow Kernel:
 * - contracts/
 * - definitions/
 * - guards/
 * - events/
 * - observability/
 * - UnifiedWorkflowExecutor
 * - WorkflowFacade
 * - LegacyServiceAdapter
 */

export * from './contracts/actions';
export * from './contracts/featureFlags';
export * from './definitions';
export * from './guards';
export * from './events/outboxAuditQueue';
export * from './observability/workflowTelemetry';
export * from './UnifiedWorkflowExecutor';
export * from './WorkflowFacade';
export * from './adapters/LegacyServiceAdapter';
