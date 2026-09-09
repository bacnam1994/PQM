import { test, expect } from '@playwright/test';
import { setupTestPage } from './helpers/setup';

test.beforeEach(async ({ page }) => {
  await setupTestPage(page);
});

test.describe('PQM 3.0 - Quản lý Sai lệch Chất lượng & CAPA Workflow (GMP-WHO)', () => {
  test('Nên tải trang Quản lý Sai lệch & CAPA và hiển thị đầy đủ các KPI Cards', async ({ page }) => {
    // 1. Điều hướng đến trang Sai lệch
    await page.goto('/deviations');
    await expect(page.getByRole('heading', { name: /Quản lý Sai lệch & CAPA/i })).toBeVisible({ timeout: 15000 });

    // 2. Kiểm tra các thẻ KPI Cards chính xác
    await expect(page.getByText('Tổng hồ sơ').first()).toBeVisible();
    await expect(page.getByText('Đang điều tra').first()).toBeVisible();
    await expect(page.getByText('Thực hiện CAPA').first()).toBeVisible();
    await expect(page.getByText('Đánh giá hiệu quả').first()).toBeVisible();

    // 3. Kiểm tra thanh tìm kiếm và nút khởi tạo
    await expect(page.getByRole('button', { name: /Khởi tạo Sai lệch/i })).toBeVisible();
  });

  test('Nên hỗ trợ mở modal khởi tạo sai lệch mới', async ({ page }) => {
    await page.goto('/deviations');
    await expect(page.getByRole('heading', { name: /Quản lý Sai lệch & CAPA/i })).toBeVisible({ timeout: 15000 });

    const createBtn = page.getByRole('button', { name: /Khởi tạo Sai lệch/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Kiểm tra modal hiển thị
    const modalHeading = page.getByText(/Khởi tạo Hồ sơ Sai lệch Chất lượng/i);
    await expect(modalHeading).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder(/Nhiệt độ kho bảo quản vượt ngưỡng/i)).toBeVisible();

    // Đóng modal
    const cancelBtn = page.getByRole('button', { name: /Hủy/i });
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    }
  });
});
