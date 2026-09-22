# APPROVAL_RULES: Danh Mục Quy Tắc Nghiệp Vụ Phê Duyệt & Thẩm Định (Approval Rules)

Tài liệu này chuẩn hóa toàn bộ các quy tắc nghiệp vụ liên quan đến chu trình thẩm định (review) và phê duyệt (approval) kết quả kiểm nghiệm, phiếu kiểm nghiệm và quyết định chất lượng lô theo tiêu chuẩn GMP/GLP và 21 CFR Part 11.

---

## 1. BR-APP-001: Luồng Thẩm Định & Phê Duyệt Phiếu Kiểm Nghiệm Đa Cấp (Multi-Level Test Result Approval)

- **Rule ID**: `BR-APP-001`
- **Purpose**: Đảm bảo kết quả kiểm nghiệm phải trải qua đúng trình tự luồng 3 bước: Kỹ thuật viên (Tester/Analyst nhập kết quả) -> Trưởng nhóm KCS/QA Reviewer (Thẩm định/Kiểm tra) -> Trưởng phòng QA / Giám đốc CL (Phê duyệt). Không được nhảy cóc bước thẩm định.
- **Actor**: `Analyst` (Tester), `QA_Reviewer` (Trưởng nhóm kiểm tra/QA), `QA_Manager` (Trưởng phòng QA).
- **Trigger**: Khi Kỹ thuật viên hoàn tất nhập liệu và bấm "Nộp kết quả thẩm định" (Submit for Review), hoặc khi QA Reviewer xác nhận kết quả đạt chuẩn và bấm "Chuyển phê duyệt" (Forward for Approval).
- **Input**:
  - `testResultId`: ID của kết quả/phiếu kiểm nghiệm.
  - `currentStatus`: Trạng thái hiện tại của kết quả (`DRAFT`, `SUBMITTED`, `REVIEWED`, `APPROVED`, `REJECTED`).
  - `evaluationStatus`: Trạng thái đánh giá chất lượng tiêu chuẩn (`PASS`, `FAIL`, `PENDING`).
  - `reviewerId`: ID người dùng thực hiện thẩm định/phê duyệt.
  - `comments`: Nhận xét/ghi chú thẩm định (bắt buộc nếu từ chối).
- **Preconditions**:
  - Đối với nộp thẩm định (`SUBMIT`): Tất cả các trường dữ liệu bắt buộc (numeric/text result, raw data, test date, analyst id) đã điền đầy đủ; không còn ở trạng thái nhập dở dang.
  - Đối với thẩm định (`REVIEW`): Trạng thái phiếu phải là `SUBMITTED`; Người thẩm định không được trùng với Người phân tích (`reviewerId !== analystId` - Segregation of Duties).
  - Đối với phê duyệt (`APPROVE`): Trạng thái phiếu phải là `REVIEWED`; Phiếu không vướng OOS đang mở (`unresolved OOS = 0`); Người phê duyệt phải có vai trò `QA_Manager`.
- **Decision Logic**:
  - Kỹ thuật viên sau khi hoàn thành phép thử chuyển trạng thái từ `DRAFT` sang `SUBMITTED`. Lúc này kết quả bị khóa sửa chữa cục bộ (`lockedForEdit = true`).
  - QA Reviewer kiểm tra tính toàn vẹn dữ liệu:
    - Nếu dữ liệu hợp lệ: Duyệt chuyển trạng thái lên `REVIEWED`.
    - Nếu dữ liệu sai sót hoặc thiếu bằng chứng: Chuyển về `REJECTED` kèm lý do bắt buộc, mở khóa cho Kỹ thuật viên sửa và nộp lại kèm Audit log lý do từ chối.
  - QA Manager xem xét phiếu ở trạng thái `REVIEWED`:
    - Nếu đồng thuận: Ký số điện tử duyệt chuyển thành `APPROVED`.
    - Nếu từ chối: Chuyển về `REJECTED` kèm lý do.
- **Decision Table**:

| Trạng thái hiện tại | Thao tác    | Vai trò thực hiện | Điều kiện kiểm tra        | Trạng thái mới | Khóa dữ liệu                                  |
| :------------------ | :---------- | :---------------- | :------------------------ | :------------- | :-------------------------------------------- |
| `DRAFT`             | Submit      | `Analyst`         | Đủ số liệu phép thử       | `SUBMITTED`    | YES (Tester không sửa được trừ khi bị reject) |
| `SUBMITTED`         | Review Pass | `QA_Reviewer`     | `reviewerId != analystId` | `REVIEWED`     | YES                                           |
| `SUBMITTED`         | Reject      | `QA_Reviewer`     | Bắt buộc nhập lý do       | `REJECTED`     | NO (Tester được sửa lại)                      |
| `REVIEWED`          | Approve     | `QA_Manager`      | Hợp lệ, không OOS mở      | `APPROVED`     | YES (Khóa vĩnh viễn)                          |
| `REVIEWED`          | Reject      | `QA_Manager`      | Bắt buộc nhập lý do       | `REJECTED`     | NO (Hoàn trả luồng)                           |
| `APPROVED`          | Sửa đổi     | Bất kỳ            | Đã phê duyệt              | BỊ CẤM         | Không thể sửa trực tiếp                       |

- **Output**:
  - `testResult.approvalStatus`: Cập nhật trạng thái mới.
  - `testResult.reviewHistory[]`: Thêm bản ghi audit gồm `step`, `actorId`, `actorRole`, `timestamp`, `action`, `comment`.
- **State Transition**: `DRAFT` -> `SUBMITTED` -> `REVIEWED` -> `APPROVED` (hoặc rẽ nhánh sang `REJECTED`).
- **UI Behavior**:
  - Hiển thị timeline tiến trình thẩm duyệt rõ ràng (Draft -> Chờ thẩm định -> Chờ phê duyệt -> Đã duyệt).
  - Ẩn/vô hiệu hóa các nút "Duyệt" đối với người dùng không có phân quyền hoặc chính người tạo kết quả (ngăn chặn tự duyệt).
  - Bật popup yêu cầu mật khẩu / chữ ký số và lý do khi bấm Duyệt hoặc Từ chối.
- **Report / CoA Behavior**: Chỉ các kết quả có trạng thái `APPROVED` mới được phép đưa vào tính toán tổng hợp cho CoA chính thức.
- **Audit Requirement**: Ghi nhận đầy đủ nhật ký kiểm toán ALCOA+: Thời gian thực hiện, ID người thực hiện, vai trò, hành vi (`SUBMIT`, `REVIEW_PASS`, `REVIEW_REJECT`, `APPROVE`, `APPROVE_REJECT`), lý do giải trình.
- **Forbidden Behavior**:
  - Nghiêm cấm Tester tự thẩm định hoặc tự phê duyệt kết quả của chính mình.
  - Nghiêm cấm phê duyệt vượt cấp (từ `SUBMITTED` nhảy thẳng sang `APPROVED` bỏ qua bước `QA_Reviewer`).
  - Nghiêm cấm phê duyệt kết quả khi đang có cuộc điều tra OOS liên quan chưa đóng (`status !== 'CLOSED'`).
- **Exception Handling**: Khi có sự cố khẩn cấp (nhân sự vắng mặt dài hạn có giấy ủy quyền), Quản trị viên hệ thống có thể gán quyền Đại diện thẩm định (Proxy Reviewer) nhưng phải ghi nhận rõ ràng vào audit log lý do ủy quyền.
- **Test Cases**:
  - `TC-APP-001-A`: Kiểm tra Tester không thể tự bấm Duyệt kết quả của mình.
  - `TC-APP-001-B`: Kiểm tra không thể Approve phiếu khi trạng thái đang là `SUBMITTED` (chưa qua `REVIEWED`).
  - `TC-APP-001-C`: Kiểm tra khi bấm Reject mà không nhập lý do thì hệ thống báo lỗi chặn lại.

---

## 2. BR-APP-002: Quy Tắc Thu Hồi Hoặc Hủy Bỏ Phê Duyệt (Revocation / Invalidation Rule)

- **Rule ID**: `BR-APP-002`
- **Purpose**: Quy định thủ tục nghiêm ngặt khi cần hủy bỏ hoặc thu hồi một kết quả/phiếu đã được phê duyệt (`APPROVED`) do phát hiện sai sót thiết bị, thuốc thử hỏng hoặc gian lận dữ liệu.
- **Actor**: `QA_Manager` hoặc `Quality_Director`.
- **Trigger**: Khi có văn bản yêu cầu mở lại thẩm định hoặc phát hiện sai lệch nghiêm trọng sau khi đã duyệt.
- **Input**:
  - `targetRecordId`: ID phiếu kiểm nghiệm hoặc quyết định lô.
  - `reasonForRevocation`: Lý do thu hồi (tối thiểu 30 ký tự giải trình chi tiết kỹ thuật).
  - `approverCredentials`: Mật khẩu/xác thực cấp 2 của QA Manager.
- **Preconditions**:
  - Bản ghi đang ở trạng thái `APPROVED`.
  - Nếu lô hàng liên quan đã được Xuất xưởng (`RELEASED`), KHÔNG ĐƯỢC hủy duyệt kết quả kiểm nghiệm nếu chưa có Lệnh Thu hồi lô (`BATCH_RECALL`) hoặc Giữ lại lô (`BATCH_HOLD`).
- **Decision Logic**:
  - Không bao giờ xóa bản ghi cũ khỏi cơ sở dữ liệu.
  - Đánh dấu trạng thái phiếu cũ là `REVOKED` hoặc `INVALIDATED`.
  - Tạo phiên bản mới (`revisionNumber = currentRevision + 1`) ở trạng thái `DRAFT` kế thừa các thông tin chưa bị vô hiệu để KCS thực hiện kiểm nghiệm lại hoặc điều chỉnh.
  - Kích hoạt thông báo cảnh báo tức thời tới Giám đốc chất lượng và phòng ban liên quan.
- **Decision Table**:

| Trạng thái hiện tại của Lô | Trạng thái phiếu | Thao tác           | Quyền        | Hành vi hệ thống                                                    |
| :------------------------- | :--------------- | :----------------- | :----------- | :------------------------------------------------------------------ |
| `RELEASED`                 | `APPROVED`       | Yêu cầu hủy duyệt  | Bất kỳ       | **BỊ TỪ CHỐI** (Phải đưa Lô về `HOLD` hoặc `RECALLED` trước)        |
| `TESTING` / `HOLD`         | `APPROVED`       | Hủy duyệt (Revoke) | `QA_Manager` | Đánh dấu `REVOKED`, tạo Version mới ở dạng `DRAFT`, lưu Audit trail |

- **Output**:
  - `testResult.status`: Chuyển thành `REVOKED`.
  - Tạo `newTestResult` với version mới.
  - Phát sinh thông báo cảnh báo `CRITICAL_QUALITY_EVENT`.
- **State Transition**: `APPROVED` -> `REVOKED`.
- **UI Behavior**: Hiển thị tem cảnh báo màu đỏ "KẾT QUẢ ĐÃ BỊ THU HỒI / VÔ HIỆU HÓA", hiển thị lý do thu hồi và đường link dẫn tới phiếu phiên bản mới.
- **Report / CoA Behavior**: CoA lập tức bị thu hồi hiệu lực pháp lý, không thể in lại hoặc xuất bản CoA dựa trên phiếu đã bị Revoke.
- **Audit Requirement**: Bắt buộc lưu vết kiểm toán vĩnh viễn: Mã người thu hồi, thời điểm, lý do chi tiết, chữ ký số xác nhận hủy.
- **Forbidden Behavior**: Tuyệt đối cấm cập nhật đè (overwrite in-place) hoặc xóa trắng bản ghi cũ.
- **Exception Handling**: Nếu mất kết nối mạng giữa chừng khi thu hồi, hệ thống phải rollback toàn bộ giao dịch để tránh tình trạng dữ liệu mồ côi.
- **Test Cases**:
  - `TC-APP-002-A`: Hủy duyệt phiếu của Lô đã xuất xưởng (`RELEASED`) phải bị chặn đứng và báo lỗi.
  - `TC-APP-002-B`: Hủy duyệt thành công tạo ra bản sao Revision tiếp theo và gắn nhãn `REVOKED` cho bản cũ.
