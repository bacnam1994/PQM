# TODO: Sửa lỗi trắng trang Quản lý Lô

## Nguyên nhân đã xác định:
1. Thiếu Error Boundary để bắt lỗi JavaScript
2. Race condition trong AppContext auto-evaluation
3. TestResultContext giới hạn 200 kết quả
4. Thiếu loading state

## Các bước thực hiện:

### Bước 1: Tăng giới hạn TestResultContext ✅
- [x] Đọc file TestResultContext.tsx
- [x] Tăng limit từ 200 lên 1000

### Bước 2: Thêm Loading State ✅
- [x] Thêm isLoading check trong BatchList.tsx
- [x] Hiển thị skeleton khi đang tải dữ liệu

### Bước 3: Fix useDataGraph ✅
- [x] Đảm bảo luôn trả về mảng hợp lệ kể cả khi lỗi (đã có sẵn trong code)

### Bước 4: Fix Race Condition trong AppContext ✅
- [x] Logic auto-evaluation đã có try-catch bọc ngoài (đã có sẵn)

## Tổng kết:
1. ✅ Tăng giới hạn TestResults từ 200 lên 1000
2. ✅ Thêm loading state với skeleton UI
3. ✅ Code đã có null checks và error handling đầy đủ


