# KIẾN TRÚC THỰC TẾ HỆ THỐNG PQM (ARCHITECTURE.md)

Tài liệu này phản ánh **100% cấu trúc kiến trúc thực tế** của mã nguồn dự án PQM được rà soát trực tiếp từ codebase (không suy đoán, không giả định).

---

## 1. Điểm Đầu Vào (Entry Points)

- **Trình duyệt HTML**: [`index.html`](file:///d:/26%20Kiem%20nghiem/PQM/index.html) — Neo thẻ `#root`, nạp các font chữ Google Fonts (Inter, Roboto Mono) và cấu hình viewport.
- **Khởi tạo React**: [`src/index.tsx`](file:///d:/26%20Kiem%20nghiem/PQM/src/index.tsx) — Khởi tạo React 19 Root (`ReactDOM.createRoot`), import CSS toàn cục (`src/index.css`), bọc `React.StrictMode` quanh `<App />`.
- **Bộ định tuyến & Layout trung tâm**: [`src/App.tsx`](file:///d:/26%20Kiem%20nghiem/PQM/src/App.tsx) — Thiết lập `BrowserRouter`, cấu hình bảo vệ phân quyền (RBAC Route Guards), lazy-load các trang qua utility `lazyWithRetry`.
- **Bộ cung cấp ngữ cảnh toàn cục**: [`src/providers/AppProvider.tsx`](file:///d:/26%20Kiem%20nghiem/PQM/src/providers/AppProvider.tsx) — Tích hợp `QueryClientProvider` (TanStack Query v5), Zustand store sync, và quản lý ngữ cảnh xác thực.

---

## 2. Bản Đồ Màn Hình & Điều Hướng (Pages)

Toàn bộ 25 màn hình được tổ chức trong thư mục `src/pages/`:

| Nhóm chức năng                            | Thư mục               | Màn hình tiêu biểu & Tuyến đường (Route)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :---------------------------------------- | :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Xác thực (Auth)**                       | `src/pages/auth/`     | `LoginPage` (`/login`), `SignupPage` (`/signup`), `ForgotPasswordPage` (`/forgot-password`), `UnauthorizedPage` (`/unauthorized`), `WelcomePage` (`/welcome`)                                                                                                                                                                                                                                                                                               |
| **Hệ thống (System)**                     | `src/pages/system/`   | `Dashboard` (`/`), `SettingsPage` (`/settings`), `AccountPage` (`/account`), `SearchPage` (`/search`), `UserManagement` (`/users`), `CriteriaAliasManager` (`/criteria-alias`), `AuditLogPage` (`/audit-logs`), `NotFoundPage` (`*`)                                                                                                                                                                                                                        |
| **Sản phẩm & Nguyên liệu**                | `src/pages/products/` | `ProductList` (`/products`), `ProductDetail` (`/products/:id`), `ProductFormPage` (`/products/new`, `/products/:id/edit`), `MaterialList` (`/materials`), `MaterialFormPage` (`/materials/new`, `/materials/:id/edit`), `Product360Page`                                                                                                                                                                                                                    |
| **Lô sản xuất (Batches)**                 | `src/pages/batches/`  | `BatchList` (`/batches`), `BatchDetailPage` (`/batches/:id`), `BatchFormPage` (`/batches/new`, `/batches/:id/edit`), `Batch360Page` (`/batches/:id/360`)                                                                                                                                                                                                                                                                                                    |
| **Quản lý chất lượng & Kiểm nghiệm (QA)** | `src/pages/qa/`       | `TCCSList` (`/tccs`), `TCCSFormPage` (`/tccs/new`), `TccsDetailPage` (`/tccs/:id`), `ProductFormulaList` (`/formulas`), `ProductFormulaFormPage` (`/formulas/new`), `CriteriaList` (`/criteria`), `CriteriaFormPage` (`/criteria/new`), `TestResultList` (`/test-results`), `TestResultFormPage` (`/test-results/new`, `/test-results/:id/edit`), `CoAReportPage` (`/test-results/:id/coa`, `/test-results/print/:id`), `DeviationListPage` (`/deviations`) |
| **Theo dõi & Báo cáo chất lượng**         | `src/pages/quality/`  | `AlertsPage` (`/alerts`), `QualitySummaryReport` (`/reports/quality-summary`), `TrendAnalysisPage` (`/quality/trends`), `ChangeControlListPage` (`/quality/change-control`)                                                                                                                                                                                                                                                                                 |
| **Công khai (Public)**                    | `src/pages/public/`   | `CoAVerifyPage` (`/verify/coa/:id`) — Màn hình xác thực chứng chỉ CoA điện tử qua mã QR                                                                                                                                                                                                                                                                                                                                                                     |

---

## 3. Hệ Thống Components

- **UI Primitives (`src/components/ui/`)**: Hệ thống thẻ, nút bấm, input, modal, badge, dropdown, notification toast, table ảo hóa (`VirtualizedTable`).
- **Layout (`src/components/layout/`)**: `Sidebar`, `Header`, `PageHeader`, `Breadcrumbs`, `CookieConsentBanner`.
- **Operational Components (`src/components/operational/`)**: `ErrorBoundary`, `LoadingState`, `EmptyState`, `Skeleton`.
- **Tính năng chuyên biệt (`src/components/features/`)**:
  - `AIAssistantChat.tsx`: Trợ lý AI hỏi đáp dữ liệu và đề xuất hành động.
  - `BatchTestingQABadge.tsx`: Nhãn động hiển thị trạng thái sẵn sàng duyệt QA mà không làm đột biến cơ sở dữ liệu.
  - `CriteriaInputGroup.tsx`: Bảng nhập chỉ tiêu kiểm nghiệm trên form PKN với đầy đủ nhãn Đạt/Không đạt/Miễn kiểm.
  - `CoAReport.tsx`: Báo cáo CoA chính thức đọc 100% từ Snapshot niêm phong.

---

## 4. Tầng Dịch Vụ Ứng Dụng (Application & Core Services)

- **Application Services (`src/services/app/`)**: Điều phối nghiệp vụ, thực thi State Machine và kiểm soát OCC (Optimistic Concurrency Control):
  - `BatchAppService.ts`: Quản lý vòng đời Lô sản xuất.
  - `TestResultAppService.ts`: Quản lý phiếu kiểm nghiệm và niêm phong snapshot.
  - `TCCSAppService.ts`, `ProductAppService.ts`, `FormulaAppService.ts`, `MaterialAppService.ts`.
  - `ApprovalWorkflowService.ts`: Pipeline thẩm duyệt đa cấp và xác thực chữ ký điện tử.
  - `ReleaseService.ts`: Điều phối xuất xưởng qua 7 Release Gates.
- **Core Services (`src/services/core/`)**:
  - `universalSearchIndex.ts`: Chỉ mục tìm kiếm đảo (Inverted Index) chạy trên Client.
- **Dịch vụ nghiệp vụ chuyên ngành (`src/services/`)**:
  - `auditHardeningService.ts` & `auditService.ts`: Ghi nhật ký kiểm toán ALCOA+ mã hóa chuỗi SHA-256.
  - `signatureService.ts`: Chữ ký điện tử 21 CFR Part 11.
  - `laboratoryService.ts`: Quản lý phòng kiểm nghiệm và mẫu tiêu chuẩn.
  - `pharmacopoeiaService.ts`: Tra cứu dược điển và tiêu chuẩn kỹ thuật.
  - `criteriaAliasService.ts`: Từ điển đồng nghĩa và chuẩn hóa tên chỉ tiêu kiểm nghiệm.
  - `dataConsistencyService.ts`: Quét và giải quyết sai lệch dữ liệu toàn hệ thống.

---

## 5. Dịch Vụ AI & Xử Lý Văn Bản Thông Minh (AI Services)

Nằm trong `src/services/ai/`:

- **Cổng giao tiếp AI (`AIGateway.ts`)**: Điều phối tất cả các cuộc gọi mô hình ngôn ngữ lớn (LLM), tích hợp:
  - `semanticCacheService.ts`: Bộ đệm ngữ nghĩa L1 RAM + L2 LocalStorage (tiết kiệm token).
  - `aiActionGuard.ts` & `aiGovernanceService.ts`: Rào chắn phân quyền cấm AI tự ý ghi trực tiếp DB.
- **Trích xuất tài liệu (`geminiService.ts`)**:
  - Gọi Gemini Vision API qua `@google/generative-ai`.
  - Hỗ trợ đa ảnh inlineData (`image/png`, `image/jpeg`).
  - Dự phòng ngoại tuyến tự động qua `tesseractFallback.ts` (Tesseract.js WebAssembly).
- **Bộ công cụ & Prompt**:
  - `promptRegistry.ts` & `prompts.ts`: Quản lý danh mục system prompts phiên bản hóa.
  - `aiDraftManager.ts`: Quản lý dữ liệu nháp AI đề xuất cho biểu mẫu.
  - `batchClearanceService.ts`: Hỗ trợ QA thẩm định hồ sơ lô (chỉ đóng vai trò tư vấn - Advisory).

---

## 6. Luồng Dữ Liệu Thực Tế (Data Flow Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                 Firebase Realtime Database                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Repository Layer                       │
│    (BaseFirebaseRepository - Fail-Closed Query Policy)      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Application Service Layer                  │
│   (BatchAppService, TestResultAppService, ReleaseService)   │
│          → State Machine & Business Rules Check             │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      TanStack Query Cache    │ │    Zustand Store (UI)      │
│   (Server State, Stale 5m)   │ │  (Local / Ephemeral State) │
└──────────────┬───────────────┘ └─────────────┬──────────────┘
               │                               │
               └───────────────┬───────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Presentation Layer (React)                 │
│                 (Pages, Components, Hooks)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Luồng Xử Lý PDF / OCR / PKN (PDF/OCR Extraction Pipeline)

```
[1. User Upload File] (PDF hoặc Ảnh)
         │
         ▼
[2. PDF Analyzer] (`src/services/ocr/pdfAnalyzer.ts`)
   ├─ Quét toạ độ hình học (A4 / Letter / Custom)
   ├─ Đọc text layer (`page.getTextContent()`)
   └─ Phân loại: `DIGITAL_TEXT` vs `SCANNED_IMAGE` vs `HYBRID`
         │
         ├─────────────────────────────────────────┐
         ▼ (Nếu SCANNED / HYBRID)                  ▼ (Nếu DIGITAL_TEXT)
[3. High-DPI Rendering]                   [Native Text Stream]
   (`src/services/ocr/highDpiRenderer.ts`)  (Trích xuất trực tiếp
   - 250 - 300 DPI Canvas                  từ luồng PDF không nén)
   - Xuất lossless PNG                             │
         │                                         │
         ▼                                         │
[4. Image Preprocessing]                           │
   (`src/services/ocr/imagePreprocessor.ts`)       │
   - Grayscale (ITU-R BT.601)                      │
   - Auto Contrast Stretching                      │
   - Laplacian Sharpen                             │
   - Deskew (Projection Profile)                   │
         │                                         │
         └────────────────────┬────────────────────┘
                              │
                              ▼
[5. Trích Xuất Dữ Liệu] (`geminiService.ts` / `tesseractFallback.ts`)
   - Gemini Vision xử lý ảnh High-DPI + Prompt chuyên dụng
   - Fallback Tesseract.js nếu mất mạng / lỗi API
         │
         ▼
[6. Khớp Nối Ngữ Nghĩa & Mapping] (`aiMapping.ts`, `criteriaAliasService.ts`)
   - Tra cứu từ điển danh pháp Dược khoa
   - Ánh xạ sang chỉ tiêu TCCS
         │
         ▼
[7. Nhập Dữ Liệu Biểu Mẫu] (`TestResultFormPage.tsx`, `useTestResultAIIntegration.ts`)
   - Đưa vào React Hook Form qua Zod Schema Validation
   - Người dùng rà soát và xác nhận lưu
```

---

## 8. Luồng Quản Lý Biểu Mẫu (Form Flow)

1. **Schema Định Nghĩa**: Toàn bộ biểu mẫu có schema Zod tại `src/schemas/` (`testResultSchema.ts`, `tccsSchema.ts`, `formulaSchema.ts`, `productSchema.ts`).
2. **Hook Quản Lý**: `react-hook-form` kết hợp `@hookform/resolvers/zod`. Biểu mẫu sử dụng Uncontrolled Inputs để triệt tiêu re-render giật lag.
3. **Draft Tự Động**: `useFormDraft.ts` tự động lưu trữ bản nháp trên LocalStorage, chống mất dữ liệu khi vô tình đóng tab hoặc mất kết nối.
4. **Validation**: Kích hoạt khi Submit hoặc Blur. Các lỗi hiển thị trực tiếp dưới trường dữ liệu vi phạm.
