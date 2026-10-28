import { useEffect } from 'react';

export interface ShortcutOptions {
  onOpenCommandPalette?: () => void;
  onToggleSidebar?: () => void;
  onSave?: () => void;
  onEscape?: () => void;
}

/**
 * Hook quản lý phím tắt toàn cục cho ứng dụng:
 * - Ctrl+K / Cmd+K: Mở Command Palette
 * - Ctrl+B / Cmd+B: Thu gọn / Mở rộng Sidebar
 * - Ctrl+S / Cmd+S: Lưu nhanh form hiện tại
 * - Escape: Đóng modal / popup
 */
export const useKeyboardShortcuts = ({
  onOpenCommandPalette,
  onToggleSidebar,
  onSave,
  onEscape,
}: ShortcutOptions = {}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCommandOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 1. Phím tắt Ctrl+K / Cmd+K (Mở Search / Command Palette)
      if (isCommandOrCtrl && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        e.stopPropagation();
        if (onOpenCommandPalette) {
          onOpenCommandPalette();
        } else {
          window.dispatchEvent(new CustomEvent('pqm:toggle-command-palette'));
        }
        return;
      }

      // 2. Phím tắt Ctrl+B / Cmd+B (Thu gọn / Mở rộng Sidebar chuẩn Animate UI / IDE)
      if (isCommandOrCtrl && (e.key === 'b' || e.key === 'B')) {
        const target = e.target as HTMLElement | null;
        const isEditable =
          target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (!isEditable) {
          e.preventDefault();
          e.stopPropagation();
          if (onToggleSidebar) {
            onToggleSidebar();
          } else {
            window.dispatchEvent(new CustomEvent('pqm:toggle-sidebar'));
          }
          return;
        }
      }

      // 2. Phím tắt Ctrl+S / Cmd+S (Lưu nhanh)
      if (isCommandOrCtrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        if (onSave) {
          onSave();
        } else {
          window.dispatchEvent(new CustomEvent('pqm:save-current-form'));
        }
        return;
      }

      // 3. Phím Escape
      if (e.key === 'Escape') {
        if (onEscape) {
          onEscape();
        } else {
          window.dispatchEvent(new CustomEvent('pqm:close-modals'));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onOpenCommandPalette, onSave, onEscape]);
};
