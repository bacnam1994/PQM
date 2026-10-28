/**
 * WORKFLOW FEATURE FLAGS & ROLLBACK CONTROL
 *
 * Kiểm soát cắt chuyển (Cutover) từng Action ID / Module và hỗ trợ Rollback an toàn:
 * - enableTestResultWorkflowFacade: Kích hoạt điều phối WorkflowFacade cho Test Result
 * - enableBatchWorkflowFacade: Kích hoạt điều phối WorkflowFacade cho Batch & Release Gate
 * - enableShadowValidation: Bật đối chiếu song song guard cũ & mới (Telemetry divergence log)
 */

export interface WorkflowFeatureFlags {
  enableTestResultWorkflowFacade: boolean;
  enableBatchWorkflowFacade: boolean;
  enableShadowValidation: boolean;
}

const defaultFlags: WorkflowFeatureFlags = {
  enableTestResultWorkflowFacade: true,
  enableBatchWorkflowFacade: true,
  enableShadowValidation: true,
};

let currentFlags: WorkflowFeatureFlags = { ...defaultFlags };

export function getWorkflowFeatureFlags(): Readonly<WorkflowFeatureFlags> {
  return currentFlags;
}

export function setWorkflowFeatureFlag<K extends keyof WorkflowFeatureFlags>(
  key: K,
  value: WorkflowFeatureFlags[K]
): void {
  currentFlags[key] = value;
}

export function resetWorkflowFeatureFlags(): void {
  currentFlags = { ...defaultFlags };
}
