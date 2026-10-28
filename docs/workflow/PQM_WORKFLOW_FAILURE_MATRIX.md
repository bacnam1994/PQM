# PQM — WORKFLOW FAILURE MATRIX

> **Phiên bản:** 1.0.0-FAILURE-MATRIX  
> **Cập nhật lần cuối:** 2026-09-19  
> **Tài liệu tham chiếu:** [`PQM_SYSTEM_WORKFLOW_MASTER.md`](./PQM_SYSTEM_WORKFLOW_MASTER.md), [`PQM_WORKFLOW_OBSERVABILITY.md`](./PQM_WORKFLOW_OBSERVABILITY.md)

---

## 1. NGUYÊN TẮC XỬ LÝ THẤT BẠI QUY TRÌNH (6-STEP FAILURE LIFECYCLE)

Mọi sự cố hoặc vi phạm quy trình trong PQM bắt buộc phải tuân theo chu trình chuẩn 6 bước:

```
DETECT (Phát hiện)
   ↓
BLOCK (Chặn tức thì - Fail Closed)
   ↓
ROLLBACK (Hoàn nguyên giao dịch nguyên tử nếu cần)
   ↓
AUDIT (Ghi nhận nhật ký kiểm toán ALCOA+)
   ↓
EXPLAIN (Giải trình lý do có cấu trúc qua WorkflowExplainabilityService)
   ↓
RECOVER (Hướng dẫn khắc phục an toàn)
```

---

## 2. MA TRẬN PHÂN LOẠI & XỬ LÝ THẤT BẠI QUY TRÌNH (FAILURE MATRIX)

| Workflow                                   | Failure                                                                                     | Detection                                                                                   | Response                                                                                         | Rollback                                                 | Audit                                             | User Message                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Product / TCCS / Formula / Batch**       | **Validation Failure** (Dữ liệu rỗng, số âm, HSD < NSX)                                     | Zod Schema Validation & App Service sanitization                                            | Ném lỗi nghiệp vụ, dừng luồng trước khi chạm Database                                            | Không phát sinh ghi DB (No-op)                           | Log cảnh báo client                               | _"Thông tin nhập liệu không hợp lệ: [Chi tiết trường lỗi]. Vui lòng kiểm tra lại."_                                                              |
| **Bất kỳ Regulated Workflow**              | **Authorization Failure** (Người dùng không đủ thẩm quyền RBAC)                             | `can(user, action, resource)` & `SecurityRulesValidator`                                    | Ném lỗi `PERMISSION_DENIED`, chặn đứng hành động                                                 | Không phát sinh ghi DB                                   | Ghi nhận sự kiện `DENIED_ACTION` nếu cần          | _"Từ chối quyền: Vai trò [Role] không đủ thẩm quyền thực hiện thao tác này (Yêu cầu [Required Role])."_                                          |
| **Batch / Test Result Lifecycle**          | **State Transition Failure** (Nhảy cóc trạng thái, đổi trạng thái bất hợp pháp)             | `BatchStateMachine.canTransition`, `TestResultWorkflowStateMachine.canTransition`           | Chặn chuyển trạng thái, giữ nguyên trạng thái cũ                                                 | Giữ nguyên trạng thái thực thể                           | Ghi log State Machine Violation                   | _"Quy chuẩn State Machine: Không thể chuyển từ [FromState] sang [ToState] do vi phạm luồng chuyển đổi."_                                         |
| **Batch Release / Test Result Approval**   | **Business Rule Failure** (Phiếu có chỉ tiêu FAIL, hồ sơ OOS mở, TCCS chưa kích hoạt)       | `ReleaseRules.evaluateReleasePrerequisites`, `BatchRules`, `QualityWorkflowMatrixGuard`     | Khóa chức năng Release / Approve; trả về danh sách blockers                                      | Không ghi nhận quyết định xuất xưởng                     | Ghi audit `RELEASE_BLOCKED`                       | _"Không thể xuất xưởng: Còn chỉ tiêu kiểm nghiệm không đạt hoặc hồ sơ sai lệch nghiêm trọng chưa xử lý."_                                        |
| **Tất cả các lệnh ghi dữ liệu**            | **Database Failure** (Mất kết nối mạng, timeout, Firebase write error)                      | Bắt ngoại lệ `catch(err)` tại Repository & Network Interceptor                              | Kích hoạt retry lũy tiến hoặc báo lỗi hệ thống                                                   | Kích hoạt cơ chế Rollback trạng thái cục bộ              | Ghi log lỗi hạ tầng (Infrastructure Error)        | _"Lỗi kết nối cơ sở dữ liệu: Không thể đồng bộ dữ liệu với máy chủ. Vui lòng kiểm tra mạng và thử lại."_                                         |
| **Update Batch / TestResult / MasterData** | **Concurrency Conflict** (Xung đột ghi đè đồng thời - OCC)                                  | `validateOptimisticLock` & `ConcurrencyManager.verifyVersion` (Version client < Version DB) | Ném lỗi `ConcurrentModificationError`, hủy thao tác ghi đè                                       | Không ghi đè phiên bản mới trên máy chủ                  | Ghi log OCC Conflict                              | _"Dữ liệu đã được cập nhật bởi một phiên làm việc khác (Phiên bản máy chủ: v[N+1], phiên bản của bạn: v[N]). Vui lòng tải lại trang."_           |
| **Đánh giá & Xuất xưởng**                  | **Snapshot Integrity Failure** (Mã băm snapshot SHA-256 bị sai lệch do dữ liệu bị sửa đổi)  | `validateEvaluationSnapshot` & `verifyEvaluationSnapshotIntegrity`                          | Vô hiệu hóa snapshot (`isValid: false`), ép buộc đánh giá lại (Re-evaluate)                      | Không cho phép ký duyệt trên snapshot lỗi thời           | Ghi cảnh báo `SNAPSHOT_TAMPER_DETECTED`           | _"Cảnh báo toàn vẹn dữ liệu: Mã băm niêm phong của phiếu kiểm nghiệm không khớp với dữ liệu gốc. Yêu cầu tái thẩm định."_                        |
| **Kiểm toán ALCOA+**                       | **Audit Integrity Failure** (Nhật ký kiểm toán bị sửa nội dung hoặc xóa bản ghi trung gian) | `AlcoaAuditManager.verifyChainIntegrity` phát hiện `HASH_MISMATCH` hoặc `BROKEN_LINK`       | Đánh dấu chuỗi kiểm toán bị xâm phạm, vô hiệu hóa chứng thực                                     | Khóa các thao tác xuất báo cáo CoA cho đến khi thanh tra | Ghi cảnh báo khẩn cấp hệ thống `AUDIT_CORRUPTION` | _"Lỗi toàn vẹn kiểm toán (ALCOA+): Phát hiện sai lệch chuỗi băm mật mã trong nhật ký kiểm toán. Vui lòng liên hệ Quản trị viên."_                |
| **Batch 360 / Phả hệ**                     | **Genealogy Inconsistency** (Khóa ngoại mồ côi, Lô trỏ sang TCCS của sản phẩm khác)         | `DataLineageManager.verifyLineageCompleteness`, `EntityIdentityManager`                     | Gắn cờ cảnh báo `WARNING` trên nút phả hệ; chặn xuất xưởng Lô nếu thiếu nút cốt lõi              | Dừng luồng liên kết phả hệ                               | Ghi nhận hồ sơ đối chiếu `ConsistencyIssue`       | _"Phát hiện bất thường phả hệ Lô: Lô sản xuất bị mất liên kết với Tiêu chuẩn cơ sở hoặc Công thức hợp lệ."_                                      |
| **Data Consistency Center**                | **Reconciliation Mismatch** (Sai lệch giữa trạng thái lưu trữ và trạng thái tính toán)      | `ConsistencyAuditor.auditStatusConsistency`, `CanonicalStatusResolver`                      | Phân loại mức độ (`CRITICAL`, `WARNING`, `INFO`), kích hoạt quy trình xem xét CAPA               | Giữ nguyên trạng thái an toàn nhất (Fail-Closed)         | Ghi nhận `StandardConsistencyIssue`               | _"Phát hiện sai lệch trạng thái kỹ thuật: Kết quả chỉ tiêu kiểm nghiệm không khớp với trạng thái tổng thể hiển thị."_                            |
| **AI Assistant / Copilot**                 | **AI Proposal Failure** (AI đề xuất xuất xưởng sai quy tắc, AI đề xuất vượt thẩm quyền)     | `aiActionGuard.validateAIAction` & `isStrictRegulatedAction`                                | Chuyển hành động thành bản nháp `Proposal` yêu cầu con người phê duyệt; từ chối nếu role vi phạm | Hủy proposal nếu thẩm định không đạt                     | Ghi nhật ký đề xuất AI `AI_PROPOSAL_BLOCKED`      | _"Hành động của AI đã bị rào chắn bảo vệ chặn lại: Đề xuất xuất xưởng bắt buộc phải do nhân sự QA có thẩm quyền thực hiện bằng chữ ký điện tử."_ |

---

## 3. CƠ CHẾ KHÔI PHỤC AN TOÀN (SAFE RECOVERY WORKFLOWS)

1. **Đối với Validation / Input Error**: Người dùng chỉnh sửa lại form nhập liệu theo đúng giới hạn dải số hoặc định dạng Dược điển quy định.
2. **Đối với Concurrency Conflict (OCC)**: UI hiển thị thông báo yêu cầu người dùng nhấn nút **Tải lại dữ liệu (Refresh)** để nạp phiên bản mới nhất từ máy chủ, sau đó thực hiện lại thao tác.
3. **Đối với Snapshot / Data Inconsistency**: Người dùng QA kích hoạt chức năng **Tái thẩm định chất lượng (Re-evaluate Quality)** để hệ thống chạy lại bộ máy `QualityEvaluationEngine` và sinh lại mã băm SHA-256 niêm phong đồng bộ.
4. **Đối với Multi-Mutation Failure**: Khung giao dịch nguyên tử `AutoHealingFramework.executeAtomicHealingPlan` tự động kích hoạt `rollbackHandler` để đưa toàn bộ các thực thể bị ảnh hưởng về giá trị ban đầu (`oldValue`), triệt tiêu hoàn toàn lỗi dở dang (Partial Failure).
