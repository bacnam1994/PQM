# PQM — BẢN ĐẶC TẢ YÊU CẦU NGƯỜI DÙNG (USER REQUIREMENTS SPECIFICATION - URS)

> **Mã tài liệu:** `PQM-CSV-URS-001`  
> **Phiên bản:** `1.0.0`  
> **Giai đoạn:** `PHASE F — Computer System Validation`  
> **Tiêu chuẩn tuân thủ:** `GAMP 5`, `21 CFR Part 11`, `WHO GMP Annex 4 & Annex 5`

---

## 1. MỤC TIÊU VÀ PHẠM VI

Tài liệu Đặc tả Yêu cầu Người dùng (URS) xác định các nhu cầu nghiệp vụ, tiêu chuẩn vận hành, và rào chắn an ninh bắt buộc của Hệ thống Quản lý Chất lượng Dược phẩm (PQM - Pharmaceutical Quality Management).
Hệ thống quản lý toàn diện từ danh mục sản phẩm, tiêu chuẩn chất lượng (TCCS), công thức định mức, quản lý lô, nhập phiếu kiểm nghiệm, thẩm định chất lượng tự động, ký số điện tử đến xuất xưởng và phát hành Giấy chứng nhận kiểm nghiệm (Certificate of Analysis - CoA).

---

## 2. DANH MỤC YÊU CẦU NGƯỜI DÙNG THEO MODULE (URS DOMAINS)

### 2.1. Quản lý Sản phẩm (Product Management - URS-PRD)

- **URS-PRD-001:** Người dùng có thẩm quyền phải tạo và quản lý được danh mục sản phẩm hoàn chỉnh bao gồm mã sản phẩm, tên, nhóm sản phẩm, số đăng ký lưu hành, ngày cấp số đăng ký, người đăng ký và mô tả.
- **URS-PRD-002:** Hệ thống phải ngăn chặn việc tạo trùng lặp mã sản phẩm và không cho phép xóa vật lý các sản phẩm đã có liên kết với Lô sản xuất hoặc Tiêu chuẩn chất lượng cơ sở.

### 2.2. Tiêu chuẩn Chất lượng Cơ sở (TCCS Management - URS-TCS)

- **URS-TCS-001:** Hệ thống phải cho phép thiết lập và quản lý phiên bản Tiêu chuẩn cơ sở (TCCS) cho từng sản phẩm, gồm các chỉ tiêu cảm quan, chỉ tiêu hóa lý, chỉ tiêu vi sinh với giới hạn quy chuẩn rõ ràng (min, max, text, format).
- **URS-TCS-002:** Tại một thời điểm, mỗi sản phẩm chỉ được có duy nhất 1 TCCS ở trạng thái hiệu lực (`ACTIVE`). Khi kích hoạt TCCS mới, phiên bản cũ phải tự động chuyển sang lưu trữ (`OBSOLETE`/`ARCHIVED`).

### 2.3. Công thức Định mức (Formula Management - URS-FOR)

- **URS-FOR-001:** Người dùng phải tạo và quản lý được công thức sản phẩm (`ProductFormula`) gồm danh sách hoạt chất (`ingredients`) và tá dược (`excipients`) kèm hàm lượng công bố và đơn vị tính.
- **URS-FOR-002:** Mỗi thành phần công thức phải liên kết được với mã chuẩn hóa nguyên liệu (`RawMaterial`) trong từ điển dữ liệu.

### 2.4. Quản lý Lô Sản xuất (Batch Management - URS-BAT)

- **URS-BAT-001:** Hệ thống phải bắt buộc kiểm tra Lô sản xuất phải gắn liền với một Sản phẩm hợp lệ và một TCCS đang có hiệu lực tại thời điểm tạo.
- **URS-BAT-002:** Hệ thống phải lưu trữ bản sao snapshot bất biến của TCCS và Công thức (`tccsSnapshot`, `formulaSnapshot`) ngay tại thời điểm tạo Lô để đảm bảo truy vết lịch sử dù TCCS trong tương lai có thay đổi.
- **URS-BAT-003:** Không cho phép tạo trùng lặp số lô (`batchNo`) cho cùng một sản phẩm.

### 2.5. Nhập Phiếu Kiểm nghiệm (Test Result Entry - URS-TST)

- **URS-TST-001:** Kiểm nghiệm viên phải nhập được kết quả kiểm nghiệm chi tiết theo từng chỉ tiêu đã định nghĩa trong TCCS của Lô, hỗ trợ nhập số thực tế và kết luận chỉ tiêu.
- **URS-TST-002:** Phiếu kiểm nghiệm phải trải qua vòng đời tài liệu được kiểm soát: `DRAFT` -> `SUBMITTED` -> `FINAL` -> `APPROVED` -> `RELEASED`.

### 2.6. Thẩm định Chất lượng Tự động (Quality Evaluation - URS-QEV)

- **URS-QEV-001:** Hệ thống phải tự động đánh giá kết quả kiểm nghiệm dựa trên công cụ thẩm định chuẩn mực (`QualityEvaluationEngine`), đối chiếu từng chỉ tiêu với TCCS hiệu lực để xác định trạng thái chất lượng (`PASS`, `FAIL`, `PENDING`, `UNKNOWN`).
- **URS-QEV-002:** Hệ thống tuyệt đối không cho phép UI tự suy luận hoặc ghi đè kết quả chất lượng. Nếu có chỉ tiêu không đạt (`FAIL`), kết luận toàn diện bắt buộc là `FAIL`. Nếu thiếu chỉ tiêu hoặc đang kiểm nghiệm, trạng thái là `PENDING` và không được chuyển thành `PASS`.

### 2.7. Bất biến Snapshot Thẩm định (Evaluation Snapshot - URS-SNP)

- **URS-SNP-001:** Khi hoàn tất thẩm định (Finalization), hệ thống phải tạo một `EvaluationSnapshot` bất biến chứa toàn bộ tóm tắt kết quả, thông tin thẩm định viên, ngày giờ và mã băm SHA-256 (`evaluationHash`).
- **URS-SNP-002:** Hệ thống phải tự động phát hiện và chặn đứng mọi hành vi can thiệp, chỉnh sửa trái phép vào dữ liệu sau khi snapshot đã được lập băm.

### 2.8. Phê duyệt & Xuất xưởng Lô (QA Approval & Batch Release - URS-REL)

- **URS-REL-001:** Chỉ người dùng có vai trò Đảm bảo Chất lượng (`QA`) hoặc Quản trị viên (`ADMIN`) mới có quyền phê duyệt phiếu kiểm nghiệm và thực hiện xuất xưởng lô (`RELEASED`).
- **URS-REL-002:** Rào chắn xuất xưởng (`QualityWorkflowMatrixGuard`) phải chặn đứng hành vi xuất xưởng nếu:
  - Phiếu kiểm nghiệm có trạng thái khác `PASS`.
  - Chưa có snapshot thẩm định hoặc snapshot bị sai lệch mã băm.
  - Chưa được QA phê duyệt tài liệu.
  - Thiếu chữ ký số điện tử hợp lệ.

### 2.9. Chữ ký Số Điện tử & Tuân thủ 21 CFR Part 11 (Electronic Signature - URS-SIG)

- **URS-SIG-001:** Hành động ký số xuất xưởng phải ghi nhận đầy đủ: danh tính người ký, email, vai trò, lý do ký, dấu thời gian ISO 8601 và mã checksum bảo mật SHA-256.
- **URS-SIG-002:** Bất kỳ sự thay đổi nào đối với nội dung dữ liệu sau khi ký phải làm vô hiệu hóa chữ ký và phát hiện tức thì.

### 2.10. Phát hành Phiếu Kiểm nghiệm / CoA (Certificate of Analysis - URS-COA)

- **URS-COA-001:** Hệ thống phải cung cấp giao diện hiển thị và in ấn Phiếu kiểm nghiệm / CoA chuẩn mực cho lô đã được duyệt hoặc xuất xưởng.
- **URS-COA-002:** Mọi thông tin trên CoA phải được trích xuất trực tiếp từ bản ghi kiểm nghiệm và snapshot đã được phê duyệt, có mã QR hoặc mã định danh tra cứu.

### 2.11. Cây Phả hệ Lô & Truy xuất Nguồn gốc (Batch Genealogy & Traceability - URS-GEN)

- **URS-GEN-001:** Hệ thống phải dựng được cây phả hệ đầy đủ (`BatchGenealogy`) liên kết từ Nhà cung cấp -> Lô nguyên liệu đầu vào -> Lô sản xuất trung gian/thành phẩm -> Phiếu kiểm nghiệm -> Quyết định xuất xưởng.
- **URS-GEN-002:** Hỗ trợ tính năng truy vết ngược dòng (Backward Recall) và xuôi dòng (Forward Trace) trong các sự vụ thu hồi hoặc cảnh báo chất lượng.

### 2.12. Nhật ký Kiểm toán Toàn vẹn ALCOA+ (Audit Trail - URS-AUD)

- **URS-AUD-001:** Mọi thao tác thêm, sửa, xóa, phê duyệt, xuất xưởng hoặc từ chối trên các thực thể có kiểm soát bắt buộc phải được ghi nhật ký kiểm toán không thể xóa/sửa (`Append-only Audit Trail`).
- **URS-AUD-002:** Bản ghi kiểm toán phải đáp ứng nguyên tắc ALCOA+: Attributable (gắn với người dùng), Legible (dễ đọc), Contemporaneous (ghi tức thì), Original (nguyên bản), Accurate (chính xác).

### 2.13. Quản trị Trí tuệ Nhân tạo & Tự động Sửa sai (AI Governance & Auto-Healing - URS-AIG)

- **URS-AIG-001:** AI chỉ đóng vai trò trợ lý (Copilot) phân tích, phát hiện sai lệch, dự báo rủi ro và lập bản đề xuất (`Proposal`). AI tuyệt đối không được tự ý xuất xưởng lô, phê duyệt kết quả kiểm nghiệm hoặc sửa trực tiếp vào cơ sở dữ liệu.
- **URS-AIG-002:** Quy trình tự động hàn gắn dữ liệu (`Auto-Healing`) phải tuân thủ cơ chế All-or-Nothing (Atomic Transaction), có bước xem trước tác động (`Preview`), chặn tuyệt đối việc tự động sửa kết quả đo lường gốc (`NEVER_AUTO_HEAL`), và phải có phê duyệt của QA/ADMIN.
