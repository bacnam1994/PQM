# FRS-MOD-05: Đặc Tả Nghiệp Vụ Quản Lý Nguyên Vật Liệu & Lô Nhập Kho (Raw Materials & Material Lots)

Tài liệu này quy định chi tiết chức năng quản lý danh mục Nguyên vật liệu, kiểm soát tiếp nhận Lô nguyên liệu nhập kho, kiểm tra chất lượng đầu vào và theo dõi chu kỳ kiểm nghiệm lại (Retest Period).

---

## 1. Input & Data Schema

- **Nguyên vật liệu (Raw Material)**:
  - `materialCode`, `materialName`, `category` (Hoạt chất, tá dược, bao bì cấp 1).
  - `standardGrade`: Tiêu chuẩn dược dụng (DĐVN V, USP, BP).
  - `retestPeriodMonths`: Thời hạn kiểm nghiệm lại định kỳ (tháng).
- **Lô nhập kho (Material Lot)**:
  - `lotNumber`: Số lô của nhà sản xuất/cung ứng.
  - `internalLotNumber`: Mã số lô nội bộ do kho gán khi nhập hàng.
  - `supplierName`, `manufacturerName`, `countryOfOrigin`.
  - `manufacturingDate`, `expirationDate`, `retestDate`.
  - `receivedQuantity`, `remainingQuantity`, `unit`.
  - `supplierCoaFileUrl`: Tệp đính kèm CoA gốc của nhà sản xuất.

## 2. Validation Rules

- `expirationDate` phải sau `manufacturingDate`.
- `receivedQuantity` phải lớn hơn 0.
- Số lô nội bộ `internalLotNumber` phải là duy nhất.

## 3. Business Rules Reference

- `BR-MAT-001`: Kiểm soát tình trạng biệt trữ (`QUARANTINE`) khi mới tiếp nhận. Chỉ khi QC kiểm nghiệm đạt (`qcStatus === 'PASS'`) mới được xuất cấp vào sản xuất.
- `BR-MAT-002`: Tự động khóa lô nguyên liệu khi hết hạn dùng hoặc quá ngày `retestDate` mà chưa có kết quả kiểm nghiệm lại.

## 4. State Management

- `QUARANTINE`: Mới nhập kho, đang cách ly chờ kiểm nghiệm.
- `PASS`: Đạt tiêu chuẩn kiểm nghiệm, sẵn sàng cấp phát.
- `FAIL`: Không đạt, niêm phong chờ trả lại nhà cung ứng hoặc hủy bỏ.
- `RETEST_REQUIRED`: Quá hạn retest, tạm khóa chờ phòng kiểm nghiệm lấy mẫu thử lại.

## 5. Service Layer Contract

```typescript
export interface RawMaterialService {
  receiveMaterialLot(data: MaterialLotReceiptInput): Promise<MaterialLotContract>;
  updateLotQCStatus(
    lotId: string,
    status: 'PASS' | 'FAIL',
    testResultId?: string
  ): Promise<MaterialLotContract>;
  deductMaterialQuantity(lotId: string, quantity: number, batchId: string): Promise<void>;
  checkRetestExpiry(): Promise<MaterialLotContract[]>;
}
```

## 6. Permission & RBAC

- Nhập kho ban đầu: Thủ kho (`WAREHOUSE`).
- Đánh giá chất lượng: Kỹ thuật viên & QA (`ANALYST`, `QA_MANAGER`).
- Xuất kho cấp phát cho sản xuất: Thủ kho có đối chiếu kiểm tra cờ `qcStatus === 'PASS'`.

## 7. Error Handling

- `ERR_MAT_NOT_PASSED`: Báo lỗi khi cố gắng xuất kho lô nguyên liệu chưa có trạng thái `PASS`.
- `ERR_MAT_EXPIRED`: Báo lỗi khi xuất kho nguyên liệu hết hạn.

## 8. Audit Trail Requirement

- Lưu vết toàn bộ lịch sử xuất/nhập, số dư tồn kho thực tế và các quyết định chuyển trạng thái kiểm nghiệm của từng lô.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Khóa cấp phát nguyên liệu đang biệt trữ
  Given Lô tá dược "Tinh bột ngô" số lô nội bộ "RM-LOT-2026-001" đang có trạng thái "QUARANTINE"
  When Nhân viên sản xuất yêu cầu xuất cấp 50kg cho Lô sản xuất "BAT-001"
  Then Hệ thống từ chối với lỗi "ERR_MAT_NOT_PASSED"
  And Số lượng tồn kho không bị trừ
```
