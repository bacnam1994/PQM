/**
 * useAIChatHostStore.ts
 * PQM AI Assistant Session Host Store (Phase 2)
 * =============================================
 * Quản lý vòng đời và trạng thái tập trung cho AI Assistant Chat:
 * 1. Single Source of Truth cho trạng thái mở (isOpen), tải nạp (hasLoaded) và phiên làm việc (activeSessionId).
 * 2. Lưu đệm Prompt đang chờ (pendingPrompt) khi AI chưa kịp tải chunk nhằm đảm bảo không bao giờ rớt yêu cầu.
 * 3. Bảo vệ session qua các lần điều hướng trang (Navigation-safe).
 * 4. Ngăn chặn stale request ghi đè UI khi session đã thay đổi.
 * 5. Cung cấp cầu nối tương thích ngược (Backward-compatible bridge) cho window event 'trigger-ai-chat'.
 */

import { create } from 'zustand';
import { perfTelemetry } from '../utils/perfTelemetry';

export interface AIChatHostState {
  isOpen: boolean;
  hasLoaded: boolean;
  pendingPrompt: string | null;
  activeSessionId: string;
  isProcessing: boolean;
  openChat: (prompt?: string) => void;
  closeChat: () => void;
  consumePendingPrompt: () => string | null;
  resetSession: () => void;
  setIsProcessing: (isProcessing: boolean) => void;
}

export const useAIChatHostStore = create<AIChatHostState>((set, get) => ({
  isOpen: false,
  hasLoaded: false,
  pendingPrompt: null,
  activeSessionId: `session_${Date.now()}`,
  isProcessing: false,

  openChat: (prompt?: string) => {
    perfTelemetry.record('AI_OPEN', { promptId: prompt ? 'with_prompt' : 'direct' });
    set((state) => ({
      isOpen: true,
      hasLoaded: true,
      pendingPrompt: prompt !== undefined ? prompt : state.pendingPrompt,
    }));
  },

  closeChat: () => {
    set({ isOpen: false });
  },

  consumePendingPrompt: () => {
    const prompt = get().pendingPrompt;
    if (prompt !== null) {
      set({ pendingPrompt: null });
    }
    return prompt;
  },

  resetSession: () => {
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set({
      activeSessionId: newSessionId,
      pendingPrompt: null,
      isProcessing: false,
    });
  },

  setIsProcessing: (isProcessing: boolean) => {
    set({ isProcessing });
  },
}));

// Cầu nối lắng nghe sự kiện toàn cục 'trigger-ai-chat' từ bất kỳ đâu trong ứng dụng
if (typeof window !== 'undefined') {
  window.addEventListener('trigger-ai-chat', (e: Event) => {
    const customEvent = e as CustomEvent;
    const prompt = customEvent.detail?.prompt;
    useAIChatHostStore.getState().openChat(prompt);
  });
}
