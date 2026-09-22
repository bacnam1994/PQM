# FRS-MOD-14: Đặc Tả Nghiệp Vụ Cổng Kiểm Soát Xuất Xưởng Lô (7 Release Gates)

Tài liệu này quy định chi tiết chức năng kiểm tra tự động 7 Cổng Kiểm Soát Xuất Xưởng (7 Mandatory Release Gates) và thủ tục ký ban hành Lệnh Xuất Xưởng sản phẩm (Batch Release).

---

## 1. Input & Data Schema

- `batchId`: ID Lô sản phẩm cần xuất xưởng.
- `qpCredentials`: Mật khẩu chữ ký điện tử của Qualified Person / Trưởng phòng QA.
- `releaseRemarks`: Ghi chú xuất xưởng chính thức.

## 2. Validation Rules (Kiểm Tra 7 Cổng Tự Động)

- **Gate 1 (Completeness)**: 100% chỉ tiêu theo TCCS đã được đo xong.
- **Gate 2 (Quality)**: `CanonicalStatusResolver.resolveBatchQuality.overallQualityStatus === 'PASS'`.
- **Gate 3 (OOS)**: Toàn bộ OOS của lô đã được đóng (`status === 'CLOSED'`).
- **Gate 4 (Deviation)**: Không có Sai lệch Major/Critical nào còn mở.
- **Gate 5 (CAPA)**: Không có hành động cô lập CAPA nào bị quá hạn.
- **Gate 6 (BPR Review)**: Hồ sơ sản xuất lô đã được duyệt (`bprStatus === 'APPROVED'`).
- **Gate 7 (CoA & Regulatory)**: CoA dự thảo đã tạo, số đăng ký thuốc còn hạn dùng.

## 3. Business Rules Reference

- `BR-REL-001`: Ma trận 7 Cổng Kiểm Soát Xuất Xưởng bắt buộc (Fail-Fast Algorithm).
- `BR-REL-002`: Lệnh giữ lại hoặc thu hồi lô khẩn cấp (`HOLD` / `RECALL`).

## 4. State Management

- `APPROVED` -> `RELEASED` (nếu đạt cả 7 Gate) hoặc giữ nguyên trạng thái kèm danh sách lỗi chặn.

## 5. Service Layer Contract

```typescript
export interface BatchReleaseService {
  evaluateReleaseGates(batchId: string): Promise<ReleaseGatesEvaluationResult>;
  executeBatchRelease(
    batchId: string,
    qpCredentials: AuthInput,
    remarks: string
  ): Promise<BatchContract>;
  executeBatchHold(batchId: string, reason: string, authorizedBy: string): Promise<BatchContract>;
  executeBatchRecall(batchId: string, recallClass: string, reason: string): Promise<BatchContract>;
}
```

## 6. Permission & RBAC

- Thẩm định 7 Cổng: Xem được bởi `QA_REVIEWER`, `QA_MANAGER`.
- Ký lệnh Xuất xưởng: Chỉ `QA_MANAGER` hoặc `QUALIFIED_PERSON`.

## 7. Error Handling

- `ERR_RELEASE_GATES_FAILED`: Trả về danh sách chi tiết các Gate bị chặn.

## 8. Audit Trail Requirement

- Ghi vết vĩnh viễn thời điểm xuất xưởng, kết quả của cả 7 Gate tại thời khắc ký và mã băm toàn vẹn của Lô.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Xuất xưởng thành công khi thỏa mãn 7 Gates
  Given Lô "BAT-001" hoàn thành 100% chỉ tiêu Đạt, không có OOS hay sai lệch mở
  When Qualified Person thẩm tra và ký số lệnh xuất xưởng
  Then Cả 7 Release Gates hiển thị màu xanh "PASSED"
  And Trạng thái lô chuyển sang "RELEASED"
  And Giấy chứng nhận xuất xưởng chính thức được sinh mã số
```
