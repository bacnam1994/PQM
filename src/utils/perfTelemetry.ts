/**
 * perfTelemetry.ts
 * PQM Performance Instrumentation & Telemetry Utility (Phase 6)
 * ==============================================================
 * Cung cấp cơ chế đo đạc và ghi nhận telemetry hiệu năng chuẩn hóa.
 * Định dạng log: [PQM PERF] <METRIC_NAME> ...
 *
 * Feature Flag:
 * - Bật khi: import.meta.env.VITE_ENABLE_PERF_DEBUG === 'true' hoặc import.meta.env.DEV
 * - Tắt hoàn toàn trên Production nếu không bật cờ VITE_ENABLE_PERF_DEBUG.
 */

export type PerfMetric =
  | 'APP_BOOT'
  | 'CACHE_HYDRATION'
  | 'FIREBASE_CONNECT'
  | 'COLLECTION_SYNC'
  | 'AI_OPEN'
  | 'AI_REQUEST_START'
  | 'AI_FIRST_RESPONSE'
  | 'AI_FINAL_RESPONSE'
  | 'AI_TOOL'
  | 'AI_CACHE_HIT'
  | 'AI_CACHE_MISS'
  | 'INDEXEDDB_OP';

interface PerfEventPayload {
  durationMs?: number;
  collection?: string;
  count?: number;
  model?: string;
  promptId?: string;
  details?: Record<string, any>;
}

const isPerfDebugEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return (
      import.meta.env.VITE_ENABLE_PERF_DEBUG === 'true' ||
      import.meta.env.DEV ||
      localStorage.getItem('PQM_ENABLE_PERF_DEBUG') === 'true'
    );
  } catch {
    return false;
  }
};

const timers = new Map<string, number>();

export const perfTelemetry = {
  startTimer(timerKey: string): void {
    timers.set(timerKey, performance.now());
  },

  endTimer(timerKey: string): number {
    const start = timers.get(timerKey);
    if (!start) return 0;
    timers.delete(timerKey);
    return Math.round((performance.now() - start) * 100) / 100;
  },

  record(metric: PerfMetric, payload?: PerfEventPayload): void {
    if (!isPerfDebugEnabled()) return;

    const parts: string[] = [`[PQM PERF] ${metric}`];

    if (payload?.durationMs !== undefined) {
      parts.push(`duration: ${payload.durationMs.toFixed(1)}ms`);
    }
    if (payload?.collection) {
      parts.push(`collection: ${payload.collection}`);
    }
    if (payload?.count !== undefined) {
      parts.push(`count: ${payload.count}`);
    }
    if (payload?.model) {
      parts.push(`model: ${payload.model}`);
    }
    if (payload?.promptId) {
      parts.push(`promptId: ${payload.promptId}`);
    }
    if (payload?.details) {
      parts.push(`details: ${JSON.stringify(payload.details)}`);
    }

    console.info(parts.join(' | '));
  },
};
