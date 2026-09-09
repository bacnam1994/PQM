import { test, expect } from '@playwright/test';
import { setupTestPage } from './helpers/setup';

test.beforeEach(async ({ page }) => {
  await setupTestPage(page);
});

test.describe('PQM 3.0 - Release Guard & Kiểm soát Xuất xưởng Nghiêm ngặt', () => {
  test('Nên hiển thị giao diện Quản lý Lô và bảo vệ xuất xưởng an toàn', async ({ page }) => {
    // 1. Điều hướng tới danh sách Lô
    await page.goto('/batches');
    await expect(page.getByRole('heading', { name: /Quản lý Lô/i })).toBeVisible({ timeout: 15000 });

    const batchRows = page.locator('table tbody tr');
    const count = await batchRows.count();

    if (count > 0) {
      // Mở chi tiết lô đầu tiên
      const detailLink = batchRows.first().locator('a[href*="/batches/"]').first();
      if (await detailLink.isVisible()) {
        await detailLink.click();
        await page.waitForURL(/\/batches\/.+/, { timeout: 10000 });

        // Kiểm tra phần thông tin thẩm định chất lượng
        await expect(page.getByText(/Hồ sơ Chi tiết Lô|Tiến độ Kiểm nghiệm/i).first()).toBeVisible();

        // Kiểm tra xem có hiển thị thẻ Release Guard hoặc thông tin trạng thái không
        const statusBadge = page.getByText(/Kế hoạch|Đang kiểm|Đạt|Loại bỏ|Phê duyệt/i).first();
        await expect(statusBadge).toBeVisible();
      }
    } else {
      // Nếu chưa có lô, kiểm tra thông báo trống
      await expect(page.getByText(/Không tìm thấy Lô hàng/i)).toBeVisible();
    }
  });
});
