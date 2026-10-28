# BỘ QUY TẮC NGHIỆP VỤ 07: OOS & DEVIATION RULES

## (QUY TẮC XỬ LÝ KẾT QUẢ NGOÀI TIÊU CHUẨN & SAI LỆCH)

> **Mã tài liệu**: `BR-CATALOG-07`  
> **Thư mục**: `docs/business-rules/BR_07_OOS_DEVIATION_RULES.md`  
> **Phân hệ liên quan**: `MOD-10` (OOS) & `MOD-11` (Deviation)

---

### BR-OOS-001: Tự Động Kích Hoạt Hồ Sơ OOS Khi Chỉ Tiêu FAIL Chính Thức

- **Mục đích**: Tuân thủ quy định cGMP về việc điều tra kết quả ngoài tiêu chuẩn, cấm bỏ qua hoặc thử lại tùy tiện để tìm kết quả đạt.
- **Trigger**: Khi Động cơ `QualityEvaluationEngine` xác định một chỉ tiêu có trạng thái `FAIL` (và không có Alternate Rule nào cứu vãn).
- **Điều kiện & Quyết định**:
  - Hệ thống tự động tạo bản ghi OOS trong phân hệ `MOD-10`:
    - `oosNumber`: Mã tự sinh (VD: `OOS-240922-01`).
    - `batchId`, `testResultId`, `criterionId`, `failedValue`.
    - `status = 'INITIATED'`.
  - Tự động gán cờ `batch.hasActiveOOS = true` lên Lô sản xuất liên quan.
- **Test Cases**: `TC-BR-OOS-001-A` (Chỉ tiêu FAIL ➔ Hồ sơ OOS tự động sinh ra).

---

### BR-OOS-002: Chốt Chặn Khóa Xuất Xưởng Tuyệt Đối (Release Gate Hard Block On OOS)

- **Mục đích**: Không một Lô nào có nghi vấn hoặc xác nhận lỗi chất lượng được phép đưa ra thị trường.
- **Trigger**: Khi kiểm tra điều kiện xuất xưởng của Lô (`SC-10`).
- **Điều kiện & Quyết định**:
  ```
  IF (batch.hasActiveOOS === true)
      THEN KHÓA CHẶT TRẠNG THÁI RELEASED (HARD BLOCK)
      Nút "Ký lệnh xuất xưởng" bị ẩn/vô hiệu hóa hoàn toàn
  ```
- **Điều kiện gỡ bỏ Block**: Hồ sơ OOS phải được đóng với kết luận:
  - Hoặc `INVALIDATED`: Lỗi do thao tác phòng kiểm nghiệm, đã có kết quả thử lại đạt chuẩn được QA ký duyệt.
  - Hoặc `CONFIRMED_OOS`: Xác nhận lỗi chất lượng ➔ Lô lập tức chuyển sang trạng thái `REJECTED` (Tiêu hủy / Không được xuất xưởng).
- **Test Cases**: `TC-BR-OOS-002-A` (OOS đang mở ➔ Không thể chuyển Lô sang RELEASED).
