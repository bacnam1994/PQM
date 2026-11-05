import { describe, it, expect } from 'vitest';

export const escapeHtml = (unsafe: string): string => {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const sanitizeUrl = (url: string): string => {
  const trimmed = (url || '').trim();
  if (/^(https?:|\/|#)/i.test(trimmed)) {
    return trimmed;
  }
  return '#';
};

export const formatMessageText = (text: string): string => {
  const escaped = escapeHtml(text || '');
  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.*?)\]\((.*?)\)/g, (_match, label, url) => {
      const safeUrl = sanitizeUrl(url);
      return `<a href="${safeUrl}" class="text-emerald-600 dark:text-emerald-400 hover:underline font-bold">${label}</a>`;
    });
};

describe('DOM & Markdown Sanitization Hardening', () => {
  it('thực hiện mã hóa các thẻ HTML độc hại trong nội dung văn bản', () => {
    const maliciousInput = '<script>alert("XSS")</script> và <img src=x onerror=alert(1)>';
    const output = escapeHtml(maliciousInput);
    expect(output).not.toContain('<script>');
    expect(output).toContain('&lt;script&gt;');
    expect(output).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('chặn các giao thức nguy hiểm như javascript: trong Markdown URL', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
    expect(sanitizeUrl('JAVASCRIPT:void(0)')).toBe('#');
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
    expect(sanitizeUrl('https://v-biotech.web.app')).toBe('https://v-biotech.web.app');
    expect(sanitizeUrl('/batches/123')).toBe('/batches/123');
  });

  it('bảo toàn định dạng in đậm và liên kết an toàn trong formatMessageText', () => {
    const input = 'Kết quả **ĐẠT** theo quy chuẩn [TCCS-01](/tccs/1). Chặn <script>xss</script>';
    const formatted = formatMessageText(input);
    expect(formatted).toContain('<strong>ĐẠT</strong>');
    expect(formatted).toContain('<a href="/tccs/1"');
    expect(formatted).not.toContain('<script>');
    expect(formatted).toContain('&lt;script&gt;xss&lt;/script&gt;');
  });
});
