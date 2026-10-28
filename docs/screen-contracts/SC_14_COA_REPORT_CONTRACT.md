# HỢP ĐỒNG HÀNH VI GIAO DIỆN SC-14: XEM & IN PHIẾU PHÂN TÍCH (COA)

## (SCREEN CONTRACT SC-14: CERTIFICATE OF ANALYSIS REPORT)

> **Mã màn hình**: `SC-14`  
> **Route URL**: `/coa/:batchId`  
> **Component tương ứng**: `src/components/features/CoAReport.tsx`  
> **Tầm quan trọng**: 🔴 **CRITICAL - BẢO ĐẢM TÍNH PHÁP LÝ & BẤT BIẾN CỦA KẾT QUẢ IN RA**

---

### 1. NGUỒN DỮ LIỆU ĐẦU VÀO (DATA SOURCE INVARIANCE)

> ⛔ **CẤM TUYỆT ĐỐI**: Giao diện CoA không được phép tự tính toán lại logic so sánh Đạt/Không đạt, và không được tự động nội suy entry giả khi dữ liệu rỗng.

- Nguồn dữ liệu duy nhất: `batch.evaluationSnapshot`.
- Nếu `batch.evaluationSnapshot === undefined || batch.evaluationSnapshot === null`:
  - Màn hình hiển thị Banner cảnh báo: _"Lô này chưa hoàn tất thẩm định chất lượng chính thức. Không thể xuất CoA thương mại."_
  - Chỉ cho phép in bản nháp nội bộ có đóng watermark chéo: `DRAFT - CHƯA PHÊ DUYỆT`.

---

### 2. QUY CHUẨN HIỂN THỊ CỘT BẢNG KẾT QUẢ COA

| Cột trên CoA            | Nguồn trích xuất                      | Cách hiển thị                                                                                                                    |
| :---------------------- | :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------- |
| **STT**                 | Số thứ tự tăng dần                    | `1, 2, 3...`                                                                                                                     |
| **Tên chỉ tiêu**        | `entry.criteriaName`                  | Tiếng Việt có dấu, in đậm                                                                                                        |
| **Yêu cầu kỹ thuật**    | Giới hạn từ TCCS Snapshot             | Ví dụ: `≤ 9.0 %` hoặc `1.5 ~ 2.5 mg/viên`                                                                                        |
| **Kết quả kiểm nghiệm** | `entry.value` hoặc `entry.isExempted` | Nếu `entry.isExempted === true`: Hiển thị `"Đạt (*)"`. Nếu có số liệu: Format khoa học ($a \times 10^b$ hoặc số thập phân chuẩn) |
| **Phương pháp thử**     | `entry.analysisMethod`                | Ví dụ: `DĐVN V`                                                                                                                  |

---

### 3. VĂN BẢN CHÚ THÍCH PHÁP LÝ CHÂN TRANG (FOOTNOTE CONTRACT)

- Nếu trong danh sách `snapshot.criterionResults` có ít nhất 1 chỉ tiêu có `isExempted === true`:
  - Dưới bảng kết quả, hệ thống tự động in dòng chú thích chân trang:
    > _"(_) Miễn kiểm tra theo quy định của Tiêu chuẩn cơ sở khi chỉ tiêu chính tương ứng đã đạt yêu cầu."\*

---

### 4. MÃ QR XÁC THỰC CÔNG KHAI (PUBLIC VERIFICATION QR)

- Chân trang CoA bắt buộc in mã QR trỏ về URL:
  `https://v-biotech.web.app/verify/{batch.id}`
- Khi quét mã, trang xác thực hiển thị danh tính QA Director đã ký duyệt và dấu thời gian đóng băng snapshot.
