# Danh sách các vấn đề cần khắc phục

## ✅ Đã hoàn thành

### 1. Firebase Indexes
- [x] Thêm indexes cho các query phức tạp trong database.rules.json
  - products, batches, tccs, testResults, product_formulas, raw_materials, inventoryIn, inventoryOut, audit_logs

### 2. Constants cho Magic Numbers
- [x] Thêm PAGINATION, TOAST, DATE_FORMAT, SYNC_STATUS vào utils/constants.ts

### 3. TypeScript Strict Mode
- [x] Bật strict mode trong tsconfig.json
- [x] Thêm các rules: noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch, noImplicitReturns

## 🔄 Cần xem xét thêm

### 4. Type Safety (as any)
- Có 121+ vị trí sử dụng `as any` trong code
- Cần review từng trường hợp để thay thế bằng type đúng
- **Gợi ý:** Tập trung vào các vị trí quan trọng trước

### 5. Console Statements
- Nhiều console.log/warn/error trong code production
- Gợi ý: Thay thế bằng logging service hoặc loại bỏ trước deploy

## 📋 Các vấn đề đã xác định nhưng chưa sửa (cần review thủ công)

- Duplicate data loading (3 context tải dữ liệu riêng)
- Firebase security rules hạn chế
- Hardcoded strings (chưa có i18n)
- Duplicate code (cascade delete logic)
