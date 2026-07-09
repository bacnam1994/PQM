import { test, expect } from '@playwright/test';

// Chạy trước mỗi bài test: Đăng nhập vào hệ thống
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  
  // Sử dụng đúng các placeholder thực tế trong LoginPage.tsx và đợi hiển thị
  const emailInput = page.getByPlaceholder('name@v-biotech.vn');
  try {
    await emailInput.waitFor({ state: 'visible', timeout: 5000 });
    await emailInput.fill('admin@example.com');
    await page.getByPlaceholder('••••••••').fill('password123');
    await page.getByRole('button', { name: /ĐĂNG NHẬP HỆ THỐNG/i }).click();
    
    // Đợi đến khi đăng nhập thành công (hiển thị email người dùng ở góc trên bên phải)
    await expect(page.getByText('admin@example.com')).toBeVisible({ timeout: 10000 });
  } catch (e) {
    console.log('Login form not visible, assuming already logged in.');
  }
});

test.describe('Test Result Form Automation', () => {
  test('Nên cho phép tạo mới và lưu phiếu kết quả kiểm nghiệm thành công', async ({ page }) => {
    // Chấp nhận cảnh báo chưa hoàn thành phiếu kiểm nghiệm hoặc cảnh báo kết quả không đạt
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    // 1. Điều hướng đến trang Kết quả Lab
    await page.goto('/test-results'); 
    
    // 2. Click nút mở form thêm mới
    await page.getByRole('button', { name: 'NHẬP KẾT QUẢ MỚI' }).click();
    
    // Đợi Modal xuất hiện
    await expect(page.getByText('Nhập Kết quả Mới')).toBeVisible();

    // 3. Tìm và chọn lô hàng (Autocomplete dropdown)
    const batchSearchInput = page.getByPlaceholder('Tìm kiếm Lô hàng (Số lô hoặc Tên SP)...');
    await batchSearchInput.click();
    await batchSearchInput.fill('272501');
    
    // Click vào item đầu tiên trong dropdown
    await page.locator('.absolute.z-20.w-full.mt-2.bg-white > div').first().click();

    // 4. Nhập thông tin Lab
    await page.getByPlaceholder('VD: Phòng QC, CASE...').fill('Phòng QC (Nội bộ)');

    // 5. Điền kết quả cho một chỉ tiêu bất kỳ
    const doAmInput = page.getByPlaceholder('Nhập kết quả...').first();
    if (await doAmInput.isVisible()) {
      await doAmInput.fill('4.5');
    }

    // 6. Submit form
    await page.getByRole('button', { name: 'Lưu Kết quả Mới' }).click();

    // 7. Assert (Xác nhận kết quả)
    await expect(page.getByText('Đã lưu kết quả kiểm nghiệm.')).toBeVisible({ timeout: 10000 });
  });
});