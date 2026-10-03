import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BeakerIcon,
  ClipboardDocumentCheckIcon,
  Square3Stack3DIcon,
  PrinterIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  SparklesIcon,
  ShareIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  ChartBarSquareIcon,
  PencilSquareIcon,
  LockClosedIcon,
  ExclamationCircleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { useDataGraph } from '../../hooks/useDataGraph';
import { useAppStore } from '../../store/useAppStore';
import { formatDateStandard, ensureArray, parseNumberFromText } from '../../utils';
import { resolveDeclaredBasis, calculateRelativePercentage } from '../../utils/basisCalculation';
import { useCriteriaResolver } from '../../hooks/useCriteriaResolver';
import { fetchTestResultsByBatchId } from '../../services/testResultService';
import { Batch, TestResult, Criterion, FormulaIngredient } from '../../types';
import { CircularProgress, BatchCriteriaHistory, BatchTestingQABadge } from '../../components';

import { OOSInvestigationModal } from '../../components/features/OOSInvestigationModal';
import { AIBatchClearanceModal } from '../../components/features/AIBatchClearanceModal';
import { DeviationReportModal } from '../../components/features/DeviationReportModal';
import { BatchGenealogyModal } from '../../components/features/BatchGenealogyModal';
import { ESignatureModal } from '../../components/features/ESignatureModal';
import { ElectronicSignature } from '../../types/signature';
import { useDeviationsByBatchQuery } from '../../hooks/queries/useDeviationQueries';
import { Surface, PageHeader, StatusBadge, ConfirmationModal } from '../../components/ui';
import { BatchStatusSelect } from './BatchList/components/BatchStatusSelect';
import { ReleaseRules } from '../../domain/rules';
import { batchAppService } from '../../services/app/BatchAppService';
import {
  BatchReleaseDecisionService,
  BatchReleaseDecision,
} from '../../domain/batch/BatchReleaseDecisionService';
import {
  normalizeCriterionPassStatus,
  resolveTestResultStatus,
} from '../../domain/test-result/testResultStatusResolver';
import { calculateBatchProgress } from './BatchList/utils/batchProgress';

const BatchDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { batches } = useDataGraph();
  const tccsList = useAppStore((state) => state.tccsList);
  const productFormulas = useAppStore((state) => (state as any).productFormulas || []);
  const updateBatchStatus = useAppStore((state) => state.updateBatchStatus);
  const approveBatchRelease = useAppStore((state) => state.approveBatchRelease);
  const submitBpr = useAppStore((state) => state.submitBpr);
  const startBprReview = useAppStore((state) => state.startBprReview);
  const approveBpr = useAppStore((state) => state.approveBpr);
  const rejectBpr = useAppStore((state) => state.rejectBpr);
  const notify = useAppStore((state) => state.notify);
  const role = useAppStore((state) => state.role);
  const isAdmin = useAppStore((state) => state.isAdmin);

  const [viewBatchResults, setViewBatchResults] = useState<TestResult[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistoryTable, setShowHistoryTable] = useState(false);
  const [isOOSOpen, setIsOOSOpen] = useState(false);
  const [oosModalData, setOosModalData] = useState<any>(null);
  const [isClearanceModalOpen, setIsClearanceModalOpen] = useState(false);
  const [isDeviationOpen, setIsDeviationOpen] = useState(false);
  const [deviationData, setDeviationData] = useState<any>(null);
  const [isGenealogyOpen, setIsGenealogyOpen] = useState(false);
  const [isSignReleaseOpen, setIsSignReleaseOpen] = useState(false);
  const [signTargetBatch, setSignTargetBatch] = useState<Batch | null>(null);
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{
    status: string;
    batchId: string;
  } | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [isBprDetailModalOpen, setIsBprDetailModalOpen] = useState(false);
  const [isBprApproveModalOpen, setIsBprApproveModalOpen] = useState(false);
  const [bprApproveComment, setBprApproveComment] = useState('');
  const [isBprRejectModalOpen, setIsBprRejectModalOpen] = useState(false);
  const [bprRejectReason, setBprRejectReason] = useState('');
  const [isBprSubmitting, setIsBprSubmitting] = useState(false);
  const { data: batchDeviations = [] } = useDeviationsByBatchQuery(id);

  const batch = useMemo(() => batches.find((b) => b.id === id), [batches, id]);
  const resolver = useCriteriaResolver((batch as any)?.tccs);
  const canSignRelease = isAdmin || role === 'ADMIN' || role === 'QA';

  const releaseDecision = useMemo<BatchReleaseDecision | null>(() => {
    if (!batch) return null;
    if (batch.status === 'RELEASED') {
      return BatchReleaseDecisionService.getReleasedCanonicalSnapshot(batch);
    }
    return BatchReleaseDecisionService.evaluateReleasePreview({
      batch,
      testResults: viewBatchResults,
      deviations: batchDeviations,
      userRole: role,
      boundTccs: (batch as any)?.tccs,
    });
  }, [batch, viewBatchResults, batchDeviations, role]);

  const gates1to6Pass = useMemo(() => {
    if (!releaseDecision) return false;
    return releaseDecision.gates.filter((g) => g.gateIndex <= 6).every((g) => g.passed);
  }, [releaseDecision]);

  /**
   * Canonical Release Stage – ưu tiên giá trị được sync từ server (Synchronizer).
   * Fallback sang tính toán phía client nếu server chưa sync.
   * UI CHỈ ĐỌC – không tự thay đổi giá trị này.
   */
  const canonicalReleaseStage = useMemo(() => {
    // Ưu tiên canonical state từ server (đã sync bởi BatchReleaseWorkflowSynchronizer)
    if (batch?.releaseStage) return batch.releaseStage;
    // Fallback: tính từ releaseDecision tại thời điểm hiện tại (preview mode)
    if (!releaseDecision) return 'NOT_STARTED';
    const gates = releaseDecision.gates;
    let completed = 0;
    for (const gate of gates) {
      if (gate.passed) completed++;
      else break;
    }
    if (batch?.status === 'RELEASED') return 'RELEASED';
    if (batch?.status === 'REJECTED') return 'REJECTED';
    if (completed === 7) return 'READY_TO_RELEASE';
    if (completed === 0) return gates.length > 0 ? 'GATE_1' : 'NOT_STARTED';
    const stageMap: Record<number, string> = {
      2: 'GATE_2',
      3: 'GATE_3',
      4: 'GATE_4',
      5: 'GATE_5',
      6: 'GATE_6',
      7: 'GATE_7',
    };
    return stageMap[completed + 1] ?? 'GATE_1';
  }, [batch, releaseDecision]);

  /** Canonical Gate Progress – ưu tiên server-synced, fallback local */
  const canonicalGateProgress = useMemo(() => {
    if (batch?.releaseGateProgress) return batch.releaseGateProgress;
    if (!releaseDecision) return null;
    const gates = releaseDecision.gates;
    let completed = 0;
    for (const gate of gates) {
      if (gate.passed) completed++;
      else break;
    }
    return {
      completed,
      total: 7 as const,
      currentGate: completed === 7 ? 8 : completed + 1,
      percentage: Math.round((completed / 7) * 100),
      evaluatedAt: new Date().toISOString(),
    };
  }, [batch, releaseDecision]);

  const handleOpenSignRelease = async () => {
    if (!batch || !releaseDecision) return;

    // Phase 3: Gate 1-6 PASS + User có quyền QA/ADMIN -> Cho phép mở ESignatureModal
    if (!gates1to6Pass) {
      const firstBlocker =
        releaseDecision.gates
          .filter((g) => g.gateIndex <= 6 && !g.passed)
          .flatMap((g) => g.blockers)[0] ||
        'Cần hoàn thành Cổng 1 đến Cổng 6 (đặc biệt: Hồ sơ sản xuất BPR phải được QA phê duyệt) trước khi ký xuất xưởng.';
      notify({
        type: 'ERROR',
        title: 'Quy chuẩn GMP & Release Guard',
        message: firstBlocker,
      });
      return;
    }

    if (!canSignRelease) {
      notify({
        type: 'ERROR',
        title: 'Từ chối quyền hạn',
        message: 'Chỉ vai trò QA hoặc Quản trị viên (ADMIN) mới có thẩm quyền ký duyệt xuất xưởng.',
      });
      return;
    }

    // Nếu Lô vẫn đang ở trạng thái PENDING, yêu cầu người dùng chuyển sang TESTING trước theo đúng FSM
    if (batch.status === 'PENDING') {
      notify({
        type: 'ERROR',
        title: 'Chưa đủ điều kiện xuất xưởng',
        message:
          'Lô sản xuất đang ở trạng thái Chờ xử lý (PENDING). Vui lòng chuyển Lô sang Đang kiểm nghiệm (TESTING) trước khi thực hiện ký duyệt xuất xưởng.',
      });
      return;
    }

    let targetBatch = batch;
    const fresh = await batchAppService.getBatchById(batch.id);
    if (fresh) {
      targetBatch = fresh;
    }

    setSignTargetBatch(targetBatch);
    setIsSignReleaseOpen(true);
  };

  const handleSignReleaseSuccess = async (signature: ElectronicSignature) => {
    if (!batch) return;
    try {
      // Phase 9 & 11: FETCH FRESH BATCH trước khi release
      const freshBatch = (await batchAppService.getBatchById(batch.id)) || signTargetBatch || batch;

      // Phase 5: Re-evaluate 7 Gates với chữ ký thật
      const reEvaluatedDecision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch: freshBatch,
        testResults: viewBatchResults,
        deviations: batchDeviations,
        userRole: role,
        userSignature: signature,
        boundTccs: (freshBatch as any)?.tccs || (batch as any)?.tccs,
      });

      if (!reEvaluatedDecision.eligible) {
        notify({
          type: 'ERROR',
          title: 'Release Guard: Chữ ký chưa đủ điều kiện',
          message:
            reEvaluatedDecision.blockers[0] || 'Lô chưa thỏa mãn 7 Cổng kiểm soát xuất xưởng.',
        });
        return;
      }

      // Phase 8: Chỉ gọi approveBatchRelease với BATCH_RELEASE_APPROVE
      await approveBatchRelease(freshBatch.id, signature);
      notify({
        type: 'SUCCESS',
        title: 'Xuất xưởng Lô thành công',
        message: `Đã phê duyệt xuất xưởng Lô ${freshBatch.batchNo} với chữ ký điện tử hợp lệ (FDA 21 CFR Part 11 - 7/7 Gates PASSED).`,
      });
      setSignTargetBatch(null);
    } catch (error: any) {
      console.error('Lỗi xuất xưởng Lô:', error);
      notify({
        type: 'ERROR',
        title: 'Lỗi xuất xưởng',
        message: error.message || 'Không thể xuất xưởng Lô',
      });
    }
  };

  // --- BPR REVIEW HANDLERS (PHASE 1 & 2) ---
  const handleSubmitBpr = async () => {
    if (!batch) return;
    setIsBprSubmitting(true);
    try {
      await submitBpr(batch.id);
      notify({
        type: 'SUCCESS',
        title: 'Nộp hồ sơ BPR thành công',
        message: `Hồ sơ sản xuất Lô ${batch.batchNo} đã chuyển sang SUBMITTED (chờ QA thẩm tra).`,
      });
    } catch (err: any) {
      notify({
        type: 'ERROR',
        title: 'Lỗi nộp hồ sơ BPR',
        message: err.message || 'Không thể nộp hồ sơ BPR.',
      });
    } finally {
      setIsBprSubmitting(false);
    }
  };

  const handleStartBprReview = async () => {
    if (!batch) return;
    setIsBprSubmitting(true);
    try {
      await startBprReview(batch.id);
      notify({
        type: 'SUCCESS',
        title: 'Bắt đầu thẩm định BPR',
        message: `Hồ sơ sản xuất Lô ${batch.batchNo} đã chuyển sang UNDER_REVIEW (QA đang thẩm định).`,
      });
    } catch (err: any) {
      notify({
        type: 'ERROR',
        title: 'Lỗi bắt đầu thẩm định BPR',
        message: err.message || 'Không thể bắt đầu thẩm tra BPR.',
      });
    } finally {
      setIsBprSubmitting(false);
    }
  };

  const handleConfirmApproveBpr = async () => {
    if (!batch) return;
    setIsBprSubmitting(true);
    try {
      await approveBpr(batch.id, bprApproveComment.trim() || undefined);
      notify({
        type: 'SUCCESS',
        title: 'Phê duyệt BPR thành công',
        message: `Hồ sơ sản xuất Lô ${batch.batchNo} đã được QA phê duyệt đạt chuẩn (APPROVED). Gate 6 đã PASS!`,
      });
      setIsBprApproveModalOpen(false);
      setBprApproveComment('');
    } catch (err: any) {
      notify({
        type: 'ERROR',
        title: 'Lỗi phê duyệt BPR',
        message: err.message || 'Không thể phê duyệt BPR.',
      });
    } finally {
      setIsBprSubmitting(false);
    }
  };

  const handleConfirmRejectBpr = async () => {
    if (!batch) return;
    if (!bprRejectReason.trim()) {
      notify({
        type: 'ERROR',
        title: 'Thiếu lý do từ chối',
        message: 'Quy chuẩn GMP: Vui lòng nhập lý do từ chối hồ sơ sản xuất BPR.',
      });
      return;
    }
    setIsBprSubmitting(true);
    try {
      await rejectBpr(batch.id, bprRejectReason.trim());
      notify({
        type: 'SUCCESS',
        title: 'Đã từ chối BPR',
        message: `Hồ sơ sản xuất Lô ${batch.batchNo} đã bị từ chối (REJECTED).`,
      });
      setIsBprRejectModalOpen(false);
      setBprRejectReason('');
    } catch (err: any) {
      notify({
        type: 'ERROR',
        title: 'Lỗi từ chối BPR',
        message: err.message || 'Không thể từ chối BPR.',
      });
    } finally {
      setIsBprSubmitting(false);
    }
  };

  const handleStatusChangeClick = (newStatus: string, batchId: string) => {
    if (newStatus === 'RELEASED') {
      handleOpenSignRelease();
      return;
    }
    setStatusReason('');
    setPendingStatusUpdate({ status: newStatus, batchId });
    setIsStatusConfirmOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!pendingStatusUpdate || !batch) return;
    try {
      await updateBatchStatus(
        pendingStatusUpdate.batchId,
        pendingStatusUpdate.status as any,
        statusReason
      );
      notify({
        type: 'SUCCESS',
        title: 'Cập nhật trạng thái Lô',
        message: `Đã chuyển trạng thái Lô ${batch.batchNo} sang ${pendingStatusUpdate.status}.`,
      });
    } catch (error: any) {
      console.error('Lỗi cập nhật trạng thái lô:', error);
      notify({
        type: 'ERROR',
        title: 'Lỗi cập nhật trạng thái',
        message: error?.message || 'Không thể cập nhật trạng thái Lô.',
      });
    } finally {
      setIsStatusConfirmOpen(false);
      setPendingStatusUpdate(null);
    }
  };

  const handleOpenOOS = (res?: TestResult) => {
    if (!batch) return;
    const targetResults = res
      ? ensureArray(res.results)
      : viewBatchResults.flatMap((r) => ensureArray(r.results));
    const failedCriteria: {
      criteriaName: string;
      actualValue: string | number;
      specification: string;
      unit?: string;
    }[] = [];
    const passedCriteria: { criteriaName: string; actualValue: string | number }[] = [];

    targetResults.forEach((item) => {
      if (!item || !item.criteriaName) return;
      const cDef = allCriteriaMap.get(item.criteriaName.trim().toLowerCase());
      const reqText = cDef
        ? cDef.type === 'NUMBER'
          ? cDef.min != null && cDef.max != null
            ? `${cDef.min} ~ ${cDef.max}`
            : cDef.min != null
              ? `≥ ${cDef.min}`
              : cDef.max != null
                ? `≤ ${cDef.max}`
                : ''
          : cDef.expectedText || ''
        : '';

      if (item.isPass === false) {
        failedCriteria.push({
          criteriaName: item.criteriaName,
          actualValue: item.value,
          specification: reqText || 'Theo tiêu chuẩn',
          unit: item.unit,
        });
      } else {
        passedCriteria.push({
          criteriaName: item.criteriaName,
          actualValue: item.value,
        });
      }
    });

    const formula = productFormulas.find((f: any) => f.productId === batch.productId);

    setOosModalData({
      productName: batch.product?.name || 'Sản phẩm',
      batchNo: batch.batchNo,
      mfgDate: batch.mfgDate,
      expDate: batch.expDate,
      failedCriteria:
        failedCriteria.length > 0
          ? failedCriteria
          : [
              {
                criteriaName: 'Chỉ tiêu chất lượng',
                actualValue: 'Không đạt',
                specification: 'TCCS',
              },
            ],
      passedCriteria,
      formulaIngredients: formula?.ingredients || [],
    });
    setIsOOSOpen(true);
  };

  // Build lookup maps: TCCS criteria -> formula ingredient -> basis for % calculation
  const { allCriteriaMap, formulaItemMap } = useMemo(() => {
    const tccs = (batch as any)?.tccs;
    const criteriaMap = new Map<string, Criterion>();
    if (tccs) {
      [...ensureArray(tccs.mainQualityCriteria), ...ensureArray(tccs.safetyCriteria)].forEach(
        (c: Criterion) => c && c.name && criteriaMap.set(c.name.trim().toLowerCase(), c)
      );
    }
    const formula = productFormulas.find((f: any) => f.productId === batch?.productId);
    const fMap = new Map<string, FormulaIngredient>();
    if (formula) {
      [...ensureArray(formula.ingredients), ...ensureArray(formula.excipients)].forEach(
        (ing: FormulaIngredient) => ing && ing.name && fMap.set(ing.name.trim().toLowerCase(), ing)
      );
    }
    return { allCriteriaMap: criteriaMap, formulaItemMap: fMap };
  }, [batch, productFormulas]);

  // Helper: tính % hàm lượng cho 1 chỉ tiêu chuẩn hóa theo Domain Basis Engine
  const getContentPercent = (criteriaName: string, value: string | number): string | null => {
    const rName = criteriaName.trim().toLowerCase();
    const criterion = allCriteriaMap.get(rName) ||
      (resolver ? resolver.lookupCriterion(criteriaName, allCriteriaMap) : undefined) || {
        name: criteriaName,
      };
    const formula = productFormulas.find((f: any) => f.productId === batch?.productId);

    const basisInfo = resolveDeclaredBasis(criterion, formula, resolver);
    if (!basisInfo.basis || basisInfo.basis <= 0) return null;

    return calculateRelativePercentage(value, basisInfo.basis);
  };

  useEffect(() => {
    if (id) {
      setIsLoadingHistory(true);
      fetchTestResultsByBatchId(id)
        .then((res) => setViewBatchResults(res))
        .catch((err) => console.error(err))
        .finally(() => setIsLoadingHistory(false));
    }
  }, [id]);

  if (!batch)
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-bold bg-white dark:bg-slate-800 rounded-xl shadow-sm max-w-4xl mx-auto mt-8 border border-slate-100 dark:border-slate-700">
        Không tìm thấy thông tin Lô hàng hoặc dữ liệu đang tải...
      </div>
    );

  const { progressPercent, missingCriteria } = calculateBatchProgress(batch, viewBatchResults);

  return (
    <div className="p-6 max-w-6xl mx-auto animate-in fade-in duration-300 space-y-6 pb-20">
      <PageHeader
        title={`Lô ${batch.batchNo}`}
        subtitle={`${batch.product?.name || 'Chưa gán sản phẩm'} • Mã: ${batch.product?.code || 'N/A'}`}
        icon={Square3Stack3DIcon}
        breadcrumb={[
          { label: 'Quản lý Lô', onClick: () => navigate('/batches') },
          { label: batch.batchNo },
        ]}
        badge={
          isAdmin || role === 'ADMIN' || role === 'QA' ? (
            <div
              className="flex items-center gap-1.5 flex-wrap"
              title="Nhấp để chuyển trạng thái Lô"
            >
              <BatchStatusSelect
                status={batch.status}
                batchId={batch.id}
                onUpdate={handleStatusChangeClick}
                isAdmin={true}
                batch={batch}
                testResults={viewBatchResults}
                tccs={(batch as any)?.tccs}
                releaseGateProgress={canonicalGateProgress}
                releaseStage={canonicalReleaseStage}
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              <StatusBadge status={batch.status} />
              {batch.status === 'TESTING' && (
                <BatchTestingQABadge
                  batch={batch}
                  testResults={viewBatchResults}
                  tccs={(batch as any)?.tccs}
                />
              )}
            </div>
          )
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {batch.status === 'RELEASED' ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg font-medium text-xs">
                <ShieldCheckIcon className="h-4 w-4" />
                <span>Đã xuất xưởng</span>
              </div>
            ) : (
              <>
                {batch.status === 'PENDING' && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await updateBatchStatus(batch.id, 'TESTING');
                        notify({
                          type: 'SUCCESS',
                          title: 'Bắt đầu kiểm nghiệm',
                          message: `Lô ${batch.batchNo} đã chuyển sang trạng thái Đang kiểm nghiệm (TESTING).`,
                        });
                      } catch (err: any) {
                        notify({
                          type: 'ERROR',
                          title: 'Lỗi bắt đầu kiểm nghiệm',
                          message: err.message || 'Không thể chuyển Lô sang Đang kiểm nghiệm.',
                        });
                      }
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg font-medium shadow-xs text-xs cursor-pointer transition-colors"
                  >
                    <ArrowPathIcon className="h-4 w-4" /> Bắt đầu kiểm nghiệm
                  </button>
                )}
                {canSignRelease && (
                  <button
                    type="button"
                    onClick={handleOpenSignRelease}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-medium shadow-xs text-xs cursor-pointer transition-colors"
                  >
                    <ShieldCheckIcon className="h-4 w-4" /> Ký xuất xưởng
                  </button>
                )}
              </>
            )}
            {(isAdmin || role === 'ADMIN') && (
              <button
                type="button"
                onClick={() => navigate(`/batches/edit/${batch.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface text-ink-soft hover:bg-surface-2 rounded-lg font-medium border border-border text-xs cursor-pointer transition-colors shadow-xs"
                title="Sửa thông tin Lô sản xuất"
              >
                <PencilSquareIcon className="h-4 w-4 text-ink-muted" /> Sửa Lô
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate(`/batches/360/${batch.id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 rounded-lg font-medium border border-blue-500/20 text-xs cursor-pointer transition-colors"
            >
              <ChartBarSquareIcon className="h-4 w-4" /> Hồ sơ 360°
            </button>
            <button
              type="button"
              onClick={() => setIsGenealogyOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface text-ink-soft hover:bg-surface-2 rounded-lg font-medium border border-border text-xs cursor-pointer transition-colors shadow-xs"
            >
              <ShareIcon className="h-4 w-4" /> Truy vết
            </button>
            <button
              type="button"
              onClick={() => setIsClearanceModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg font-medium text-xs cursor-pointer transition-colors"
            >
              <SparklesIcon className="h-4 w-4" /> Thẩm định AI
            </button>
            <button
              onClick={() => navigate(`/test-results/coa/${batch.id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-ink-soft rounded-lg font-medium text-xs cursor-pointer transition-colors border border-border shadow-xs"
            >
              <PrinterIcon className="h-4 w-4" /> In CoA
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 space-y-6">
          <Surface variant="flat" padding="lg">
            <div className="mb-4 pb-4 border-b border-border">
              <p className="text-xs font-semibold text-ink-muted mb-1">Sản phẩm</p>
              <h4
                onClick={() => batch.productId && navigate(`/products/${batch.productId}`)}
                className="font-bold text-ink text-base leading-tight mb-1 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-colors"
                title="Nhấn để xem chi tiết hồ sơ sản phẩm"
              >
                {batch.product?.name}
              </h4>
              <p className="text-xs font-mono font-medium text-emerald-700 dark:text-emerald-400">
                {batch.product?.code}
              </p>
            </div>
            <div className="mb-4 pb-4 border-b border-border">
              <p className="text-xs font-semibold text-ink-muted mb-1">Số Lô</p>
              <h4 className="font-mono font-bold text-ink text-xl">{batch.batchNo}</h4>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="font-medium text-ink-muted">NSX:</span>{' '}
                <span className="font-semibold text-ink">{formatDateStandard(batch.mfgDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-ink-muted">HSD:</span>{' '}
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {formatDateStandard(batch.expDate)}
                </span>
              </div>

              <div className="pt-3 border-t border-border">
                <span className="font-medium text-ink-muted block mb-1">Tiêu chuẩn áp dụng:</span>
                {(batch as any).tccs?.id ? (
                  <Link
                    to={`/tccs/detail/${(batch as any).tccs?.id}`}
                    className="font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded inline-flex items-center gap-1 transition-colors border border-emerald-500/20"
                    title="Nhấn để xem chi tiết TCCS"
                  >
                    <DocumentTextIcon className="h-3.5 w-3.5" />{' '}
                    {(batch as any).tccs?.code || 'Không xác định'}
                  </Link>
                ) : (
                  <span className="font-medium text-ink-muted">Không xác định</span>
                )}
              </div>

              {/* Link đến Công thức sản phẩm (nếu có) */}
              {(batch as any).formula && (
                <div className="pt-2 border-t border-border">
                  <span className="font-medium text-ink-muted block mb-1">Công thức sản phẩm:</span>
                  <Link
                    to={`/product-formulas`}
                    className="font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-1 rounded inline-flex items-center gap-1 transition-colors text-[11px] border border-purple-500/20"
                    title="Xem công thức sản phẩm"
                  >
                    <BeakerIcon className="h-3.5 w-3.5" /> Xem công thức
                  </Link>
                </div>
              )}
            </div>
          </Surface>

          <Surface variant="flat" padding="lg">
            <div className="flex items-center gap-4 mb-4">
              <CircularProgress progress={progressPercent} />
              <div>
                <h4 className="text-xs font-semibold text-ink-muted flex items-center gap-1.5">
                  <BeakerIcon className="h-3.5 w-3.5" /> Tiến độ kiểm nghiệm
                </h4>
                <p className="text-sm text-ink font-semibold mt-0.5">
                  Hoàn thành {progressPercent}%
                </p>
              </div>
            </div>
            {missingCriteria.length > 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1 mb-2">
                  <ExclamationTriangleIcon className="h-3.5 w-3.5 text-amber-600" /> Còn thiếu{' '}
                  {missingCriteria.length} chỉ tiêu:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {missingCriteria.map((c: any, idx: number) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-surface text-amber-800 dark:text-amber-300 text-[11px] font-medium rounded border border-amber-500/20"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  Đã kiểm đủ tất cả chỉ tiêu.
                </span>
              </div>
            )}
          </Surface>

          {/* Card: Hồ sơ Sai lệch & CAPA liên kết */}
          <Surface variant="flat" padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldExclamationIcon
                  className={`h-4 w-4 ${batchDeviations.some((d) => d.status !== 'CLOSED') ? 'text-rose-500' : 'text-ink-muted'}`}
                />
                <h4 className="text-xs font-semibold text-ink">Hồ sơ Sai lệch (CAPA)</h4>
              </div>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  batchDeviations.length === 0
                    ? 'bg-surface-2 text-ink-muted border border-border'
                    : batchDeviations.some((d) => d.status !== 'CLOSED')
                      ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {batchDeviations.length} hồ sơ
              </span>
            </div>

            {batchDeviations.length === 0 ? (
              <p className="text-xs text-ink-muted italic">
                Không có hồ sơ sai lệch nào cho lô này.
              </p>
            ) : (
              <div className="space-y-2">
                {batchDeviations.map((dev) => (
                  <div
                    key={dev.id}
                    className="p-2.5 rounded-xl bg-surface-2 border border-border text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium text-ink">{dev.deviationNo}</span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                          dev.status === 'CLOSED'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {dev.status === 'CLOSED' ? 'Đã đóng' : 'Đang xử lý'}
                      </span>
                    </div>
                    <p className="text-ink-soft font-medium truncate">{dev.title}</p>
                    {dev.failedCriteria && dev.failedCriteria.length > 0 && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                        {dev.failedCriteria.length} chỉ tiêu OOS (
                        {dev.failedCriteria.map((c) => c.name).join(', ')})
                      </p>
                    )}
                  </div>
                ))}

                <Link
                  to="/deviations"
                  className="block text-center py-2 px-3 rounded-lg bg-surface-2 hover:bg-surface-3 text-ink-soft text-xs font-medium transition-colors border border-border"
                >
                  Mở trang Quản lý Sai lệch & CAPA →
                </Link>
              </div>
            )}
          </Surface>

          {/* Card: 7 Cổng Kiểm Soát Xuất Xưởng (7 Release Gates) */}
          {releaseDecision && (
            <Surface variant="flat" padding="md" className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <ShieldCheckIcon
                    className={`h-4 w-4 ${releaseDecision.eligible ? 'text-emerald-600' : 'text-amber-500'}`}
                  />
                  <h4 className="text-xs font-bold text-ink">7 Cổng Xuất Xưởng (GMP)</h4>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    releaseDecision.eligible
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {releaseDecision.eligible
                    ? 'ĐỦ ĐIỀU KIỆN'
                    : `${releaseDecision.blockers.length} RÀO CẢN`}
                </span>
              </div>

              {/* Tiến trình 7 Cổng & Giai đoạn Xuất Xưởng (Canonical Release Progress) */}
              {canonicalGateProgress && (
                <div className="p-2.5 rounded-lg bg-surface-2/60 border border-border/80 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-ink">Tiến trình:</span>
                      <span className="text-[11px] font-bold text-primary">
                        {canonicalGateProgress.completed}/7 Cổng
                      </span>
                      <span className="text-[10px] text-ink-muted">
                        ({canonicalGateProgress.percentage}%)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-ink-muted">Giai đoạn:</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          canonicalReleaseStage === 'RELEASED'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                            : canonicalReleaseStage === 'READY_TO_RELEASE'
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                              : canonicalReleaseStage === 'REJECTED'
                                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {canonicalReleaseStage === 'NOT_STARTED' && 'Chưa bắt đầu'}
                        {canonicalReleaseStage === 'GATE_1' && 'Đang đợi Cổng 1'}
                        {canonicalReleaseStage === 'GATE_2' && 'Đang đợi Cổng 2'}
                        {canonicalReleaseStage === 'GATE_3' && 'Đang đợi Cổng 3'}
                        {canonicalReleaseStage === 'GATE_4' && 'Đang đợi Cổng 4'}
                        {canonicalReleaseStage === 'GATE_5' && 'Đang đợi Cổng 5'}
                        {canonicalReleaseStage === 'GATE_6' && 'Đang đợi Cổng 6 (BPR)'}
                        {canonicalReleaseStage === 'GATE_7' && 'Đang đợi Cổng 7 (Ký QA)'}
                        {canonicalReleaseStage === 'READY_TO_RELEASE' && 'Sẵn sàng duyệt ký'}
                        {canonicalReleaseStage === 'RELEASED' && 'Đã xuất xưởng'}
                        {canonicalReleaseStage === 'REJECTED' && 'Bị từ chối'}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-border/80 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        canonicalGateProgress.completed === 7
                          ? 'bg-emerald-500'
                          : canonicalGateProgress.completed >= 4
                            ? 'bg-primary'
                            : 'bg-amber-500'
                      }`}
                      style={{ width: `${canonicalGateProgress.percentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Cảnh báo quan hệ dữ liệu (Legacy Match / Partial Snapshot) */}
              {releaseDecision.warnings.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-semibold flex items-center gap-1">
                    <ExclamationTriangleIcon className="h-3.5 w-3.5 text-amber-600" /> Cảnh báo liên
                    kết:
                  </p>
                  {releaseDecision.warnings.map((w, idx) => (
                    <p
                      key={idx}
                      className="text-[11px] leading-tight text-amber-700 dark:text-amber-400"
                    >
                      • {w}
                    </p>
                  ))}
                </div>
              )}

              {/* Danh sách 7 Gates */}
              <div className="space-y-2 pt-1">
                {releaseDecision.gates.map((g) => (
                  <div
                    key={g.gateIndex}
                    className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1.5 transition-colors ${
                      g.passed
                        ? 'bg-surface-2/40 border-border'
                        : 'bg-rose-500/5 border-rose-500/20 text-rose-900 dark:text-rose-200'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">
                        {g.passed ? (
                          <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <XMarkIcon className="h-3.5 w-3.5 text-rose-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-[11px] truncate text-ink">
                            {g.gateIndex}. {g.gateName}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                              g.passed
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {g.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-ink-muted mt-0.5">{g.details}</p>
                        {g.blockers.length > 0 && (
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium mt-0.5">
                            {g.blockers[0]}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* GATE 6 ACTIONS (Phase 2) */}
                    {g.gateIndex === 6 && (
                      <div className="pt-1.5 border-t border-border/60 flex items-center justify-between flex-wrap gap-1.5 pl-6">
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="text-ink-muted">BPR:</span>
                          <span
                            className={`font-bold px-1.5 py-0.2 rounded text-[9px] ${
                              batch.bprReviewStatus === 'APPROVED'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : batch.bprReviewStatus === 'UNDER_REVIEW'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : batch.bprReviewStatus === 'REJECTED'
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                    : 'bg-surface-2 text-ink-muted border border-border'
                            }`}
                          >
                            {batch.bprReviewStatus || 'DRAFT'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setIsBprDetailModalOpen(true)}
                            className="px-2 py-0.5 bg-surface text-ink-soft hover:bg-surface-2 border border-border rounded text-[10px] font-medium transition-colors cursor-pointer"
                          >
                            Mở hồ sơ BPR
                          </button>

                          {!g.passed && (
                            <>
                              {(!batch.bprReviewStatus || batch.bprReviewStatus === 'DRAFT') && (
                                <>
                                  <button
                                    type="button"
                                    onClick={handleSubmitBpr}
                                    disabled={isBprSubmitting}
                                    className="px-2 py-0.5 bg-surface-2 hover:bg-surface-3 text-ink font-medium rounded text-[10px] transition-colors border border-border cursor-pointer"
                                  >
                                    Nộp BPR
                                  </button>
                                  {canSignRelease && (
                                    <button
                                      type="button"
                                      onClick={handleStartBprReview}
                                      disabled={isBprSubmitting}
                                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded text-[10px] transition-colors cursor-pointer"
                                    >
                                      Bắt đầu thẩm định
                                    </button>
                                  )}
                                </>
                              )}

                              {batch.bprReviewStatus === 'SUBMITTED' && (
                                <>
                                  {canSignRelease ? (
                                    <button
                                      type="button"
                                      onClick={handleStartBprReview}
                                      disabled={isBprSubmitting}
                                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded text-[10px] transition-colors cursor-pointer"
                                    >
                                      Bắt đầu thẩm định
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-ink-muted italic">
                                      Chờ QA thẩm định
                                    </span>
                                  )}
                                </>
                              )}

                              {batch.bprReviewStatus === 'UNDER_REVIEW' && (
                                <>
                                  {canSignRelease ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setIsBprApproveModalOpen(true)}
                                        disabled={isBprSubmitting}
                                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded text-[10px] transition-colors cursor-pointer"
                                      >
                                        Phê duyệt BPR
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setIsBprRejectModalOpen(true)}
                                        disabled={isBprSubmitting}
                                        className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded text-[10px] transition-colors cursor-pointer"
                                      >
                                        Từ chối BPR
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-[10px] text-ink-muted italic">
                                      QA đang thẩm định
                                    </span>
                                  )}
                                </>
                              )}

                              {batch.bprReviewStatus === 'REJECTED' && (
                                <button
                                  type="button"
                                  onClick={handleSubmitBpr}
                                  disabled={isBprSubmitting}
                                  className="px-2 py-0.5 bg-surface-2 hover:bg-surface-3 text-ink font-medium rounded text-[10px] transition-colors border border-border cursor-pointer"
                                >
                                  Nộp lại BPR
                                </button>
                              )}
                            </>
                          )}

                          {g.passed && batch.bprReviewedBy && (
                            <span className="text-[9px] text-emerald-600 dark:text-emerald-400">
                              ✓ QA duyệt: {batch.bprReviewedBy}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* GATE 7 ACTIONS (Phase 3 & 4) */}
                    {g.gateIndex === 7 && !g.passed && (
                      <div className="pt-1.5 border-t border-border/60 flex items-center justify-between flex-wrap gap-1.5 pl-6">
                        {gates1to6Pass ? (
                          canSignRelease ? (
                            <button
                              type="button"
                              onClick={handleOpenSignRelease}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              <ShieldCheckIcon className="h-3.5 w-3.5" /> Ký duyệt xuất xưởng
                            </button>
                          ) : (
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                              Cần quyền QA hoặc Quản trị viên để ký duyệt
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] text-ink-muted italic">
                            (Yêu cầu hoàn tất Cổng 1-6 trước khi ký xuất xưởng)
                          </span>
                        )}
                      </div>
                    )}

                    {g.gateIndex === 7 && g.passed && (
                      <div className="pt-1.5 border-t border-border/60 flex items-center justify-between flex-wrap gap-1.5 pl-6 text-[9px] text-emerald-600 dark:text-emerald-400">
                        <span className="flex items-center gap-1 font-semibold">
                          <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                          Signature: ĐÃ KÝ (21 CFR Part 11)
                          {batch.releasedBy ? ` · ${batch.releasedBy}` : ''}
                        </span>
                        {batch.releasedAt && (
                          <span className="text-ink-muted">
                            {new Date(batch.releasedAt).toLocaleString('vi-VN')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Projection Panel: Hướng dẫn & Nút hành động trực tiếp (Phase 7) */}
              <div className="pt-3 border-t border-border mt-3 space-y-2">
                {releaseDecision.eligible || batch.status === 'RELEASED' ? (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                      {batch.status === 'RELEASED'
                        ? 'LÔ ĐÃ XUẤT XƯỞNG · 7/7 Cổng đạt chuẩn GMP'
                        : '7/7 Cổng đạt chuẩn GMP'}
                    </span>
                    {canSignRelease && batch.status !== 'RELEASED' && (
                      <button
                        type="button"
                        onClick={handleOpenSignRelease}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1"
                      >
                        <ShieldCheckIcon className="h-4 w-4" /> Phê duyệt xuất xưởng
                      </button>
                    )}
                  </div>
                ) : gates1to6Pass &&
                  !releaseDecision.gates.find((x) => x.gateIndex === 7)?.passed ? (
                  <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 text-xs flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold flex items-center gap-1 text-blue-700 dark:text-blue-300">
                        <CheckCircleIcon className="h-3.5 w-3.5 text-blue-600" /> Cổng 1-6 đã ĐẠT
                      </p>
                      <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                        Chờ QA/Admin ký số 21 CFR Part 11 để hoàn tất Gate 7.
                      </p>
                    </div>
                    {canSignRelease ? (
                      <button
                        type="button"
                        onClick={handleOpenSignRelease}
                        className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1"
                      >
                        <ShieldCheckIcon className="h-4 w-4" /> Ký duyệt xuất xưởng
                      </button>
                    ) : (
                      <span className="shrink-0 text-[10px] font-bold px-2 py-1 bg-surface-2 border border-border text-ink-muted rounded-lg">
                        Không đủ thẩm quyền
                      </span>
                    )}
                  </div>
                ) : !releaseDecision.gates.find((x) => x.gateIndex === 6)?.passed ? (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                        <ExclamationTriangleIcon className="h-3.5 w-3.5 text-amber-600" /> BPR chưa
                        được QA duyệt (Cổng 6)
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                        Trạng thái: <strong>{batch.bprReviewStatus || 'DRAFT'}</strong>
                      </p>
                    </div>
                    {canSignRelease && (
                      <div className="shrink-0 flex items-center gap-1">
                        {(!batch.bprReviewStatus ||
                          batch.bprReviewStatus === 'DRAFT' ||
                          batch.bprReviewStatus === 'SUBMITTED') && (
                          <button
                            type="button"
                            onClick={handleStartBprReview}
                            disabled={isBprSubmitting}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium cursor-pointer shadow-xs"
                          >
                            Bắt đầu thẩm định
                          </button>
                        )}
                        {batch.bprReviewStatus === 'UNDER_REVIEW' && (
                          <button
                            type="button"
                            onClick={() => setIsBprApproveModalOpen(true)}
                            disabled={isBprSubmitting}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium cursor-pointer shadow-xs"
                          >
                            Phê duyệt BPR
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-surface-2/60 border border-border text-ink-muted text-xs flex items-center gap-2">
                    <ExclamationCircleIcon className="h-4 w-4 text-ink-muted shrink-0" />
                    <span>
                      Cần hoàn tất chỉ tiêu kiểm nghiệm và khắc phục các sai lệch tồn đọng.
                    </span>
                  </div>
                )}
              </div>
            </Surface>
          )}
        </div>

        <div className="xl:col-span-2 space-y-6">
          <div className="flex p-1 bg-surface-2/80 rounded-xl border border-border gap-1">
            <button
              onClick={() => setShowHistoryTable(false)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${!showHistoryTable ? 'bg-surface text-ink font-semibold shadow-xs border border-border' : 'text-ink-muted hover:text-ink'}`}
            >
              Phiếu Kiểm Nghiệm ({viewBatchResults.length})
            </button>
            <button
              onClick={() => setShowHistoryTable(true)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${showHistoryTable ? 'bg-surface text-ink font-semibold shadow-xs border border-border' : 'text-ink-muted hover:text-ink'}`}
            >
              <Square3Stack3DIcon className="h-4 w-4" /> Bảng Tổng hợp
            </button>
          </div>

          {showHistoryTable ? (
            <Surface variant="flat" padding="lg" className="overflow-hidden">
              <BatchCriteriaHistory batchId={batch.id} />
            </Surface>
          ) : (
            <div className="space-y-4">
              {isLoadingHistory ? (
                <div className="p-10 text-center text-ink-muted italic text-sm flex justify-center items-center gap-3 bg-surface rounded-xl border border-border shadow-xs">
                  <ArrowPathIcon className="animate-spin h-5 w-5 text-emerald-600" /> Đang tải dữ
                  liệu kiểm nghiệm...
                </div>
              ) : viewBatchResults.length === 0 ? (
                <div className="p-10 text-center border border-border rounded-xl bg-surface shadow-xs text-ink-muted italic text-sm">
                  Chưa có kết quả kiểm nghiệm nào.
                </div>
              ) : (
                viewBatchResults.map((res) => (
                  <div
                    key={res.id}
                    className="bg-surface border border-border rounded-xl overflow-hidden shadow-xs"
                  >
                    <div className="bg-surface-2/60 px-4 py-3 flex justify-between items-center border-b border-border">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={resolveTestResultStatus(res)} />
                        <div>
                          <p className="text-sm font-semibold text-ink">{res.labName}</p>
                          <p className="text-xs text-ink-muted mt-0.5">
                            Ngày thử: {formatDateStandard(res.testDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {resolveTestResultStatus(res) !== 'PASS' && (
                          <>
                            <button
                              onClick={() => handleOpenOOS(res)}
                              className="text-xs font-medium text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <ShieldExclamationIcon className="h-3.5 w-3.5 text-rose-500" /> Điều
                              tra OOS (AI)
                            </button>
                            <button
                              onClick={() => {
                                const formula = productFormulas.find(
                                  (f: any) => f.productId === batch.productId
                                );
                                const failed = ensureArray(res.results)
                                  .filter(
                                    (r: any) => normalizeCriterionPassStatus(r.isPass) === false
                                  )
                                  .map((r: any) => ({
                                    name: r.criteriaName,
                                    actualValue: r.value,
                                    unit: r.unit,
                                    specification: (() => {
                                      const c = allCriteriaMap.get(r.criteriaName?.toLowerCase());
                                      return c
                                        ? c.type === 'NUMBER'
                                          ? c.min != null && c.max != null
                                            ? `${c.min}~${c.max}`
                                            : c.min != null
                                              ? `≥${c.min}`
                                              : `≤${c.max}`
                                          : c.expectedText || ''
                                        : '';
                                    })(),
                                  }));
                                setDeviationData({
                                  productName: batch.product?.name || '',
                                  batchNo: batch.batchNo,
                                  mfgDate: batch.mfgDate,
                                  expDate: batch.expDate,
                                  labName: res.labName,
                                  testDate: res.testDate,
                                  failedCriteria: failed,
                                  formulaIngredients: formula?.ingredients || [],
                                });
                                setIsDeviationOpen(true);
                              }}
                              className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg hover:bg-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <ExclamationTriangleIcon className="h-3.5 w-3.5" /> Báo cáo sai lệch
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => navigate(`/test-results/print/${res.id}`)}
                          className="text-xs font-medium text-ink-soft bg-surface border border-border px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <PrinterIcon className="h-3.5 w-3.5" /> In phiếu
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-surface-2/60 text-ink-muted font-semibold text-xs border-b border-border">
                          <tr>
                            <th className="px-4 py-2.5">Chỉ tiêu</th>
                            <th className="px-3 py-2.5 text-center">Mức Y/C</th>
                            <th className="px-4 py-2.5 text-right">Kết quả</th>
                            <th className="px-3 py-2.5 text-center">ĐVT</th>
                            <th className="px-3 py-2.5 text-center">Đánh giá</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {res.results.map((item, idx) => {
                            const pct = getContentPercent(item.criteriaName, item.value);
                            const cDef = allCriteriaMap.get(item.criteriaName.trim().toLowerCase());
                            const reqText = cDef
                              ? cDef.type === 'NUMBER'
                                ? cDef.min != null && cDef.max != null
                                  ? `${cDef.min} ~ ${cDef.max}`
                                  : cDef.min != null
                                    ? `≥ ${cDef.min}`
                                    : cDef.max != null
                                      ? `≤ ${cDef.max}`
                                      : ''
                                : cDef.expectedText || ''
                              : '';
                            return (
                              <tr key={idx} className="hover:bg-surface-2/60 transition-colors">
                                <td className="px-4 py-2.5 font-medium text-ink">
                                  {item.criteriaName}
                                </td>
                                <td className="px-3 py-2.5 text-center text-ink-muted font-mono text-[11px] whitespace-nowrap">
                                  {reqText || '—'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-semibold text-ink">
                                  {item.value}
                                  {pct && (
                                    <span className="block text-[11px] font-normal text-emerald-700 dark:text-emerald-400">
                                      {pct.startsWith('(') ? pct : `(${pct})`}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-center text-ink-muted">
                                  {item.unit}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {item.isPass ? (
                                    <CheckCircleIcon className="h-4 w-4 mx-auto text-emerald-600" />
                                  ) : (
                                    <XMarkIcon className="h-4 w-4 mx-auto text-rose-600" />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {isOOSOpen && oosModalData && (
        <OOSInvestigationModal
          isOpen={isOOSOpen}
          onClose={() => setIsOOSOpen(false)}
          initialData={oosModalData}
        />
      )}

      {isDeviationOpen && deviationData && (
        <DeviationReportModal
          isOpen={isDeviationOpen}
          onClose={() => setIsDeviationOpen(false)}
          initialData={deviationData}
        />
      )}

      {isGenealogyOpen && (
        <BatchGenealogyModal
          isOpen={isGenealogyOpen}
          onClose={() => setIsGenealogyOpen(false)}
          batch={batch}
          testResults={viewBatchResults}
        />
      )}

      <AIBatchClearanceModal
        isOpen={isClearanceModalOpen}
        onClose={() => setIsClearanceModalOpen(false)}
        batch={batch}
        batchTestResults={viewBatchResults}
      />

      {/* Modal Ký duyệt Điện tử (FDA 21 CFR Part 11) */}
      {isSignReleaseOpen && (signTargetBatch || batch) && (
        <ESignatureModal
          isOpen={isSignReleaseOpen}
          onClose={() => {
            setIsSignReleaseOpen(false);
            setSignTargetBatch(null);
          }}
          documentType="BATCH_RELEASE"
          documentId={batch.id}
          documentTitle={`Lô sản xuất: ${batch.batchNo} - ${batch.product?.name || ''}`}
          documentVersion={(signTargetBatch || batch).version}
          onSuccess={handleSignReleaseSuccess}
        />
      )}

      {/* Modal Xác nhận đổi trạng thái cho Admin/QA */}
      <ConfirmationModal
        isOpen={isStatusConfirmOpen}
        onClose={() => setIsStatusConfirmOpen(false)}
        onConfirm={handleConfirmStatusChange}
        title="Xác nhận điều chỉnh trạng thái Lô"
        message={
          <div className="space-y-3">
            <p className="text-ink text-sm">
              Bạn có chắc chắn muốn chuyển trạng thái Lô <strong>{batch?.batchNo}</strong> sang{' '}
              <strong className="text-emerald-600">
                {pendingStatusUpdate?.status === 'RELEASED'
                  ? 'PHÊ DUYỆT (RELEASED)'
                  : pendingStatusUpdate?.status === 'REJECTED'
                    ? 'TỪ CHỐI (REJECTED)'
                    : pendingStatusUpdate?.status === 'TESTING'
                      ? 'ĐANG KIỂM (TESTING)'
                      : pendingStatusUpdate?.status === 'PENDING'
                        ? 'CHỜ KIỂM (PENDING)'
                        : pendingStatusUpdate?.status === 'BLOCKED'
                          ? 'KHÓA LÔ (BLOCKED)'
                          : pendingStatusUpdate?.status}
              </strong>{' '}
              không?
            </p>
            <div>
              <label className="text-xs font-semibold text-ink-muted block mb-1">
                Lý do / Ghi chú điều chỉnh:
                {pendingStatusUpdate?.status === 'REJECTED' ||
                pendingStatusUpdate?.status === 'BLOCKED' ? (
                  <span className="text-rose-500 font-bold ml-1">* Bắt buộc</span>
                ) : (
                  <span className="text-ink-muted font-normal ml-1">
                    (Tùy chọn cho Quản trị viên)
                  </span>
                )}
              </label>
              <textarea
                className="w-full border border-border rounded-lg p-3 text-xs bg-surface-2 text-ink focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder={
                  pendingStatusUpdate?.status === 'REJECTED'
                    ? 'Nhập lý do từ chối lô...'
                    : pendingStatusUpdate?.status === 'BLOCKED'
                      ? 'Nhập lý do khóa / thu hồi lô...'
                      : 'Nhập ghi chú hoặc lý do thay đổi trạng thái (Quản trị viên có thể để trống)...'
                }
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        }
        confirmText="Đồng ý"
        icon={ShieldCheckIcon}
      />

      {/* Modal Xem Hồ Sơ Sản Xuất BPR (Phase 2) */}
      {isBprDetailModalOpen && batch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-surface-2 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                  <DocumentTextIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight text-ink">
                    Hồ Sơ Sản Xuất Lô (BPR - Batch Production Record)
                  </h3>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Số lô: {batch.batchNo} | Mã: {batch.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBprDetailModalOpen(false)}
                className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-3 transition-colors cursor-pointer"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Thông tin chung */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-surface-2 rounded-xl border border-border space-y-1">
                  <span className="text-ink-muted font-medium block">Sản phẩm:</span>
                  <span className="font-bold text-ink text-sm block">
                    {batch.product?.name || 'Chưa liên kết'}
                  </span>
                  <span className="text-[11px] font-mono text-emerald-600">
                    {batch.product?.code}
                  </span>
                </div>
                <div className="p-3 bg-surface-2 rounded-xl border border-border space-y-1">
                  <span className="text-ink-muted font-medium block">
                    Trạng thái thẩm định BPR:
                  </span>
                  <span
                    className={`inline-block font-bold px-2 py-0.5 rounded-full text-xs ${
                      batch.bprReviewStatus === 'APPROVED'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                        : batch.bprReviewStatus === 'UNDER_REVIEW'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                          : batch.bprReviewStatus === 'REJECTED'
                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                            : 'bg-surface-3 text-ink-muted border border-border'
                    }`}
                  >
                    {batch.bprReviewStatus || 'DRAFT'}
                  </span>
                </div>
                <div className="p-3 bg-surface-2 rounded-xl border border-border space-y-1">
                  <span className="text-ink-muted font-medium block">Ngày sản xuất:</span>
                  <span className="font-semibold text-ink">
                    {formatDateStandard(batch.mfgDate)}
                  </span>
                </div>
                <div className="p-3 bg-surface-2 rounded-xl border border-border space-y-1">
                  <span className="text-ink-muted font-medium block">Hạn dùng:</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    {formatDateStandard(batch.expDate)}
                  </span>
                </div>
                <div className="p-3 bg-surface-2 rounded-xl border border-border space-y-1">
                  <span className="text-ink-muted font-medium block">Sản lượng lý thuyết:</span>
                  <span className="font-semibold text-ink">
                    {batch.theoreticalYield != null
                      ? `${batch.theoreticalYield} ${batch.yieldUnit || ''}`
                      : 'N/A'}
                  </span>
                </div>
                <div className="p-3 bg-surface-2 rounded-xl border border-border space-y-1">
                  <span className="text-ink-muted font-medium block">Sản lượng thực tế:</span>
                  <span className="font-semibold text-emerald-600">
                    {batch.actualYield != null
                      ? `${batch.actualYield} ${batch.yieldUnit || ''}`
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Lịch sử thẩm tra BPR */}
              <div className="p-3 bg-surface-2 rounded-xl border border-border text-xs space-y-2">
                <h4 className="font-bold text-ink flex items-center gap-1.5">
                  <ShieldCheckIcon className="w-4 h-4 text-emerald-600" /> Thông tin thẩm tra BPR
                  (Gate 6)
                </h4>
                {batch.bprReviewedBy ? (
                  <div className="space-y-1 text-ink-soft">
                    <p>
                      • Người thẩm tra: <strong>{batch.bprReviewedBy}</strong>
                    </p>
                    <p>
                      • Thời điểm thẩm tra:{' '}
                      <strong>{formatDateStandard(batch.bprReviewedAt)}</strong>
                    </p>
                    {batch.bprReviewComment && (
                      <p>
                        • Nhận xét: <em>"{batch.bprReviewComment}"</em>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-ink-muted italic">
                    Hồ sơ chưa hoàn tất quy trình thẩm tra của QA.
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 py-3 bg-surface-2 border-t border-border flex items-center justify-between">
              <span className="text-xs text-ink-muted">
                Quy chuẩn GMP-WHO Annex 11 & FDA 21 CFR Part 11
              </span>
              <button
                type="button"
                onClick={() => setIsBprDetailModalOpen(false)}
                className="px-4 py-2 bg-surface hover:bg-surface-3 text-ink text-xs font-semibold rounded-xl border border-border transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Phê duyệt BPR (Phase 1 & 2) */}
      <ConfirmationModal
        isOpen={isBprApproveModalOpen}
        onClose={() => {
          setIsBprApproveModalOpen(false);
          setBprApproveComment('');
        }}
        onConfirm={handleConfirmApproveBpr}
        title="Xác nhận Phê duyệt Hồ sơ sản xuất (BPR)"
        message={
          <div className="space-y-3">
            <p className="text-ink text-sm">
              Bạn đang thực hiện <strong>Phê duyệt BPR (Gate 6)</strong> cho Lô sản xuất{' '}
              <strong className="text-emerald-600">{batch?.batchNo}</strong>.
            </p>
            <p className="text-xs text-ink-muted leading-relaxed">
              Hành động này xác nhận hồ sơ sản xuất, định lượng nguyên liệu, và điều kiện vận hành
              lô đã đạt chuẩn GMP.
            </p>
            <div>
              <label className="text-xs font-semibold text-ink-muted block mb-1">
                Ghi chú / Nhận xét thẩm định QA:
              </label>
              <textarea
                className="w-full border border-border rounded-lg p-3 text-xs bg-surface-2 text-ink focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Nhập nhận xét phê duyệt hồ sơ lô (ví dụ: Đã kiểm tra đầy đủ tem nhãn, cân chia nguyên liệu đạt chuẩn)..."
                value={bprApproveComment}
                onChange={(e) => setBprApproveComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        }
        confirmText="Phê duyệt BPR"
        icon={ShieldCheckIcon}
      />

      {/* Modal Từ chối BPR (Phase 1 & 2) */}
      <ConfirmationModal
        isOpen={isBprRejectModalOpen}
        onClose={() => {
          setIsBprRejectModalOpen(false);
          setBprRejectReason('');
        }}
        onConfirm={handleConfirmRejectBpr}
        title="Từ chối Hồ sơ sản xuất (BPR REJECT)"
        message={
          <div className="space-y-3">
            <p className="text-ink text-sm">
              Bạn có chắc chắn muốn <strong>từ chối BPR</strong> của Lô{' '}
              <strong className="text-rose-600">{batch?.batchNo}</strong> không?
            </p>
            <div>
              <label className="text-xs font-semibold text-rose-600 block mb-1">
                Lý do từ chối (Bắt buộc theo GMP) *:
              </label>
              <textarea
                className="w-full border border-rose-300 dark:border-rose-900 rounded-lg p-3 text-xs bg-surface-2 text-ink focus:ring-2 focus:ring-rose-500 outline-none"
                placeholder="Nêu rõ lý do sai lệch trong hồ sơ sản xuất dẫn đến từ chối BPR..."
                value={bprRejectReason}
                onChange={(e) => setBprRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        }
        confirmText="Xác nhận từ chối BPR"
        icon={ShieldExclamationIcon}
      />
    </div>
  );
};
export default BatchDetailPage;
