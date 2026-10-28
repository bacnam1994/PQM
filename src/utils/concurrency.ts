/**
 * PQM 3.0 - Optimistic Concurrency Control (OCC) Utility
 * Kiểm soát xung đột cập nhật đồng thời chuẩn ALCOA+ Data Integrity
 */

export class ConcurrencyConflictError extends Error {
  public readonly currentVersion?: number;
  public readonly incomingVersion?: number;
  public readonly entityName: string;

  constructor(entityName: string, currentVersion?: number, incomingVersion?: number) {
    const msg = `${entityName} đã được cập nhật bởi một phiên làm việc khác (Phiên bản máy chủ: v${currentVersion ?? '?'}, phiên bản của bạn: v${incomingVersion ?? '?'}). Vui lòng làm mới (refresh) dữ liệu trước khi lưu.`;
    super(msg);
    this.name = 'ConcurrencyConflictError';
    this.entityName = entityName;
    this.currentVersion = currentVersion;
    this.incomingVersion = incomingVersion;
  }
}

/**
 * Kiểm tra khóa lạc quan (Optimistic Lock)
 * Nếu phiên bản gửi lên cũ hơn phiên bản hiện tại trên hệ thống -> Ném ConcurrencyConflictError
 */
export function validateOptimisticLock(
  currentVersion?: number,
  incomingVersion?: number,
  entityName: string = 'Bản ghi'
): void {
  if (
    currentVersion != null &&
    incomingVersion != null &&
    incomingVersion < currentVersion
  ) {
    throw new ConcurrencyConflictError(entityName, currentVersion, incomingVersion);
  }
}

/**
 * Tính toán số phiên bản tiếp theo
 */
export function nextVersion(currentVersion?: number): number {
  if (!currentVersion || currentVersion < 1) {
    return 2;
  }
  return currentVersion + 1;
}
