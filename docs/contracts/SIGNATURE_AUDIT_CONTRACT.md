# SIGNATURE_AUDIT_CONTRACT: Hợp Đồng Chữ Ký Số & Nhật Ký Kiểm Toán ALCOA+

Tài liệu này chuẩn hóa toàn bộ cấu trúc dữ liệu của Chữ ký điện tử 21 CFR Part 11 và Nhật ký kiểm toán toàn vẹn (ALCOA+ Audit Trail) với chuỗi mã băm bảo mật (Hash Chain).

---

## 1. Bản Chất Nghiệp Vụ

- **Electronic Signature (Chữ ký điện tử)**: Là bằng chứng cam kết pháp lý cá nhân gắn chặt với nội dung dữ liệu được ký thông qua mã băm SHA-256. Không thể tách rời chữ ký khỏi văn bản đã ký.
- **ALCOA+ Audit Trail (Nhật ký kiểm toán)**: Là kho dữ liệu bất biến (Append-only / WORM), ghi lại chi tiết mọi tương tác của con người và hệ thống. Các bản ghi được kết nối với nhau dạng chuỗi khối để chống việc sửa xóa trộm trực tiếp trong cơ sở dữ liệu.

---

## 2. Định Nghĩa Kiểu Dữ Liệu (TypeScript Domain Interface)

```typescript
// ==================== ELECTRONIC SIGNATURE CONTRACT ====================

export type SignatureMeaning =
  | 'AUTHORED' // Tôi xác nhận là tác giả và đã thực hiện kiểm nghiệm này
  | 'REVIEWED' // Tôi xác nhận đã kiểm tra tính toàn vẹn của dữ liệu gốc
  | 'APPROVED' // Tôi phê duyệt tài liệu này có hiệu lực chính thức
  | 'RELEASED' // Tôi phê duyệt xuất xưởng lô sản phẩm này ra thị trường
  | 'REJECTED' // Tôi từ chối phê duyệt tài liệu này
  | 'REVOKED'; // Tôi thu hồi hiệu lực của tài liệu này

export interface ElectronicSignatureContract {
  signatureId: string;
  targetEntityType: string; // 'TestResult', 'Batch', 'TCCS', 'CoASnapshot'...
  targetEntityId: string;
  targetEntityChecksum: string; // SHA-256 của đối tượng dữ liệu tại thời điểm ký

  // Thông tin người ký
  signer: {
    userId: string;
    fullName: string;
    title: string;
    department: string;
    role: string;
  };

  // Thời gian & Ý nghĩa cam kết
  signedAt: string; // Thời gian máy chủ UTC (ISO 8601)
  meaning: SignatureMeaning;
  customDeclarationText: string; // Lời cam đoan trách nhiệm pháp lý cá nhân

  // Xác thực an ninh
  authMethod: 'PASSWORD' | 'MFA_TOTP' | 'PKI_CERTIFICATE';
  ipAddress: string;
  userAgent: string;

  // Mã băm chữ ký (Signature Digest)
  signatureChecksum: string; // SHA-256(signerId + signedAt + meaning + targetEntityChecksum)
  isValid: boolean;
}

// ==================== ALCOA+ AUDIT RECORD CONTRACT ====================

export type AuditActionType =
  | 'RECORD_CREATED'
  | 'RECORD_UPDATED'
  | 'RECORD_DELETED_LOGIC'
  | 'STATUS_CHANGED'
  | 'SIGNATURE_APPLIED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED'
  | 'DATA_EXPORTED'
  | 'SECURITY_EVENT';

export interface AuditFieldDiff {
  fieldName: string;
  fieldLabel?: string;
  oldValue: any;
  newValue: any;
  valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'ARRAY';
}

export interface AuditRecordContract {
  auditId: string;
  sequenceNumber: number; // Số thứ tự tăng dần liên tục: 1, 2, 3...
  timestamp: string; // Giờ chuẩn NTP của máy chủ (ISO 8601)

  // Định danh đối tượng bị tác động
  entityType: string;
  entityId: string;
  entityDisplayName: string;
  actionType: AuditActionType;

  // Dữ liệu so sánh trước/sau (Diff)
  changeReason?: string; // Lý do thay đổi (bắt buộc khi sửa)
  diffs: AuditFieldDiff[];

  // Định danh người thực hiện (Attributable)
  actor: {
    userId: string;
    userName: string;
    fullName: string;
    role: string;
    ipAddress: string;
  };

  // Nối chuỗi mã băm bảo mật (Cryptographic Hash Chaining)
  previousRecordHash: string; // Hash của bản ghi sequenceNumber - 1
  recordPayloadHash: string; // Hash của riêng nội dung bản ghi này
  chainChecksum: string; // SHA-256(recordPayloadHash + previousRecordHash)
}
```

---

## 3. Bất Biến Ràng Buộc (Invariants)

1. **Khóa chống chối bỏ**: Khi `ElectronicSignatureContract` đã được sinh ra, không có API nào cho phép chỉnh sửa hoặc xóa chữ ký này.
2. **Chuỗi băm liên tục**: Không được phép có lỗ hổng số thứ tự `sequenceNumber` trong bảng `AuditRecord`. Nếu bản ghi thứ $N$ có `previousRecordHash` không khớp với `chainChecksum` của bản ghi $N-1$, toàn bộ chuỗi bị đánh dấu là vi phạm an ninh toàn vẹn.
3. **Mọi cập nhật phải có lý do**: Trường `changeReason` là bắt buộc đối với mọi hành vi `RECORD_UPDATED`.
