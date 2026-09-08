import { test, expect } from '@playwright/test';
import { setupTestPage } from './helpers/setup';

test.beforeEach(async ({ page }) => {
  await setupTestPage(page);
});

test.describe('Phân hệ Đối chiếu Ngoại kiểm đa phòng Lab (Lab Comparison)', () => {
  test('Nên mở được Modal Đối chiếu Lab từ danh sách kết quả và hiển thị đầy đủ công cụ phân tích', async ({ page }) => {
    // 1. Điều hướng đến trang Kết quả Lab
    await page.goto('/test-results');
    await expect(page.getByText('Kết quả Lab (QC)')).toBeVisible({ timeout: 15000 });

    // 2. Tìm và click nút "Đối chiếu Lab (AI)"
    const compareButton = page.getByRole('button', { name: /Đối chiếu Lab/i });
    await expect(compareButton).toBeVisible();
    await compareButton.click();

    // 3. Kiểm tra Modal mở lên thành công
    await expect(page.getByText('AI Cross-Lab Comparison')).toBeVisible();
    await expect(page.getByText('Phiếu Kiểm Nghiệm 1 (Gốc / Nội bộ)')).toBeVisible();
    await expect(page.getByText('Phiếu Kiểm Nghiệm 2 (Đối chiếu / Ngoại kiểm)')).toBeVisible();

    // 4. Kiểm tra nút hành động đối chiếu
    const runButton = page.getByRole('button', { name: /Tiến hành Đối chiếu/i });
    await expect(runButton).toBeVisible();

    // 5. Kiểm tra tương tác đóng modal
    const closeBtn = page.locator('button:has(svg.lucide-x)').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await expect(page.getByText('AI Cross-Lab Comparison')).not.toBeVisible();
    }
  });

  test('Nên thực hiện đối chiếu khi chọn 2 phiếu kiểm nghiệm có sẵn hoặc báo cảnh báo hợp lý', async ({ page }) => {
    await page.goto('/test-results');
    await expect(page.getByText('Kết quả Lab (QC)')).toBeVisible({ timeout: 15000 });
    
    await page.getByRole('button', { name: /Đối chiếu Lab/i }).click();
    await expect(page.getByText('AI Cross-Lab Comparison')).toBeVisible();

    const selects = page.locator('select');
    const select1 = selects.nth(0);
    const select2 = selects.nth(1);

    const optionsCount1 = await select1.locator('option').count();
    const optionsCount2 = await select2.locator('option').count();

    // Nếu có ít nhất 2 phiếu thực tế trong hệ thống, thực hiện chọn và đối chiếu
    if (optionsCount1 > 2 && optionsCount2 > 2) {
      await select1.selectOption({ index: 1 });
      await select2.selectOption({ index: 2 });

      await page.getByRole('button', { name: /Tiến hành Đối chiếu/i }).click();

      // Kiểm tra các chỉ số kết quả xuất hiện
      await expect(page.getByText(/Tỷ lệ Đồng thuận/i)).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/Độ lệch Trung bình/i)).toBeVisible();
    } else {
      // Nếu chưa chọn đủ 2 phiếu, click đối chiếu phải hiện cảnh báo
      await page.getByRole('button', { name: /Tiến hành Đối chiếu/i }).click();
      await expect(page.getByText(/Vui lòng chọn 2 phiếu/i)).toBeVisible({ timeout: 5000 });
    }
  });
});
