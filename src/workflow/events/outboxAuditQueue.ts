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
  details: string;
  timestamp: string;
  correlationId?: string;
}

export class OutboxAuditQueue {
  private static inMemoryQueue: OutboxAuditEvent[] = [];

  /**
   * Đẩy và thực thi ghi nhận sự kiện kiểm toán đồng bộ (Awaited).
   * Có cơ chế thử lại lũy tiến (Exponential Backoff Retry).
   */
  public static async dispatchAudit(
    event: OutboxAuditEvent,
    maxRetries = 2
  ): Promise<{ success: boolean; error?: string }> {
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

        return { success: true };
      } catch (err: any) {
        lastError = err;
        attempt++;
        if (attempt <= maxRetries) {
          // Delay nhỏ trước khi thử lại
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Outbox audit write failed after retries',
    };
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
  }
}
