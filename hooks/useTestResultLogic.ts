import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
/**
 * @file useTestResultLogic.ts
 * @description Hook trung tâm xử lý logic nhập liệu và đánh giá kết quả kiểm nghiệm.
 * 
 * @rules
 * 1. Logic chọn TCCS: Ưu tiên TCCS theo ngày SX của Lô (xem docs/SYSTEM_LOGIC.md).
 * 2. Logic đánh giá: Sử dụng evaluateCriterionSmart từ utils/criteriaEvaluation.
 * 3. Logic thay thế: Tự động pass TC2 nếu TC1 đạt (xử lý trong completionStatus và handleSaveResult).
 */
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { TestResult, TestResultEntry } from '../types';
import { logAuditAction } from '../services/auditService';
import { useForm } from './useForm';
import { useCrud } from './useCrud';
import { useFormDraft } from './useFormDraft';
import { useDataGraph, HydratedTestResult } from './useDataGraph';
import { useTestResultPrint } from './useTestResultPrint';
import { useTccsSelection } from './useTccsSelection';
import { useTestResultEvaluation } from './useTestResultEvaluation';
import { useBatchStatusTransition } from './useBatchStatusTransition';
import { ensureArray, evaluateCriterion, calculateOverallStatus, TEST_RESULT_STATUS, BATCH_STATUS, CRITERION_TYPE_CONST, normalizeNumericString, checkRange, evaluateCriterionSmart, parseNumberFromText, generateId } from '../utils';

interface ExtraTestResultEntry extends TestResultEntry {
  limit?: string;
}

// Hàm lấy ngày Local chính xác (Tránh lỗi UTC lùi 1 ngày vào buổi sáng)
const getLocalISODate = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
};

const initialTestResultFormState = {
  batchId: '',
  labName: '',
  testDate: getLocalISODate(),
  notes: '',
  testResultsMap: {} as Record<string, string | number>,
  extraCriteria: [] as {id: string, name: string, value: string, unit: string, limit: string}[],
};

export const useTestResultLogic = (onInitialBatchSelect?: (batchNo: string) => void) => {
  const tccsList = useAppStore(state => state.tccsList);
  const batches = useAppStore(state => state.batches);
  const updateBatchStatus = useAppStore(state => state.updateBatchStatus);
  const notify = useAppStore(state => state.notify);
  const testResults = useAppStore(state => state.testResults);
  const addTestResult = useAppStore(state => state.addTestResult);
  const updateTestResult = useAppStore(state => state.updateTestResult);
  const deleteTestResult = useAppStore(state => state.deleteTestResult);
  const user = useAppStore(state => state.user);
  const { batches: hydratedBatches } = useDataGraph();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const crud = useCrud<TestResult>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');
  const [showBatchDropdown, setShowBatchDropdown] = useState(false);
  
  // State cho modal xem chi tiết TCCS
  const [isTccsDetailModalOpen, setIsTccsDetailModalOpen] = useState(false);

  // Print Logic extracted to a separate hook
  const { isPrintModalOpen, setIsPrintModalOpen, selectedResultForPrint, handlePrint, handlePrintConsolidatedCoa } = useTestResultPrint();

  // Sử dụng useRef để giữ tham chiếu mới nhất của callback mà không gây re-render loop
  const onInitialBatchSelectRef = useRef(onInitialBatchSelect);
  useEffect(() => {
    onInitialBatchSelectRef.current = onInitialBatchSelect;
  }, [onInitialBatchSelect]);

  const {
    values: formValues,
    setValues: setFormValues,
    resetForm: resetHookForm,
    setFieldValue,
    setMapValue,
    addToArray,
    removeFromArray,
    updateInArray,
  } = useForm(initialTestResultFormState);

  const skipSave = useCallback((vals: any) => {
    return !vals.batchId && 
           !vals.labName && 
           !vals.notes && 
           Object.keys(vals.testResultsMap || {}).length === 0 && 
           (vals.extraCriteria || []).length === 0;
  }, []);

  const onDraftLoaded = useCallback((data: any) => {
    if (data.batchId) {
      const batch = hydratedBatches.find(b => b.id === data.batchId);
      if (batch) setBatchSearch(`${batch.batchNo} - ${batch.product?.name}`);
    }
  }, [hydratedBatches]);

  // --- AUTO SAVE DRAFT ---
  const { checkDraft, clearDraft } = useFormDraft({
    key: 'TEST_RESULT_DRAFT',
    formValues,
    setFormValues,
    isEnabled: crud.mode === 'ADD',
    skipSave,
    onDraftLoaded
  });

  const {
    manualTccsId, setManualTccsId, availableTCCSList, latestTCCS, defaultTCCS, activeTCCS, tccsMaps
  } = useTccsSelection(formValues.batchId, hydratedBatches as any, tccsList as any);

  const {
    isStatusConfirmOpen, setIsStatusConfirmOpen, pendingStatusUpdate, rejectReason, setRejectReason,
    handleUpdateBatchStatus: _handleUpdateBatchStatus, confirmBatchStatusUpdate
  } = useBatchStatusTransition(updateBatchStatus, notify);

  const handleUpdateBatchStatus = useCallback((newStatus: string, batchId?: string) => {
    _handleUpdateBatchStatus(newStatus, batchId, formValues.batchId);
  }, [_handleUpdateBatchStatus, formValues.batchId]);

  // Derived state: Existing results for batch
  const existingResultsForBatch = useMemo(() => {
    if (!formValues.batchId) return [];
    return testResults.filter(r => r.batchId === formValues.batchId && r.id !== crud.selectedItem?.id)
      .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime());
  }, [formValues.batchId, testResults, crud.selectedItem?.id]);

  const { completionStatus } = useTestResultEvaluation(
    activeTCCS, formValues.testResultsMap, tccsMaps
  );

  const closeFormModal = useCallback(() => {
    crud.close();
    resetHookForm();
    setBatchSearch('');
    setShowBatchDropdown(false);
    // Không clear draft ở đây để giữ lại nếu người dùng lỡ tay đóng modal
  }, [crud, resetHookForm]);

  // Handle URL params for initial batch selection
  useEffect(() => {
    const batchIdParam = searchParams.get('batchId');
    if (batchIdParam) {
      const batch = hydratedBatches.find(b => b.id === batchIdParam);
      if (batch) {
        resetHookForm();
        setFieldValue('batchId', batchIdParam);
        setBatchSearch(`${batch.batchNo} - ${batch.product?.name}`);
        
        if (batch.status !== BATCH_STATUS.TESTING) {
          updateBatchStatus(batchIdParam, BATCH_STATUS.TESTING);
        }
        
        if (onInitialBatchSelectRef.current) {
            onInitialBatchSelectRef.current(batch.batchNo);
        }

        // Phục hồi lại chức năng mở form Add khi click từ URL
        crud.openAdd();
        navigate('/test-results', { replace: true });
      }
    }
  }, [searchParams, hydratedBatches, navigate, updateBatchStatus, setFieldValue, resetHookForm, crud.openAdd]);


  const handleBatchSelect = useCallback((batchId: string) => {
    setFieldValue('batchId', batchId);
    setFieldValue('testResultsMap', {});
    setFieldValue('extraCriteria', []);

    if (batchId) {
      const batch = batches.find(b => b.id === batchId);
      if (batch && batch.status !== BATCH_STATUS.TESTING) {
        updateBatchStatus(batchId, BATCH_STATUS.TESTING);
      }
    }
  }, [setFieldValue, batches, updateBatchStatus]);

  const currentBatch = useMemo(() => {
    return hydratedBatches.find(b => b.id === formValues.batchId);
  }, [hydratedBatches, formValues.batchId]);

  const handleEditResult = useCallback((res: HydratedTestResult) => {
    crud.openEdit(res);
    
    const map: Record<string, string | number> = {};
    const extras: typeof initialTestResultFormState.extraCriteria = [];
    
    res.results.forEach(r => {
      if (r.isExtra) {
        extras.push({
          id: generateId('extra'),
          name: r.criteriaName,
          value: r.value as string,
          unit: r.unit || '',
          limit: (r as any).limit || ''
        });
      } else {
        map[r.criteriaName] = r.value;
      }
    });
    
    setFormValues({
      batchId: res.batchId,
      labName: res.labName,
      testDate: res.testDate,
      notes: res.notes || '',
      testResultsMap: map,
      extraCriteria: extras,
    });
    
    const batch = hydratedBatches.find(b => b.id === res.batchId);
    setBatchSearch(batch ? `${batch.batchNo} - ${batch.product?.name}` : '');
  }, [crud, hydratedBatches, setFormValues]);

  const switchToEditMode = useCallback((res: TestResult) => {
    closeFormModal();
    setTimeout(() => handleEditResult(res as HydratedTestResult), 100);
  }, [closeFormModal, handleEditResult]);

  const handleSaveResult = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formValues.batchId) return notify({ type: 'WARNING', message: 'Vui lòng chọn Lô hàng!' });

    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      let results: TestResultEntry[] = [];
      
      if (activeTCCS) {
        const { rulesMap, criteriaMap, allCriteria } = tccsMaps;

        allCriteria.forEach(c => {
          let val = formValues.testResultsMap[c.name];
          let isAutoPassed = false;
          let ruleSatisfied = false;
          
          // Kiểm tra quy tắc thay thế để xác định có được Auto Pass không
          const rule = rulesMap.get(c.name);
          if (rule && rule.type !== 'CONDITIONAL_CHECK') {
            const mainName = rule.main;
            const mainVal = formValues.testResultsMap[mainName];
            if (mainVal !== undefined && mainVal !== '') {
               const mainDef = criteriaMap.get(mainName);
               if (mainDef) {
                  const isMainPass = evaluateCriterionSmart(mainDef, mainVal);

                  if (isMainPass === true) {
                     ruleSatisfied = true;
                  }
               }
            }
          }

          if (ruleSatisfied) {
             // Nếu thỏa mãn quy tắc: Tự động điền nếu trống HOẶC nếu đang là giá trị tự động cũ
             if (val === undefined || val === '' || val === "Đạt (theo quy tắc thay thế)") {
                val = "Đạt (theo quy tắc thay thế)";
                isAutoPassed = true;
             }
          } else {
             // Nếu không thỏa mãn (TC1 rớt hoặc chưa nhập): Xóa giá trị tự động cũ (nếu có) để tránh lưu kết quả sai
             if (val === "Đạt (theo quy tắc thay thế)") {
                val = "";
             }
          }

          if (val !== undefined && val !== '') {
            let isPass = null;
            if (isAutoPassed) {
                isPass = true;
            } else {
                isPass = evaluateCriterionSmart(c, val);
            }
            
            results.push({ criteriaName: c.name, value: val, isPass, isExtra: false, unit: c.unit });
          }
        });
      }

      formValues.extraCriteria.forEach(item => {
        if (item.name && item.value) {
          let isPass = null;
          
          if (item.limit) {
            // Sử dụng evaluateCriterionSmart để tự động xử lý các toán tử (<=, >=), khoảng (~, -) và làm tròn số
            const pseudoCriterion = {
              name: item.name,
              type: CRITERION_TYPE_CONST.TEXT,
              expectedText: item.limit,
            };
            isPass = evaluateCriterionSmart(pseudoCriterion as any, item.value);
          }
          
          const newEntry: ExtraTestResultEntry = { criteriaName: item.name, value: item.value, isPass, isExtra: true, unit: item.unit, limit: item.limit };
          results.push(newEntry);
        }
      });

      if (results.length === 0) {
        setIsSubmitting(false);
        return notify({ type: 'WARNING', message: 'Vui lòng nhập ít nhất một kết quả kiểm nghiệm!' });
      }

      // Cảnh báo an toàn nếu phiếu chưa hoàn thiện 100%
      if (!completionStatus.isComplete) {
        const confirmIncomplete = window.confirm(
          `CẢNH BÁO: Phiếu kiểm nghiệm mới hoàn thành ${completionStatus.progress}%. \n\nBạn có chắc chắn muốn lưu dạng nháp/chưa hoàn thiện không? (Các chỉ tiêu bị bỏ trống sẽ không hiển thị trên CoA)`
        );
        if (!confirmIncomplete) {
          setIsSubmitting(false);
          return;
        }
      }

      // Cảnh báo an toàn nếu có chỉ tiêu KHÔNG ĐẠT
      const failedCriteria = results.filter(r => r.isPass === false);
      if (failedCriteria.length > 0) {
        const failedNames = failedCriteria.map(r => `  • ${r.criteriaName} (Nhập: ${r.value})`).join('\n');
        const confirmFail = window.confirm(
          `CẢNH BÁO KẾT QUẢ KHÔNG ĐẠT:\n\nPhát hiện ${failedCriteria.length} chỉ tiêu bị vượt giới hạn / không đạt tiêu chuẩn:\n${failedNames}\n\nPhiếu kiểm nghiệm này sẽ đưa lô hàng về kết luận KHÔNG ĐẠT. Bạn có chắc chắn muốn lưu dữ liệu này không?`
        );
        if (!confirmFail) {
          setIsSubmitting(false);
          return;
        }
      }

      const overallStatus = calculateOverallStatus(results, activeTCCS);

      const resultData = {
          batchId: formValues.batchId,
          labName: formData.get('labName') as string,
          testDate: formData.get('testDate') as string,
          results: results,
          overallStatus: overallStatus,
          notes: formValues.notes,
      };

      if (crud.mode === 'EDIT' && crud.selectedItem) {
          const { batch, product, ...cleanResult } = crud.selectedItem as any;
          await updateTestResult({
              ...cleanResult,
              ...resultData,
          });
          
          try {
            logAuditAction({
              action: 'UPDATE',
              collection: 'TEST_RESULTS',
              documentId: crud.selectedItem.id,
              details: `Sửa kết quả kiểm nghiệm lô: ${batch?.batchNo || resultData.batchId}`,
              performedBy: user?.email || 'unknown'
            });
          } catch (e) { console.warn("Lỗi ghi log:", e); }
      } else {
          const newId = generateId('res');
          await addTestResult({
              id: newId,
              ...resultData,
              createdAt: new Date().toISOString(),
          });
          
          try {
            logAuditAction({
              action: 'CREATE',
              collection: 'TEST_RESULTS',
              documentId: newId,
              details: `Tạo kết quả kiểm nghiệm lô: ${currentBatch?.batchNo || resultData.batchId}`,
              performedBy: user?.email || 'unknown'
            });
          } catch (e) { console.warn("Lỗi ghi log:", e); }
      }

      clearDraft(); // Xóa nháp khi lưu thành công
      closeFormModal();
      notify({ type: 'SUCCESS', title: 'Thành công', message: 'Đã lưu kết quả kiểm nghiệm.' });
    } catch (error) {
      console.error("Lỗi lưu kết quả:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formValues, notify, activeTCCS, completionStatus, crud, updateTestResult, addTestResult, clearDraft, closeFormModal]);

  const handleDeleteClick = useCallback((res: HydratedTestResult) => {
    crud.openDelete(res);
  }, [crud]);

  const handleConfirmDelete = useCallback(async () => {
    if (crud.selectedItem) {
      try {
        await deleteTestResult(crud.selectedItem.id);
        // Đóng modal ngay khi xóa thành công
        crud.close();
        notify({ type: 'SUCCESS', title: 'Đã xóa', message: 'Đã xóa phiếu kết quả kiểm nghiệm.' });

        // Ghi log an toàn
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

  const handleOpenAdd = useCallback(() => {
    closeFormModal();
    crud.openAdd();
    checkDraft(); // Kiểm tra nháp khi mở form thêm mới
  }, [closeFormModal, crud, checkDraft]);

  return {
    crud,
    formValues,
    setFieldValue,
    setMapValue,
    addToArray,
    removeFromArray,
    updateInArray,
    isSubmitting,
    batchSearch,
    setBatchSearch,
    showBatchDropdown,
    setShowBatchDropdown,
    activeTCCS,
    manualTccsId,
    setManualTccsId,
    isTccsDetailModalOpen,
    setIsTccsDetailModalOpen,
    defaultTCCS,
    latestTCCS,
    availableTCCSList,
    existingResultsForBatch,
    currentBatch,
    completionStatus,
    isPrintModalOpen,
    setIsPrintModalOpen,
    selectedResultForPrint,
    isStatusConfirmOpen,
    setIsStatusConfirmOpen,
    confirmBatchStatusUpdate,
    pendingStatusUpdate,
    rejectReason,
    setRejectReason,
    
    handleBatchSelect,
    handleUpdateBatchStatus, // Export hàm này để dùng ở UI
    handleEditResult,
    handleSaveResult,
    handleDeleteClick,
    handleConfirmDelete,
    handlePrint,
    closeFormModal: () => { closeFormModal(); }, // Wrap to match interface if needed
    handleOpenAdd, // Expose new handler
    switchToEditMode,
    handlePrintConsolidatedCoa
  };
};
