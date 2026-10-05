/**
 * DURABLE PERSISTENT OUTBOX AUDIT QUEUE
 *
 * Đảm bảo nguyên tắc ALCOA+ và tính nhất quán dữ liệu (No Mutation/Audit Split-Brain):
 * 1. Event được persist TRƯỚC/ĐỒNG THỜI với Regulated Mutation.
 * 2. Deterministic Event ID: `${entityType}:${entityId}:${actionId}:v${version}`.
 * 3. Bền vững qua Browser reload, Multi-tab và Network failure (LocalStorage + Firebase RTDB).
 * 4. State lifecycle: PENDING -> PROCESSING -> COMMITTED / RETRYING / FAILED.
 * 5. Nếu mutation thành công mà audit tạm thời lỗi mạng: workflow KHÔNG fail mà chuyển sang RETRYING trong outbox.
 */

import { logAuditAction } from '../../services/auditService';
import { db } from '../../firebase';
import { ref, set, update } from 'firebase/database';

export type OutboxState = 'PENDING' | 'PROCESSING' | 'COMMITTED' | 'FAILED' | 'RETRYING';

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
  state?: OutboxState;
  createdAt?: string;
  retryCount?: number;
  lastError?: string;
}

const STORAGE_KEY = 'pqm_durable_audit_outbox_v1';

const isTestEnv =
  (typeof process !== 'undefined' &&
    (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST))) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'test');

const hasDatabaseEmulator =
  (typeof process !== 'undefined' && Boolean(process.env.FIREBASE_DATABASE_EMULATOR_HOST)) ||
  (typeof import.meta !== 'undefined' &&
    Boolean((import.meta as any).env?.VITE_FIREBASE_DATABASE_EMULATOR_HOST));

const shouldPersistRemoteOutbox = !isTestEnv || hasDatabaseEmulator;

export class OutboxAuditQueue {
  private static inMemoryQueue: OutboxAuditEvent[] = [];
  private static committedEventIds = new Set<string>();
  private static isInitialized = false;

  private static getStorage(): Storage | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
      if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
        return (globalThis as any).localStorage;
      }
    } catch {
      // Storage access blocked
    }
    return null;
  }

  private static loadFromStorage(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    const storage = this.getStorage();
    if (!storage) return;

    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        const events: OutboxAuditEvent[] = JSON.parse(raw);
        for (const ev of events) {
          const existingIdx = this.inMemoryQueue.findIndex((e) => e.eventId === ev.eventId);
          if (existingIdx >= 0) {
            this.inMemoryQueue[existingIdx] = ev;
          } else {
            this.inMemoryQueue.push(ev);
          }
          if (ev.state === 'COMMITTED') {
            this.committedEventIds.add(ev.eventId);
          }
        }
      }
    } catch {
      // Ignore storage parse error
    }
  }

  private static saveToStorage(): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(this.inMemoryQueue));
    } catch {
      // Ignore quota error
    }
  }

  /**
   * Tạo deterministic eventId: entityId + actionId + version
   */
  public static generateDeterministicEventId(
    entityType: string,
    entityId: string,
    actionId: string,
    version: number | string = 1
  ): string {
    const sanitizedEntity = String(entityId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedAction = String(actionId).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `AUD-${entityType}-${sanitizedEntity}-${sanitizedAction}-v${version}`;
  }

  /**
   * Persist pending event TRƯỚC khi thực thi mutation
   */
  public static async persistPending(event: OutboxAuditEvent): Promise<void> {
    this.loadFromStorage();
    const eventWithState: OutboxAuditEvent = {
      ...event,
      state: 'PENDING',
      createdAt: event.createdAt || event.timestamp || new Date().toISOString(),
      retryCount: event.retryCount ?? 0,
    };

    const idx = this.inMemoryQueue.findIndex((e) => e.eventId === event.eventId);
    if (idx >= 0) {
      this.inMemoryQueue[idx] = eventWithState;
    } else {
      this.inMemoryQueue.push(eventWithState);
    }
    this.saveToStorage();

    // Persist to Firebase RTDB outbox table if online
    try {
      if (shouldPersistRemoteOutbox && db && typeof ref === 'function') {
        const outboxRef = ref(db, `audit_outbox/${event.eventId.replace(/[.#$[\]]/g, '_')}`);
        await set(outboxRef, eventWithState);
      }
    } catch {
      // Không chặn local queue nếu Firebase tạm thời chưa sẵn sàng
    }
  }

  /**
   * Đánh dấu FAILED nếu mutation trước đó thất bại
   */
  public static async markFailed(eventId: string, error: string): Promise<void> {
    this.loadFromStorage();
    const item = this.inMemoryQueue.find((e) => e.eventId === eventId);
    if (item) {
      item.state = 'FAILED';
      item.lastError = error;
      this.saveToStorage();
    }
    try {
      if (shouldPersistRemoteOutbox && db && typeof ref === 'function') {
        const outboxRef = ref(db, `audit_outbox/${eventId.replace(/[.#$[\]]/g, '_')}`);
        await update(outboxRef, { state: 'FAILED', lastError: error });
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Đẩy và thực thi ghi nhận sự kiện kiểm toán đồng bộ (Awaited).
   * Có cơ chế chống trùng lặp (Idempotent) và thử lại lũy tiến (Exponential Backoff Retry).
   */
  public static async dispatchAudit(
    event: OutboxAuditEvent,
    maxRetries = 3
  ): Promise<{ success: boolean; error?: string }> {
    this.loadFromStorage();

    // 1. Chống trùng lặp audit log khi retry (Idempotency)
    if (this.committedEventIds.has(event.eventId)) {
      return { success: true };
    }

    let currentEvent = this.inMemoryQueue.find((e) => e.eventId === event.eventId);
    if (!currentEvent) {
      currentEvent = {
        ...event,
        state: 'PENDING',
        createdAt: event.createdAt || event.timestamp || new Date().toISOString(),
        retryCount: event.retryCount ?? 0,
      };
      this.inMemoryQueue.push(currentEvent);
    }

    currentEvent.state = 'PROCESSING';
    this.saveToStorage();

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

        currentEvent.state = 'COMMITTED';
        this.committedEventIds.add(event.eventId);
        this.saveToStorage();

        // Update Firebase outbox status
        try {
          if (shouldPersistRemoteOutbox && db && typeof ref === 'function') {
            const outboxRef = ref(db, `audit_outbox/${event.eventId.replace(/[.#$[\]]/g, '_')}`);
            await update(outboxRef, { state: 'COMMITTED' });
          }
        } catch {
          // Ignore
        }

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

    // Sau khi hết lượt retry, lưu vào trạng thái RETRYING trong durable outbox
    currentEvent.state = 'RETRYING';
    currentEvent.retryCount = (currentEvent.retryCount ?? 0) + 1;
    currentEvent.lastError = lastError?.message || 'Outbox audit write failed after retries';
    this.saveToStorage();

    try {
      if (shouldPersistRemoteOutbox && db && typeof ref === 'function') {
        const outboxRef = ref(db, `audit_outbox/${event.eventId.replace(/[.#$[\]]/g, '_')}`);
        await update(outboxRef, {
          state: 'RETRYING',
          retryCount: currentEvent.retryCount,
          lastError: currentEvent.lastError,
        });
      }
    } catch {
      // Ignore
    }

    return {
      success: false,
      error: currentEvent.lastError,
    };
  }

  public static isCommitted(eventId: string): boolean {
    this.loadFromStorage();
    return this.committedEventIds.has(eventId);
  }

  /**
   * Lấy danh sách queue sự kiện phục vụ quan sát
   */
  public static getQueue(): readonly OutboxAuditEvent[] {
    this.loadFromStorage();
    return this.inMemoryQueue;
  }

  /**
   * Dọn dẹp queue (dùng trong test)
   */
  public static clear(): void {
    this.inMemoryQueue = [];
    this.committedEventIds.clear();
    this.isInitialized = false;
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
  }
}
