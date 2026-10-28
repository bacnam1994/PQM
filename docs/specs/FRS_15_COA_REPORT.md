# FRS-MOD-15: Đặc Tả Nghiệp Vụ Phiếu Kiểm Nghiệm Xuất Bản (CoA Report & Snapshot Publishing)

Tài liệu này quy định chi tiết chức năng đóng băng Snapshot dữ liệu, phát hành Phiếu Kiểm Nghiệm chính thức (Certificate of Analysis - CoA), in ấn chuẩn Dược điển và tra cứu mã QR bảo mật.

---

## 1. Input & Data Schema

- `batchId`: ID Lô sản phẩm cần phát hành CoA.
- `officialCoaNumber`: Số hiệu CoA theo quy chế văn thư.
- `signers`: Danh sách thông tin chữ ký số của Kỹ thuật viên, Người kiểm tra và Trưởng phòng QA.

## 2. Validation Rules

- CoA chỉ được tạo khi Lô đã có kết quả đánh giá chuẩn tắc là `PASS` hoặc có quyết định bằng văn bản của Hội đồng chất lượng.
- Template CoA đọc 100% dữ liệu từ `CoASnapshotContract`. Tuyệt đối cấm logic so sánh hoặc tính toán lại chất lượng trong tầng hiển thị.
- Mọi chỉ tiêu áp dụng quy tắc thay thế / miễn kiểm phải có Footnote giải trình chân trang.

## 3. Business Rules Reference

- `BR-COA-001`: Quy tắc Bất biến của CoA - Đọc từ Snapshot duy nhất và Cấm tự Evaluate.
- `BR-COA-002`: Quy tắc hiển thị chú thích pháp lý và chỉ tiêu thay thế trên CoA.

## 4. State Management

- `DRAFT` -> `PUBLISHED` -> `ARCHIVED` (hoặc `REVOKED`).

## 5. Service Layer Contract

```typescript
export interface CoAService {
  generateCoASnapshot(batchId: string, coaNumber: string): Promise<CoASnapshotContract>;
  getPublishedCoA(coaId: string): Promise<CoASnapshotContract>;
  verifyCoAChecksum(coaId: string): Promise<{ isValid: boolean; checksum: string }>;
  revokeCoA(coaId: string, reason: string): Promise<void>;
}
```

## 6. Permission & RBAC

- Tạo Snapshot & Xuất bản: `QA_MANAGER`.
- Xem / In ấn: `QA`, `WAREHOUSE`, `SALES` (chỉ xem bản đã `PUBLISHED`).

## 7. Error Handling

- `ERR_COA_UNAPPROVED_RESULTS`: Cố gắng xuất bản CoA khi còn kết quả kiểm nghiệm chưa duyệt.
- `ERR_COA_CHECKSUM_MISMATCH`: Dữ liệu CoA bị phát hiện sai lệch so với mã băm ban đầu.

## 8. Audit Trail Requirement

- Lưu vết toàn bộ lượt in ấn (Print log), lượt quét mã QR tra cứu và lý do thu hồi (nếu có).

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Đóng băng Snapshot và in CoA bất biến
  Given Lô "BAT-001" đã được phê duyệt xuất xưởng
  When QA Manager ký phát hành CoA số "COA-2026-001"
  Then Một bản Snapshot được đóng băng và sinh mã băm SHA-256
  And Màn hình in CoA hiển thị đúng nguyên văn kết quả từ Snapshot
  And Mã QR được tạo dẫn tới trang tra cứu xác thực trực tuyến
```
