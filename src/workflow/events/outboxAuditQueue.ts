/**
 * AWAITED OUTBOX AUDIT QUEUE
 *
 * Đảm bảo nguyên tắc ALCOA+ Fail-Closed:
 * Mọi thao tác có quy chuẩn (Regulated Mutation) bắt buộc phải có nhật ký kiểm toán thành công.
 * Nếu việc ghi Audit Trail thất bại hoàn toàn sau các lượt thử lại, transaction bị coi là thất bại
 * để ngăn chặn hiện tượng dữ liệu bị thay đổi mà không có bằng chứng kiểm toán.
 */

import { logAuditAction } from '../../services/auditService';

export interface OutboxAuditEvent {
  eventId: string;
  executionId: string;
  actionId: string;
  entityType: string;
  entityId: string;
  actor: {
    id: string;
    name: string;
    role: string;
    email?: string;
  };
  fromState?: string;
  toState?: string;
  version?: number;
  details: string;
  timestamp: string;
  correlationId?: string;
}

export class OutboxAuditQueue {
  private static inMemoryQueue: OutboxAuditEvent[] = [];
  private static committedEventIds = new Set<string>();

  /**
   * Đẩy và thực thi ghi nhận sự kiện kiểm toán đồng bộ (Awaited).
   * Có cơ chế chống trùng lặp (Idempotent) và thử lại lũy tiến (Exponential Backoff Retry).
   */
  public static async dispatchAudit(
    event: OutboxAuditEvent,
    maxRetries = 3
  ): Promise<{ success: boolean; error?: string }> {
    // 1. Chống trùng lặp audit log khi retry (Idempotency)
    if (this.committedEventIds.has(event.eventId)) {
      return { success: true };
    }

    this.inMemoryQueue.push(event);

    let attempt = 0;
    let lastError: any = null;

    while (attempt <= maxRetries) {
      try {
        await logAuditAction({
          action: event.actionId as any,
          collection: event.entityType as any,
          documentId: event.entityId,
          details: event.details,
          performedBy: event.actor.email || event.actor.name || event.actor.id,
        });

        this.committedEventIds.add(event.eventId);
        return { success: true };
      } catch (err: any) {
        lastError = err;
        attempt++;
        if (attempt <= maxRetries) {
          // Delay nhỏ lũy tiến trước khi thử lại
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Outbox audit write failed after retries',
    };
  }

  public static isCommitted(eventId: string): boolean {
    return this.committedEventIds.has(eventId);
  }

  /**
   * Lấy danh sách queue sự kiện phục vụ quan sát
   */
  public static getQueue(): readonly OutboxAuditEvent[] {
    return this.inMemoryQueue;
  }

  /**
   * Dọn dẹp queue (dùng trong test)
   */
  public static clear(): void {
    this.inMemoryQueue = [];
    this.committedEventIds.clear();
  }
}
