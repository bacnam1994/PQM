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
import { useAppStore } from '../../store/useAppStore';
import { TestResult, TestResultEntry } from '../../types';
import { logAuditAction } from '../../services/auditService';
import { useForm } from '../useForm';
import { useCrud } from '../useCrud';
import { useFormDraft } from '../useFormDraft';
import { useDataGraph, HydratedTestResult } from '../useDataGraph';
import { useTccsSelection } from '../useTccsSelection';
import { useBatchStatusTransition } from '../useBatchStatusTransition';
import { fetchTestResultsByBatchId } from '../../services/testResultService';
import { useTestResultSave } from './useTestResultSave';
import { calculateOverallStatus, TEST_RESULT_STATUS, BATCH_STATUS, CRITERION_TYPE_CONST, evaluateCriterionSmart, generateId, parseNumberFromText, ensureArray, getFromCache, checkRuleExemption, calculateCompletionStatus, parseDateToISO } from '../../utils';
import { ref, query, orderByChild, equalTo, get } from 'firebase/database';
import { db } from '../../firebase';
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
  attachments: [] as { name: string; url: string; source: 'google_drive' | 'firebase'; uploadedAt: string }[],
};

export const useTestResultForm = (onInitialBatchSelect?: (batchNo: string) => void) => {
  const tccsList = useAppStore(state => state.tccsList);
  const batches = useAppStore(state => state.batches);
  const updateBatchStatus = useAppStore(state => state.updateBatchStatus);
  const updateBatchProgress = useAppStore(state => state.updateBatchProgress);
  const notify = useAppStore(state => state.notify);
  const testResults = useAppStore(state => state.testResults);
  const allTestResults = useAppStore(state => state.allTestResults);
  const addTestResult = useAppStore(state => state.addTestResult);
  const updateTestResult = useAppStore(state => state.updateTestResult);
  const deleteTestResult = useAppStore(state => state.deleteTestResult);
  const user = useAppStore(state => state.user);
  const { batches: hydratedBatches } = useDataGraph();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const crud = useCrud<TestResult>();
  const [batchSearch, setBatchSearch] = useState('');
  const [showBatchDropdown, setShowBatchDropdown] = useState(false);
  
  // State cho modal xem chi tiết TCCS
  const [isTccsDetailModalOpen, setIsTccsDetailModalOpen] = useState(false);

  // State lưu trữ dữ liệu lấy trực tiếp từ DB để tránh thất thoát do phân trang
  const [fetchedResultsForBatch, setFetchedResultsForBatch] = useState<TestResult[]>([]);
  
  // Ref để lưu trữ nguồn gốc tên chỉ tiêu do AI đọc (để học máy)
  const aiOriginMapRef = useRef<Record<string, string>>({});



  const handlePrintConsolidatedCoa = useCallback((batchId: string) => {
    navigate(`/test-results/coa/${batchId}`);
  }, [navigate]);

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

  useEffect(() => {
    if (!formValues.batchId) {
      setFetchedResultsForBatch([]);
      return;
    }
    fetchTestResultsByBatchId(formValues.batchId).then(setFetchedResultsForBatch);
  }, [formValues.batchId, fetchTestResultsByBatchId]);

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
    
    const sourceResults = (allTestResults && allTestResults.length > 0) ? allTestResults : testResults;
    
    // Gộp kết quả từ Database (fetchedResultsForBatch) và State cục bộ
    // Dùng Map để ghi đè và loại bỏ trùng lặp dựa trên ID
    const uniqueResults = new Map<string, any>();
    [...fetchedResultsForBatch, ...sourceResults].forEach(r => {
      if (r.batchId === formValues.batchId && r.id !== crud.selectedItem?.id) {
        uniqueResults.set(r.id, r);
      }
    });

    return Array.from(uniqueResults.values())
      .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime());
  }, [formValues.batchId, testResults, allTestResults, fetchedResultsForBatch, crud.selectedItem?.id]);

  // Tối ưu: Đưa lịch sử kết quả vào Map để tra cứu O(1) thay vì dùng find() trong vòng lặp
  const existingResultsMap = useMemo(() => {
    const map = new Map<string, any>();
    existingResultsForBatch.forEach(res => {
      ensureArray(res.results).forEach(r => {
        const cName = (r.criteriaName || '').trim().toLowerCase();
        if (!map.has(cName)) map.set(cName, r);
      });
    });
    return map;
  }, [existingResultsForBatch]);

  // Hàm helper tập trung xử lý logic Quy tắc thay thế
  const checkRuleExemptionWrapper = useCallback((cName: string, getMapVal: (n: string) => any) => {
    return checkRuleExemption(cName, getMapVal, activeTCCS, tccsMaps, existingResultsMap);
  }, [activeTCCS, tccsMaps, existingResultsMap]);

  const completionStatus = useMemo(() => {
    return calculateCompletionStatus(activeTCCS, tccsMaps, formValues, existingResultsMap);
  }, [activeTCCS, formValues.testResultsMap, tccsMaps, existingResultsMap]);

  // Tự động điền "Miễn kiểm" vào ô input nếu thoả mãn quy tắc thay thế
  useEffect(() => {
    if (!activeTCCS) return;
    const { rulesMap, allCriteria } = tccsMaps;

    const getMapVal = (name: string) => {
      const target = name.trim().toLowerCase();
      const key = Object.keys(formValues.testResultsMap).find(k => k.trim().toLowerCase() === target);
      return key ? formValues.testResultsMap[key] : undefined;
    };

    allCriteria.forEach(c => {
      const cName = c.name.trim().toLowerCase();
      const rule = rulesMap.get(cName);
      if (rule) {
        const shouldBeExempt = checkRuleExemptionWrapper(cName, getMapVal);

        const currentAltVal = getMapVal(cName);
        if (shouldBeExempt && currentAltVal !== 'Miễn kiểm') {
          setMapValue('testResultsMap', c.name, 'Miễn kiểm');
        } else if (!shouldBeExempt && currentAltVal === 'Miễn kiểm') {
          setMapValue('testResultsMap', c.name, ''); // Xóa chữ Miễn kiểm nếu CT1 bị sửa thành Không Đạt
        }
      }
    });
  }, [activeTCCS, formValues.testResultsMap, tccsMaps, setMapValue, checkRuleExemptionWrapper]);

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
        
        if (batch.status !== BATCH_STATUS.TESTING && batch.status !== BATCH_STATUS.RELEASED && batch.status !== BATCH_STATUS.REJECTED) {
          updateBatchStatus(batchIdParam, BATCH_STATUS.TESTING);
        }
        
        if (onInitialBatchSelectRef.current) {
            onInitialBatchSelectRef.current(batch.batchNo);
        }

        // Nếu user click "Nhập kết quả" từ trang Danh sách Lô hàng, điều hướng thẳng sang Form
        navigate('/test-results/new', { replace: true });
      }
    }
  }, [searchParams, hydratedBatches, navigate, updateBatchStatus, setFieldValue, resetHookForm]);


  const handleBatchSelect = useCallback((batchId: string) => {
    setFieldValue('batchId', batchId);
    setFieldValue('testResultsMap', {});
    setFieldValue('extraCriteria', []);

    if (batchId) {
      const batch = batches.find(b => b.id === batchId);
      if (batch && batch.status !== BATCH_STATUS.TESTING && batch.status !== BATCH_STATUS.RELEASED && batch.status !== BATCH_STATUS.REJECTED) {
        updateBatchStatus(batchId, BATCH_STATUS.TESTING);
      }
    }
  }, [setFieldValue, batches, updateBatchStatus]);

  const currentBatch = useMemo(() => {
    return hydratedBatches.find(b => b.id === formValues.batchId);
  }, [hydratedBatches, formValues.batchId]);

  // Hàm chuyên dụng để nạp dữ liệu vào form khi mở Edit (Gọi trong useEffect của Page)
  const populateFormForEdit = useCallback((res: HydratedTestResult) => {
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
      testDate: parseDateToISO(res.testDate),
      notes: res.notes || '',
      testResultsMap: map,
      extraCriteria: extras,
      attachments: res.attachments || [],
    });
    
    const batch = hydratedBatches.find(b => b.id === res.batchId);
    setBatchSearch(batch ? `${batch.batchNo} - ${batch.product?.name}` : '');
    
    // Clear AI Origin Map khi mở form để edit
    aiOriginMapRef.current = {};
  }, [hydratedBatches, setFormValues]);

  const switchToEditMode = useCallback((res: TestResult) => {
    navigate(`/test-results/edit/${res.id}`);
  }, [navigate]);


  const { handleSaveResult, isSubmitting } = useTestResultSave({
    formValues,
    activeTCCS,
    completionStatus,
    crud,
    clearDraft,
    closeFormModal,
    navigate,
    existingResultsForBatch,
    currentBatch,
    tccsMaps,
    existingResultsMap,
    aiOriginMapRef
  });

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
    aiOriginMapRef,
    isStatusConfirmOpen,
    setIsStatusConfirmOpen,
    confirmBatchStatusUpdate,
    pendingStatusUpdate,
    rejectReason,
    setRejectReason,
    
    handleBatchSelect,
    handleUpdateBatchStatus, // Export hàm này để dùng ở UI
    populateFormForEdit,
    handleSaveResult,
    closeFormModal: () => { closeFormModal(); }, // Wrap to match interface if needed
    switchToEditMode,
    handlePrintConsolidatedCoa,
    fetchTestResultsByBatchId // Export hàm này để gọi chủ đích ở các component khác
  };
};
