# RBAC_RULES: Danh Mục Quy Tắc Phân Quyền & Kiểm Soát Truy Cập (Role-Based Access Control Rules)

Tài liệu này chuẩn hóa toàn bộ các quy tắc nghiệp vụ về Phân quyền theo vai trò (RBAC) và Nguyên tắc Tách biệt Trách nhiệm (Segregation of Duties - SoD) theo tiêu chuẩn Thực hành Tốt Sản xuất Thuốc (GMP) và Quy định Quản lý Dữ liệu Dược phẩm.

---

## 1. BR-RBC-001: Ma Trận Phân Quyền Vai Trò Chuẩn Tắc (Canonical RBAC Matrix)

- **Rule ID**: `BR-RBC-001`
- **Purpose**: Đảm bảo người dùng chỉ được phép truy cập, chỉnh sửa và thực thi các nghiệp vụ đúng theo vai trò và thẩm quyền được phân công trong hệ thống chất lượng.
- **Actor**: Toàn bộ người dùng thuộc các nhóm vai trò: `ANALYST` (Kỹ thuật viên KCS), `QA_REVIEWER` (Kiểm tra chất lượng), `QA_MANAGER` (Trưởng phòng QA), `PRODUCTION` (Khối Sản xuất), `WAREHOUSE` (Kho vận), `SYSTEM_ADMIN` (Quản trị hệ thống).
- **Trigger**: Mỗi khi người dùng yêu cầu truy cập màn hình, gọi API hoặc thực hiện thao tác nghiệp vụ.
- **Input**:
  - `userRole`: Vai trò hiện tại của người dùng.
  - `targetResource`: Tài nguyên cần thao tác (ví dụ: `Batch`, `TestResult`, `TCCS`, `Product`, `CoA`, `AuditLog`).
  - `action`: Thao tác mong muốn (`CREATE`, `READ`, `UPDATE`, `DELETE_LOGIC`, `REVIEW`, `APPROVE`, `RELEASE`, `SIGN`).
- **Preconditions**: Người dùng đã xác thực danh tính thành công (Authenticated Session) và tài khoản đang ở trạng thái Hoạt động (`ACTIVE`).
- **Decision Logic**:
  Hệ thống đối chiếu với Ma trận Phân quyền Cốt lõi:
  - `ANALYST`: Có quyền Tạo và Nhập kết quả kiểm nghiệm (`CREATE`, `UPDATE` khi ở trạng thái Draft). Chỉ có quyền Đọc các tài nguyên khác (TCCS, Batch, Product). KHÔNG có quyền Phê duyệt, KHÔNG có quyền Xuất xưởng, KHÔNG có quyền sửa TCCS.
  - `QA_REVIEWER`: Có quyền Thẩm tra kết quả kiểm nghiệm (`REVIEW`), Khởi tạo điều tra OOS, Báo cáo Sai lệch. Không có quyền Xuất xưởng lô.
  - `QA_MANAGER`: Có toàn quyền Phê duyệt kết quả (`APPROVE`), Phê duyệt TCCS, Quyết định Xuất xưởng lô (`RELEASE`), Thu hồi lô (`RECALL`), Phê duyệt CAPA.
  - `PRODUCTION`: Chỉ có quyền Đọc thông tin lô, Tạo yêu cầu kiểm nghiệm, Cập nhật trạng thái sản xuất. KHÔNG có quyền can thiệp dữ liệu kiểm nghiệm.
  - `WAREHOUSE`: Chỉ có quyền Cập nhật nhập/xuất kho vật lý, xem trạng thái Lô và CoA đã duyệt.
  - `SYSTEM_ADMIN`: Quản lý tài khoản, cấu hình hệ thống. **CẤM TUYỆT ĐỐI**: Admin không được can thiệp vào số liệu kiểm nghiệm hay tự duyệt chất lượng (Separation of IT and Business Authority).
- **Decision Table**:

| Nghiệp vụ / Tài nguyên             |  `ANALYST`   | `QA_REVIEWER` |  `QA_MANAGER`  | `PRODUCTION` | `WAREHOUSE` |   `ADMIN`   |
| :--------------------------------- | :----------: | :-----------: | :------------: | :----------: | :---------: | :---------: |
| Nhập kết quả kiểm nghiệm (Draft)   |    **CÓ**    |      Xem      |      Xem       |     Xem      |    Không    |    Không    |
| Thẩm định kết quả (Review)         |    Không     |    **CÓ**     |     **CÓ**     |    Không     |    Không    |    Không    |
| Phê duyệt kết quả (Approve)        |    Không     |     Không     |     **CÓ**     |    Không     |    Không    |    Không    |
| Tạo / Cập nhật TCCS                |     Soạn     |   Kiểm tra    |   **DUYỆT**    |     Xem      |    Không    |    Không    |
| Quyết định Xuất xưởng Lô (Release) |    Không     |     Không     |     **CÓ**     |    Không     |    Không    |    Không    |
| Quản lý Lệnh Thu hồi (Recall/Hold) |    Không     |   Khởi tạo    |   **DUYỆT**    |  Nhận lệnh   |  Nhận lệnh  |    Không    |
| Xem Audit Trail                    | Xem của mình |  Xem bộ phận  | **XEM TẤT CẢ** | Xem của mình |    Không    | Xem an ninh |
| Quản trị Tài khoản người dùng      |    Không     |     Không     |     Không      |    Không     |    Không    |   **CÓ**    |

- **Output**: Cho phép (`ALLOW`) hoặc Từ chối (`DENY` với mã `403 Forbidden`).
- **State Transition**: Không áp dụng.
- **UI Behavior**:
  - Tự động ẩn hoặc vô hiệu hóa các nút bấm, tab, menu điều hướng mà người dùng không có quyền truy cập.
  - Nếu người dùng cố tình nhập URL trực tiếp, điều hướng về trang thông báo lỗi "403 - Bạn không có thẩm quyền truy cập chức năng này".
- **Report / CoA Behavior**: Chỉ người có quyền mới được phép nhấn nút Ký duyệt phát hành CoA.
- **Audit Requirement**: Ghi nhận toàn bộ các lần cố gắng truy cập trái phép (`UNAUTHORIZED_ACCESS_ATTEMPT`) vào Security Log.
- **Forbidden Behavior**: Tuyệt đối cấm gán quyền can thiệp dữ liệu kiểm nghiệm và xuất xưởng cho tài khoản Quản trị viên IT (`SYSTEM_ADMIN`).
- **Exception Handling**: Khi người dùng bị hạ quyền hoặc khóa tài khoản trong lúc đang mở ứng dụng, phiên làm việc phải bị ngắt kết nối ngay lập tức tại request kế tiếp.
- **Test Cases**:
  - `TC-RBC-001-A`: Tài khoản vai trò `ANALYST` không thể gọi lệnh chuyển trạng thái Lô sang `RELEASED`.
  - `TC-RBC-001-B`: Tài khoản `SYSTEM_ADMIN` không thể sửa kết quả kiểm nghiệm của Lô.

---

## 2. BR-RBC-002: Nguyên Tắc Tách Biệt Trách Nhiệm Chống Xung Đột Quyền Lợi (Segregation of Duties - SoD Rule)

- **Rule ID**: `BR-RBC-002`
- **Purpose**: Đảm bảo không một cá nhân nào có thể đồng thời là người thực hiện và là người thẩm định/phê duyệt chính công việc của mình (Four-Eyes Principle / Ngăn ngừa gian lận dữ liệu).
- **Actor**: Toàn bộ người dùng thực hiện thao tác kiểm tra và phê duyệt.
- **Trigger**: Khi người dùng nhấn nút Thẩm định (`REVIEW`) hoặc Phê duyệt (`APPROVE`).
- **Input**:
  - `currentUserId`: Mã định danh người đang thực hiện duyệt.
  - `creatorId`: Mã định danh người nhập liệu/tạo bản ghi ban đầu.
  - `previousReviewerId`: Mã định danh người đã thẩm định ở bước trước đó.
- **Preconditions**: Bản ghi đang ở trạng thái chờ thẩm duyệt.
- **Decision Logic**:
  - **Quy tắc 1 (Cấm tự thẩm duyệt)**: `currentUserId !== creatorId`. Người nhập kết quả kiểm nghiệm tuyệt đối không thể tự bấm duyệt kết quả đó, kể cả khi người đó có tài khoản mang quyền Trưởng phòng.
  - **Quy tắc 2 (Tách biệt Thẩm định và Phê duyệt)**: `currentUserId !== previousReviewerId` đối với các quy trình trọng yếu (ví dụ: Xuất xưởng lô, Phê duyệt TCCS mới). Người đã kiểm tra hồ sơ không được là người ký phê duyệt cuối cùng (phải có ít nhất 2 người khác nhau tham gia kiểm soát).
  - **Quy tắc 3 (Tách biệt Sản xuất và Chất lượng)**: Nhân sự thuộc bộ phận Sản xuất không được kiêm nhiệm bất kỳ vai trò nào trong việc đánh giá và xuất xưởng chất lượng.
- **Decision Table**:

| Người tạo (`creatorId`) | Người thẩm định (`reviewerId`) | Người phê duyệt (`approverId`) | Kết quả phê duyệt                       | Phán quyết SoD                        |
| :---------------------- | :----------------------------- | :----------------------------- | :-------------------------------------- | :------------------------------------ |
| User A                  | User A                         | User B                         | **TỪ CHỐI** bước Thẩm định              | Vi phạm Quy tắc 1 (Tự thẩm định)      |
| User A                  | User B                         | User A                         | **TỪ CHỐI** bước Phê duyệt              | Vi phạm Quy tắc 1 (Tự phê duyệt)      |
| User A                  | User B                         | User B                         | **TỪ CHỐI** nếu quy trình yêu cầu 3 bên | Vi phạm Quy tắc 2 (Trùng lặp vai trò) |
| User A                  | User B                         | User C                         | **CHẤP THUẬN**                          | Tuân thủ 100% Nguyên tắc Bốn mắt      |

- **Output**: Cho phép tiếp tục luồng hoặc Ném ngoại lệ lỗi `ERR_SOD_VIOLATION`.
- **State Transition**: Không áp dụng.
- **UI Behavior**: Ẩn nút "Duyệt" và hiển thị dòng chữ ghi chú: "Bạn là người tạo bản ghi này, vui lòng để nhân sự kiểm tra khác thẩm duyệt".
- **Report / CoA Behavior**: Không áp dụng.
- **Audit Requirement**: Lưu vết vi phạm nếu người dùng cố gắng vượt rào SoD.
- **Forbidden Behavior**: Tuyệt đối cấm gán quyền gộp chung cả Tạo và Duyệt cho cùng một tài khoản trong môi trường vận hành thực tế.
- **Exception Handling**: Trong phòng thí nghiệm quy mô rất nhỏ (dưới 2 nhân sự) được cấp phép đặc biệt bởi cơ quan quản lý, phải kích hoạt chế độ "Solo Mode with Regulatory Exemption" kèm theo văn bản phê duyệt của Sở Y tế được lưu trên hệ thống.
- **Test Cases**:
  - `TC-RBC-002-A`: Một người dùng tạo kết quả kiểm nghiệm rồi cố gắng gọi API Approve chính kết quả đó sẽ nhận mã lỗi vi phạm SoD.
  - `TC-RBC-002-B`: Ba tài khoản riêng biệt thực hiện lần lượt Tạo -> Kiểm tra -> Duyệt được hệ thống phê chuẩn thành công.
