import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  OperationalLoadingState,
  OperationalDraftBanner,
  AutoSaveStatusBadge,
  OperationalErrorBanner,
  OperationalOfflineBanner,
  OperationalAIBadge,
} from './index';

describe('Operational UI Primitives', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('OperationalLoadingState', () => {
    it('renders initial loading state with message', () => {
      render(
        <OperationalLoadingState
          message="Đang tải dữ liệu hồ sơ..."
          subMessage="Vui lòng đợi trong giây lát"
        />
      );

      expect(screen.getByText('Đang tải dữ liệu hồ sơ...')).toBeDefined();
      expect(screen.getByText('Vui lòng đợi trong giây lát')).toBeDefined();
    });

    it('displays timeout state and retry button when loading takes too long', () => {
      const handleRetry = vi.fn();
      render(
        <OperationalLoadingState
          message="Đang nạp dữ liệu..."
          timeoutSeconds={5}
          onRetry={handleRetry}
        />
      );

      // Fast forward past timeout
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByText('Quá trình nạp dữ liệu lâu hơn dự kiến')).toBeDefined();
      const retryBtn = screen.getByText('Thử lại tải dữ liệu');
      expect(retryBtn).toBeDefined();

      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('OperationalDraftBanner & AutoSaveStatusBadge', () => {
    it('renders OperationalDraftBanner when hasDraft is true and triggers actions', () => {
      const handleRestore = vi.fn();
      const handleDiscard = vi.fn();

      render(
        <OperationalDraftBanner
          hasDraft={true}
          draftTimestamp="2026-09-14T08:30:00Z"
          onRestore={handleRestore}
          onDiscard={handleDiscard}
        />
      );

      expect(screen.getByText(/Phát hiện bản nháp tự động lưu/i)).toBeDefined();

      fireEvent.click(screen.getByText('Khôi phục bản nháp'));
      expect(handleRestore).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('Bỏ qua'));
      expect(handleDiscard).toHaveBeenCalledTimes(1);
    });

    it('does not render OperationalDraftBanner when hasDraft is false', () => {
      const { container } = render(
        <OperationalDraftBanner hasDraft={false} onRestore={() => {}} onDiscard={() => {}} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders AutoSaveStatusBadge states correctly', () => {
      const { rerender } = render(<AutoSaveStatusBadge isSaving={true} />);
      expect(screen.getByText('Đang lưu nháp...')).toBeDefined();

      rerender(<AutoSaveStatusBadge isOffline={true} />);
      expect(screen.getByText('Ngoại tuyến: Lưu nháp cục bộ')).toBeDefined();

      rerender(<AutoSaveStatusBadge lastSavedAt="2026-09-14T08:30:00Z" />);
      expect(screen.getByText(/Đã lưu nháp lúc/i)).toBeDefined();
    });
  });

  describe('OperationalOfflineBanner', () => {
    it('renders offline message and queued count when isOffline is true', () => {
      render(<OperationalOfflineBanner isOffline={true} queuedCount={3} />);

      expect(screen.getByText(/Đang làm việc ở chế độ Ngoại tuyến/i)).toBeDefined();
      expect(screen.getByText('3 thay đổi chờ gửi')).toBeDefined();
      expect(screen.getByText('Kiểm tra kết nối')).toBeDefined();
    });

    it('does not render when isOffline is false', () => {
      const { container } = render(<OperationalOfflineBanner isOffline={false} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('OperationalErrorBanner', () => {
    it('renders error message, allows technical details toggle and retry click', () => {
      const handleRetry = vi.fn();
      const handleDismiss = vi.fn();

      render(
        <OperationalErrorBanner
          error={{
            stage: 'SAVE',
            type: 'NETWORK',
            code: 'NETWORK_ERROR',
            message: 'Mất kết nối với máy chủ khi lưu.',
            technicalDetails: 'NetworkError: Failed to fetch at XMLHttpRequest',
            retryable: true,
            timestamp: new Date().toISOString(),
          }}
          onRetry={handleRetry}
          onDismiss={handleDismiss}
        />
      );

      expect(screen.getByText('Mất kết nối với máy chủ khi lưu.')).toBeDefined();

      // Click technical details toggle
      const detailsToggle = screen.getByText('Xem chi tiết kỹ thuật');
      fireEvent.click(detailsToggle);
      expect(screen.getByText(/Failed to fetch at XMLHttpRequest/)).toBeDefined();

      // Click retry
      const retryBtn = screen.getByText('Thử lại');
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);

      // Click dismiss
      const dismissBtn = screen.getByRole('button', { name: 'Đóng thông báo' });
      fireEvent.click(dismissBtn);
      expect(handleDismiss).toHaveBeenCalledTimes(1);
    });

    it('adapts design for permission denied errors', () => {
      render(
        <OperationalErrorBanner
          error={{
            stage: 'SAVE',
            type: 'PERMISSION',
            code: 'PERMISSION_DENIED',
            message: 'Bạn không có quyền thực hiện thao tác này.',
            retryable: false,
            timestamp: new Date().toISOString(),
          }}
        />
      );

      expect(screen.getByText('Quyền truy cập bị từ chối')).toBeDefined();
      expect(screen.getByText('Bạn không có quyền thực hiện thao tác này.')).toBeDefined();
      expect(screen.queryByText('Thử lại')).toBeNull();
    });
  });

  describe('OperationalAIBadge', () => {
    it('renders badge when fieldKey is present in aiFilledFields Set', () => {
      render(<OperationalAIBadge fieldKey="pH" aiFilledFields={new Set(['pH', 'moisture'])} />);

      expect(screen.getByText('AI')).toBeDefined();
    });

    it('renders badge when fieldKey is present in array', () => {
      render(<OperationalAIBadge fieldKey="pH" aiFilledFields={['pH', 'moisture']} />);

      expect(screen.getByText('AI')).toBeDefined();
    });

    it('does not render when fieldKey is missing from aiFilledFields', () => {
      const { container } = render(
        <OperationalAIBadge fieldKey="heavy_metals" aiFilledFields={new Set(['pH', 'moisture'])} />
      );

      expect(container.firstChild).toBeNull();
    });
  });
});
