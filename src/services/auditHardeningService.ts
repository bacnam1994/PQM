/**
 * PQM V4 Platform - ALCOA+ Audit Hardening Service
 * Cung cấp:
 * 1. Phân loại sự kiện: INFORMATIONAL vs REGULATED (GMP-critical)
 * 2. Cryptographic Hash Chaining (Blockchain-like immutable audit trail)
 * 3. Tự động kiểm tra tính toàn vẹn (Tamper Detection) cho thanh tra Dược.
 */

export type AuditEventClassification = 'INFORMATIONAL' | 'REGULATED';

export interface HardenedAuditPayload {
  action: string;
  collection: string;
  documentId?: string;
  details: string;
  performedBy: string;
  classification?: AuditEventClassification;
  timestamp?: string;
}

export interface TamperProofAuditRecord extends HardenedAuditPayload {
  id: string;
  classification: AuditEventClassification;
  timestamp: string;
  previousHash: string;
  entryHash: string;
}

/**
 * Tính mã SHA-256 chuẩn hóa cho chuỗi
 */
export async function calculateSha256(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback hash implementation khi crypto.subtle không khả dụng trong môi trường unit test cũ
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Xác định phân loại của sự kiện kiểm toán theo quy định GMP/ALCOA+
 */
export function classifyAuditEvent(collection: string, action: string): AuditEventClassification {
  const regulatedCollections = [
    'TEST_RESULTS',
    'BATCHES',
    'TCCS',
    'DEVIATIONS',
    'ELECTRONIC_SIGNATURES',
    'APPROVAL_WORKFLOW'
  ];

  if (regulatedCollections.includes(collection)) {
    return 'REGULATED';
  }

  if (action === 'DELETE' || action === 'RESTORE' || action === 'CHANGE_ROLE') {
    return 'REGULATED';
  }

  return 'INFORMATIONAL';
}

/**
 * Tạo bản ghi Audit Log có đính kèm Hash Chain
 */
export async function createHardenedAuditRecord(
  payload: HardenedAuditPayload,
  lastKnownHash: string = 'GENESIS_HASH_PQM_V4'
): Promise<TamperProofAuditRecord> {
  const timestamp = payload.timestamp || new Date().toISOString();
  const classification = payload.classification || classifyAuditEvent(payload.collection, payload.action);
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Tạo chuỗi nội dung chuẩn hóa để băm
  const contentToHash = JSON.stringify({
    previousHash: lastKnownHash,
    action: payload.action,
    collection: payload.collection,
    documentId: payload.documentId || '',
    details: payload.details,
    performedBy: payload.performedBy,
    timestamp,
    classification
  });

  const entryHash = await calculateSha256(contentToHash);

  return {
    id,
    action: payload.action,
    collection: payload.collection,
    documentId: payload.documentId,
    details: payload.details,
    performedBy: payload.performedBy,
    classification,
    timestamp,
    previousHash: lastKnownHash,
    entryHash
  };
}

/**
 * Thẩm tra toàn bộ chuỗi Audit Trail xem có bản ghi nào bị can thiệp / sửa đổi hay không
 */
export async function verifyAuditChainIntegrity(
  chain: TamperProofAuditRecord[],
  genesisHash: string = 'GENESIS_HASH_PQM_V4'
): Promise<{ isValid: boolean; brokenAtIndex?: number; reason?: string }> {
  if (!chain || chain.length === 0) {
    return { isValid: true };
  }

  let expectedPrevHash = genesisHash;

  for (let i = 0; i < chain.length; i++) {
    const record = chain[i];

    // 1. Kiểm tra liên kết với bản ghi trước
    if (record.previousHash !== expectedPrevHash) {
      return {
        isValid: false,
        brokenAtIndex: i,
        reason: `Mối nối băm bị gãy tại bản ghi #${record.id}. previousHash (${record.previousHash}) không khớp với hash mong đợi (${expectedPrevHash}).`
      };
    }

    // 2. Tính lại hash của chính bản ghi này
    const recalculated = await calculateSha256(
      JSON.stringify({
        previousHash: record.previousHash,
        action: record.action,
        collection: record.collection,
        documentId: record.documentId || '',
        details: record.details,
        performedBy: record.performedBy,
        timestamp: record.timestamp,
        classification: record.classification
      })
    );

    if (recalculated !== record.entryHash) {
      return {
        isValid: false,
        brokenAtIndex: i,
        reason: `Nội dung bản ghi #${record.id} đã bị can thiệp! Hash ghi nhận (${record.entryHash}) không khớp với hash tính toán lại (${recalculated}).`
      };
    }

    expectedPrevHash = record.entryHash;
  }

  return { isValid: true };
}
