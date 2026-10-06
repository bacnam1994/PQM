/**
 * backend/src/services/signatureService.ts
 * Server-Authoritative Electronic Signature Engine
 *
 * Implements technical controls aligned with FDA 21 CFR Part 11 & GMP-WHO Annex 11:
 * - Deterministic Canonical SHA-256 Checksum
 * - Role & Permission Enforcement (QA / QC / ADMIN)
 * - Server-only write to electronic_signatures/
 * - ALCOA+ Audit Log recording
 */

import * as admin from 'firebase-admin';
import {
  calculateCanonicalSignatureChecksum,
  ElectronicSignature,
  SignatureDocumentType,
} from '@pqm/release-engine';
import { AuthenticatedUser } from '../middleware/auth';
import { CreateSignatureRequestBody, CreateSignatureResponseBody } from '../types/signature';
import { removeUndefinedFields } from '../utils/canonicalSignature';
import { AppError } from '../utils/errors';

export class ServerSignatureService {
  /**
   * Create an electronic signature with server authority
   */
  async createSignature(
    user: AuthenticatedUser,
    input: CreateSignatureRequestBody,
    correlationId: string,
    db: admin.database.Database
  ): Promise<CreateSignatureResponseBody> {
    const startTime = Date.now();

    // 1. Validate Input
    if (!input.documentId || typeof input.documentId !== 'string' || !input.documentId.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Mã tài liệu (Document ID) không được để trống.', 400);
    }
    if (!input.documentType || typeof input.documentType !== 'string') {
      throw new AppError(
        'VALIDATION_ERROR',
        'Loại tài liệu ký duyệt (Document Type) không được để trống.',
        400
      );
    }

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
      ...(input.documentVersion !== undefined &&
      input.documentVersion !== null &&
      !isNaN(Number(input.documentVersion))
        ? { documentVersion: Number(input.documentVersion) }
        : {}),
      ...(input.comments !== undefined &&
      input.comments !== null &&
      typeof input.comments === 'string' &&
      input.comments.trim() !== ''
        ? { comments: input.comments.trim() }
        : {}),
    };

    // 4. Calculate Deterministic Canonical SHA-256 Checksum
    const checksum = calculateCanonicalSignatureChecksum(unsignedData as any);
    const sigId = `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const signature: ElectronicSignature = removeUndefinedFields({
      id: sigId,
      ...unsignedData,
      checksum,
      status: 'CREATED' as const,
    });

    // 5. Server-Authoritative Writes to RTDB
    await db.ref(`electronic_signatures/${sigId}`).set(signature);

    // 6. Server-Side ALCOA+ Audit Log Write
    const auditId = `audit_sig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
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
    await db.ref(`audit_logs/${auditId}`).set(auditPayload);

    return {
      success: true,
      signature,
      durationMs: Date.now() - startTime,
      correlationId,
    };
  }
}

export const serverSignatureService = new ServerSignatureService();
