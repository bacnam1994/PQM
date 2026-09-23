# VIBECODE RULES FRAMEWORK — PQM

Tài liệu này định nghĩa 12 nguyên tắc vàng bất biến bảo vệ tính toàn vẹn của mã nguồn, luồng dữ liệu và trải nghiệm người dùng trong hệ thống PQM.

---

## 1. Nguyên Tắc Bảo Toàn Trạng Thái (Preserve Existing Behavior)

- Mọi chức năng, nút bấm, màn hình và logic nghiệp vụ đang hoạt động bình thường phải được bảo tồn 100%.
- Không được làm gián đoạn hoặc thay đổi kết quả đầu ra của các luồng nghiệp vụ hiện hữu khi thực hiện tính năng mới.

## 2. Kiểm Soát Phạm Vi Tuyệt Đối (No Out-of-Scope Changes)

- Chỉ sửa đổi chính xác các file và dòng mã nằm trong danh mục `Files in scope` của Phase hiện tại.
- Nghiêm cấm việc "tiện tay" sửa hoặc dọn dẹp các module không thuộc phạm vi công việc đã cam kết.

## 3. Không Tự Ý Refactor Lớn (No Arbitrary Large Refactoring)

- Nghiêm cấm việc tự ý viết lại (rewrite) kiến trúc, đổi thư viện, hoặc thay đổi cấu trúc thư mục cốt lõi nếu không có yêu cầu rõ ràng và kế hoạch phê duyệt trước.
- Giữ vững nguyên tắc: Các cải tiến phải theo dạng tiến hóa (evolutionary) và tương thích ngược (backward-compatible).

## 4. Bảo Vệ Cấu Trúc Component (Preserve Component Hierarchy)

- Không xáo trộn cây component (Component Tree), các props interface chuẩn, hoặc cơ chế phân tách giữa Presentation Components và Container/Page Components.
- Giữ vững các ranh giới kiến trúc đã được thiết lập trong hệ thống.

## 5. Bảo Toàn Logic Click & Tương Tác UI (Preserve User Interactions)

- Mọi hành vi click, submit form, modal open/close, phím tắt (keyboard shortcuts), điều hướng route (`useNavigate`) phải giữ nguyên phản hồi như thiết kế ban đầu.
- Tuyệt đối không thay đổi sự kiện click dẫn đến việc người dùng không thao tác được hoặc bị mất ngữ cảnh giao diện.

## 6. Bảo Vệ Luồng Dữ Liệu (Preserve Data Flow)

- Không làm gián đoạn chuỗi truyền dữ liệu từ Persistence Layer (Firebase RTDB / Repositories) $\rightarrow$ Domain Services $\rightarrow$ State Store (Zustand / TanStack Query) $\rightarrow$ Hooks $\rightarrow$ Components.
- Duy trì tính nhất quán của các khóa truy vấn TanStack Query Cache (`queryKeys`).

## 7. Không Làm Mất Dữ Liệu (No Data Loss Guarantee)

- Mọi thao tác chuyển đổi, nhập liệu, parse dữ liệu hoặc trích xuất AI phải đảm bảo nguyên tắc: **Không bao giờ làm mất dữ liệu gốc**.
- Khi người dùng đang nhập dở biểu mẫu, dữ liệu nháp (Draft state) phải được lưu trữ an toàn, không bị xóa sạch khi re-render hoặc reload trang.

## 8. Cấm Tuyệt Đối Lỗi Ngầm (No Silent Failures)

- Tuyệt đối cấm các pattern bẫy lỗi trống rỗng:
  ```ts
  // CẤM TUYỆT ĐỐI:
  try { ... } catch (e) { /* nuốt lỗi ngầm */ }
  ```
- Mọi lỗi phát sinh phải được log có ngữ cảnh, định danh rõ ràng, thông báo người dùng qua Toast/UI phù hợp, và có phương án fallback an toàn (fail-closed hoặc fallback có chỉ dẫn rõ ràng).

## 9. Không Tự Ý Suy Đoán Dữ Liệu (Never Guess User Data)

- Hệ thống không được tự bịa số liệu, tự điền giá trị phán đoán, hoặc tự động đánh `PASS`/`FAIL` khi chưa có bằng chứng kỹ thuật đầy đủ.
- Dữ liệu chưa xác định hoặc không đọc được phải được biểu diễn tường minh dưới dạng `UNKNOWN` hoặc `PENDING`, không được tự ý ép về giá trị mặc định nguy hiểm.

## 10. Tách Bạch Tuyệt Đối Giữa Raw Data và Normalized Data

- Dữ liệu thô từ nguồn (Raw OCR text, file scan, response gốc từ thiết bị phòng lab) phải luôn được lưu giữ nguyên bản (Immutable Raw Evidence).
- Dữ liệu chuẩn hóa (Normalized) hoặc ánh xạ (Mapped) phải được lưu ở các trường riêng biệt, **tuyệt đối không ghi đè làm mất vết dữ liệu gốc**.

## 11. Bắt Buộc Thẩm Định Mọi Thay Đổi Trọng Yếu (Mandatory Validation)

- Mọi dữ liệu đưa vào cơ sở dữ liệu hoặc đưa vào biểu mẫu phải đi qua Zod Schema Validation và Domain Rule Checking.
- Ngăn chặn hoàn toàn việc đưa dữ liệu sai cấu trúc hoặc không hợp lệ vào trạng thái của ứng dụng.

## 12. Sửa Tận Gốc (Fix Root Cause Over Workarounds)

- Khi phát hiện bug hoặc lỗi sai lệch, kỹ sư/AI phải phân tích tìm ra nguyên nhân cốt lõi (Root Cause) để xử lý triệt để.
- Nghiêm cấm các biện pháp chắp vá (monkey-patch, hacky timeout, ép kiểu `any` vô tội vạ, hoặc chèn điều kiện đặc thù cho một trường hợp riêng lẻ làm mờ logic tổng thể).
