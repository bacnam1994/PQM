import { describe, it, expect } from 'vitest';
import { getAppUrl } from './urlUtils';

describe('urlUtils', () => {
  it('should format URL with leading slash', () => {
    const url = getAppUrl('/test-results/print/123456');
    expect(url).toContain('/test-results/print/123456');
  });

  it('should handle path without leading slash', () => {
    const url = getAppUrl('test-results/coa/batch-01');
    expect(url).toContain('/test-results/coa/batch-01');
  });
});
