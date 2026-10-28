# PQM — WORKFLOW RUNTIME OBSERVABILITY

> **Phiên bản:** 1.0.0-OBSERVABILITY  
> **Cập nhật lần cuối:** 2026-09-19  
> **Tài liệu tham chiếu:** [`PQM_SYSTEM_WORKFLOW_MASTER.md`](./PQM_SYSTEM_WORKFLOW_MASTER.md), [`PQM_WORKFLOW_ENFORCEMENT_MATRIX.md`](./PQM_WORKFLOW_ENFORCEMENT_MATRIX.md)

---

## 1. MỤC TIÊU & NGUYÊN TẮC QUAN SÁT (OBSERVABILITY PRINCIPLES)

Trong môi trường sản xuất y tế / dược phẩm tuân thủ **GMP** và **US FDA 21 CFR Part 11**, hệ thống PQM bắt buộc phải có khả năng:

1. **Xác định chính xác một quy trình đang chạy ở đâu, do ai kích hoạt, chuyển đổi từ trạng thái nào sang trạng thái nào.**
2. **Nếu thất bại: Xác định ngay lập tức thất bại tại ranh giới nào (Validation, Authorization, State Machine, Business Rule, Database, Integrity).**
3. **Bảo mật dữ liệu (Data Privacy)**: Tuyệt đối không ghi log mật khẩu, mã PIN chữ ký, hoặc dữ liệu nhạy cảm không cần thiết.

---

## 2. CHUẨN CẤU TRÚC LOG THỰC THI QUY TRÌNH (WORKFLOW EXECUTION LOG SCHEMA)

Mọi bước chuyển đổi hoặc thực thi trong các quy trình có kiểm soát (Regulated Workflows) đều được gắn nhãn cấu trúc chuẩn:

```typescript
export interface WorkflowExecutionLog {
  /** Định danh duy nhất cho một lần thực thi quy trình */
  workflowExecutionId: string; // vd: "wf-exec-20260919-8f4b2"

  /** Mã liên kết theo vết xuyên suốt toàn bộ chuỗi thao tác (Distributed Tracing) */
  correlationId: string; // vd: "corr-rel-batch-2026-001"

  /** Định danh thực thể đích */
  entityId: string; // vd: "BATCH-2026-001" hoặc "TR-2026-001"

  /** Loại thực thể nghiệp vụ */
  entityType: 'PRODUCT' | 'TCCS' | 'FORMULA' | 'BATCH' | 'TEST_RESULT' | 'COA' | 'DEVIATION';

  /** Mã định danh quy trình nghiệp vụ */
  workflow:
    | 'PRODUCT_CREATION'
    | 'TCCS_CREATION'
    | 'TCCS_PUBLISH'
    | 'FORMULA_CREATION'
    | 'BATCH_CREATION'
    | 'BATCH_START_TESTING'
    | 'TEST_RESULT_CREATION'
    | 'QUALITY_EVALUATION'
    | 'SNAPSHOT_FREEZE'
    | 'TEST_RESULT_FINALIZE'
    | 'TEST_RESULT_APPROVAL'
    | 'BATCH_RELEASE'
    | 'COA_GENERATION'
    | 'AUTO_HEAL_EXECUTION';

  /** Trạng thái trước khi chuyển đổi */
  fromState?: string; // vd: "TESTING"

  /** Trạng thái đích mong muốn */
  toState?: string; // vd: "RELEASED"

  /** Thông tin danh tính người thực hiện (Attributability) */
  actor: {
    uid: string; // vd: "u-qa-01"
    email: string; // vd: "qa.lead@vbiotech.com"
    role: string; // vd: "QA"
  };

  /** Thời điểm thực thi (ISO 8601 UTC) */
  timestamp: string; // vd: "2026-09-19T09:15:30.123Z"

  /** Kết quả thực thi */
  result: 'SUCCESS' | 'BLOCKED' | 'FAILED' | 'ROLLED_BACK';

  /** Mã lỗi chuẩn hóa (nếu thất bại) */
  failureCode?: string; // vd: "QUALITY_MATRIX_BLOCKED", "STALE_VERSION_CONFLICT"

  /** Thời gian xử lý tính bằng mili-giây */
  durationMs: number; // vd: 42

  /** Mã nguyên tắc hoặc quy tắc nghiệp vụ áp dụng */
  ruleId?: string; // vd: "PRINCIPLE-007", "RULE-RELEASE-001"

  /** Quyết định phân quyền truy cập */
  authorizationDecision: {
    allowed: boolean;
    requiredRole?: string[];
    decisionReason?: string;
  };

  /** Chi tiết ngữ cảnh bổ sung an toàn (đã loại bỏ dữ liệu nhạy cảm) */
  metadata?: Record<string, any>;
}
```

---

## 3. ĐIỂM THU THẬP LOG QUY TRÌNH (OBSERVABILITY EMISSION POINTS)

| Layer               | Điểm phát xạ (Emission Point)                         | Trạng thái phát xạ           | Dữ liệu kiểm toán                               |
| ------------------- | ----------------------------------------------------- | ---------------------------- | ----------------------------------------------- |
| **UI Entry**        | Component / Mutation Hooks                            | Bắt đầu thao tác             | `correlationId`, `entityId`, `actor`            |
| **App Service**     | `BatchAppService`, `TestResultAppService`, v.v.       | Kiểm tra Authorization & OCC | `authorizationDecision`, `fromState`, `toState` |
| **Domain Engine**   | `QualityEvaluationEngine`, `ReleaseRules`             | Thẩm tra điều kiện nghiệp vụ | `ruleId`, `result`, `failureCode`               |
| **State Machine**   | `BatchStateMachine`, `TestResultWorkflowStateMachine` | Chuyển đổi trạng thái FSM    | `fromState -> toState`, `requiresAuditRecord`   |
| **Repository / DB** | `BaseFirebaseRepository`, Atomic Transactions         | Lưu trữ và Niêm phong        | `durationMs`, `result: SUCCESS/ROLLED_BACK`     |
| **Audit Service**   | `AlcoaAuditManager`, `logAuditAction`                 | Ghi chuỗi băm ALCOA+ SHA-256 | `entryHash`, `previousHash`, `sequenceNumber`   |

---

## 4. QUY TẮC BẢO MẬT & BẢO VỆ DỮ LIỆU NHẠY CẢM (REDACTION RULES)

1. **Tuyệt đối không log**:
   - Mật khẩu đăng nhập, access tokens, refresh tokens.
   - Mã PIN bí mật chữ ký số điện tử.
   - Thông tin cá nhân nhạy cảm của bệnh nhân / khách hàng (nếu có).
2. **Cho phép log**:
   - `uid`, `email` công vụ, `role` (đáp ứng tính truy vết Attributable của FDA 21 CFR Part 11).
   - Tên và mã sản phẩm, số lô, mã TCCS, mã phiếu kiểm nghiệm.
   - Kết quả chỉ tiêu kiểm nghiệm, trạng thái Đạt/Không đạt.
   - Lý do thay đổi (Change reason) và mã băm toàn vẹn SHA-256.

---

## 5. CƠ CHẾ CẢNH BÁO QUY TRÌNH THẤT BẠI (FAILURE ALERTING)

Khi một quy trình gặp trạng thái `BLOCKED` hoặc `FAILED`:

1. **Critical Alert**: Phát tín hiệu cảnh báo ngay khi phát hiện:
   - Cố tình thâm nhập xuất xưởng lô có chỉ tiêu `FAIL`.
   - Giả mạo chữ ký điện tử hoặc sai lệch mã băm niêm phong `evaluationHash`.
   - Phá vỡ chuỗi kiểm toán `HASH_MISMATCH` hoặc `BROKEN_LINK`.
2. **Explainability Structured Response**: Gửi phản hồi cấu trúc chi tiết thông qua `WorkflowExplainabilityService` để UI render bảng lý do rõ ràng cho nhân viên QA.
