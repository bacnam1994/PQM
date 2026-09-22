# SCREEN_CONTRACTS: 25 Hợp Đồng Giao Diện Chuẩn Mực PQM (SC-01 ➔ SC-25)

Tài liệu này chuẩn hóa toàn bộ 25 Hợp Đồng Màn Hình Giao Diện (Screen Contracts) của hệ thống PQM theo nguyên tắc Vibecoding bắt buộc: **UI chỉ là tầng trình bày (Presentation Layer), nhận State đã giải quyết từ Domain Engine để render, tuyệt đối không chứa Business Authority hay tự ý tính toán kết quả kiểm nghiệm**.

---

## 1. Cấu Trúc Chuẩn Tắc 13 Trường Cho Từng Màn Hình

Mỗi hợp đồng màn hình bao gồm:

1. `Screen ID & Name`: Định danh mã màn hình và tên tiếng Việt.
2. `Purpose`: Mục tiêu nghiệp vụ của màn hình.
3. `Actor & Permission`: Nhóm người dùng và quyền hạn RBAC.
4. `Data Source`: API endpoints / Application Services / React Query Hooks.
5. `UI States`: Loading (Skeleton), Empty (No data state), Error (Banner/Toast), Normal.
6. `Components & Fields`: Danh sách các khối giao diện, bảng dữ liệu, bộ lọc, trường form.
7. `Actions`: Các nút bấm và thao tác của người dùng.
8. `Validation Rules`: Ràng buộc nhập liệu tức thì tại client.
9. `Business Rules Reference`: Danh sách Rule ID chi phối.
10. `State Rendering & Badges`: Quy tắc hiển thị nhãn màu sắc theo chuẩn tắc.
11. `Navigation`: Điều hướng liên kết tới màn hình khác.
12. `Audit Trail Trigger`: Các hành vi kích hoạt ghi nhận nhật ký kiểm toán.
13. `Forbidden UI Behavior`: Những điều cấm kỵ tuyệt đối ở màn hình này.

---

## 2. Danh Mục 25 Hợp Đồng Màn Hình (SC-01 ➔ SC-25)

### SC-01: Bảng Điều Khiển Tổng Quan (Quality Executive Dashboard)

- **Purpose**: Cung cấp bức tranh toàn cảnh về tình hình chất lượng nhà máy, tiến độ kiểm nghiệm các lô trong tuần/tháng, số lượng OOS/Deviation đang mở và cảnh báo trễ hạn.
- **Actor & Permission**: Toàn bộ nhân sự đăng nhập. `QA_MANAGER` xem thêm thẻ KPI xuất xưởng.
- **Data Source**: `GET /api/dashboard/metrics`, `useDashboardQuery()`.
- **UI States**: Skeleton cards khi loading; Biểu đồ trống khi kỳ mới; Thẻ cảnh báo đỏ khi có OOS chưa giải quyết.
- **Components & Fields**:
  - Thẻ KPI: Tổng số lô đang kiểm nghiệm, Tỷ lệ Pass lần đầu (First-Pass Yield), Số OOS mở, Số Deviation mở.
  - Biểu đồ tiến độ kiểm nghiệm theo tuần (Bar Chart).
  - Bảng "Các lô cần QA thẩm tra gấp" (Danh sách có nhãn `"Đã kiểm xong - Chờ QA duyệt"`).
- **Actions**: Click vào thẻ để chuyển sang danh sách tương ứng; Chọn khoảng thời gian (Hôm nay, Tuần này, Tháng này).
- **Forbidden UI Behavior**: Cấm hiển thị tỷ lệ phần trăm được làm tròn sai lệch so với dữ liệu backend; Cấm ẩn các lô bị Rejected khỏi biểu đồ.

---

### SC-02: Danh Sách Sản Phẩm (Product List)

- **Purpose**: Tra cứu, lọc và phân loại toàn bộ danh mục sản phẩm, hoạt chất, số đăng ký và tình trạng TCCS hiệu lực.
- **Actor & Permission**: Xem: Tất cả; Thêm mới: `QA_MANAGER`, `RND_MANAGER`.
- **Data Source**: `GET /api/products`, `useProductsQuery()`.
- **UI States**: Skeleton table khi tải; Empty state có nút "Thêm sản phẩm đầu tiên" nếu chưa có dữ liệu.
- **Components & Fields**: Ô tìm kiếm nhanh (Tên, Mã, SĐK), Bộ lọc Dạng bào chế, Bảng dữ liệu phân trang (Mã SP, Tên SP, Hoạt chất, Dạng bào chế, TCCS hiện hành, Trạng thái).
- **Actions**: Xem chi tiết, Chỉnh sửa, Tạo bản thảo TCCS mới.
- **Forbidden UI Behavior**: Cấm cung cấp nút "Xóa vĩnh viễn" (Hard delete) sản phẩm.

---

### SC-03: Chi Tiết Sản Phẩm (Product Detail & History)

- **Purpose**: Xem hồ sơ tổng hợp của một sản phẩm, danh sách các phiên bản TCCS trong lịch sử và các lô sản xuất liên quan.
- **Actor & Permission**: Xem: Tất cả; Nâng phiên bản: `QA_MANAGER`.
- **Data Source**: `GET /api/products/:id`, `GET /api/products/:id/tccs-history`.
- **UI States**: Loading spinner; Tab navigation (Thông tin chung, Lịch sử TCCS, Công thức sản xuất, Lịch sử Lô).
- **Actions**: Bấm "Tạo phiên bản TCCS mới", Xuất hồ sơ sản phẩm (PDF).
- **Forbidden UI Behavior**: Cấm sửa thông tin kỹ thuật trực tiếp khi chưa mở quy trình Change Control.

---

### SC-04: Biểu Mẫu Sản Phẩm (Product Form - Create/Edit)

- **Purpose**: Thêm mới hoặc cập nhật thông tin hành chính của sản phẩm.
- **Actor & Permission**: `QA_MANAGER`, `RND_SPECIALIST`.
- **Data Source**: `POST /api/products`, `PUT /api/products/:id`.
- **Components & Fields**: Mã sản phẩm (Disabled khi edit), Tên thương mại, Tên INN, Dạng bào chế (Dropdown), Quy cách, Tuổi thọ (tháng), Số đăng ký, Hạn giấy phép, Lý do sửa (khi edit).
- **Validation Rules**: Mã sản phẩm viết hoa, không dấu; Tuổi thọ > 0; Lý do sửa tối thiểu 10 ký tự.
- **Audit Trail Trigger**: Ghi vết sự kiện tạo mới hoặc cập nhật sản phẩm kèm Diff.

---

### SC-05: Danh Sách Tiêu Chuẩn Cơ Sở (TCCS List)

- **Purpose**: Quản lý tập trung các bộ Tiêu chuẩn cơ sở, lọc theo trạng thái hiệu lực (`EFFECTIVE`, `UNDER_REVIEW`, `SUPERSEDED`).
- **Actor & Permission**: Xem: Tất cả; Tạo Draft: `ANALYST`, `RND_SPECIALIST`.
- **Data Source**: `GET /api/tccs`, `useTCCSListQuery()`.
- **Components & Fields**: Bảng danh sách TCCS, Cột Phiên bản, Cột Trạng thái có gắn badge màu chuẩn (Xanh lá: `EFFECTIVE`, Vàng: `UNDER_REVIEW`, Xám: `SUPERSEDED`).
- **Forbidden UI Behavior**: Cấm cho phép sửa TCCS đang ở trạng thái `EFFECTIVE`.

---

### SC-06: Chi Tiết Tiêu Chuẩn Cơ Sở (TCCS Detail & Criteria View)

- **Purpose**: Xem chi tiết danh sách chỉ tiêu, phương pháp thử và các quy tắc thay thế đính kèm.
- **Actor & Permission**: Xem: Tất cả.
- **Components & Fields**:
  - Bảng chỉ tiêu kiểm nghiệm: Số TT, Tên chỉ tiêu, Bộ phận (Lý/Hóa/Vi sinh), Mức chất lượng quy định, Phương pháp thử.
  - Cột quan hệ thay thế: Hiển thị icon `🔗 Có thay thế` hoặc `↳ Phụ thuộc` nếu có quy tắc liên kết.
  - Khối Footnote: Hiển thị nguyên văn đoạn văn bản giải trình pháp lý sẽ in trên CoA.
- **Forbidden UI Behavior**: Cấm hiển thị thiếu các chỉ tiêu phụ thuộc; Cấm sửa trực tiếp trên bảng xem chi tiết.

---

### SC-07: Soạn Thảo Tiêu Chuẩn Cơ Sở (TCCS Editor & Criteria Builder)

- **Purpose**: Soạn thảo bộ chỉ tiêu, thiết lập cận trên/dưới và cấu hình các quy tắc thay thế (`FAIL_RETRY`, `CONDITIONAL_CHECK`).
- **Actor & Permission**: `RND_SPECIALIST`, `QA_REVIEWER`.
- **Components & Fields**: Form thêm chỉ tiêu, Modal cấu hình Alternate Rule (chọn Primary Criterion, chọn Substitute Criterion, nhập căn cứ pháp lý và nội dung Footnote).
- **Validation Rules**: Cấm cấu hình vòng lặp đệ quy; Bắt buộc có đơn vị tính cho chỉ tiêu định lượng.
- **Forbidden UI Behavior**: Cấm lưu TCCS rỗng không có chỉ tiêu.

---

### SC-08: Quản Lý Công Thức Sản Xuất (Master Formula & BOM)

- **Purpose**: Quản lý định mức nguyên vật liệu cho từng cỡ lô chuẩn.
- **Actor & Permission**: Xem: Tất cả; Soạn thảo: `RND_SPECIALIST`; Duyệt: `QA_MANAGER` & `PRODUCTION_DIRECTOR`.
- **Components & Fields**: Bảng thành phần nguyên liệu (Mã nguyên liệu, Tên hoạt chất/tá dược, Tỷ lệ %, Khối lượng chuẩn, Đơn vị).
- **Validation Rules**: Tổng tỷ lệ thành phần phải cân bằng 100% $\pm$ sai số tá dược độn cho phép.

---

### SC-09: Quản Lý Nguyên Vật Liệu & Kho (Raw Materials & Material Lots)

- **Purpose**: Theo dõi tình trạng tiếp nhận lô nguyên liệu nhập kho, số lô nhà sản xuất, hạn retest và trạng thái kiểm tra đầu vào.
- **Actor & Permission**: `WAREHOUSE`, `QC`, `QA`.
- **Components & Fields**: Thẻ cảnh báo lô sắp hết hạn retest; Bảng danh sách lô nguyên liệu kèm Badge kiểm nghiệm (`QUARANTINE`, `PASS`, `FAIL`).
- **Actions**: Xem CoA nhà cung ứng, Tạo yêu cầu kiểm nghiệm đầu vào, Khóa lô hết hạn.

---

### SC-10: Danh Sách Lô Sản Xuất (Batch List)

- **Purpose**: Màn hình tác nghiệp chính để theo dõi toàn bộ các lô sản xuất của nhà máy, trạng thái tác nghiệp và tiến độ kiểm nghiệm.
- **Actor & Permission**: Toàn bộ nhân sự.
- **Data Source**: `GET /api/batches`, `useBatchListQuery()`.
- **Components & Fields**:
  - Bộ lọc: Sản phẩm, Trạng thái tác nghiệp (`TESTING`, `QA_REVIEW`, `RELEASED`, `REJECTED`), Khoảng ngày sản xuất.
  - Bảng dữ liệu Lô: Số lô, Tên sản phẩm, Ngày SX, Hạn dùng, Trạng thái tác nghiệp (Badge DB), Nhãn hỗ trợ QA (Dynamic Badge).
- **State Rendering**:
  - Lô có `percentage === 100` và `overallQualityStatus === 'PASS'`: Render nhãn màu xanh dương: `"Đã kiểm xong - Chờ QA duyệt"` cạnh trạng thái `TESTING`.
  - Lô có chỉ tiêu `FAIL`: Render nhãn đỏ: `"Cảnh báo: Có chỉ tiêu Không Đạt"`.
- **Forbidden UI Behavior**: Cấm UI tự tính `isPass: true` bằng code nội bộ; bắt buộc gọi `CanonicalStatusResolver.resolveBatchQuality`.

---

### SC-11: Hồ Sơ Chi Tiết Lô (Batch Dossier & 360 Overview)

- **Purpose**: Xem toàn bộ hồ sơ điện tử của một lô: Thành phần nguyên liệu đã cấp phát, Tiến độ kiểm nghiệm, Sai lệch phát sinh, Quyết định phê duyệt và Bản in CoA.
- **Actor & Permission**: Toàn bộ nhân sự (theo phân quyền chức năng con).
- **Components & Fields**:
  - Header: Số lô, Tên thuốc, Trạng thái Lô, Tiến độ % hoàn thành kiểm nghiệm.
  - Tabs: Tiến độ KCS, Hồ sơ phả hệ nguyên liệu, Sự cố (OOS/Deviations), Lịch sử thẩm duyệt, Xuất xưởng & CoA.
- **Actions**: Chuyển tab, Mở phiếu kiểm nghiệm, Mở màn hình Thẩm định Xuất xưởng.

---

### SC-12: Khởi Tạo Lô Sản Xuất (Batch Creation Form)

- **Purpose**: Tạo mới một lô sản xuất từ công thức và tự động chụp Snapshot TCCS có hiệu lực.
- **Actor & Permission**: `PRODUCTION_PLANNER`, `PRODUCTION_MANAGER`.
- **Components & Fields**: Dropdown chọn sản phẩm (chỉ hiện sản phẩm `ACTIVE` có TCCS `EFFECTIVE`), Số lô, Cỡ lô, Ngày sản xuất, Dây chuyền.
- **Validation Rules**: Số lô duy nhất; Ngày sản xuất hợp lệ.
- **Audit Trail Trigger**: Ghi vết sự kiện tạo lô kèm Snapshot ID của TCCS được niêm phong.

---

### SC-13: Danh Sách Phiếu Kiểm Nghiệm (Test Result List)

- **Purpose**: Danh sách toàn bộ các phiếu kiểm nghiệm mẫu thành phẩm, bán thành phẩm và nguyên liệu đầu vào.
- **Actor & Permission**: `ANALYST`, `QA_REVIEWER`, `QA_MANAGER`.
- **Components & Fields**: Bảng danh sách phiếu: Mã PKN, Số lô, Ngày nhận mẫu, Kỹ thuật viên, Trạng thái phiếu (`DRAFT`, `SUBMITTED`, `REVIEWED`, `APPROVED`).
- **Actions**: Mở nhập liệu phiếu, Xem lịch sử thẩm định.

---

### SC-14: Trình Soạn Thảo & Nhập Liệu Phiếu Kiểm Nghiệm (PKN Editor)

- **Purpose**: Màn hình thao tác cốt lõi của Kỹ thuật viên phòng thí nghiệm để nhập kết quả đo đạc thực tế của từng chỉ tiêu.
- **Actor & Permission**: Nhập: `ANALYST`; Thẩm định: `QA_REVIEWER`; Phê duyệt: `QA_MANAGER`.
- **Components & Fields**:
  - Danh sách 100% chỉ tiêu từ Snapshot TCCS (không ẩn bất kỳ dòng nào).
  - Cột mức chất lượng quy định (Disabled).
  - Cột nhập kết quả thực tế (Numeric input hoặc Text input).
  - Cột trạng thái chỉ tiêu (Badge: `PASS`, `FAIL`, `PENDING`, `EXEMPTED`).
  - Nút bấm: "Lưu tạm Draft", "Nộp kết quả thẩm định" (Submit), "Duyệt thẩm định" (Review), "Phê duyệt" (Approve).
- **Validation Rules**: Khóa toàn bộ ô nhập liệu khi trạng thái là `SUBMITTED` hoặc `APPROVED`; Kiểm tra SoD khi bấm Duyệt.
- **Forbidden UI Behavior**: Cấm cho phép Kỹ thuật viên tự xóa hàng chỉ tiêu khỏi bảng; Cấm tự bấm Duyệt nếu là người tạo phiếu.

---

### SC-15: Xem & In Phiếu Kiểm Nghiệm (CoA Report & Print View)

- **Purpose**: Hiển thị và in ấn Phiếu kiểm nghiệm chính thức (CoA) ra giấy hoặc xuất file PDF chuẩn mẫu Dược điển.
- **Actor & Permission**: Xem: Tất cả; Ký phát hành: `QA_MANAGER`.
- **Data Source**: `CoASnapshotContract` (Chỉ đọc từ Snapshot, không đọc live).
- **Components & Fields**:
  - Quốc hiệu, Logo cơ sở sản xuất, Tiêu đề "PHIẾU KIỂM NGHIỆM / CERTIFICATE OF ANALYSIS".
  - Bảng thông tin hành chính của lô và số công bố.
  - Bảng kết quả kiểm nghiệm đóng băng.
  - Khối Footnote chân trang giải trình các chỉ tiêu miễn thử / thay thế.
  - Khối chữ ký điện tử 3 bên (Kỹ thuật viên, Người kiểm tra, Trưởng phòng QA).
  - Mã QR bảo mật chứa liên kết xác thực toàn vẹn.
- **Forbidden UI Behavior**: **TUYỆT ĐỐI CẤM** viết logic tính toán `if-else` đánh giá Đạt/Không Đạt bên trong component in này; Cấm cho phép sửa chữ trực tiếp trên bản in.

---

### SC-16: Quản Lý Điều Tra Kết Quả Ngoài Tiêu Chuẩn (OOS Investigation View)

- **Purpose**: Thực hiện và theo dõi cuộc điều tra 2 giai đoạn khi có chỉ tiêu rớt.
- **Actor & Permission**: `ANALYST`, `LAB_SUPERVISOR`, `QA_MANAGER`.
- **Components & Fields**:
  - Giai đoạn 1: Checklist điều tra lỗi phòng thí nghiệm (Pha thuốc thử, thiết bị, bọt khí, người làm).
  - Giai đoạn 2: Biểu mẫu phân tích nguyên nhân sản xuất (5-Why Diagram) và đánh giá ảnh hưởng.
  - Kết luận xử lý lô và chữ ký đóng hồ sơ của QA Manager.

---

### SC-17: Quản Lý Sai Lệch Quy Trình (Deviation Management View)

- **Purpose**: Báo cáo sự cố bất thường, đánh giá điểm rủi ro RPN và theo dõi biện pháp khắc phục.
- **Actor & Permission**: Mọi nhân sự báo cáo; `QA_MANAGER` đánh giá rủi ro và duyệt đóng.
- **Components & Fields**: Form báo cáo sai lệch, Ma trận chấm điểm rủi ro FMEA, Danh sách các hành động tức thời cô lập sự cố.

---

### SC-18: Quản Lý Hành Động Khắc Phục Phòng Ngừa (CAPA Dashboard)

- **Purpose**: Quản lý vòng đời khép kín của các hành động CAPA từ OOS và Deviation.
- **Actor & Permission**: `QA_SPECIALIST`, `QA_MANAGER`, `Assignee`.
- **Components & Fields**: Bảng Kanban tiến độ hành động (Chờ làm, Đang làm, Đã nộp bằng chứng, Chờ thẩm tra hiệu quả); Form tải biên bản bằng chứng; Thẻ kiểm tra hiệu quả sau 3 tháng.

---

### SC-19: Hàng Đợi Thẩm Duyệt Công Việc (Approval Work Queue)

- **Purpose**: Màn hình trung tâm của QA Reviewer và QA Manager để xem toàn bộ các phiếu kiểm nghiệm, lô hàng, sai lệch đang chờ ký duyệt.
- **Actor & Permission**: `QA_REVIEWER`, `QA_MANAGER`, `QUALIFIED_PERSON`.
- **Components & Fields**: Bảng tác vụ chờ xử lý, Lọc theo loại đối tượng, Cảnh báo thời gian quá hạn SLA.
- **Actions**: Xem nhanh hồ sơ (Quick view), Mở Modal ký số điện tử (nhập mật khẩu và ý nghĩa ký).

---

### SC-20: Trình Tra Cứu Nhật Ký Kiểm Toán (ALCOA+ Audit Trail Viewer)

- **Purpose**: Tra cứu, lọc và trích xuất lịch sử biến động dữ liệu phục vụ thanh tra GMP.
- **Actor & Permission**: `QA_MANAGER`, `AUDITOR`, `SYSTEM_ADMIN`.
- **Components & Fields**:
  - Bộ lọc: Khoảng thời gian, Đối tượng (Lô, Phiếu, TCCS), Người thực hiện, Loại hành động.
  - Bảng dòng sự kiện (Timeline / Table).
  - Khối Diff so sánh trực quan: Giá trị cũ (đỏ gạch ngang) vs Giá trị mới (xanh lá).
  - Thanh trạng thái chuỗi khối mã băm: "Chuỗi toàn vẹn 100% (Cryptographically Verified)".
- **Forbidden UI Behavior**: Tuyệt đối không có nút Sửa hoặc Xóa trên màn hình này.

---

### SC-21: Mạng Lưới Phả Hệ Lô (Batch 360 Genealogy Graph)

- **Purpose**: Hiển thị sơ đồ mạng tương tác trực quan về dòng chảy phả hệ nguyên vật liệu cấu thành nên lô sản phẩm và ngược lại.
- **Actor & Permission**: Toàn bộ nhân sự.
- **Components & Fields**: Sơ đồ mạng tương tác (Graph / Tree Viewer) với các nút Lô nguyên liệu, Lô bán thành phẩm, Lô thành phẩm; Đánh dấu màu đỏ các nút có sự cố chất lượng.
- **Actions**: Thu phóng (Zoom/Pan), Click vào nút để xem chi tiết đối tượng, Xuất sơ đồ phả hệ (SVG/PDF).

---

### SC-22: Hồ Sơ Lịch Sử Sản Phẩm (Product 360 History)

- **Purpose**: Xem toàn bộ lịch sử sản xuất của một sản phẩm qua các năm, tỷ lệ lô đạt/hỏng, sự cố OOS và thay đổi công thức.
- **Actor & Permission**: Toàn bộ nhân sự.
- **Components & Fields**: Thẻ chỉ số tổng hợp vòng đời, Biểu đồ năng lực sản xuất, Danh sách các cải tiến kỹ thuật đã thực hiện.

---

### SC-23: Phân Tích Xu Hướng Thống Kê (SPC Trend Analysis Dashboard)

- **Purpose**: Vẽ biểu đồ kiểm soát quá trình (Shewhart Control Charts) cho các chỉ tiêu định lượng trọng yếu và tự động phát hiện trôi dạt dữ liệu theo quy tắc Nelson.
- **Actor & Permission**: `QC_MANAGER`, `QA_MANAGER`, `RND_SPECIALIST`.
- **Components & Fields**: Biểu đồ đường Shewhart với các đường giới hạn ($UCL, LCL, UWL, LWL, \bar{X}, USL, LSL$), Điểm đo vi phạm được đánh dấu chấm tròn đỏ nhấp nháy kèm hộp giải thích quy tắc vi phạm.

---

### SC-24: Trợ Lý AI Ánh Xạ Chỉ Tiêu & Soạn Thảo (AI OCR & Mapping Assistant)

- **Purpose**: Hỗ trợ Kỹ thuật viên tải ảnh chụp/scan phiếu kiểm nghiệm gốc của nhà cung cấp và gợi ý ghép trường vào TCCS tự động.
- **Actor & Permission**: Toàn bộ nhân sự KCS.
- **Components & Fields**: Khung tải tệp ảnh/PDF, Khung xem trước văn bản OCR nhận diện, Bảng đối chiếu gợi ý từ AI (Trường gốc -> Chỉ tiêu đề xuất -> Điểm tin cậy).
- **Actions**: Bấm "Chấp nhận dòng này", "Sửa liên kết", "Áp dụng toàn bộ".
- **Forbidden UI Behavior**: Cấm tự động lưu vào database khi người dùng chưa bấm nút "Chấp nhận".

---

### SC-25: Cài Đặt Hệ Thống & Ma Trận Phân Quyền (System Settings & RBAC Matrix)

- **Purpose**: Quản lý tài khoản người dùng, gán vai trò quyền hạn và cấu hình các thông số bảo mật hệ thống.
- **Actor & Permission**: Chỉ `SYSTEM_ADMIN`.
- **Components & Fields**: Bảng danh sách người dùng, Modal gán vai trò (`ANALYST`, `QA_REVIEWER`, `QA_MANAGER`, `PRODUCTION`, `WAREHOUSE`), Bảng ma trận phân quyền tính năng.
- **Forbidden UI Behavior**: Cấm gán quyền can thiệp dữ liệu kiểm nghiệm hoặc ký duyệt xuất xưởng lô cho tài khoản `SYSTEM_ADMIN`.
