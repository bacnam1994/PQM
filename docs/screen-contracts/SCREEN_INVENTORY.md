# DANH MỤC 25 MÀN HÌNH CHUẨN HÓA (SCREEN INVENTORY)

## (LEVEL 4: PQM UI SCREEN REGISTRY)

> **Mã tài liệu**: `REGISTRY-SCREEN-01`  
> **Thư mục**: `docs/screen-contracts/SCREEN_INVENTORY.md`  
> **Phạm vi**: 25 Màn hình định danh của toàn bộ ứng dụng PQM.

---

| Mã màn hình | Tên Màn hình                | Route URL                   | Mục đích & Thẩm quyền                                              |
| :---------: | :-------------------------- | :-------------------------- | :----------------------------------------------------------------- |
|  **SC-01**  | **Dashboard Chất lượng**    | `/dashboard`                | Trung tâm giám sát cảnh báo, KPI, việc cần làm (Mọi role)          |
|  **SC-02**  | **Danh mục Sản phẩm**       | `/products`                 | Danh sách sản phẩm, bộ lọc dạng bào chế (Mọi role)                 |
|  **SC-03**  | **Chi tiết Sản phẩm**       | `/products/:id`             | Xem hồ sơ sản phẩm, SĐK, lịch sử các lô (Mọi role)                 |
|  **SC-04**  | **Danh mục TCCS**           | `/tccs`                     | Quản lý danh sách tiêu chuẩn cơ sở và trạng thái (QC/QA)           |
|  **SC-05**  | **Chi tiết TCCS**           | `/tccs/:id`                 | Xem chi tiết chỉ tiêu, phương pháp thử, quy tắc thay thế (QC/QA)   |
|  **SC-06**  | **Trình biên tập TCCS**     | `/tccs/editor/:id?`         | Tạo mới/sửa chỉ tiêu, cấu hình Alternate Rules (QC/QA Manager)     |
|  **SC-07**  | **Công thức Sản phẩm**      | `/formulas`                 | Quản lý thành phần định lượng, tỷ lệ NVL (R&D/QA)                  |
|  **SC-08**  | **Nguyên vật liệu & Kho**   | `/raw-materials`            | Quản lý tồn kho nguyên liệu, lô nhà sản xuất, AVL (Kho/QC)         |
|  **SC-09**  | **Danh mục Lô sản xuất**    | `/batches`                  | Danh sách lô, bộ lọc tiến độ, cảnh báo hạn dùng (Mọi role)         |
|  **SC-10**  | **Chi tiết Lô sản xuất**    | `/batches/:id`              | Hồ sơ lô tổng thể, Release Gate, Phong tỏa khẩn cấp (Mọi role)     |
|  **SC-11**  | **Danh mục Phiếu KN (PKN)** | `/test-results`             | Danh sách phiếu kiểm nghiệm phòng lab (QC/QA)                      |
|  **SC-12**  | **Trình nhập liệu PKN**     | `/test-results/editor/:id?` | **Nhập kết quả chỉ tiêu, hiển thị Alternate Rules (QC Analyst)**   |
|  **SC-13**  | **Chi tiết Phiếu KN**       | `/test-results/:id`         | Xem kết quả phân tích, thẩm tra phương pháp thử (QC/QA)            |
|  **SC-14**  | **Xem & In CoA**            | `/coa/:batchId`             | **Bản in CoA chính thức, đọc độc quyền từ Snapshot (Mọi role)**    |
|  **SC-15**  | **Quản lý Hồ sơ OOS**       | `/oos`                      | Danh sách và tiến trình điều tra OOS Phase I & II (QC/QA)          |
|  **SC-16**  | **Quản lý Sai lệch**        | `/deviations`               | Ghi nhận sự cố, đánh giá rủi ro Minor/Major/Critical (Mọi role)    |
|  **SC-17**  | **Quản lý CAPA**            | `/capa`                     | Kế hoạch khắc phục, phân công, giám sát deadline (QA)              |
|  **SC-18**  | **Trung tâm Phê duyệt**     | `/approvals`                | Danh sách hồ sơ chờ duyệt, ký số điện tử tập trung (QA/QC Head)    |
|  **SC-19**  | **Nhật ký Ký số**           | `/signatures`               | Lịch sử các lần ký điện tử FDA 21 CFR Part 11 (QA/Admin)           |
|  **SC-20**  | **Nhật ký Kiểm toán**       | `/audit-trail`              | Tra cứu vết ALCOA+ Audit Trail bất biến (QA/Auditor)               |
|  **SC-21**  | **Cây Phả hệ Lô**           | `/genealogy/:batchId`       | Sơ đồ phả hệ 2 chiều truy xuất nguồn gốc (Mọi role)                |
|  **SC-22**  | **Báo cáo Thống kê & SPC**  | `/analytics`                | Biểu đồ kiểm soát Shewhart, phân tích Cpk, APQR (QA/Management)    |
|  **SC-23**  | **Trợ lý AI Copilot**       | `/ai-copilot`               | Trò chuyện tra cứu quy trình, OCR kết quả máy phân tích (Mọi role) |
|  **SC-24**  | **Phân quyền & Người dùng** | `/users`                    | Quản lý tài khoản, vai trò RBAC, trạng thái khóa (Admin)           |
|  **SC-25**  | **Cài đặt Hệ thống**        | `/settings`                 | Cấu hình Dược điển, danh mục phòng Lab, đơn vị tính (Admin)        |
