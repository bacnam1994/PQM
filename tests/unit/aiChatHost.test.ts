import { describe, it, expect, beforeEach } from 'vitest';
import { useAIChatHostStore } from '../../src/store/useAIChatHostStore';

describe('Phase 2 — AI Chat Session Host & Lifecycle Tests', () => {
  beforeEach(() => {
    useAIChatHostStore.setState({
      isOpen: false,
      hasLoaded: false,
      pendingPrompt: null,
      activeSessionId: 'session_init',
      isProcessing: false,
    });
  });

  it('P2-AC1: Khi Sidebar gọi AI lúc component chưa load -> load/mount AI và giữ pending prompt', () => {
    const store = useAIChatHostStore.getState();
    expect(store.hasLoaded).toBe(false);
    expect(store.isOpen).toBe(false);
    expect(store.pendingPrompt).toBeNull();

    // Sidebar gọi mở AI kèm prompt
    store.openChat('Kiểm tra chất lượng lô 362605');

    const updated = useAIChatHostStore.getState();
    expect(updated.hasLoaded).toBe(true);
    expect(updated.isOpen).toBe(true);
    expect(updated.pendingPrompt).toBe('Kiểm tra chất lượng lô 362605');

    // Sau khi component mount xong và tiêu thụ prompt
    const consumed = updated.consumePendingPrompt();
    expect(consumed).toBe('Kiểm tra chất lượng lô 362605');
    expect(useAIChatHostStore.getState().pendingPrompt).toBeNull();
  });

  it('P2-AC2: Khi AI đã load -> mở ngay và cập nhật prompt nếu có', () => {
    useAIChatHostStore.setState({ hasLoaded: true, isOpen: false });

    useAIChatHostStore.getState().openChat('Phân tích xu hướng Cpk');

    const state = useAIChatHostStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.pendingPrompt).toBe('Phân tích xu hướng Cpk');
  });

  it('P2-AC3: Cầu nối window.dispatchEvent("trigger-ai-chat") không làm rơi prompt', () => {
    window.dispatchEvent(
      new CustomEvent('trigger-ai-chat', {
        detail: { prompt: 'Tóm tắt cảnh báo chất lượng mới nhất' },
      })
    );

    const state = useAIChatHostStore.getState();
    expect(state.hasLoaded).toBe(true);
    expect(state.isOpen).toBe(true);
    expect(state.pendingPrompt).toBe('Tóm tắt cảnh báo chất lượng mới nhất');
  });

  it('P2-AC4: Reset session tạo ID mới để chặn stale request update UI', () => {
    const initialSessionId = useAIChatHostStore.getState().activeSessionId;
    useAIChatHostStore.getState().setIsProcessing(true);

    useAIChatHostStore.getState().resetSession();

    const nextState = useAIChatHostStore.getState();
    expect(nextState.activeSessionId).not.toBe(initialSessionId);
    expect(nextState.isProcessing).toBe(false);
    expect(nextState.pendingPrompt).toBeNull();
  });

  it('P2-AC5: Đóng chat giữ nguyên hasLoaded và activeSessionId qua navigation', () => {
    useAIChatHostStore.setState({ hasLoaded: true, isOpen: true, activeSessionId: 'session_keep' });

    useAIChatHostStore.getState().closeChat();

    const state = useAIChatHostStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.hasLoaded).toBe(true); // Chunk đã nạp không bị hủy
    expect(state.activeSessionId).toBe('session_keep'); // Session được bảo toàn
  });
});
