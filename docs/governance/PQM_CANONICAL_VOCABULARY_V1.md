# 📖 TỪ ĐIỂN THUẬT NGỮ CHUẨN TẮC PQM (CANONICAL VOCABULARY V1)

> **Mã văn bản:** `PQM_CANONICAL_VOCABULARY_V1.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Ràng buộc:** Bắt buộc sử dụng chính xác các thuật ngữ dưới đây; cấm dùng lẫn lộn hoặc thay thế tùy tiện.

---

## 1. BẢNG ĐỊNH NGHĨA THUẬT NGỮ CHUẨN TẮC

| Thuật ngữ (Canonical Term) | Định nghĩa chuẩn mực trong hệ thống PQM                                                               | Ví dụ thực tế                                                  | Điều cấm / Nhầm lẫn phổ biến                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| **ENTITY**                 | Đối tượng nghiệp vụ có vòng đời, định danh duy nhất (`id`) và thuộc 15 loại thực thể chuẩn.           | `Batch`, `Product`, `TCCS`, `TestResult`                       | Không gọi DTO hay Value Object là Entity.                          |
| **ACTION**                 | Ý định nghiệp vụ có chủ đích (Business Intent) đã đăng ký trong `CANONICAL_ACTION_REGISTRY`.          | `BATCH_RELEASE_APPROVE`, `PRODUCT_CREATE`                      | Không dùng tên chung chung như `UPDATE`, `SAVE`, `EDIT`.           |
| **COMMAND**                | Bản tin yêu cầu thực thi một Action làm thay đổi dữ liệu hoặc trạng thái (Mutation Request).          | `{ actionId: 'BATCH_RELEASE_APPROVE', payload: {...} }`        | Khác với Query (Query là chỉ đọc).                                 |
| **QUERY**                  | Yêu cầu truy vấn dữ liệu thuần túy (Read-Only), không gây ra bất kỳ tác dụng phụ hay thay đổi nào.    | `batchQueries.findAll()`, `productQueries.getById()`           | Cấm chèn lệnh ghi database vào trong Query.                        |
| **MUTATION**               | Thao tác ghi, cập nhật hoặc xóa dữ liệu trên hệ thống lưu trữ bền vững.                               | `batchRepo.save(batch)`, `productRepo.delete(id)`              | Mọi mutation bắt buộc phải có Command & Action ID kiểm soát.       |
| **WORKFLOW**               | Lộ trình điều phối tuần tự hoặc song song để hoàn tất một nghiệp vụ qua Workflow Kernel.              | `Batch Release Workflow`, `CoA Issuance Workflow`              | Không tạo nhiều workflow trùng lặp cho cùng một nghiệp vụ.         |
| **WORKFLOW STEP**          | Một bước cụ thể trong quy trình 12 bước của Kernel hoặc trong đường ống thẩm duyệt đa cấp.            | `Step 4: RBAC Authorization`, `Step 7: OCC Lock`               | Không nhảy cóc các bước bắt buộc.                                  |
| **GUARD**                  | Rào chắn kiểm tra điều kiện an ninh, thẩm quyền, tính toàn vẹn trước khi cho phép thực thi.           | `rbacGuard`, `signatureGuard`, `occGuard`, `reasonGuard`       | Không được tắt hoặc bypass guard ở môi trường production.          |
| **RULE**                   | Quy tắc nghiệp vụ chuyên ngành Dược hoặc tính toán chất lượng thuần túy (Domain Logic).               | `7 Release Gates`, `ICH Q10 CAPA Closed-Loop Rule`             | Không nhúng rule nghiệp vụ vào giao diện UI hay React Hooks.       |
| **STATE**                  | Trạng thái hiện tại của một thực thể trong máy trạng thái FSM.                                        | `PENDING`, `TESTING`, `RELEASED`, `APPROVED`                   | Không tạo các biến trạng thái tự chế như `localStatus`.            |
| **STATE TRANSITION**       | Bước chuyển hợp lệ từ trạng thái nguồn (`From`) sang trạng thái đích (`To`) do FSM quyết định.        | `TESTING ➔ RELEASED` qua action `BATCH_RELEASE_APPROVE`        | Cấm nhảy cóc trạng thái bất hợp pháp (ví dụ `PENDING ➔ RELEASED`). |
| **APPLICATION SERVICE**    | Lớp điều phối luồng nghiệp vụ, tương tác với Workflow Kernel và Repository Interfaces.                | `BatchAppService`, `ProductAppService`, `CoAService`           | Không nhúng logic cơ sở dữ liệu hạ tầng vào App Service.           |
| **DOMAIN SERVICE**         | Lớp chứa các thuật toán hoặc quy tắc nghiệp vụ bao trùm nhiều thực thể khác nhau.                     | `QualityEvaluationEngine`, `CanonicalStatusResolver`           | Không chứa logic I/O hay phụ thuộc mạng.                           |
| **REPOSITORY**             | Ranh giới trừu tượng hóa việc lưu trữ và truy xuất các Aggregate Root vào Database.                   | `IBatchRepository`, `IProductRepository`                       | UI không được gọi trực tiếp repository; chỉ gọi qua Service/Query. |
| **EVENT**                  | Sự kiện miền phát sinh sau khi một giao dịch nghiệp vụ được lưu trữ thành công.                       | `WorkflowEvent`, `BatchReleasedEvent`                          | Không emit event trước khi giao dịch DB thành công.                |
| **AUDIT EVENT**            | Bản ghi nhật ký kiểm toán ALCOA+ bất biến ghi nhận chi tiết Who, What, When, Reason.                  | `AuditEventPayload` trong Outbox Queue                         | Bắt buộc fail-closed: lỗi ghi audit ➔ hủy giao dịch.               |
| **PROPOSAL**               | Đề xuất khuyến nghị do AI hoặc hệ thống tự động sinh ra, chưa tạo ra mutation thực tế.                | `AIActionProposal` (chờ con người kiểm tra & bấm duyệt)        | Cấm coi Proposal là đã được phê duyệt.                             |
| **APPROVAL**               | Hành vi quyết định pháp lý của người có thẩm quyền (QA/Admin) chấp thuận đưa dữ liệu/lô vào hiệu lực. | `QA Approve Phiếu kiểm nghiệm`, `QA Ký CoA`                    | Không coi cờ boolean `approved = true` là toàn bộ cơ chế approval. |
| **SIGNATURE**              | Chữ ký điện tử số hóa xác thực người dùng theo chuẩn FDA 21 CFR Part 11.                              | `ElectronicSignature` gồm Name, Email, Role, Timestamp, Intent | Cấm dùng checkbox "Tôi đồng ý" thay cho chữ ký số hóa.             |
