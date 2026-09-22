# FRS-MOD-03: Đặc Tả Nghiệp Vụ Quản Lý Tiêu Chuẩn Cơ Sở (TCCS Management)

Tài liệu này quy định chi tiết chức năng xây dựng, phê duyệt, quản lý phiên bản và bất biến hóa Tiêu chuẩn Cơ sở (TCCS) của sản phẩm.

---

## 1. Input & Data Schema

- `productId`: ID sản phẩm áp dụng.
- `versionNumber`: Số phiên bản tự động tăng.
- `effectiveDate`: Ngày bắt đầu hiệu lực.
- `pharmacopoeiaStandard`: Chuẩn Dược điển tham chiếu (VD: DĐVN V, USP 43).
- `criteria[]`: Mảng danh sách các chỉ tiêu kiểm nghiệm:
  - `criterionCode`, `criterionName`, `type`, `department`.
  - `specification`: Giá trị giới hạn (`minValue`, `maxValue`, `expectedText`, `unit`).
  - `testingMethod`: Phương pháp thử, SOP tham chiếu.
  - `isMandatory`: Cờ bắt buộc kiểm nghiệm.
- `alternateRules[]`: Các quy tắc thay thế / miễn thử đính kèm.

## 2. Validation Rules

- Mỗi TCCS phải có ít nhất 1 chỉ tiêu kiểm nghiệm.
- Các chỉ tiêu định lượng bắt buộc phải có ít nhất `minValue` hoặc `maxValue` và `unit`.
- Chỉ tiêu định tính bắt buộc có `expectedText`.
- Ngày hiệu lực `effectiveDate` không được là một ngày trong quá khứ khi ban hành bản mới.

## 3. Business Rules Reference

- `BR-TCS-001`: Phiên bản TCCS có hiệu lực là duy nhất tại một thời điểm cho một sản phẩm.
- `BR-TCS-002`: Bất biến tuyệt đối đối với bản TCCS đã ban hành (`EFFECTIVE`).
- `BR-TCS-003`: Tự động chụp Snapshot TCCS khi tạo Lô sản xuất.

## 4. State Management

- `DRAFT`: Soạn thảo bởi R&D / KCS.
- `UNDER_REVIEW`: Thẩm định bởi Trưởng nhóm QA.
- `EFFECTIVE`: Đã phê duyệt ban hành bởi QA Manager (Hiệu lực chính thức).
- `SUPERSEDED`: Đã bị thay thế bởi phiên bản mới hơn.
- `OBSOLETE`: Bị bãi bỏ.

## 5. Service Layer Contract

```typescript
export interface TCCSService {
  createDraftVersion(productId: string, sourceVersionId?: string): Promise<TCCSContract>;
  updateDraftCriteria(tccsId: string, criteria: CriterionInput[]): Promise<TCCSContract>;
  submitForReview(tccsId: string, reviewerId: string): Promise<TCCSContract>;
  approveAndMakeEffective(
    tccsId: string,
    approverCredentials: AuthInput,
    decisionNo: string
  ): Promise<TCCSContract>;
  getEffectiveTCCSByProductId(productId: string): Promise<TCCSContract>;
  getTCCSSnapshot(tccsId: string): Promise<TCCSSnapshot>;
}
```

## 6. Permission & RBAC

- Soạn thảo Draft: `ANALYST`, `RND_SPECIALIST`.
- Thẩm định (Review): `QA_REVIEWER`.
- Phê duyệt ban hành (Approve): Chỉ `QA_MANAGER` có chữ ký số.

## 7. Error Handling

- `ERR_TCCS_ALREADY_EFFECTIVE`: Báo lỗi khi cố tình sửa trực tiếp bản đã ban hành.
- `ERR_TCCS_NO_CRITERIA`: Báo lỗi khi nộp duyệt TCCS rỗng không có chỉ tiêu.

## 8. Audit Trail Requirement

- Lưu toàn bộ lịch sử biến động từng chỉ tiêu (Diff so sánh phiên bản cũ vs phiên bản mới).

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Ban hành phiên bản TCCS mới thành công
  Given Đang có TCCS phiên bản 1 trạng thái "EFFECTIVE" cho sản phẩm "PRD-PARA500"
  When QA Manager phê duyệt bản thảo TCCS phiên bản 2
  Then TCCS phiên bản 2 chuyển sang trạng thái "EFFECTIVE"
  And TCCS phiên bản 1 tự động chuyển sang trạng thái "SUPERSEDED"
  And Hệ thống ghi nhận chữ ký điện tử của QA Manager
```
