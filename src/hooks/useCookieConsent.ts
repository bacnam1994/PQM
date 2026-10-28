/**
 * useCookieConsent
 * Quản lý trạng thái đồng ý cookie của người dùng.
 * Sử dụng document.cookie thật (không phải localStorage) để lưu consent.
 */

const CONSENT_COOKIE_NAME = 'pqm_cookie_consent';
const CONSENT_COOKIE_DAYS = 365;

export type ConsentStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  try {
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  } catch (e) {
    console.warn('Failed to set cookie, using localStorage instead:', e);
  }
  // Đồng bộ lưu thêm vào localStorage làm phương án dự phòng
  try {
    localStorage.setItem(name, value);
  } catch (e) {
    // Bỏ qua lỗi nếu chế độ ẩn danh chặn cả localStorage
  }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  // 1. Thử lấy từ cookie trước
  try {
    const match = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${name}=`));
    if (match) return decodeURIComponent(match.split('=')[1]);
  } catch (e) {
    // Bỏ qua lỗi đọc cookie
  }
  
  // 2. Dự phòng: Thử lấy từ localStorage nếu cookie bị chặn
  try {
    return localStorage.getItem(name);
  } catch (e) {
    return null;
  }
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  } catch (e) {
    // Bỏ qua lỗi xóa cookie
  }
  try {
    localStorage.removeItem(name);
  } catch (e) {
    // Bỏ qua lỗi xóa localStorage
  }
}

export function getConsentStatus(): ConsentStatus {
  const value = getCookie(CONSENT_COOKIE_NAME);
  if (value === 'ACCEPTED') return 'ACCEPTED';
  if (value === 'DECLINED') return 'DECLINED';
  return 'PENDING';
}

export function acceptConsent(): void {
  setCookie(CONSENT_COOKIE_NAME, 'ACCEPTED', CONSENT_COOKIE_DAYS);
}

export function declineConsent(): void {
  setCookie(CONSENT_COOKIE_NAME, 'DECLINED', CONSENT_COOKIE_DAYS);
  // Xóa toàn bộ localStorage preferences khi từ chối
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('PQM_UI')) {
      localStorage.removeItem(key);
    }
  });
}

export function resetConsent(): void {
  deleteCookie(CONSENT_COOKIE_NAME);
}
