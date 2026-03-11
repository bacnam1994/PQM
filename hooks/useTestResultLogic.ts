import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
/**
 * @file useTestResultLogic.ts
 * @description Hook trung tâm xử lý logic nhập liệu và đánh giá kết quả kiểm nghiệm.
 * 
 * @rules
 * 1. Logic chọn TCCS: Ưu tiên TCCS theo ngày SX của Lô (xem docs/SYSTEM_LOGIC.md).
 * 2. Logic đánh giá: Sử dụng evaluateCriterionSmart từ utils/criteriaEvaluation.
 * 3. Logic thay thế: Tự động pass TC2 nếu TC1 đạt (xử lý trong completionStatus và handleSaveResult).
 * 4. Logic tự động cập nhật trạng thái lô: Sau khi lưu kết quả kiểm nghiệm, tự động đánh giá và cập nhật trạng thái lô.
 */
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useTestResultContext } from '../context/TestResultContext';
import { useAuth } from '../context/AuthContext';
import { useDataGraph, HydratedTestResult } from './useDataGraph';
import { useForm } from './useForm';
import { useCrud } from './useCrud';
import { TestResult, TestResultEntry, AuditAction } from '../types';
import { ensureArray, evaluateCriterion } from '../utils/parsing';
import { calculateOverallStatus } from '../utils/evaluation';
import { TEST_RESULT_STATUS, BATCH_STATUS, CRITERION_TYPE_CONST } from '../utils/constants';
import { normalizeNumericString, checkRange, evaluateCriterionSmart } from '../utils/criteriaEvaluation';
import { useFormDraft } from './useFormDraft';
import { generateId } from '../utils/idGenerator';
import { logAuditAction } from '../services/auditService';
import { evaluateBatchStatus } from '../utils/batchEvaluation';

interface ExtraTestResultEntry extends TestResultEntry {
  limit?: string;
}

const initialTestResultFormState = {
  batchId: '',
  labName: '',
  testDate: new Date().toISOString().split('T')[0],
  notes: '',
  testResultsMap: {} as Record<string, string | number>,
  extraCriteria: [] as {id: string, name: string, value: string, unit: string, limit: string}[],
};

export const useTestResultLogic = (onInitialBatchSelect?: (batchNo: string) => void) => {
  const { state, updateBatchStatus, notify } = useAppContext();
  const { testResults, addTestResult, updateTestResult, deleteTestResult } = useTestResultContext();
  const { user } = useAuth();
  const { batches: hydratedBatches } = useDataGraph();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const crud = useCrud<TestResult>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');
  const [showBatchDropdown, setShowBatchDropdown] = useState(false);
  const [manualTccsId, setManualTccsId] = useState<string | null>(null);
  
  // State cho modal xem chi tiết TCCS
  const [isTccsDetailModalOpen, setIsTccsDetailModalOpen] = useState(false);

  // Print Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedResultForPrint, setSelectedResultForPrint] = useState<HydratedTestResult | null>(null);

  // State cho hộp thoại xác nhận chuyển trạng thái
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{status: string, batchId: string} | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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
    addToArray,
    removeFromArray,
    updateInArray,
  } = useForm(initialTestResultFormState);

  // --- AUTO SAVE DRAFT ---
  const { checkDraft, clearDraft } = useFormDraft({
    key: 'TEST_RESULT_DRAFT',
    formValues,
    setFormValues,
    isEnabled: crud.mode === 'ADD',
    onDraftLoaded: (data) => {
      if (data.batchId) {
        const batch = hydratedBatches.find(b => b.id === data.batchId);
        if (batch) setBatchSearch(`${batch.batchNo} - ${batch.product?.name}`);
      }
    }
  });

  // --- TCCS SELECTION LOGIC ---
  // This logic is centralized here to be used by the hook and the component.
  const availableTCCSList = useMemo(() => {
    if (!formValues.batchId) return [];
    const batch = hydratedBatches.find(b => b.id === formValues.batchId);
    if (!batch) return [];
    return state.tccsList
      .filter(t => t.productId === batch.productId)
      .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  }, [formValues.batchId, hydratedBatches, state.tccsList]);

  const latestTCCS = useMemo(() => {
    return availableTCCSList.length > 0 ? availableTCCSList[0] : null;
  }, [availableTCCSList]);

  const defaultTCCS = useMemo(() => {
    if (!formValues.batchId || availableTCCSList.length === 0) return null;
    const batch = hydratedBatches.find(b => b.id === formValues.batchId);
    if (!batch) return null;

    if (batch.mfgDate) {
        const mfgTime = new Date(batch.mfgDate).getTime();
        const match = availableTCCSList.find(t => new Date(t.issueDate).getTime() <= mfgTime);
        if (match) return match;
        return availableTCCSList[availableTCCSList.length - 1]; // Fallback to oldest
    }
    
    // If no mfgDate, default to the absolute latest TCCS
    return latestTCCS;
  }, [formValues.batchId, hydratedBatches, availableTCCSList, latestTCCS]);

  // The final active TCCS, considering manual override
  const activeTCCS = useMemo(() => {
    if (manualTccsId) {
      return state.tccsList.find(t => t.id === manualTccsId) || defaultTCCS;
    }
    return defaultTCCS;
  }, [manualTccsId, defaultTCCS, state.tccsList]);

  // Derived state: Existing results for batch
  const existingResultsForBatch = useMemo(() => {
    if (!formValues.batchId) return [];
    return testResults.filter(r => r.batchId === formValues.batchId && r.id !== crud.selectedItem?.id)
      .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime());
  }, [formValues.batchId, testResults, crud.selectedItem?.id]);

  // Tính toán tiến độ nhập liệu (có tính đến logic thay thế)
  const completionStatus = useMemo(() => {
    if (!activeTCCS) return { progress: 0, isComplete: false, total: 0, completed: 0 };

    const allCriteria = [
      ...ensureArray(activeTCCS.mainQualityCriteria),
      ...ensureArray(activeTCCS.safetyCriteria)
    ].filter(c => c && c.name);

    const total = allCriteria.length;
    if (total === 0) return { progress: 0, isComplete: false, total: 0, completed: 0 };

    let completed = 0;
    const rules = activeTCCS.alternateRules || [];

    allCriteria.forEach(c => {
      const val = formValues.testResultsMap[c.name];
      const hasValue = val !== undefined && val !== '' && val !== null;

      if (hasValue) {
        completed++;
      } else {
        // Kiểm tra logic thay thế: Nếu TC1 đạt -> TC2 (là c) được coi là hoàn thành (không cần kiểm)
        const rule = rules.find(r => r.alt === c.name);
        if (rule) {
          const mainName = rule.main;
          const mainVal = formValues.testResultsMap[mainName];
          
          if (mainVal !== undefined && mainVal !== '' && mainVal !== null) {
            const mainDef = allCriteria.find(d => d.name === mainName);
            if (mainDef) {
              const isMainPass = evaluateCriterionSmart(mainDef, mainVal);

              // Nếu rule là FAIL_RETRY (mặc định) và TC1 Đạt -> TC2 được tính là hoàn thành
              if (rule.type !== 'CONDITIONAL_CHECK' && isMainPass === true) {
                completed++;
              }
            }
          }
        }
      }
    });

    const progress = Math.round((completed / total) * 100);
    return { progress, isComplete: progress >= 100, total, completed };
  }, [activeTCCS, formValues.testResultsMap]);

  const closeFormModal = useCallback(() => {
    crud.close();
    resetHookForm();
    setBatchSearch('');
    setShowBatchDropdown(false);
    // Không clear draft ở đây để giữ lại nếu người dùng lỡ tay đóng modal
  }, [crud, resetHookForm]);

  // Reset manual TCCS selection when batch changes
  useEffect(() => {
    setManualTccsId(null);
  }, [formValues.batchId]);

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

        crud.openAdd();
        // Nếu có param URL thì ưu tiên URL, không check draft
        navigate('/test-results', { replace: true });
      }
    }
  }, [searchParams, hydratedBatches, navigate, updateBatchStatus, setFieldValue, resetHookForm, crud.openAdd]);

  // Hàm chuyển trạng thái lô thủ công (Manual Status Transition)
  const handleUpdateBatchStatus = (newStatus: string, batchId?: string) => {
    const id = batchId || formValues.batchId;
    if (!id) return notify({ type: 'WARNING', message: 'Vui lòng chọn Lô hàng!' });
    
    setRejectReason(''); // Reset lý do cũ
    setPendingStatusUpdate({ status: newStatus, batchId: id });
    setIsStatusConfirmOpen(true);
  };

  const confirmBatchStatusUpdate = async () => {
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
  };

  const handleBatchSelect = (batchId: string) => {
    setFieldValue('batchId', batchId);
    setFieldValue('testResultsMap', {});
    setFieldValue('extraCriteria', []);

    if (batchId) {
      const batch = state.batches.find(b => b.id === batchId);
      if (batch && batch.status !== BATCH_STATUS.TESTING) {
        updateBatchStatus(batchId, BATCH_STATUS.TESTING);
      }
    }
  };

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

  const switchToEditMode = (res: TestResult) => {
    closeFormModal();
    setTimeout(() => handleEditResult(res as HydratedTestResult), 100);
  };

  const handleSaveResult = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formValues.batchId) return notify({ type: 'WARNING', message: 'Vui lòng chọn Lô hàng!' });

    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      let results: TestResultEntry[] = [];
      
      if (activeTCCS) {
        const tccsCriteria = [...ensureArray(activeTCCS.mainQualityCriteria), ...ensureArray(activeTCCS.safetyCriteria)];
        const rules = activeTCCS.alternateRules || [];

        tccsCriteria.forEach(c => {
          if (!c || !c.name) return;
          let val = formValues.testResultsMap[c.name];
          let isAutoPassed = false;
          let ruleSatisfied = false;
          
          // Kiểm tra quy tắc thay thế để xác định có được Auto Pass không
          const rule = rules.find(r => r.alt === c.name);
          if (rule && rule.type !== 'CONDITIONAL_CHECK') {
            const mainName = rule.main;
            const mainVal = formValues.testResultsMap[mainName];
            if (mainVal !== undefined && mainVal !== '') {
               const mainDef = tccsCriteria.find(d => d.name === mainName);
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
          const normalizedLimit = normalizeNumericString(item.limit);
          const normalizedValue = normalizeNumericString(item.value);
          
          let isPass = null;
          const rangeCheck = checkRange(normalizedLimit, normalizedValue);
          
          if (rangeCheck !== null) {
            isPass = rangeCheck;
          } else {
            const pseudoCriterion = { type: CRITERION_TYPE_CONST.TEXT, expectedText: normalizedLimit, min: undefined, max: undefined };
            isPass = evaluateCriterion(pseudoCriterion, normalizedValue);
          }
          
          const newEntry: ExtraTestResultEntry = { criteriaName: item.name, value: item.value, isPass, isExtra: true, unit: item.unit, limit: item.limit };
          results.push(newEntry);
        }
      });

      if (results.length === 0) {
        setIsSubmitting(false);
        return notify({ type: 'WARNING', message: 'Vui lòng nhập ít nhất một kết quả kiểm nghiệm!' });
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

      let savedTestResult: TestResult;

      if (crud.mode === 'EDIT' && crud.selectedItem) {
          const { batch, product, ...cleanResult } = crud.selectedItem as any;
          await updateTestResult({
              ...cleanResult,
              ...resultData,
          });
          savedTestResult = { ...cleanResult, ...resultData };
      } else {
          const newTestResult = {
              id: generateId('res'),
              ...resultData,
              createdAt: new Date().toISOString(),
          };
          await addTestResult(newTestResult);
          savedTestResult = newTestResult;
      }

      // ============================================================
      // TỰ ĐỘNG ĐÁNH GIÁ VÀ CẬP NHẬT TRẠNG THÁI LÔ
      // Sau khi lưu kết quả kiểm nghiệm thành công
      // ============================================================
      try {
        // Lấy thông tin batch từ state
        const batch = state.batches.find(b => b.id === formValues.batchId);
        if (batch) {
          // Lấy TCCS của lô
          const tccs = state.tccsList.find(t => t.id === batch.tccsId);
          
          // Lấy tất cả kết quả kiểm nghiệm của lô (bao gồm cả kết quả vừa lưu)
          // Sử dụng testResults từ context + kết quả vừa lưu
          const batchTestResults = [
            ...testResults.filter(r => r.batchId === batch.id),
            savedTestResult
          ];
          
          // Đánh giá trạng thái lô
          const evaluation = evaluateBatchStatus(batch, batchTestResults, tccs);
          const newStatus = evaluation.suggestedStatus;
          
          // Chỉ cập nhật nếu trạng thái thay đổi
          if (newStatus !== batch.status) {
            await updateBatchStatus(batch.id, newStatus);
            console.log(`[Auto-Evaluate] Lô ${batch.batchNo}: ${batch.status} -> ${newStatus}. Lý do: ${evaluation.reason}`);
          }
        }
      } catch (evalError) {
        // Không ảnh hưởng đến việc lưu kết quả nếu đánh giá lỗi
        console.error("[Auto-Evaluate] Lỗi đánh giá trạng thái lô:", evalError);
      }

      clearDraft(); // Xóa nháp khi lưu thành công
      closeFormModal();
      notify({ type: 'SUCCESS', title: 'Thành công', message: 'Đã lưu kết quả kiểm nghiệm.' });
    } catch (error) {
      console.error("Lỗi lưu kết quả:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = useCallback((res: HydratedTestResult) => {
    crud.openDelete(res);
  }, [crud]);

  const handleConfirmDelete = async () => {
    if (crud.selectedItem) {
      try {
        await deleteTestResult(crud.selectedItem.id);
        // Đóng modal ngay khi xóa thành công
        crud.close();
        notify({ type: 'SUCCESS', title: 'Đã xóa', message: 'Đã xóa phiếu kết quả kiểm nghiệm.' });

        // Ghi log an toàn
        try {
          const batch = state.batches.find(b => b.id === crud.selectedItem!.batchId);
          logAuditAction({
            action: AuditAction.DELETE,
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
  };

  const handlePrint = useCallback((res: HydratedTestResult) => {
    setSelectedResultForPrint(res);
    setIsPrintModalOpen(true);
  }, []);

  const handleOpenAdd = () => {
    closeFormModal();
    crud.openAdd();
    checkDraft(); // Kiểm tra nháp khi mở form thêm mới
  };

  const handlePrintConsolidatedCoa = useCallback((batchId: string) => {
    if (!batchId) return;

    const resultsForBatch = testResults
      .filter(r => r.batchId === batchId)
      .sort((a, b) => new Date(a.testDate).getTime() - new Date(b.testDate).getTime());

    if (resultsForBatch.length === 0) {
      notify({ type: 'INFO', message: 'Lô này chưa có kết quả kiểm nghiệm nào.' });
      return;
    }

    const consolidatedResultsMap = new Map<string, TestResultEntry>();

    resultsForBatch.forEach(res => {
      ensureArray(res.results).forEach(entry => {
        if (entry && entry.criteriaName) {
          consolidatedResultsMap.set(entry.criteriaName, entry);
        }
      });
    });

    const finalResults = Array.from(consolidatedResultsMap.values());
    const latestResult = resultsForBatch[resultsForBatch.length - 1];
    const batch = hydratedBatches.find(b => b.id === batchId);
    if (!batch) return;

    const availableTCCSForBatch = state.tccsList
      .filter(t => t.productId === batch.productId)
      .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
    
    let tccsForEvaluation = null;
    if (availableTCCSForBatch.length > 0) {
        if (batch.mfgDate) {
            const mfgTime = new Date(batch.mfgDate).getTime();
            const match = availableTCCSForBatch.find(t => new Date(t.issueDate).getTime() <= mfgTime);
            tccsForEvaluation = match || availableTCCSForBatch[availableTCCSForBatch.length - 1];
        } else {
            tccsForEvaluation = availableTCCSForBatch[0];
        }
    }

    const overallStatus = calculateOverallStatus(finalResults, tccsForEvaluation);

    const virtualResult: HydratedTestResult = {
      id: `consolidated-${batchId}`,
      batchId: batchId,
      labName: 'Tổng hợp',
      testDate: latestResult.testDate,
      results: finalResults,
      overallStatus: overallStatus,
      notes: `Phiếu tổng hợp từ ${resultsForBatch.length} kết quả.`,
      createdAt: new Date().toISOString(),
      batch: { ...batch, tccs: tccsForEvaluation }, // Override TCCS for the report
      product: batch.product,
    };

    setSelectedResultForPrint(virtualResult);
    setIsPrintModalOpen(true);
  }, [testResults, hydratedBatches, state.tccsList, notify]);

  return {
    crud,
    formValues,
    setFieldValue,
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
