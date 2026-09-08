import { Page } from '@playwright/test';

/**
 * Tiện ích chuẩn bị môi trường test Playwright:
 * - Bỏ qua Cookie Consent Banner
 * - Set auth mock admin trong DEV mode
 * - Đăng nhập tài khoản admin mẫu
 */
export async function setupTestPage(page: Page): Promise<void> {
  // 1. Tự động set cookie, consent và mock auth để không bị banner che khuất UI
  await page.addInitScript(() => {
    try {
      document.cookie = 'pqm_cookie_consent=ACCEPTED;path=/;max-age=31536000';
      localStorage.setItem('pqm_cookie_consent', 'ACCEPTED');
      localStorage.setItem('pqm_dev_mock_auth', 'admin@example.com');
    } catch (e) {
      // ignore
    }
  });

  // 2. Điều hướng tới ứng dụng
  await page.goto('/');

  // Đóng cookie banner nếu vẫn hiện
  const acceptCookieBtn = page.getByRole('button', { name: /Chấp nhận tất cả/i });
  if (await acceptCookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await acceptCookieBtn.click().catch(() => {});
  }

  // 3. Nếu đang ở màn hình login thì submit
  const emailInput = page.getByPlaceholder('name@v-biotech.vn');
  if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await emailInput.fill('admin@example.com');
    await page.getByPlaceholder('••••••••').fill('password123');
    await page.getByRole('button', { name: /ĐĂNG NHẬP HỆ THỐNG/i }).click();
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 8000 }).catch(() => {});
  }
}
