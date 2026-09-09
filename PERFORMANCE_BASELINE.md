# PQM 3.0 - BÁO CÁO HIỆU NĂNG HỆ THỐNG (PERFORMANCE BASELINE)
> **Phiên bản:** 3.0.0-baseline  
> **Thời điểm đo lường:** 2026-09-08  
> **Môi trường đo:** Node v22, Vite 6.4.1, Windows 11

---

## 1. CHỈ SỐ BUILD & ĐÓNG GÓI (BUILD METRICS)

- **Tổng số modules phân tích:** `2,402 modules`
- **Thời gian build hoàn tất (`tsc && vite build`):** `9.90 giây`
- **Cảnh báo từ Vite Rollup:**
  > `(!) Some chunks are larger than 1000 kB after minification.`  
  > File `dist/assets/index-rIX734GC.js` đạt `1,350.22 kB` (Gzip: `391.30 kB`).

### Phân tích dung lượng các Chunks chính:

| Chunk / Tài nguyên | Dung lượng thô (Raw) | Dung lượng nén (Gzip) | Đánh giá & Rủi ro |
| :--- | :---: | :---: | :--- |
| **`index-[hash].js` (Vendor/Core)** | **1,350.22 kB** | **391.30 kB** | **RẤT LỚN**: Tải tất cả React 19, Zustand, Firebase SDK, Lucide, Recharts core vào 1 chunk. Cần tách vendor chunks. |
| **`pdf.worker.min-[hash].mjs`** | **1,262.40 kB** | ~350 kB | Phục vụ xử lý PDF client-side (pdfjs-dist). Đã tách chunk nhưng cần lazy-load triệt để. |
| **`pdfProcessor-[hash].js`** | **479.13 kB** | **142.86 kB** | Chứa logic trích xuất trang & chuyển canvas sang JPEG. |
| **`LineChart-[hash].js`** | **392.89 kB** | **107.82 kB** | Thư viện Recharts (D3 + SVG). Đã lazy-load theo route biểu đồ. |
| **`index-[hash].css`** | **167.40 kB** | **25.23 kB** | CSS Tailwind build tổng hợp. Khá tối ưu. |
| **`BatchDetailPage-[hash].js`** | **80.27 kB** | **21.18 kB** | Trang chi tiết lô phức hợp nhất hệ thống. |
| **`TestResultFormPage-[hash].js`** | **67.22 kB** | **18.95 kB** | Trang nhập liệu kiểm nghiệm & điều phối OCR. |
| **`SettingsPage-[hash].js`** | **51.19 kB** | **12.43 kB** | Trang cài đặt hệ thống. |
| **`MaterialList-[hash].js`** | **49.74 kB** | **11.07 kB** | Danh mục nguyên liệu kèm AI Harmonization. |
| **`QualitySummaryReport-[hash].js`**| **48.97 kB** | **14.57 kB** | Trang báo cáo PQR / APR. |
| **`TrendAnalysisPage-[hash].js`** | **41.41 kB** | **11.32 kB** | Phân tích xu hướng chất lượng. |

---

## 2. HIỆU NĂNG BỘ TEST TỰ ĐỘNG (TEST EXECUTION BASELINE)

- **Công cụ:** Vitest v4.1.2
- **Tổng số Test Suites:** 22 passed / 22 files (100%)
- **Tổng số Tests:** 123 passed / 123 tests (100%)
- **Tổng thời gian chạy test:** `4.92 giây`
  - Biến đổi module (Transform): `3.19s`
  - Nhập module (Import): `7.87s`
  - Thời gian chạy kiểm thử thuần (Tests Execution): `423 ms`
  - Thời gian môi trường (Environment JSDOM): `32.53s`

---

## 3. KHẢO SÁT HIỆU NĂNG RUNTIME & ĐIỂM NGHẼN (RUNTIME BOTTLENECKS)

### 3.1. Quá tải mạng do tải toàn bộ Collection (Full Table Ingestion)
- Trong `src/hooks/useFirebaseSync.ts`, hệ thống đang lắng nghe sự kiện `onValue()` lên toàn bộ các node gốc:
  - `/products`
  - `/batches`
  - `/tccs`
  - `/product_formulas`
  - `/raw_materials`
  - `/testResults`
  - `/criteria_aliases`
  - `/ai_learned_mappings`
- **Hệ quả khi dữ liệu tăng trưởng lớn (10,000+ records)**:
  - Trình duyệt phải tải toàn bộ dữ liệu lịch sử ngay khi đăng nhập.
  - Bất kỳ thay đổi nhỏ nào ở 1 bản ghi sẽ kích hoạt cập nhật state toàn bảng trên `useAppStore`, dẫn đến re-render diện rộng.
  - Thiết bị di động hoặc máy tính phòng Lab cấu hình yếu sẽ bị giật/đơ (Jank/Freeze).

### 3.2. Thiếu cơ chế ảo hóa DOM (DOM Virtualization)
- Các danh sách bảng: `BatchList.tsx`, `TestResultList.tsx`, `MaterialList.tsx`, `CriteriaList.tsx` đang render toàn bộ hàng vào DOM dưới dạng `<tr>`.
- Khi số lượng lô và kết quả kiểm nghiệm vượt qua 500 bản ghi, việc render đồng thời gây lag nghiêm trọng khi cuộn trang hoặc lọc dữ liệu.

### 3.3. Tải chồng lấn và xung đột thư viện AI (AI Bundle Overhead)
- Cảnh báo Rollup:
  > `autoLearningService.ts is dynamically imported by aiTools.ts but also statically imported by AIAssistantChat.tsx, dynamic import will not move module into another chunk.`
- Việc import tĩnh đan xen với dynamic import khiến Rollup không thể tách rời các mô-đun AI nặng ra khỏi main chunk.

---

## 4. MỤC TIÊU SLO HIỆU NĂNG PQM 3.0 (TARGET SLOS)

| Chỉ số hiệu năng | Mức cơ sở (Hiện tại) | Mục tiêu PQM 3.0 | Giải pháp kỹ thuật |
| :--- | :---: | :---: | :--- |
| **Initial JS Bundle (Gzip)** | `391.30 kB` | **< 250 kB** | Cấu hình `manualChunks` tách `vendor-react`, `vendor-firebase`, `vendor-charts`, lazy load AI tools |
| **LCP (Largest Contentful Paint)** | ~2.8s | **< 2.0s** | SSR/Skeleton tối ưu, chia nhỏ chunks, tải trước các font & icon cốt lõi |
| **TTI (Time to Interactive)** | ~3.5s | **< 2.5s** | Trì hoãn nạp các service AI cho tới khi người dùng kích hoạt |
| **Khả năng chịu tải dữ liệu bảng** | ~500 hàng | **10,000+ hàng** | Áp dụng Virtual Scroll (`@tanstack/react-virtual` hoặc Windowing) |
| **Băng thông nạp dữ liệu khởi động** | Tải 100% database | **Chỉ nạp Delta & Page** | RTDB query `.limitToLast(50)`, IndexedDB cache cục bộ |
