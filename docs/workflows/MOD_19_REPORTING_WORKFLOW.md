# PHÂN HỆ 19: REPORTING & ANALYTICS WORKFLOW

## (QUY TRÌNH BÁO CÁO CHẤT LƯỢNG & PHÂN TÍCH XU HƯỚNG SPC)

> **Mã phân hệ**: `MOD-19`  
> **Tài liệu**: `docs/workflows/MOD_19_REPORTING_WORKFLOW.md`  
> **Phạm vi**: Báo cáo Đánh giá Chất lượng Sản phẩm Hàng năm (APQR/PQR), Biểu đồ kiểm soát quá trình bằng thống kê (SPC), Chỉ số năng lực quá trình (Cp, Cpk) và Phát hiện xu hướng trôi dạt (Trend Drifting).

---

### 1. MỤC ĐÍCH (PURPOSE)

Chuyển hóa dữ liệu kiểm nghiệm tĩnh thành thông tin quản trị chất lượng dự báo:

1. Đáp ứng yêu cầu pháp lý về Báo cáo APQR theo GMP.
2. Ứng dụng thống kê để cảnh báo sớm sự suy giảm chất lượng hoặc sự mất ổn định của dây chuyền sản xuất trước khi sản phẩm thực sự vượt ngưỡng OOS.

---

### 2. CÁC LOẠI BÁO CÁO VÀ CHỈ SỐ THỐNG KÊ CỐT LÕI

1. **Báo cáo APQR (Annual Product Quality Review)**:
   - Tổng hợp 100% các lô sản xuất của một sản phẩm trong năm.
   - Thống kê tỷ lệ Đạt lần đầu (First Pass Yield).
   - Thống kê số lượng OOS, Deviation, CAPA và Khiếu nại khách hàng.
2. **Biểu đồ Kiểm soát Thống kê (Shewhart Control Charts)**:
   - Đường trung bình ($\bar{X}$).
   - Giới hạn kiểm soát trên (Upper Control Limit - UCL = $\mu + 3\sigma$).
   - Giới hạn kiểm soát dưới (Lower Control Limit - LCL = $\mu - 3\sigma$).
3. **Chỉ số Năng lực Quá trình (Process Capability)**:
   - $Cp = \frac{USL - LSL}{6\sigma}$ (Độ rộng quá trình so với độ rộng tiêu chuẩn).
   - $Cpk = \min\left(\frac{USL - \mu}{3\sigma}, \frac{\mu - LSL}{3\sigma}\right)$ (Khả năng định tâm của quá trình).
   - **Quy chuẩn**: $Cpk \ge 1.33$ là quá trình đạt năng lực ổn định cao.

---

### 3. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-REP-01`: Hệ thống tính toán tự động các chỉ số thống kê Mean, StdDev, Min, Max, Cpk theo thời gian thực.
- `AC-REP-02`: Tự động cảnh báo màu vàng khi có 7 điểm liên tiếp có xu hướng tăng dần hoặc giảm dần (Quy tắc Nelson / Western Electric).
