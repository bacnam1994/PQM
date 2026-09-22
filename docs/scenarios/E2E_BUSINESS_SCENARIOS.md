# E2E_BUSINESS_SCENARIOS: 18 Kịch Bản Nghiệp Vụ Đầu-Cuối Chuẩn Mực PQM (S-001 ➔ S-018)

Tài liệu này chuẩn hóa toàn bộ 18 Kịch Bản Nghiệp Vụ Đầu-Cuối (End-to-End Business Scenarios) phản ánh 100% các tình huống thực tế xảy ra trong nhà máy dược phẩm đạt chuẩn GMP, dùng làm căn cứ viết Automated Tests và nghiệm thu hệ thống.

---

## 1. Danh Mục 18 Kịch Bản Nghiệp Vụ

|    Mã     | Tên Kịch Bản                                          | Trọng tâm kiểm thử                                                 |
| :-------: | :---------------------------------------------------- | :----------------------------------------------------------------- |
| **S-001** | Happy Path: Lô sản xuất đạt chất lượng hoàn hảo       | Hoàn thành từ A-Z, vượt 7 Gates, xuất xưởng & phát hành CoA        |
| **S-002** | Unhappy Path: Lô sản xuất không đạt chất lượng        | Chỉ tiêu định lượng rớt, kích hoạt OOS, từ chối xuất xưởng         |
| **S-003** | Testing Incomplete: Lô chưa hoàn tất kiểm nghiệm      | Chặn thẩm định và chặn xuất xưởng khi còn chỉ tiêu PENDING         |
| **S-004** | Alternate Rule: Thử lại khi rớt (FAIL_RETRY)          | Phép thử lần 1 rớt, lần 2 đạt, CoA sinh footnote hợp lệ            |
| **S-005** | Alternate Rule: Miễn kiểm có điều kiện (CONDITIONAL)  | Chỉ tiêu chính an toàn cao -> tự động miễn kiểm chỉ tiêu phụ       |
| **S-006** | Alternate Dependency Missing: Thiếu dữ liệu phụ thuộc | Báo lỗi chặn khi quy tắc thay thế bị thiếu chỉ tiêu điều kiện      |
| **S-007** | TCCS Version Change & Snapshot Immutability           | TCCS ban hành phiên bản mới, các lô cũ giữ nguyên Snapshot         |
| **S-008** | Multi-level TestResult Approval & SoD Guard           | KCS nộp -> QA thẩm tra -> QA Manager duyệt; cấm tự duyệt           |
| **S-009** | Batch Release Gates: 7 Cổng kiểm soát xuất xưởng      | Kiểm tra ma trận 7 Gates, chặn xuất xưởng nếu 1 cổng chưa xanh     |
| **S-010** | OOS Investigation: Điều tra 2 giai đoạn theo FDA      | Lab Error vs Manufacturing Defect, Retest và Phê duyệt QA          |
| **S-011** | Deviation Management: Xử lý sự cố sai lệch quy trình  | Phân loại Critical/Major, đánh giá rủi ro RPN theo ICH Q9          |
| **S-012** | CAPA Closed-Loop: Hành động khắc phục phòng ngừa      | Lập kế hoạch, tải bằng chứng và thẩm tra hiệu quả sau 3 tháng      |
| **S-013** | Immutable CoA Generation & QR Verification            | Snapshot đóng băng, băm SHA-256, cấm template tự evaluate          |
| **S-014** | ALCOA+ Audit Trail & Cryptographic Hash Chaining      | Ghi Diff trước/sau, kiểm tra chuỗi băm chống sửa lén database      |
| **S-015** | 21 CFR Part 11 Electronic Signature                   | Ký số hai lớp, kiểm tra mật khẩu, gắn ý nghĩa cam kết pháp lý      |
| **S-016** | Concurrent Modification & Optimistic Locking          | Hai Kỹ thuật viên cùng mở sửa một phiếu, chặn ghi đè mất mát       |
| **S-017** | Legacy Data Ingestion & Sanitation                    | Nạp dữ liệu cũ thiếu trường, tự động gắn nhãn tương thích an toàn  |
| **S-018** | AI Advisory Guardrails & Human Confirmation           | AI gợi ý OCR, rào chắn chặn nhầm Định tính/Định lượng, người duyệt |

---

## 2. Chi Tiết Từng Kịch Bản Nghiệp Vụ

### S-001: Happy Path - Lô Sản Xuất Đạt Chất Lượng Hoàn Hảo

- **Mục tiêu**: Xác nhận luồng chuẩn tắc thành công từ khâu nhận lệnh sản xuất tới xuất xưởng và in CoA.
- **Actors**: `Production Manager`, `Analyst`, `QA Reviewer`, `QA Manager / Qualified Person`.
- **Dữ liệu giả lập**:
  - Sản phẩm `PRD-PARA500` (Paracetamol 500mg), TCCS `TCCS-PARA500-01` (10 chỉ tiêu).
  - Lô `BAT-2026-001`, cỡ lô 100,000 viên.
- **Các bước thực hiện**:
  1. Production Manager khởi tạo Lô `BAT-2026-001`, hệ thống chụp Snapshot TCCS bản 1.
  2. Phân xưởng sản xuất hoàn thành, gửi mẫu sang phòng KCS, trạng thái Lô chuyển `TESTING`.
  3. Kỹ thuật viên mở Phiếu kiểm nghiệm, nhập đủ 10/10 chỉ tiêu nằm trong giới hạn Đạt, bấm Nộp (`SUBMITTED`).
  4. QA Reviewer đối chiếu dữ liệu gốc, ký xác nhận thẩm định đạt (`REVIEWED`).
  5. QA Manager kiểm tra, ký số duyệt phiếu (`APPROVED`).
  6. Domain Engine tính toán: `completionPercentage = 100%`, `canonicalQualityStatus = 'PASS'`. UI render nhãn: `"Đã kiểm xong - Chờ QA duyệt"`.
  7. QA Manager mở màn hình Xuất xưởng: Cả 7 Gates đều chuyển màu xanh.
  8. QA Manager nhập mật khẩu ký số lệnh xuất xưởng. Lô chuyển sang `RELEASED`.
  9. Hệ thống phát hành CoA chính thức kèm mã băm SHA-256 và mã QR tra cứu.
- **Post-conditions**: Lô có trạng thái `RELEASED`, CoA ở trạng thái `PUBLISHED`, hồ sơ bị khóa bất biến.

---

### S-002: Unhappy Path - Lô Sản Xuất Không Đạt Chất Lượng

- **Mục tiêu**: Đảm bảo lô có chỉ tiêu không đạt bị chặn đứng tuyệt đối và không thể xuất xưởng.
- **Actors**: `Analyst`, `QA Manager`.
- **Dữ liệu giả lập**: Lô `BAT-2026-002`, chỉ tiêu Độ hòa tan (Dissolution) đo được là $65\%$ (Quy định: $Q \ge 75\%$).
- **Các bước thực hiện**:
  1. Kỹ thuật viên nhập giá trị `65` vào chỉ tiêu Độ hòa tan.
  2. Domain Engine đánh giá chỉ tiêu này là `FAIL`.
  3. Hệ thống tự động kích hoạt tạo hồ sơ điều tra OOS `OOS-2026-002` ở trạng thái `OPEN`.
  4. Trạng thái chất lượng chuẩn tắc của Lô lập tức chuyển sang `FAIL`.
  5. QA Manager kiểm tra màn hình Xuất xưởng: Gate 2 (Quality Evaluation) và Gate 3 (OOS Resolution) bị đánh dấu màu đỏ `BLOCKED`.
  6. Nút "Xuất xưởng" bị vô hiệu hóa hoàn toàn.
  7. Sau khi điều tra Phase 1 và Phase 2 kết luận nguyên nhân do nhiệt độ sấy cốm không đều, QA Manager ra quyết định bác bỏ lô (`REJECTED`).
- **Post-conditions**: Lô chuyển sang trạng thái `REJECTED`, cấm mọi hành vi xuất xưởng hoặc phát hành CoA đạt.

---

### S-003: Testing Incomplete - Lô Chưa Hoàn Tất Kiểm Nghiệm

- **Mục tiêu**: Chặn xuất xưởng và không cho phép đưa ra kết luận vội vã khi số lượng chỉ tiêu chưa đủ 100%.
- **Actors**: `Analyst`, `QA Reviewer`.
- **Dữ liệu giả lập**: Lô `BAT-2026-003` có 10 chỉ tiêu, mới kiểm tra xong 8 chỉ tiêu (đều Đạt), còn 2 chỉ tiêu vi sinh đang nuôi cấy (`PENDING`).
- **Các bước thực hiện**:
  1. Kỹ thuật viên lưu dở dang 8 chỉ tiêu, 2 chỉ tiêu còn lại giữ `NOT_STARTED` hoặc `TESTING`.
  2. Domain Engine tính toán: `completionPercentage = 80%`, `canonicalQualityStatus = 'PENDING'`.
  3. UI hiển thị Badge màu vàng: `"Đang kiểm nghiệm (80%)"`.
  4. Kỹ thuật viên cố tình bấm nút "Nộp phê duyệt toàn bộ": Hệ thống chặn với lỗi `ERR_TST_INCOMPLETE`.
  5. Cổng Release Gate 1 bị đánh dấu Đỏ: "Chưa hoàn tất kiểm nghiệm (Thiếu 2 chỉ tiêu vi sinh)".
- **Post-conditions**: Không có chữ ký xuất xưởng nào được phép tạo.

---

### S-004: Alternate Rule - Thử Lại Khi Rớt (FAIL_RETRY)

- **Mục tiêu**: Kiểm tra tính đúng đắn của quy tắc thay thế khi thử nghiệm lần 1 không đạt nhưng lần 2 mở rộng đạt theo Dược điển.
- **Actors**: `Analyst`, `QA Manager`.
- **Dữ liệu giả lập**: Chỉ tiêu Độ tan rã lần 1 (6 viên) có 1 viên chưa rã ($FAIL$). Quy tắc `ALT-DIS-01` cho phép thử tiếp 12 viên (yêu cầu cả 18 viên chỉ tối đa 1 viên không rã).
- **Các bước thực hiện**:
  1. Kỹ thuật viên nhập kết quả lần 1 là `FAIL`. Quy tắc chuyển sang `TRIGGERED_PENDING`.
  2. Hệ thống mở ô nhập liệu cho Phép thử lần 2 (12 viên bổ sung).
  3. Kỹ thuật viên nhập kết quả lần 2: Đạt (cả 12 viên đều rã hoàn toàn).
  4. Quy tắc chuyển sang trạng thái `TRIGGERED_PASS`.
  5. Domain Engine cứu chỉ tiêu Độ tan rã thành `PASS`.
  6. CoA tự động gắn dấu sao `(*)` tại chỉ tiêu Độ tan rã và in footnote chân trang: _"(_) Đạt tiêu chuẩn sau khi thử nghiệm bổ sung 12 viên theo quy định Dược điển Việt Nam V Phụ lục 11.4."\*
- **Post-conditions**: Lô đủ điều kiện đạt chất lượng, minh bạch căn cứ pháp lý trên CoA.

---

### S-005: Alternate Rule - Miễn Kiểm Có Điều Kiện (CONDITIONAL_CHECK)

- **Mục tiêu**: Tự động miễn trừ chỉ tiêu phụ khi chỉ tiêu chính đạt yêu cầu an toàn cao.
- **Actors**: `System`, `Analyst`.
- **Dữ liệu giả lập**: Chỉ tiêu "Giới hạn vi sinh vật" được miễn thử nếu Lô nguyên liệu đã có chứng nhận tiệt trùng bằng tia Gamma và quy trình đóng gói vô trùng đạt chuẩn.
- **Các bước thực hiện**:
  1. Hồ sơ nguyên liệu đầu vào ghi nhận đạt chuẩn tiệt trùng Gamma.
  2. Quy tắc `ALT-MIC-01` tự động kích hoạt chuyển sang `TRIGGERED_PASS`.
  3. Chỉ tiêu Giới hạn vi sinh vật trên Phiếu kiểm nghiệm tự động chuyển sang trạng thái `EXEMPTED` (Miễn thử).
  4. Kỹ thuật viên không cần nhập số đo vi sinh mà tiến độ kiểm nghiệm vẫn được tính là hoàn thành.
  5. Trên CoA, cột kết quả ghi nhận "Miễn thử (\*)" kèm footnote giải trình.
- **Post-conditions**: Tiết kiệm chi phí và thời gian kiểm nghiệm nhưng tuân thủ 100% hồ sơ đăng ký thuốc.

---

### S-006: Alternate Dependency Missing - Thiếu Dữ Liệu Phụ Thuộc

- **Mục tiêu**: Ngăn chặn gian lận tự ý nhận Đạt chỉ tiêu thay thế khi chưa có kết quả kiểm nghiệm thực tế.
- **Actors**: `Analyst`.
- **Các bước thực hiện**:
  1. Chỉ tiêu chính rớt, quy tắc chuyển sang `TRIGGERED_PENDING`.
  2. Kỹ thuật viên không nhập kết quả của chỉ tiêu phụ mà cố tình bấm nút "Hoàn tất & Coi như Đạt".
  3. Hệ thống chặn đứng giao dịch với mã lỗi `ERR_ALT_SUBSTITUTE_MISSING`.
  4. Trạng thái chất lượng của Lô bị neo giữ ở mức `FAIL` cho đến khi có số liệu đo thực của chỉ tiêu phụ.

---

### S-007: TCCS Version Change & Snapshot Immutability

- **Mục tiêu**: Chứng minh việc sửa đổi hoặc ban hành TCCS mới không làm ảnh hưởng tới các lô sản xuất cũ.
- **Actors**: `R&D Specialist`, `QA Manager`.
- **Dữ liệu giả lập**:
  - Lô `BAT-001` đang sản xuất dựa trên `TCCS bản 1` (Giới hạn hàm lượng: 90% - 110%).
  - Phòng R&D ban hành `TCCS bản 2` (Siết chặt giới hạn hàm lượng: 95% - 105%).
- **Các bước thực hiện**:
  1. QA Manager duyệt ban hành TCCS bản 2 (`EFFECTIVE`), bản 1 chuyển sang `SUPERSEDED`.
  2. KCS mở phiếu kiểm nghiệm của Lô `BAT-001`: Phiếu vẫn hiển thị giới hạn 90% - 110% từ Snapshot bản 1.
  3. KCS nhập kết quả `92%`.
  4. Domain Engine đánh giá Lô `BAT-001` là `PASS` (vì so với bản 1).
  5. Khi tạo một Lô mới `BAT-002`, hệ thống tự động chụp Snapshot từ TCCS bản 2 (giới hạn 95% - 105%). Nếu Lô mới này nhập `92%` thì sẽ bị đánh giá là `FAIL`.
- **Post-conditions**: Tính toàn vẹn và bất biến lịch sử của hồ sơ lô được bảo toàn 100%.

---

### S-008: Multi-Level TestResult Approval & SoD Guard

- **Mục tiêu**: Xác thực cơ chế phân quyền đa cấp và chặn tự thẩm duyệt.
- **Actors**: `KTV Bình (Analyst)`, `QA Nam (Reviewer)`, `QA Trưởng phòng Hùng (Manager)`.
- **Các bước thực hiện**:
  1. KTV Bình nhập xong kết quả phiếu `PKN-001`, bấm Nộp. Phiếu chuyển `SUBMITTED`.
  2. KTV Bình thử dùng tài khoản của mình gọi hàm Review hoặc Approve: Bị chặn với lỗi `ERR_SOD_VIOLATION`.
  3. QA Nam đăng nhập, kiểm tra tính toàn vẹn số liệu thô và ký xác nhận thẩm tra: Phiếu chuyển `REVIEWED`.
  4. QA Trưởng phòng Hùng đăng nhập, kiểm tra hồ sơ và ký số 21 CFR Part 11: Phiếu chuyển `APPROVED`.
- **Post-conditions**: Dữ liệu phiếu bị khóa vĩnh viễn, gắn chữ ký số của cả 3 nhân sự.

---

### S-009: Batch Release Gates - 7 Cổng Kiểm Soát Xuất Xưởng

- **Mục tiêu**: Kiểm thử thuật toán Fail-Fast của 7 Cổng kiểm soát xuất xưởng.
- **Actors**: `Qualified Person`.
- **Các bước thực hiện**:
  1. Lô `BAT-001` thỏa mãn Gates 1, 2, 3, 5, 6, 7 nhưng đang vướng 1 Sai lệch nhiệt độ kho bảo quản chưa đóng (Gate 4 vi phạm).
  2. Qualified Person mở màn hình Thẩm định xuất xưởng: Hệ thống hiển thị biểu tượng Cảnh báo đỏ tại Gate 4 ("Deviation DEV-015 chưa được QA phê duyệt đóng").
  3. Nút "Ký quyết định xuất xưởng" bị vô hiệu hóa kèm tooltip giải thích lý do.
  4. Sau khi QA đánh giá rủi ro và ký đóng Deviation, Gate 4 tự động chuyển sang Xanh.
  5. Qualified Person nhập mật khẩu ký số thành công, lô chuyển sang `RELEASED`.

---

### S-010: OOS Investigation - Điều Tra 2 Giai Đoạn Theo FDA

- **Mục tiêu**: Mô phỏng toàn bộ chu trình điều tra nguyên nhân phòng lab vs nguyên nhân sản xuất.
- **Actors**: `Analyst`, `Lab Supervisor`, `QA Manager`.
- **Các bước thực hiện**:
  1. Phát sinh OOS chỉ tiêu Độ ẩm vượt chuẩn ($6.5\% > 5.0\%$).
  2. Lab Supervisor tiến hành Phase 1 Checklist: Kiểm tra tủ sấy, cân phân tích, chất hút ẩm.
  3. Phát hiện tủ sấy bị mất điện cục bộ làm nhiệt độ sấy thực tế chỉ đạt 80°C thay vì 105°C (Xác nhận Lab Error).
  4. Lab Supervisor lập biên bản hủy kết quả ban đầu (`LAB_ERROR_INVALIDATED`).
  5. Tiến hành thử nghiệm lại trên mẫu lưu với thiết bị sấy đã hiệu chuẩn đạt kết quả $3.8\%$ (Đạt).
  6. QA Manager ký duyệt đóng OOS.

---

### S-011: Deviation Management - Xử Lý Sự Cố Sai Lệch Quy Trình

- **Mục tiêu**: Đánh giá rủi ro chất lượng theo ma trận FMEA (ICH Q9).
- **Actors**: `Quản đốc phân xưởng`, `QA Specialist`.
- **Các bước thực hiện**:
  1. Phát hiện sự cố rách màng lọc khí HEPA trong phòng dập viên.
  2. Quản đốc lập phiếu báo cáo sai lệch `DEV-2026-020`.
  3. QA Specialist chấm điểm: Mức độ nghiêm trọng $S=4$, Khả năng phát hiện $D=2$, Xác suất xảy ra $P=3$ -> $RPN = 24$ (Mức cao, phân loại `CRITICAL`).
  4. Lập tức phong tỏa toàn bộ bán thành phẩm dập viên trong ca làm việc.
  5. Tự động kích hoạt tạo kế hoạch `CAPA-2026-005` thay thế màng lọc và đánh giá vi sinh môi trường.

---

### S-012: CAPA Closed-Loop - Hành Động Khắc Phục Phòng Ngừa

- **Mục tiêu**: Đóng vòng lặp CAPA với đánh giá hiệu quả sau 3 tháng.
- **Actors**: `Kỹ sư cơ điện`, `QA Manager`.
- **Các bước thực hiện**:
  1. Kế hoạch CAPA gồm 2 hành động: Thay màng lọc HEPA mới và Đào tạo SOP kiểm tra chênh áp.
  2. Kỹ sư cơ điện thay màng lọc và tải biên bản nghiệm thu lên hệ thống.
  3. Sau 90 ngày vận hành, QA Manager kiểm tra log chênh áp phòng sạch: Không phát hiện bất kỳ sự cố rò rỉ nào tái diễn (`recurrenceObserved = false`).
  4. QA Manager ký số phê duyệt đóng CAPA (`CLOSED`).

---

### S-013: Immutable CoA Generation & QR Verification

- **Mục tiêu**: Bảo đảm tính bất biến của CoA và khả năng tra cứu nguồn gốc trực tuyến.
- **Actors**: `QA Manager`, `Khách hàng / Thanh tra viên`.
- **Các bước thực hiện**:
  1. Lô xuất xưởng thành công, QA Manager ký phát hành CoA số `COA-2026-001`.
  2. Hệ thống đóng băng Snapshot toàn bộ chỉ tiêu và tính mã băm SHA-256: `a3f8b...`.
  3. Hệ thống tạo mã QR chứa liên kết: `https://v-biotech.web.app/verify/COA-2026-001?hash=a3f8b...`.
  4. Thanh tra viên dùng điện thoại quét mã QR: Hệ thống hiển thị trang tra cứu xác thực với dấu tích xanh: "CHỨNG THƯ CHÍNH HÃNG - DỮ LIỆU TOÀN VẸN 100%".

---

### S-014: ALCOA+ Audit Trail & Cryptographic Hash Chaining

- **Mục tiêu**: Phát hiện hành vi gian lận can thiệp trực tiếp vào database.
- **Actors**: `Kẻ tấn công / Admin xấu`, `Hệ thống kiểm toán tự động`.
- **Các bước thực hiện**:
  1. Hệ thống ghi nhận 1,000 bản ghi audit trail được nối chuỗi mã băm: `Hash_N = SHA256(Payload_N + Hash_{N-1})`.
  2. Một kẻ tấn công truy cập thẳng vào database sửa giá trị của bản ghi số 500 từ 85 thành 98.
  3. Hệ thống chạy tiến trình kiểm tra toàn vẹn chuỗi định kỳ: Quét tới bản ghi 501 phát hiện `previousHash` không khớp với mã băm tính toán lại của bản ghi 500.
  4. Hệ thống lập tức phát báo động an ninh `SECURITY_ALERT_TAMPERED`, khóa quyền sửa đổi và thông báo tới ban giám đốc.

---

### S-015: 21 CFR Part 11 Electronic Signature

- **Mục tiêu**: Kiểm tra tính pháp lý của chữ ký điện tử có cam kết trách nhiệm cá nhân.
- **Actors**: `Dược sĩ phụ trách QA`.
- **Các bước thực hiện**:
  1. Dược sĩ nhấn "Ký duyệt xuất xưởng".
  2. Popup hiển thị yêu cầu: Nhập lại mật khẩu, chọn ý nghĩa chữ ký ("Tôi chịu trách nhiệm pháp lý xuất xưởng lô này").
  3. Nhập sai mật khẩu 3 lần liên tiếp: Hệ thống tạm khóa tài khoản 15 phút và gửi email cảnh báo.
  4. Nhập đúng mật khẩu: Chữ ký số được gắn vào hồ sơ với đầy đủ Tên, Giờ UTC, Ý nghĩa và Checksum.

---

### S-016: Concurrent Modification & Optimistic Locking

- **Mục tiêu**: Xử lý xung đột ghi đồng thời khi 2 người cùng mở một phiếu kiểm nghiệm.
- **Actors**: `KTV Hùng`, `KTV Lan`.
- **Các bước thực hiện**:
  1. Cả Hùng và Lan cùng mở phiếu `PKN-001` (Version 1).
  2. Hùng nhập chỉ tiêu pH và bấm Lưu thành công -> Phiếu nâng lên Version 2.
  3. Lan nhập chỉ tiêu Độ ẩm và bấm Lưu: Hệ thống phát hiện phiên bản của Lan đang là 1 trong khi database đã là 2.
  4. Hệ thống báo lỗi xung đột phiên bản `ERR_CONCURRENT_MODIFICATION`, tự động nạp dữ liệu mới nhất của Hùng và giữ lại dữ liệu Lan vừa nhập để Lan xác nhận merge mà không bị mất số liệu.

---

### S-017: Legacy Data Ingestion & Sanitation

- **Mục tiêu**: Nạp và chuẩn hóa an toàn các hồ sơ kiểm nghiệm cũ từ Excel/hệ thống cũ.
- **Actors**: `Data Migration Specialist`.
- **Các bước thực hiện**:
  1. Chuyên viên nạp file dữ liệu 50 lô kiểm nghiệm cũ của năm 2024.
  2. Hệ thống phát hiện có 3 lô thiếu mã chỉ tiêu chuẩn hóa.
  3. Hệ thống tự động gắn cờ `LEGACY_MIGRATED` và phân loại vào nhóm cần rà soát bổ sung, không cho phép cấp phát số CoA mới nếu chưa được QA xác thực chuẩn hóa.

---

### S-018: AI Advisory Guardrails & Human Confirmation

- **Mục tiêu**: Kiểm tra rào chắn an toàn dược khoa khi ứng dụng Trí tuệ Nhân tạo.
- **Actors**: `AI Model`, `Kỹ thuật viên KCS`.
- **Các bước thực hiện**:
  1. Kỹ thuật viên tải ảnh scan Phiếu kiểm nghiệm của nhà sản xuất nguyên liệu.
  2. AI OCR nhận diện văn bản và gợi ý ánh xạ tự động.
  3. AI đề xuất ánh xạ dòng chữ "Cảm quan: Bột kết tinh trắng" vào chỉ tiêu "Hàm lượng Paracetamol".
  4. Rào chắn Dược khoa (`isCriteriaMatch`) phát hiện xung đột loại phép thử (`QUALITATIVE` vs `NUMERIC ASSAY`), lập tức loại bỏ gợi ý này.
  5. Đối với các gợi ý hợp lệ, AI hiển thị bảng so sánh đề xuất; Kỹ thuật viên kiểm tra từng dòng và bấm "Áp dụng". Dữ liệu được lưu với vết kiểm toán `isAssistedByAI: true`.
