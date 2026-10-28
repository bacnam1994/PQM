# Quy tắc dự án – PQM (Hệ thống Quản lý Chất lượng V-Biotech)

## 🚨 QUY TẮC BẮT BUỘC DÀNH CHO AI (MANDATORY AI RULES)

1. **ĐỌC TỔNG QUAN HỆ THỐNG**:
   - Khi bắt đầu làm việc hoặc nhận bất kỳ yêu cầu nào, AI **PHẢI** đọc và tham khảo file [`PROJECT_OVERVIEW.md`](file:///e:/7%20PQM/PROJECT_OVERVIEW.md) tại thư mục gốc để nắm bắt toàn bộ kiến trúc, dữ liệu, logic nghiệp vụ và các quy tắc của app.

2. **TỰ ĐỘNG CẬP NHẬT TÀI LIỆU KHI CÓ THAY ĐỔI**:
   - Mỗi khi thực hiện sửa đổi mã nguồn (thêm/sửa tính năng, thay đổi luồng dữ liệu, schema, routing, dịch vụ AI, tối ưu giao diện...), AI **BẮT BUỘC PHẢI TỰ ĐỘNG CẬP NHẬT** file [`PROJECT_OVERVIEW.md`](file:///e:/7%20PQM/PROJECT_OVERVIEW.md) để luôn phản ánh chính xác 100% phiên bản mới nhất của ứng dụng.
   - Luôn thêm dòng ghi chú thay đổi vào bảng **Nhật ký cập nhật dự án (Project Changelog)** ở cuối file `PROJECT_OVERVIEW.md`.

3. **XUẤT FULL_SOURCE_CODE SAU KHI DEPLOY & PUSH GITHUB**:
   - Sau mỗi lần deploy lên Firebase Hosting **VÀ** push code lên GitHub thành công, AI **BẮT BUỘC** phải tự động chạy lệnh xuất file `FULL_SOURCE_CODE.md` bằng lệnh:
     ```powershell
     npm run export:source
     ```
   - File `FULL_SOURCE_CODE.md` và `FULL_SOURCE_CODE.txt` là bản snapshot toàn bộ mã nguồn tại thời điểm deploy, dùng để tham chiếu nhanh và chia sẻ với AI trong phiên làm việc tiếp theo.

4. **TUÂN THỦ TUYỆT ĐỐI MASTER WORKFLOW & NGUYÊN TẮC KIẾN TRÚC ĐÃ ĐỊNH NGHĨA**:
   - **Không được thay đổi hoặc diễn giải khác với các nguyên tắc và workflow đã định nghĩa trong thư mục [`docs/workflow/`](file:///e:/7%20PQM/docs/workflow/README.md) (đặc biệt là [`docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md`](file:///e:/7%20PQM/docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md)) và [`.vibecode/PQM_MASTER_RULES.md`](file:///e:/7%20PQM/.vibecode/PQM_MASTER_RULES.md); nếu source code hiện tại mâu thuẫn với Master Workflow, phải báo cáo mâu thuẫn trước khi sửa.**
   - Mọi thay đổi logic nghiệp vụ, quy trình phê duyệt, giải quyết trạng thái (Status Resolver), rào chắn an ninh (Security Guard / Firebase Rules) đều phải đối chiếu với các nguyên tắc kiến trúc đã phê duyệt trước khi triển khai.

---

## 🧠 Workspace Skills của Dự án (`.agents/skills/`)

Khi thực hiện các tác vụ chuyên sâu trong dự án PQM, AI chủ động kích hoạt các Workspace Skills sau:

- **`pqm-architecture`** ([`.agents/skills/pqm-architecture/SKILL.md`](file:///e:/7%20PQM/.agents/skills/pqm-architecture/SKILL.md)): Bản đồ kiến trúc phân tầng (`UI -> Hook -> AppService -> Workflow/Domain -> Repository -> Firebase`), 15 Golden Invariants (GxP / 21 CFR Part 11), và quy chuẩn kiểm thử 6 tầng.
- **`pqm-ocr-pipeline`** ([`.agents/skills/pqm-ocr-pipeline/SKILL.md`](file:///e:/7%20PQM/.agents/skills/pqm-ocr-pipeline/SKILL.md)): Quy tắc bất biến khi xử lý OCR & AI Vision cho Phiếu Kiểm Nghiệm (PKN) và TCCS.

---

## 🚀 Kiến trúc triển khai & Quy trình Deploy

- **GitHub**: Chỉ dùng để **sao lưu mã nguồn**. Không phải môi trường hosting.
- **Firebase Hosting**: Là nơi **deploy và host ứng dụng thực tế**.
  - URL sản xuất: `https://v-biotech.web.app`
  - Firebase project ID: `v-biotech`
  - File cấu hình: [`firebase.json`](file:///e:/7%20PQM/firebase.json) (thư mục `dist` là output build)
  - Quy tắc RTDB: [`database.rules.json`](file:///e:/7%20PQM/database.rules.json)
  - Quy tắc Storage: [`storage.rules`](file:///e:/7%20PQM/storage.rules)

### Quy trình Deploy chuẩn (6 bước)

1. **Phát triển tính năng** → Sửa code & chạy kiểm thử (`npm run typecheck`, `npx vitest run`)
2. **Cập nhật tài liệu** → Tự động cập nhật [`PROJECT_OVERVIEW.md`](file:///e:/7%20PQM/PROJECT_OVERVIEW.md)
3. **Build** → `npm run build`
4. **Deploy lên Firebase** → `npx firebase-tools deploy --only hosting`
5. **Commit và Push lên GitHub** → `git add -A && git commit -m "..." && git push`
6. **Xuất FULL_SOURCE_CODE** → `npm run export:source`

### Cấu hình Vite BASE_URL & Routing

- **Local dev** (`npm run dev`): `base = './'`
- **Firebase Hosting** (`npm run build`): `base = '/'` (Firebase phục vụ từ root `/`).
- Hàm `getAppUrl(path)` tự đọc `import.meta.env.BASE_URL` — khi build cho Firebase sẽ trả về đúng `/path`.
