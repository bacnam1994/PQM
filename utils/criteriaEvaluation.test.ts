import { describe, it, expect, beforeEach, vi } from 'vitest';
import { normalizeNumericString, checkRange, evaluateCriterionSmart } from './criteriaEvaluation';

describe('criteriaEvaluation Utils', () => {
  beforeEach(() => {
    // Reset các mock trước mỗi test để đảm bảo tính độc lập
    vi.clearAllMocks(); // Hoặc jest.clearAllMocks();
  });

  describe('normalizeNumericString', () => {
    it('should handle basic numbers', () => {
      expect(normalizeNumericString('123')).toBe('123');
      expect(normalizeNumericString('123.45')).toBe('123.45');
    });

    it('should handle comma as decimal separator if configured', () => {
      // Sử dụng spyOn để mock localStorage một cách an toàn
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
      getItemSpy.mockReturnValue('"comma"');

      // 1.234,56 -> 1234.56
      expect(normalizeNumericString('1.234,56')).toBe('1234.56');
      // 123,45 -> 123.45
      expect(normalizeNumericString('123,45')).toBe('123.45');
    });

    it('should handle dot as decimal separator (default)', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
      getItemSpy.mockReturnValue('"dot"');

      // 1,234.56 -> 1234.56
      expect(normalizeNumericString('1,234.56')).toBe('1234.56');
    });

    it('should handle superscripts (số mũ ký tự đặc biệt)', () => {
      expect(normalizeNumericString('10³')).toBe('1000');
      expect(normalizeNumericString('10²')).toBe('100');
      expect(normalizeNumericString('5x10²')).toBe('500');
    });

    it('should handle scientific notation with x10^', () => {
      expect(normalizeNumericString('1.5x10^5')).toBe('150000');
      expect(normalizeNumericString('2 x 10^3')).toBe('2000');
      expect(normalizeNumericString('1.5 x 10^-2')).toBe('0.015');
    });

    it('should handle scientific notation without leading number (10^x)', () => {
      expect(normalizeNumericString('10^3')).toBe('1000');
      expect(normalizeNumericString('10^5')).toBe('100000');
      expect(normalizeNumericString('10^-2')).toBe('0.01');
      // Test case đảm bảo không bị lỗi tham chiếu $11 (prefix + 10^x)
      expect(normalizeNumericString(' 10^3')).toBe(' 1000');
    });
    
    it('should handle scientific notation with space instead of ^', () => {
       // Trường hợp người dùng nhập "10 3" thay vì "10^3"
       expect(normalizeNumericString('10 3')).toBe('1000');
       expect(normalizeNumericString('10 -2')).toBe('0.01');
    });

    it('should default to dot separator when localStorage is unavailable', () => {
      // Mock localStorage to throw an error on access
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage is disabled');
      });
      expect(normalizeNumericString('1,234.56')).toBe('1234.56');
    });
  });

  describe('checkRange', () => {
    it('should handle min - max range', () => {
      expect(checkRange('10 - 20', '15')).toBe(true);
      expect(checkRange('10 - 20', '9')).toBe(false);
      expect(checkRange('10 - 20', '21')).toBe(false);
    });

    it('should handle comparison operators', () => {
      expect(checkRange('<= 10', '10')).toBe(true);
      expect(checkRange('<= 10', '11')).toBe(false);
      expect(checkRange('>= 10', '9')).toBe(false);
      expect(checkRange('< 10', '9.99')).toBe(true);
      expect(checkRange('> 10', '10.01')).toBe(true);
    });

    it('should handle single number as Max limit (default behavior)', () => {
      expect(checkRange('10', '5')).toBe(true);
      expect(checkRange('10', '10')).toBe(true);
      expect(checkRange('10', '11')).toBe(false);
    });

    it('should handle plus-minus range with percentage', () => {
      // 2 ± 20% -> [1.6, 2.4]
      expect(checkRange('2 ± 20%', '2.2')).toBe(true);
      expect(checkRange('2 ± 20%', '1.5')).toBe(false);
      expect(checkRange('2 ± 20%', '2.5')).toBe(false);
      expect(checkRange('10 +/- 10%', '9')).toBe(true);
      expect(checkRange('10 +/- 10%', '11')).toBe(true);
    });

    it('should handle plus-minus range absolute', () => {
      expect(checkRange('10 ± 2', '8')).toBe(true);
      expect(checkRange('10 ± 2', '12')).toBe(true);
      expect(checkRange('10 ± 2', '7.9')).toBe(false);
    });
  });
});