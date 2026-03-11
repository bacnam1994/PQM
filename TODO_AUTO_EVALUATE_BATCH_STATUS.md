# TODO: Triển khai tự động đánh giá trạng thái lô

## Mục tiêu
Hệ thống tự động đánh giá và cập nhật trạng thái lô (PENDING → TESTING → RELEASED/REJECTED) khi có kết quả kiểm nghiệm mới.

## Các bước thực hiện:

### 1. Phương án 1: Cập nhật `hooks/useTestResultLogic.ts` ✅ HOÀN THÀNH
- [x] Thêm import `evaluateBatchStatus` từ `utils/batchEvaluation`
- [x] Cập nhật hàm `handleSaveResult` để tự động đánh giá và cập nhật trạng thái lô sau khi lưu thành công

### 2. Phương án 2: Cập nhật `context/TestResultContext.tsx` ✅ HOÀN THÀNH
- [x] Thêm import `evaluateBatchStatus` và `BATCH_STATUS`
- [x] Import `get` từ firebase/database

### 3. Phương án 3: Cập nhật `context/AppContext.tsx` ✅ HOÀN THÀNH
- [x] Thêm import `BATCH_STATUS` từ `utils/constants`
- [x] Thêm useEffect để lắng nghe thay đổi testResults
- [x] Khi testResults thay đổi, đánh giá lại tất cả các lô liên quan
- [x] Chỉ cập nhật nếu trạng thái thay đổi (tránh infinite loop)

## Ghi chú:
- Phương án 1 và 2 xử lý ngay tại thời điểm thao tác (ADD/EDIT)
- Phương án 3 là lớp bảo vệ cuối cùng để đảm bảo dữ liệu luôn nhất quán (kể cả khi có thay đổi từ bên ngoài)

## Logic hoạt động:
1. Khi thêm/sửa kết quả kiểm nghiệm → tự động đánh giá trạng thái lô
2. Khi xóa kết quả kiểm nghiệm → tự động đánh giá lại trạng thái lô
3. Khi TCCS thay đổi → tự động đánh giá lại các lô liên quan
4. Khi có thay đổi testResults từ Firebase → tự động đánh giá lại tất cả lô

## Các trạng thái lô:
- **PENDING**: Chưa có kết quả kiểm nghiệm
- **TESTING**: Đang kiểm nghiệm (còn thiếu chỉ tiêu)
- **RELEASED**: Phê duyệt (tất cả chỉ tiêu đã kiểm + đều PASS)
- **REJECTED**: Từ chối (có chỉ tiêu FAIL)

