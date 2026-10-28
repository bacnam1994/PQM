# ADR-REBUILD-WORKFLOW-CONTRACT-FREEZE: ĐÓNG BĂNG HỢP ĐỒNG WORKFLOW CHO QUÁ TRÌNH REBUILD

> **Trạng thái**: **APPROVED & FROZEN**  
> **Ngày ban hành**: 2026-09-25  
> **Căn cứ**: PQM — REBUILD READINESS GATE (Phase R1)  
> **Phạm vi tác động**: Toàn bộ hệ thống mã nguồn `bacnam1994/PQM`

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT)

Hệ thống PQM đã vượt qua 12 Gates của **Rebuild Readiness Audit** (`REBUILD_READY = TRUE`).
Để bắt đầu quá trình tái cấu trúc cây thư mục (Source Tree Rebuild) theo Domain-Driven Design / Clean Architecture:

- Toàn bộ ngữ nghĩa nghiệp vụ (Business Semantics), quy tắc an toàn, thẩm quyền RBAC, FSM transitions, và ALCOA+ Audit Trail **PHẢI ĐƯỢC ĐÓNG BĂNG TUYỆT ĐỐI**.
- Quá trình Rebuild **CHỈ ĐƯỢC PHÉP THAY ĐỔI**: vị trí thư mục (`location`), gom nhóm cấu trúc (`composition`), hướng phụ thuộc (`dependency direction`), chuẩn hóa đường dẫn import (`module boundary`).
- **TUYỆT ĐỐI CẤM**: Âm thầm thay đổi business logic, sửa đổi trạng thái FSM, hạ thấp tiêu chuẩn 7 Release Gates, nới lỏng RBAC, hoặc làm mất mát ALCOA+ Audit Trail.

---

## 2. NỘI DUNG ĐÓNG BĂNG BẤT BIẾN (FROZEN SPECIFICATIONS)

### 2.1. Danh mục 92 Canonical Action IDs & Entity Types

Toàn bộ danh bạ `CANONICAL_ACTION_REGISTRY` tại [`src/workflow/definitions/index.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/workflow/definitions/index.ts) được đóng băng.
15 Canonical Entities:
`PRODUCT`, `MATERIAL`, `TCCS`, `FORMULA`, `BATCH`, `TEST_RESULT`, `QUALITY_SNAPSHOT`, `OOS`, `DEVIATION`, `CAPA`, `CHANGE_REQUEST`, `APPROVAL_TASK`, `COA`, `MASTER_DATA`, `SYSTEM`.

### 2.2. Chuẩn 8 Vai trò Thẩm quyền (Canonical Roles)

Chỉ chấp nhận 8 vai trò chuẩn mực:
`ADMIN`, `QA`, `QC`, `LAB`, `PRODUCTION`, `USER`, `VIEWER`, `GUEST`.
Tuyệt đối không sinh thêm các vai trò ma hoặc bypass.

### 2.3. Rào chắn An toàn & Kiểm soát Thực thi (Guards)

1. **RBAC Guard**: Kiểm tra nghiêm ngặt `allowedRoles` theo Action ID.
2. **OCC Guard**: Optimistic Concurrency Control bắt buộc cho mọi regulated update.
3. **Reason Guard**: Bắt buộc giải trình lý do cho mọi thao tác nhạy cảm và phá hủy dữ liệu.
4. **Signature Guard (21 CFR Part 11)**: Bắt buộc chữ ký số điện tử hợp lệ cho các quyết định QA Approval và CoA Issue.
5. **Confirmation Token Guard**: Bắt buộc token xác thực cấp cao cho các thao tác Backup/Restore/Wipe.
6. **7 Release Gates**: Bắt buộc 100% điều kiện tiên quyết trước khi ký xuất xưởng Lô (Zero Admin Bypass).

### 2.4. Audit SSoT & Data Integrity (ALCOA+)

100% regulated mutations phải đi qua `UnifiedWorkflowExecutor` và ghi nhật ký qua `AwaitedOutboxAuditQueue` với cơ chế **Fail-Closed** (thất bại ghi audit -> rollback toàn bộ mutation).

---

## 3. HƯỚNG DẪN THỰC THI REBUILD THEO VERTICAL SLICE

Thứ tự tái cấu trúc thư mục từ Phase R2:

1. `PRODUCT`
2. `MATERIAL`
3. `TCCS`
4. `FORMULA`
5. `BATCH`
6. `TEST_RESULT`
7. `DEVIATION`
8. `OOS`
9. `CAPA`
10. `CHANGE_REQUEST`
11. `COA`
12. `APPROVAL`
13. `MASTER_DATA`
14. `SYSTEM`
15. `AI`
16. `AUTH`

Mỗi domain phải tuân thủ nghiêm ngặt chu trình:
`INSPECT -> MOVE -> UPDATE IMPORTS -> TEST -> TYPECHECK -> BUILD -> ARCHITECTURE GUARD -> COMMIT`.
