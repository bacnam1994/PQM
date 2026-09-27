# 💾 QUY TẮC THAY ĐỔI DỮ LIỆU & LƯU TRỮ (PQM DATA MUTATION RULES)

> **Mã văn bản:** `PQM_DATA_MUTATION_RULES.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Tiêu chuẩn:** Repository Pattern & Data Concurrency Control

---

## 1. NGUYÊN TẮC BẤT BIẾN VỀ GHI DỮ LIỆU (MUTATION BOUNDARY)

Mọi thao tác ghi, cập nhật, hoặc xóa dữ liệu trên hệ thống bắt buộc phải tuân thủ:

1. **Điểm ghi duy nhất**: Thao tác ghi chỉ được phép phát xuất từ các phương thức lưu trữ của **13 Repository Interfaces** (`src/repositories/interfaces/`).
2. **CẤM Direct Firebase Write**: Tuyệt đối không được import hay gọi trực tiếp `firebase/database` `set`, `update`, `push`, `remove` từ UI components, React hooks hay Application Services.
3. **CẤM Direct Repository Call từ UI**: UI pages và components không được import instance của repositories để gọi `save()` hay `delete()`. Mọi mutation bắt buộc phải qua `useWorkflowActions` hoặc `WorkflowFacade.dispatch()`.

---

## 2. KIỂM SOÁT ĐỒNG THỜI LẠC QUAN (OPTIMISTIC CONCURRENCY CONTROL - OCC)

- Mọi thực thể nghiệp vụ cốt lõi (`Batch`, `Product`, `TCCS`, `Formula`, `TestResult`) đều có thuộc tính quản lý phiên bản `version: number`.
- Trước khi cập nhật dữ liệu, hàm `validateOptimisticLock(currentEntity, incomingVersion)` (`src/utils/concurrency.ts`) sẽ được kích hoạt để kiểm tra phiên bản.
- Nếu phát hiện xung đột dữ liệu (phiên bản trên server cao hơn phiên bản gửi lên do có người khác vừa cập nhật), hệ thống bắt buộc từ chối và thông báo lỗi xung đột đồng thời, yêu cầu người dùng nạp lại dữ liệu trước khi sửa tiếp.

---

## 3. TÍNH BẢO TOÀN LẶP LẠI (IDEMPOTENCY) & RETRY BEHAVIOR

- Các thao tác mutation phải tính đến các kịch bản mạng chập chờn, người dùng bấm đúp chuột (double-click), hoặc AI retry.
- Thao tác cập nhật trạng thái Lô hay duyệt Phiếu kiểm nghiệm được thiết kế theo nguyên tắc lũy đẳng (Idempotent): việc gọi lại cùng một lệnh với cùng dữ liệu trạng thái hiện hữu sẽ trả về kết quả an toàn mà không làm nhân bản audit log hay phá vỡ FSM.
