# PQM — XÁC MINH TOÀN VẸN UNIFIED WORKFLOW EXECUTOR & RÀO CHẮN AUDIT

> **Tài liệu:** PQM_FINAL_EXECUTOR_INTEGRITY.md  
> **Phiên bản:** 1.0.0-FINAL-SOURCE-VERIFIED  
> **Ngày thực hiện:** 2026-09-24  
> **File kiểm toán cốt lõi:** `src/domain/workflow/UnifiedWorkflowExecutor.ts`  
> **Vấn đề trọng tâm:** Phân tích thứ tự thực thi thực tế, rủi ro che giấu lỗi kiểm toán (Audit Warning Suppress), và cơ chế Fail-Closed đảm bảo toàn vẹn ALCOA+ và FDA 21 CFR Part 11.

---

## 1. THỨ TỰ THỰC THI THỰC TẾ TRONG MÃ NGUỒN (EXECUTION PIPELINE)

Quy trình 12 bước quy chuẩn trong `UnifiedWorkflowExecutor.execute`:

1. **Step 1: Resolve Action Catalog Metadata**: Tra cứu Action trong `WORKFLOW_ACTION_CATALOG`. Nếu không tồn tại -> Trả về `failureCode: 'UNKNOWN_WORKFLOW_ACTION'`.
2. **Step 2: Validate Entity Type Match**: So khớp `actionMeta.entityType` với `context.entityType`. Tránh nhầm lẫn áp dụng action giữa các thực thể (ví dụ: dùng action của BATCH cho PRODUCT) -> Trả về `ENTITY_TYPE_MISMATCH`.
3. **Step 3: Authorization & RBAC Check**: Chuẩn hóa vai trò người thực thi (`normalizeUser`), kiểm tra đối chiếu danh sách `allowedRoles`. Admin chỉ được phép nếu Catalog cho phép hoặc là tác vụ quản trị hệ thống -> Trả về `UNAUTHORIZED_ROLE`.
4. **Step 4: Reason Enforcement Check**: Nếu `actionMeta.requiresReason === true`, bắt buộc `reason` không được để trống -> Trả về `REASON_REQUIRED`.
5. **Step 5: State Machine Transition Verification**: Kích hoạt `transitionResolver()` kết nối với Finite State Machine (`BatchStateMachine`, `TestResultStateMachine`, `DeviationStateMachine`, `TccsStateMachine`). Nếu bước chuyển vi phạm GMP -> Trả về `INVALID_STATE_TRANSITION`.
6. **Step 6: Domain Rules & Preconditions Validation**: Kích hoạt `domainValidator()` kiểm tra các điều kiện tiên quyết (ví dụ: 7 Release Gates, tỷ lệ công thức, khóa OCC) -> Trả về `failureCode: 'GATE_EVALUATION_FAILED'` hoặc vi phạm quy tắc.
7. **Step 7: Atomic Mutation Execution**: Thực thi callback `mutationHandler()`. Bắt lỗi ngoại lệ nếu ghi DB thất bại -> Trả về `MUTATION_FAILED`.
8. **Step 8: Audit Logging & ALCOA+ SSoT**:
   - Tự động suy luận `auditAction` (`CREATE`, `UPDATE`, `DELETE`).
   - Ánh xạ sang Collection kiểm toán chuẩn.
   - Ghi nhận `details`, `performedBy`, `documentId`.
   - **Xử lý lỗi kiểm toán (Xem chi tiết mục 2)**.
9. **Step 9: Observability & Execution Metric**: Tính toán `durationMs`, gán `executionId`, trả về kết quả cấu trúc.

---

## 2. VẤN ĐỀ TRỌNG YẾU: AUDIT INTEGRITY TRƯỚC VÀ SAU KHI SỬA ĐỔI

### 2.1. Phân tích Hiện trạng Cũ (Trạng thái Rủi ro Cao)

Trong mã nguồn ban đầu:

```typescript
try {
  await logAuditAction(...);
} catch (auditErr) {
  console.warn(`[UnifiedWorkflowExecutor] Ghi nhận audit cảnh báo:`, auditErr);
}
return { success: true, ... };
```

Đồng thời tại `src/services/auditService.ts`:

```typescript
export const logAuditAction = async (...) => {
  try { ... }
  catch (error) {
    console.error("Failed to log audit action:", error);
    // Không throw error để tránh làm gián đoạn luồng chính
  }
};
```

**Hệ quả & Vi phạm ALCOA+:**

- Giao dịch nghiệp vụ (Business Transaction) được đánh dấu là **THÀNH CÔNG (`success: true`)** ngay cả khi hệ thống hoàn toàn thất bại trong việc ghi vết nhật ký kiểm toán.
- Vi phạm nghiêm trọng nguyên tắc **Contemporaneous** (Ghi nhận tức thời) và **Complete** (Đầy đủ hồ sơ) của chuẩn ALCOA+ và FDA 21 CFR Part 11: Có sự biến đổi trạng thái trong cơ sở dữ liệu nhưng không hề có bằng chứng kiểm toán tương ứng.
- Lỗi bị che giấu bằng một dòng `console.warn` đơn thuần.

### 2.2. Giải pháp Cải tiến & Đóng rào chắn An ninh (Fail-Closed Architecture)

Nhóm phát triển đã thực hiện cải tiến có kiểm soát theo các nguyên tắc:

1. **Cập nhật `logAuditAction` (`src/services/auditService.ts`)**:
   - Bổ sung tùy chọn `options?: { throwOnError?: boolean }`.
   - Cho phép ném ngoại lệ khi được gọi từ các tác vụ quản trị có kiểm soát.

2. **Áp dụng cơ chế Fail-Closed trong `UnifiedWorkflowExecutor.ts`**:
   - Khi `actionMeta.requiresAudit === true`, truyền `{ throwOnError: true }` vào `logAuditAction`.
   - Khi ghi audit thất bại:
     - Ghi nhận `console.error` phục vụ giám sát hệ thống.
     - Trả về `success: false` với `failureCode: 'AUDIT_LOG_FAILED'`.
     - Đặt cờ trạng thái `auditStatus: 'AUDIT_FAILED'` và lưu giữ `auditError`.
     - Thông báo rõ ràng lý do từ chối: _"Theo nguyên tắc ALCOA+ và FDA 21 CFR Part 11, hành động nghiệp vụ không được xác nhận hoàn tất khi thiếu hồ sơ kiểm toán."_
     - Dữ liệu `data` từ `mutationHandler` vẫn được bảo toàn trong kết quả trả về để phục vụ đội ngũ kỹ thuật đối soát, đối chiếu và bồi hoàn (Compensation/Reconciliation) mà không làm mất thông tin.
   - Khi ghi audit thành công:
     - Trả về `auditStatus: 'COMMITTED'`.
   - Đối với tác vụ không bắt buộc audit:
     - Trả về `auditStatus: 'SKIPPED'`.

3. **Cập nhật giao diện `WorkflowExecutionResult`**:
   ```typescript
   export interface WorkflowExecutionResult<TData = any> {
     success: boolean;
     executionId: string;
     actionId: string;
     entityType: EntityType;
     entityId: string;
     fromState?: string;
     toState?: string;
     data?: TData;
     failureCode?: string;
     failureReason?: string;
     auditStatus?: 'COMMITTED' | 'AUDIT_FAILED' | 'SKIPPED';
     auditError?: string;
     timestamp: string;
     durationMs: number;
   }
   ```

---

## 3. BẰNG CHỨNG KIỂM THỬ HỒI QUY (REGRESSION TEST EVIDENCE)

Đã xây dựng bộ kiểm thử chuyên biệt tại `src/domain/workflow/UnifiedWorkflowExecutor.test.ts` bao quát 9 kịch bản thất bại và thành công:

- Test #1: `UNKNOWN_WORKFLOW_ACTION` -> PASS (Từ chối hành động ngoài Catalog)
- Test #2: `ENTITY_TYPE_MISMATCH` -> PASS (Từ chối thực thể không tương thích)
- Test #3: `UNAUTHORIZED_ROLE` -> PASS (Từ chối vai trò không đủ thẩm quyền)
- Test #4: `REASON_REQUIRED` -> PASS (Bắt buộc lý do giải trình)
- Test #5: `INVALID_STATE_TRANSITION` -> PASS (Chặn bước chuyển FSM không hợp lệ)
- Test #6: `DOMAIN_RULE_VIOLATION` -> PASS (Chặn khi vi phạm Cổng kiểm soát Release)
- Test #7: `MUTATION_FAILED` -> PASS (Báo cáo lỗi khi mutation thất bại)
- Test #8: **`AUDIT_LOG_FAILED` (ALCOA+ FAIL-CLOSED)** -> PASS (Xác nhận trả về `success: false`, `auditStatus: 'AUDIT_FAILED'`, không che giấu lỗi)
- Test #9: `SUCCESS_PATH` -> PASS (Thực thi thành công và ghi nhận `auditStatus: 'COMMITTED'`)

Toàn bộ 9/9 tests đều đạt kết quả **PASS**.

---

## 4. KẾT LUẬN

- **Tính toàn vẹn của Executor:** ✅ **FAIL-CLOSED ALCOA+ ENFORCED**
- Không còn bất kỳ kịch bản nào cho phép mutation được xem là "hoàn tất thành công" nếu thiếu hồ sơ kiểm toán đi kèm.
