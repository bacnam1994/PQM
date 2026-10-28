# SCREEN_CONTRACTS: 25 Hợp Đồng Giao Diện Chuẩn Mực PQM (SC-01 ➔ SC-25)

> **Mã tài liệu**: `CONTRACT-SCREEN-01`  
> **Thư mục**: `docs/contracts/SCREEN_CONTRACTS.md`  
> **Phạm vi**: 25 Hợp đồng giao diện màn hình chuẩn hóa của hệ thống PQM.  
> **Quy tắc bất biến**: UI chỉ là tầng trình bày (Presentation Layer), nhận State đã giải quyết từ Domain Engine để render, tuyệt đối không chứa Business Authority hay tự ý tính toán kết quả kiểm nghiệm.  
> **Single Source of Truth về Mã màn hình**: Đối chiếu 1:1 với [`docs/screen-contracts/SCREEN_INVENTORY.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/screen-contracts/SCREEN_INVENTORY.md).

---

## 1. Cấu Trúc Chuẩn Tắc 13 Trường Cho Từng Màn Hình

1. `Screen ID & Name`: Định danh mã màn hình và tên tiếng Việt.
2. `Route URL`: Đường dẫn URL trong hệ thống định tuyến client.
3. `Purpose`: Mục tiêu nghiệp vụ của màn hình.
4. `Actor & Permission`: Nhóm người dùng và quyền hạn RBAC.
5. `Data Source`: API endpoints / Application Services / React Query Hooks.
6. `UI States`: Loading (Skeleton), Empty (No data state), Error (Banner/Toast), Normal.
7. `Components & Fields`: Danh sách các khối giao diện, bảng dữ liệu, bộ lọc, trường form.
8. `Actions`: Các nút bấm và thao tác của người dùng.
9. `Validation Rules`: Ràng buộc nhập liệu tức thì tại client.
10. `Business Rules Reference`: Danh sách Rule ID chi phối.
11. `State Rendering & Badges`: Quy tắc hiển thị nhãn màu sắc theo chuẩn tắc.
12. `Navigation`: Điều hướng liên kết tới màn hình khác.
13. `Forbidden UI Behavior`: Những điều cấm kỵ tuyệt đối ở màn hình này.

---

## 2. Danh Mục 25 Hợp Đồng Màn Hình Chuẩn Tắc (SC-01 ➔ SC-25)

### SC-01: Bảng Điều Khiển Tổng Quan (Dashboard Chất Lượng)

- **Route URL**: `/dashboard`
- **Purpose**: Cung cấp bức tranh toàn cảnh về chất lượng, tiến độ kiểm nghiệm các lô, số lượng OOS/Deviation đang mở và cảnh báo trễ hạn.
- **Actor & Permission**: Toàn bộ nhân sự đăng nhập. `QA_MANAGER` xem thêm thẻ KPI xuất xưởng.
- **Data Source**: `GET /api/dashboard/metrics`, `useDashboardQuery()`.
- **UI States**: Skeleton cards khi loading; Biểu đồ trống khi kỳ mới; Thẻ cảnh báo đỏ khi có OOS chưa đóng.
- **Components & Fields**: Thẻ KPI (Lô đang kiểm nghiệm, First-Pass Yield, OOS mở, Deviation mở); Biểu đồ tiến độ kiểm nghiệm; Bảng các lô chờ QA thẩm tra (`"Đã kiểm xong - Chờ QA duyệt"`).
- **Actions**: Click vào thẻ để chuyển sang danh sách tương ứng; Chọn khoảng thời gian lọc.
- **Forbidden UI Behavior**: Cấm tự làm tròn sai lệch tỷ lệ %; Cấm ẩn các lô bị Rejected khỏi biểu đồ.

---

### SC-02: Danh Mục Sản Phẩm (Product List)

- **Route URL**: `/products`
- **Purpose**: Tra cứu, lọc và phân loại toàn bộ danh mục sản phẩm, hoạt chất, số đăng ký và tình trạng TCCS hiệu lực.
- **Actor & Permission**: Xem: Tất cả; Thêm/Sửa: `QA_MANAGER`, `RND_MANAGER`.
- **Data Source**: `GET /api/products`, `useProductsQuery()`.
- **UI States**: Skeleton table khi tải; Empty state có nút "Thêm sản phẩm" nếu chưa có dữ liệu.
- **Components & Fields**: Ô tìm kiếm nhanh, Bộ lọc dạng bào chế, Bảng dữ liệu (Mã SP, Tên SP, Hoạt chất, Quy cách, TCCS hiện hành, Trạng thái).
- **Actions**: Xem chi tiết (`SC-03`), Thêm sản phẩm mới, Chỉnh sửa thông tin hành chính.
- **Forbidden UI Behavior**: Cấm cung cấp nút xóa cứng (Hard delete) sản phẩm khi đã có lô sản xuất.

---

### SC-03: Chi Tiết Sản Phẩm (Product Detail & History)

- **Route URL**: `/products/:id`
- **Purpose**: Xem hồ sơ tổng hợp của một sản phẩm, danh sách phiên bản TCCS trong lịch sử và các lô sản xuất liên quan.
- **Actor & Permission**: Xem: Tất cả; Nâng phiên bản: `QA_MANAGER`, `RND_MANAGER`.
- **Data Source**: `GET /api/products/:id`, `GET /api/products/:id/tccs-history`.
- **Components & Fields**: Tab Thông tin chung, Tab Lịch sử TCCS, Tab Công thức sản xuất, Tab Lịch sử Lô.
- **Actions**: Bấm "Tạo phiên bản TCCS mới" (điều hướng sang `SC-06`), Xuất hồ sơ sản phẩm (PDF).
- **Forbidden UI Behavior**: Cấm sửa thông tin kỹ thuật trực tiếp khi chưa mở quy trình Change Control.

---

### SC-04: Danh Mục Tiêu Chuẩn Cơ Sở (TCCS List)

- **Route URL**: `/tccs`
- **Purpose**: Quản lý tập trung các bộ Tiêu chuẩn cơ sở, lọc theo trạng thái hiệu lực (`EFFECTIVE`, `UNDER_REVIEW`, `SUPERSEDED`).
- **Actor & Permission**: Xem: Tất cả; Tạo Draft: `ANALYST`, `RND_SPECIALIST`.
- **Data Source**: `GET /api/tccs`, `useTCCSListQuery()`.
- **Components & Fields**: Bảng danh sách TCCS, Cột Phiên bản, Cột Trạng thái có gắn badge màu chuẩn (Xanh lá: `EFFECTIVE`, Vàng: `UNDER_REVIEW`, Xám: `SUPERSEDED`).
- **Actions**: Xem chi tiết (`SC-05`), Soạn thảo TCCS mới (`SC-06`).
- **Forbidden UI Behavior**: Cấm cho phép sửa trực tiếp TCCS đang ở trạng thái `EFFECTIVE`.

---

### SC-05: Chi Tiết Tiêu Chuẩn Cơ Sở (TCCS Detail)

- **Route URL**: `/tccs/:id`
- **Purpose**: Xem chi tiết danh sách chỉ tiêu, phương pháp thử và các quy tắc thay thế đính kèm.
- **Actor & Permission**: Xem: Tất cả.
- **Data Source**: `GET /api/tccs/:id`.
- **Components & Fields**: Bảng chỉ tiêu kiểm nghiệm (Tên chỉ tiêu, Bộ phận Lý/Hóa/Vi sinh, Mức chất lượng quy định, Phương pháp thử); Cột quan hệ thay thế (`🔗 Có thay thế` hoặc `↳ Phụ thuộc`); Khối Footnote chân trang.
- **Actions**: Xuất bản in TCCS, Sao chép tạo phiên bản mới sang `SC-06`.
- **Forbidden UI Behavior**: Cấm ẩn các chỉ tiêu phụ thuộc; Cấm sửa trực tiếp trên bảng xem chi tiết.

---

### SC-06: Trình Biên Tập Tiêu Chuẩn Cơ Sở (TCCS Editor)

- **Route URL**: `/tccs/editor/:id?`
- **Purpose**: Soạn thảo bộ chỉ tiêu, thiết lập cận trên/dưới và cấu hình các quy tắc thay thế (`FAIL_RETRY`, `CONDITIONAL_CHECK`).
- **Actor & Permission**: `RND_SPECIALIST`, `QA_REVIEWER`, `QA_MANAGER`.
- **Data Source**: `POST /api/tccs`, `PUT /api/tccs/:id`.
- **Components & Fields**: Form thông tin tiêu chuẩn, Form thêm/sửa chỉ tiêu, Modal cấu hình Alternate Rule (chọn Primary Criterion, chọn Substitute Criterion, nhập căn cứ pháp lý và nội dung Footnote).
- **Validation Rules**: Cấm cấu hình vòng lặp đệ quy (A thay B, B thay A); Bắt buộc có đơn vị tính cho chỉ tiêu định lượng.
- **Forbidden UI Behavior**: Cấm lưu TCCS rỗng không có chỉ tiêu; Cấm cấu hình Alternate Rule loại không được V2 hỗ trợ.

---

### SC-07: Công Thức Sản Phẩm (Product Formulas / Master Formula BOM)

- **Route URL**: `/formulas`
- **Purpose**: Quản lý định mức nguyên vật liệu cho từng cỡ lô chuẩn.
- **Actor & Permission**: Xem: Tất cả; Soạn thảo: `RND_SPECIALIST`; Duyệt: `QA_MANAGER` & `PRODUCTION_DIRECTOR`.
- **Data Source**: `GET /api/formulas`, `POST /api/formulas`.
- **Components & Fields**: Bảng danh sách công thức, Bảng chi tiết thành phần nguyên liệu (Mã NVL, Tên hoạt chất/tá dược, Tỷ lệ %, Khối lượng chuẩn, Đơn vị).
- **Validation Rules**: Tổng tỷ lệ thành phần phải cân bằng 100% $\pm$ sai số tá dược độn cho phép.

---

### SC-08: Nguyên Vật Liệu & Kho (Raw Materials & Material Lots)

- **Route URL**: `/raw-materials`
- **Purpose**: Theo dõi tình trạng tiếp nhận lô nguyên liệu nhập kho, số lô nhà sản xuất, hạn retest và trạng thái kiểm tra đầu vào.
- **Actor & Permission**: `WAREHOUSE`, `QC`, `QA`.
- **Data Source**: `GET /api/raw-materials`.
- **Components & Fields**: Thẻ cảnh báo lô sắp hết hạn retest; Bảng danh sách lô nguyên liệu kèm Badge kiểm nghiệm (`QUARANTINE`, `PASS`, `FAIL`).
- **Actions**: Xem CoA nhà cung ứng, Tạo yêu cầu kiểm nghiệm đầu vào, Khóa lô hết hạn.

---

### SC-09: Danh Mục Lô Sản Xuất (Batch List)

- **Route URL**: `/batches`
- **Purpose**: Theo dõi toàn bộ các lô sản xuất của nhà máy, trạng thái tác nghiệp và tiến độ kiểm nghiệm.
- **Actor & Permission**: Toàn bộ nhân sự đăng nhập.
- **Data Source**: `GET /api/batches`, `useBatchListQuery()`.
- **Components & Fields**: Bộ lọc sản phẩm, Bộ lọc trạng thái (`TESTING`, `QA_REVIEW`, `RELEASED`, `REJECTED`); Bảng dữ liệu Lô (Số lô, Sản phẩm, Ngày SX, Hạn dùng, Trạng thái tác nghiệp, Dynamic Badge KCS).
- **State Rendering**:
  - `percentage === 100` & `overallQualityStatus === 'PASS'`: Render nhãn xanh dương: `"Đã kiểm xong - Chờ QA duyệt"`.
  - Có chỉ tiêu `FAIL`: Render nhãn đỏ: `"Cảnh báo: Có chỉ tiêu Không Đạt"`.
- **Forbidden UI Behavior**: Cấm UI tự gán nhãn Đạt bằng logic nội bộ; bắt buộc gọi `CanonicalStatusResolver.resolveBatchQuality`.

---

### SC-10: Chi Tiết Lô Sản Xuất & Release Gate (Batch Detail & Release Gate)

- **Route URL**: `/batches/:id`
- **Purpose**: Hồ sơ điện tử 360 độ của một lô: Thành phần nguyên liệu đã cấp phát, Tiến độ kiểm nghiệm, Thẩm định xuất xưởng qua 7 Release Gates, Phong tỏa khẩn cấp.
- **Actor & Permission**: Xem: Tất cả; Phong tỏa khẩn cấp / Duyệt xuất xưởng: `QA_DIRECTOR` / `AUTHORIZED_PERSON`.
- **Data Source**: `GET /api/batches/:id`, `GET /api/batches/:id/evaluation-summary`.
- **Components & Fields**: Header hồ sơ Lô; Tab Tiến độ kiểm nghiệm; Tab Phả hệ nguyên liệu; Tab Sự cố (OOS/Deviations); Tab 7 Release Gates; Nút "Ký lệnh xuất xưởng"; Nút "Phong tỏa lô khẩn cấp".
- **Forbidden UI Behavior**: Tuyệt đối cấm hiển thị nút Xuất xưởng khả dụng nếu bất kỳ cổng nào trong 7 Release Gates chưa đạt.

---

### SC-11: Danh Mục Phiếu Kiểm Nghiệm (Test Result List / PKN List)

- **Route URL**: `/test-results`
- **Purpose**: Quản lý danh sách toàn bộ các phiếu kiểm nghiệm mẫu thành phẩm, bán thành phẩm và nguyên liệu đầu vào.
- **Actor & Permission**: `ANALYST`, `QA_REVIEWER`, `QA_MANAGER`.
- **Data Source**: `GET /api/test-results`.
- **Components & Fields**: Bảng danh sách phiếu (Mã PKN, Số lô, Ngày nhận mẫu, Kỹ thuật viên, Trạng thái `DRAFT` / `SUBMITTED` / `REVIEWED` / `APPROVED`).
- **Actions**: Mở tạo phiếu mới, Mở trình nhập liệu (`SC-12`), Xem chi tiết (`SC-13`).

---

### SC-12: Trình Soạn Thảo & Nhập Liệu Phiếu Kiểm Nghiệm (PKN Editor)

- **Route URL**: `/test-results/editor/:id?`
- **Purpose**: Màn hình tác nghiệp cốt lõi của Kỹ thuật viên để nhập kết quả đo đạc thực tế của từng chỉ tiêu theo Snapshot TCCS niêm phong.
- **Actor & Permission**: Nhập: `ANALYST`; Nộp: `ANALYST`; Duyệt thẩm tra: `QA_REVIEWER`; Duyệt ký số: `QA_MANAGER`.
- **Components & Fields**: Bảng 100% chỉ tiêu niêm phong từ TCCS; Cột mức chất lượng quy định (Disabled); Cột nhập kết quả thực tế; Cột trạng thái thực thi (`COMPLETED`, `EXEMPTED`, `NOT_APPLICABLE`); Cột trạng thái chất lượng (`PASS`, `FAIL`, `PENDING`); Badge Alternate Rule.
- **Validation Rules**: Khóa toàn bộ ô nhập liệu khi trạng thái là `SUBMITTED` hoặc `APPROVED`; Kiểm tra Segregation of Duties (SoD).
- **Forbidden UI Behavior**: Cấm ẩn bất kỳ chỉ tiêu bắt buộc nào khỏi bảng; Cấm người tạo phiếu tự phê duyệt phiếu của chính mình.

---

### SC-13: Chi Tiết Phiếu Kiểm Nghiệm (PKN Detail)

- **Route URL**: `/test-results/:id`
- **Purpose**: Xem chi tiết kết quả phân tích, phương pháp thử, người thực hiện và lịch sử thẩm tra của một phiếu kiểm nghiệm.
- **Actor & Permission**: Xem: Tất cả người dùng có quyền QC/QA.
- **Data Source**: `GET /api/test-results/:id`.
- **Components & Fields**: Thông tin hành chính mẫu; Bảng kết quả chỉ tiêu chi tiết; Khối chữ ký thẩm tra và phê duyệt; Khối giải trình quy tắc thay thế.

---

### SC-14: Xem & In Phiếu Kiểm Nghiệm (CoA Report & Print View)

- **Route URL**: `/coa/:batchId`
- **Purpose**: Hiển thị và in ấn Phiếu kiểm nghiệm chính thức (CoA) ra giấy hoặc xuất PDF chuẩn Dược điển.
- **Actor & Permission**: Xem: Tất cả; Ký phát hành: `QA_MANAGER` / `AUTHORIZED_PERSON`.
- **Data Source**: `CoASnapshotContract` (Chỉ đọc từ Evaluation Snapshot đóng băng, không đọc dữ liệu live).
- **Components & Fields**: Quốc hiệu, Logo đơn vị, Tiêu đề "PHIẾU KIỂM NGHIỆM / CERTIFICATE OF ANALYSIS"; Thông tin lô; Bảng kết quả đóng băng; Khối Footnotes giải trình các chỉ tiêu miễn thử/thay thế; Chữ ký 3 bên; Mã QR xác thực.
- **Forbidden UI Behavior**: **TUYỆT ĐỐI CẤM** viết logic tính toán `if-else` đánh giá Đạt/Không Đạt bên trong component in này; Cấm cho phép sửa chữ trực tiếp trên bản in.

---

### SC-15: Quản Lý Hồ Sơ OOS (OOS Investigation View)

- **Route URL**: `/oos`
- **Purpose**: Thực hiện và theo dõi cuộc điều tra 2 giai đoạn khi có chỉ tiêu kiểm nghiệm không đạt tiêu chuẩn.
- **Actor & Permission**: `ANALYST`, `LAB_SUPERVISOR`, `QA_MANAGER`.
- **Data Source**: `GET /api/oos`.
- **Components & Fields**: Bảng danh sách OOS; Giai đoạn 1: Checklist điều tra lỗi phòng lab (thiết bị, hóa chất, thao tác); Giai đoạn 2: Phân tích nguyên nhân sản xuất (5-Why); Kết luận xử lý và chữ ký đóng hồ sơ.

---

### SC-16: Quản Lý Sai Lệch Quy Trình (Deviation Management View)

- **Route URL**: `/deviations`
- **Purpose**: Báo cáo sự cố bất thường trong quá trình sản xuất/kiểm nghiệm, đánh giá mức độ rủi ro Minor/Major/Critical.
- **Actor & Permission**: Mọi nhân sự báo cáo; `QA_MANAGER` đánh giá rủi ro và duyệt đóng.
- **Data Source**: `GET /api/deviations`.
- **Components & Fields**: Form báo cáo sai lệch; Ma trận phân loại rủi ro; Danh sách hành động cô lập tức thời; Trạng thái liên kết Lô sản phẩm.

---

### SC-17: Quản Lý Hành Động Khắc Phục Phòng Ngừa (CAPA Management)

- **Route URL**: `/capa`
- **Purpose**: Quản lý vòng đời khép kín của các hành động CAPA phát sinh từ OOS và Deviation.
- **Actor & Permission**: `QA_SPECIALIST`, `QA_MANAGER`, `Assignee`.
- **Data Source**: `GET /api/capa`.
- **Components & Fields**: Bảng Kanban tiến độ hành động; Form tải biên bản bằng chứng; Đánh giá hiệu quả sau 3 tháng.

---

### SC-18: Trung Tâm Phê Duyệt (Approval Work Queue)

- **Route URL**: `/approvals`
- **Purpose**: Màn hình trung tâm của QA Reviewer và QA Manager để xem toàn bộ các phiếu kiểm nghiệm, lô hàng, sai lệch đang chờ ký duyệt tập trung.
- **Actor & Permission**: `QA_REVIEWER`, `QA_MANAGER`, `QUALIFIED_PERSON`.
- **Data Source**: `GET /api/approvals/queue`.
- **Components & Fields**: Danh sách tác vụ chờ duyệt phân loại theo loại hồ sơ; Nút "Xem nhanh hồ sơ"; Modal ký số điện tử (nhập mật khẩu và ý nghĩa ký).

---

### SC-19: Nhật Ký Ký Số Điện Tử (Signature Log)

- **Route URL**: `/signatures`
- **Purpose**: Lịch sử tra cứu các lần ký điện tử tuân thủ FDA 21 CFR Part 11 của toàn bộ hệ thống.
- **Actor & Permission**: `QA_MANAGER`, `SYSTEM_ADMIN`, `AUDITOR`.
- **Data Source**: `GET /api/signatures`.
- **Components & Fields**: Bảng lịch sử ký (Người ký, Vai trò, Đối tượng ký, Thời gian ký UTC+7, Ý nghĩa ký, Mã băm toàn vẹn SHA-256).

---

### SC-20: Nhật Ký Kiểm Toán ALCOA+ (Audit Trail Viewer)

- **Route URL**: `/audit-trail`
- **Purpose**: Tra cứu, lọc và trích xuất lịch sử biến động dữ liệu bất biến phục vụ thanh tra GMP.
- **Actor & Permission**: `QA_MANAGER`, `AUDITOR`, `SYSTEM_ADMIN`.
- **Data Source**: `GET /api/audit-trail`.
- **Components & Fields**: Bộ lọc thời gian, đối tượng, người thực hiện; Bảng timeline sự kiện; Khối Diff trực quan (Giá trị cũ đỏ gạch ngang vs Giá trị mới xanh lá); Thanh trạng thái xác thực chuỗi Hash Chain.
- **Forbidden UI Behavior**: Tuyệt đối không có nút Sửa hoặc Xóa trên màn hình này.

---

### SC-21: Cây Phả Hệ Lô (Batch 360 Genealogy Graph)

- **Route URL**: `/genealogy/:batchId`
- **Purpose**: Sơ đồ mạng tương tác trực quan 2 chiều (Forward/Backward Traceability) về dòng chảy nguyên vật liệu cấu thành nên lô sản phẩm.
- **Actor & Permission**: Toàn bộ nhân sự đăng nhập.
- **Data Source**: `GET /api/batches/:batchId/genealogy`.
- **Components & Fields**: Graph/Tree Viewer trực quan; Nút Lô nguyên liệu, Lô bán thành phẩm, Lô thành phẩm; Đánh dấu đỏ các nút có sự cố chất lượng; Nút phóng to, thu nhỏ, xuất SVG/PDF.

---

### SC-22: Báo Cáo Thống Kê & SPC (SPC Analytics & Quality Trends)

- **Route URL**: `/analytics`
- **Purpose**: Biểu đồ kiểm soát quá trình (Shewhart Control Charts) cho các chỉ tiêu định lượng trọng yếu và tự động phát hiện trôi dạt dữ liệu theo quy tắc Nelson, tính chỉ số năng lực $C_p, C_{pk}$.
- **Actor & Permission**: `QC_MANAGER`, `QA_MANAGER`, `RND_SPECIALIST`.
- **Data Source**: `GET /api/analytics/spc`.
- **Components & Fields**: Biểu đồ đường Shewhart ($UCL, LCL, UWL, LWL, \bar{X}, USL, LSL$); Điểm đo vi phạm đánh dấu đỏ nhấp nháy; Bảng thông số thống kê $C_p, C_{pk}, \sigma$.

---

### SC-23: Trợ Lý AI Copilot (AI Advisory & Mapping)

- **Route URL**: `/ai-copilot`
- **Purpose**: Trò chuyện tra cứu quy trình, tra cứu Dược điển, hỗ trợ OCR văn bản phiếu kiểm nghiệm và gợi ý ánh xạ trường tự động.
- **Actor & Permission**: Toàn bộ nhân sự KCS/QA.
- **Data Source**: `AIGateway`, `useAIAssistantChat()`.
- **Components & Fields**: Khung chat hội thoại AI; Khung tải tệp ảnh/PDF phiếu kiểm nghiệm; Khung xem kết quả OCR và gợi ý ánh xạ trường sang TCCS kèm độ tin cậy.
- **Forbidden UI Behavior**: AI chỉ được đóng vai trò cố vấn (Advisory); Tuyệt đối cấm AI tự động ghi đè hoặc phê duyệt dữ liệu mà không có xác nhận của con người.

---

### SC-24: Quản Lý Phân Quyền & Người Dùng (User Management & RBAC Matrix)

- **Route URL**: `/users`
- **Purpose**: Quản lý tài khoản người dùng, gán vai trò quyền hạn và cấu hình ma trận phân quyền RBAC.
- **Actor & Permission**: Chỉ `SYSTEM_ADMIN`.
- **Data Source**: `GET /api/users`.
- **Components & Fields**: Bảng danh sách người dùng; Modal phân vai trò (`ANALYST`, `QA_REVIEWER`, `QA_MANAGER`, `PRODUCTION`, `WAREHOUSE`); Khóa/mở khóa tài khoản.
- **Forbidden UI Behavior**: Cấm gán quyền can thiệp dữ liệu kiểm nghiệm hoặc ký duyệt xuất xưởng cho tài khoản `SYSTEM_ADMIN`.

---

### SC-25: Cài Đặt Hệ Thống (System Settings)

- **Route URL**: `/settings`
- **Purpose**: Cấu hình các thông số toàn cục của hệ thống (Dược điển tham chiếu, danh mục phòng thí nghiệm, đơn vị đo chuẩn, chính sách mật khẩu và phiên làm việc).
- **Actor & Permission**: Chỉ `SYSTEM_ADMIN`.
- **Data Source**: `GET /api/settings`.
- **Components & Fields**: Danh mục Dược điển (USP, BP, Dược điển Việt Nam); Danh mục Phòng Lab; Danh mục Đơn vị tính; Cấu hình thời gian timeout phiên làm việc.
