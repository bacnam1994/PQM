/**
 * PQM Domain - ALCOA+ Audit Trail Model (Model 9)
 * Không mất dấu lịch sử thay đổi theo chuẩn ALCOA+:
 * Attributable, Legible, Contemporaneous, Original, Accurate, Complete, Consistent, Enduring, Available.
 */

import { calculateSha256 } from '../../services/auditHardeningService';

export interface AlcoaAuditRecord {
  id: string;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'EVALUATE' | 'AUTO_HEAL' | 'SIGN';
  field?: string;
  oldValue?: any;
  newValue?: any;
  userId: string;
  userRole?: string;
  timestamp: string; // Contemporaneous ISO timestamp
  reason: string;
  source: string;
  correlationId: string;
  entryHash?: string;
  previousHash?: string;
}

export class AlcoaAuditManager {
  /**
   * Tạo bản ghi kiểm toán chuẩn ALCOA+ kèm mã băm SHA-256 bảo vệ tính toàn vẹn
   */
  public static async createRecord(params: {
    entityType: string;
    entityId: string;
    action: AlcoaAuditRecord['action'];
    field?: string;
    oldValue?: any;
    newValue?: any;
    userId: string;
    userRole?: string;
    reason: string;
    source?: string;
    correlationId?: string;
    previousHash?: string;
  }): Promise<AlcoaAuditRecord> {
    const timestamp = new Date().toISOString();
    const id = `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const correlationId = params.correlationId || `CORR-${Date.now()}`;
    const previousHash =
      params.previousHash || '0000000000000000000000000000000000000000000000000000000000000000';

    const rawString = `${id}|${params.entityType}|${params.entityId}|${params.action}|${params.field || ''}|${JSON.stringify(params.oldValue)}|${JSON.stringify(params.newValue)}|${params.userId}|${timestamp}|${params.reason}|${previousHash}`;
    const entryHash = await calculateSha256(rawString);

    return {
      id,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      field: params.field,
      oldValue: params.oldValue,
      newValue: params.newValue,
      userId: params.userId,
      userRole: params.userRole,
      timestamp,
      reason: params.reason,
      source: params.source || 'PQM_APP',
      correlationId,
      entryHash,
      previousHash,
    };
  }

  /**
   * Xác thực tính toàn vẹn của một chuỗi audit records (Tamper Detection)
   */
  public static async verifyChainIntegrity(chain: AlcoaAuditRecord[]): Promise<{
    isValid: boolean;
    tamperedIndex?: number;
    reason?: string;
  }> {
    if (!chain || chain.length === 0) {
      return { isValid: true };
    }

    for (let i = 0; i < chain.length; i++) {
      const current = chain[i];
      const prev = i > 0 ? chain[i - 1] : null;

      // 1. Kiểm tra liên kết hash với bản ghi trước
      if (prev && current.previousHash !== prev.entryHash) {
        return {
          isValid: false,
          tamperedIndex: i,
          reason: `Chuỗi hash bị đứt đoạn tại bản ghi ${current.id}: previousHash không khớp với entryHash của bản ghi trước.`,
        };
      }

      // 2. Tái tính toán hash nội tại bản ghi
      const rawString = `${current.id}|${current.entityType}|${current.entityId}|${current.action}|${current.field || ''}|${JSON.stringify(current.oldValue)}|${JSON.stringify(current.newValue)}|${current.userId}|${current.timestamp}|${current.reason}|${current.previousHash || '0000000000000000000000000000000000000000000000000000000000000000'}`;
      const recomputedHash = await calculateSha256(rawString);

      if (current.entryHash && current.entryHash !== recomputedHash) {
        return {
          isValid: false,
          tamperedIndex: i,
          reason: `Dữ liệu bản ghi ${current.id} đã bị can thiệp trái phép (entryHash không khớp với payload).`,
        };
      }
    }

    return { isValid: true };
  }
}
