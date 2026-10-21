# 📋 BÁO CÁO KIỂM KÊ VÀ DỌN DẸP MÃ NGUỒN PQM (LEAN CLEANUP AUDIT)

> **Dự án:** PQM — Hệ thống Đánh giá và Theo dõi Chất lượng Sản phẩm Tinh gọn (Lean Product Quality Monitoring)  
> **Thời điểm kiểm kê:** 2026-10-21  
> **Phiên bản chuẩn:** v11.64.1  
> **Trạng thái Baseline:** Typecheck: PASSED (0 lỗi) | Vitest: 215/215 suites PASSED (1,975/1,975 tests) | Build: PASSED (13.08s)

---

## 1. PHẠM VI NGHIỆP VỤ ĐÍCH & NGUYÊN TẮC BẢO VỆ CỐT LÕI

### 1.1. Phạm vi chức năng GIỮ LẠI (IN-SCOPE):

1. **Quản lý sản phẩm**: Thông tin sản phẩm, liên kết TCCS, danh sách lô và phiếu kiểm nghiệm.
2. **Quản lý tiêu chuẩn kiểm nghiệm/TCCS**: Hồ sơ TCCS, phiên bản áp dụng, chỉ tiêu và giới hạn kỹ thuật.
3. **Quản lý phiếu kiểm nghiệm (PKN)**: Phiếu nội bộ và bên ngoài (Quatest, CASE, Pasteur, Eurofins, v.v.).
4. **Nhập dữ liệu thủ công**: Form nhập phiếu với đầy đủ loại chỉ tiêu hóa lý, vi sinh, cảm quan.
5. **Nhập phiếu từ PDF/Excel & OCR**: Pipeline trích xuất PDF/ảnh scan/Excel, màn hình xem trước và xác nhận mapping trước khi lưu (`MappingConfirmModal`). Tuân thủ 12 quy tắc OCR (không suy đoán, không tạo số liệu).
6. **Đánh giá chất lượng tất định**: Một engine duy nhất (`QualityEvaluationEngine.ts`) trả về 4 trạng thái: `PASS`, `FAIL`, `PENDING`, `UNKNOWN`.
7. **Đối chiếu kết quả nội bộ và bên ngoài**: So sánh trực tiếp 2 phiếu cùng lô, tính sai lệch RPD (%), kiểm tra đơn vị tương đương (`/quality/comparison`).
8. **Theo dõi xu hướng chất lượng (SPC)**: Biểu đồ $C_p, C_{pk}$, đường kiểm soát UCL/LCL, 8 quy tắc Nelson đa lô theo thời gian (`/reports/trend-analysis`).
9. **Cảnh báo chất lượng & Báo cáo**: Cảnh báo OOS/OOT, báo cáo tổng hợp chất lượng (`/alerts`, `/reports/quality-summary`).
10. **Báo cáo CoA & Xác minh công khai**: Xem/in CoA dựa trên dữ liệu PKN mới nhất (`/test-results/coa/:batchId`, `/test-results/print/:id`) và tra cứu xác thực qua QR (`/verify/:id`).
11. **Xác thực, phân quyền & Nhật ký kiểm toán**: Đăng nhập, phân quyền RBAC, ALCOA+ Audit Trail cần thiết (`/users`, `/audit-logs`, `/settings`).

### 1.2. Phạm vi chức năng LOẠI BỎ (OUT-OF-SCOPE):

1. **Ký số và quy trình xuất xưởng lô sản xuất**: Không phát triển tính năng quyết định xuất xưởng.
2. **7 Release Gates, release decision, release progress** và các luồng phê duyệt chỉ phục vụ xuất xưởng.
3. **Vòng đời lô sản xuất phức tạp**: Lô chỉ đóng vai trò là đơn vị định danh gom nhóm dữ liệu kiểm nghiệm.
4. **AI Agent phức tạp và các công cụ AI không phục vụ trực tiếp cho nhập, chuẩn hóa, phân tích kiểm nghiệm**: Các AI tools tự động hành động trên DB, chat bot tổng hợp ngoài lề.
5. **CAPA / Thay đổi (Change Control) chuyên sâu**: Không phục vụ trực tiếp việc giám sát chất lượng.
6. **Hàm nguy hiểm / mồ côi phá hủy dữ liệu**: `clearDatabaseService`, `updateRootService` trong `databaseService.ts`.

---

## 2. BẢNG KIỂM KÊ CHI TIẾT (INVENTORY & AUDIT MATRIX)

| Đường dẫn                                                                                 | Chức năng hiện tại                                             | Tham chiếu/consumer tìm thấy                                                         | Bằng chứng không sử dụng hoặc trùng lặp                                                      |          Quyết định          |   Rủi ro   | Hành động đề xuất                                                                   | Kết quả kiểm thử sau xử lý |
| :---------------------------------------------------------------------------------------- | :------------------------------------------------------------- | :----------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- | :--------------------------: | :--------: | :---------------------------------------------------------------------------------- | :------------------------: |
| `src/services/databaseService.ts` (`clearDatabaseService`, `updateRootService`)           | Hàm xóa sạch hoặc cập nhật toàn bộ database root               | Không có consumer nào trong mã nguồn và test                                         | Đã bị đánh dấu `@deprecated @forbidden` và ném lỗi throw Error, không có bất kỳ file nào gọi |          **REMOVE**          |    Thấp    | Xóa bỏ 2 hàm mồ côi nguy hiểm này                                                   |       Đợt 1 / Đợt 3        |
| `src/pages/qa/DeviationListPage.tsx`                                                      | Màn hình danh sách sai lệch CAPA (1,209 dòng)                  | 0 consumer (Route `/deviations` đã redirect về `/alerts`)                            | Không được import trong `App.tsx` hoặc bất kỳ page/component nào                             |          **REMOVE**          |    Thấp    | Xóa file                                                                            |           Đợt 3            |
| `src/pages/quality/change-control/ChangeControlListPage.tsx`                              | Màn hình danh sách yêu cầu thay đổi (509 dòng)                 | 0 consumer (Route `/change-control` đã redirect về `/alerts`)                        | Không được import trong `App.tsx` hoặc bất kỳ page/component nào                             |          **REMOVE**          |    Thấp    | Xóa file                                                                            |           Đợt 3            |
| `src/pages/quality/change-control/ChangeControlDetailModal.tsx`                           | Modal chi tiết yêu cầu thay đổi                                | Chỉ được import bởi `ChangeControlListPage.tsx`                                      | Cùng nằm trong module Change Control đã bỏ                                                   |          **REMOVE**          |    Thấp    | Xóa file kèm `ChangeControlListPage.tsx`                                            |           Đợt 3            |
| `src/pages/batches/batch-360/Batch360Page.tsx`                                            | Màn hình cây phả hệ xuất xưởng Lô 360 độ                       | 0 consumer (Route `/batches/360/:id` redirect về `/batches`)                         | Không được import trong `App.tsx`                                                            |          **REMOVE**          |    Thấp    | Xóa file                                                                            |           Đợt 3            |
| `src/components/features/AIBatchClearanceModal.tsx`                                       | Modal tư vấn 7 cổng xuất xưởng bằng AI                         | 0 consumer trong mã nguồn                                                            | Không có trang nào import hay gọi modal này                                                  |          **REMOVE**          |    Thấp    | Xóa file                                                                            |           Đợt 3            |
| `src/services/ai/batchClearanceService.ts`                                                | Service tính toán thẩm định xuất xưởng lô và điểm clearance    | Chỉ được gọi bởi `AIBatchClearanceModal.tsx` và test riêng                           | Chỉ phục vụ thẩm định xuất xưởng lô (out-of-scope)                                           |          **REMOVE**          |    Thấp    | Xóa service và test liên quan sau khi dọn modal                                     |           Đợt 3            |
| `src/components/features/DeviationReportModal.tsx`                                        | Modal tạo báo cáo sai lệch CAPA                                | Chỉ được tham chiếu bởi AI tool hoặc trang sai lệch cũ                               | Phân hệ CAPA ngoài phạm vi                                                                   |          **REMOVE**          |    Thấp    | Xóa component                                                                       |           Đợt 3            |
| `src/pages/quality/deviations/` (`DeviationMetricsBar.tsx`, `DeviationWorkflowModal.tsx`) | Giao diện workflow sai lệch                                    | Không có route nào trỏ tới                                                           | Module sai lệch ngoài phạm vi                                                                |          **REMOVE**          |    Thấp    | Xóa thư mục                                                                         |           Đợt 3            |
| `src/services/app/DeviationAppService.ts` & `src/domains/deviation/`                      | Dịch vụ và domain xử lý sai lệch                               | Chỉ phục vụ module deviation đã bỏ                                                   | Domain ngoài phạm vi sản phẩm                                                                |          **REMOVE**          |    Thấp    | Xóa domain và service                                                               |           Đợt 3            |
| `src/services/app/ChangeControlAppService.ts` & `src/domains/change-request/`             | Dịch vụ và domain kiểm soát thay đổi                           | Chỉ phục vụ module change control đã bỏ                                              | Domain ngoài phạm vi sản phẩm                                                                |          **REMOVE**          |    Thấp    | Xóa domain và service                                                               |           Đợt 3            |
| `src/domain/batch/BatchReleaseDecisionService.ts`                                         | Thẩm định 7 cổng xuất xưởng lô và đưa ra quyết định release    | Được dùng bởi một số handler/hook cũ                                                 | Chức năng quyết định xuất xưởng nằm ngoài phạm vi                                            |          **REMOVE**          | Trung bình | Tinh gọn consumer trước, sau đó xóa                                                 |       Đợt 3 / Đợt 4        |
| `src/domain/batch/BatchReleaseProgressService.ts`                                         | Tính toán tiến độ % của 7 cổng kiểm soát xuất xưởng            | Được gọi bởi `BatchStatusSelect.tsx` cũ                                              | 7 release gates ngoài phạm vi                                                                |          **REMOVE**          |    Thấp    | Bỏ hiển thị tiến độ 7 gates trên UI, xóa service                                    |           Đợt 3            |
| `src/domain/batch/BatchReleaseWorkflowSynchronizer.ts`                                    | Đồng bộ trạng thái xuất xưởng lô vào workflow                  | Được gọi bởi `batchWorkflowHandlers.ts`                                              | Release workflow ngoài phạm vi                                                               |          **REMOVE**          |    Thấp    | Xóa đồng bộ release                                                                 |           Đợt 3            |
| `src/domain/batch/canonicalReleaseEngine.ts`                                              | Engine tính toán quyết định release                            | Chỉ phục vụ logic release cũ                                                         | Thuộc phân hệ xuất xưởng đã bỏ                                                               |          **REMOVE**          |    Thấp    | Xóa file                                                                            |           Đợt 3            |
| `src/domain/rules/ReleaseRules.ts`                                                        | Bộ quy tắc 7 cổng xuất xưởng lô                                | `BatchRules.ts`, `batchDiagnosticService.ts`, tests                                  | Chứa logic 7 release gates ngoài phạm vi                                                     |    **SIMPLIFY / REMOVE**     | Trung bình | Tinh gọn để không chặn quy trình theo dõi chất lượng                                |           Đợt 3            |
| `src/domains/batch/application/releaseService.ts` & `src/services/app/ReleaseService.ts`  | Dịch vụ thực thi chuyển trạng thái xuất xưởng lô kèm chữ ký số | Chỉ phục vụ chức năng Release                                                        | Chức năng xuất xưởng đã loại khỏi phạm vi                                                    |          **REMOVE**          | Trung bình | Gỡ bỏ service sau khi dọn các consumer                                              |       Đợt 3 / Đợt 4        |
| `src/domain/batch/batchTestResultResolver.ts`                                             | Giải quyết gom nhóm phiếu kiểm nghiệm vào Lô, xử lý số 0       | `dataConsistencyService.ts`, `useBatchList.ts`                                       | Cốt lõi cho giám sát chất lượng Lô                                                           |           **KEEP**           |    Cao     | Giữ nguyên để nhóm phiếu kiểm nghiệm chính xác                                      |    Đợt 1 (Đã kiểm tra)     |
| `src/domain/batch/batchIntegrityValidator.ts`                                             | Kiểm tra tính toàn vẹn dữ liệu Lô và Phiếu                     | `dataConsistencyService.ts`                                                          | Phục vụ bảo đảm toàn vẹn dữ liệu kiểm nghiệm                                                 |           **KEEP**           | Trung bình | Giữ nguyên                                                                          |    Đợt 1 (Đã kiểm tra)     |
| `src/domain/batch/batchDiagnosticService.ts`                                              | Chẩn đoán dữ liệu Lô và liên kết                               | `BatchDiagnosticModal.tsx`                                                           | Hỗ trợ quản trị viên phát hiện lỗi dữ liệu                                                   |     **KEEP / SIMPLIFY**      |    Thấp    | Giữ lại các kiểm tra chất lượng, bỏ kiểm tra release gate                           |           Đợt 3            |
| `src/domain/evaluation/QualityEvaluationEngine.ts`                                        | Bộ máy đánh giá chất lượng tất định chuẩn duy nhất             | Toàn bộ ứng dụng (Form, Detail, CoA, Import, Test)                                   | Là Single Source of Truth (SSoT) độc tôn                                                     |       **KEEP (SSoT)**        |  Rất cao   | Tuyệt đối bảo vệ, không sửa đổi logic cốt lõi                                       |    Đợt 1 (Đã kiểm tra)     |
| `src/domain/evaluation/EvaluationSnapshotBuilder.ts`                                      | Tạo và niêm phong snapshot đánh giá ALCOA+                     | `QualityEvaluationEngine`, `CoAReportPage`, `TestResultAppService`                   | Cốt lõi của tính toàn vẹn dữ liệu kiểm nghiệm                                                |           **KEEP**           |  Rất cao   | Giữ nguyên                                                                          |    Đợt 1 (Đã kiểm tra)     |
| `src/pages/quality/comparison/ComparisonPage.tsx`                                         | Trang đối chiếu phiếu kiểm nghiệm nội bộ vs bên ngoài          | Menu Sidebar, Route `/quality/comparison`                                            | Chức năng cốt lõi bắt buộc của ứng dụng tinh gọn                                             |           **KEEP**           |    Cao     | Bảo vệ và tối ưu trải nghiệm                                                        |    Đợt 1 (Đã kiểm tra)     |
| `src/pages/quality/TrendAnalysisPage.tsx`                                                 | Phân tích xu hướng chất lượng và biểu đồ SPC đa lô             | Menu Sidebar, Route `/reports/trend-analysis`                                        | Chức năng cốt lõi theo dõi chất lượng                                                        |           **KEEP**           |    Cao     | Bảo vệ và duy trì các rào chắn $N \ge 3$                                            |    Đợt 1 (Đã kiểm tra)     |
| `packages/release-engine/`                                                                | Gói npm nội bộ tính toán 7 release gates và vòng đời release   | `backend/src/services/releaseService.ts`, `backend/src/services/signatureService.ts` | Hoàn toàn ngoài phạm vi ứng dụng giám sát chất lượng tinh gọn                                | **REMOVE / INLINE CHECKSUM** | Trung bình | Chuyển hàm tính `sha256Hex` vào utils nội bộ, loại bỏ gói `packages/release-engine` |           Đợt 4            |
| `backend/src/routes/release.ts`                                                           | Endpoint REST API phê duyệt xuất xưởng lô                      | Không còn consumer phía client                                                       | Chức năng xuất xưởng ngoài phạm vi                                                           |          **REMOVE**          |    Thấp    | Xóa route                                                                           |           Đợt 4            |
| `backend/src/services/releaseService.ts`                                                  | Service xuất xưởng trên backend                                | Chỉ được gọi bởi `routes/release.ts`                                                 | Ngoài phạm vi                                                                                |          **REMOVE**          |    Thấp    | Xóa service                                                                         |           Đợt 4            |
| `package.json` (`lucide-react`)                                                           | Thư viện icon Lucide                                           | 0 file import trong toàn bộ dự án                                                    | Dự án dùng 100% `@heroicons/react`                                                           |          **REMOVE**          |    Thấp    | Gỡ khỏi dependencies                                                                |           Đợt 5            |
| `package.json` (`basic-ftp`)                                                              | Thư viện FTP                                                   | 0 file sử dụng                                                                       | Dependency thừa trong devDependencies                                                        |          **REMOVE**          |    Thấp    | Gỡ khỏi devDependencies                                                             |           Đợt 5            |
| `package.json` (`gh-pages`, scripts `build:gh`, `deploy:gh-pages`)                        | Công cụ deploy GitHub Pages                                    | Không dùng (đã chuyển sang Firebase Hosting)                                         | Lỗi thời, vi phạm quy tắc kiến trúc không dùng GH Pages                                      |          **REMOVE**          |    Thấp    | Xóa scripts và gỡ package                                                           |           Đợt 5            |
| `package.json` (`vite-plugin-pwa`)                                                        | Plugin PWA Vite                                                | Không được cấu hình trong `vite.config.ts`                                           | Dependency thừa không sử dụng                                                                |          **REMOVE**          |    Thấp    | Gỡ khỏi devDependencies                                                             |           Đợt 5            |

---

## 3. KẾ HOẠCH TRIỂN KHAI THEO TỪNG ĐỢT (STEP-BY-STEP REFACTOR PLAN)

### Đợt 1: Baseline Verification, Kiểm Kê & Lập Báo Cáo

- ✅ Chạy kiểm tra baseline (`npm run test:run`, `npm run typecheck`, `npm run build`).
- ✅ Tạo tài liệu audit `docs/audit/LEAN_CLEANUP_AUDIT.md`.
- ✅ Loại bỏ hàm nguy hiểm mồ côi `clearDatabaseService` và `updateRootService` trong `src/services/databaseService.ts`.

### Đợt 2: Tinh Gọn Route & Menu Ngoài Phạm Vi

- Dọn dẹp `src/App.tsx`:
  - Gỡ bỏ redirect và lazy imports của các route ngoài phạm vi không còn trang thực tế: `/deviations`, `/change-control`, `/batches/360/:id`.
  - Giữ nguyên các route cốt lõi: `/products`, `/materials`, `/tccs`, `/criteria`, `/product-formulas`, `/laboratories`, `/batches`, `/test-results`, `/quality/comparison`, `/reports/trend-analysis`, `/alerts`, `/reports/quality-summary`, `/settings`, `/account`, `/users`, `/audit-logs`, `/criteria-aliases`, `/search`.
- Kiểm tra lại thanh điều hướng `Layout.tsx` và `GlobalCommandPalette.tsx`.
- Chạy `npm run typecheck` và `npm run test:run`.

### Đợt 3: Xóa Code Chết, Wrapper Không Cần Thiết & Hợp Nhất Logic Trùng Lặp

- Xóa các file màn hình mồ côi ngoài phạm vi:
  - `src/pages/qa/DeviationListPage.tsx`
  - `src/pages/quality/change-control/ChangeControlListPage.tsx`
  - `src/pages/quality/change-control/ChangeControlDetailModal.tsx`
  - `src/pages/batches/batch-360/Batch360Page.tsx`
- Xóa các modal và component mồ côi:
  - `src/components/features/AIBatchClearanceModal.tsx`
  - `src/components/features/DeviationReportModal.tsx`
  - `src/pages/quality/deviations/DeviationMetricsBar.tsx`
  - `src/pages/quality/deviations/DeviationWorkflowModal.tsx`
- Xóa các service ngoài phạm vi:
  - `src/services/ai/batchClearanceService.ts` & test
  - `src/services/app/DeviationAppService.ts` & domain deviation
  - `src/services/app/ChangeControlAppService.ts` & domain change-request
  - `src/services/app/ReleaseService.ts`
  - `src/domain/batch/canonicalReleaseEngine.ts`
  - `src/domain/batch/BatchReleaseDecisionService.ts`
  - `src/domain/batch/BatchReleaseProgressService.ts`
  - `src/domain/batch/BatchReleaseWorkflowSynchronizer.ts`
- Tinh gọn `BatchDetailPage.tsx` và `useBatchList.ts` để loại bỏ các tham chiếu đến Release Gates.
- Chạy `npm run typecheck`, `npm run test:run`, `npm run build`.

### Đợt 4: Tinh Gọn Backend, Endpoint & Shared Package Không Còn Consumer

- Chuyển thuật toán mã băm `sha256Hex` / `calculateCanonicalSignatureChecksum` về nội bộ `src/utils/` (hoặc giữ bản gọn), gỡ bỏ phụ thuộc vào `packages/release-engine`.
- Xóa bỏ hoặc tinh gọn các file release trong `backend/` (`backend/src/routes/release.ts`, `backend/src/services/releaseService.ts`).
- Xóa gói `packages/release-engine/` sau khi đã chuyển mã băm cần thiết.
- Chạy `npm run typecheck`, backend typecheck và test suite.

### Đợt 5: Xóa Dependency Thừa, Scripts & Cập Nhật Tài Liệu

- Xóa dependencies không sử dụng trong `package.json`:
  - `lucide-react`
  - `basic-ftp`
  - `gh-pages`
  - `vite-plugin-pwa`
- Xóa các scripts deploy GitHub Pages cũ: `build:gh`, `deploy:gh-pages`.
- Cập nhật `PROJECT_OVERVIEW.md`, `.vibecode/ARCHITECTURE.md` và changelog.
- Chạy full test suite, build, export source snapshot và deploy lên Firebase Hosting.

---

## 4. KẾT QUẢ THỰC THI THỰC TẾ SAU DỌN DẸP (EXECUTION & AUDIT CERTIFICATION)

| Chỉ số                                  | Trước khi dọn dẹp (Baseline) |                               Sau khi dọn dẹp (Current)                               | Đánh giá                                                         |
| :-------------------------------------- | :--------------------------: | :-----------------------------------------------------------------------------------: | :--------------------------------------------------------------- |
| **Số file code mồ côi đã xóa**          |              0               |                                     **14 files**                                      | Xóa sạch các trang, modal, service mồ côi ngoài phạm vi          |
| **Dependencies thừa đã loại bỏ**        |              0               |      **4 packages** (`lucide-react`, `basic-ftp`, `gh-pages`, `vite-plugin-pwa`)      | Không còn dependency không dùng                                  |
| **Scripts lỗi thời đã gỡ**              |              0               |                     **2 scripts** (`build:gh`, `deploy:gh-pages`)                     | Không còn cấu hình GH Pages                                      |
| **Frontend Typecheck (`tsc --noEmit`)** |        PASSED (0 lỗi)        |                                  **PASSED (0 lỗi)**                                   | Giữ vững 100% tính toàn vẹn kiểu dữ liệu                         |
| **Backend Typecheck (`backend: tsc`)**  |       FAILED (TS2307)        |                                  **PASSED (0 lỗi)**                                   | Khắc phục hoàn toàn lỗi phân giải module                         |
| **Backend Vitest Tests**                |         56/56 passed         |                                **56/56 passed (100%)**                                | Đạt 100%                                                         |
| **Frontend Vitest Tests**               |   215 files (1,975 tests)    |                        **212 files (1,963 tests, 100% PASS)**                         | 100% xanh; 2 test files bị loại do thuộc component mồ côi đã xóa |
| **Production Build (`vite build`)**     |       PASSED (13.08s)        |                                  **PASSED (13.23s)**                                  | Đóng gói thành công, bundle sạch                                 |
| **Playwright E2E**                      |          Chưa chạy           | **Chưa cài đặt binary Chromium** (`npx playwright install` cần thiết trên môi trường) | Báo cáo minh bạch, không giả định                                |
| **Bảo toàn dữ liệu Firebase RTDB**      |             100%             |                                  **100% nguyên vẹn**                                  | Không chạy bất kỳ lệnh xóa schema/database nào                   |
