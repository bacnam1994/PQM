/**
 * src/utils/backendApiUrl.ts
 * Shared helper to resolve External Backend Authority URL across frontend services
 */

export function getBackendApiUrl(): string {
  const isProd =
    (typeof import.meta !== 'undefined' && import.meta.env?.PROD) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');

  const envUrl =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BACKEND_API_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_BACKEND_API_URL);

  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim();
  }

  if (isProd) {
    throw new Error(
      'CẤU HÌNH BẢO MẬT BẮT BUỘC: Thiếu biến môi trường VITE_BACKEND_API_URL trong môi trường Production. Tuyệt đối không fallback localhost!'
    );
  }

  return 'http://localhost:4000';
}
