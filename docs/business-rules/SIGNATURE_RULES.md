# SIGNATURE_RULES: Danh Mục Quy Tắc Chữ Ký Điện Tử & Xác Thực (Electronic Signature Rules)

Tài liệu này chuẩn hóa toàn bộ các quy tắc nghiệp vụ về Chữ ký điện tử (Electronic Signature) tuân thủ tiêu chuẩn FDA 21 CFR Part 11 và Phụ lục 11 EU GMP, bao gồm cơ chế băm toàn vẹn dữ liệu (SHA-256 Checksum).

---

## 1. BR-SIG-001: Quy Chuẩn Chữ Ký Điện Tử 21 CFR Part 11 (Manifestation of Signatures)

- **Rule ID**: `BR-SIG-001`
- **Purpose**: Đảm bảo chữ ký điện tử trên hệ thống PQM có giá trị pháp lý tương đương chữ ký tay bằng mực, không thể chối bỏ (Non-repudiation), và gắn chặt không thể tách rời với dữ liệu được ký.
- **Actor**: `Analyst` (Người kiểm nghiệm), `QA_Reviewer` (Người kiểm tra), `QA_Manager` (Người duyệt xuất xưởng).
- **Trigger**: Khi người dùng thực hiện các hành động có tính chất cam kết pháp lý: Nộp kết quả kiểm nghiệm, Phê duyệt kết quả, Phê duyệt điều tra OOS, Phê duyệt CAPA, Quyết định Xuất xưởng lô hoặc Ban hành CoA.
- **Input**:
  - `signerId`: Mã định danh người ký.
  - `signerPassword`: Mật khẩu hoặc mã PIN xác thực chữ ký của người dùng.
  - `signatureMeaning`: Ý nghĩa chữ ký (ví dụ: "Tôi xác nhận đã kiểm nghiệm trung thực theo đúng quy trình", "Tôi xác nhận đã thẩm định dữ liệu gốc", "Tôi phê duyệt xuất xưởng lô").
  - `documentPayload`: Toàn bộ nội dung dữ liệu cần ký.
- **Preconditions**:
  - Tài khoản người ký đang ở trạng thái hoạt động (`ACTIVE`), không bị khóa.
  - Người ký đã hoàn thành khóa đào tạo GMP và được cấp quyền ký tương ứng với vai trò.
- **Decision Logic**:
  - Mỗi chữ ký điện tử bắt buộc phải có đầy đủ 3 thành phần hiển thị công khai (Manifestation):
    1. **Tên đầy đủ của người ký** (Printed name of the signer).
    2. **Thời gian ký chính xác** bao gồm cả múi giờ (Date and time of execution, UTC/ISO 8601).
    3. **Ý nghĩa của chữ ký** (Meaning / Reason associated with the signature).
  - Xác thực 2 yếu tố hoặc yêu cầu nhập lại mật khẩu:
    - Khi ký phiên làm việc đầu tiên trong ngày: Yêu cầu Tên đăng nhập + Mật khẩu.
    - Trong cùng một phiên liên tục: Mỗi lần ký tiếp theo vẫn bắt buộc nhập lại Mật khẩu ký (hoặc mã PIN ký) để đảm bảo không bị người khác dùng máy tính khi rời bàn làm việc.
- **Decision Table**:

| Trường hợp               | Nhập lại Mật khẩu / PIN | Gắn ý nghĩa chữ ký | Lưu mã băm dữ liệu | Kết quả ký                                |
| :----------------------- | :---------------------- | :----------------- | :----------------- | :---------------------------------------- |
| Ký kết quả kiểm nghiệm   | Bắt buộc                | Bắt buộc           | Bắt buộc SHA-256   | Hợp lệ, tạo bản ghi chữ ký                |
| Ký mà sai mật khẩu       | Sai mật khẩu            | Có                 | Có                 | **TỪ CHỐI**, ghi nhận cảnh báo an ninh    |
| Ký mà không chọn ý nghĩa | Đúng mật khẩu           | Để trống           | Có                 | **TỪ CHỐI**, yêu cầu chọn ý nghĩa cam kết |

- **Output**:
  - Đối tượng `ElectronicSignature`:
    - `signatureId`: UUID định danh chữ ký.
    - `signerId`, `signerName`, `signerRole`.
    - `meaning`: Chuỗi ký tự chuẩn hóa mô tả ý nghĩa.
    - `signedAt`: Timestamp ISO 8601.
    - `dataChecksum`: Mã băm SHA-256 của payload tại thời điểm ký.
- **State Transition**: `UNSIGNED` -> `SIGNED`.
- **UI Behavior**:
  - Hiển thị hộp thoại Modal chuyên biệt cho Chữ ký điện tử:
    - Hiển thị tóm tắt dữ liệu được ký.
    - Dropdown chọn ý nghĩa chữ ký (Reviewer, Approver, Author...).
    - Ô nhập mật khẩu ký (Password input).
    - Câu cam kết pháp lý: _"Bằng việc ký điện tử, tôi chịu trách nhiệm pháp lý cá nhân về tính chính xác của dữ liệu này."_
- **Report / CoA Behavior**: Trên bản in hiển thị khối chữ ký: Tên chức danh, Họ tên, Thời gian ký điện tử dạng `Ký điện tử bởi: [Họ tên] vào lúc [dd/MM/yyyy HH:mm:ss]`.
- **Audit Requirement**: Mọi hành vi ký (thành công hay thất bại) đều ghi nhận vào Audit Trail.
- **Forbidden Behavior**:
  - Tuyệt đối cấm sử dụng ảnh chữ ký scan (PNG/JPEG) chèn tùy tiện mà không có chữ ký điện tử kèm mã băm cơ sở dữ liệu.
  - Tuyệt đối cấm một người ký hộ hoặc chia sẻ tài khoản cho người khác ký thay.
- **Exception Handling**: Nhập sai mật khẩu ký quá 3 lần liên tiếp: Khóa chức năng ký của tài khoản trong 15 phút và thông báo tới Admin.
- **Test Cases**:
  - `TC-SIG-001-A`: Ký điện tử thành công khi nhập đúng mật khẩu và chọn ý nghĩa chữ ký.
  - `TC-SIG-001-B`: Nhập sai mật khẩu ký báo lỗi và không sinh ra bản ghi ký.

---

## 2. BR-SIG-002: Băm Toàn Vẹn Dữ Liệu Chống Giả Mạo Bằng SHA-256 (Data Integrity & Checksum Rule)

- **Rule ID**: `BR-SIG-002`
- **Purpose**: Đảm bảo bất kỳ sự can thiệp trái phép nào vào cơ sở dữ liệu sau khi ký đều bị phát hiện ngay lập tức nhờ cơ chế mã băm mật mã học SHA-256.
- **Actor**: `System` (Tự động hóa).
- **Trigger**: Khi tạo chữ ký điện tử (tính toán checksum) và khi mở dữ liệu để thẩm tra (kiểm tra tính toàn vẹn).
- **Input**:
  - `dataPayload`: Đối tượng dữ liệu cần bảo vệ (ví dụ: toàn bộ kết quả của phép thử hoặc toàn bộ dữ liệu CoA).
  - `storedChecksum`: Mã băm đã được lưu trữ trước đó.
- **Preconditions**: Dữ liệu đầu vào phải được chuẩn hóa (Canonical JSON serialization: sắp xếp thứ tự key bảng chữ cái, loại bỏ khoảng trắng thừa).
- **Decision Logic**:
  - **Khi ký (Sign)**:
    - Chuẩn hóa payload: `canonicalString = JSON.stringify(sortKeys(payload))`
    - Tính mã băm: `calculatedHash = SHA256(canonicalString)`
    - Lưu `calculatedHash` vào bản ghi chữ ký.
  - **Khi thẩm tra (Verify Integrity)**:
    - Tái tính toán mã băm từ dữ liệu hiện tại trong database: `currentHash = SHA256(canonicalString)`
    - So sánh: `isTampered = (currentHash !== storedChecksum)`
    - Nếu `isTampered === true`: Đánh dấu dữ liệu BỊ THAY ĐỔI TRÁI PHÉP (`TAMPERED`), khóa truy cập và gửi cảnh báo đỏ khẩn cấp tới Quản trị viên hệ thống.
- **Decision Table**:

| Tình trạng dữ liệu                   | Kết quả so sánh SHA-256          | Trạng thái toàn vẹn | Hành vi hệ thống                                                          |
| :----------------------------------- | :------------------------------- | :------------------ | :------------------------------------------------------------------------ |
| Dữ liệu nguyên vẹn                   | `currentHash === storedChecksum` | `VALID`             | Cho phép hiển thị và tiếp tục luồng                                       |
| Dữ liệu bị can thiệp trực tiếp từ DB | `currentHash !== storedChecksum` | `TAMPERED`          | **KHÓA NGAY LẬP TỨC**, vô hiệu hóa hiển thị, phát chuông cảnh báo an ninh |

- **Output**: Kết quả xác thực toàn vẹn: `isValid` (boolean), `checksum` (string).
- **State Transition**: Không áp dụng (Integrity verification).
- **UI Behavior**:
  - Nếu toàn vẹn: Hiển thị biểu tượng Khiên Xanh an toàn "Dữ liệu được xác thực toàn vẹn".
  - Nếu bị can thiệp: Hiển thị cảnh báo vi phạm tính toàn vẹn màu đỏ rực "CẢNH BÁO: DỮ LIỆU ĐÃ BỊ THAY ĐỔI BẤT HỢP PHÁP!".
- **Report / CoA Behavior**: Từ chối in hoặc xuất PDF nếu dữ liệu không vượt qua kiểm tra Checksum SHA-256.
- **Audit Requirement**: Ghi lại lịch sử mỗi lần kiểm tra toàn vẹn thất bại vào nhật ký vi phạm an toàn thông tin (Security Breach Log).
- **Forbidden Behavior**: Tuyệt đối cấm bỏ qua bước đối chiếu Checksum khi mở các hồ sơ đã đóng dấu phê duyệt.
- **Exception Handling**: Nếu hàm băm gặp lỗi do dữ liệu chứa ký tự đặc biệt không hỗ trợ UTF-8, phải xử lý encoding an toàn trước khi băm.
- **Test Cases**:
  - `TC-SIG-002-A`: Sửa đổi dù chỉ 1 ký tự trong payload đã ký sẽ khiến việc xác minh Checksum thất bại (`isValid = false`).
  - `TC-SIG-002-B`: Dữ liệu giữ nguyên thì hàm xác minh Checksum luôn trả về `true`.
