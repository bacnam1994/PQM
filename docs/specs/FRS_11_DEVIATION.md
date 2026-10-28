# FRS-MOD-11: Đặc Tả Nghiệp Vụ Quản Lý Sai Lệch Quy Trình (Deviation Management)

Tài liệu này quy định chi tiết chức năng báo cáo, phân loại mức độ nghiêm trọng, đánh giá rủi ro chất lượng (ICH Q9) và xử lý Sai lệch (Deviation) trong sản xuất và kiểm nghiệm.

---

## 1. Input & Data Schema

- `department`: Bộ phận phát sinh sai lệch (`QC`, `QA`, `PRODUCTION`, `WAREHOUSE`).
- `title`, `description`: Mô tả hiện tượng bất thường.
- `occurredAt`: Thời điểm phát hiện sự cố.
- `batchId`: ID lô hàng liên quan (nếu có).
- `severity`: Mức độ nghiêm trọng (`MINOR`, `MAJOR`, `CRITICAL`).
- `riskAssessment`: Điểm số mức độ nghiêm trọng (S), khả năng xảy ra (P), khả năng phát hiện (D), tính chỉ số RPN ($S \times P \times D$).
- `immediateActions[]`: Các hành động cô lập sự cố tức thời.

## 2. Validation Rules

- Mọi nhân sự phát hiện sự cố đều có quyền lập phiếu báo cáo sai lệch ban đầu.
- Sai lệch `CRITICAL` bắt buộc phải kích hoạt thông báo khẩn cấp tới Giám đốc nhà máy và Trưởng phòng QA trong vòng 2 giờ.
- Không thể đóng sai lệch Major/Critical nếu chưa có hành động khắc phục CAPA gắn kèm.

## 3. Business Rules Reference

- `BR-DEV-001`: Phân loại 3 cấp độ sai lệch và đánh giá rủi ro chất lượng theo ICH Q9.
- `BR-DEV-002`: Chặn xuất xưởng Lô (Gate 4) khi có Sai lệch Major hoặc Critical chưa được phê duyệt đóng.

## 4. State Management

- `LOGGED` -> `UNDER_INVESTIGATION` -> `QA_EVALUATION` -> `CAPA_PENDING` -> `CLOSED`.

## 5. Service Layer Contract

```typescript
export interface DeviationService {
  logDeviation(input: CreateDeviationInput): Promise<DeviationContract>;
  performRiskAssessment(
    deviationId: string,
    assessment: RiskAssessmentInput
  ): Promise<DeviationContract>;
  assignImmediateAction(
    deviationId: string,
    action: ImmediateActionInput
  ): Promise<DeviationContract>;
  closeDeviation(
    deviationId: string,
    qaCredentials: AuthInput,
    remarks: string
  ): Promise<DeviationContract>;
  getOpenDeviationsByBatch(batchId: string): Promise<DeviationContract[]>;
}
```

## 6. Permission & RBAC

- Ghi nhận ban đầu: Mọi người dùng (`PRODUCTION`, `QC`, `WAREHOUSE`).
- Đánh giá rủi ro & Phê duyệt: `QA_SPECIALIST`, `QA_MANAGER`.

## 7. Error Handling

- `ERR_DEV_CANNOT_CLOSE_WITHOUT_CAPA`: Báo lỗi khi cố gắng đóng sai lệch nghiêm trọng mà không tạo CAPA.

## 8. Audit Trail Requirement

- Ghi nhận đầy đủ vết kiểm toán từ lúc phát hiện, điều tra hiện trường và đánh giá rủi ro.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Chặn xuất xưởng lô khi có sai lệch Critical đang mở
  Given Lô "BAT-001" có một sai lệch "Nhiệt độ phòng dập viên vượt 35°C" phân loại "CRITICAL"
  And Sai lệch này đang ở trạng thái "UNDER_INVESTIGATION"
  When QA Manager kiểm tra điều kiện xuất xưởng của Lô
  Then Cổng Release Gate 4 bị đánh dấu "BLOCKED"
  And Nút "Xuất xưởng" bị vô hiệu hóa
```
