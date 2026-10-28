# 📚 DANH MỤC KHẾ ƯỚC & WORKFLOW HỆ THỐNG PQM (MODEL 00)

Thư mục này chứa toàn bộ các văn kiện kiến trúc và khế ước nghiệp vụ chuẩn cấp cao nhất của hệ thống **PQM (Phần mềm Quản lý Kiểm nghiệm & Chất lượng Dược phẩm / Biotech)**.

Từ phiên bản `8.1.0`, mọi quy trình nghiệp vụ, rào chắn an ninh, luồng dữ liệu và chuyển đổi trạng thái của PQM đều phải tuân thủ nghiêm ngặt các tài liệu trong thư mục này.

---

## 📑 Danh Sách Các Tài Liệu Workflow Chuẩn Hóa

| Tên File                                                                                                           |         Loại          | Vai Trò & Nội Dung Chính                                                                                                                                                                       |
| :----------------------------------------------------------------------------------------------------------------- | :-------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`PQM_SYSTEM_WORKFLOW_MASTER.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md)   |   **Văn kiện gốc**    | **Hiến pháp nghiệp vụ & kiến trúc tối cao**: 15 nguyên tắc hoạt động cốt lõi, 15 thực thể dữ liệu, luồng đánh giá chất lượng 3 cấp, FSM, Release Gate, rào chắn AI Cố Vấn, ALCOA+ Audit Trail. |
| [`PQM_WORKFLOW_CONTRACT.json`](file:///d:/26%20Kiem%20nghiem/PQM/docs/workflow/PQM_WORKFLOW_CONTRACT.json)         |   **JSON Contract**   | Bản hợp đồng máy đọc (Machine-readable) định nghĩa tiêu chuẩn pháp lý (21 CFR Part 11, EU Annex 11, PIC/S), các quy tắc bất biến, trạng thái và điều kiện tiên quyết.                          |
| [`PQM_SOURCE_OF_TRUTH_MATRIX.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/workflow/PQM_SOURCE_OF_TRUTH_MATRIX.md)   |   **Ma trận SSoT**    | Phân định rành mạch giữa Canonical Source (Nguồn chuẩn duy nhất), Derived Data (Chỉ đọc) và Legacy Data nhằm ngăn ngừa drift dữ liệu.                                                          |
| [`PQM_STATE_TRANSITION_MATRIX.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/workflow/PQM_STATE_TRANSITION_MATRIX.md) |    **Ma trận FSM**    | Định nghĩa chi tiết bảng chuyển đổi trạng thái hai chiều giữa Quality State (`PASS/FAIL/PENDING/UNKNOWN`) và Workflow State của Lô (`Batch`) và Phiếu kiểm nghiệm (`TestResult`).              |
| [`PQM_TRACEABILITY_MATRIX.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/workflow/PQM_TRACEABILITY_MATRIX.md)         | **Ma trận truy xuất** | Ánh xạ trực tiếp 15 nguyên tắc cốt lõi (`PRINCIPLE-001` đến `PRINCIPLE-015`) tới mã nguồn Domain, Services, Quy tắc cơ sở dữ liệu và các file Unit/E2E Tests.                                  |
| [`PQM_WORKFLOW_CONFLICTS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/workflow/PQM_WORKFLOW_CONFLICTS.md)           |   **Sổ mâu thuẫn**    | Sổ theo dõi và giải quyết các điểm sai lệch lịch sử giữa code cũ và Master Workflow (`CONFLICT-001` đến `CONFLICT-005`).                                                                       |

---

## 🔒 Quy Tắc Thực Hiện (Mandatory Rule)

> **"Không được thay đổi hoặc diễn giải khác với các nguyên tắc và workflow đã định nghĩa; nếu source code hiện tại mâu thuẫn với Master Workflow, phải báo cáo mâu thuẫn trước khi sửa."**
