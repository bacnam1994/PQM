# FRS-MOD-17: Đặc Tả Nghiệp Vụ Nhật Ký Kiểm Toán ALCOA+ (ALCOA+ Audit Trail & Hash Chain)

Tài liệu này quy định chi tiết chức năng tự động ghi nhận nhật ký kiểm toán ALCOA+, so sánh Diff trước/sau và kỹ thuật nối chuỗi mã băm bảo mật (Cryptographic Hash Chaining).

---

## 1. Input & Data Schema

- `entityType`, `entityId`: Thực thể bị tác động.
- `actionType`: `RECORD_CREATED`, `RECORD_UPDATED`, `STATUS_CHANGED`, `SIGNATURE_APPLIED`...
- `previousState`, `newState`: Dữ liệu đối tượng trước và sau khi thay đổi.
- `changeReason`: Lý do thay đổi (bắt buộc đối với hành vi UPDATE).
- `actorInfo`: User ID, Full Name, Role, IP Address.

## 2. Validation Rules

- Audit Trail là kho dữ liệu chỉ ghi thêm (Append-only / WORM), không có API nào hỗ trợ sửa hoặc xóa bản ghi log.
- Thời gian `timestamp` bắt buộc lấy từ đồng hồ máy chủ chuẩn NTP.
- Mọi bản ghi thứ $N$ phải chứa mã băm của bản ghi $N-1$ (`previousHash`).

## 3. Business Rules Reference

- `BR-AUD-001`: Chuẩn mực ghi nhận ALCOA+ bắt buộc cho mọi thao tác.
- `BR-AUD-002`: Chuỗi khối toàn vẹn mã băm nhật ký (Cryptographic Hash Chaining).

## 4. State Management

- Append-only Log Stream.

## 5. Service Layer Contract

```typescript
export interface AuditTrailService {
  recordEvent(input: AuditEventInput): Promise<AuditRecordContract>;
  queryAuditTrail(filter: AuditQueryFilter): Promise<AuditRecordContract[]>;
  verifyChainIntegrity(): Promise<{ isChainIntact: boolean; brokenAtIndex?: number }>;
  exportAuditReport(entityType: string, entityId: string): Promise<string>;
}
```

## 6. Permission & RBAC

- Ghi log: Tự động bởi hệ thống ngầm.
- Xem log: `QA_MANAGER`, `AUDITOR`, `SYSTEM_ADMIN` (phạm vi an ninh).
- Không ai có quyền sửa hoặc xóa log.

## 7. Error Handling

- `ERR_AUD_CHAIN_BROKEN`: Báo động an ninh khi chuỗi mã băm bị phá vỡ do sửa trực tiếp DB.

## 8. Audit Trail Requirement

- Bản thân thao tác tra cứu hoặc xuất báo cáo Audit Trail cũng được ghi nhận vào Access Log.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Ghi nhận Diff chi tiết khi sửa kết quả kiểm nghiệm
  Given Một chỉ tiêu đang có giá trị là "95.5"
  When Kỹ thuật viên sửa thành "98.2" kèm lý do "Hiệu chỉnh theo dung sai pipet"
  Then Một bản ghi Audit Trail được tạo tự động
  And Dòng log ghi rõ: oldValue = "95.5", newValue = "98.2", reason = "Hiệu chỉnh theo dung sai pipet"
  And Bản ghi log mới được nối chuỗi mã băm với bản ghi log trước đó
```
