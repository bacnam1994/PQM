import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { logAuditAction } from '../../services/auditService';
import { useCrud } from '../useCrud';
import { TestResult } from '../../types';
import { HydratedTestResult } from '../useDataGraph';

export const useTestResultList = () => {
  const navigate = useNavigate();
  const crud = useCrud<TestResult>();
  const deleteTestResult = useAppStore(state => state.deleteTestResult);
  const notify = useAppStore(state => state.notify);
  const batches = useAppStore(state => state.batches);
  const user = useAppStore(state => state.user);

  const handleEditResult = useCallback((res: HydratedTestResult | TestResult) => {
    navigate(`/test-results/edit/${res.id}`);
  }, [navigate]);

  const handleDeleteClick = useCallback((res: HydratedTestResult) => {
    crud.openDelete(res);
  }, [crud]);

  const handleConfirmDelete = useCallback(async () => {
    if (crud.selectedItem) {
      try {
        await deleteTestResult(crud.selectedItem.id);
        crud.close();
        notify({ type: 'SUCCESS', title: 'Đã xóa', message: 'Đã xóa phiếu kết quả kiểm nghiệm.' });

        try {
          const batch = batches.find(b => b.id === crud.selectedItem!.batchId);
          logAuditAction({
            action: 'DELETE',
            collection: 'TEST_RESULTS',
            documentId: crud.selectedItem.id,
            details: `Xóa kết quả kiểm nghiệm lô: ${batch?.batchNo || crud.selectedItem.batchId}`,
            performedBy: user?.email || 'unknown'
          });
        } catch (logErr) {
          console.warn("Ghi log thất bại:", logErr);
        }
      } catch (error) {
        console.error("Failed to delete test result:", error);
      }
    } else {
      crud.close();
    }
  }, [crud, deleteTestResult, notify, batches, user]);

  const handlePrint = useCallback((res: HydratedTestResult) => {
    // Rút gọn URL chỉ dùng 6 ký tự cuối của ID
    window.open(`/test-results/print/${res.id.slice(-6)}`, '_blank');
  }, []);

  const handleOpenAdd = useCallback(() => {
    navigate('/test-results/new');
  }, [navigate]);

  return {
    crud,
    handleEditResult,
    handleDeleteClick,
    handleConfirmDelete,
    handlePrint,
    handleOpenAdd
  };
};
