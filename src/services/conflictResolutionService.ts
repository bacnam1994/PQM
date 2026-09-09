/**
 * PQM 3.0 - Offline/Sync Conflict Resolution Service
 * Dịch vụ phát hiện và phân giải xung đột phiên bản khi đồng bộ ngoại tuyến
 * Tuân thủ ALCOA+ Data Integrity & FDA 21 CFR Part 11
 */

import { logAuditAction, AuditLogEntry } from './auditService';
import { nextVersion } from '../utils/concurrency';

export type ConflictResolutionStrategy = 
  | 'SAFE_MERGE'       // Tự động hợp nhất các trường không giao thoa
  | 'SERVER_WINS'      // Giữ nguyên dữ liệu server khi có xung đột trực tiếp trên cùng trường
  | 'CLIENT_WINS'      // Ghi đè bằng dữ liệu client (chỉ khi có ủy quyền đặc biệt)
  | 'MANUAL_REVIEW';   // Đánh dấu cần QA/Admin can thiệp thủ công

export interface FieldDiff {
  fieldName: string;
  clientValue: any;
  serverValue: any;
  isConflicting: boolean;
}

export interface ConflictReport {
  id: string;
  path: string;
  entityType: AuditLogEntry['collection'];
  entityId: string;
  expectedVersion: number;
  serverVersion: number;
  strategy: ConflictResolutionStrategy;
  diffs: FieldDiff[];
  conflictingFields: string[];
  nonConflictingFields: string[];
  resolvedData?: any;
  timestamp: number;
  actorEmail?: string;
}

export interface ConflictResolutionResult {
  canAutoResolve: boolean;
  strategy: ConflictResolutionStrategy;
  resolvedData: any;
  conflictingFields: string[];
  report: ConflictReport;
}

/**
 * Trích xuất loại thực thể và ID từ đường dẫn Firebase RTDB
 */
export function parsePathToEntity(path: string): { collection: AuditLogEntry['collection']; id: string } {
  const cleanPath = path.replace(/^\/+|\/+$/g, '');
  const segments = cleanPath.split('/');
  const root = segments[0]?.toLowerCase() || '';
  const id = segments[1] || 'UNKNOWN';

  let collection: AuditLogEntry['collection'] = 'SYSTEM';
  if (root === 'batches') collection = 'BATCHES';
  else if (root === 'products') collection = 'PRODUCTS';
  else if (root === 'tccslist' || root === 'tccs') collection = 'TCCS';
  else if (root === 'productformulas') collection = 'FORMULAS';
  else if (root === 'testresults') collection = 'TEST_RESULTS';
  else if (root === 'rawmaterials') collection = 'MATERIALS';
  else if (root === 'criteriaaliases') collection = 'CRITERIA_ALIASES';
  else if (root === 'quality_deviations') collection = 'DEVIATIONS';
  else if (root === 'electronic_signatures') collection = 'ELECTRONIC_SIGNATURES';

  return { collection, id };
}

/**
 * So sánh bằng sâu các kiểu nguyên thuỷ hoặc object/array đơn giản
 */
function isDeepEqual(val1: any, val2: any): boolean {
  if (val1 === val2) return true;
  if (val1 == null || val2 == null) return false;
  try {
    return JSON.stringify(val1) === JSON.stringify(val2);
  } catch (_) {
    return false;
  }
}

/**
 * Các trường metadata kỹ thuật không coi là xung đột dữ liệu nghiệp vụ
 */
const SYSTEM_METADATA_FIELDS = new Set([
  'version', 
  'updatedAt', 
  'updatedBy', 
  'id', 
  '_synced', 
  '_offline'
]);

/**
 * Phân tích độ lệch giữa dữ liệu client đề xuất và dữ liệu máy chủ hiện tại
 */
export function analyzeFieldDiffs(
  clientPayload: Record<string, any>,
  serverData: Record<string, any>
): { diffs: FieldDiff[]; conflictingFields: string[]; nonConflictingFields: string[] } {
  const diffs: FieldDiff[] = [];
  const conflictingFields: string[] = [];
  const nonConflictingFields: string[] = [];

  const clientKeys = Object.keys(clientPayload || {});

  for (const key of clientKeys) {
    // Bỏ qua các trường metadata hệ thống
    if (SYSTEM_METADATA_FIELDS.has(key)) continue;

    const clientVal = clientPayload[key];
    const serverVal = serverData ? serverData[key] : undefined;

    // Nếu giá trị giống nhau thì không xung đột
    if (isDeepEqual(clientVal, serverVal)) {
      continue;
    }

    // Nếu trường đó trên server có dữ liệu và khác biệt với client
    if (serverVal !== undefined) {
      diffs.push({
        fieldName: key,
        clientValue: clientVal,
        serverValue: serverVal,
        isConflicting: true
      });
      conflictingFields.push(key);
    } else {
      // Trường mới mà server chưa có -> Non-conflicting
      diffs.push({
        fieldName: key,
        clientValue: clientVal,
        serverValue: undefined,
        isConflicting: false
      });
      nonConflictingFields.push(key);
    }
  }

  return { diffs, conflictingFields, nonConflictingFields };
}

/**
 * Xử lý xung đột phiên bản OCC giữa thao tác offline và trạng thái server
 */
export async function resolveMutationConflict(
  path: string,
  clientPayload: Record<string, any>,
  serverData: Record<string, any>,
  expectedVersion: number = 1,
  actorEmail: string = 'system-offline-sync'
): Promise<ConflictResolutionResult> {
  const serverVersion = typeof serverData?.version === 'number' ? serverData.version : 1;
  const { collection, id: entityId } = parsePathToEntity(path);

  const { diffs, conflictingFields, nonConflictingFields } = analyzeFieldDiffs(
    clientPayload,
    serverData
  );

  const reportId = `cnf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 1. Trường hợp Safe Merge: không có trường nào xung đột trực tiếp
  if (conflictingFields.length === 0) {
    const mergedData = {
      ...serverData,
      ...clientPayload,
      version: nextVersion(serverVersion),
      updatedAt: Date.now(),
      updatedBy: actorEmail
    };

    const report: ConflictReport = {
      id: reportId,
      path,
      entityType: collection,
      entityId,
      expectedVersion,
      serverVersion,
      strategy: 'SAFE_MERGE',
      diffs,
      conflictingFields,
      nonConflictingFields,
      resolvedData: mergedData,
      timestamp: Date.now(),
      actorEmail
    };

    // Ghi Audit Trail ALCOA+ ghi nhận việc hợp nhất tự động an toàn
    await logAuditAction({
      action: 'SYNC_MERGE',
      collection,
      documentId: entityId,
      details: `[Safe Merge Offline] Tự động hợp nhất ${nonConflictingFields.length} trường không giao thoa cho ${collection} [${entityId}]. Nâng phiên bản từ v${serverVersion} -> v${mergedData.version}.`,
      performedBy: actorEmail
    });

    return {
      canAutoResolve: true,
      strategy: 'SAFE_MERGE',
      resolvedData: mergedData,
      conflictingFields: [],
      report
    };
  }

  // 2. Trường hợp Xung đột trực tiếp (Direct Overlap Conflict) -> Áp dụng SERVER_WINS mặc định để bảo toàn dữ liệu
  const report: ConflictReport = {
    id: reportId,
    path,
    entityType: collection,
    entityId,
    expectedVersion,
    serverVersion,
    strategy: 'SERVER_WINS',
    diffs,
    conflictingFields,
    nonConflictingFields,
    resolvedData: serverData,
    timestamp: Date.now(),
    actorEmail
  };

  // Ghi Audit Trail cảnh báo xung đột dữ liệu để QA/Admin nhận biết
  await logAuditAction({
    action: 'SYNC_CONFLICT',
    collection,
    documentId: entityId,
    details: `[Xung đột Đồng bộ Offline] Phát hiện xung đột phiên bản trên ${collection} [${entityId}] (Server v${serverVersion} > Expected v${expectedVersion}). Các trường xung đột: [${conflictingFields.join(', ')}]. Giữ nguyên trạng thái máy chủ (Server Wins).`,
    performedBy: actorEmail
  });

  return {
    canAutoResolve: false,
    strategy: 'SERVER_WINS',
    resolvedData: serverData,
    conflictingFields,
    report
  };
}
