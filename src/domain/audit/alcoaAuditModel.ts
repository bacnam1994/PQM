/**
 * PQM Domain - ALCOA+ Audit Trail Model (Model 9)
 * Đảm bảo 100% không mất dấu lịch sử thay đổi và toàn vẹn dữ liệu theo chuẩn ALCOA+:
 * - Attributable: Gắn liền danh tính người thực hiện (userId, userRole, correlationId)
 * - Legible: Dễ hiểu, minh bạch lý do thay đổi (reason, readable diff)
 * - Contemporaneous: Thời điểm ghi nhận thực tế không được hồi tố (monotonic timestamp)
 * - Original: Lưu giữ nguyên trạng dữ liệu cũ và mới (oldValue, newValue)
 * - Accurate: Bảo vệ tính toàn vẹn bằng hàm băm mật mã SHA-256
 * - Complete: Đầy đủ chuỗi phả hệ hành động từ khởi tạo đến hiện tại
 * - Consistent: Chuỗi liên kết băm (Hash Chaining) blockchain-like chống đứt đoạn
 * - Enduring: Bất biến (Immutable), không cho phép sửa hoặc xóa nhật ký
 * - Available: Sẵn sàng truy vấn phục vụ thanh tra Dược điển (FDA 21 CFR Part 11)
 */

import { calculateSha256, calculateSha256Sync } from '../../utils/cryptoUtils';

export const ALCOA_GENESIS_HASH =
  '0000000000000000000000000000000000000000000000000000000000000000';

export type AlcoaAuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'STATUS_CHANGE'
  | 'EVALUATE'
  | 'AUTO_HEAL'
  | 'SIGN'
  | 'RECONCILE'
  | 'IMPORT'
  | 'RESTORE';

export type AlcoaEventClassification = 'REGULATED' | 'INFORMATIONAL';

export interface AlcoaAuditRecord {
  id: string;
  sequenceNumber?: number;
  entityType: string;
  entityId: string;
  action: AlcoaAuditAction;
  field?: string;
  oldValue?: any;
  newValue?: any;
  userId: string;
  userRole?: string;
  userEmail?: string;
  timestamp: string; // Contemporaneous ISO timestamp
  reason: string;
  source: string;
  correlationId: string;
  classification?: AlcoaEventClassification;
  entryHash?: string;
  previousHash?: string;
  isGenesis?: boolean;
}

export type ChainViolationType =
  | 'HASH_MISMATCH'
  | 'BROKEN_LINK'
  | 'TIMESTAMP_REGRESSION'
  | 'MISSING_ATTRIBUTION'
  | 'INVALID_GENESIS';

export interface ChainViolation {
  recordId: string;
  index: number;
  type: ChainViolationType;
  details: string;
}

export interface ChainVerificationResult {
  isValid: boolean;
  tamperedIndex?: number;
  tamperedRecordId?: string;
  reason?: string;
  chainLength: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
  violations: ChainViolation[];
}

export interface AuditTrailFilterOptions {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: AlcoaAuditAction;
  classification?: AlcoaEventClassification;
  fromDate?: string;
  toDate?: string;
  correlationId?: string;
}

export interface AlcoaInspectionReport {
  generatedAt: string;
  inspectorName: string;
  totalRecords: number;
  regulatedRecordsCount: number;
  informationalRecordsCount: number;
  isChainIntact: boolean;
  violationsCount: number;
  actionsBreakdown: Record<string, number>;
  entityBreakdown: Record<string, number>;
  usersInvolved: string[];
  chainTimeSpan: {
    start?: string;
    end?: string;
  };
  alcoaComplianceSummary: {
    attributable: boolean;
    legible: boolean;
    contemporaneous: boolean;
    original: boolean;
    accurate: boolean;
    complete: boolean;
    consistent: boolean;
    enduring: boolean;
    available: boolean;
  };
}

export class AlcoaAuditManager {
  /**
   * Tính chuỗi chuẩn hóa payload để băm SHA-256.
   * Duy trì công thức chuẩn để tương thích 100% với hệ thống cũ.
   */
  public static computePayloadString(record: {
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    field?: string;
    oldValue?: any;
    newValue?: any;
    userId: string;
    timestamp: string;
    reason: string;
    previousHash?: string;
  }): string {
    const prev = record.previousHash || ALCOA_GENESIS_HASH;
    return `${record.id}|${record.entityType}|${record.entityId}|${record.action}|${record.field || ''}|${JSON.stringify(record.oldValue)}|${JSON.stringify(record.newValue)}|${record.userId}|${record.timestamp}|${record.reason}|${prev}`;
  }

  /**
   * Phân loại tự động sự kiện theo yêu cầu quy chuẩn GMP (Regulated vs Informational)
   */
  public static classifyAction(
    entityType: string,
    action: AlcoaAuditAction
  ): AlcoaEventClassification {
    const regulatedEntities = [
      'BATCH',
      'TEST_RESULT',
      'TCCS',
      'FORMULA',
      'DEVIATION',
      'ELECTRONIC_SIGNATURE',
      'CHANGE_CONTROL',
    ];

    if (regulatedEntities.includes(entityType.toUpperCase())) {
      return 'REGULATED';
    }

    if (
      action === 'SIGN' ||
      action === 'STATUS_CHANGE' ||
      action === 'DELETE' ||
      action === 'AUTO_HEAL'
    ) {
      return 'REGULATED';
    }

    return 'INFORMATIONAL';
  }

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
    userEmail?: string;
    timestamp?: string;
    reason: string;
    source?: string;
    correlationId?: string;
    previousHash?: string;
    sequenceNumber?: number;
    classification?: AlcoaEventClassification;
  }): Promise<AlcoaAuditRecord> {
    if (!params.userId || params.userId.trim() === '') {
      throw new Error('ALCOA+ Invariant Violation: userId là bắt buộc (Attributable)');
    }

    const classification =
      params.classification || this.classifyAction(params.entityType, params.action);

    // Đối với các hành động REGULATED trong GMP, lý do thay đổi là bắt buộc
    if (
      classification === 'REGULATED' &&
      (!params.reason || params.reason.trim() === '') &&
      params.action !== 'CREATE'
    ) {
      throw new Error(
        `ALCOA+ Invariant Violation: Hành động ${params.action} trên ${params.entityType} yêu cầu lý do thay đổi rõ ràng (Legible & Attributable)`
      );
    }

    const timestamp = params.timestamp || new Date().toISOString();
    const id = `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const correlationId = params.correlationId || `CORR-${Date.now()}`;
    const previousHash = params.previousHash || ALCOA_GENESIS_HASH;

    const rawString = this.computePayloadString({
      id,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      field: params.field,
      oldValue: params.oldValue,
      newValue: params.newValue,
      userId: params.userId,
      timestamp,
      reason: params.reason,
      previousHash,
    });

    const entryHash = await calculateSha256(rawString);

    const record: AlcoaAuditRecord = {
      id,
      sequenceNumber: params.sequenceNumber,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      field: params.field,
      oldValue: params.oldValue,
      newValue: params.newValue,
      userId: params.userId,
      userRole: params.userRole,
      userEmail: params.userEmail,
      timestamp,
      reason: params.reason,
      source: params.source || 'PQM_APP',
      correlationId,
      classification,
      entryHash,
      previousHash,
      isGenesis: previousHash === ALCOA_GENESIS_HASH,
    };

    return Object.freeze(record);
  }

  /**
   * Tạo bản ghi gốc (Genesis Record) khởi tạo chuỗi audit trail cho một thực thể
   */
  public static async createGenesisRecord(params: {
    entityType: string;
    entityId: string;
    userId: string;
    userRole?: string;
    reason?: string;
    correlationId?: string;
    initialData?: any;
  }): Promise<AlcoaAuditRecord> {
    return this.createRecord({
      entityType: params.entityType,
      entityId: params.entityId,
      action: 'CREATE',
      newValue: params.initialData,
      userId: params.userId,
      userRole: params.userRole,
      reason:
        params.reason ||
        `Khởi tạo bản ghi gốc (Genesis) cho ${params.entityType} #${params.entityId}`,
      correlationId: params.correlationId,
      previousHash: ALCOA_GENESIS_HASH,
      sequenceNumber: 1,
    });
  }

  /**
   * Nối một bản ghi mới vào chuỗi hiện có, tự động lấy previousHash từ bản ghi cuối cùng
   */
  public static async appendRecord(
    chain: AlcoaAuditRecord[],
    params: Omit<
      Parameters<typeof AlcoaAuditManager.createRecord>[0],
      'previousHash' | 'sequenceNumber'
    >
  ): Promise<{ updatedChain: AlcoaAuditRecord[]; newRecord: AlcoaAuditRecord }> {
    const lastRecord = chain.length > 0 ? chain[chain.length - 1] : null;
    const previousHash = lastRecord?.entryHash || ALCOA_GENESIS_HASH;
    const sequenceNumber = (lastRecord?.sequenceNumber || chain.length) + 1;

    const newRecord = await this.createRecord({
      ...params,
      previousHash,
      sequenceNumber,
    });

    return {
      updatedChain: [...chain, newRecord],
      newRecord,
    };
  }

  /**
   * Xác thực tính toàn vẹn của một bản ghi đơn lẻ
   */
  public static async verifyRecordIntegrity(record: AlcoaAuditRecord): Promise<boolean> {
    if (!record || !record.entryHash) return false;

    const rawString = this.computePayloadString({
      id: record.id,
      entityType: record.entityType,
      entityId: record.entityId,
      action: record.action,
      field: record.field,
      oldValue: record.oldValue,
      newValue: record.newValue,
      userId: record.userId,
      timestamp: record.timestamp,
      reason: record.reason,
      previousHash: record.previousHash,
    });

    const recomputed = await calculateSha256(rawString);
    return recomputed === record.entryHash;
  }

  /**
   * Xác thực tính toàn vẹn của một chuỗi audit records (Tamper Detection, Broken Link, Monotonic Time)
   */
  public static async verifyChainIntegrity(
    chain: AlcoaAuditRecord[],
    options?: { enforceMonotonicTime?: boolean }
  ): Promise<ChainVerificationResult> {
    const violations: ChainViolation[] = [];

    if (!chain || chain.length === 0) {
      return {
        isValid: true,
        chainLength: 0,
        violations: [],
      };
    }

    const enforceMonotonic = options?.enforceMonotonicTime ?? true;

    for (let i = 0; i < chain.length; i++) {
      const current = chain[i];
      const prev = i > 0 ? chain[i - 1] : null;

      // 1. Kiểm tra liên kết hash với bản ghi trước
      if (prev && current.previousHash !== prev.entryHash) {
        const violation: ChainViolation = {
          recordId: current.id,
          index: i,
          type: 'BROKEN_LINK',
          details: `Chuỗi hash bị đứt đoạn tại bản ghi ${current.id}: previousHash không khớp với entryHash của bản ghi trước.`,
        };
        violations.push(violation);

        return {
          isValid: false,
          tamperedIndex: i,
          tamperedRecordId: current.id,
          reason: violation.details,
          chainLength: chain.length,
          violations,
        };
      }

      // 2. Tái tính toán hash nội tại bản ghi
      const rawString = this.computePayloadString({
        id: current.id,
        entityType: current.entityType,
        entityId: current.entityId,
        action: current.action,
        field: current.field,
        oldValue: current.oldValue,
        newValue: current.newValue,
        userId: current.userId,
        timestamp: current.timestamp,
        reason: current.reason,
        previousHash: current.previousHash,
      });

      const recomputedHash = await calculateSha256(rawString);

      if (current.entryHash && current.entryHash !== recomputedHash) {
        const violation: ChainViolation = {
          recordId: current.id,
          index: i,
          type: 'HASH_MISMATCH',
          details: `Dữ liệu bản ghi ${current.id} đã bị can thiệp trái phép (entryHash không khớp với payload).`,
        };
        violations.push(violation);

        return {
          isValid: false,
          tamperedIndex: i,
          tamperedRecordId: current.id,
          reason: violation.details,
          chainLength: chain.length,
          violations,
        };
      }

      // 3. Kiểm tra tính đơn điệu của thời gian (Contemporaneous Time Verification)
      if (prev && enforceMonotonic) {
        const prevTime = Date.parse(prev.timestamp);
        const currTime = Date.parse(current.timestamp);
        if (!isNaN(prevTime) && !isNaN(currTime) && currTime < prevTime) {
          const violation: ChainViolation = {
            recordId: current.id,
            index: i,
            type: 'TIMESTAMP_REGRESSION',
            details: `Thời điểm ghi nhận của bản ghi ${current.id} (${current.timestamp}) đi lùi so với bản ghi trước (${prev.timestamp}) - Vi phạm Contemporaneous.`,
          };
          violations.push(violation);

          return {
            isValid: false,
            tamperedIndex: i,
            tamperedRecordId: current.id,
            reason: violation.details,
            chainLength: chain.length,
            violations,
          };
        }
      }

      // 4. Kiểm tra Attributability
      if (!current.userId || current.userId.trim() === '') {
        const violation: ChainViolation = {
          recordId: current.id,
          index: i,
          type: 'MISSING_ATTRIBUTION',
          details: `Bản ghi ${current.id} thiếu thông tin định danh người thực hiện (userId rỗng).`,
        };
        violations.push(violation);

        return {
          isValid: false,
          tamperedIndex: i,
          tamperedRecordId: current.id,
          reason: violation.details,
          chainLength: chain.length,
          violations,
        };
      }
    }

    return {
      isValid: true,
      chainLength: chain.length,
      firstTimestamp: chain[0]?.timestamp,
      lastTimestamp: chain[chain.length - 1]?.timestamp,
      violations: [],
    };
  }

  /**
   * Lọc và tra cứu chuỗi nhật ký kiểm toán theo các tiêu chí ALCOA+
   */
  public static filterAuditTrail(
    chain: AlcoaAuditRecord[],
    options: AuditTrailFilterOptions
  ): AlcoaAuditRecord[] {
    return chain.filter((record) => {
      if (options.entityType && record.entityType !== options.entityType) return false;
      if (options.entityId && record.entityId !== options.entityId) return false;
      if (options.userId && record.userId !== options.userId) return false;
      if (options.action && record.action !== options.action) return false;
      if (options.classification && record.classification !== options.classification) return false;
      if (options.correlationId && record.correlationId !== options.correlationId) return false;

      if (options.fromDate) {
        const from = Date.parse(options.fromDate);
        const current = Date.parse(record.timestamp);
        if (!isNaN(from) && !isNaN(current) && current < from) return false;
      }

      if (options.toDate) {
        const to = Date.parse(options.toDate);
        const current = Date.parse(record.timestamp);
        if (!isNaN(to) && !isNaN(current) && current > to) return false;
      }

      return true;
    });
  }

  /**
   * Sinh báo cáo thanh tra ALCOA+ toàn diện (Inspection Report)
   */
  public static async generateInspectionReport(
    chain: AlcoaAuditRecord[],
    inspectorName: string
  ): Promise<AlcoaInspectionReport> {
    const verification = await this.verifyChainIntegrity(chain);

    const actionsBreakdown: Record<string, number> = {};
    const entityBreakdown: Record<string, number> = {};
    const usersSet = new Set<string>();
    let regulatedCount = 0;
    let infoCount = 0;

    for (const record of chain) {
      actionsBreakdown[record.action] = (actionsBreakdown[record.action] || 0) + 1;
      entityBreakdown[record.entityType] = (entityBreakdown[record.entityType] || 0) + 1;
      usersSet.add(record.userId);

      if (record.classification === 'REGULATED') {
        regulatedCount++;
      } else {
        infoCount++;
      }
    }

    const hasNoAttributionIssues = chain.every((r) => r.userId && r.userId.trim() !== '');
    const hasReasonsForRegulated = chain.every(
      (r) =>
        r.classification !== 'REGULATED' ||
        r.action === 'CREATE' ||
        (r.reason && r.reason.trim() !== '')
    );

    return {
      generatedAt: new Date().toISOString(),
      inspectorName,
      totalRecords: chain.length,
      regulatedRecordsCount: regulatedCount,
      informationalRecordsCount: infoCount,
      isChainIntact: verification.isValid,
      violationsCount: verification.violations.length,
      actionsBreakdown,
      entityBreakdown,
      usersInvolved: Array.from(usersSet),
      chainTimeSpan: {
        start: chain[0]?.timestamp,
        end: chain[chain.length - 1]?.timestamp,
      },
      alcoaComplianceSummary: {
        attributable: hasNoAttributionIssues,
        legible: hasReasonsForRegulated,
        contemporaneous: verification.isValid,
        original: true,
        accurate: verification.isValid,
        complete: chain.length > 0,
        consistent: verification.isValid,
        enduring: true,
        available: true,
      },
    };
  }
}
