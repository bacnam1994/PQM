/**
 * PQM 3.0 - Electronic Signature Types (FDA 21 CFR Part 11 & GMP-WHO Annex 11)
 * Định nghĩa cấu trúc bản ghi chữ ký điện tử có tính ràng buộc pháp lý
 */

import { Role } from './permissions';

export type SignatureDocumentType = 
  | 'BATCH'
  | 'BATCH_RELEASE'
  | 'BATCH_REJECT'
  | 'TEST_RESULT_APPROVAL'
  | 'COA_ISSUE'
  | 'TCCS'
  | 'DEVIATION'
  | 'CHANGE_CONTROL';

export const SIGNATURE_MEANINGS: Record<SignatureDocumentType, string> = {
  BATCH: 'Tôi xác nhận thẩm định và phê duyệt hồ sơ Lô sản xuất.',
  BATCH_RELEASE: 'Tôi xác nhận và phê duyệt xuất xưởng Lô sản xuất này theo đúng tiêu chuẩn chất lượng và hồ sơ lô.',
  BATCH_REJECT: 'Tôi xác nhận từ chối và loại bỏ Lô sản xuất này do không đạt tiêu chuẩn chất lượng quy định.',
  TEST_RESULT_APPROVAL: 'Tôi xác nhận đã soát xét và phê duyệt kết quả phân tích kiểm nghiệm này theo đúng phương pháp thử nghiệm.',
  COA_ISSUE: 'Tôi xác nhận ký ban hành Giấy chứng nhận phân tích (Certificate of Analysis - CoA) chính thức cho lô hàng.',
  TCCS: 'Tôi xác nhận đã thẩm tra toàn diện và phê duyệt ban hành Tiêu chuẩn cơ sở (TCCS) này theo chuẩn GMP.',
  DEVIATION: 'Tôi xác nhận đã thẩm tra nguyên nhân và phê duyệt giải pháp/đóng hồ sơ sai lệch chất lượng.',
  CHANGE_CONTROL: 'Tôi xác nhận phê duyệt kế hoạch thay đổi và đánh giá rủi ro theo chuẩn GMP-WHO.'
};

export interface ElectronicSignature {
  id: string;
  documentType: SignatureDocumentType;
  documentId: string;
  documentVersion?: number;
  signerUid: string;
  signerName: string;
  signerEmail: string;
  role: Role;
  meaning: string;
  signedAt: string; // ISO 8601 UTC
  checksum: string; // SHA-256 HMAC / Hash fingerprint
  comments?: string;
}

export interface CreateSignatureInput {
  documentType: SignatureDocumentType;
  documentId: string;
  documentVersion?: number;
  meaning?: string;
  comments?: string;
  password?: string;
}
