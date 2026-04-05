import { test, expect } from '@playwright/test';

// Chạy trước mỗi bài test: Đăng nhập vào hệ thống
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  
  // Giả định bạn có form đăng nhập. Hãy thay đổi selector cho khớp với UI thực tế
  const emailInput = page.getByPlaceholder('Nhập email');
  if (await emailInput.isVisible()) {
    await emailInput.fill('admin@example.com');
    await page.getByPlaceholder('Nhập mật khẩu').fill('password123');
    await page.getByRole('button', { name: /Đăng nhập/i }).click();
    
    // Đợi đến khi load xong Dashboard
    await expect(page.getByText('QA Manager')).toBeVisible({ timeout: 10000 });
  }
});

test.describe('Test Result Form Automation', () => {
  test('Nên cho phép tạo mới và lưu phiếu kết quả kiểm nghiệm thành công', async ({ page }) => {
    // 1. Điều hướng đến trang Kết quả Lab
    await page.goto('/test-results'); 
    
    // 2. Click nút mở form thêm mới
    await page.getByRole('button', { name: 'NHẬP KẾT QUẢ MỚI' }).click();
    
    // Đợi Modal xuất hiện
    await expect(page.getByText('Nhập Kết quả Mới')).toBeVisible();

    // 3. Tìm và chọn lô hàng (Autocomplete dropdown)
    const batchSearchInput = page.getByPlaceholder('Tìm kiếm Lô hàng (Số lô hoặc Tên SP)...');
    await batchSearchInput.click();
    await batchSearchInput.fill('DEMO');
    
    // Click vào item đầu tiên trong dropdown
    await page.locator('.absolute.z-20.w-full.mt-2.bg-white > div').first().click();

    // 4. Nhập thông tin Lab
    await page.getByLabel('Tên đơn vị kiểm nghiệm *').fill('Phòng QC (Nội bộ)');

    // 5. Điền kết quả cho một chỉ tiêu bất kỳ
    const doAmInput = page.getByPlaceholder('Nhập kết quả...').first();
    if (await doAmInput.isVisible()) {
      await doAmInput.fill('4.5');
    }

    // 6. Submit form
    await page.getByRole('button', { name: 'Lưu kết quả' }).click();

    // 7. Assert (Xác nhận kết quả)
    await expect(page.getByText('Đã lưu kết quả kiểm nghiệm.')).toBeVisible({ timeout: 10000 });
  });
});