import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useUIStore } from './useUIStore';
import { declineConsent } from '../hooks/useCookieConsent';

describe('useUIStore Persist Consent', () => {
  beforeEach(() => {
    // Reset cookie and localStorage before each test
    document.cookie = 'pqm_cookie_consent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    localStorage.clear();
    useUIStore.getState().resetPreferences();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should write preferences to localStorage when consent is PENDING (default)', () => {
    // Verify consent status is PENDING
    expect(document.cookie).not.toContain('pqm_cookie_consent');

    // Change a setting
    useUIStore.getState().setDecimalSeparator('comma');

    // Verify localStorage has the setting
    const stored = localStorage.getItem('PQM_UI_Preferences');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).state.decimalSeparator).toBe('comma');
  });

  it('should write preferences to localStorage when consent is ACCEPTED', () => {
    // Set consent cookie
    document.cookie = 'pqm_cookie_consent=ACCEPTED; path=/;';

    // Change setting
    useUIStore.getState().setDecimalSeparator('comma');

    // Verify localStorage
    const stored = localStorage.getItem('PQM_UI_Preferences');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).state.decimalSeparator).toBe('comma');
  });

  it('should NOT write preferences to localStorage when consent is DECLINED', () => {
    // Set consent cookie to DECLINED using the hook function
    declineConsent();

    // Verify that declineConsent cleared the store
    expect(localStorage.getItem('PQM_UI_Preferences')).toBeNull();

    // Change setting
    useUIStore.getState().setDecimalSeparator('comma');

    // Verify localStorage remains empty
    const stored = localStorage.getItem('PQM_UI_Preferences');
    expect(stored).toBeNull();

    // Verify it is still updated in memory/state
    expect(useUIStore.getState().decimalSeparator).toBe('comma');
  });
});
