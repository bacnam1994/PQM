# 🖥️ QUY TẮC PHÁT TRIỂN GIAO DIỆN & HOOKS (PQM UI RULES)

> **Mã văn bản:** `PQM_UI_RULES.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Tiêu chuẩn:** Presentation Layer Decoupling

---

## 1. PHÂN ĐỊNH TRÁCH NHIỆM CỦA TẦNG UI

Tầng Giao diện người dùng (`src/pages/`, `src/components/`, `src/hooks/`) được thiết kế thanh thoát và tách biệt:

### Những việc UI ĐƯỢC PHÉP làm:

- Hiển thị dữ liệu, biểu đồ, bảng danh sách và biểu mẫu nhập liệu.
- Quản lý trạng thái giao diện cục bộ (modal đóng/mở, tab đang chọn, sorting, phân trang).
- Gọi các Query Hooks (`useProductQueries`, `useBatchQueries`, ...) để nạp dữ liệu.
- Kích hoạt các hành động nghiệp vụ thông qua `useWorkflowActions` hoặc `WorkflowFacade.dispatch()`.
- Trình bày thông báo lỗi thân thiện với người dùng dựa trên kết quả trả về từ Workflow Kernel.

### Những việc CẤM TUYỆT ĐỐI trên tầng UI:

- ❌ **CẤM chứa Business Logic**: Không tự tính toán đạt/không đạt hay giải phóng lô trên UI.
- ❌ **CẤM tự chuyển State**: Không tự gán `item.status = 'APPROVED'`.
- ❌ **CẤM gọi Firebase Database**: Không import `ref()`, `set()`, `update()`, `get()` từ `firebase/database`.
- ❌ **CẤM gọi Repository Mutation**: Không import các repositories để gọi `save()` hay `delete()`.
- ❌ **CẤM tự phát sinh Audit Log**: Không gọi `logAuditAction()` trực tiếp từ components/hooks; audit trail do Application Service và Workflow Engine phát sinh tự động.

---

## 2. QUY CHUẨN DÀNH CHO REACT HOOKS

1. **Query Hooks**: Nằm tại `src/hooks/queries/` hoặc `src/domains/*/application/queries.ts`. Nhiệm vụ duy nhất là đọc dữ liệu qua React Query và cache dữ liệu cho UI.
2. **Action Hooks**: Hook `useWorkflowActions` (`src/hooks/useWorkflowActions.ts`) là cầu nối chuẩn duy nhất giữa giao diện và Workflow Kernel, cung cấp `allowedActions`, `canExecute`, `isExecuting`, và hàm điều phối `dispatch()`.
3. **Không rò rỉ Mutation ngầm**: Hook tuyệt đối không được che giấu các mutation ngầm vào database dưới danh nghĩa "side-effect". Mọi mutation đều phải minh bạch qua Workflow Action.
