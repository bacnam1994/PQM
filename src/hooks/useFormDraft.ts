import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { getConsentStatus } from './useCookieConsent';

export interface UseFormDraftOptions<T> {
  key: string;
  formValues: T;
  setFormValues: React.Dispatch<React.SetStateAction<T>>;
  isEnabled?: boolean;
  onDraftLoaded?: (data: T) => void;
  skipSave?: (values: T) => boolean;
  shouldRestoreDraft?: () => boolean;
  autoDetect?: boolean;
}

export function useFormDraft<T>({
  key,
  formValues,
  setFormValues,
  isEnabled = true,
  onDraftLoaded,
  skipSave,
  shouldRestoreDraft = () => true,
  autoDetect = true,
}: UseFormDraftOptions<T>) {
  const metaKey = `${key}_meta`;

  const [hasDraft, setHasDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null);
  const [draftData, setDraftData] = useState<T | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);

  // Kiểm tra tính hợp lệ của bản nháp từ storage
  const readValidDraftFromStorage = useCallback((): { data: T; savedAt: string } | null => {
    if (getConsentStatus() === 'DECLINED') return null;
    if (!shouldRestoreDraft()) return null;

    let raw = null;
    try {
      raw = localStorage.getItem(key);
    } catch (e) {
      console.warn('[useFormDraft] Không thể đọc bản nháp:', e);
      return null;
    }

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        Object.keys(parsed).length > 0
      ) {
        if (skipSave && skipSave(parsed)) {
          try {
            localStorage.removeItem(key);
            localStorage.removeItem(metaKey);
          } catch {}
          return null;
        }

        let savedAt = new Date().toISOString();
        try {
          const metaRaw = localStorage.getItem(metaKey);
          if (metaRaw) {
            const metaParsed = JSON.parse(metaRaw);
            if (metaParsed?.savedAt) savedAt = metaParsed.savedAt;
          }
        } catch {}

        return { data: parsed, savedAt };
      } else {
        try {
          localStorage.removeItem(key);
          localStorage.removeItem(metaKey);
        } catch {}
      }
    } catch (e) {
      console.error('[useFormDraft] Lỗi phân tích cú pháp bản nháp:', e);
      try {
        localStorage.removeItem(key);
        localStorage.removeItem(metaKey);
      } catch {}
    }
    return null;
  }, [key, metaKey, skipSave, shouldRestoreDraft]);

  // Tự động phát hiện bản nháp khi mount
  useEffect(() => {
    if (autoDetect && isEnabled) {
      const stored = readValidDraftFromStorage();
      if (stored) {
        setHasDraft(true);
        setDraftTimestamp(stored.savedAt);
        setDraftData(stored.data);
      } else {
        setHasDraft(false);
        setDraftTimestamp(null);
        setDraftData(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDetect, isEnabled, key]);

  // Tự động lưu nháp sau mỗi 500ms khi form thay đổi
  useEffect(() => {
    if (isEnabled && getConsentStatus() !== 'DECLINED') {
      if (skipSave && skipSave(formValues)) {
        try {
          localStorage.removeItem(key);
          localStorage.removeItem(metaKey);
        } catch {}
        return;
      }

      setIsSavingDraft(true);
      const timeout = setTimeout(() => {
        try {
          const nowIso = new Date().toISOString();
          localStorage.setItem(key, JSON.stringify(formValues));
          localStorage.setItem(metaKey, JSON.stringify({ savedAt: nowIso, version: '1.0' }));
          setLastDraftSavedAt(nowIso);
        } catch (e) {
          console.warn('[useFormDraft] Không thể lưu bản nháp (localStorage bị chặn hoặc đầy):', e);
        } finally {
          setIsSavingDraft(false);
        }
      }, 500);

      return () => {
        clearTimeout(timeout);
      };
    }
  }, [formValues, isEnabled, key, metaKey, skipSave]);

  // Khôi phục bản nháp chủ động (Dành cho DraftBanner declarative UI)
  const restoreDraft = useCallback((): boolean => {
    const target = draftData || readValidDraftFromStorage()?.data;
    if (!target) return false;

    setFormValues(target);
    if (onDraftLoaded) {
      onDraftLoaded(target);
    }
    setHasDraft(false);
    return true;
  }, [draftData, onDraftLoaded, readValidDraftFromStorage, setFormValues]);

  // Bỏ qua và xóa bản nháp chủ động (Dành cho DraftBanner declarative UI)
  const discardDraft = useCallback(() => {
    try {
      localStorage.removeItem(key);
      localStorage.removeItem(metaKey);
    } catch {}
    setHasDraft(false);
    setDraftTimestamp(null);
    setDraftData(null);
  }, [key, metaKey]);

  // Hàm kiểm tra bản nháp (Đã loại bỏ 100% window.confirm gây gián đoạn UX và lỗi headless test)
  const checkDraft = useCallback(
    (autoRestore: boolean = false) => {
      const stored = readValidDraftFromStorage();
      if (!stored) {
        setHasDraft(false);
        setDraftTimestamp(null);
        setDraftData(null);
        return false;
      }

      setHasDraft(true);
      setDraftTimestamp(stored.savedAt);
      setDraftData(stored.data);

      if (autoRestore) {
        setFormValues(stored.data);
        if (onDraftLoaded) {
          onDraftLoaded(stored.data);
        }
        setHasDraft(false);
        return true;
      }
      return true;
    },
    [readValidDraftFromStorage, setFormValues, onDraftLoaded]
  );

  // Hàm xóa bản nháp (gọi khi lưu thành công)
  const clearDraft = useCallback(() => {
    if (getConsentStatus() === 'DECLINED') return;
    try {
      localStorage.removeItem(key);
      localStorage.removeItem(metaKey);
    } catch {}
    setHasDraft(false);
    setDraftTimestamp(null);
    setDraftData(null);
  }, [key, metaKey]);

  return useMemo(
    () => ({
      hasDraft,
      draftTimestamp,
      draftData,
      restoreDraft,
      discardDraft,
      checkDraft,
      clearDraft,
      isSavingDraft,
      lastDraftSavedAt,
    }),
    [
      hasDraft,
      draftTimestamp,
      draftData,
      restoreDraft,
      discardDraft,
      checkDraft,
      clearDraft,
      isSavingDraft,
      lastDraftSavedAt,
    ]
  );
}
