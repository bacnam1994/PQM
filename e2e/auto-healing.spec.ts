import { test, expect } from '@playwright/test';
import { setupTestPage } from './helpers/setup';

test.beforeEach(async ({ page }) => {
  await setupTestPage(page);
});

test.describe('Phân hệ Giám sát Toàn vẹn & Tự phục hồi Dữ liệu (Auto-Healing Engine)', () => {
  test('Nên tải trang Cấu hình hệ thống và hiển thị Trung tâm Kiểm soát Dữ liệu', async ({ page }) => {
    // 1. Điều hướng đến trang cài đặt hệ thống
    await page.goto('/settings');
    await expect(page.getByText('Cấu hình Hệ thống')).toBeVisible({ timeout: 15000 });

    // 2. Kiểm tra khối Trung tâm Kiểm soát & Hàn gắn Toàn vẹn Dữ liệu
    const centerTitle = page.getByText(/Trung tâm Kiểm soát & Hàn gắn Toàn vẹn Dữ liệu/i);
    await centerTitle.scrollIntoViewIfNeeded();
    await expect(centerTitle).toBeVisible();

    // 3. Kiểm tra thẻ Điểm Sức khỏe dữ liệu
    await expect(page.getByText(/Điểm Sức khỏe/i)).toBeVisible();
    await expect(page.getByText(/\/100/i)).toBeVisible();

    // 4. Kiểm tra nút "Quét lại"
    const rescanBtn = page.getByRole('button', { name: /Quét lại/i });
    await expect(rescanBtn).toBeVisible();
    await rescanBtn.click();

    // 5. Xác nhận thông báo hoàn tất quét
    await expect(page.getByText(/Đã hoàn tất rà soát toàn bộ hệ thống/i)).toBeVisible({ timeout: 10000 });
  });

  test('Nên cho phép lọc các danh mục vấn đề dữ liệu hoặc kích hoạt Auto-Heal', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('Cấu hình Hệ thống')).toBeVisible({ timeout: 15000 });

    const centerTitle = page.getByText(/Trung tâm Kiểm soát & Hàn gắn Toàn vẹn Dữ liệu/i);
    await centerTitle.scrollIntoViewIfNeeded();

    // Kiểm tra nút "Hàn gắn Toàn bộ" nếu có lỗi cần tự động sửa
    const healAllBtn = page.getByRole('button', { name: /Hàn gắn Toàn bộ/i });
    if (await healAllBtn.isVisible()) {
      await healAllBtn.click();
      await expect(healAllBtn).toBeEnabled({ timeout: 10000 });
    }
  });
});
