/**
 * WORKFLOW TELEMETRY & OBSERVABILITY
 *
 * Ghi nhận số liệu đo lường thời gian thực (Runtime Telemetry):
 * - workflow.execution.started
 * - workflow.execution.completed
 * - workflow.execution.failed
 */

export interface TelemetrySpan {
  executionId: string;
  actionId: string;
  entityType: string;
  entityId: string;
  actorRole: string;
  correlationId?: string;
  startTime: number;
}

export class WorkflowTelemetry {
  private static activeSpans: Map<string, TelemetrySpan> = new Map();
  private static completedEvents: any[] = [];

  public static startExecution(
    executionId: string,
    actionId: string,
    entityType: string,
    entityId: string,
    actorRole: string,
    correlationId?: string
  ): TelemetrySpan {
    const span: TelemetrySpan = {
      executionId,
      actionId,
      entityType,
      entityId,
      actorRole,
      correlationId,
      startTime: Date.now(),
    };
    this.activeSpans.set(executionId, span);
    return span;
  }

  public static recordSuccess(executionId: string, toState?: string): void {
    const span = this.activeSpans.get(executionId);
    if (!span) return;

    const durationMs = Date.now() - span.startTime;
    this.activeSpans.delete(executionId);

    this.completedEvents.push({
      event: 'workflow.execution.completed',
      executionId,
      actionId: span.actionId,
      entityType: span.entityType,
      entityId: span.entityId,
      actorRole: span.actorRole,
      correlationId: span.correlationId,
      toState,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  public static recordFailure(
    executionId: string,
    failureCode: string,
    failureReason: string
  ): void {
    const span = this.activeSpans.get(executionId);
    if (!span) return;

    const durationMs = Date.now() - span.startTime;
    this.activeSpans.delete(executionId);

    this.completedEvents.push({
      event: 'workflow.execution.failed',
      executionId,
      actionId: span.actionId,
      entityType: span.entityType,
      entityId: span.entityId,
      actorRole: span.actorRole,
      correlationId: span.correlationId,
      failureCode,
      failureReason,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  public static getEvents(): readonly any[] {
    return this.completedEvents;
  }

  public static clear(): void {
    this.activeSpans.clear();
    this.completedEvents = [];
  }
}
