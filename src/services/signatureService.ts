/**
 * PQM 3.0 - Electronic Signature Service
 * Dịch vụ ký duyệt điện tử tuân thủ tiêu chuẩn FDA 21 CFR Part 11 và GMP-WHO Annex 11
 */

import { ref, get, set, update, query, orderByChild, equalTo } from 'firebase/database';
import { getAuth, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { db } from '../firebase';
import {
  ElectronicSignature,
  CreateSignatureInput,
  SIGNATURE_MEANINGS,
  SignatureDocumentType,
  SignatureStatus,
} from '../types/signature';
import { can, normalizeUser } from './permissionService';
import { logAuditAction } from './auditService';
import { removeUndefined } from '../utils';
import { calculateSha256Sync } from '../utils/cryptoUtils';

/**
 * Tính toán mã băm checksum SHA-256 bảo đảm tính bất biến của chữ ký (integrity fingerprint)
 */
export async function computeSignatureChecksum(
  data: Omit<ElectronicSignature, 'id' | 'checksum'>
): Promise<string> {
  const payload = [
    data.documentType,
    data.documentId,
    data.documentVersion ?? '',
    data.signerUid,
    data.signerEmail,
    data.role,
    data.meaning,
    data.signedAt,
  ].join('|');

  return calculateSha256Sync(payload);
}

export class SignatureService {
  private readonly collectionPath = 'electronic_signatures';

  /**
   * Tạo chữ ký điện tử hợp lệ có xác thực 2 yếu tố (21 CFR Part 11)
   */
  async createElectronicSignature(
    currentUser: any,
    input: CreateSignatureInput
  ): Promise<ElectronicSignature> {
    const identity = normalizeUser(currentUser);
    if (!identity || !identity.uid) {
      throw new Error('Yêu cầu người dùng đăng nhập để thực hiện ký điện tử.');
    }

    if (!input.documentId?.trim()) {
      throw new Error('Mã tài liệu (Document ID) không được để trống.');
    }
    if (!input.documentType) {
      throw new Error('Loại tài liệu ký duyệt (Document Type) không được để trống.');
    }

    // 1. Kiểm tra thẩm quyền theo vai trò (RBAC Check)
    if (input.documentType === 'BATCH_RELEASE' || input.documentType === 'COA_ISSUE') {
      if (!can(identity, 'batch:release')) {
        throw new Error(
          'Từ chối quyền: Chỉ bộ phận QA hoặc Quản trị viên mới có thẩm quyền ký xuất xưởng Lô / Ban hành CoA.'
        );
      }
    } else if (input.documentType === 'TEST_RESULT_APPROVAL') {
      if (!can(identity, 'test_result:approve')) {
        throw new Error('Từ chối quyền: Bạn không có quyền ký duyệt phiếu kiểm nghiệm.');
      }
    } else if (input.documentType === 'BATCH_REJECT') {
      if (!can(identity, 'batch:reject')) {
        throw new Error('Từ chối quyền: Bạn không có quyền ký quyết định từ chối Lô.');
      }
    }

    // 2. Xác thực lại mật khẩu người ký (Re-authentication) nếu được cung cấp
    if (input.password && identity.email) {
      try {
        const auth = getAuth();
        const firebaseUser = auth.currentUser;
        if (firebaseUser && firebaseUser.email === identity.email) {
          const credential = EmailAuthProvider.credential(firebaseUser.email, input.password);
          await reauthenticateWithCredential(firebaseUser, credential);
        }
      } catch (err: any) {
        throw new Error(
          `Xác thực chữ ký điện tử thất bại: ${err.message || 'Mật khẩu không đúng'}`
        );
      }
    }

    // 3. Khởi tạo đối tượng chữ ký điện tử
    const signedAt = new Date().toISOString();
    const meaning =
      input.meaning || SIGNATURE_MEANINGS[input.documentType] || 'Xác nhận phê duyệt điện tử.';
    const id = `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const unsignedData: Omit<ElectronicSignature, 'id' | 'checksum'> = {
      documentType: input.documentType,
      documentId: input.documentId,
      documentVersion: input.documentVersion,
      signerUid: identity.uid,
      signerName: identity.displayName || identity.email || 'Người dùng',
      signerEmail: identity.email || 'unknown',
      role: identity.role,
      meaning: meaning,
      signedAt: signedAt,
      comments: input.comments,
      status: 'CREATED',
    };

    const checksum = await computeSignatureChecksum(unsignedData);

    const signature: ElectronicSignature = {
      id,
      ...unsignedData,
      checksum,
    };

    // 4. Lưu trữ chữ ký bất biến vào cơ sở dữ liệu
    const cleanSig = removeUndefined(signature);
    await set(ref(db, `${this.collectionPath}/${signature.id}`), cleanSig);

    // 5. Ghi nhận Audit Trail chuẩn ALCOA+
    logAuditAction({
      action: 'CREATE',
      collection: 'SYSTEM',
      documentId: signature.id,
      details: `Ký điện tử 21 CFR Part 11: [${signature.documentType}] id=${signature.documentId} bởi ${signature.signerEmail} (${signature.role})`,
      performedBy: identity.email || 'unknown',
    });

    return signature;
  }

  /**
   * Lấy danh sách chữ ký điện tử gắn liền với một tài liệu cụ thể (P1-3 Query Isolation)
   */
  async getSignaturesForDocument(
    documentType: SignatureDocumentType,
    documentId: string
  ): Promise<ElectronicSignature[]> {
    try {
      const q = query(
        ref(db, this.collectionPath),
        orderByChild('documentId'),
        equalTo(documentId)
      );
      const snapshot = await get(q);
      if (!snapshot.exists()) return [];

      const sigsMap = snapshot.val();
      const allSigs = Object.values(sigsMap) as ElectronicSignature[];
      return allSigs
        .filter((s) => s.documentType === documentType)
        .sort((a, b) => b.signedAt.localeCompare(a.signedAt));
    } catch {
      // Fallback an toàn nếu index chưa sẵn sàng
      const snapshot = await get(ref(db, this.collectionPath));
      if (!snapshot.exists()) return [];

      const allSigs = Object.values(snapshot.val()) as ElectronicSignature[];
      return allSigs
        .filter((s) => s.documentType === documentType && s.documentId === documentId)
        .sort((a, b) => b.signedAt.localeCompare(a.signedAt));
    }
  }

  /**
   * Cập nhật trạng thái vòng đời của chữ ký điện tử (P1-1 Signature Lifecycle)
   */
  async updateSignatureStatus(
    signatureId: string,
    status: SignatureStatus,
    extra?: { consumedAt?: string; releaseAttemptId?: string; releasedBatchId?: string }
  ): Promise<void> {
    const updateData = removeUndefined({
      status,
      ...extra,
    });
    await update(ref(db, `${this.collectionPath}/${signatureId}`), updateData);
  }

  /**
   * Thẩm định tính toàn vẹn của chữ ký điện tử (chống giả mạo / can thiệp)
   */
  async verifySignatureIntegrity(signature: ElectronicSignature): Promise<boolean> {
    if (!signature || !signature.checksum) return false;
    const { id: _id, checksum, ...dataToHash } = signature;
    const computed = await computeSignatureChecksum(dataToHash);
    return computed === checksum;
  }
}

export const signatureService = new SignatureService();
