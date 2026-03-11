# TỔNG KẾT NGUYÊN NHÂN LỖI TRANG TRẮNG TẠI QUẢN LÝ LÔ

## Ngày phân tích: $(date)

## TỔNG QUAN

Lỗi trang trắng (white screen) tại trang "Quản lý Lô" (BatchList) có thể do nhiều nguyên nhân kết hợp. Dưới đây là phân tích chi tiết các nguyên nhân tiềm ẩn được xác định qua việc review code.

---

## CÁC NGUYÊN NHÂN CHÍNH

### 1. ❌ VẤN ĐỀ VỀ NULL/UNDEFINED TRONG HYDRATED DATA

**File: `pages/BatchList.tsx`** (Dòng 331)

```typescript
// Cách sử dụng KHÔNG NHẤT QUÁN:
const { batches: hydratedBatches = [] } = useDataGraph() || {};
```

**Vấn đề:**
- Trong `useDataGraph()`, nếu `batches` trong state là `undefined` thay vì mảng rỗng, việc destructure không có fallback sẽ gây crash
- Các component con (`BatchGridItem`, `BatchListItem`) sử dụng `.map()` trực tiếp mà không kiểm tra null

**Dẫn đến:** Lỗi "Cannot read property 'map' of undefined"

---

### 2. ❌ VẤN ĐỀ TRONG `evaluateBatchStatus`

**File: `utils/batchEvaluation.ts`**

```typescript
export const evaluateBatchStatus = (
  batch: { id: string },
  testResults: Array<...>,
  tccs?: { 
    mainQualityCriteria?: Array<{ name: string }>; 
    safetyCriteria?: Array<{ name: string }>;
    alternateRules?: Array<...>;
  }
) => {
  // Lấy tất cả chỉ tiêu từ TCCS
  const tccsCriteria = tccs ? [
    ...(Array.isArray(tccs.mainQualityCriteria) ? tccs.mainQualityCriteria : []),
    ...
  ].filter(c => c && c.name).map(c => c.name) : [];
  
  // Vấn đề: Nếu tccsCriteria là mảng rỗng [], logic sau đó có thể không đúng
```

**Vấn đề:**
- Khi `tccs` là `undefined`, hàm fallback về logic cũ dựa trên `overallStatus` của phiếu
- Nếu `testResults` chứa dữ liệu null hoặc cấu trúc không đúng, việc truy cập `.overallStatus` sẽ crash

---

### 3. ❌ VẤN ĐỀ RACE CONDITION TRONG APP CONTEXT

**File: `context/AppContext.tsx`** (Dòng 415-495)

```typescript
useEffect(() => {
  let isMounted = true;
  let isProcessing = false;
  let debounceTimer: NodeJS.Timeout | null = null;

  const testResultsRef = ref(db, 'testResults');
  
  const unsubscribe = onValue(testResultsRef, async (snapshot) => {
    // Debounce 500ms
    debounceTimer = setTimeout(async () => {
      if (isProcessing || !isMounted) return;
      
      isProcessing = true;
      
      try {
        // ... Xử lý đánh giá batch
        // Vấn đề tiềm ẩn: Nếu state chưa kịp cập nhật, batch có thể undefined
      }
    }, 500);
  });
}, []);
```

**Vấn đề:**
- Khi `testResults` thay đổi từ Firebase, effect này chạy và query tất cả batches từ Firebase
- Nếu có race condition giữa việc cập nhật state và query, dữ liệu có thể không nhất quán
- Nếu `evaluateBatchStatus` nhận vào `batch` là `undefined`, sẽ crash

---

### 4. ❌ VẤN ĐỀ TRONG `findTCCSByMfgDate`

**File: `utils/tccsUtils.ts`**

```typescript
export const findTCCSByMfgDate = (...) => {
  // Lọc TCCS active của sản phẩm
  const productTccsList = tccsList
    .filter(t => t.productId === productId && t.isActive)
    .sort((a, b) => ...);

  if (productTccsList.length === 0) return null;
  
  // Vấn đề: Nếu tccsList đầu vào là undefined, .filter() sẽ crash
};
```

**Vấn đề:**
- Hàm không kiểm tra `tccsList` là null/undefined trước khi gọi `.filter()`

---

### 5. ❌ VẤN ĐỀ TRONG `useTestResultLogic`

**File: `hooks/useTestResultLogic.ts`** (Dòng 220-260)

```typescript
// Tự động đánh giá và cập nhật trạng thái lô
try {
  const batch = state.batches.find(b => b.id === formValues.batchId);
  if (batch) {
    const tccs = state.tccsList.find(t => t.id === batch.tccsId);
    // Vấn đề: Nếu batch.tccsId không tồn tại hoặc undefined, 
    // tccs sẽ là undefined và evaluateBatchStatus có thể xử lý sai
  }
}
```

**Vấn đề:**
- Không kiểm tra `batch.tccsId` tồn tại trước khi tìm TCCS

---

### 6. ❌ VẤN ĐỀ TRONG `renderCriteriaTable`

**File: `pages/BatchList.tsx`** (Dòng 545-600)

```typescript
const renderCriteriaTable = (criteria: any[], title: string, ...) => {
  if (!criteria || criteria.length === 0) return null;
  
  // Vấn đề: Không kiểm tra từng criterion có null/undefined
  {criteria.filter(c => c).map((criterion, idx) => {
    // Truy cập trực tiếp mà không null check
    const testResultsForCriterion = getTestResultsForCriterion(criterion.name, ...);
    // criterion.name có thể là undefined
```

**Vấn đề:**
- Mặc dù có filter, nhưng không đảm bảo an toàn 100%

---

### 7. ❌ VẤN ĐỀ DOUBLE LOADING DATA

**Phát hiện:**
- `AppContext` tải tất cả dữ liệu (products, batches, tccsList, v.v.)
- `TestResultContext` tải riêng `testResults`
- `useDataGraph` tạo bản sao "hydrated" với dữ liệu liên kết

**Vấn đề:**
- Không đồng bộ giữa các context có thể dẫn đến trạng thái không nhất quán
- Khi `useDataGraph()` được gọi trước khi `AppContext` hoàn tất loading, dữ liệu có thể là `undefined`

---

## THỨ TỰ XỬ LÝ ĐỀ XUẤT

### Bước 1: Sửa useDataGraph để an toàn hơn
- Thêm null check cho tất cả các mảng đầu vào
- Đảm bảo luôn trả về mảng hợp lệ

### Bước 2: Sửa evaluateBatchStatus
- Thêm null check cho `batch` và `testResults`
- Xử lý graceful khi `tccs` là undefined

### Bước 3: Sửa findTCCSByMfgDate
- Thêm null check cho tham số đầu vào

### Bước 4: Cải thiện Error Boundary
- Thêm logging chi tiết hơn
- Hiển thị thông báo lỗi cụ thể hơn

### Bước 5: Thêm loading states
- Hiển thị skeleton/loading thay vì trang trắng

---

## CÁC DẤU HIỆU NHẬN BIẾT LỖI

1. **Trang trắng hoàn toàn** → Lỗi JavaScript nghiêm trọng (undefined/null)
2. **Trang trắng sau khi login** → Vấn đề với data loading
3. **Trang trắng khi chuyển sang tab Lô** → Vấn đề với BatchList hoặc useDataGraph
4. **Trang trắng khi thao tác với Lô** → Vấn đề với mutation/callback

---

## KHUYẾN NGHỊ NGAY

1. **Thêm try-catch** trong `useDataGraph` để không bao giờ crash
2. **Kiểm tra console** (F12) để xem lỗi chi tiết
3. **Thêm Error Boundary** cụ thể cho từng page
4. **Log thêm** các điểm critical để debug

