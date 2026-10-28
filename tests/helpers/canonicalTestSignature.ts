/**
 * tests/helpers/canonicalTestSignature.ts
 * Test helper for generating 100% valid canonical electronic signatures
 * Conforming strictly to Phase 4.1 (SHA-256 exact match).
 */

import { calculateCanonicalSignatureChecksum } from '@pqm/release-engine';
import { ElectronicSignature } from '../../src/types/signature';

export function createTestCanonicalSignature(
  overrides?: Partial<ElectronicSignature>
): ElectronicSignature {
  const now = overrides?.signedAt || new Date().toISOString();
  const sig: any = {
    id: overrides?.id || `sig_test_${Date.now()}`,
    documentType: overrides?.documentType || 'BATCH_RELEASE',
    documentId: overrides?.documentId || 'batch-default',
    documentVersion: overrides?.documentVersion,
    signerUid: overrides?.signerUid || 'u-qa-001',
    signerName: overrides?.signerName || 'QA Manager',
    signerEmail: overrides?.signerEmail || 'qa@pqm.com',
    role: overrides?.role || 'QA',
    meaning: overrides?.meaning || 'Xác nhận và phê duyệt xuất xưởng Lô sản xuất.',
    signedAt: now,
    status: overrides?.status || 'CREATED',
    ...overrides,
  };
  sig.checksum = calculateCanonicalSignatureChecksum(sig);
  return sig;
}
