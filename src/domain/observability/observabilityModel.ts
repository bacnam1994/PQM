/**
 * PQM Domain - Observability & Diagnostics Model (Model 12)
 * Biết app sai ở đâu và vì sao:
 * - Correlation ID xuyên suốt toàn bộ luồng xử lý nghiệp vụ
 * - Operation ID cho mỗi lần gọi hàm có thể theo dõi
 * - Runtime Diagnostics ghi nhận kết quả, lỗi, thời gian
 * - Explainability: cung cấp thông tin giải thích để thanh tra GMP
 * - Structured Health Report: tổng hợp sức khỏe hệ thống theo chiều domain
 */

export type DiagnosticResult = 'SUCCESS' | 'FAILURE' | 'WARNING' | 'DEGRADED';

export interface OperationDiagnosticsEntry {
  correlationId: string;
  operationId: string;
  operationName: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  startTime: string;
  durationMs: number;
  result: DiagnosticResult;
  resolver?: string;
  outputSummary?: any;
  error?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface SystemHealthSnapshot {
  timestamp: string;
  correlationId: string;
  totalOperations: number;
  successCount: number;
  failureCount: number;
  warningCount: number;
  averageDurationMs: number;
  slowestOperationMs: number;
  errorRate: number;
  isHealthy: boolean;
  topErrorOperations: string[];
  domainBreakdown: Record<string, { count: number; errorCount: number }>;
}

export interface DiagnosticFilter {
  operationName?: string;
  entityType?: string;
  entityId?: string;
  result?: DiagnosticResult;
  correlationId?: string;
  minDurationMs?: number;
  tag?: string;
}

export class ObservabilityManager {
  private static inMemoryLogs: OperationDiagnosticsEntry[] = [];
  private static readonly MAX_LOGS = 1000;
  private static readonly SLOW_OPERATION_THRESHOLD_MS = 5000;

  /**
   * Sinh mã Correlation ID thống nhất cho một luồng thao tác
   */
  public static generateCorrelationId(prefix = 'CORR'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  /**
   * Sinh mã Operation ID duy nhất cho mỗi lần gọi hàm
   */
  public static generateOperationId(): string {
    return `OP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
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
      tags?: string[];
      metadata?: Record<string, any>;
    },
    fn: (entry: Partial<OperationDiagnosticsEntry>) => Promise<T> | T
  ): Promise<{ result: T; diagnostics: OperationDiagnosticsEntry }> {
    const correlationId = context.correlationId || this.generateCorrelationId();
    const operationId = this.generateOperationId();
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
      tags: context.tags,
      metadata: context.metadata,
    };

    try {
      const output = await fn(partialEntry);
      const durationMs = Math.round((performance.now() - start) * 100) / 100;

      const result: DiagnosticResult =
        durationMs >= this.SLOW_OPERATION_THRESHOLD_MS ? 'WARNING' : 'SUCCESS';

      const fullEntry: OperationDiagnosticsEntry = {
        ...partialEntry,
        durationMs,
        result,
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
   * Lưu trữ log chẩn đoán vào bộ nhớ đệm (circular buffer)
   */
  public static recordLog(entry: OperationDiagnosticsEntry): void {
    this.inMemoryLogs.unshift(entry);
    if (this.inMemoryLogs.length > this.MAX_LOGS) {
      this.inMemoryLogs.length = this.MAX_LOGS;
    }
  }

  /**
   * Lấy danh sách logs chẩn đoán gần nhất
   */
  public static getRecentDiagnostics(limit = 50): OperationDiagnosticsEntry[] {
    return this.inMemoryLogs.slice(0, limit);
  }

  /**
   * Lọc logs theo nhiều chiều kích (Correlation ID, entity, result, tên operation, tag)
   */
  public static filterDiagnostics(filter: DiagnosticFilter): OperationDiagnosticsEntry[] {
    return this.inMemoryLogs.filter((log) => {
      if (filter.correlationId && log.correlationId !== filter.correlationId) return false;
      if (filter.operationName && !log.operationName.includes(filter.operationName)) return false;
      if (filter.entityType && log.entityType !== filter.entityType) return false;
      if (filter.entityId && log.entityId !== filter.entityId) return false;
      if (filter.result && log.result !== filter.result) return false;
      if (filter.minDurationMs !== undefined && log.durationMs < filter.minDurationMs) return false;
      if (filter.tag && !(log.tags || []).includes(filter.tag)) return false;
      return true;
    });
  }

  /**
   * @deprecated Dùng filterDiagnostics({ correlationId }) thay thế
   */
  public static getDiagnosticsByCorrelationId(correlationId: string): OperationDiagnosticsEntry[] {
    return this.filterDiagnostics({ correlationId });
  }

  /**
   * Tạo báo cáo sức khỏe hệ thống toàn diện từ tập logs hiện có
   */
  public static generateHealthSnapshot(correlationId?: string): SystemHealthSnapshot {
    const logs = correlationId ? this.filterDiagnostics({ correlationId }) : this.inMemoryLogs;

    const totalOperations = logs.length;
    const successCount = logs.filter((l) => l.result === 'SUCCESS').length;
    const failureCount = logs.filter((l) => l.result === 'FAILURE').length;
    const warningCount = logs.filter(
      (l) => l.result === 'WARNING' || l.result === 'DEGRADED'
    ).length;
    const totalDuration = logs.reduce((acc, l) => acc + l.durationMs, 0);
    const averageDurationMs = totalOperations > 0 ? Math.round(totalDuration / totalOperations) : 0;
    const slowestOperationMs = logs.reduce((max, l) => Math.max(max, l.durationMs), 0);
    const errorRate = totalOperations > 0 ? failureCount / totalOperations : 0;

    // Top 3 error operations
    const errorOpCounts: Record<string, number> = {};
    for (const log of logs.filter((l) => l.result === 'FAILURE')) {
      errorOpCounts[log.operationName] = (errorOpCounts[log.operationName] || 0) + 1;
    }
    const topErrorOperations = Object.entries(errorOpCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name]) => name);

    // Domain breakdown by entityType
    const domainBreakdown: Record<string, { count: number; errorCount: number }> = {};
    for (const log of logs) {
      const domain = log.entityType || 'UNKNOWN';
      if (!domainBreakdown[domain]) {
        domainBreakdown[domain] = { count: 0, errorCount: 0 };
      }
      domainBreakdown[domain].count++;
      if (log.result === 'FAILURE') {
        domainBreakdown[domain].errorCount++;
      }
    }

    return {
      timestamp: new Date().toISOString(),
      correlationId: correlationId || 'ALL',
      totalOperations,
      successCount,
      failureCount,
      warningCount,
      averageDurationMs,
      slowestOperationMs,
      errorRate,
      isHealthy: errorRate < 0.05 && warningCount < 10,
      topErrorOperations,
      domainBreakdown,
    };
  }

  /**
   * Xóa sạch toàn bộ logs trong bộ nhớ (dùng cho test hoặc restart)
   */
  public static clearLogs(): void {
    this.inMemoryLogs = [];
  }

  /**
   * Trả về tổng số bản ghi logs hiện có trong bộ nhớ đệm
   */
  public static getTotalLogCount(): number {
    return this.inMemoryLogs.length;
  }
}
