import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  writeAIDraft,
  peekAIDraft,
  consumeAIDraft,
  clearAIDraft,
  hasAIDraft,
  normalizeAIData,
} from './aiDraftManager';

describe('aiDraftManager', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes and reads an AI draft', () => {
    const data = {
      labName: 'LAB A',
      testResults: [{ criteriaName: 'pH', value: '6.8' }],
    };

    const id = writeAIDraft(data);

    expect(id).toBeTruthy();
    expect(hasAIDraft()).toBe(true);
    const peeked = peekAIDraft();
    expect(peeked?.id).toBe(id);
    expect(peeked?.source).toBe('global-ai-assistant');
    expect(peeked?.data).toEqual(data);
  });

  it('consumes a draft exactly once', () => {
    writeAIDraft({ labName: 'LAB A' });

    const consumed = consumeAIDraft();

    expect(consumed?.data.labName).toBe('LAB A');
    expect(consumed?.consumedAt).toBeGreaterThan(0);
    expect(hasAIDraft()).toBe(false);
    expect(peekAIDraft()).toBeNull();
    expect(consumeAIDraft()).toBeNull();
  });

  it('clears a draft', () => {
    writeAIDraft({ labName: 'LAB A' });
    expect(hasAIDraft()).toBe(true);

    clearAIDraft();

    expect(hasAIDraft()).toBe(false);
    expect(peekAIDraft()).toBeNull();
  });

  it('rejects malformed storage', () => {
    sessionStorage.setItem(
      'pqm:ai-draft:test-result',
      JSON.stringify({ invalid: true })
    );

    expect(peekAIDraft()).toBeNull();
    expect(hasAIDraft()).toBe(false);
    // Should remove invalid storage item
    expect(sessionStorage.getItem('pqm:ai-draft:test-result')).toBeNull();
  });

  it('expires drafts after TTL of 10 minutes', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    writeAIDraft({ labName: 'LAB A' });
    expect(hasAIDraft()).toBe(true);

    // Advance by 9 minutes: still valid
    vi.setSystemTime(now + 9 * 60 * 1000);
    expect(peekAIDraft()?.data.labName).toBe('LAB A');

    // Advance beyond 10 minutes: expired
    vi.setSystemTime(now + 10 * 60 * 1000 + 1000);
    expect(peekAIDraft()).toBeNull();
    expect(hasAIDraft()).toBe(false);
    expect(consumeAIDraft()).toBeNull();
  });

  describe('normalizeAIData', () => {
    it('returns null for non-object inputs', () => {
      expect(normalizeAIData(null)).toBeNull();
      expect(normalizeAIData(undefined)).toBeNull();
      expect(normalizeAIData('string')).toBeNull();
      expect(normalizeAIData(123)).toBeNull();
    });

    it('normalizes valid AI extraction payload', () => {
      const raw = {
        labName: '   QUATEST 3  ',
        testDate: '12/09/2026',
        batchNo: '  LO-2026-01  ',
        productName: ' GINKGO BILOBA ',
        productCode: ' SP-001 ',
        mfgDate: ' 01/01/2026 ',
        expDate: ' 01/01/2029 ',
        testResults: [
          { criteriaName: ' pH ', value: 6.8, unit: ' pH ', limit: '6.0 - 7.5' },
          { criteriaName: ' Độ ẩm ', value: '4.5', unit: '%', limit: '≤ 9.0%' },
          { criteriaName: '', value: '99' }, // should be filtered out
          null,
        ],
      };

      const normalized = normalizeAIData(raw);
      expect(normalized).not.toBeNull();
      expect(normalized?.labName).toBe('QUATEST 3');
      expect(normalized?.testDate).toBe('12/09/2026');
      expect(normalized?.batchNo).toBe('LO-2026-01');
      expect(normalized?.productName).toBe('GINKGO BILOBA');
      expect(normalized?.productCode).toBe('SP-001');
      expect(normalized?.mfgDate).toBe('01/01/2026');
      expect(normalized?.expDate).toBe('01/01/2029');
      expect(normalized?.testResults).toHaveLength(2);
      expect(normalized?.testResults[0]).toEqual({
        criteriaName: 'pH',
        value: '6.8',
        unit: 'pH',
        limit: '6.0 - 7.5',
      });
      expect(normalized?.testResults[1]).toEqual({
        criteriaName: 'Độ ẩm',
        value: '4.5',
        unit: '%',
        limit: '≤ 9.0%',
      });
    });

    it('handles payload with missing or empty fields safely', () => {
      const normalized = normalizeAIData({});
      expect(normalized).toEqual({
        labName: undefined,
        testDate: undefined,
        batchNo: undefined,
        productName: undefined,
        productCode: undefined,
        mfgDate: undefined,
        expDate: undefined,
        testResults: [],
      });
    });
  });
});
