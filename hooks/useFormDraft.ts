import React, { useEffect, useCallback, useMemo } from 'react';

interface UseFormDraftOptions<T> {
  key: string;
  formValues: T;
  setFormValues: React.Dispatch<React.SetStateAction<T>>;
  isEnabled?: boolean;
  onDraftLoaded?: (data: T) => void;
  skipSave?: (values: T) => boolean;
}

export function useFormDraft<T>({
  key,
  formValues,
  setFormValues,
  isEnabled = true,
  onDraftLoaded,
  skipSave
}: UseFormDraftOptions<T>) {
  
  // Tự động lưu nháp sau mỗi 500ms khi form thay đổi
  useEffect(() => {
    if (isEnabled) {
      // Nếu form rỗng (thỏa mãn skipSave) -> Xóa nháp hiện tại và hủy lưu
      if (skipSave && skipSave(formValues)) {
        try { localStorage.removeItem(key); } catch {}
        return;
      }

      const timeout = setTimeout(() => {
        try {
          localStorage.setItem(key, JSON.stringify(formValues));
        } catch (e) {
          console.warn("Không thể lưu bản nháp (localStorage bị chặn hoặc đầy):", e);
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [formValues, isEnabled, key, skipSave]);

  // Hàm kiểm tra và khôi phục bản nháp
  const checkDraft = useCallback(() => {
    let draft = null;
    try {
      draft = localStorage.getItem(key);
    } catch (e) {
      console.warn("Không thể đọc bản nháp:", e);
    }

    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        // Kiểm tra sơ bộ xem object có dữ liệu không
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          // Tự động dọn dẹp nháp rác từ các phiên cũ mà không cần hỏi người dùng
          if (skipSave && skipSave(parsed)) {
            try { localStorage.removeItem(key); } catch {}
            return false;
          }

          if (window.confirm('Hệ thống tìm thấy dữ liệu đang nhập dở từ phiên trước. Bạn có muốn khôi phục không?')) {
            setFormValues(parsed);
            if (onDraftLoaded) {
              onDraftLoaded(parsed);
            }
            return true;
          } else {
            try { localStorage.removeItem(key); } catch {}
          }
        }
      } catch (e) {
        console.error("Lỗi khôi phục bản nháp:", e);
        try { localStorage.removeItem(key); } catch {}
      }
    }
    return false;
  }, [key, setFormValues, onDraftLoaded, skipSave]);

  // Hàm xóa bản nháp (gọi khi lưu thành công)
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {}
  }, [key]);

  return useMemo(() => ({ checkDraft, clearDraft }), [checkDraft, clearDraft]);
}