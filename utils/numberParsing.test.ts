import { describe, it, expect, beforeEach, vi } from 'vitest';
import { normalizeNumericString, parseNumberFromText, autoFormatInput, parseSpecialValue } from './numberParsing';

describe('numberParsing Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeNumericString', () => {
    it('should return empty string for empty input', () => {
      expect(normalizeNumericString('')).toBe('');
    });

    it('should handle basic numbers', () => {
      expect(normalizeNumericString('123')).toBe('123');
      expect(normalizeNumericString('123.45')).toBe('123.45');
    });

    it('should handle comma as decimal separator if configured', () => {
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

    it('should handle scientific notation', () => {
      expect(normalizeNumericString('1.5x10^5')).toBe('150000');
      expect(normalizeNumericString('2 x 10^3')).toBe('2000');
      expect(normalizeNumericString('1.5 x 10^-2')).toBe('0.015');
      expect(normalizeNumericString('10^3')).toBe('1000');
      expect(normalizeNumericString('10 -2')).toBe('0.01');
      expect(normalizeNumericString('10 3')).toBe('1000'); // Space instead of ^
    });

    it('should default to dot separator when localStorage is unavailable', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage is disabled');
      });
      expect(normalizeNumericString('1,234.56')).toBe('1234.56');
    });
  });

  describe('parseNumberFromText', () => {
    it('should parse valid numbers', () => {
      expect(parseNumberFromText('123.45')).toBe(123.45);
    });

    it('should return 0 for invalid numbers', () => {
      expect(parseNumberFromText('abc')).toBe(0);
      expect(parseNumberFromText('')).toBe(0);
    });

    it('should handle scientific notation', () => {
      expect(parseNumberFromText('1.5x10^2')).toBe(150);
    });
  });

  describe('autoFormatInput', () => {
    it('should replace e/E with ^ if followed by number', () => {
      expect(autoFormatInput('10e3')).toBe('10^3');
      expect(autoFormatInput('1.5E-2')).toBe('1.5^-2');
    });

    it('should replace * with x', () => {
      expect(autoFormatInput('5*10')).toBe('5x10');
    });

    it('should handle empty input', () => {
      expect(autoFormatInput('')).toBe('');
    });
  });

  describe('parseSpecialValue', () => {
    it('should return 0 for null/undefined', () => {
      expect(parseSpecialValue(null)).toBe(0);
      expect(parseSpecialValue(undefined)).toBe(0);
    });

    it('should return 0 for special values', () => {
      expect(parseSpecialValue('KPH')).toBe(0);
      expect(parseSpecialValue('kph')).toBe(0);
      expect(parseSpecialValue('Not Detected')).toBe(0);
      expect(parseSpecialValue('Negative')).toBe(0);
      expect(parseSpecialValue('ND')).toBe(0);
    });

    it('should parse normal numbers', () => {
      expect(parseSpecialValue('123')).toBe(123);
    });
  });
});