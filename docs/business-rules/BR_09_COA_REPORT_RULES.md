# BỘ QUY TẮC NGHIỆP VỤ 09: COA REPORT RULES

## (QUY TẮC HIỂN THỊ & XUẤT PHIẾU PHÂN TÍCH KẾT QUẢ)

> **Mã tài liệu**: `BR-CATALOG-09`  
> **Thư mục**: `docs/business-rules/BR_09_COA_REPORT_RULES.md`  
> **Phân hệ liên quan**: `MOD-15` (CoA Generation Workflow)

---

### BR-COA-001: Cấm Tính Toán Lại - Đọc Trực Tiếp Từ Snapshot Đã Khóa (No Re-calculation Rule)

- **Mục đích**: Khắc phục triệt để lỗi `GAP-02`: Đảm bảo nội dung in ra trên phiếu CoA trùng khớp 100% với bản thẩm định đã được QA Manager ký duyệt, không bị ảnh hưởng bởi code client.
- **Quy tắc bất biến**:
  - Giao diện Xem & In CoA (`SC-14`) **CHỈ ĐƯỢC PHÉP ĐỌC DỮ LIỆU TỪ `evaluationSnapshot`** của Lô.
  - CẤM giao diện CoA tự chạy các hàm so sánh `min`, `max`, `isPass` hoặc tự phân giải lại `AlternateRuleResolver`.
  - Nếu Lô chưa có `evaluationSnapshot` (chưa được duyệt) ➔ **CẤM XUẤT COA CHÍNH THỨC**, chỉ hiển thị bản nháp có đóng dấu mờ _"DRAFT - FOR INTERNAL USE ONLY"_.
- **Test Cases**: `TC-BR-COA-001-A` (CoA đọc chính xác từng dòng của EvaluationSnapshot).

---

### BR-COA-002: Cấm Tuyệt Đối Tự Động Nội Suy Dữ Liệu Thiếu (No Client-side Interpolation)

- **Mục đích**: Loại bỏ đoạn mã tàn dư trong `CoAReport.tsx` nơi client tự động bù đắp các chỉ tiêu thiếu hoặc rỗng.
- **Quy tắc cấm kỵ**:
  - Nếu một chỉ tiêu không có trong bản ghi `snapshot.criterionResults`, CoA hiển thị đúng trạng thái thiếu dữ liệu. Cấm client tự tạo thêm entry giả lập để "làm đẹp" báo cáo.
- **Test Cases**: `TC-BR-COA-002-A` (Không có hiện tượng tự sinh entry giả trên màn hình CoA).

---

### BR-COA-003: Định Dạng Khoa Học Của Giá Trị Kiểm Nghiệm (Scientific Formatting)

- **Mục đích**: Chuẩn hóa cách hiển thị số mũ khoa học đối với chỉ tiêu vi sinh vật và số chữ số thập phân đối với định lượng hóa học.
- **Quy tắc**:
  - Đối với giá trị vi sinh $\ge 10,000$ CFU hoặc $\le 0.00001$: Hiển thị dạng số mũ chuẩn $a \times 10^b$ (ví dụ: $1.5 \times 10^3$ thay vì `1500` hoặc `1.5e3`).
  - Số chữ số sau dấu phẩy của kết quả phải đồng bộ với số chữ số quy định trong giới hạn của TCCS (ví dụ: TCCS ghi $\ge 90.0\%$ thì kết quả phải hiển thị `92.4%`, không hiển thị `92.4128%`).
- **Test Cases**: `TC-BR-COA-003-A` (Format đúng số mũ khoa học và số thập phân).
