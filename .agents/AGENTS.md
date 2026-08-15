# Quy tắc dự án – PQM (Hệ thống Quản lý Chất lượng)

## 🚨 QUY TẮC BẮT BUỘC DÀNH CHO AI (MANDATORY AI RULES)

1. **ĐỌC TỔNG QUAN HỆ THỐNG**:
   - Khi bắt đầu làm việc hoặc nhận bất kỳ yêu cầu nào, AI **PHẢI** đọc và tham khảo file [`PROJECT_OVERVIEW.md`](file:///D:/26%20Kiem%20nghiem/PQM/PROJECT_OVERVIEW.md) tại thư mục gốc để nắm bắt toàn bộ kiến trúc, dữ liệu, logic nghiệp vụ và các quy tắc của app.

2. **TỰ ĐỘNG CẬP NHẬT TÀI LIỆU KHI CÓ THAY ĐỔI**:
   - Mỗi khi thực hiện sửa đổi mã nguồn (thêm/sửa tính năng, thay đổi luồng dữ liệu, schema, routing, dịch vụ AI, tối ưu giao diện...), AI **BẮT BUỘC PHẢI TỰ ĐỘNG CẬP NHẬT** file [`PROJECT_OVERVIEW.md`](file:///D:/26%20Kiem%20nghiem/PQM/PROJECT_OVERVIEW.md) để luôn phản ánh chính xác 100% phiên bản mới nhất của ứng dụng.
   - Luôn thêm dòng ghi chú thay đổi vào bảng **Nhật ký cập nhật dự án (Project Changelog)** ở cuối file `PROJECT_OVERVIEW.md`.

---

## Kiến trúc triển khai (QUAN TRỌNG)

- **GitHub**: Chỉ dùng để **sao lưu mã nguồn**. Không phải môi trường hosting.
- **Firebase Hosting**: Là nơi **deploy và host ứng dụng thực tế**.
  - URL sản xuất: `https://v-biotech.web.app`
  - Firebase project ID: `v-biotech`
  - File cấu hình: `firebase.json` (thư mục `dist` là output build)
  - Quy tắc RTDB: `database.rules.json`
  - Quy tắc Storage: `storage.rules`

## Quy trình Deploy

1. **Phát triển tính năng** → Sửa code
2. **Cập nhật tài liệu** → Tự động cập nhật `PROJECT_OVERVIEW.md`
3. **Build** → `npm run build`
4. **Deploy lên Firebase** → `firebase deploy` (hoặc `firebase deploy --only hosting`)
5. **Commit và Push lên GitHub** → để sao lưu code

## Cấu hình Vite BASE_URL

- **Local dev** (`npm run dev`): `base = './'`
- **Firebase Hosting** (`npm run build`): `base = '/'` (Firebase phục vụ từ root)
- **KHÔNG** dùng prefix `/PQM/` vì đó là cấu hình cũ cho GitHub Pages (đã bỏ)

## Lưu ý khi dùng `window.open` và routing

- Vì Firebase Hosting phục vụ từ `/`, các URL nội bộ viết bình thường như `/test-results/print/xxx` là đúng.
- Hàm `getAppUrl(path)` tự đọc `import.meta.env.BASE_URL` — khi build cho Firebase sẽ trả về đúng `/path`.

## GitHub Actions

- Workflow `playwright.yml`: Chạy test tự động khi push (không deploy).
- Không có workflow deploy tự động lên GitHub Pages (đã loại bỏ).

