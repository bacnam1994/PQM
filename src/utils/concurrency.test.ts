import { describe, it, expect } from 'vitest';
import { validateOptimisticLock, nextVersion, ConcurrencyConflictError } from './concurrency';

describe('Optimistic Concurrency Control (OCC)', () => {
  describe('validateOptimisticLock', () => {
    it('should allow save when versions match', () => {
      expect(() => validateOptimisticLock(1, 1, 'Lô sản xuất')).not.toThrow();
      expect(() => validateOptimisticLock(5, 5, 'Lô sản xuất')).not.toThrow();
    });

    it('should allow save when incoming version is newer', () => {
      expect(() => validateOptimisticLock(1, 2, 'Lô sản xuất')).not.toThrow();
    });

    it('should allow save when either version is undefined/null (backward compatibility)', () => {
      expect(() => validateOptimisticLock(undefined, 1, 'Lô sản xuất')).not.toThrow();
      expect(() => validateOptimisticLock(2, undefined, 'Lô sản xuất')).not.toThrow();
      expect(() => validateOptimisticLock(undefined, undefined, 'Lô sản xuất')).not.toThrow();
    });

    it('should throw ConcurrencyConflictError when incoming version is older than current', () => {
      expect(() => validateOptimisticLock(2, 1, 'Lô sản xuất')).toThrow(ConcurrencyConflictError);
      expect(() => validateOptimisticLock(5, 3, 'Lô sản xuất')).toThrow(/đã được cập nhật bởi một phiên làm việc khác/);
    });
  });

  describe('nextVersion', () => {
    it('should return 2 for undefined or 0 version', () => {
      expect(nextVersion(undefined)).toBe(2);
      expect(nextVersion(0)).toBe(2);
    });

    it('should increment version by 1', () => {
      expect(nextVersion(1)).toBe(2);
      expect(nextVersion(5)).toBe(6);
    });
  });
});
