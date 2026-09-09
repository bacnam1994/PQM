import { test, expect } from '@playwright/test';
import { setupTestPage } from './helpers/setup';

test.beforeEach(async ({ page }) => {
  await setupTestPage(page);
});

test.describe('PQM 3.0 - Chữ ký Điện tử & Phê duyệt Lô hàng (FDA 21 CFR Part 11)', () => {
  test('Nên hiển thị trang Quản lý Lô và các công cụ quản lý lô hàng', async ({ page }) => {
    // 1. Điều hướng tới danh sách Lô
    await page.goto('/batches');
    await expect(page.getByRole('heading', { name: /Quản lý Lô/i })).toBeVisible({ timeout: 15000 });

    // 2. Tìm kiếm các công cụ trên trang
    await expect(page.getByPlaceholder(/Tìm số lô/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Đăng ký Lô mới/i })).toBeVisible();

    // 3. Nếu có lô trong danh sách, mở chi tiết
    const batchRows = page.locator('table tbody tr');
    const count = await batchRows.count();
    
    if (count > 0) {
      const firstRow = batchRows.first();
      const viewDetailBtn = firstRow.locator('a[href*="/batches/"]').first();
      if (await viewDetailBtn.isVisible()) {
        await viewDetailBtn.click();
        await expect(page).toHaveURL(/\/batches\/.+/);
      }
    }
  });

  test('Nên hỗ trợ mở Modal Ký số Điện tử với đầy đủ cam kết 21 CFR Part 11 khi có hành động phê duyệt', async ({ page }) => {
    await page.goto('/batches');
    await expect(page.getByRole('heading', { name: /Quản lý Lô/i })).toBeVisible({ timeout: 15000 });

    // Tìm nút phê duyệt trực tiếp trên bảng hoặc vào chi tiết lô
    const approveBtnOnList = page.getByRole('button', { name: /Phê duyệt|Xuất xưởng|Ký số/i }).first();
    if (await approveBtnOnList.isVisible({ timeout: 2000 }).catch(() => false)) {
      await approveBtnOnList.click();

      // Kiểm tra ESignatureModal mở lên
      const modal = page.getByText(/Ký số Điện tử|21 CFR Part 11/i);
      await expect(modal.first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByPlaceholder(/Nhập mật khẩu/i)).toBeVisible();

      // Đóng modal
      const cancelBtn = page.getByRole('button', { name: /Hủy bỏ|Đóng/i });
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    }
  });
});
