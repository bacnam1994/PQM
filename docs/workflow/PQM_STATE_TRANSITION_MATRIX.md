# 🔄 PQM STATE TRANSITION MATRIX

## MA TRẬN CHUYỂN ĐỔI TRẠNG THÁI TOÀN HỆ THỐNG (MODEL 00)

> **Căn cứ:** Mô hình máy trạng thái hữu hạn (Finite State Machine - Model 10) trong `src/domain/workflow/stateMachine.ts`.

---

## 1. MA TRẬN CHUYỂN ĐỔI TRẠNG THÁI LÔ SẢN XUẤT (`BatchStateMachine`)

| Trạng thái hiện tại (`From`) | Hành động (`Action`) | Trạng thái đích (`To`) | Vai trò bắt buộc (`Actor`) | Điều kiện tiên quyết (`Preconditions`)  | Hành vi bị cấm (`Forbidden`)     | Nhật ký kiểm toán (`Audit`) |
| :--------------------------- | :------------------- | :--------------------- | :------------------------- | :-------------------------------------- | :------------------------------- | :-------------------------: |
| **`PENDING`**                | `START_TESTING`      | `TESTING`              | `LAB`, `PRODUCTION`, `QA`  | Lô hợp lệ, đã gán mẫu                   | Nhảy cóc sang `RELEASED`         |          Bắt buộc           |
| **`PENDING`**                | `REJECT_BATCH`       | `REJECTED`             | `QA`, `ADMIN`              | Có lý do hủy lô rõ ràng                 | Hủy không có lý do               |          Bắt buộc           |
| **`TESTING`**                | `RELEASE_BATCH`      | `RELEASED`             | `QA`, `ADMIN`              | Đạt 100% 7 điều kiện Release Gate       | Bất kỳ chỉ tiêu nào FAIL         |      Bắt buộc (E-Sign)      |
| **`TESTING`**                | `REJECT_BATCH`       | `REJECTED`             | `QA`, `ADMIN`              | Có chỉ tiêu OOS không thể cứu xét       | Từ chối không giải trình         |      Bắt buộc (E-Sign)      |
| **`TESTING`**                | `BLOCK_BATCH`        | `BLOCKED`              | `QA`, `ADMIN`              | Nghi ngờ sự cố thiết bị/nhiễm chéo      | Chặn không lý do                 |          Bắt buộc           |
| **`RELEASED`**               | `RECALL_BATCH`       | `BLOCKED`              | `QA`, `ADMIN`              | Có thông báo thu hồi hoặc sự cố an toàn | Quay về `PENDING` hoặc `TESTING` |      Bắt buộc (E-Sign)      |
| **`BLOCKED`**                | `RETEST_BATCH`       | `TESTING`              | `QA`, `ADMIN`              | Kế hoạch tái thẩm định được duyệt       | Tự ý mở khóa mà không thử lại    |          Bắt buộc           |
| **`BLOCKED`**                | `SCRAP_BATCH`        | `REJECTED`             | `QA`, `ADMIN`              | Kết luận tiêu hủy lô                    | Phục hồi thành `RELEASED`        |      Bắt buộc (E-Sign)      |
| **`REJECTED`**               | `REOPEN_WITH_CAPA`   | `PENDING`              | `ADMIN` (Kèm QA)           | Biên bản giải trình CAPA hợp lệ         | Chuyển trực tiếp sang `RELEASED` |      Bắt buộc (E-Sign)      |

---

## 2. MA TRẬN CHUYỂN ĐỔI TRẠNG THÁI PHIẾU KIỂM NGHIỆM (`TestResultStateMachine`)

| Trạng thái hiện tại (`From`) | Hành động (`Action`) | Trạng thái đích (`To`) | Vai trò bắt buộc (`Actor`) | Điều kiện tiên quyết (`Preconditions`) | Hành vi bị cấm (`Forbidden`)    | Nhật ký kiểm toán (`Audit`) |
| :--------------------------- | :------------------- | :--------------------- | :------------------------- | :------------------------------------- | :------------------------------ | :-------------------------: |
| **`DRAFT`**                  | `SUBMIT_FOR_REVIEW`  | `SUBMITTED`            | `LAB`, `QC`, `QA`          | Đầy đủ kết quả đo lường các chỉ tiêu   | Nộp phiếu rỗng                  |      Ghi nhận sự kiện       |
| **`SUBMITTED`**              | `REVISE_DRAFT`       | `DRAFT`                | `LAB`, `QC`                | Yêu cầu nhập lại số liệu đo lường      | Phiếu đã phê duyệt              |      Ghi nhận sự kiện       |
| **`SUBMITTED`**              | `FINALIZE_RESULT`    | `FINAL`                | `QC`, `QA`                 | Tất cả chỉ tiêu có kết luận rõ ràng    | Còn chỉ tiêu `PENDING`          |          Bắt buộc           |
| **`FINAL`**                  | `APPROVE_RESULT`     | `APPROVED`             | `QA`, `ADMIN`              | Thẩm định khớp tiêu chuẩn TCCS         | Duyệt PASS khi có chỉ tiêu FAIL |      Bắt buộc (E-Sign)      |
| **`FINAL` / `APPROVED`**     | `RETEST_NEW_RESULT`  | `SUPERSEDED`           | `QA`, `ADMIN`              | Khởi tạo phiếu kiểm nghiệm mới         | Sửa trực tiếp số liệu phiếu cũ  |          Bắt buộc           |
| **`SUPERSEDED`**             | _(Bất kỳ)_           | _(Không có)_           | _(Không cho phép)_         | **TRẠNG THÁI KẾT THÚC TUYỆT ĐỐI**      | **CẤM CHUYỂN ĐỔI TIẾP**         |             N/A             |

---

## 3. BẢNG MA TRẬN CHẤT LƯỢNG × VÒNG ĐỜI (QUALITY × WORKFLOW)

| Workflow Status  | Quality: `UNKNOWN` | Quality: `PENDING` | Quality: `PASS` |   Quality: `FAIL`    | Đánh giá tính hợp lệ               |
| :--------------- | :----------------: | :----------------: | :-------------: | :------------------: | :--------------------------------- |
| **`DRAFT`**      |     ✅ HỢP LỆ      |     ✅ HỢP LỆ      |    ✅ HỢP LỆ    |      ✅ HỢP LỆ       | Giai đoạn nhập liệu ban đầu        |
| **`SUBMITTED`**  |  ❌ KHÔNG HỢP LỆ   |     ✅ HỢP LỆ      |    ✅ HỢP LỆ    |      ✅ HỢP LỆ       | Phải có ít nhất kết quả sơ bộ      |
| **`FINAL`**      |  ❌ KHÔNG HỢP LỆ   |  ❌ KHÔNG HỢP LỆ   |    ✅ HỢP LỆ    |      ✅ HỢP LỆ       | Không được chốt khi còn dở dang    |
| **`APPROVED`**   |  ❌ KHÔNG HỢP LỆ   |  ❌ KHÔNG HỢP LỆ   |    ✅ HỢP LỆ    |      ✅ HỢP LỆ       | Duyệt kết quả ĐẠT hoặc duyệt OOS   |
| **`RELEASED`**   |  ❌ KHÔNG HỢP LỆ   |  ❌ KHÔNG HỢP LỆ   |    ✅ HỢP LỆ    | ❌ **CẤM TUYỆT ĐỐI** | Không bao giờ xuất xưởng hàng FAIL |
| **`SUPERSEDED`** |     ✅ HỢP LỆ      |     ✅ HỢP LỆ      |    ✅ HỢP LỆ    |      ✅ HỢP LỆ       | Lưu trữ hồ sơ lịch sử              |
