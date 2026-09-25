import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowActions } from './useWorkflowActions';
import { useAppStore } from '../store/useAppStore';

describe('useWorkflowActions Hook', () => {
  beforeEach(() => {
    useAppStore.setState({
      user: {
        uid: 'usr_qa',
        email: 'qa@vbiotech.vn',
        role: 'QA',
        name: 'QA Officer',
      } as any,
    });
  });

  it('truy vấn danh sách allowedActions cho vai trò QA trên entity BATCH', () => {
    const { result } = renderHook(() => useWorkflowActions('BATCH', 'batch_001'));

    expect(result.current.allowedActions.length).toBeGreaterThan(0);
    const actionIds = result.current.allowedActions.map((a) => a.actionId);

    // QA có quyền BATCH_RELEASE_APPROVE và BATCH_REJECT
    expect(actionIds).toContain('BATCH_RELEASE_APPROVE');
    expect(actionIds).toContain('BATCH_REJECT');
    // QA không có quyền BATCH_DELETE (chỉ ADMIN)
    expect(actionIds).not.toContain('BATCH_DELETE');
  });

  it('hàm canExecute trả về true/false chính xác theo thẩm quyền', () => {
    const { result } = renderHook(() => useWorkflowActions('BATCH', 'batch_001'));

    expect(result.current.canExecute('BATCH_RELEASE_APPROVE')).toBe(true);
    expect(result.current.canExecute('BATCH_DELETE')).toBe(false);
  });

  it('lấy metadata của action thông qua getActionMetadata', () => {
    const { result } = renderHook(() => useWorkflowActions('BATCH'));
    const meta = result.current.getActionMetadata('BATCH_RELEASE_APPROVE');

    expect(meta).toBeDefined();
    expect(meta?.risk).toBe('HIGH');
    expect(meta?.requiresAudit).toBe(true);
    expect(meta?.requiresSignature).toBe(true);
  });

  it('điều phối dispatchAction thành công và trả về correlationId cùng executionId', async () => {
    const { result } = renderHook(() => useWorkflowActions('BATCH', 'batch_001'));

    let execResult: any;
    await act(async () => {
      execResult = await result.current.dispatchAction('BATCH_UPDATE_METADATA', {
        payload: { batchNo: 'B260901', version: 1 },
        reason: 'Cập nhật số lô sản xuất',
        mutationHandler: async () => ({ updated: true }),
      });
    });

    expect(execResult).toBeDefined();
    expect(execResult.success).toBe(true);
    expect(execResult.actionId).toBe('BATCH_UPDATE_METADATA');
    expect(execResult.executionId).toBeDefined();
    expect(result.current.lastResult).toEqual(execResult);
  });

  it('chặn thực thi action không được phép và trả về failureCode UNAUTHORIZED_ROLE', async () => {
    const { result } = renderHook(() => useWorkflowActions('BATCH', 'batch_001'));

    let execResult: any;
    await act(async () => {
      execResult = await result.current.dispatchAction('BATCH_DELETE', {
        confirmationToken: 'CONFIRM-DELETE-BATCH',
        reason: 'Xóa lô thử nghiệm',
      });
    });

    expect(execResult.success).toBe(false);
    expect(execResult.failureCode).toBe('UNAUTHORIZED_ROLE');
    expect(result.current.error).toContain('không được phép thực hiện');
  });
});
