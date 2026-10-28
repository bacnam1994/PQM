/**
 * WORKFLOW ENGINE SSoT REGISTRY
 *
 * Điểm xuất khẩu tập trung cho toàn bộ hệ thống Workflow:
 * - contracts/ (Actions, Events, Workflow interfaces, FeatureFlags)
 * - registry/ (ActionRegistry, ActionDefinitions)
 * - kernel/ (UnifiedWorkflowExecutor, WorkflowFacade)
 * - guards/ (WorkflowGuards & Subguards)
 * - events/ (OutboxAuditQueue)
 * - observability/ (WorkflowTelemetry)
 * - adapters/ (LegacyServiceAdapter)
 */

export * from './contracts/actions';
export * from './contracts/events';
export * from './contracts/workflow';
export * from './contracts/featureFlags';
export * from './registry/index';
export { UnifiedWorkflowExecutor } from './kernel/workflowExecutor';
export { WorkflowFacade } from './kernel/WorkflowFacade';
export * from './guards';
export * from './events/outboxAuditQueue';
export * from './observability/workflowTelemetry';
export * from './adapters/LegacyServiceAdapter';
