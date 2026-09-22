# AUDIT_RULES: Danh Mục Quy Tắc Nhật Ký Kiểm Toán (Audit Trail Rules)

Tài liệu này chuẩn hóa toàn bộ các quy tắc nghiệp vụ về Nhật ký kiểm toán (Audit Trail) theo nguyên tắc ALCOA+ (Attributable, Legible, Contemporaneous, Original, Accurate + Complete, Consistent, Enduring, Available) và kỹ thuật nối chuỗi mã băm bảo mật (Cryptographic Hash Chaining / Merkle-like Chain).

---

## 1. BR-AUD-001: Chuẩn Mực Ghi Nhận ALCOA+ Bắt Buộc Cho Mọi Thao Tác (ALCOA+ Compliance Rule)

- **Rule ID**: `BR-AUD-001`
- **Purpose**: Đảm bảo mọi tác động thêm, sửa, xóa, duyệt, từ chối hoặc xuất dữ liệu trong hệ thống đều được tự động lưu vết đầy đủ, không thể sửa đổi, không thể xóa và sẵn sàng phục vụ thanh tra GMP.
- **Actor**: `System` (Tự động ghi nhận ngầm bên dưới tất cả các thao tác của mọi Actor).
- **Trigger**: Bất kỳ khi nào có sự kiện ghi dữ liệu (Create, Update, Delete/Deactivate, Status Transition, Approval, Export, Sign) trên toàn bộ hệ thống.
- **Input**:
  - `action`: Hành vi thực hiện (`CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `REJECT`, `LOGIN`, `EXPORT`, `SIGN`).
  - `entityName`: Tên đối tượng tác động (ví dụ: `Batch`, `TestResult`, `TCCS`, `Product`, `Deviation`, `User`).
  - `entityId`: Mã định danh đối tượng.
  - `previousState`: Trạng thái dữ liệu trước khi thay đổi (JSON object).
  - `newState`: Trạng thái dữ liệu sau khi thay đổi (JSON object).
  - `userId`, `userFullName`, `userRole`: Thông tin danh tính người thực hiện.
  - `ipAddress`, `userAgent`: Thông tin thiết bị và mạng.
  - `reason`: Lý do thay đổi (bắt buộc đối với hành vi UPDATE hoặc DELETE logic).
- **Preconditions**: Sự kiện nghiệp vụ diễn ra thành công (Audit log chỉ ghi sau khi transaction cơ sở dữ liệu đã commit hoặc rollback thành công).
- **Decision Logic**:
  - **Attributable (Gắn với người dùng)**: Bắt buộc gắn chính xác ID, Tên và Vai trò của người đăng nhập. Nghiêm cấm dùng tài khoản hệ thống nặc danh cho các thao tác của người dùng.
  - **Contemporaneous (Thời gian thực)**: Thời gian `timestamp` phải được lấy trực tiếp từ đồng hồ máy chủ chuẩn NTP (Network Time Protocol), tuyệt đối không lấy từ đồng hồ máy khách (client clock).
  - **Original & Complete (Nguyên bản & Đầy đủ)**: Ghi nhận dạng Diff (So sánh trước/sau) chi tiết tới từng trường thông tin bị thay đổi (`field`, `oldValue`, `newValue`).
  - **Accurate & Enduring (Chính xác & Bền vững)**: Dữ liệu audit được ghi vào kho lưu trữ chuyên biệt (Write-Once, Read-Many - WORM / Append-Only collection). Không có API nào hỗ trợ lệnh Update hoặc Delete trên bảng Audit Log.
- **Decision Table**:

| Thao tác nghiệp vụ                | Bắt buộc nhập lý do | Ghi Diff trước/sau    | Gắn Server Timestamp | Khả năng xóa Audit Log |
| :-------------------------------- | :------------------ | :-------------------- | :------------------- | :--------------------- |
| Tạo mới bản ghi (`CREATE`)        | Tùy chọn            | Có (`newState`)       | Bắt buộc             | **KHÔNG THỂ XÓA**      |
| Chỉnh sửa dữ liệu (`UPDATE`)      | **BẮT BUỘC**        | Có (`diff(old, new)`) | Bắt buộc             | **KHÔNG THỂ XÓA**      |
| Vô hiệu hóa (`DEACTIVATE`)        | **BẮT BUỘC**        | Có                    | Bắt buộc             | **KHÔNG THỂ XÓA**      |
| Thẩm duyệt (`APPROVE` / `REJECT`) | Bắt buộc nếu Reject | Có (`status`)         | Bắt buộc             | **KHÔNG THỂ XÓA**      |
| Ký số (`SIGN`)                    | Bắt buộc ý nghĩa ký | Có (`checksum`)       | Bắt buộc             | **KHÔNG THỂ XÓA**      |

- **Output**: Bản ghi `AuditTrailEntry` hoàn chỉnh lưu vào kho dữ liệu bất biến.
- **State Transition**: Append-only (Chỉ ghi thêm, không chuyển trạng thái).
- **UI Behavior**:
  - Màn hình "Nhật ký kiểm toán" cho phép lọc theo: Thời gian, Đối tượng, Người thực hiện, Loại hành động.
  - Hiển thị trực quan bảng so sánh sự thay đổi màu sắc (Xanh: Giá trị mới, Đỏ gạch ngang: Giá trị cũ).
  - Không có bất kỳ nút "Sửa" hoặc "Xóa" nào trên màn hình Audit Trail.
- **Report / CoA Behavior**: Có thể trích xuất Báo cáo Nhật ký Kiểm toán Lô (Batch Audit Trail Report) đính kèm hồ sơ xuất xưởng.
- **Audit Requirement**: Bản thân thao tác xem hoặc trích xuất Audit Trail cũng được ghi nhận vào Access Log.
- **Forbidden Behavior**:
  - Tuyệt đối cấm tạo lệnh xóa bản ghi Audit Trail trong mã nguồn (Không viết `DELETE FROM audit_logs`).
  - Tuyệt đối cấm cho phép sửa dữ liệu mà không nhập lý do (Change Reason).
- **Exception Handling**: Nếu dịch vụ ghi Audit Trail gặp sự cố (đầy ổ cứng hoặc lỗi mạng cơ sở dữ liệu), giao dịch nghiệp vụ chính phải bị hủy (Rollback) ngay lập tức để tránh tình trạng "thao tác mà không có vết kiểm toán".
- **Test Cases**:
  - `TC-AUD-001-A`: Chỉnh sửa một trường trong kết quả kiểm nghiệm bắt buộc phải sinh ra 1 bản ghi Audit Trail chứa đúng trường cũ và mới.
  - `TC-AUD-001-B`: Cố gắng gọi API xóa bản ghi Audit Trail phải bị từ chối với mã lỗi `403 Forbidden`.

---

## 2. BR-AUD-002: Chuỗi Khối Toàn Vẹn Mã Băm Nhật Ký (Cryptographic Hash Chaining Rule)

- **Rule ID**: `BR-AUD-002`
- **Purpose**: Đảm bảo các bản ghi trong Audit Trail được liên kết với nhau theo cấu trúc chuỗi khối (Cryptographic Hash Chaining), giúp phát hiện ngay lập tức nếu có ai đó xâm nhập trực tiếp vào database backend để chèn, sửa hoặc xóa bớt một dòng log.
- **Actor**: `System` (Tự động tính toán).
- **Trigger**: Mỗi khi một bản ghi Audit Trail mới được tạo ra.
- **Input**:
  - `currentEntryPayload`: Toàn bộ nội dung của bản ghi audit hiện tại.
  - `previousEntryHash`: Mã băm SHA-256 của bản ghi audit liền kề trước đó.
- **Preconditions**: Hệ thống có sẵn mã băm của bản ghi khởi thủy (Genesis Block Hash).
- **Decision Logic**:
  - Mỗi bản ghi Audit Trail $N$ chứa:
    - `previousHash = Hash(Entry_{N-1})`
    - `currentHash = SHA256(canonical(Entry_N.payload) + previousHash)`
  - Khi hệ thống chạy kiểm toán định kỳ (Audit Trail Verification Routine):
    - Quét toàn bộ chuỗi từ bản ghi đầu tiên đến bản ghi mới nhất.
    - Tái tính toán mã băm của từng khối.
    - Nếu tại bất kỳ vị trí $K$ nào phát hiện `Hash(Entry_K) !== Entry_{K+1}.previousHash`: Chuỗi kiểm toán đã bị phá vỡ (Broken Hash Chain). Ngay lập tức kích hoạt báo động an ninh mức tối cao (Security Incident).
- **Decision Table**:

| Tình trạng chuỗi kiểm toán | Kết quả kiểm tra đối chiếu mã băm                             | Đánh giá an ninh                                |
| :------------------------- | :------------------------------------------------------------ | :---------------------------------------------- |
| Không bị can thiệp         | `calculatedHash(K) === Entry(K+1).previousHash` (toàn bộ)     | Chuỗi toàn vẹn (`CHAIN_VALID`)                  |
| Bị xóa trộm 1 dòng log     | Phát hiện đứt gãy tại vị trí dòng bị mất                      | Chuỗi bị phá hủy (`CHAIN_BROKEN_MISSING_ENTRY`) |
| Bị sửa nội dung 1 dòng log | Hash của dòng bị sửa không khớp với previousHash của dòng sau | Chuỗi bị làm giả (`CHAIN_TAMPERED`)             |

- **Output**:
  - `auditEntry.previousHash`: Mã băm liên kết bản ghi trước.
  - `auditEntry.currentHash`: Mã băm bản ghi hiện tại.
- **State Transition**: Không áp dụng.
- **UI Behavior**:
  - Trên màn hình Quản trị hệ thống, hiển thị chỉ số "Trạng thái chuỗi kiểm toán: Toàn vẹn (100% Chained & Verified)".
  - Có nút "Xác thực chuỗi kiểm toán tức thời" để Quản trị viên hoặc Thanh tra viên chạy kiểm tra tại chỗ.
- **Report / CoA Behavior**: Không áp dụng.
- **Audit Requirement**: Kết quả của mỗi lần chạy Verify Hash Chain được ghi vào System Security Event Log.
- **Forbidden Behavior**: Tuyệt đối cấm tạo bản ghi Audit mới mà để trường `previousHash` rỗng hoặc null (trừ bản ghi Genesis đầu tiên).
- **Exception Handling**: Nếu phát hiện đứt gãy chuỗi, hệ thống tự động khóa chế độ ghi mới của toàn bộ ứng dụng để phục vụ điều tra forensics và bảo vệ hiện trường dữ liệu.
- **Test Cases**:
  - `TC-AUD-002-A`: Bản ghi Audit thứ N luôn chứa đúng mã băm `currentHash` của bản ghi thứ N-1 trong trường `previousHash`.
  - `TC-AUD-002-B`: Thay đổi nội dung của một bản ghi cũ sẽ làm hàm kiểm tra chuỗi trả về lỗi `CHAIN_TAMPERED`.
