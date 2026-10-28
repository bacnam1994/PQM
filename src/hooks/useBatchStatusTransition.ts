import { useState, useCallback } from 'react';

export const useBatchStatusTransition = (
  updateBatchStatus: (id: string, status: string, reason?: string) => Promise<void>,
  notify: (notification: any) => void
) => {
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{status: string, batchId: string} | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleUpdateBatchStatus = useCallback((newStatus: string, batchId?: string, currentFormBatchId?: string) => {
    const id = batchId || currentFormBatchId;
    if (!id) return notify({ type: 'WARNING', message: 'Vui lòng chọn Lô hàng!' });
    
    setRejectReason(''); // Reset lý do cũ
    setPendingStatusUpdate({ status: newStatus, batchId: id });
    setIsStatusConfirmOpen(true);
  }, [notify]);

  const confirmBatchStatusUpdate = useCallback(async () => {
    if (!pendingStatusUpdate) return;
    try {
      await updateBatchStatus(pendingStatusUpdate.batchId, pendingStatusUpdate.status, rejectReason);
      notify({ type: 'SUCCESS', title: 'Cập nhật trạng thái', message: `Đã chuyển trạng thái lô sang: ${pendingStatusUpdate.status}` });
    } catch (error) {
      console.error("Lỗi cập nhật trạng thái:", error);
      notify({ type: 'ERROR', message: 'Không thể cập nhật trạng thái lô.' });
    } finally {
      setIsStatusConfirmOpen(false);
      setPendingStatusUpdate(null);
      setRejectReason('');
    }
  }, [pendingStatusUpdate, rejectReason, updateBatchStatus, notify]);

  return {
    isStatusConfirmOpen, setIsStatusConfirmOpen, pendingStatusUpdate, rejectReason, setRejectReason, handleUpdateBatchStatus, confirmBatchStatusUpdate
  };
};