import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormDraft } from './useFormDraft';
import { declineConsent, acceptConsent } from './useCookieConsent';

describe('useFormDraft Consent & Hardening', () => {
  beforeEach(() => {
    document.cookie = 'pqm_cookie_consent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should write draft to localStorage when consent is ACCEPTED', () => {
    acceptConsent();
    const setFormValues = vi.fn();

    renderHook(() =>
      useFormDraft({
        key: 'draft_key',
        formValues: { val: 'hello' },
        setFormValues,
      })
    );

    // Fast-forward time for the 500ms debounce
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const stored = localStorage.getItem('draft_key');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual({ val: 'hello' });
  });

  it('should NOT write draft to localStorage when consent is DECLINED', () => {
    declineConsent();
    const setFormValues = vi.fn();

    renderHook(() =>
      useFormDraft({
        key: 'draft_key',
        formValues: { val: 'hello' },
        setFormValues,
      })
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const stored = localStorage.getItem('draft_key');
    expect(stored).toBeNull();
  });

  it('does not restore when shouldRestoreDraft returns false', () => {
    acceptConsent();
    localStorage.setItem('test-key', JSON.stringify({ labName: 'OLD DRAFT' }));

    const setFormValues = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm');

    const { result } = renderHook(() =>
      useFormDraft({
        key: 'test-key',
        formValues: { labName: '' },
        setFormValues,
        shouldRestoreDraft: () => false,
      })
    );

    let restored = false;
    act(() => {
      restored = result.current.checkDraft();
    });

    expect(restored).toBe(false);
    expect(setFormValues).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('detects draft and restores via restoreDraft without window.confirm', () => {
    acceptConsent();
    localStorage.setItem('test-key', JSON.stringify({ labName: 'RESTORE ME' }));

    const setFormValues = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm');

    const { result } = renderHook(() =>
      useFormDraft({
        key: 'test-key',
        formValues: { labName: '' },
        setFormValues,
        shouldRestoreDraft: () => true,
      })
    );

    expect(result.current.hasDraft).toBe(true);
    expect(result.current.draftData).toEqual({ labName: 'RESTORE ME' });

    let restored = false;
    act(() => {
      restored = result.current.restoreDraft();
    });

    expect(restored).toBe(true);
    expect(setFormValues).toHaveBeenCalledWith({ labName: 'RESTORE ME' });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(result.current.hasDraft).toBe(false);
  });

  it('allows auto-restoring draft directly when checkDraft(true) is invoked', () => {
    acceptConsent();
    localStorage.setItem('test-key-auto', JSON.stringify({ labName: 'AUTO RESTORE' }));

    const setFormValues = vi.fn();
    const { result } = renderHook(() =>
      useFormDraft({
        key: 'test-key-auto',
        formValues: { labName: '' },
        setFormValues,
        autoDetect: false,
      })
    );

    let restored = false;
    act(() => {
      restored = result.current.checkDraft(true);
    });

    expect(restored).toBe(true);
    expect(setFormValues).toHaveBeenCalledWith({ labName: 'AUTO RESTORE' });
  });

  it('rejects and cleans up array JSON as form draft', () => {
    acceptConsent();
    localStorage.setItem('array-key', JSON.stringify(['item1', 'item2']));

    const setFormValues = vi.fn();
    const { result } = renderHook(() =>
      useFormDraft({
        key: 'array-key',
        formValues: { labName: '' },
        setFormValues,
      })
    );

    let restored = false;
    act(() => {
      restored = result.current.checkDraft();
    });

    expect(restored).toBe(false);
    expect(setFormValues).not.toHaveBeenCalled();
    expect(localStorage.getItem('array-key')).toBeNull();
  });

  it('cleans up malformed JSON safely without throwing', () => {
    acceptConsent();
    localStorage.setItem('corrupted-key', '{ invalid json ...');

    const setFormValues = vi.fn();
    const { result } = renderHook(() =>
      useFormDraft({
        key: 'corrupted-key',
        formValues: { labName: '' },
        setFormValues,
      })
    );

    let restored = false;
    act(() => {
      restored = result.current.checkDraft();
    });

    expect(restored).toBe(false);
    expect(localStorage.getItem('corrupted-key')).toBeNull();
  });

  it('handles localStorage.setItem failure gracefully without throwing', () => {
    acceptConsent();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const setFormValues = vi.fn();
    renderHook(() =>
      useFormDraft({
        key: 'fail-write-key',
        formValues: { labName: 'New Val' },
        setFormValues,
      })
    );

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(500);
      });
    }).not.toThrow();

    expect(warnSpy).toHaveBeenCalled();
  });

  it('handles localStorage.getItem failure gracefully without throwing', () => {
    acceptConsent();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const setFormValues = vi.fn();
    const { result } = renderHook(() =>
      useFormDraft({
        key: 'fail-read-key',
        formValues: { labName: '' },
        setFormValues,
      })
    );

    let restored = true;
    expect(() => {
      act(() => {
        restored = result.current.checkDraft();
      });
    }).not.toThrow();

    expect(restored).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });
});
