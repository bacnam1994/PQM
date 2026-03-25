# CẤU TRÚC LOGIC HỆ THỐNG (SYSTEM LOGIC)

> **LƯU Ý CHO AI:** Khi chỉnh sửa code, vui lòng tuân thủ nghiêm ngặt các quy tắc logic dưới đây để tránh hồi quy (regression) hoặc ghi đè tính năng đã có.

## 1. Logic Chọn Tiêu Chuẩn Cơ Sở (TCCS)
**File liên quan:** `hooks/useTestResultLogic.ts`, `pages/TestResultList.tsx`

*   **Mặc định:** Hệ thống tự động chọn phiên bản TCCS dựa trên **Ngày sản xuất (MfgDate)** của Lô hàng.
    *   Tìm tất cả TCCS của sản phẩm đó.
    *   Chọn bản TCCS có `issueDate` (ngày ban hành) gần nhất nhưng **nhỏ hơn hoặc bằng** `mfgDate` của lô.
    *   Nếu lô chưa có ngày SX, chọn bản TCCS mới nhất hiện hành.
*   **Thủ công:** Người dùng có thể chọn phiên bản TCCS khác (dropdown). Nếu chọn khác bản mặc định/hiện hành, hệ thống hiển thị cảnh báo.
*   **Copy:** Khi tạo lô mới, TCCS ID được lưu cứng vào Lô để đảm bảo lịch sử (dù sau này có TCCS mới hơn, lô cũ vẫn dùng TCCS cũ).

## 2. Logic Đánh Giá Kết Quả (Evaluation)
**File liên quan:** `utils/criteriaEvaluation.ts`, `components/CriteriaInputGroup.tsx`

*   **Chuẩn hóa số liệu:**
    *   Dấu thập phân: Tự động nhận diện dấu chấm (.) hoặc phẩy (,) dựa trên cài đặt `localStorage`.
    *   Số mũ: Hỗ trợ định dạng `10^3`, `10 3`, `1.5x10^5`.
*   **So sánh:**
    *   Hỗ trợ toán tử: `<`, `>`, `≤`, `≥`.
    *   Hỗ trợ khoảng: `min - max`, `min ~ max`.
    *   Hỗ trợ dung sai: `Giá trị ± Dung sai` (VD: `10 ± 5%`, `5 ± 0.5`).
*   **Làm tròn số (Rounding):**
    *   Hệ thống tự động xác định số chữ số thập phân cần làm tròn dựa trên `expectedText` của TCCS.
    *   Ví dụ: Nếu `expectedText` là "≤ 0.50" (2 chữ số thập phân), kết quả nhập vào `0.501` sẽ được làm tròn thành `0.50` trước khi so sánh.
    *   Sử dụng phương pháp làm tròn toán học thông thường.
## 3. Logic Quy Tắc Thay Thế (Alternate Rules)
**File liên quan:** `hooks/useTestResultLogic.ts`

*   **Mục đích:** Giảm tải nhập liệu cho các chỉ tiêu phụ thuộc.
*   **Cơ chế:**
    *   Nếu chỉ tiêu chính (TC1) **ĐẠT**, hệ thống tự động đánh dấu chỉ tiêu phụ (TC2) là **ĐẠT** (điền giá trị: "Đạt (theo quy tắc thay thế)").
    *   Nếu TC1 **KHÔNG ĐẠT**, người dùng bắt buộc phải nhập kết quả cho TC2.
    *   Khi lưu (`handleSaveResult`), cờ `isAutoPassed` được bật để bỏ qua validate giá trị số cho TC2.

## 4. Logic Trạng Thái Lô (Batch Status)
**File liên quan:** `pages/BatchList.tsx`, `context/AppContext.tsx`

*   **PENDING (Kế hoạch):** Mới tạo, chưa có kết quả kiểm nghiệm.
*   **TESTING (Đang kiểm):** Đã có ít nhất 1 kết quả kiểm nghiệm hoặc người dùng chuyển trạng thái thủ công. (Màu: Xanh dương).
*   **RELEASED (Phê duyệt):** Tất cả chỉ tiêu đạt, được Admin/Manager duyệt. (Màu: Xanh lá).
*   **REJECTED (Loại bỏ):** Có chỉ tiêu không đạt hoặc bị từ chối thủ công. (Màu: Đỏ).
*   **Chuyển trạng thái:**
    *   Có thể chuyển thủ công tại màn hình `BatchList` (yêu cầu quyền Admin).
    *   Tự động chuyển sang `TESTING` khi bắt đầu nhập kết quả.

## 5. Cấu trúc Dữ liệu (Data Structure)
*   **Batch:** Liên kết với `Product` qua `productId` và `TCCS` qua `tccsId`.
*   **TestResult:** Lưu snapshot kết quả tại thời điểm kiểm. Một lô có thể có nhiều TestResult (kiểm đi kiểm lại).
*   **TCCS:** Có phiên bản (versioning) dựa trên `issueDate`. Không xóa vật lý TCCS nếu đã được sử dụng bởi Lô.
    *   **ProductFormula:** Chứa công thức thành phần và thông tin đặc tính (Cảm quan, Bao bì, Hạn dùng). Quan hệ 1-1 với Product.

## 6. Lưu ý quan trọng
*   Không được xóa hàm `normalizeNumericString` hoặc `checkRange` trong `utils`.
*   Không được hardcode logic đánh giá trong Component (`.tsx`), phải gọi qua hook hoặc utils.
*   Khi sửa `BatchList`, chú ý logic `handleAddBatch` phải lấy TCCS mới nhất.

## 7. Logic Công thức Sản phẩm (Product Formula)
**File liên quan:** `pages/ProductFormulaList.tsx`, `pages/MaterialList.tsx`, `components/CoAReport.tsx`

*   **Vai trò:** Là nguồn dữ liệu duy nhất cho:
    *   Thành phần công thức, bao gồm **Hoạt chất** (active ingredients) và **Tá dược/Phụ liệu** (excipients).
    *   Thông tin đặc tính: Cảm quan, Bao bì, Hạn dùng, Bảo quản.
    *   Tính toán hàm lượng % trên phiếu CoA.
*   **Quan hệ:** 1 Sản phẩm có tối đa 1 Công thức (1-1).
*   **Tự động hóa:**
    *   Danh sách "Nguyên liệu" được tổng hợp tự động từ cả Hoạt chất và Tá dược của tất cả các Công thức.
    *   Khi in CoA, hệ thống lấy thông tin Cảm quan/Bao bì từ Công thức (thay vì TCCS như trước đây).
*   **Cấu trúc dữ liệu:** Công thức sản phẩm chứa 2 danh sách riêng biệt: `ingredients` cho hoạt chất và `excipients` cho tá dược.
