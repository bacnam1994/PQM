import { describe, it, expect } from 'vitest';
import { validateCasNumber, CAS_REGEX } from './useMaterialListState';

describe('MaterialList Validation & Helpers', () => {
  it('thẩm định chính xác định dạng CAS Number hợp lệ', () => {
    expect(validateCasNumber('90045-36-6')).toBe(true);
    expect(validateCasNumber('50-00-0')).toBe(true);
    expect(validateCasNumber('103-90-2')).toBe(true); // Paracetamol CAS
    expect(validateCasNumber('')).toBe(true); // optional field
    expect(validateCasNumber('   ')).toBe(true);
  });

  it('phát hiện CAS Number không hợp lệ', () => {
    expect(validateCasNumber('12345')).toBe(false);
    expect(validateCasNumber('90045-36')).toBe(false);
    expect(validateCasNumber('abc-de-f')).toBe(false);
    expect(validateCasNumber('90045-36-6-7')).toBe(false);
  });

  it('CAS_REGEX khớp đúng pattern số', () => {
    expect(CAS_REGEX.test('58-08-2')).toBe(true); // Caffeine
    expect(CAS_REGEX.test('invalid')).toBe(false);
  });
});
