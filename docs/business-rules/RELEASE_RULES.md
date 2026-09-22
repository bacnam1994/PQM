# RELEASE_RULES: Danh Mục Quy Tắc Xuất Xưởng Lô Sản Phẩm (Batch Release Rules)

Tài liệu này chuẩn hóa toàn bộ 7 Cổng Kiểm Soát Xuất Xưởng (7 Release Gates) và các quy tắc kiểm soát nghiêm ngặt trước khi một lô thuốc/thực phẩm chức năng/nguyên liệu được phép xuất xưởng ra thị trường theo tiêu chuẩn GMP EU/WHO.

---

## 1. BR-REL-001: Ma Trận 7 Cổng Kiểm Soát Xuất Xưởng (7 Mandatory Release Gates)

- **Rule ID**: `BR-REL-001`
- **Purpose**: Đảm bảo không một lô sản phẩm nào có thể chuyển trạng thái sang `RELEASED` nếu không vượt qua đồng thời cả 7 Cổng kiểm soát chất lượng và tuân thủ pháp lý.
- **Actor**: `QA_Manager` (Trưởng phòng Đảm bảo Chất lượng) hoặc `QP` (Qualified Person / Người được ủy quyền xuất xưởng).
- **Trigger**: Khi người dùng nhấn nút "Quyết định Xuất xưởng" (Release Batch) trên màn hình thẩm định Lô.
- **Input**:
  - `batchId`: Mã lô sản phẩm.
  - `batchRecord`: Hồ sơ chi tiết lô sản xuất.
  - `testResults[]`: Danh sách toàn bộ kết quả kiểm nghiệm của lô.
  - `tccs`: Tiêu chuẩn cơ sở áp dụng cho lô.
  - `deviations[]`: Danh sách sai lệch liên quan tới lô.
  - `ooses[]`: Danh sách điều tra OOS liên quan tới lô.
  - `capas[]`: Danh sách hành động khắc phục phòng ngừa liên quan.
  - `bprStatus`: Trạng thái thẩm định Hồ sơ lô điện tử (Batch Production Record).
- **Preconditions**:
  - Lô đang ở trạng thái `TESTING` hoặc `QUARANTINE`.
  - Người thực hiện có quyền hạn xuất xưởng (`ROLE_QA_MANAGER` hoặc `ROLE_QP`).
- **Decision Logic**:
  Hệ thống chạy thuật toán tự động kiểm tra lần lượt 7 Release Gates (Fail-Fast: nếu bất kỳ cổng nào thất bại, lô bị chặn xuất xưởng ngay lập tức):
  1. **Gate 1 (Test Completeness Gate)**: 100% chỉ tiêu theo TCCS đã được kiểm nghiệm, không còn chỉ tiêu nào ở trạng thái `PENDING` hay `UNTESTED`. Nếu có chỉ tiêu thay thế (alternate criteria), phải thỏa mãn quy tắc thay thế hợp lệ (BR-ALT-001).
  2. **Gate 2 (Quality Evaluation Gate)**: Đánh giá chất lượng chuẩn tắc của Lô (`CanonicalStatusResolver.resolveBatchQuality`) trả về kết quả `PASS`. Không có bất kỳ chỉ tiêu nào có kết luận `FAIL`.
  3. **Gate 3 (OOS Resolution Gate)**: Toàn bộ phiếu điều tra OOS liên quan đến lô phải ở trạng thái `CLOSED` với kết luận nguyên nhân rõ ràng và được QA phê duyệt. Nếu OOS kết luận do sản phẩm không đạt chất lượng thì lô bị chặn vĩnh viễn.
  4. **Gate 4 (Deviation Closure Gate)**: Toàn bộ sai lệch (Deviation) xảy ra trong quá trình sản xuất và kiểm nghiệm lô phải được đóng (`status = 'CLOSED'`) hoặc được QA chấp thuận bằng đánh giá rủi ro (Risk Assessment) với mức độ rủi ro chấp nhận được.
  5. **Gate 5 (CAPA Gate)**: Mọi CAPA khẩn cấp (Immediate Action / Containment) gắn với lô này phải hoàn thành xác minh.
  6. **Gate 6 (BPR Review Gate)**: Hồ sơ sản xuất lô (BPR - Batch Production Record) và hồ sơ đóng gói đã được QA sản xuất thẩm tra hoàn tất và ký xác nhận đạt yêu cầu (`bprStatus === 'APPROVED'`).
  7. **Gate 7 (CoA & Regulatory Gate)**: Dự thảo Phiếu kiểm nghiệm (CoA) đã được tạo, dữ liệu chữ ký số của Kỹ thuật viên và QA Reviewer đã hợp lệ, hạn sử dụng và số đăng ký lưu hành còn hiệu lực.
- **Decision Table**:

| Gate   | Tiêu chí kiểm tra             | Điều kiện Đạt                        | Điều kiện Không đạt (Hành động chặn)                                |
| :----- | :---------------------------- | :----------------------------------- | :------------------------------------------------------------------ |
| **G1** | Tính đầy đủ của phép thử      | 100% chỉ tiêu đã kiểm nghiệm         | Thiếu chỉ tiêu -> Chặn: `ERR_TEST_INCOMPLETE`                       |
| **G2** | Đánh giá chất lượng chuẩn tắc | `batchQualityStatus === 'PASS'`      | `FAIL` hoặc `PENDING` -> Chặn: `ERR_QUALITY_NOT_PASS`               |
| **G3** | Xử lý OOS                     | 100% OOS đã `CLOSED` hợp lệ          | Có OOS đang mở (`OPEN`, `INVESTIGATING`) -> Chặn: `ERR_OOS_PENDING` |
| **G4** | Xử lý Sai lệch (Deviation)    | Không có Major/Critical Deviation mở | Có Deviation mở chưa thẩm định -> Chặn: `ERR_DEV_PENDING`           |
| **G5** | Xử lý CAPA                    | Không có CAPA chặn xuất xưởng        | Có CAPA chặn -> Chặn: `ERR_CAPA_BLOCKING`                           |
| **G6** | Thẩm tra Hồ sơ sản xuất (BPR) | `bprReviewStatus === 'APPROVED'`     | BPR chưa duyệt -> Chặn: `ERR_BPR_NOT_APPROVED`                      |
| **G7** | Chữ ký số & Pháp lý           | Đầy đủ chữ ký KCS/QA, SĐK còn hạn    | Thiếu chữ ký / Hết hạn -> Chặn: `ERR_SIGNATURE_MISSING`             |

- **Output**:
  - Nếu thỏa mãn cả 7 Gates: Cho phép chuyển trạng thái lô sang `RELEASED`. Cấp mã phát hành chính thức (`ReleaseCertificateNumber`).
  - Nếu vi phạm bất kỳ Gate nào: Trả về danh sách lỗi chặn chi tiết (`blockingReasons[]`), giữ nguyên trạng thái lô.
- **State Transition**: `TESTING` / `QUARANTINE` -> `RELEASED` (Nếu Đạt) hoặc giữ nguyên/chuyển `REJECTED` (Nếu từ chối).
- **UI Behavior**:
  - Hiển thị danh sách checklist trực quan gồm 7 cổng kiểm soát với biểu tượng Xanh (Passed) / Đỏ (Blocked) / Vàng (Pending).
  - Nút "Xuất xưởng" (Release) bị disabled kèm tooltip giải thích lý do cụ thể nếu 7 cổng chưa xanh 100%.
  - Khi người dùng đủ điều kiện click Release, mở hộp thoại xác thực chữ ký điện tử 2 lớp (Mật khẩu + Lý do phát hành).
- **Report / CoA Behavior**: Khi đã `RELEASED`, CoA được đóng dấu watermark "OFFICIAL RELEASE / CHÍNH THỨC" kèm số phát hành và mã QR xác thực.
- **Audit Requirement**: Ghi vết chi tiết vào Audit Trail: ID người xuất xưởng, thời điểm chính xác (ISO 8601), danh sách trạng thái của cả 7 Gate tại thời điểm quyết định, mã băm sha-256 của hồ sơ lô.
- **Forbidden Behavior**:
  - Tuyệt đối cấm can thiệp bỏ qua bất kỳ cổng kiểm soát nào bằng cờ ghi đè (bypass flag) ở tầng UI.
  - Tuyệt đối cấm xuất xưởng tạm thời khi OOS chưa đóng ("Release under concession" mà không có phê duyệt đặc biệt của Hội đồng Chất lượng theo quy trình riêng).
- **Exception Handling**: Trường hợp Khẩn cấp y tế quốc gia hoặc theo lệnh cơ quan quản lý (Emergency Release), phải kích hoạt quy trình phê duyệt đặc biệt có chữ ký của Tổng giám đốc và Giám đốc chất lượng với biên bản hội đồng chất lượng đính kèm.
- **Test Cases**:
  - `TC-REL-001-A`: Kiểm tra khi 6 Gate đạt nhưng còn 1 OOS đang điều tra thì nút Release bị khóa và thông báo lỗi `ERR_OOS_PENDING`.
  - `TC-REL-001-B`: Kiểm tra khi chỉ tiêu hoàn thành 100% và tất cả 7 Gate hợp lệ thì xuất xưởng thành công, cập nhật trạng thái `RELEASED`.

---

## 2. BR-REL-002: Lệnh Giữ Lại Hoặc Thu Hồi Lô Xuất Xưởng (Batch Hold & Recall Rule)

- **Rule ID**: `BR-REL-002`
- **Purpose**: Xử lý tình huống khẩn cấp khi phát hiện nguy cơ chất lượng sau khi lô đã được cấp phép xuất xưởng (`RELEASED`), nhằm cô lập sản phẩm ngay lập tức trên hệ thống và ngăn chặn xuất bán tiếp theo.
- **Actor**: `QA_Manager`, `Quality_Director`.
- **Trigger**: Khi nhận được khiếu nại khách hàng nghiêm trọng, cảnh báo từ cơ quan quản lý (Bộ Y tế/Cục Quản lý Dược) hoặc phát hiện sai lệch hồi cứu.
- **Input**:
  - `batchId`: Mã lô sản phẩm.
  - `actionType`: `HOLD` (Tạm dừng lưu thông) hoặc `RECALL` (Thu hồi sản phẩm).
  - `recallClass`: Cấp độ thu hồi (Cấp I: Đe dọa tính mạng; Cấp II: Ảnh hưởng sức khỏe tạm thời; Cấp III: Vi phạm nhãn mác/hành chính).
  - `reason`: Bắt buộc giải trình nguyên nhân cụ thể.
- **Preconditions**:
  - Lô đang ở trạng thái `RELEASED`.
  - Người thực hiện là Quản lý chất lượng cấp cao.
- **Decision Logic**:
  - Lập tức chuyển trạng thái lô từ `RELEASED` sang `HOLD` hoặc `RECALLED`.
  - Tự động hủy bỏ hiệu lực tra cứu công khai của CoA tương ứng (trạng thái CoA chuyển sang `SUSPENDED` hoặc `REVOKED`).
  - Gửi thông báo khẩn cấp (Push Notification / Email) tới bộ phận Kho vận (Warehouse) để phong tỏa hàng tồn kho thực tế, và bộ phận Bán hàng để dừng xuất hóa đơn.
- **Decision Table**:

| Trạng thái ban đầu | Quyết định can thiệp        | Cấp độ           | Trạng thái mới của Lô | Hiệu lực CoA                 |
| :----------------- | :-------------------------- | :--------------- | :-------------------- | :--------------------------- |
| `RELEASED`         | Giữ lại thẩm tra (`HOLD`)   | Nội bộ           | `HOLD`                | Tạm đình chỉ (`SUSPENDED`)   |
| `RELEASED`         | Thu hồi khẩn cấp (`RECALL`) | Cấp I / II / III | `RECALLED`            | Thu hồi hiệu lực (`REVOKED`) |

- **Output**:
  - `batch.status`: Chuyển thành `HOLD` hoặc `RECALLED`.
  - `batch.recallInfo`: Lưu thông tin lý do, cấp độ, người ra quyết định, thời gian.
  - `coa.status`: Chuyển thành `REVOKED` / `SUSPENDED`.
- **State Transition**: `RELEASED` -> `HOLD` hoặc `RECALLED`.
- **UI Behavior**:
  - Toàn bộ giao diện hiển thị cảnh báo viền đỏ nhấp nháy hoặc biểu tượng Stop lớn.
  - Tất cả các thao tác in phiếu, giao nhận đều bị khóa cứng.
- **Report / CoA Behavior**: Khi in hoặc quét mã QR sẽ hiển thị thông báo "CẢNH BÁO: LÔ ĐÃ BỊ THU HỒI / ĐÌNH CHỈ LƯU HÀNH".
- **Audit Requirement**: Nhật ký ghi nhận sự kiện khẩn cấp với độ ưu tiên cao nhất trong Audit Trail.
- **Forbidden Behavior**: Tuyệt đối cấm khôi phục trạng thái `RELEASED` từ `RECALLED` mà không có quyết định bằng văn bản được tải lên hệ thống.
- **Exception Handling**: Nếu hệ thống ngoại vi kho vận không nhận được tín hiệu tức thời, phải kích hoạt cờ cảnh báo retry liên tục đến khi kho nhận lệnh thành công.
- **Test Cases**:
  - `TC-REL-002-A`: Thực hiện lệnh Hold trên lô đã Released thành công, CoA bị vô hiệu hóa tức thì.
  - `TC-REL-002-B`: Không thể gán lệnh Recall nếu lý do giải trình để trống.
