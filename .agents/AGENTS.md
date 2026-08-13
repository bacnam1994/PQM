# Quy tắc dự án – PQM (Hệ thống Quản lý Chất lượng)

## Kiến trúc triển khai (QUAN TRỌNG)

- **GitHub**: Chỉ dùng để **sao lưu mã nguồn**. Không phải môi trường hosting.
- **Firebase Hosting**: Là nơi **deploy và host ứng dụng thực tế**.
  - URL sản xuất: `https://pqm-xxx.web.app` (hoặc custom domain nếu có)
  - File cấu hình: `firebase.json` (thư mục `dist` là output build)
  - Quy tắc RTDB: `database.rules.json`
  - Quy tắc Storage: `storage.rules`

## Quy trình Deploy

1. **Phát triển tính năng** → Sửa code
2. **Build** → `npm run build`
3. **Deploy lên Firebase** → `firebase deploy` (hoặc `firebase deploy --only hosting`)
4. **Commit và Push lên GitHub** → để sao lưu code

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
