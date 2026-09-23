# BỘ QUY TẮC NỀN TẢNG CHO OCR PHIẾU KIỂM NGHIỆM (OCR_RULES.md)

Tài liệu này định nghĩa các quy tắc bất biến dành riêng cho luồng trích xuất dữ liệu Phiếu Kiểm Nghiệm (PKN) bằng công nghệ OCR & AI Vision trong hệ thống PQM.

---

## 1. Không Tự Suy Đoán Giá Trị Không Nhìn Thấy (Never Infer Invisible Values)

- Nếu một ô kết quả, chữ ký, số lô hoặc ngày tháng trên ảnh/PDF bị che khuất, bị rách, nhòe mờ không thể đọc rõ, AI **BẮT BUỘC PHẢI BỎ TRỐNG** hoặc ghi nhận `UNREADABLE`.
- Tuyệt đối cấm AI tự "đoán mò" giá trị dựa trên kiến thức thông thường hoặc dựa trên tiêu chuẩn TCCS.

## 2. Tuyệt Đối Không Tự Tạo Số Liệu (Zero Hallucination / Zero Fabrication)

- Mọi con số (kết quả định lượng, phần trăm, hàm lượng, số CFU) đưa vào biểu mẫu phải có bằng chứng hình ảnh (Pixel Evidence) trên tài liệu gốc.
- Không được tự động sinh số ngẫu nhiên hoặc gán số trung bình để "cho đủ bộ dữ liệu".

## 3. Không Thay Đổi Dấu Thập Phân (Preserve Decimal Delimiters)

- Trong tài liệu Dược, `0.05` khác hoàn toàn với `0.5` hoặc `50`.
- Không được làm mất dấu chấm/phẩy thập phân, không tự ý làm tròn số (ví dụ `502.48 mg` không được làm tròn thành `502.5 mg` trừ khi tài liệu ghi rõ như vậy).

## 4. Không Bỏ Qua Đơn Vị Đo (Mandatory Unit Preservation)

- Đơn vị đo là một phần không thể tách rời của kết quả kiểm nghiệm: `ppm`, `ppb`, `%`, `mg/viên`, `CFU/g`, `CFU/ml`, `g/ml`, `pH`.
- Phải trích xuất và bảo lưu chính xác đơn vị đo được ghi trên phiếu; không được tự ý đổi đơn vị đo khi chưa có xác nhận của người dùng.

## 5. Phân Biệt Tuyệt Đối Giữa Giá Trị Đo (Value) và Mức Giới Hạn (Limit)

- Trên phiếu kiểm nghiệm, cột **"Mức chất lượng / Giới hạn"** (Specification/Limit) và cột **"Kết quả thử nghiệm"** (Actual Value) là hai khái niệm khác nhau hoàn toàn:
  - _Ví dụ_: Cột Tiêu chuẩn ghi `≤ 10.0 ppm`, cột Kết quả ghi `1.2 ppm`.
- Tuyệt đối không nhầm lẫn đưa giá trị mức giới hạn vào ô kết quả thực tế.

## 6. Bảo Toàn Nguyên Bản Ký Hiệu So Sánh & Ký Hiệu Khoa Học

- Giữ nguyên các ký tự toán học: `≤`, `≥`, `<`, `>`, `±`, `=`, `~`.
- Giữ nguyên ký hiệu mũ và lũy thừa trong vi sinh: `×10³`, `×10⁴`, `1.5 x 10^3 CFU/g`.
- Không được tự ý cắt bỏ ký tự `<` (ví dụ: `< 0.01` không được biến thành `0.01`).

## 7. Bảo Lưu Thông Tin Trang Nguồn (Preserve Source Page Index)

- Mỗi chỉ tiêu trích xuất được phải lưu kèm metadata: `sourcePageNumber` (chỉ tiêu này nằm ở trang mấy của tài liệu).
- Phục vụ việc hiển thị trên giao diện đối chiếu (Side-by-side Review UI) để người dùng bấm vào chỉ tiêu là màn hình cuộn ngay đến trang tài liệu tương ứng.

## 8. Không Mất Dữ Liệu Khi PKN Có Nhiều Trang (Zero Loss Across Multi-page)

- Đối với PKN kéo dài từ 2 đến 10 trang: Toàn bộ bảng nối trang, các hàng chỉ tiêu nằm ở cuối trang trước và đầu trang sau phải được gộp (merge) đầy đủ.
- Tổng số chỉ tiêu trích xuất được phải bằng đúng tổng số hàng trên tất cả các trang của tài liệu.

## 9. Bảo Tồn Dữ Liệu Thô (Raw OCR Preservation)

- Toàn bộ chuỗi văn bản thô (Raw OCR Text / Raw Vision Response) phải được lưu giữ nguyên bản tại trường `rawOcrText` hoặc `rawExtractionPayload`.
- Không được ghi đè hoặc làm biến mất dữ liệu thô này trong suốt chu trình xử lý tiếp theo.

## 10. Tách Bạch Tuyệt Đối Giữa Trích Xuất (Extraction) và Ánh Xạ (Mapping)

- Bước 1 (Trích xuất): Nhiệm vụ duy nhất là đọc đúng những gì văn bản ghi lại (`criteriaName: "Chì"`, `actualResult: "0.05 ppm"`).
- Bước 2 (Ánh xạ): Sau khi đã trích xuất xong, mới chuyển sang module Mapping để khớp nối với danh mục TCCS.
- Hai bước này là hai tiến trình độc lập; lỗi ở bước Mapping không được phép làm sai lệch dữ liệu đã trích xuất ở Bước 1.

## 11. Lưu Riêng Chỉ Số Độ Tin Cậy (Decoupled Confidence Score)

- Mỗi trường dữ liệu và chỉ tiêu trích xuất phải có điểm độ tin cậy riêng biệt (`confidence: number` từ 0 đến 100%).
- Điểm confidence không được hòa lẫn vào giá trị dữ liệu mà phải lưu trữ ở trường metadata riêng.

## 12. Cảnh Báo Bắt Buộc Với Độ Tin Cậy Thấp (LOW Confidence Guard)

- Mọi trường dữ liệu có độ tin cậy thấp (`confidence < 75%` hoặc `LOW`):
  - **TUYỆT ĐỐI CẤM** tự động gán là dữ liệu chính xác vào biểu mẫu.
  - Phải gắn cờ cảnh báo màu vàng/đỏ trên giao diện Review để bắt buộc nhân sự QA/QC đối soát và xác nhận bằng tay.
