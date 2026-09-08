import { test, expect } from '@playwright/test';
import { setupTestPage } from './helpers/setup';

test.beforeEach(async ({ page }) => {
  await setupTestPage(page);
});

test.describe('Test Result Form & Navigation Automation', () => {
  test('Nên điều hướng đến trang Kết quả Lab và mở Form Nhập Phiếu Kiểm Nghiệm Mới', async ({ page }) => {
    // 1. Điều hướng đến trang Danh sách Kết quả Lab
    await page.goto('/test-results');
    await expect(page.getByText('Kết quả Lab (QC)')).toBeVisible({ timeout: 15000 });

    // 2. Kiểm tra nút Nhập Kết quả Mới
    const addBtn = page.getByRole('button', { name: /NHẬP KẾT QUẢ MỚI/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // 3. Đợi chuyển hướng đến trang /test-results/new
    await expect(page).toHaveURL(/.*\/test-results\/new/);
    await expect(page.getByText(/Nhập Phiếu Kiểm Nghiệm Mới/i)).toBeVisible();

    // 4. Kiểm tra các trường thông tin cơ bản trên Form
    const labInput = page.getByPlaceholder('VD: Phòng QC, CASE...');
    await expect(labInput).toBeVisible();
    await labInput.fill('Phòng QC (Nội bộ)');

    const batchSearchInput = page.getByPlaceholder('Tìm kiếm Lô hàng (Số lô hoặc Tên SP)...');
    await expect(batchSearchInput).toBeVisible();

    // 5. Kiểm tra nút Lưu Phiếu kiểm nghiệm hiện diện
    const submitBtn = page.getByRole('button', { name: /Lưu Kết quả Mới|Cập nhật Phiếu/i });
    await expect(submitBtn).toBeVisible();
  });
});