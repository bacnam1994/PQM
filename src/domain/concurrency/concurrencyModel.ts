/**
 * PQM Domain - Concurrency & Versioning Model (Model 11)
 * Chống ghi đè dữ liệu âm thầm (Optimistic Concurrency Control).
 *
 * User A đọc version 5 -> User B sửa version 6 -> User A ghi lại -> Chặn với CONCURRENT_MODIFICATION
 */

import { BaseEntity } from '../canonical/baseEntity';

export class ConcurrentModificationError extends Error {
  public readonly entityId: string;
  public readonly expectedVersion: number;
  public readonly actualVersion: number;

  constructor(entityId: string, expectedVersion: number, actualVersion: number) {
    super(
      `Xung đột ghi đè đồng thời (CONCURRENT_MODIFICATION): Thực thể ${entityId} đã được chỉnh sửa lên phiên bản ${actualVersion}, phiên bản dự kiến là ${expectedVersion}.`
    );
    this.name = 'ConcurrentModificationError';
    this.entityId = entityId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export class ConcurrencyManager {
  /**
   * Kiểm tra phiên bản đối tượng trước khi thực hiện ghi đè
   */
  public static verifyVersion(
    currentEntity: { id: string; version?: number },
    expectedVersion?: number
  ): { isValid: boolean; error?: ConcurrentModificationError } {
    // Nếu đối tượng chưa có version hoặc không truyền expectedVersion (tương thích ngược)
    if (expectedVersion === undefined || currentEntity.version === undefined) {
      return { isValid: true };
    }

    if (currentEntity.version !== expectedVersion) {
      const err = new ConcurrentModificationError(
        currentEntity.id,
        expectedVersion,
        currentEntity.version
      );
      return { isValid: false, error: err };
    }

    return { isValid: true };
  }

  /**
   * Tăng phiên bản và cập nhật metadata thời gian ghi
   */
  public static prepareNextVersion<
    T extends { version?: number; updatedAt?: string; updatedBy?: string },
  >(entity: T, userId?: string): T & { version: number; updatedAt: string; updatedBy: string } {
    const nextVersion = (entity.version || 1) + 1;
    return {
      ...entity,
      version: nextVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: userId || entity.updatedBy || 'SYSTEM',
    };
  }
}
