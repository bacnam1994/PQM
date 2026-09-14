/**
 * useOperationalWorkflow.ts
 * Hook trung tâm điều phối 9 giai đoạn vận hành chuẩn mực PQM:
 * Loading → Draft → AI → Form → Save → Offline → Sync → Error → Retry
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useIsMutating, useIsFetching } from '@tanstack/react-query';
import { goOnline } from 'firebase/database';
import { db } from '../../firebase';
import { queryClient } from '../../lib/queryClient';
import {
  OperationalStage,
  OperationalError,
  normalizeOperationalError,
} from '../../types/operational';

export interface UseOperationalWorkflowOptions {
  initialLoading?: boolean;
  onLoadRetry?: () => void | Promise<void>;
  onSave?: () => void | Promise<void>;
}

export function useOperationalWorkflow(options: UseOperationalWorkflowOptions = {}) {
  const { initialLoading = false, onLoadRetry, onSave } = options;

  // 1. Loading State
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [loadingError, setLoadingError] = useState<OperationalError | null>(null);

  // 2. Draft State
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);

  // 3. AI State
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const [aiError, setAiError] = useState<OperationalError | null>(null);

  // 4. Form State
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // 5. Save State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<OperationalError | null>(null);

  // 6. Offline & 7. Sync State
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const isMutating = useIsMutating();
  const isFetching = useIsFetching();

  // 8. General Error & 9. Retry Action
  const [error, setErrorState] = useState<OperationalError | null>(null);
  const lastFailedActionRef = useRef<(() => void | Promise<void>) | null>(null);

  // Lắng nghe sự kiện online / offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      try {
        queryClient.resumePausedMutations();
      } catch {}
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cảnh báo người dùng khi thoát khỏi trang nếu form có thay đổi chưa lưu
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !isSaving) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isSaving]);

  // Đăng ký trường được AI điền tự động
  const markAiFilled = useCallback((fieldName: string) => {
    setAiFilledFields((prev) => new Set(prev).add(fieldName));
  }, []);

  const clearAiFilled = useCallback(() => {
    setAiFilledFields(new Set());
  }, []);

  // Thiết lập lỗi tập trung
  const setError = useCallback(
    (err: unknown, stage: OperationalStage = 'SAVE', retryFn?: () => void | Promise<void>) => {
      if (!err) {
        setErrorState(null);
        return;
      }
      const normalized = normalizeOperationalError(err, stage, retryFn);
      setErrorState(normalized);
      if (retryFn) {
        lastFailedActionRef.current = retryFn;
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setErrorState(null);
    setSaveError(null);
    setLoadingError(null);
    setAiError(null);
  }, []);

  // Thực thi hành động Save với đầy đủ lớp bọc lỗi, chống double-click và hỗ trợ Retry
  const executeSave = useCallback(async <T>(saveFn: () => Promise<T>): Promise<T | null> => {
    setIsSaving(true);
    setSaveError(null);
    setErrorState(null);
    setSaveSuccess(false);

    lastFailedActionRef.current = async () => {
      await executeSave(saveFn);
    };

    try {
      const result = await saveFn();
      setSaveSuccess(true);
      setIsDirty(false);
      lastFailedActionRef.current = null;
      return result;
    } catch (err) {
      const normalized = normalizeOperationalError(err, 'SAVE', async () => {
        await executeSave(saveFn);
      });
      setSaveError(normalized);
      setErrorState(normalized);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Kích hoạt Retry cho hành động bị lỗi gần nhất
  const retryLastAction = useCallback(async () => {
    if (lastFailedActionRef.current) {
      clearError();
      await lastFailedActionRef.current();
    } else if (onSave) {
      clearError();
      await onSave();
    }
  }, [clearError, onSave]);

  // Kích hoạt đồng bộ tức thì
  const triggerSync = useCallback(() => {
    try {
      goOnline(db);
      queryClient.resumePausedMutations();
    } catch (e) {
      console.warn('[useOperationalWorkflow] Lỗi kích hoạt đồng bộ:', e);
    }
  }, []);

  return {
    // 1. Loading
    isLoading,
    setIsLoading,
    loadingError,
    setLoadingError,
    retryLoading: onLoadRetry,

    // 2. Draft
    hasDraft,
    setHasDraft,
    draftTimestamp,
    setDraftTimestamp,
    isSavingDraft,
    setIsSavingDraft,
    lastDraftSavedAt,
    setLastDraftSavedAt,

    // 3. AI
    isAiProcessing,
    setIsAiProcessing,
    aiFilledFields,
    setAiFilledFields,
    markAiFilled,
    clearAiFilled,
    aiError,
    setAiError,

    // 4. Form
    isDirty,
    setIsDirty,
    validationErrors,
    setValidationErrors,

    // 5. Save
    isSaving,
    setIsSaving,
    saveSuccess,
    saveError,
    setSaveError,
    executeSave,

    // 6. Offline
    isOffline,
    queuedMutationsCount: isMutating,

    // 7. Sync
    isSyncing: isFetching > 0 || isMutating > 0,
    triggerSync,

    // 8. Error
    error: error || saveError || loadingError || aiError,
    setError,
    clearError,

    // 9. Retry
    canRetry: Boolean(lastFailedActionRef.current || onLoadRetry || onSave),
    retry: retryLastAction,
  };
}
