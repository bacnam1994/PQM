# FRS-MOD-06: Đặc Tả Nghiệp Vụ Quản Lý Hồ Sơ Lô Sản Phẩm (Batch Dossier Management)

Tài liệu này quy định chi tiết chức năng khởi tạo, theo dõi vòng đời sản xuất, kiểm soát đóng băng Snapshot TCCS và phân bổ nguyên vật liệu vào Hồ sơ Lô sản phẩm.

---

## 1. Input & Data Schema

- `batchNumber`: Số lô sản xuất (VD: `BAT-2026-001`).
- `productId`: ID sản phẩm.
- `batchSize`: Quy mô cỡ lô thực tế sản xuất.
- `manufacturingDate`: Ngày bắt đầu sản xuất.
- `expirationDate`: Ngày hết hạn tính toán tự động dựa trên tuổi thọ sản phẩm.
- `manufacturingLine`: Dây chuyền/phân xưởng sản xuất.
- `materialAllocations[]`: Danh sách các lô nguyên liệu phân bổ vào lô này.

## 2. Validation Rules

- `batchNumber` phải là duy nhất trên toàn hệ thống.
- `productId` phải ở trạng thái `ACTIVE` và có một bản TCCS đang ở trạng thái `EFFECTIVE`.
- `expirationDate` tự động tính: `manufacturingDate + shelfLifeMonths`.

## 3. Business Rules Reference

- `BR-BAT-001`: Duy nhất số lô và quy tắc đánh số tự động.
- `BR-BAT-002`: Tự động niêm phong Snapshot TCCS tại thời điểm tạo Lô.
- `BR-BAT-003`: Khóa bất biến cấu trúc phả hệ nguyên liệu khi lô bắt đầu kiểm nghiệm (`TESTING`).

## 4. State Management

- Tuân thủ FSM 1 (`Batch Workflow FSM`): `DRAFT` -> `IN_PRODUCTION` -> `TESTING` -> `QA_REVIEW` -> `APPROVED` -> `RELEASED` (hoặc `REJECTED`, `HOLD`, `RECALLED`).

## 5. Service Layer Contract

```typescript
export interface BatchService {
  createBatch(input: CreateBatchInput): Promise<BatchContract>;
  allocateMaterials(
    batchId: string,
    allocations: MaterialAllocationInput[]
  ): Promise<BatchContract>;
  startTesting(batchId: string): Promise<BatchContract>;
  submitForQAReview(batchId: string): Promise<BatchContract>;
  approveBatchQuality(batchId: string, qaManagerId: string): Promise<BatchContract>;
  getBatchDossier(batchId: string): Promise<BatchDossierResponse>;
}
```

## 6. Permission & RBAC

- Khởi tạo Lô & Phân bổ nguyên liệu: `PRODUCTION_PLANNER`, `PRODUCTION_MANAGER`.
- Chuyển sang Kiểm nghiệm: `PRODUCTION` & `ANALYST`.
- Thẩm tra & Duyệt chất lượng Lô: `QA_REVIEWER`, `QA_MANAGER`.

## 7. Error Handling

- `ERR_BAT_DUPLICATE_NUMBER`: Trùng số lô.
- `ERR_BAT_NO_EFFECTIVE_TCCS`: Không tìm thấy bản TCCS có hiệu lực để chụp Snapshot.

## 8. Audit Trail Requirement

- Lưu vết toàn bộ các lần chuyển trạng thái, thông tin nguyên liệu đã phân bổ và chữ ký số xác nhận của Quản đốc xưởng.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Khởi tạo Lô tự động chụp Snapshot TCCS
  Given Sản phẩm "PRD-PARA500" có TCCS phiên bản 2 hiệu lực chứa 12 chỉ tiêu
  When Quản đốc xưởng tạo Lô "BAT-2026-001"
  Then Hồ sơ Lô được tạo thành công với trạng thái "DRAFT"
  And Snapshot TCCS của Lô chứa đúng 12 chỉ tiêu của phiên bản 2
  And Việc sửa TCCS gốc sau này không làm thay đổi 12 chỉ tiêu trong Lô
```
