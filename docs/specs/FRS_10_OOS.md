# FRS-MOD-10: Đặc Tả Nghiệp Vụ Điều Tra Kết Quả Ngoài Tiêu Chuẩn (OOS Investigation)

Tài liệu này quy định chi tiết quy trình điều tra 2 giai đoạn đối với các kết quả kiểm nghiệm ngoài tiêu chuẩn (Out of Specification - OOS) theo hướng dẫn của FDA và MHRA.

---

## 1. Input & Data Schema

- `testResultId`, `criterionId`: Điểm xuất phát phát sinh kết quả vượt ngưỡng.
- `initialValue`: Giá trị đo ban đầu không đạt.
- `phase1Investigation`:
  - Checklist điều tra phòng thí nghiệm (chuẩn bị mẫu, hóa chất chuẩn, tình trạng detector, sai số dụng cụ đo).
  - Phán quyết Phase 1: `LAB_ERROR_INVALIDATED` (Hủy kết quả do lỗi lab) hoặc `VALID_OOS` (Xác nhận kết quả đúng, chuyển sang điều tra sản xuất).
- `phase2Investigation`:
  - Phân tích nguyên nhân sản xuất (5-Why, Fishbone Diagram).
  - Đánh giá mức độ ảnh hưởng diện rộng (Impact Assessment).
- `finalDisposition`: Quyết định xử lý lô (`REJECT`, `REPROCESS`, `RELEASE_UNDER_CONCESSION`).

## 2. Validation Rules

- Tự động kích hoạt tạo phiếu OOS ngay khi một chỉ tiêu bắt buộc có kết quả `FAIL` mà không có quy tắc thay thế cứu.
- Không thể đóng OOS nếu chưa hoàn thành điều tra Phase 1 hoặc chưa có chữ ký duyệt của QA Manager.

## 3. Business Rules Reference

- `BR-OOS-001`: Quy trình điều tra 2 giai đoạn bắt buộc của OOS.
- `BR-OOS-002`: Tự động phong tỏa Lô sản phẩm và chặn cổng xuất xưởng Gate 3 khi OOS đang mở.

## 4. State Management

- `OPEN` -> `INVESTIGATING` -> `ROOT_CAUSE_IDENTIFIED` -> `CAPA_INITIATED` -> `CLOSED` (hoặc `INVALIDATED`).

## 5. Service Layer Contract

```typescript
export interface OOSService {
  initiateOOS(triggerData: OOSTriggerInput): Promise<OOSContract>;
  completePhase1LabInvestigation(oosId: string, phase1Data: Phase1Input): Promise<OOSContract>;
  completePhase2ManufacturingInvestigation(
    oosId: string,
    phase2Data: Phase2Input
  ): Promise<OOSContract>;
  closeOOS(
    oosId: string,
    finalDisposition: FinalDispositionInput,
    qaCredentials: AuthInput
  ): Promise<OOSContract>;
  getOpenOOSByBatch(batchId: string): Promise<OOSContract[]>;
}
```

## 6. Permission & RBAC

- Khởi tạo & Ghi nhận Phase 1: `ANALYST`, `QA_REVIEWER`.
- Điều tra Phase 2: `PRODUCTION_MANAGER`, `QA_SPECIALIST`.
- Phê duyệt đóng OOS: Chỉ `QA_MANAGER`.

## 7. Error Handling

- `ERR_OOS_CANNOT_CLOSE`: Cố gắng đóng hồ sơ khi thiếu kết luận nguyên nhân gốc rễ.

## 8. Audit Trail Requirement

- Lưu vết toàn bộ diễn biến các phiên điều tra, các kết quả thử nghiệm lại (retest results) và quyết định của hội đồng chất lượng.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Tự động kích hoạt OOS khi có chỉ tiêu không đạt
  Given Kỹ thuật viên nhập chỉ tiêu hàm lượng là "85%" (Tiêu chuẩn yêu cầu: 90% - 110%)
  When Kỹ thuật viên lưu kết quả
  Then Hệ thống tự động chuyển trạng thái chỉ tiêu sang "FAIL"
  And Một hồ sơ điều tra OOS mới được tự động khởi tạo ở trạng thái "OPEN"
  And Lô hàng bị khóa chặn cổng xuất xưởng Release Gate 3
```
