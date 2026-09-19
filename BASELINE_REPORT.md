# 📊 BASELINE REPORT — PQM ARCHITECTURAL HARDENING

> **Phiên bản:** 1.0.0-BASELINE  
> **Thời điểm thẩm tra:** 2026-09-19  
> **Trạng thái:** FREEZE & AUDIT COMPLETE

---

## 1. TỔNG QUAN TÌNH TRẠNG HỆ THỐNG (CURRENT SYSTEM STATE)

Trước khi tiến hành bất kỳ thay đổi nào trên mã nguồn, toàn bộ hệ thống đã được kiểm tra độc lập và đối chiếu theo các tiêu chuẩn kiểm thử khắt khe:

| Hạng mục kiểm tra                           | Công cụ thực thi                   | Kết quả đo lường                                   | Đánh giá                 |
| :------------------------------------------ | :--------------------------------- | :------------------------------------------------- | :----------------------- |
| **Kiểm thử Đơn vị & Miền nghiệp vụ**        | Vitest v4.1.2                      | **106/106 test suites PASSED** (964/964 bài tests) | 🟢 Đạt chuẩn tuyệt đối   |
| **Kiểm tra Kiểu tĩnh (Static Typing)**      | TypeScript ~5.8.2 (`tsc --noEmit`) | **0 lỗi**                                          | 🟢 Sạch lỗi kiểu         |
| **Đóng gói Sản xuất (Production Build)**    | Vite v6.4.1 (Rollup Chunks)        | **Thành công** trong 16.20s, bundle sạch           | 🟢 Đạt chuẩn triển khai  |
| **Ranh giới Phân tầng (Layering Boundary)** | Vitest boundary runner             | UI không gọi trực tiếp Firebase mutation API       | 🟢 Đã có rào chắn cơ bản |

---

## 2. KẾT QUẢ RÀ SOÁT TĨNH TOÀN DIỆN (STATIC CODEBASE SCAN)

### 2.1. Quét các điểm đọc Firebase `get(ref(db, ...))`

Tổng số: **14 điểm gọi trực tiếp**, trong đó phân bổ:

- `BaseFirebaseRepository.ts`: 2 điểm (hàm `findById` đọc trực tiếp theo ID, và `findAll` fallback).
- `useAuthSync.ts`: 4 điểm (đọc thông tin user profile và admin status tại node `users/` và `users/admins/`).
- `databaseService.ts`: 2 điểm (hàm legacy `getProduct` và `getTestResult`).
- `pharmacopoeiaService.ts`: 1 điểm (đọc danh mục dược điển `pharmacopoeia_standards`).
- `signatureService.ts`: 1 điểm (đọc danh mục chữ ký điện tử).
- 🚨 **CÁC ĐIỂM NGUY CƠ CAO — CẦN KHẮC PHỤC TRONG MODEL 2.5**:
  - `src/services/testResultService.ts` L32: `const allSnap = await get(ref(db, 'testResults'));` (Fallback khi query lỗi).
  - `src/services/testResultService.ts` L207: `const snap = await get(ref(db, 'testResults'));` (Quét toàn bộ khi nhiều lô thiếu).
  - `src/services/testResultService.ts` L245: `const snapshot = await get(ref(db, 'testResults'));` (Hàm `fetchAllTestResultsRaw`).
  - `src/services/testResultService.ts` L300: `const snap = await get(ref(db, 'batches'));` (Quét toàn bộ lô trong testResultService).

### 2.2. Quét các điểm ghi Firebase (`set`, `update`, `remove`)

Tổng số: **38 điểm gọi trực tiếp**, đã được đóng gói tập trung tại:

- Repository Layer: 14 điểm (`BaseFirebaseRepository`, `FirebaseBatchRepository`, `FirebaseCriteriaAliasRepository`, `FirebaseDeviationRepository`, `FirebaseFormulaRepository`, `FirebaseMasterCriterionRepository`, `FirebaseAILearnedMappingRepository`, `FirebaseProductRepository`, `FirebaseMaterialRepository`, `FirebaseTCCSRepository`).
- App Services: 16 điểm (`TCCSAppService`, `userService`, `pharmacopoeiaService`, `signatureService`).
- Legacy Helper (`databaseService.ts`): 7 điểm.
- Core Sync (`testResultService.ts`): 1 điểm (`await update(ref(db), updates)`).
- Rà soát UI: **0 điểm ghi trực tiếp từ UI components**.

### 2.3. Quét các biến trạng thái (`status`, `overallStatus`, `qualityStatus`, `workflowStatus`, `isFinal`)

- `overallStatus`: Đã được dùng làm trường chính trong `TestResult` với 4 giá trị canonical (`PASS`, `FAIL`, `PENDING`, `UNKNOWN`).
- `qualityStatus`: Đang tồn tại dưới dạng legacy alias trên `TestResult` và chưa được tách bạch thành trường riêng ở tầng dữ liệu thực tế. Cần đồng bộ hóa theo **Model 1**.
- `workflowStatus`: Đã khai báo trong type `TestResult` nhưng chưa được quản lý bằng State Machine độc lập tại mọi chu trình nghiệp vụ. Cần nâng cấp theo **Model 10**.
- `isFinal`: Đã có trong một số logic phân giải cũ nhưng cần được thay thế hoàn toàn bằng `workflowStatus === 'FINAL' | 'APPROVED' | 'RELEASED'`.

### 2.4. Phát hiện các mẫu tính toán sai lệch (Flawed Patterns Identified)

1. **Genealogy Status Collapse**: Tại `src/services/ai/batchGenealogyService.ts` L79-L81:
   ```typescript
   const statusFromTestResult = (overallStatus: string): GenealogyNodeStatus => {
     return overallStatus === 'PASS' ? 'OK' : 'FAIL';
   };
   ```
   $\to$ Khiến `PENDING` và `UNKNOWN` bị ép thành `FAIL`.
2. **Fallback Scan khi Query Lỗi**: Tại `src/services/testResultService.ts` L30-L42:
   ```typescript
   // Fallback: nếu query bị lỗi do thiếu index, thử lấy tất cả và lọc
   try {
     const allSnap = await get(ref(db, 'testResults'));
     ...
   ```
   $\to$ Vi phạm nguyên tắc Fail-Closed và bảo mật tải dữ liệu sản xuất.
3. **Mô hình Dữ liệu TestResult**: Cần bổ sung tường minh `productId`, `criteria: CriterionResult[]`, `version: number`, `createdAt: number` theo đúng chuẩn Canonical Model 1.

---

## 3. CHECKLIST ĐIỀU KIỆN HOÀN THÀNH PHASE 0 (PHASE 0 ACCEPTANCE)

- [x] Snapshot và đóng băng mã nguồn (Freeze state verified).
- [x] Không thay đổi business logic trong Phase 0.
- [x] Chạy kiểm thử TypeScript: 0 lỗi.
- [x] Chạy kiểm thử Vite Build: Thành công 100%.
- [x] Chạy kiểm thử Vitest: 106 suites, 964 tests passed.
- [x] Hoàn thiện bản đồ kiến trúc: `ARCHITECTURE_MAP.md`.
- [x] Hoàn thiện bản đồ đường ghi: `WRITE_PATH_MAP.md`.
- [x] Hoàn thiện bản đồ đường đọc: `READ_PATH_MAP.md`.
- [x] Hoàn thiện bản đồ trạng thái: `STATUS_MAP.md`.
