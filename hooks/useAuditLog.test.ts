import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuditLog } from './useAuditLog';
import { useAuth } from '../context/AuthContext';
import { logAuditAction } from '../services/auditService';

// Mock dependencies
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/auditService', () => ({
  logAuditAction: vi.fn(),
}));

describe('useAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log action with user email when user is logged in', async () => {
    (useAuth as any).mockReturnValue({ user: { email: 'test@example.com' } });
    (logAuditAction as any).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuditLog());

    await act(async () => {
      await result.current.log({
        action: 'CREATE',
        collection: 'PRODUCTS',
        documentId: '123',
        details: 'Created product',
      });
    });

    expect(logAuditAction).toHaveBeenCalledWith({
      action: 'CREATE',
      collection: 'PRODUCTS',
      documentId: '123',
      details: 'Created product',
      performedBy: 'test@example.com',
    });
  });

  it('should log action with "unknown_user" when user is not logged in', async () => {
    (useAuth as any).mockReturnValue({ user: null });
    (logAuditAction as any).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuditLog());

    await act(async () => {
      await result.current.log({
        action: 'DELETE',
        collection: 'BATCHES',
        details: 'Deleted batch',
      });
    });

    expect(logAuditAction).toHaveBeenCalledWith({
      action: 'DELETE',
      collection: 'BATCHES',
      details: 'Deleted batch',
      performedBy: 'unknown_user',
    });
  });

  it('should handle errors gracefully', async () => {
    (useAuth as any).mockReturnValue({ user: { email: 'test@example.com' } });
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error('Network error');
    (logAuditAction as any).mockRejectedValue(error);

    const { result } = renderHook(() => useAuditLog());

    await act(async () => {
      await result.current.log({ action: 'UPDATE', collection: 'TCCS', details: 'Updated TCCS' });
    });

    expect(logAuditAction).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith("Lỗi ghi nhật ký hệ thống:", error);
    
    consoleSpy.mockRestore();
  });
});