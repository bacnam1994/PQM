# FRS-MOD-16: Đặc Tả Nghiệp Vụ Chữ Ký Điện Tử & Bảo Mật Dữ Liệu (21 CFR Part 11 Signatures)

Tài liệu này quy định chi tiết chức năng Chữ ký điện tử tuân thủ tiêu chuẩn FDA 21 CFR Part 11, xác thực hai lớp và kiểm tra tính toàn vẹn dữ liệu bằng mã băm SHA-256.

---

## 1. Input & Data Schema

- `targetEntityType`: Thực thể cần ký (`TestResult`, `Batch`, `CoA`, `TCCS`).
- `targetEntityId`: ID đối tượng.
- `signatureMeaning`: Ý nghĩa chữ ký cam kết pháp lý (`AUTHORED`, `REVIEWED`, `APPROVED`, `RELEASED`).
- `password`: Mật khẩu tài khoản hoặc mã PIN chữ ký số của người dùng.

## 2. Validation Rules

- Người ký phải nhập đúng mật khẩu chữ ký điện tử.
- Ý nghĩa chữ ký là bắt buộc và phải phù hợp với vai trò của người dùng.
- Dữ liệu được ký phải được băm SHA-256 (Canonical JSON) để tạo Checksum gắn kèm chữ ký.

## 3. Business Rules Reference

- `BR-SIG-001`: Quy chuẩn Chữ ký Điện tử 21 CFR Part 11 (Hiển thị tên, thời gian ISO 8601 và ý nghĩa cam kết).
- `BR-SIG-002`: Băm toàn vẹn dữ liệu chống giả mạo bằng SHA-256.

## 4. State Management

- `UNSIGNED` -> `SIGNED` (Bất biến).

## 5. Service Layer Contract

```typescript
export interface ElectronicSignatureService {
  applySignature(
    targetType: string,
    targetId: string,
    payload: any,
    credentials: AuthInput,
    meaning: SignatureMeaning
  ): Promise<ElectronicSignatureContract>;

  verifySignatureIntegrity(signatureId: string, currentPayload: any): Promise<boolean>;
}
```

## 6. Permission & RBAC

- Mọi người dùng có tài khoản hợp lệ đều có thể ký các tài liệu trong phạm vi quyền hạn của mình.
- Cấm chia sẻ tài khoản hoặc ký thay cho người khác.

## 7. Error Handling

- `ERR_SIG_INVALID_PASSWORD`: Sai mật khẩu ký điện tử.
- `ERR_SIG_DATA_TAMPERED`: Dữ liệu bị thay đổi sau khi ký (Hash mismatch).

## 8. Audit Trail Requirement

- Mọi lần ký thành công hoặc thất bại đều được ghi nhận vào nhật ký an ninh.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Ký điện tử kết quả kiểm nghiệm thành công
  Given Kỹ thuật viên hoàn tất kết quả phiếu "PKN-001"
  When Nhập đúng mật khẩu và chọn ý nghĩa "AUTHORED"
  Then Chữ ký điện tử được tạo với mã băm SHA-256
  And Phiếu hiển thị khối chữ ký gồm Họ tên, Thời gian chính xác và Lời cam kết
```
