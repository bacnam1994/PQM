import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormDraft } from './useFormDraft';
import { declineConsent, acceptConsent } from './useCookieConsent';

describe('useFormDraft Consent', () => {
  beforeEach(() => {
    document.cookie = 'pqm_cookie_consent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
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
});
