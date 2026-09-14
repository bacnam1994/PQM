import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useIsMutating } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useTestResultForm } from '../../hooks/test-results/useTestResultForm';
import { useAppStore } from '../../store/useAppStore';
import { useDataGraph } from '../../hooks/useDataGraph';
import { fetchTestResultById } from '../../services/testResultService';
import { normalizeSearch, BATCH_STATUS } from '../../utils';
import { consumeAIDraft, peekAIDraft } from '../../services/ai/aiDraftManager';
import {
  OperationalLoadingState,
  OperationalDraftBanner,
  OperationalOfflineBanner,
  OperationalErrorBanner,
  AutoSaveStatusBadge,
} from '../../components/operational';

// Specialized Form Subcomponents & Hooks
import { TestResultHeader } from './test-result-form/components/TestResultHeader';
import { BatchLabSelector } from './test-result-form/components/BatchLabSelector';
import { TccsCriteriaSection } from './test-result-form/components/TccsCriteriaSection';
import { ExtraCriteriaSection } from './test-result-form/components/ExtraCriteriaSection';
import { AttachmentSection } from './test-result-form/components/AttachmentSection';
import { GDFileSelectorModal } from './test-result-form/components/GDFileSelectorModal';
import { BatchScanProgressModal } from './test-result-form/components/BatchScanProgressModal';
import { useTestResultAIIntegration } from './test-result-form/hooks/useTestResultAIIntegration';

// Common Modals & Tools
import { MappingConfirmModal } from '../../components/features/MappingConfirmModal';
import { LabComparisonModal } from '../../components/features/LabComparisonModal';
import AutoCreateBatchModal from '../../components/features/AutoCreateBatchModal';
import { SpecialCharToolbar } from '../../components';
import { Surface, WorkflowSteps, ActionBar, WorkflowStep } from '../../components/ui';

const TestResultFormPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const logic = useTestResultForm();
  const allTestResults = useAppStore((state) => state.allTestResults) || [];
  const testResults = useAppStore((state) => state.testResults);
  const aiLearnedMappings = useAppStore((state) => state.aiLearnedMappings) || [];
  const products = useAppStore((state) => state.products);
  const tccsList = useAppStore((state) => state.tccsList);
  const addBatch = useAppStore((state) => state.addBatch);
  const { batches: hydratedBatches } = useDataGraph();

  const {
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
    setManualTccsId,
    availableTCCSList,
    existingResultsForBatch,
    handleBatchSelect,
    handleSaveResult,
    switchToEditMode,
    hasDraft,
    draftTimestamp,
    restoreDraft,
    discardDraft,
    isSavingDraft,
    lastDraftSavedAt,
    saveError,
    clearSaveError,
    retrySave,
  } = logic;

  // Reload trigger for loading retry
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Track network connectivity & background mutations
  const isMutating = useIsMutating();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Track AI-filled field badges
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const aiDraftAppliedRef = useRef(false);
  const [isApplyingAIDraft, setIsApplyingAIDraft] = useState(false);

  // Criteria list from active TCCS for matching
  const allCriteria = useMemo(() => {
    if (!activeTCCS) return [];
    return [...(activeTCCS.mainQualityCriteria || []), ...(activeTCCS.safetyCriteria || [])];
  }, [activeTCCS]);

  // Unique criteria names across all active TCCS for OCR prompt
  const allActiveTccsNames = useMemo(() => {
    const names = new Set<string>();
    tccsList
      .filter((t) => t.isActive)
      .forEach((tccs) => {
        (tccs.mainQualityCriteria || []).forEach((c) => c?.name && names.add(c.name));
        (tccs.safetyCriteria || []).forEach((c) => c?.name && names.add(c.name));
      });
    return Array.from(names).sort();
  }, [tccsList]);

  // Integrated AI Hook
  const ai = useTestResultAIIntegration({
    allActiveTccsNames,
    allCriteria,
    aiLearnedMappings,
    hydratedBatches,
    tccsList,
    products,
    formValues,
    setFieldValue,
    setMapValue,
    addToArray,
    handleBatchSelect,
    setBatchSearch,
    aiFilledFields,
    setAiFilledFields,
    addBatch,
    setFormValues: logic.setFormValues,
  });

  // State when loading existing record for Edit mode
  const [isLoadingEditItem, setIsLoadingEditItem] = useState(false);
  const [editItemNotFound, setEditItemNotFound] = useState(false);

  const logicRef = useRef(logic);
  logicRef.current = logic;

  useEffect(() => {
    let isMounted = true;
    if (id) {
      setIsLoadingEditItem(true);
      setEditItemNotFound(false);

      const loadItem = async () => {
        try {
          const appState = useAppStore.getState();
          const sourceResults =
            appState.allTestResults && appState.allTestResults.length > 0
              ? appState.allTestResults
              : appState.testResults || [];
          let resToEdit = sourceResults.find((r) => r && (r.id === id || r.id.endsWith(id)));

          if (!resToEdit) {
            resToEdit = await fetchTestResultById(id);
          }

          if (!isMounted) return;

          if (resToEdit) {
            logicRef.current.crud.openEdit(resToEdit);
            logicRef.current.populateFormForEdit(resToEdit as any);
          } else {
            setEditItemNotFound(true);
          }
        } catch (error) {
          console.error('Lỗi nạp dữ liệu phiếu kiểm nghiệm:', error);
          if (isMounted) setEditItemNotFound(true);
        } finally {
          if (isMounted) {
            setIsLoadingEditItem(false);
            logicRef.current.setIsFormInitialized(true);
          }
        }
      };

      loadItem();
    } else {
      logicRef.current.crud.openAdd();
      setIsLoadingEditItem(false);
      setEditItemNotFound(false);
      logicRef.current.setIsFormInitialized(true);
    }
    return () => {
      isMounted = false;
    };
  }, [id, reloadTrigger]);

  // Sync batch name into search input when batch data loads
  useEffect(() => {
    if (formValues.batchId && !batchSearch) {
      const matchedBatch = hydratedBatches.find((b) => b.id === formValues.batchId);
      if (matchedBatch) {
        setBatchSearch(
          matchedBatch.product?.name
            ? `${matchedBatch.batchNo} - ${matchedBatch.product.name}`
            : matchedBatch.batchNo
        );
      }
    }
  }, [formValues.batchId, batchSearch, hydratedBatches, setBatchSearch]);

  // Consume AI draft passed outside Router location.state
  const isFormInitialized = logic.isFormInitialized;

  useEffect(() => {
    if (id) return;
    if (!isFormInitialized) return;
    if (aiDraftAppliedRef.current) return;

    const draft = consumeAIDraft();
    if (!draft) return;

    aiDraftAppliedRef.current = true;
    setIsApplyingAIDraft(true);

    try {
      ai.handleDataExtracted(draft.data);
    } catch (error) {
      console.error('[AI] Lỗi áp dụng AI draft vào form:', error);
      toast.error('Dữ liệu AI không thể áp dụng hoàn chỉnh. Bạn có thể tiếp tục nhập thủ công.');
    } finally {
      setIsApplyingAIDraft(false);
    }
  }, [id, isFormInitialized, ai.handleDataExtracted]);

  // Dropdown list for batch selector
  const availableBatchesForDropdown = useMemo(() => {
    const searchNormalized = normalizeSearch(batchSearch);
    return hydratedBatches
      .filter(
        (b) =>
          (b.status === BATCH_STATUS.PENDING ||
            b.status === BATCH_STATUS.TESTING ||
            b.status === BATCH_STATUS.RELEASED ||
            b.status === BATCH_STATUS.REJECTED) &&
          (!searchNormalized ||
            normalizeSearch(b.batchNo).includes(searchNormalized) ||
            normalizeSearch(b.product?.name).includes(searchNormalized))
      )
      .slice(0, 50);
  }, [hydratedBatches, batchSearch]);

  if (id && editItemNotFound) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="bg-surface p-8 rounded-xl shadow-xs border border-border flex flex-col items-center gap-3 text-center max-w-md w-full">
          <ExclamationTriangleIcon className="h-10 w-10 text-amber-500" />
          <h2 className="font-bold text-ink text-lg tracking-tight">
            Không tìm thấy phiếu kiểm nghiệm
          </h2>
          <p className="text-sm text-ink-muted">
            Phiếu kết quả kiểm nghiệm này không tồn tại hoặc đã bị xóa khỏi hệ thống.
          </p>
          <button
            type="button"
            onClick={() => navigate('/test-results')}
            className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs transition-all shadow-xs cursor-pointer"
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  if (id && isLoadingEditItem) {
    return (
      <OperationalLoadingState
        message="Đang tải dữ liệu phiếu kiểm nghiệm..."
        subMessage="Hệ thống đang kết nối và nạp thông tin chỉ tiêu..."
        fullPage
        timeoutSeconds={10}
        onRetry={() => setReloadTrigger((prev) => prev + 1)}
      />
    );
  }

  // Tối ưu Workflow steps cho Workbench
  const currentWorkflowStep = useMemo(() => {
    if (!formValues.batchId) return 0;
    const hasResults = Object.keys(formValues.testResultsMap || {}).length > 0;
    if (!hasResults) return 1;
    if (!formValues.notes && (!formValues.attachments || formValues.attachments.length === 0))
      return 2;
    return 3;
  }, [formValues.batchId, formValues.testResultsMap, formValues.notes, formValues.attachments]);

  const workflowSteps: WorkflowStep[] = [
    {
      id: 'step-batch',
      label: '1. Lô & Phòng Lab',
      description: 'Chọn lô sản xuất và phòng thử nghiệm',
    },
    {
      id: 'step-criteria',
      label: '2. Chỉ tiêu kiểm nghiệm',
      description: 'Đánh giá chỉ tiêu theo TCCS',
    },
    {
      id: 'step-attachments',
      label: '3. Minh chứng & Ghi chú',
      description: 'Tải tài liệu và kết luận',
    },
    {
      id: 'step-submit',
      label: '4. Ký duyệt & Hoàn tất',
      description: 'Xác nhận kết quả vào hệ thống',
    },
  ];

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-300 space-y-6 pb-28">
        <TestResultHeader
          isEditMode={crud.mode === 'EDIT'}
          onBack={() => navigate('/test-results')}
          fileInputRef={ai.fileInputRef}
          isAiProcessing={ai.isAiProcessing}
          onAiFileSelect={ai.handleAiFileSelect}
          onApplyVoiceCriteria={ai.handleApplyVoiceCriteria}
          allActiveTccsNames={allActiveTccsNames}
          onOpenLabComparison={() => setIsComparisonModalOpen(true)}
          onOpenGDScan={ai.handleGDScanClick}
          aiScanInfo={ai.aiScanInfo}
          onClearAiScanInfo={() => ai.setAiScanInfo(null)}
        />

        {/* Workflow Progression Stepper */}
        <Surface variant="subtle" padding="sm" className="bg-surface-2/60 backdrop-blur-xs">
          <WorkflowSteps steps={workflowSteps} activeStep={currentWorkflowStep} />
        </Surface>

        {/* 1. Offline Mode Indicator Banner */}
        <OperationalOfflineBanner isOffline={!isOnline} queuedCount={isMutating} />

        {/* 2. Error Recovery Banner with 1-Click Retry */}
        {saveError && (
          <OperationalErrorBanner
            error={saveError}
            onDismiss={clearSaveError}
            onRetry={retrySave}
          />
        )}

        {/* 3. Non-blocking Draft Recovery Banner */}
        <OperationalDraftBanner
          hasDraft={hasDraft && !aiDraftAppliedRef.current && crud.mode === 'ADD'}
          draftTimestamp={draftTimestamp}
          onRestore={restoreDraft}
          onDiscard={discardDraft}
        />

        {isApplyingAIDraft && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
            Đang áp dụng dữ liệu từ AI...
          </div>
        )}

        <form id="test-result-form" onSubmit={handleSaveResult} className="space-y-6">
          <SpecialCharToolbar className="-mx-2 px-2" />

          {/* Section 1: Batch & Lab Information */}
          <Surface
            variant="flat"
            padding="lg"
            title="1. Thông tin Lô & Phòng Kiểm nghiệm"
            subtitle="Lựa chọn lô thành phẩm và phòng thí nghiệm thực hiện phép thử"
          >
            <BatchLabSelector
              batchSearch={batchSearch}
              setBatchSearch={setBatchSearch}
              showBatchDropdown={showBatchDropdown}
              setShowBatchDropdown={setShowBatchDropdown}
              isEditMode={crud.mode === 'EDIT'}
              batchId={formValues.batchId}
              availableBatchesForDropdown={availableBatchesForDropdown}
              handleBatchSelect={handleBatchSelect}
              setFieldValue={setFieldValue}
              labId={(formValues as any).labId}
              labName={formValues.labName}
              testDate={formValues.testDate}
              hydratedBatches={hydratedBatches}
              existingResultsForBatch={existingResultsForBatch}
              switchToEditMode={switchToEditMode}
            />
          </Surface>

          {/* Section 2: Specifications & Criteria Evaluation */}
          <Surface
            variant="flat"
            padding="lg"
            title="2. Đánh giá Chỉ tiêu Chất lượng"
            subtitle="Chỉ tiêu chính, an toàn theo TCCS và các chỉ tiêu bổ sung nếu có"
          >
            <div className="space-y-6">
              <TccsCriteriaSection
                activeTCCS={activeTCCS}
                batchId={formValues.batchId}
                availableTCCSList={availableTCCSList}
                setManualTccsId={setManualTccsId}
                testResultsMap={formValues.testResultsMap}
                setMapValue={setMapValue}
                existingResultsForBatch={existingResultsForBatch}
                aiFilledFields={aiFilledFields}
              />

              <ExtraCriteriaSection
                extraCriteria={formValues.extraCriteria}
                addToArray={addToArray}
                updateInArray={updateInArray}
                removeFromArray={removeFromArray}
              />
            </div>
          </Surface>

          {/* Section 3: Notes & Evidence Attachments */}
          <Surface
            variant="flat"
            padding="lg"
            title="3. Hồ sơ Minh chứng & Kết luận"
            subtitle="Ghi nhận đánh giá cảm quan, lưu ý kiểm nghiệm và tệp đính kèm CoA/Spectra"
          >
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-ink-muted pl-1">
                  Ghi chú phiếu kiểm nghiệm
                </label>
                <textarea
                  name="notes"
                  value={formValues.notes}
                  onChange={(e) => setFieldValue('notes', e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl font-medium outline-none text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all text-ink placeholder:text-ink-faint"
                  placeholder="Ghi chú thêm về điều kiện thử nghiệm, độ ẩm phòng lab, lưu ý đặc biệt..."
                />
              </div>

              <AttachmentSection
                batchId={formValues.batchId}
                attachments={formValues.attachments}
                setFieldValue={setFieldValue}
              />
            </div>
          </Surface>

          {/* Sticky Bottom Workbench Action Bar */}
          <ActionBar
            left={
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/test-results')}
                  className="px-4 py-2 text-ink-muted hover:text-ink font-medium text-xs hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
                >
                  ← Hủy &amp; Quay lại danh sách
                </button>
                <AutoSaveStatusBadge
                  isSaving={isSavingDraft}
                  lastSavedAt={lastDraftSavedAt}
                  isOffline={!isOnline}
                />
              </div>
            }
            right={
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!activeTCCS || isSubmitting}
                  className={`px-5 py-2 text-white font-medium rounded-lg shadow-xs transition-all text-xs tracking-wide flex items-center gap-2 cursor-pointer ${
                    crud.mode === 'EDIT'
                      ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {isSubmitting && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                  {crud.mode === 'EDIT'
                    ? isSubmitting
                      ? 'Đang cập nhật...'
                      : 'Cập nhật Phiếu kiểm nghiệm'
                    : isSubmitting
                      ? 'Đang lưu...'
                      : 'Lưu & Hoàn tất Phiếu'}
                </button>
              </div>
            }
          />
        </form>
      </div>

      <MappingConfirmModal
        isOpen={ai.isMappingModalOpen}
        onClose={() => ai.setIsMappingModalOpen(false)}
        highConfidenceItems={ai.pendingHighItems}
        lowConfidenceItems={ai.pendingLowItems}
        tccsNames={allActiveTccsNames}
        onConfirm={ai.handleMappingConfirmed}
      />

      <LabComparisonModal
        isOpen={isComparisonModalOpen}
        onClose={() => setIsComparisonModalOpen(false)}
        batch={hydratedBatches.find((b) => b.id === formValues.batchId)}
      />

      <GDFileSelectorModal
        isOpen={ai.isGDModalOpen}
        onClose={() => ai.setIsGDModalOpen(false)}
        files={ai.gdFiles}
        onSelectFile={ai.handleSelectGoogleDriveFile}
        isLoading={ai.isLoadingGDFiles}
        folderUrl={ai.googleDriveFolderUrl}
      />

      <BatchScanProgressModal
        isOpen={ai.isBatchProgressOpen}
        files={ai.batchScanFiles}
        totalDone={
          ai.batchScanFiles.filter((f) => f.status === 'done' || f.status === 'error').length
        }
        onClose={() => ai.setIsBatchProgressOpen(false)}
      />

      {ai.pendingAutoCreateData && (
        <AutoCreateBatchModal
          isOpen={ai.isAutoCreateModalOpen}
          onClose={() => {
            ai.setIsAutoCreateModalOpen(false);
            ai.setPendingAutoCreateData(null);
          }}
          onConfirm={ai.handleAutoCreateBatchConfirm}
          aiData={ai.pendingAutoCreateData}
          products={products}
          tccsList={tccsList}
        />
      )}
    </>
  );
};

export default TestResultFormPage;
