# 📖 READ PATH MAP — BẢN ĐỒ CÁC ĐƯỜNG ĐỌC DỮ LIỆU FIREBASE

> **Phiên bản:** 1.0.0-BASELINE  
> **Mục tiêu:** Kiểm soát và triệt tiêu 100% rủi ro Unbounded Scan / Memory Exhaustion

---

## 1. PHÂN LOẠI CÁC ĐƯỜNG ĐỌC DỮ LIỆU HIỆN TẠI

### 1.1. Đọc Trực tiếp Đơn bản ghi (Direct Primary Key Lookup - O(1))

- **Cơ chế**: `get(ref(db, `${collectionPath}/${id}`))`.
- **Áp dụng tại**: `BaseFirebaseRepository.findById(id)`, `useAuthSync.ts` (đọc user và admin status), `databaseService.ts` (`getProduct`, `getTestResult`).
- **Đánh giá**: 🟢 Hoàn toàn an toàn, tốc độ < 50ms, không tốn băng thông.

### 1.2. Đọc Có Chọn lọc theo Chỉ mục (Targeted Index-based Queries)

- **Cơ chế**: `query(ref(db, collection), orderByChild(relationKey), equalTo(targetId))`.
- **Áp dụng tại**:
  - `BaseFirebaseRepository.findByRelation(relationKey, value)`.
  - `TestResultRepository.findByBatchId(batchId)`.
  - `FirebaseCriteriaAliasRepository.findByTccsId(tccsId)`.
  - `FirebaseFormulaRepository.findByProductId(productId)`.
  - Server-side pagination (`startAt`, `endAt`, `limitToFirst`, `limitToLast`).
- **Đánh giá**: 🟢 Hiệu năng cao, bảo vệ bộ nhớ client, đã cấu hình `.indexOn` trong `database.rules.json`.

### 1.3. Đồng bộ Delta Thời gian thực (Granular Sync Engine)

- **Cơ chế**: Lắng nghe từng sự kiện thay đổi chi tiết tại `src/hooks/useFirebaseSync.ts`:
  - `onChildAdded(query)`
  - `onChildChanged(query)`
  - `onChildRemoved(query)`
- **Đánh giá**: 🟢 Không tải lại toàn bộ collection khi chỉ 1 phần tử thay đổi.

---

## 2. 🚨 CÁC ĐƯỜNG ĐỌC NGUY CƠ CAO CẦN LOẠI BỎ (MODEL 2.5 TARGETS)

Dưới đây là các điểm quét toàn bộ cơ sở dữ liệu (`get(ref(db, 'collection'))`) được phát hiện trong mã nguồn cần phải triệt tiêu:

| Vị trí mã nguồn                         | Dòng lệnh                                             | Mục đích ban đầu                     | Nguy cơ tiềm ẩn                                                            | Giải pháp khắc phục (Model 2.5)                                                                                |
| :-------------------------------------- | :---------------------------------------------------- | :----------------------------------- | :------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| `src/services/testResultService.ts:32`  | `const allSnap = await get(ref(db, 'testResults'));`  | Fallback khi targeted query thất bại | Tải hàng chục ngàn phiếu vào RAM trình duyệt khi mất mạng hoặc thiếu index | **Loại bỏ fallback quét**. Chuyển sang **Fail-Closed**: Ghi log lỗi cấu trúc và trả về trạng thái lỗi an toàn. |
| `src/services/testResultService.ts:207` | `const snap = await get(ref(db, 'testResults'));`     | Quét tất cả phiếu khi nhiều lô thiếu | Gây lag và cạn kiệt bộ nhớ client với database lớn                         | Thay bằng batch querying theo từng `batchId` qua `Promise.all` có giới hạn chunk.                              |
| `src/services/testResultService.ts:245` | `const snapshot = await get(ref(db, 'testResults'));` | Hàm legacy `fetchAllTestResultsRaw`  | Rò rỉ dữ liệu ngoài phân quyền, quét không giới hạn                        | Xóa bỏ hoặc thay bằng phân trang Server-side `findRecent(limit)`.                                              |
| `src/services/testResultService.ts:300` | `const snap = await get(ref(db, 'batches'));`         | Quét tất cả lô sản xuất              | Quét không cần thiết trong dịch vụ phiếu kiểm nghiệm                       | Sử dụng `BatchRepository.findById` hoặc TanStack Query cache.                                                  |

---

## 3. NGUYÊN TẮC FAIL-CLOSED (FAIL-CLOSED ARCHITECTURE)

```
                 Targeted Index Query
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
         Thành công                  Lỗi Query
             │                         │
             ▼                         ▼
     Trả kết quả chuẩn        🚨 FAIL CLOSED
                               - Ghi log chẩn đoán
                               - KHÔNG quét full DB
                               - Thông báo lỗi an toàn
```
