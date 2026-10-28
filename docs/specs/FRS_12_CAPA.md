# FRS-MOD-12: Đặc Tả Nghiệp Vụ Hành Động Khắc Phục Phòng Ngừa (CAPA System)

Tài liệu này quy định chi tiết chức năng lập kế hoạch, triển khai, thẩm tra và đánh giá hiệu quả (Effectiveness Check) của Hành động Khắc phục và Phòng ngừa (CAPA).

---

## 1. Input & Data Schema

- `sourceType`: Nguồn gốc sinh ra CAPA (`OOS`, `DEVIATION`, `AUDIT_FINDING`, `CUSTOMER_COMPLAINT`).
- `sourceId`: ID hồ sơ nguồn gốc.
- `title`, `rootCause`: Nguyên nhân gốc rễ được xác định.
- `type`: `CORRECTIVE` (Khắc phục) hoặc `PREVENTIVE` (Phòng ngừa).
- `actions[]`: Danh sách nhiệm vụ thực thi cụ thể:
  - `description`: Nội dung (sửa SOP, đào tạo nhân sự, hiệu chuẩn lại máy...).
  - `assigneeId`: Người chịu trách nhiệm thực hiện.
  - `dueDate`: Hạn chót hoàn thành.
  - `evidenceUrl`: Bằng chứng hoàn thành (biên bản đào tạo, hóa đơn bảo dưỡng...).
- `effectivenessCheck`: Kế hoạch kiểm tra hiệu quả sau 3 - 6 tháng (xác nhận không tái diễn).

## 2. Validation Rules

- Mỗi hành động trong CAPA bắt buộc phải có Người chịu trách nhiệm (`assigneeId`) và Hạn hoàn thành (`dueDate`).
- CAPA không thể chuyển sang `CLOSED` nếu chưa có biên bản đánh giá hiệu quả đạt yêu cầu.

## 3. Business Rules Reference

- `BR-CAP-001`: Quy trình đóng vòng lặp CAPA (Closed-Loop CAPA) và đánh giá hiệu quả sau triển khai.
- `BR-CAP-002`: Chặn xuất xưởng Lô (Gate 5) nếu có hành động khắc phục tức thời (Containment) chưa hoàn thành.

## 4. State Management

- `INITIATED` -> `PLAN_APPROVED` -> `IN_PROGRESS` -> `VERIFICATION` -> `CLOSED`.

## 5. Service Layer Contract

```typescript
export interface CAPAService {
  createCAPA(data: CreateCAPAInput): Promise<CAPAContract>;
  approveActionPlan(capaId: string, qaApproverId: string): Promise<CAPAContract>;
  submitActionEvidence(actionId: string, evidenceUrl: string): Promise<void>;
  performEffectivenessCheck(capaId: string, checkData: EffectivenessInput): Promise<CAPAContract>;
  closeCAPA(capaId: string, qaCredentials: AuthInput): Promise<CAPAContract>;
}
```

## 6. Permission & RBAC

- Khởi tạo: `QA_SPECIALIST`, `PRODUCTION_MANAGER`.
- Phê duyệt kế hoạch & Đóng CAPA: `QA_MANAGER`.
- Thực hiện hành động: Người được phân công (`Assignee`).

## 7. Error Handling

- `ERR_CAPA_ACTIONS_INCOMPLETE`: Cố gắng thẩm tra đóng CAPA khi còn hành động dở dang.

## 8. Audit Trail Requirement

- Lưu vết toàn bộ bằng chứng tải lên và chữ ký thẩm tra hiệu quả của QA.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Hoàn thành và đánh giá hiệu quả CAPA thành công
  Given Một CAPA có 2 hành động đã hoàn thành nộp bằng chứng đầy đủ
  And Sau 3 tháng kiểm tra không phát hiện sự cố tái diễn (recurrenceObserved = false)
  When QA Manager ký xác nhận đánh giá hiệu quả đạt
  Then CAPA chính thức chuyển sang trạng thái "CLOSED"
  And Hồ sơ được lưu trữ vĩnh viễn trong kho lưu trữ chất lượng
```
