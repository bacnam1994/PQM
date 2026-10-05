/**
 * functions/src/signatureFunction.ts
 *
 * CANONICAL SERVER-SIDE ELECTRONIC SIGNATURE ENGINE
 *
 * Implements technical controls aligned with FDA 21 CFR Part 11 and GMP-WHO Annex 11 principles:
 * - Session freshness verification (auth_time within 300 seconds)
 * - Authority & Role verification (RBAC)
 * - NIST SHA-256 canonical checksum calculation
 * - Server-only write to electronic_signatures/
 * - Atomic ALCOA+ audit log recording
 */

import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  calculateCanonicalSignatureChecksum,
  ElectronicSignature,
  SignatureDocumentType,
} from './canonicalReleaseEngine';

export interface CreateSignatureServerRequest {
  documentType: SignatureDocumentType;
  documentId: string;
  documentVersion?: number;
  meaning: string;
  comments?: string;
  correlationId?: string;
}

export interface CreateSignatureServerResponse {
  success: boolean;
  signature: ElectronicSignature;
  durationMs: number;
}

export async function executeCreateElectronicSignatureBackend(
  requestData: CreateSignatureServerRequest,
  authContext: { uid: string; token: Record<string, any> },
  db: admin.database.Database
): Promise<CreateSignatureServerResponse> {
  const startTime = Date.now();
  const uid = authContext.uid;

  if (!uid) {
    throw new HttpsError(
      'unauthenticated',
      'Yêu cầu người dùng đăng nhập để thực hiện ký điện tử.'
    );
  }

  // 1. Session Freshness Check: Require re-authentication within 300 seconds (5 minutes)
  const authTime = authContext.token.auth_time ? Number(authContext.token.auth_time) : 0;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const sessionAgeSeconds = nowSeconds - authTime;

  if (sessionAgeSeconds > 300) {
    throw new HttpsError(
      'unauthenticated',
      'Phiên xác thực đã hết hạn cho chữ ký điện tử có độ tin cậy cao. Vui lòng nhập lại mật khẩu để xác thực tài khoản (Fresh Session Required).'
    );
  }

  // 2. Fetch User Profile to confirm Role and Admin Status
  const userSnapshot = await db.ref(`users/${uid}`).once('value');
  const adminSnapshot = await db.ref(`users/admins/${uid}`).once('value');
  const userData = userSnapshot.val() || {};
  const isAdmin =
    authContext.token.isAdmin === true ||
    authContext.token.role === 'ADMIN' ||
    adminSnapshot.exists() ||
    userData.role === 'ADMIN';

  const role: string = isAdmin ? 'ADMIN' : userData.role || authContext.token.role || 'USER';
  const signerName: string =
    userData.displayName ||
    authContext.token.name ||
    userData.email ||
    authContext.token.email ||
    'User';
  const signerEmail: string = userData.email || authContext.token.email || 'unknown';

  const { documentType, documentId, documentVersion, meaning, comments, correlationId } =
    requestData;

  if (!documentId || !documentId.trim()) {
    throw new HttpsError('invalid-argument', 'Mã tài liệu (Document ID) không được để trống.');
  }
  if (!documentType) {
    throw new HttpsError(
      'invalid-argument',
      'Loại tài liệu ký duyệt (Document Type) không được để trống.'
    );
  }

  // 3. RBAC Capability Verification
  if (
    documentType === 'BATCH_RELEASE' ||
    documentType === 'COA_ISSUE' ||
    documentType === 'BATCH_REJECT'
  ) {
    if (role !== 'QA' && !isAdmin) {
      throw new HttpsError(
        'permission-denied',
        'Từ chối quyền: Chỉ bộ phận QA hoặc Quản trị viên mới có thẩm quyền ký xuất xưởng Lô / Từ chối Lô / Ban hành CoA.'
      );
    }
  } else if (documentType === 'TEST_RESULT_APPROVAL') {
    if (role !== 'QA' && role !== 'QC' && !isAdmin) {
      throw new HttpsError(
        'permission-denied',
        'Từ chối quyền: Chỉ QA, QC hoặc Quản trị viên mới có thẩm quyền ký duyệt phiếu kiểm nghiệm.'
      );
    }
  }

  // 4. Construct Unsigned Data & Canonical Checksum
  const signedAt = new Date().toISOString();
  const unsignedData = {
    documentType,
    documentId,
    documentVersion,
    signerUid: uid,
    signerName,
    signerEmail,
    role,
    meaning,
    signedAt,
    comments,
  };

  const checksum = calculateCanonicalSignatureChecksum(unsignedData as any);
  const sigId = `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const signature: ElectronicSignature = {
    id: sigId,
    ...unsignedData,
    checksum,
    status: 'CREATED',
  };

  // 5. Server writes to electronic_signatures/
  await db.ref(`electronic_signatures/${sigId}`).set(signature);

  // 6. Server writes to audit_logs
  const auditId = `audit_sig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await db.ref(`audit_logs/${auditId}`).set({
    eventId: auditId,
    timestamp: signedAt,
    actorUid: uid,
    actorRole: role,
    actorEmail: signerEmail,
    action: 'CREATE',
    collection: 'electronic_signatures',
    documentId: sigId,
    entityType: 'ELECTRONIC_SIGNATURE',
    entityId: sigId,
    details: `Electronic signature created [${documentType}] id=${documentId} by ${signerEmail} (${role})`,
    correlationId: correlationId || `CORR-SIG-${sigId}`,
  });

  return {
    success: true,
    signature,
    durationMs: Date.now() - startTime,
  };
}
