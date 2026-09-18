/**
 * PQM Domain - Concurrency & Versioning Model (Model 11)
 * Chống ghi đè dữ liệu âm thầm (Optimistic Concurrency Control — OCC).
 *
 * Bất biến cốt lõi:
 * User A đọc version 5 → User B sửa → version = 6 → User A cố ghi → chặn CONCURRENT_MODIFICATION.
 * Không cho phép ghi phiên bản = 0 (chưa khởi tạo).
 * Số phiên bản luôn là số nguyên dương tăng đơn điệu.
 */

import { BaseEntity } from '../canonical/baseEntity';

// ============================================================
// 11a. ConcurrentModificationError
// ============================================================
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

// ============================================================
// 11b. VersionedEntity interface
// ============================================================
export interface VersionedEntity {
  id: string;
  version?: number;
  updatedAt?: string;
  updatedBy?: string;
  createdAt?: string;
}

export type ConflictResolutionStrategy = 'REJECT' | 'CLIENT_WINS' | 'SERVER_WINS' | 'MERGE';

export interface VersionConflictReport {
  entityId: string;
  expectedVersion: number;
  actualVersion: number;
  conflictedAt: string;
  availableStrategies: ConflictResolutionStrategy[];
  resolvedBy?: ConflictResolutionStrategy;
  resolvedAt?: string;
  resolvedByUserId?: string;
}

// ============================================================
// 11c. ConcurrencyManager
// ============================================================
export class ConcurrencyManager {
  /**
   * Kiểm tra phiên bản đối tượng trước khi thực hiện ghi đè (OCC Guard)
   */
  public static verifyVersion(
    currentEntity: { id: string; version?: number },
    expectedVersion?: number
  ): { isValid: boolean; error?: ConcurrentModificationError } {
    // Tương thích ngược: nếu đối tượng chưa có version hoặc không truyền expectedVersion
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
   * Tăng phiên bản và cập nhật metadata thời gian ghi (chuẩn monotonic)
   */
  public static prepareNextVersion<T extends VersionedEntity>(
    entity: T,
    userId?: string
  ): T & { version: number; updatedAt: string; updatedBy: string } {
    const currentVersion = entity.version || 1;
    const nextVersion = currentVersion + 1;

    return {
      ...entity,
      version: nextVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: userId || entity.updatedBy || 'SYSTEM',
    };
  }

  /**
   * Khởi tạo phiên bản 1 cho thực thể mới tạo
   */
  public static initializeVersion<T extends VersionedEntity>(
    entity: T,
    userId?: string
  ): T & { version: 1; createdAt: string; updatedAt: string; updatedBy: string } {
    const now = new Date().toISOString();
    return {
      ...entity,
      version: 1,
      createdAt: entity.createdAt || now,
      updatedAt: now,
      updatedBy: userId || 'SYSTEM',
    };
  }

  /**
   * Tạo báo cáo xung đột phiên bản đầy đủ
   */
  public static createConflictReport(
    entityId: string,
    expectedVersion: number,
    actualVersion: number,
    availableStrategies: ConflictResolutionStrategy[] = ['REJECT']
  ): VersionConflictReport {
    return {
      entityId,
      expectedVersion,
      actualVersion,
      conflictedAt: new Date().toISOString(),
      availableStrategies,
    };
  }

  /**
   * Đánh dấu xung đột đã được giải quyết
   */
  public static resolveConflict(
    report: VersionConflictReport,
    strategy: ConflictResolutionStrategy,
    resolvedByUserId: string
  ): VersionConflictReport {
    if (!report.availableStrategies.includes(strategy)) {
      throw new Error(
        `Chiến lược giải quyết xung đột '${strategy}' không được phép cho thực thể ${report.entityId}.`
      );
    }

    return {
      ...report,
      resolvedBy: strategy,
      resolvedAt: new Date().toISOString(),
      resolvedByUserId,
    };
  }

  /**
   * So sánh phiên bản: trả về true nếu entity1 mới hơn entity2
   */
  public static isNewer<T extends VersionedEntity>(entity1: T, entity2: T): boolean {
    const v1 = entity1.version || 0;
    const v2 = entity2.version || 0;
    return v1 > v2;
  }

  /**
   * Kiểm tra phiên bản tối thiểu bắt buộc
   */
  public static assertMinimumVersion<T extends VersionedEntity>(
    entity: T,
    minVersion: number
  ): { passed: boolean; actualVersion: number; message?: string } {
    const actual = entity.version || 0;
    if (actual < minVersion) {
      return {
        passed: false,
        actualVersion: actual,
        message: `Thực thể ${entity.id} yêu cầu phiên bản tối thiểu ${minVersion}, hiện có phiên bản ${actual}.`,
      };
    }
    return { passed: true, actualVersion: actual };
  }
}
