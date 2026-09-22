# COA_RULES: Danh Mục Quy Tắc Phiếu Kiểm Nghiệm (Certificate of Analysis Rules)

Tài liệu này chuẩn hóa toàn bộ các quy tắc nghiệp vụ liên quan đến việc tạo, hiển thị, xuất bản, in ấn và pháp lý của Phiếu kiểm nghiệm (CoA) theo tiêu chuẩn Dược điển và GMP.

---

## 1. BR-COA-001: Quy Tắc Bất Biến Của CoA - Snapshot Duy Nhất & Cấm Tự Evaluate (CoA Immutability & Snapshot Rule)

- **Rule ID**: `BR-COA-001`
- **Purpose**: Đảm bảo Phiếu Kiểm Nghiệm (CoA) là một chứng thư chất lượng bất biến (Immutable Document), chỉ phản ánh đúng dữ liệu tại thời điểm phê duyệt thông qua Snapshot, tuyệt đối không tự tính toán hay tự đánh giá chất lượng (No Self-Evaluation).
- **Actor**: `System` (Tự động hóa), `QA_Manager` (Người ký duyệt xuất bản).
- **Trigger**: Khi Lô sản phẩm hoàn tất phê duyệt hoặc chuyển sang trạng thái sẵn sàng phát hành CoA.
- **Input**:
  - `batchId`: Mã lô sản phẩm.
  - `batchData`: Thông tin hành chính của lô (Tên SP, Dạng bào chế, Quy cách, Số lô, Ngày SX, Hạn dùng, Số ĐKSP).
  - `canonicalEvaluation`: Kết quả đánh giá chuẩn tắc từ `CanonicalStatusResolver` (không do CoA tự tính).
  - `approvedTestResults[]`: Danh sách kết quả kiểm nghiệm đã được phê duyệt (`status === 'APPROVED'`).
  - `appliedTccs`: Phiên bản TCCS có hiệu lực tương ứng.
- **Preconditions**:
  - Toàn bộ kết quả kiểm nghiệm đưa vào CoA phải ở trạng thái `APPROVED`.
  - Kết quả đánh giá chuẩn tắc của Lô phải là `PASS` (nếu phát hành CoA Đạt) hoặc có kết luận chính thức của Hội đồng QA (nếu phát hành phiếu Không Đạt).
- **Decision Logic**:
  - Module tạo CoA nhận đầu vào là một bản Snapshot đóng băng toàn bộ dữ liệu:
    - Bắt buộc lưu trữ: `snapshotTimestamp`, `tccsVersion`, `testResultsSnapshot`, `signersSnapshot`.
    - Tính toán mã băm mật mã học (`coaHash = SHA256(snapshotData)`).
  - **NGUYÊN TẮC CẤM TỰ EVALUATE**: Module hiển thị/in CoA chỉ đóng vai trò Trình bày dữ liệu (Presentation Layer). Nghiêm cấm mọi logic so sánh giá trị min/max, kiểm tra quy chuẩn hay tự kết luận "ĐẠT/KHÔNG ĐẠT" bên trong template CoA. CoA phải lấy kết luận trực tiếp từ trường `conclusion` trong Snapshot đã được phê duyệt.
- **Decision Table**:

| Điều kiện nguồn dữ liệu                         | Hành vi tạo Snapshot CoA                       | Mã băm toàn vẹn SHA-256             | Hiệu lực pháp lý                         |
| :---------------------------------------------- | :--------------------------------------------- | :---------------------------------- | :--------------------------------------- |
| Có kết quả chưa duyệt (`status !== 'APPROVED'`) | **TỪ CHỐI TẠO** (`ERR_COA_UNAPPROVED_RESULTS`) | Không sinh                          | Vô giá trị                               |
| Kết quả kiểm nghiệm bị thay đổi sau khi tạo CoA | Bản in CoA giữ nguyên Snapshot ban đầu         | Cảnh báo sai lệch hash nếu kiểm tra | Đòi hỏi phát hành bản sửa đổi (Revision) |
| Đầy đủ kết quả `APPROVED`, có chữ ký số         | **TẠO THÀNH CÔNG** Snapshot đóng băng          | Sinh mã băm hợp lệ                  | Hợp pháp                                 |

- **Output**:
  - Bản ghi `CoARecord`: Chứa dữ liệu Snapshot bất biến, `coaNumber`, `issueDate`, `coaHash`, `qrCodeUrl`.
- **State Transition**: `DRAFT` -> `PUBLISHED` -> `ARCHIVED` (hoặc `REVOKED` nếu bị thu hồi).
- **UI Behavior**:
  - Màn hình xem CoA hiển thị trung thực nguyên văn dữ liệu từ Snapshot.
  - Hiển thị Watermark cảnh báo "BẢN THỬ NGHIỆM / DRAFT" nếu CoA chưa được ký phát hành chính thức.
  - Khi đã phát hành, giao diện khóa toàn bộ thao tác chỉnh sửa dữ liệu trên trang CoA.
- **Report / CoA Behavior**:
  - Hiển thị đầy đủ thông tin hành chính của cơ sở sản xuất, số công bố, tiêu chuẩn áp dụng (Dược điển VN / Tiêu chuẩn cơ sở).
  - In kèm mã QR truy xuất nguồn gốc chứa URL tra cứu bảo mật tích hợp mã băm SHA-256.
- **Audit Requirement**: Lưu vết thời điểm tạo CoA, người phát hành, phiên bản TCCS áp dụng, mã băm văn bản.
- **Forbidden Behavior**:
  - Tuyệt đối cấm viết code dạng: `if (result.value >= min && result.value <= max) render("ĐẠT")` bên trong template CoA.
  - Tuyệt đối cấm cho phép sửa tay (free text edit) kết quả kiểm nghiệm trực tiếp trên giao diện in CoA.
- **Exception Handling**: Nếu phát hiện sai sót chính tả thông tin hành chính (ví dụ sai quy cách đóng gói), bắt buộc tạo CoA Revision mới (`Revision 01`, `Revision 02`) kèm ghi chú lý do sửa đổi, không sửa trực tiếp vào Snapshot cũ.
- **Test Cases**:
  - `TC-COA-001-A`: Đảm bảo khi dữ liệu kết quả kiểm nghiệm trong cơ sở dữ liệu bị cập nhật sau thời điểm ký, nội dung CoA đã xuất bản không bị biến đổi theo (Bất biến).
  - `TC-COA-001-B`: Kiểm tra template in CoA không chứa hàm tính toán logic chất lượng.

---

## 2. BR-COA-002: Quy Tắc Hiển Thị Chú Thích Pháp Lý & Chỉ Tiêu Thay Thế Trên CoA (CoA Footnote & Alternate Display Rule)

- **Rule ID**: `BR-COA-002`
- **Purpose**: Quy định cách thức thể hiện các trường hợp đặc biệt trên phiếu kiểm nghiệm như chỉ tiêu được thay thế hợp lệ, kiểm nghiệm định kỳ/ngoại kiểm theo đúng quy chuẩn Dược điển.
- **Actor**: `System` (Tự động biên tập).
- **Trigger**: Khi render bảng kết quả kiểm nghiệm trên CoA.
- **Input**:
  - `testResults[]`: Danh sách kết quả trên phiếu.
  - `appliedAlternateRules[]`: Các quy tắc chỉ tiêu thay thế đã được kích hoạt và phê duyệt.
- **Preconditions**: Bản ghi CoA đã được phê duyệt.
- **Decision Logic**:
  - Khi một chỉ tiêu được miễn thử hoặc thay thế hợp lệ (ví dụ: Miễn thử Giới hạn nhiễm khuẩn theo BR-ALT-001 do nguyên liệu vô trùng hoặc thử nghiệm luân phiên có phê duyệt):
    - Cột "Kết quả kiểm nghiệm" không được để trống hoặc ghi chung chung "Đạt", mà phải ghi rõ: `Theo quy định tại [Mã quy tắc/Văn bản]` hoặc `Miễn thử theo [Căn cứ pháp lý]`.
    - Phải tự động đánh dấu footnote `(*)` tại tên chỉ tiêu và in dòng giải trình pháp lý ở phần chân trang (Footnote section).
  - Chân trang CoA bắt buộc có câu tuyên bố pháp lý chuẩn mực:
    - _"Kết quả kiểm nghiệm này chỉ có giá trị đối với mẫu gửi tới kiểm nghiệm / mẫu đại diện cho lô sản xuất nói trên theo đúng quy trình lấy mẫu GMP."_
- **Decision Table**:

| Loại chỉ tiêu                                 | Trạng thái thực tế         | Cách hiển thị trên cột Kết quả                       | Chú thích chân trang (Footnote)                                                       |
| :-------------------------------------------- | :------------------------- | :--------------------------------------------------- | :------------------------------------------------------------------------------------ |
| Tiêu chuẩn thông thường                       | Đã kiểm nghiệm             | Hiển thị giá trị số hoặc kết luận định tính          | Không cần footnote đặc biệt                                                           |
| Chỉ tiêu thay thế hợp lệ                      | Thay thế bởi chỉ tiêu khác | Hiển thị giá trị chỉ tiêu thay thế kèm ký hiệu `(*)` | In rõ: `(*) Được áp dụng phương pháp/chỉ tiêu thay thế theo Quyết định số...`         |
| Chỉ tiêu thử nghiệm luân phiên (Skip testing) | Miễn thử theo quy trình    | Ghi nhận `Đạt theo quy chế luân phiên (*)`           | In rõ: `(*) Đạt tiêu chuẩn dựa trên xác nhận kiểm soát quá trình và kết quả lô số...` |

- **Output**: Bảng dữ liệu CoA hoàn chỉnh kèm khối Footnote pháp lý minh bạch.
- **State Transition**: Không áp dụng (Display format rule).
- **UI Behavior**: Hiển thị rõ ràng các dấu sao tham chiếu và khối chú giải chân trang trên bản xem trước (Preview).
- **Report / CoA Behavior**: Xuất file PDF hoặc in giấy giữ nguyên vị trí layout, không bị nhảy trang gây mất footnote.
- **Audit Requirement**: Bản ghi Snapshot phải lưu cả nội dung text của các chú thích footnote tương ứng tại thời điểm phát hành.
- **Forbidden Behavior**: Tuyệt đối cấm hiển thị kết quả giả lập (phịa số liệu) đối với các chỉ tiêu được miễn thử hoặc thay thế.
- **Exception Handling**: Nếu nội dung footnote quá dài vượt khung trang, phải tự động co dãn cỡ chữ theo tiêu chuẩn thẩm mỹ đã được quy định hoặc ngắt trang có tiêu đề tiếp theo (Header continue).
- **Test Cases**:
  - `TC-COA-002-A`: Kiểm tra lô có chỉ tiêu thay thế phải có footnote `(*)` giải trình tương ứng ở cuối phiếu.
  - `TC-COA-002-B`: Kiểm tra câu kết luận pháp lý chân trang luôn luôn hiện diện trên mọi mẫu in CoA.
