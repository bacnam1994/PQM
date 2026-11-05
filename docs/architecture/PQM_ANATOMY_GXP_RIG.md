# PQM Anatomy GxP Verification Rig — Đặc Tả Kiến Trúc Cơ Khí Trực Quan

> **Phiên bản**: 1.0.0 (Tương thích PQM Kernel 11.108.0)  
> **Tiêu chuẩn thiết kế**: [Skill Anatomy](file:///C:/Users/bacna/.gemini/config/skills/anatomy/SKILL.md) & [Master Rules](file:///e:/7%20PQM/.vibecode/PQM_MASTER_RULES.md)  
> **Nguyên lý cốt lõi**: _"The object is the explanation. Don't draw boxes, arrows and labels. Invent a real, well-made physical thing whose working is the concept."_

---

## 1. Triết Lý & Bối Cảnh

Hệ thống Quản lý Chất lượng Dược phẩm PQM (V-Biotech) bảo vệ an toàn xuất xưởng dược phẩm bằng **7 Release Gates** và cơ chế bảo mật **ALCOA+ SHA-256 Tamper Detection** (21 CFR Part 11). Tuy nhiên, các khái niệm an toàn dữ liệu số thường mang tính trừu tượng cao, gây khó khăn cho thanh tra viên, khách hàng quét QR CoA và nhân viên QC khi cần hình dung cách thức hệ thống khóa bảo vệ.

Thay vì hiển thị các khối sơ đồ phẳng (boxes & arrows) vô hồn, **`AnatomyVerificationRig`** hiện thực hóa quy trình kiểm định chất lượng thành một **Trạm Cơ Khí Đo Kiểm Chính Xác & Khóa Niêm Phong 7 Cửa ALCOA+** dưới phối cảnh đẳng cự (Isometric 30°), chế tác với bảng 4 sắc thái cơ khí (`ironPlate`, `railSteel`, `brassPlate`, halos, anti-vibration feet, knurled screws, master dial indicator).

```
                            [ĐỒNG HỒ SO CHÍNH XÁC (DIAL INDICATOR)]
                                     |  PASS ZONE (Xanh) / FAIL ZONE (Đỏ)
                                     v  Kim đo micron quay động theo trạng thái
  [CỔNG 1]  [CỔNG 2]  [CỔNG 3]  [CỔNG 4]  [CỔNG 5]  [CỔNG 6]  [CỔNG 7]
    TCCS     100%      0 OOS      LAB     Quy tắc   SHA-256    Chữ Ký
   Chuẩn   Chỉ tiêu   Phát hiện  Chuẩn   Thay thế   Niêm phong 21 CFR 11
     |        |          |         |        |          |          |
====[===================RAY TRƯỢT THÉP TUYẾN TÍNH===================]====
                   [XE TRƯỢT CARRIAGE + ĐẦU DÒ KIM CƯƠNG]
```

---

## 2. Bảng Đối Chiếu 1-1: 7 Cổng Cơ Khí & 7 Release Gates

Mỗi trụ thép kiểm định trên sàn cơ khí đại diện chính xác cho một cổng kiểm tra bất biến trong Workflow Kernel của PQM:

| Chốt Cơ Khí | Cổng Kiểm Định (Release Gate) | Trạng Thái Hạ Chốt (Locked / OK)                           | Trạng Thái Thụt Chốt (Fail-Closed)                |
| ----------- | ----------------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| **G1**      | **TCCS Active Verification**  | Lô gắn đúng TCCS có hiệu lực, thông số khớp đăng ký        | Chưa gán TCCS hoặc TCCS đã hết hiệu lực           |
| **G2**      | **Criteria Full Completion**  | 100% chỉ tiêu theo TCCS đã được kiểm nghiệm đầy đủ         | Còn chỉ tiêu chưa có kết quả kiểm nghiệm          |
| **G3**      | **Zero OOS / Deviation**      | Toàn bộ chỉ tiêu có kết quả nằm trong giới hạn cho phép    | Phát hiện ít nhất 1 chỉ tiêu OOS (Không đạt)      |
| **G4**      | **Accredited Testing Lab**    | Phòng kiểm nghiệm nội bộ hoặc ngoại kiểm đạt chuẩn ISO/GLP | Phiếu thiếu chứng chỉ phòng lab công nhận         |
| **G5**      | **Alternate Testing Rule**    | Kiểm nghiệm định kỳ/thay thế tuân thủ quy tắc ma trận TCCS | Thiếu kết quả kiểm nghiệm ngoại kiểm bắt buộc     |
| **G6**      | **SHA-256 Snapshot Seal**     | Mã băm SHA-256 khớp 100% với `EvaluationSnapshot`          | Dữ liệu bị can thiệp trái phép (Tamper Detection) |
| **G7**      | **21 CFR Part 11 Signature**  | Trưởng phòng QA ký điện tử bảo mật với ý nghĩa pháp lý     | Chưa hoàn tất phê duyệt chữ ký điện tử hợp lệ     |

---

## 3. Các Thành Phần Chi Tiết của Trạm Đo Kiểm

### 3.1. Khung Đế Giảm Chấn Nặng (Heavy Base Plate & Anti-Vibration Feet)

- Được đúc bằng hợp kim gang xám kết cấu Isometric đa giác.
- 4 chân đế cao su chống rung tại các tọa độ chịu lực chính.
- Bề mặt sàn khắc vạch thước đo mm chính xác và ốc cố định vát cạnh chamfer.
- Tấm nhãn đồng khắc tên chìm: `PQM-GxP·VERIFY-RIG·2026`.

### 3.2. Cặp Ray Trượt Tuyến Tính & Xe Trượt Carriage

- 2 thanh ray thép tôi cao tần kéo dài dọc theo 7 cổng kiểm định.
- Khối trượt (Inspection Carriage) trang bị đầu dò sapphire/kim cương tiếp xúc bề mặt mẫu dược phẩm.
- Hai cụm lò xo giảm chấn hai bên giữ cho đầu dò di chuyển êm ái khi người dùng tinh chỉnh thanh trượt micrometer.

### 3.3. Đồng Hồ So Đo Micron Cơ Khí (Master Precision Dial Indicator)

- Vỏ tròn cơ khí có gờ khía nhám (knurled ring) và ốc siết khóa vị trí.
- Mặt đồng hồ số phân độ 24 nấc với hai dải cung màu quang học:
  - **Vùng XANH (PASS / Released)**: Độ lệch từ 0 đến +120°.
  - **Vùng ĐỎ (FAIL / Blocked)**: Độ lệch từ -45° đến -80°.
- Kim đo đỏ đối trọng quay mượt mà bằng CSS transition (`ease-out`) khi chuyển trạng thái kiểm định.

---

## 4. Ba Chế Độ Mô Phỏng Thực Tế (Simulation Modes)

1. **`✓ 7 Cổng Đạt Chuẩn (Release)`**:
   - Cả 7 chốt cơ khí hạ xuống khóa chặt vào rãnh định vị.
   - 7 đèn LED trên đỉnh trụ sáng xanh ổn định (`#10b981`).
   - Kim đồng hồ so chỉ thẳng vào tâm vùng PASS an toàn.
   - Trạng thái thông báo: `7/7 CỔNG HỢP LỆ · CHỮ KÝ SHA-256 NIÊM PHONG · ĐẠT XUẤT XƯỞNG`.

2. **`⚠ Phát hiện OOS (Chặn Cổng 3)`**:
   - Trụ G3 thụt chốt cơ khí lên cao, cản trở xe trượt Carriage hoàn tất hành trình.
   - Đèn LED cổng G3 nhấp nháy đỏ (`#f43f5e`).
   - Kim đồng hồ so giật lùi về cung cảnh báo đỏ (-45°).
   - Hệ thống khóa bảo vệ Fail-Closed ngay lập tức.

3. **`🛡️ Sai lệch băm SHA-256 (Khóa Fail-Closed)`**:
   - Trụ G6 phát tín hiệu bất thường do chữ ký số của bản chụp thẩm định không khớp.
   - Đèn LED cổng G6 nhấp nháy vàng cam (`#f59e0b`).
   - Kim đồng hồ so chuyển về vị trí lệch cực đại (-80°).
   - Toàn bộ trạm cơ khí đóng chốt bảo vệ dữ liệu.

---

## 5. Điểm Tích Hợp Trên Hệ Thống

1. **Trang Xác Thực CoA Công Khai (`src/pages/public/CoAVerifyPage.tsx`)**:
   - Hiển thị trực quan cho đối tác, nhà thuốc khi quét mã QR trên bản in CoA.
   - Tự động nhận diện trạng thái của Lô thuốc và hiển thị trạng thái cơ khí tương ứng.

2. **Trang Báo Cáo & In CoA QA (`src/pages/qa/CoAReportPage.tsx`)**:
   - Khi kích hoạt rào chắn ALCOA+ Tamper Gate (Fail-Closed), trạm cơ khí xuất hiện minh họa trực quan sự cố sai lệch mã băm để QA nhận biết và bấm "Tái niêm phong ALCOA+".
