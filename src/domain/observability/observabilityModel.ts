/**
 * PQM Domain - Observability & Diagnostics Model (Model 12)
 * Biết app sai ở đâu và vì sao: Correlation ID, Operation ID, Runtime Diagnostics & Explainability.
 */

export interface OperationDiagnosticsEntry {
  correlationId: string;
  operationId: string;
  operationName: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  startTime: string;
  durationMs: number;
  result: 'SUCCESS' | 'FAILURE' | 'WARNING';
  resolver?: string;
  outputSummary?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export class ObservabilityManager {
  private static inMemoryLogs: OperationDiagnosticsEntry[] = [];
  private static readonly MAX_LOGS = 500;

  /**
   * Sinh mã Correlation ID thống nhất cho một luồng thao tác
   */
  public static generateCorrelationId(prefix = 'CORR'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  /**
   * Thực thi một tác vụ nghiệp vụ có bọc đo lường thời gian, correlation ID và ghi nhận chẩn đoán
   */
  public static async executeWithDiagnostics<T>(
    operationName: string,
    context: {
      entityType?: string;
      entityId?: string;
      userId?: string;
      correlationId?: string;
      resolver?: string;
    },
    fn: (entry: Partial<OperationDiagnosticsEntry>) => Promise<T> | T
  ): Promise<{ result: T; diagnostics: OperationDiagnosticsEntry }> {
    const correlationId = context.correlationId || this.generateCorrelationId();
    const operationId = `OP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const start = performance.now();
    const startTime = new Date().toISOString();

    const partialEntry: Partial<OperationDiagnosticsEntry> = {
      correlationId,
      operationId,
      operationName,
      entityType: context.entityType,
      entityId: context.entityId,
      userId: context.userId || 'SYSTEM',
      startTime,
      resolver: context.resolver,
    };

    try {
      const output = await fn(partialEntry);
      const durationMs = Math.round((performance.now() - start) * 100) / 100;

      const fullEntry: OperationDiagnosticsEntry = {
        ...partialEntry,
        durationMs,
        result: 'SUCCESS',
        outputSummary:
          typeof output === 'object' ? { status: (output as any)?.status || 'OK' } : String(output),
      } as OperationDiagnosticsEntry;

      this.recordLog(fullEntry);
      return { result: output, diagnostics: fullEntry };
    } catch (err: any) {
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      const errorEntry: OperationDiagnosticsEntry = {
        ...partialEntry,
        durationMs,
        result: 'FAILURE',
        error: err?.message || String(err),
      } as OperationDiagnosticsEntry;

      this.recordLog(errorEntry);
      throw err;
    }
  }

  /**
   * Lưu trữ log chẩn đoán vào bộ nhớ đệm
   */
  public static recordLog(entry: OperationDiagnosticsEntry): void {
    this.inMemoryLogs.unshift(entry);
    if (this.inMemoryLogs.length > this.MAX_LOGS) {
      this.inMemoryLogs.pop();
    }
  }

  /**
   * Lấy danh sách logs chẩn đoán gần nhất
   */
  public static getRecentDiagnostics(limit = 50): OperationDiagnosticsEntry[] {
    return this.inMemoryLogs.slice(0, limit);
  }

  /**
   * Lọc logs theo Correlation ID
   */
  public static getDiagnosticsByCorrelationId(correlationId: string): OperationDiagnosticsEntry[] {
    return this.inMemoryLogs.filter((log) => log.correlationId === correlationId);
  }
}
