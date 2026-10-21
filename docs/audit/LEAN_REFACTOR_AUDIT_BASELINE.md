# 📊 GIAI ĐOẠN A: AUDIT & BASELINE KIẾN TRÚC REFACTOR PQM

## HỆ THỐNG GIÁM SÁT VÀ ĐÁNH GIÁ CHẤT LƯỢNG SẢN PHẨM TINH GỌN (LEAN PQM)

> **Ngày thực hiện:** 2026-10-21  
> **Trạng thái:** HOÀN THÀNH GIAI ĐOẠN A (AUDIT & BASELINE - CHƯA XÓA MÃ NGUỒN)  
> **Cam kết:** Không viết lại từ đầu, bảo toàn 100% CSDL Firebase, React 19, TypeScript, và các pipeline dữ liệu cốt lõi.

---

## 1. KẾT QUẢ BASELINE TRƯỚC REFACTOR (MEASURED BASELINE)

| Tiêu chí                               | Kết quả thực tế           | Chi tiết / Đánh giá                                                                                                                                                                                          |
| :------------------------------------- | :------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Typecheck (`npm run typecheck`)**    | **PASSED (0 Lỗi)**        | `tsc --noEmit` hoàn thành sạch sẽ 100%.                                                                                                                                                                      |
| **Vitest Tests (`npm run test:run`)**  | **208 PASSED / 7 FAILED** | Tổng số **1,975 tests** (1,968 passed, 7 failed trên 215 test suites). Toàn bộ 7 ca thất bại đều thuộc về module Release Workflow / Chữ ký xuất xưởng cũ đã chuyển sang Spark Free (xem phân tích bên dưới). |
| **Production Build (`npm run build`)** | **PASSED (13.33s)**       | Đóng gói production bundle thành công vào `dist/` (2,533 modules transformed, vendor chunks tách bạch tối ưu).                                                                                               |
| **Rủi ro hồi quy (Regression Risk)**   | **THẤP**                  | Không có lỗi biên dịch cú pháp; các logic nghiệp vụ lõi (TCCS, Formula, Evaluation, OCR, SPC Trend, Search) đều hoạt động 100% xanh.                                                                         |

### Phân tích 7 test suite failed hiện tại:

1. `src/architecture/workflowMutationGuard.test.ts`: Rào chắn cấm gán `status: 'RELEASED'` trong UI client (`BatchDetailPage.tsx`, `useBatchList.ts`).
2. `src/hooks/useWorkflowActions.test.ts`: Kiểm tra cờ `requiresSignature` của action release cũ.
3. `src/services/rulesAudit.test.ts`: Kiểm tra quyền ghi append-only của `audit_logs`.
4. `tests/hardening/batchWorkflowHardeningMatrix.test.ts`: Bắt buộc chữ ký số theo 21 CFR Part 11 cho Release.
5. `tests/hardening/p0p1ClosureAudit.test.ts`: Gate 7 fail-closed khi thiếu chữ ký release.
6. `src/services/app/BatchAppService.test.ts`: Chặn release khi thiếu chữ ký điện tử.
7. `tests/unit/services/releaseService.test.ts`: Kiểm tra ném lỗi thiếu chữ ký release.

> **Nhận xét quan trọng:** Toàn bộ 7 lỗi trên đều nằm trong phân hệ **Release Workflow & Electronic Release Signatures** — chính là phân hệ nằm ngoài phạm vi của ứng dụng Tinh gọn (Lean PQM) và sẽ được thu gọn/loại bỏ trong các giai đoạn tiếp theo!

---

## 2. INVENTORY TOÀN DIỆN & PHÂN LOẠI (KEEP / SIMPLIFY / REMOVE / REVIEW)

### 2.1. Routes & Pages (`src/pages/`, `src/App.tsx`)

| Tuyến đường (Route)                                                              | Page Component                                    |     Phân loại      | Mô tả & Định hướng tinh gọn                                                                                                                                                                         |
| :------------------------------------------------------------------------------- | :------------------------------------------------ | :----------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                              | `Dashboard`                                       |    **SIMPLIFY**    | **Khu vực 1: Tổng quan chất lượng**. Giữ lại KPI chất lượng, tỷ lệ đạt theo TCCS, cảnh báo OOS, danh sách phiếu mới. Bỏ KPI liên quan đến tỷ lệ xuất xưởng / release gates.                         |
| `/products`, `/products/new`, `/products/edit/:id`, `/products/:id`              | `ProductList`, `ProductFormPage`, `ProductDetail` |      **KEEP**      | **Khu vực 2: Danh mục sản phẩm**. Quản lý sản phẩm, liên kết TCCS, danh sách lô và phiếu kiểm nghiệm liên quan.                                                                                     |
| `/products/360/:id`                                                              | `Product360Page`                                  |     **REVIEW**     | Tinh gọn để tập trung vào vòng đời chất lượng sản phẩm (bỏ cây gia phả xuất xưởng phức tạp).                                                                                                        |
| `/materials`, `/materials/new`, `/materials/edit/:id`                            | `MaterialList`, `MaterialFormPage`                |      **KEEP**      | Quản lý danh mục nguyên liệu thử nghiệm (phục vụ đối soát COA nguyên liệu).                                                                                                                         |
| `/tccs`, `/tccs/new`, `/tccs/edit/:id`, `/tccs/detail/:id`                       | `TCCSList`, `TCCSFormPage`, `TccsDetailPage`      |      **KEEP**      | **Khu vực 3: Tiêu chuẩn chất lượng**. Quản lý Tiêu chuẩn cơ sở, các phiên bản tiêu chuẩn áp dụng, chỉ tiêu và giới hạn kỹ thuật. Cực kỳ quan trọng cho bộ máy đánh giá.                             |
| `/criteria`, `/criteria/new`, `/criteria/edit/:id`                               | `CriteriaList`, `CriteriaFormPage`                |      **KEEP**      | Danh mục chỉ tiêu kiểm nghiệm chuẩn hóa, phân loại hóa lý/vi sinh/cảm quan.                                                                                                                         |
| `/product-formulas`, `.../new`, `.../edit/:id`                                   | `ProductFormulaList`, `ProductFormulaFormPage`    |      **KEEP**      | Công thức sản phẩm và định lượng thành phần hoạt chất.                                                                                                                                              |
| `/laboratories`                                                                  | `LaboratoryManagementPage`                        |      **KEEP**      | Quản lý phòng kiểm nghiệm (Nội bộ QC vs Bên ngoài: Quatest 3, CASE, Pasteur, NIFC, Eurofins). Truy xuất nguồn gốc phiếu.                                                                            |
| `/batches`, `/batches/new`, `/batches/edit/:id`                                  | `BatchList`, `BatchFormPage`                      |    **SIMPLIFY**    | Quản lý Lô với tư cách là **đơn vị định danh gom nhóm phiếu kiểm nghiệm** (Số lô, ngày sản xuất, hạn dùng). Loại bỏ workflow chuyển trạng thái xuất xưởng phức tạp.                                 |
| `/batches/:id`                                                                   | `BatchDetailPage`                                 |    **SIMPLIFY**    | Tinh gọn: Giữ lại thông tin Lô, bảng tổng hợp phiếu kiểm nghiệm nội bộ vs gửi ngoài, lịch sử kiểm tra. **Gỡ bỏ 7 Release Gates, BPR review tab, nút duyệt xuất xưởng, ESignatureModal xuất xưởng**. |
| `/batches/360/:id`                                                               | `Batch360Page`                                    |     **REMOVE**     | Module cây phả hệ xuất xưởng 360 độ (ngoài phạm vi theo dõi chất lượng).                                                                                                                            |
| `/test-results`, `/test-results/new`, `/test-results/edit/:id`                   | `TestResultList`, `TestResultFormPage`            | **KEEP / ENHANCE** | **Khu vực 4: Phiếu kiểm nghiệm**. Nhập tay, upload PDF/Excel trích xuất, đối chiếu TCCS, xem trước và lưu. Bổ sung bộ lọc phân tách rõ ràng Nội bộ vs Ngoại kiểm.                                   |
| `/test-results/coa/:batchId`, `/test-results/print/:id`                          | `CoAReportPage`                                   |      **KEEP**      | Xem và in phiếu phân tích / kiểm nghiệm chính thức.                                                                                                                                                 |
| `/verify/:id`                                                                    | `CoAVerifyPage`                                   |      **KEEP**      | Tra cứu công khai xác thực phiếu / CoA bằng mã QR.                                                                                                                                                  |
| `/reports/trend-analysis`                                                        | `TrendAnalysisPage`                               | **KEEP / ENHANCE** | **Khu vực 5: So sánh & Xu hướng**. Phân tích xu hướng chất lượng đa lô theo thời gian, biểu đồ kiểm soát SPC ($C_p, C_{pk}, P_p, P_{pk}$, Nelson rules).                                            |
| `/quality/comparison` (Mới hoặc tích hợp modal)                                  | `LabComparisonModal` / View                       | **KEEP / ENHANCE** | **Khu vực 5: So sánh nội bộ vs bên ngoài**. Đối chiếu trực tiếp 2 phiếu (Nội bộ vs Gửi ngoài) của cùng Lô, tính độ lệch RPD (%), đánh giá sai lệch phương pháp/đơn vị.                              |
| `/reports/quality-summary`                                                       | `QualitySummaryReport`                            |      **KEEP**      | **Khu vực 6: Báo cáo**. Tổng hợp chất lượng theo sản phẩm, thời gian, phòng kiểm nghiệm.                                                                                                            |
| `/alerts`                                                                        | `AlertsPage`                                      |      **KEEP**      | Cảnh báo chất lượng kỹ thuật (OOS, OOT, xu hướng bất thường).                                                                                                                                       |
| `/deviations`                                                                    | `DeviationListPage`                               |     **REMOVE**     | Quản lý sai lệch CAPA chỉ phục vụ Cổng 5 của quy trình xuất xưởng lô.                                                                                                                               |
| `/change-control`                                                                | `ChangeControlListPage`                           |     **REMOVE**     | Quản lý yêu cầu thay đổi (CR) phục vụ thẩm duyệt xuất xưởng.                                                                                                                                        |
| `/users`, `/settings`, `/account`, `/audit-logs`, `/criteria-aliases`, `/search` | System Pages                                      |      **KEEP**      | Xác thực, phân quyền RBAC, nhật ký kiểm toán ALCOA+, từ điển đồng nghĩa chỉ tiêu OCR.                                                                                                               |

---

### 2.2. Components (`src/components/`)

| Nhóm Component            | Tên / Đường dẫn                                 |     Phân loại      | Đánh giá & Hướng xử lý                                                                                                                    |
| :------------------------ | :---------------------------------------------- | :----------------: | :---------------------------------------------------------------------------------------------------------------------------------------- |
| **Navigation & Layout**   | `Layout.tsx`, `GlobalCommandPalette.tsx`        |    **SIMPLIFY**    | Tinh gọn menu thanh bên (Sidebar) thành đúng 6 khu vực nghiệp vụ chính + Hệ thống. Gỡ bỏ mục Sai lệch, Thay đổi, và các lệnh Release.     |
| **Đối chiếu Lab**         | `LabComparisonModal.tsx`                        | **KEEP & PROMOTE** | Công cụ so sánh cốt lõi: So sánh phiếu nội bộ vs ngoại kiểm của cùng Lô, hiển thị sai số RPD, kiểm tra đơn vị và phương pháp tương đương. |
| **Xác nhận Mapping**      | `MappingConfirmModal.tsx`                       |      **KEEP**      | Cốt lõi của pipeline OCR/Excel: Cho phép người dùng xem trước và duyệt ánh xạ trước khi lưu.                                              |
| **Snapshot Đánh giá**     | `EvaluationSnapshotModal.tsx`                   |      **KEEP**      | Hiển thị chi tiết snapshot đánh giá niêm phong của phiếu kiểm nghiệm (truy xuất nguồn gốc ALCOA+).                                        |
| **Báo cáo CoA**           | `CoAReport.tsx`                                 |      **KEEP**      | Hiển thị phiếu kiểm nghiệm / phân tích chuẩn hóa.                                                                                         |
| **Nhập chỉ tiêu**         | `CriteriaInputGroup.tsx`                        |      **KEEP**      | Bảng nhập và hiển thị chỉ tiêu kiểm nghiệm trên form.                                                                                     |
| **Chữ ký xuất xưởng**     | `ESignatureModal.tsx`                           |     **REVIEW**     | Loại bỏ hoàn toàn khỏi luồng xuất xưởng lô. Chỉ giữ nếu phân hệ ký phê duyệt phiếu kiểm nghiệm thực sự cần.                               |
| **Tư vấn xuất xưởng AI**  | `AIBatchClearanceModal.tsx`                     |     **REMOVE**     | Module tư vấn 7 cổng xuất xưởng bằng AI (ngoài phạm vi).                                                                                  |
| **Nhãn Release**          | `BatchTestingQABadge.tsx`                       |    **SIMPLIFY**    | Đổi thành nhãn hiển thị trạng thái chất lượng (`Đạt`, `Không đạt`, `Đang kiểm tra`) thay vì sẵn sàng xuất xưởng.                          |
| **Sai lệch / CAPA modal** | `DeviationReportModal.tsx`                      |     **REMOVE**     | Không thuộc phạm vi ứng dụng giám sát chất lượng tinh gọn.                                                                                |
| **Điều tra OOS**          | `OOSInvestigationModal.tsx`                     |    **SIMPLIFY**    | Tinh gọn thành ghi nhận nhận xét/ghi chú khi chỉ tiêu OOS (không tạo ticket CAPA phức tạp).                                               |
| **Kiểm toán dữ liệu**     | `DataConsistencyCenter.tsx`                     |      **KEEP**      | Công cụ hữu ích giúp quét và phát hiện sai lệch dữ liệu giữa Lô và Phiếu.                                                                 |
| **UI Primitives**         | `src/components/ui/*` (Button, Input, Table...) |      **KEEP**      | Giữ nguyên 100% bộ design system và bảng ảo hóa `VirtualizedTable`.                                                                       |

---

### 2.3. Services & Domain Logic (`src/services/`, `src/domain/`, `src/domains/`)

| Module / Service                 | Đường dẫn                                                                                                                  |    Phân loại    | Vai trò trong hệ thống tinh gọn                                                                                                                                                                |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :-------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Đánh giá chất lượng tất định** | `src/domain/evaluation/QualityEvaluationEngine.ts`                                                                         | **KEEP (SSoT)** | **Trái tim của hệ thống đánh giá**: Thực thi `CriterionEvaluator`, `AlternateRuleEvaluator`, `OverallResultEvaluator` trả về 4 trạng thái tất định `PASS` \| `FAIL` \| `PENDING` \| `UNKNOWN`. |
| **Trích xuất tài liệu & OCR**    | `src/services/ai/geminiService.ts`, `tesseractFallback.ts`, `src/services/ocr/*`                                           |    **KEEP**     | Pipeline đọc PDF/ảnh scan, tiền xử lý DPI cao, trích xuất text/bảng. Tuân thủ 12 quy tắc OCR (không đoán mò số liệu).                                                                          |
| **Đối chiếu phòng Lab**          | `src/services/ai/labComparisonService.ts`                                                                                  | **KEEP (CORE)** | Động cơ so sánh đối chiếu phiếu nội bộ và bên ngoài của cùng một lô. Đánh giá độ chênh lệch RPD, sai số hệ thống, kiểm tra tương đương đơn vị/phương pháp.                                     |
| **Từ điển đồng nghĩa chỉ tiêu**  | `src/services/criteriaAliasService.ts`, `src/utils/aiMapping.ts`                                                           |    **KEEP**     | Chuẩn hóa tên gọi chỉ tiêu giữa các phòng kiểm nghiệm khác nhau để map chính xác vào TCCS.                                                                                                     |
| **Thống kê SPC & Xu hướng**      | `src/pages/quality/trend/utils/spcHelpers.ts`, `src/services/analytics/*`                                                  |    **KEEP**     | Tính toán $C_p, C_{pk}, P_p, P_{pk}$, đường kiểm soát UCL/LCL, 8 quy tắc Nelson. Có rào chắn không tính khi không đủ số liệu.                                                                  |
| **Lưu trữ & Truy xuất dữ liệu**  | `src/services/testResultService.ts`, `databaseService.ts`, `auditService.ts`                                               |    **KEEP**     | CRUD phiếu kiểm nghiệm, lưu lịch sử kiểm toán, niêm phong snapshot kết quả.                                                                                                                    |
| **Quản lý phòng kiểm nghiệm**    | `src/services/laboratoryService.ts`                                                                                        |    **KEEP**     | Danh mục các lab (Nội bộ, Quatest, CASE, Pasteur, Eurofins...).                                                                                                                                |
| **Release Engine (Xuất xưởng)**  | `packages/release-engine/`                                                                                                 |   **REMOVE**    | Module tính toán 7 Release Gates và vòng đời chữ ký số xuất xưởng.                                                                                                                             |
| **Release Application Service**  | `src/services/app/ReleaseService.ts`, `src/services/releaseCommandPort.ts`                                                 |   **REMOVE**    | Dịch vụ điều phối xuất xưởng và cổng lệnh RPC xuất xưởng.                                                                                                                                      |
| **Batch Release Decision**       | `src/domain/batch/BatchReleaseDecisionService.ts`, `BatchReleaseProgressService.ts`, `BatchReleaseWorkflowSynchronizer.ts` |   **REMOVE**    | Các logic phục vụ thẩm định và đồng bộ tiến trình xuất xưởng lô.                                                                                                                               |
| **Deviation & CAPA Domain**      | `src/domains/deviation/`, `src/domains/capa/`, `src/services/app/DeviationAppService.ts`                                   |   **REMOVE**    | Nghiệp vụ xử lý sai lệch phân xưởng phục vụ release gate.                                                                                                                                      |
| **Change Control Domain**        | `src/domains/change-request/`, `src/services/app/ChangeControlAppService.ts`                                               |   **REMOVE**    | Nghiệp vụ kiểm soát thay đổi phục vụ release gate.                                                                                                                                             |

---

### 2.4. Phân Tích Logic Đánh Giá Chất Lượng Trùng Lặp (Duplicate Evaluation Analysis)

Codebase hiện tại tồn tại 3 nơi có logic đánh giá chất lượng có sự chồng chéo:

1. **`src/domain/evaluation/QualityEvaluationEngine.ts` (Chuẩn nhất - Deterministic SSoT)**:
   - Tách bạch: `SpecificationParser` $\to$ `CriterionEvaluator` $\to$ `AlternateRuleEvaluator` $\to$ `OverallResultEvaluator` $\to$ `EvaluationSnapshotBuilder`.
   - Kết quả: `PASS`, `FAIL`, `PENDING`, `UNKNOWN`.
   - Không bị ảnh hưởng bởi vai trò người dùng hay workflow hành chính.
2. **`src/domain/test-result/testResultStatusResolver.ts` (Legacy Resolver)**:
   - Chứa logic lặp lại cách so sánh `evaluateTestResultItem` (định lượng, text, khoảng) và phân giải `supremeTestResult`.
3. **`packages/release-engine/src/gates.ts` (Gate 1 & Gate 2 Check)**:
   - Tự kiểm tra lại `testResults` để quyết định Cổng 1 và Cổng 2 của đợt xuất xưởng.

**Giải pháp Giai đoạn C**:

- Chọn duy nhất **`src/domain/evaluation/QualityEvaluationEngine.ts`** làm Bộ máy đánh giá độc tôn cho toàn bộ ứng dụng Lean PQM.
- Bất kỳ thao tác đánh giá nào (nhập tay, upload Excel, scan OCR, hiển thị chi tiết, so sánh) đều đi qua `QualityEvaluationEngine`.

---

### 2.5. Phân Tích Trùng Lặp Cấu Trúc Domain Batch (Duplicate Batch Domain Analysis)

Codebase hiện đang có sự phân mảnh giữa:

- **`src/domain/batch/`**: Chứa các service chức năng giải quyết chất lượng và release (`canonicalBatchQualityDecision.ts`, `batchTestResultResolver.ts`, `batchIntegrityValidator.ts`, `BatchReleaseDecisionService.ts`...).
- **`src/domains/batch/`**: Chứa cấu trúc DDD dạng gói (`domains/batch/application/service.ts`, `domains/batch/application/releaseService.ts`, `domains/batch/domain/rules.ts`...).

**Đánh giá & Định hướng**:

- Trong ứng dụng Lean PQM, `Batch` chỉ cần là một thực thể dữ liệu cơ bản để gom nhóm các phiếu kiểm nghiệm (thuộc sản phẩm nào, ngày sản xuất, hạn dùng, tình trạng kiểm nghiệm nội bộ và ngoại kiểm).
- Cần giữ lại `batchTestResultResolver.ts` (để gom nhóm chính xác các phiếu kiểm nghiệm vào Lô, xử lý dung sai số 0 ở đầu).
- Các file phục vụ 7 Release Gates (`BatchReleaseDecisionService.ts`, `BatchReleaseProgressService.ts`, `BatchReleaseWorkflowSynchronizer.ts`, `domains/batch/application/releaseService.ts`) sẽ được dọn dẹp ở Giai đoạn F.

---

### 2.6. Backend Endpoints & Cloud Functions (`backend/`, `functions/`)

| Module                               | Endpoint / Function                   | Phân loại  | Đánh giá                                                                                                            |
| :----------------------------------- | :------------------------------------ | :--------: | :------------------------------------------------------------------------------------------------------------------ |
| `backend/src/routes/ai.ts`           | `POST /api/ai/chat`, `/api/ai/health` |  **KEEP**  | Phục vụ trợ lý AI phân tích và giải đáp dữ liệu kiểm nghiệm.                                                        |
| `backend/src/routes/release.ts`      | `POST /api/batch-release/approve`     | **REMOVE** | Endpoint phê duyệt xuất xưởng lô (đã chuyển Spark client-side từ v11.63.0, hoàn toàn thừa thãi trong ứng dụng mới). |
| `backend/src/routes/signature.ts`    | `POST /api/signatures`                | **REVIEW** | Endpoint tạo chữ ký số server-side (chỉ giữ nếu CoA cần, không dùng cho batch release).                             |
| `functions/src/releaseFunction.ts`   | `approveBatchRelease`                 | **REMOVE** | Cloud Function xuất xưởng lô.                                                                                       |
| `functions/src/reportFunction.ts`    | In báo cáo / CoA                      |  **KEEP**  | Xuất báo cáo và tổng hợp dữ liệu.                                                                                   |
| `functions/src/spcFunction.ts`       | Tính toán SPC                         |  **KEEP**  | Hỗ trợ tính toán thống kê kiểm soát chất lượng nâng cao.                                                            |
| `functions/src/signatureFunction.ts` | Ký điện tử                            | **REVIEW** | Không còn liên quan đến xuất xưởng lô.                                                                              |

---

## 3. DANH SÁCH RỦI RO & BIỆN PHÁP PHÒNG NGỪA (RISK REGISTER)

|   #    | Rủi ro tiềm ẩn                                                                     |     Mức độ     | Biện pháp kiểm soát & Phòng ngừa                                                                                                                                                                                                                  |
| :----: | :--------------------------------------------------------------------------------- | :------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **R1** | **Mất dữ liệu Lô và Phiếu kiểm nghiệm trong Firebase RTDB** khi gỡ bỏ code release |    **CAO**     | **Tuyệt đối không chạy bất kỳ migration xóa dữ liệu trên RTDB**. Giữ nguyên schema dữ liệu hiện hữu; UI chỉ đơn giản là không hiển thị các trường release thừa.                                                                                   |
| **R2** | **Lỗi Typecheck / Build khi gỡ bỏ module** do các component khác còn import        | **TRUNG BÌNH** | Thực hiện gỡ bỏ theo thứ tự từ tầng UI (bỏ route, bỏ menu) $\to$ tầng Service $\to$ tầng Domain $\to$ tầng Package. Chạy `npm run typecheck` sau mỗi bước chỉnh sửa.                                                                              |
| **R3** | **Sai lệch kết quả Đạt/Không đạt** khi gộp các logic đánh giá cũ                   |    **CAO**     | Chuẩn hóa duy nhất vào `QualityEvaluationEngine` với bộ 4 trạng thái (`PASS`, `FAIL`, `PENDING`, `UNKNOWN`). Chạy bộ test hồi quy của engine (`QualityEvaluationEngine.parity.test.ts`, `evaluationEdgeCases.test.ts`) để bảo đảm 100% nhất quán. |
| **R4** | **OCR suy đoán nhầm giá trị** hoặc mất dấu thập phân                               |    **CAO**     | Tuân thủ nghiêm ngặt 12 quy tắc của `OCR_RULES.md`: Bảo toàn số thập phân, bảo toàn đơn vị, tách biệt giá trị đo và mức giới hạn, bắt buộc Human Confirmation qua `MappingConfirmModal`.                                                          |
| **R5** | **Tính toán sai lệch (Bias/RPD) giữa hai phiếu không cùng đơn vị đo**              | **TRUNG BÌNH** | Tận dụng cơ chế kiểm tra tương đương đơn vị trong `labComparisonService.ts`: Nếu 2 phiếu có đơn vị khác nhau (ví dụ `%` vs `mg/g`) mà chưa có hệ số quy đổi rõ ràng, gắn cờ cảnh báo `UNIT_MISMATCH` và không tính RPD tự động.                   |
| **R6** | **Tính sai SPC khi dữ liệu ít hơn 5 lô hoặc phương sai bằng 0**                    |    **THẤP**    | Giữ nguyên rào chắn kiểm tra mẫu trong `spcHelpers.ts`: Bắt buộc tối thiểu $N \ge 5$ lô để tính $C_p/C_{pk}$, nếu không đủ trả về `N/A` kèm giải trình lý do.                                                                                     |

---

## 4. KẾ HOẠCH HÀNH ĐỘNG CÁC GIAI ĐOẠN TIẾP THEO

- **Giai đoạn B (Tinh gọn giao diện)**:
  - Tái cấu trúc Menu Sidebar của `Layout.tsx` chỉ hiển thị 6 khu vực nghiệp vụ.
  - Tinh gọn `App.tsx`: gỡ bỏ các route `/deviations`, `/change-control`, `/batches/360/:id`.
  - Tinh gọn `BatchDetailPage.tsx`: chuyển đổi từ màn hình 7 Gates xuất xưởng sang màn hình xem hồ sơ chất lượng Lô & đối chiếu phiếu.
  - Bổ sung điểm truy cập trực quan cho chức năng **So sánh Phiếu Nội bộ vs Ngoại kiểm** (`LabComparison`).
- **Giai đoạn C (Lõi dữ liệu và chất lượng)**:
  - Chuẩn hóa mô hình dữ liệu truy xuất: Product $\to$ Specification (TCCS Version) $\to$ Batch $\to$ TestResult (Nội bộ / Ngoại kiểm) $\to$ TestResultItem.
  - Khẳng định `QualityEvaluationEngine.ts` là thẩm quyền đánh giá duy nhất.
- **Giai đoạn D (Nhập dữ liệu & Pipeline trích xuất)**:
  - Thống nhất pipeline: `Extract` $\to$ `Normalize` $\to$ `Map Criteria` $\to$ `Validate` $\to$ `Preview` $\to$ `Human Confirm` $\to$ `Persist` $\to$ `Evaluate`.
- **Giai đoạn E (So sánh và xu hướng)**:
  - Hoàn thiện giao diện và luồng đối chiếu 2 phiếu kiểm nghiệm của cùng một lô.
  - Củng cố trang Phân tích xu hướng chất lượng và SPC.
- **Giai đoạn F (Dọn code và dependencies)**:
  - Xóa bỏ các file dead code của release workflow, cập nhật tài liệu kiến trúc và hướng dẫn vận hành.
- **Kiểm thử nghiệm thu & Báo cáo cuối cùng**:
  - Chạy full test suite, typecheck, build và báo cáo nghiệm thu 12 tiêu chí bắt buộc.
