/**
 * backend/src/services/signatureService.ts
 * Server-Authoritative Electronic Signature Engine
 *
 * Implements technical controls aligned with FDA 21 CFR Part 11 & GMP-WHO Annex 11:
 * - Deterministic Canonical SHA-256 Checksum
 * - Role & Permission Enforcement (QA / QC / ADMIN)
 * - Strict Zod Boundary Validation
 * - Collision-resistant UUIDs (crypto.randomUUID)
 * - Atomic Multi-location Write (electronic_signatures/ + audit_logs/)
 * - Zero Client Mutation (.write: false enforced in RTDB rules)
 */

import crypto from 'crypto';
import * as admin from 'firebase-admin';
import {
  calculateCanonicalSignatureChecksum,
  ElectronicSignature,
  SignatureDocumentType,
} from '@pqm/release-engine';
import { AuthenticatedUser } from '../middleware/auth';
import {
  createSignatureSchema,
  CreateSignatureRequestBody,
  CreateSignatureResponseBody,
} from '../types/signature';
import { removeUndefinedFields } from '../utils/canonicalSignature';
import { AppError } from '../utils/errors';

export class ServerSignatureService {
  /**
   * Create an electronic signature with server authority
   */
  async createSignature(
    user: AuthenticatedUser,
    rawInput: unknown,
    correlationId: string,
    db: admin.database.Database
  ): Promise<CreateSignatureResponseBody> {
    const startTime = Date.now();

    // 1. Strict Boundary Validation with Zod (Phase 12)
    const parseResult = createSignatureSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      const message = `${firstIssue.path.join('.') || 'input'}: ${firstIssue.message}`;
      throw new AppError('VALIDATION_ERROR', `Dữ liệu chữ ký không hợp lệ: ${message}`, 400);
    }

    const input: CreateSignatureRequestBody = parseResult.data;
    const documentType = input.documentType as SignatureDocumentType;
    const documentId = input.documentId.trim();

    // 2. Role-Based Access Control (RBAC) Enforcement
    if (
      documentType === 'BATCH_RELEASE' ||
      documentType === 'COA_ISSUE' ||
      documentType === 'BATCH_REJECT'
    ) {
      if (user.role !== 'QA' && !user.isAdmin) {
        throw new AppError(
          'PERMISSION_DENIED',
          'Từ chối quyền: Chỉ bộ phận QA hoặc Quản trị viên mới có thẩm quyền ký xuất xưởng Lô / Từ chối Lô / Ban hành CoA.',
          403
        );
      }
    } else if (documentType === 'TEST_RESULT_APPROVAL') {
      if (user.role !== 'QA' && user.role !== 'QC' && !user.isAdmin) {
        throw new AppError(
          'PERMISSION_DENIED',
          'Từ chối quyền: Chỉ QA, QC hoặc Quản trị viên mới có thẩm quyền ký duyệt phiếu kiểm nghiệm.',
          403
        );
      }
    }

    // 3. Construct Canonical Unsigned Data
    const signedAt = new Date().toISOString();
    const meaning =
      input.meaning && typeof input.meaning === 'string' && input.meaning.trim() !== ''
        ? input.meaning.trim()
        : 'Xác nhận phê duyệt điện tử.';

    const unsignedData: Omit<ElectronicSignature, 'id' | 'checksum' | 'status'> = {
      documentType,
      documentId,
      signerUid: user.uid,
      signerName: user.displayName,
      signerEmail: user.email,
      role: user.role,
      meaning,
      signedAt,
      ...(input.documentVersion !== undefined ? { documentVersion: input.documentVersion } : {}),
      ...(input.comments !== undefined && input.comments.trim() !== ''
        ? { comments: input.comments.trim() }
        : {}),
    };

    // 4. Calculate Deterministic Canonical SHA-256 Checksum
    const checksum = calculateCanonicalSignatureChecksum(unsignedData as any);

    // Phase 13: Collision-safe UUIDs
    const sigId = `sig_${crypto.randomUUID()}`;
    const auditId = `audit_sig_${crypto.randomUUID()}`;

    const signature: ElectronicSignature = removeUndefinedFields({
      id: sigId,
      ...unsignedData,
      checksum,
      status: 'CREATED' as const,
    });

    // 5. Server-Side ALCOA+ Audit Log Payload
    const auditPayload = removeUndefinedFields({
      eventId: auditId,
      timestamp: signedAt,
      actorUid: user.uid,
      actorRole: user.role,
      actorEmail: user.email,
      action: 'CREATE',
      collection: 'electronic_signatures',
      documentId: sigId,
      entityType: 'ELECTRONIC_SIGNATURE',
      entityId: sigId,
      details: `Electronic signature created [${documentType}] id=${documentId} by ${user.email} (${user.role})`,
      correlationId,
    });

    // 6. Phase 5: Atomic Multi-location Commit (Signature + Audit in one atomic operation)
    const updates: Record<string, any> = {
      [`/electronic_signatures/${sigId}`]: signature,
      [`/audit_logs/${auditId}`]: auditPayload,
    };

    await db.ref().update(updates);

    return {
      success: true,
      signature,
      durationMs: Date.now() - startTime,
      correlationId,
    };
  }
}

export const serverSignatureService = new ServerSignatureService();
