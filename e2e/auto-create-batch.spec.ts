import { test, expect } from '@playwright/test';
import { setupTestPage } from './helpers/setup';

test.beforeEach(async ({ page }) => {
  await setupTestPage(page);
});

test.describe('Phân hệ Tự động Nhận diện & Tạo Lô Mới từ OCR (Auto-Create Batch Modal)', () => {
  test('Nên mở AutoCreateBatchModal khi phát hiện số lô mới và cho phép xác nhận tạo lô', async ({ page }) => {
    // 1. Điều hướng đến Form nhập kết quả kiểm nghiệm
    await page.goto('/test-results/new');
    await expect(page.getByText(/Nhập Phiếu Kiểm Nghiệm Mới|Cập nhật Phiếu/i)).toBeVisible({ timeout: 15000 });

    // 2. Kích hoạt hook giả lập phát hiện lô mới từ OCR
    await page.evaluate(() => {
      if (typeof (window as any).__TEST_TRIGGER_AUTO_CREATE_BATCH__ === 'function') {
        (window as any).__TEST_TRIGGER_AUTO_CREATE_BATCH__({
          batchNo: 'LÔ-AI-E2E-2026',
          productCode: 'SP-BIO-01',
          productName: 'Men vi sinh Probiotic',
          mfgDate: '01/03/2026',
          expDate: '01/03/2028',
        });
      }
    });

    // 3. Kiểm tra Modal hiển thị đúng tiêu đề và thông tin lô mới
    await expect(page.getByText('AI phát hiện Lô mới')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('LÔ-AI-E2E-2026')).toBeVisible();

    // 4. Kiểm tra các trường ngày tháng NSX và HSD
    await expect(page.getByText('Ngày sản xuất (NSX)')).toBeVisible();
    await expect(page.getByText('Hạn dùng (HSD)')).toBeVisible();

    // 5. Kiểm tra tương tác nút "Bỏ qua"
    const cancelBtn = page.getByRole('button', { name: /Bỏ qua/i });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
    await expect(page.getByText('AI phát hiện Lô mới')).not.toBeVisible();

    // 6. Mở lại modal để kiểm tra nút "Xác nhận & Tạo Lô"
    await page.evaluate(() => {
      if (typeof (window as any).__TEST_TRIGGER_AUTO_CREATE_BATCH__ === 'function') {
        (window as any).__TEST_TRIGGER_AUTO_CREATE_BATCH__({
          batchNo: 'LÔ-AI-E2E-2026',
          productCode: 'SP-BIO-01',
          productName: 'Men vi sinh Probiotic',
          mfgDate: '01/03/2026',
          expDate: '01/03/2028',
        });
      }
    });

    await expect(page.getByText('AI phát hiện Lô mới')).toBeVisible();
    const confirmBtn = page.getByRole('button', { name: /Xác nhận & Tạo Lô/i });
    await expect(confirmBtn).toBeVisible();
  });
});
