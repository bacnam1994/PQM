# FRS-MOD-13: Đặc Tả Nghiệp Vụ Đường Ống Thẩm Duyệt Đa Cấp (Multi-Level Approval Pipeline)

Tài liệu này quy định chi tiết chức năng điều phối quy trình thẩm duyệt đa cấp, quản lý hàng đợi công việc (Work Queue) và bảo vệ rào chắn Tách biệt trách nhiệm (Segregation of Duties - SoD).

---

## 1. Input & Data Schema

- `entityType`: Đối tượng thẩm duyệt (`TEST_RESULT`, `BATCH_RELEASE`, `TCCS`, `OOS`, `DEVIATION`).
- `entityId`: ID đối tượng.
- `action`: `APPROVE` | `REJECT` | `DELEGATE`.
- `credentials`: Thông tin xác thực cấp 2 (Mật khẩu chữ ký điện tử).
- `comment` / `rejectionReason`: Ghi chú hoặc lý do từ chối.

## 2. Validation Rules

- Người dùng thực hiện thao tác phải có vai trò tương ứng với bước hiện tại (`stepIndex`).
- Kiểm tra SoD nghiêm ngặt: ID người duyệt hiện tại không được trùng với ID người lập bản ghi (`currentUserId !== originatorId`).
- Khi từ chối (`REJECT`), lý do giải trình là bắt buộc và tối thiểu 20 ký tự.

## 3. Business Rules Reference

- `BR-APP-001`: Luồng thẩm định & phê duyệt phiếu kiểm nghiệm đa cấp.
- `BR-APP-002`: Quy tắc thu hồi hoặc hủy bỏ phê duyệt.
- `BR-RBC-002`: Nguyên tắc Tách biệt Trách nhiệm chống xung đột quyền lợi (Four-Eyes Principle).

## 4. State Management

- `PENDING` -> `APPROVED` | `REJECTED` | `ESCALATED`.

## 5. Service Layer Contract

```typescript
export interface ApprovalWorkflowService {
  initiateApprovalPipeline(
    entityType: ApprovalEntityType,
    entityId: string,
    originatorId: string
  ): Promise<ApprovalTaskContract>;
  executeStepAction(
    taskId: string,
    action: 'APPROVE' | 'REJECT',
    credentials: AuthInput,
    comment?: string
  ): Promise<ApprovalTaskContract>;
  getPendingTasksByUser(userId: string): Promise<ApprovalTaskContract[]>;
  verifySoDCompliance(taskId: string, candidateUserId: string): boolean;
}
```

## 6. Permission & RBAC

- Bước Review: `QA_REVIEWER`.
- Bước Approve: `QA_MANAGER`, `QP`.
- Admin không được quyền duyệt thay (Separation of IT and Quality).

## 7. Error Handling

- `ERR_SOD_VIOLATION`: Cố gắng tự duyệt bản ghi của chính mình.
- `ERR_STEP_OUT_OF_ORDER`: Cố tình duyệt vượt cấp.

## 8. Audit Trail Requirement

- Lưu vết chi tiết từng bước chuyển trong đường ống kèm chữ ký số và thời gian xử lý thực tế.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Chặn người lập tự bấm duyệt kết quả kiểm nghiệm
  Given Kỹ thuật viên "User A" là người nhập và nộp phiếu "PKN-001"
  When "User A" cố gắng gọi hàm phê duyệt phiếu "PKN-001"
  Then Hệ thống từ chối với lỗi "ERR_SOD_VIOLATION"
  And Trạng thái phiếu vẫn là "SUBMITTED"
```
