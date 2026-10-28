# ⚡ QUY TẮC ĐIỀU PHỐI QUY TRÌNH NGHIỆP VỤ (PQM WORKFLOW RULES)

> **Mã văn bản:** `PQM_WORKFLOW_RULES.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Tiêu chuẩn:** Master Workflow Engine & Kernel V2 (`ADR-001`, `PQM_SYSTEM_WORKFLOW_MASTER.md`)

---

## 1. KHUNG THỰC THI 12 BƯỚC QUY CHUẨN CỦA WORKFLOW KERNEL

Mọi thao tác thay đổi trạng thái hoặc ghi dữ liệu (Business Mutation) khi đi qua `WorkflowFacade.dispatch(actionId, payload)` đều được thực thi theo quy trình 12 bước bất biến:

```text
 1. ACTOR RESOLUTION       --> Xác định danh tính, ID, tên và Vai trò chuẩn của người thực hiện
 2. ACTION LOOKUP          --> Tra cứu Action Metadata trong CANONICAL_ACTION_REGISTRY
 3. SCHEMA & PAYLOAD VAL   --> Kiểm tra tính hợp lệ của dữ liệu đầu vào (Zod / Pure Validator)
 4. RBAC AUTHORIZATION     --> Kiểm tra thẩm quyền trong 8 Canonical Roles (RBAC Guard)
 5. REASON ENFORCEMENT     --> Kiểm tra bắt buộc lý do giải trình (với các action có rủi ro cao)
 6. CFR PART 11 SIGNATURE  --> Kiểm tra chữ ký điện tử số hóa (với các action duyệt/xuất xưởng)
 7. OCC CONCURRENCY LOCK   --> Khóa phiên bản chống ghi đè đồng thời (Optimistic Concurrency Control)
 8. CONFIRMATION TOKEN     --> Xác thực mã Token xác nhận 2 bước đối với thao tác Destructive
 9. FSM STATE TRANSITION   --> Kiểm tra tính hợp lệ của bước chuyển đổi trạng thái trong State Machine
10. DOMAIN PRECONDITIONS   --> Thẩm định tiền điều kiện nghiệp vụ sâu (ví dụ 7 Release Gates)
11. ATOMIC EXECUTION       --> Thi hành lưu trữ dữ liệu thông qua Repository Interface
12. ALCOA+ AUDIT OUTBOX    --> Ghi nhận nhật ký kiểm toán không thể xóa/sửa vào Outbox Queue
```

---

## 2. QUY CHUẨN DANH MỤC HÀNH ĐỘNG (CANONICAL ACTION REGISTRY)

1. **Vị trí duy nhất (SSoT)**: `src/workflow/definitions/index.ts` xuất bản qua `src/workflow/registry/actionRegistry.ts`.
2. **Quy tắc đặt tên Action ID**: Bắt buộc viết HOA theo cú pháp `ENTITY_ACTION` (ví dụ `BATCH_CREATE`, `TEST_RESULT_APPROVE`, `CRITERIA_MASTER_BULK_RENAME`).
3. **CẤM Action ID tự chế**: Tuyệt đối không dispatch bất kỳ action ID nào mà chưa được định nghĩa và khai báo trong `CANONICAL_ACTION_REGISTRY`. Test `tests/architecture/noUnregisteredAction.test.ts` sẽ tự động FAIL nếu vi phạm.
4. **Phân quyền vai trò chuẩn**: Chỉ sử dụng đúng 8 Canonical Roles đã quy định trong ADR-001 (`ADMIN`, `QA`, `QC`, `LAB`, `PRODUCTION`, `USER`, `VIEWER`, `GUEST`). Tuyệt đối không dùng các vai trò ma như `manager`, `lead`, `specialist`.

---

## 3. CƠ CHẾ AUDIT TRAIL ALCOA+ QUA OUTBOX QUEUE

- 100% các hành động có cờ `requiresAudit: true` đều tự động phát sinh bản ghi kiểm toán thông qua `OutboxAuditQueue` (`src/workflow/events/outboxAuditQueue.ts`).
- **Fail-Closed Principle**: Nếu việc ghi nhận Audit Trail thất bại, toàn bộ giao dịch nghiệp vụ bắt buộc phải ROLLBACK và báo lỗi cho người dùng. Không chấp nhận mutation thành công mà không có audit trail.
