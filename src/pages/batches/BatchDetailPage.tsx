import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  DocumentTextIcon,
  PencilSquareIcon,
  ScaleIcon,
  BuildingOffice2Icon,
  PlusCircleIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { useDataGraph } from '../../hooks/useDataGraph';
import { useAppStore } from '../../store/useAppStore';
import { formatDateStandard, ensureArray } from '../../utils';
import { resolveDeclaredBasis, calculateRelativePercentage } from '../../utils/basisCalculation';
import { useCriteriaResolver } from '../../hooks/useCriteriaResolver';
import { fetchTestResultsByBatchId } from '../../services/testResultService';
import { Batch, TestResult } from '../../types';
import { CircularProgress, BatchCriteriaHistory } from '../../components';
import { OOSInvestigationModal } from '../../components/features/OOSInvestigationModal';
import { LabComparisonModal } from '../../components/features/LabComparisonModal';
import { Surface, PageHeader, StatusBadge } from '../../components/ui';
import {
  normalizeCriterionPassStatus,
  resolveTestResultStatus,
} from '../../domain/test-result/testResultStatusResolver';
import { calculateBatchProgress } from './BatchList/utils/batchProgress';
import { BatchInspectionProgressService } from '../../domain/batch/BatchInspectionProgressService';
import { InspectionEvaluationModal } from '../../components/features/InspectionEvaluationModal';

export const BatchDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { batches } = useDataGraph();
  const productFormulas = useAppStore((state) => (state as any).productFormulas || []);
  const notify = useAppStore((state) => state.notify);
  const isAdmin = useAppStore((state) => state.isAdmin);
  const role = useAppStore((state) => state.role);
  const tccsList = useAppStore((state) => state.tccsList);
  const user = useAppStore((state) => state.user);

  const [viewBatchResults, setViewBatchResults] = useState<TestResult[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistoryTable, setShowHistoryTable] = useState(false);
  const [isOOSOpen, setIsOOSOpen] = useState(false);
  const [oosModalData, setOosModalData] = useState<any>(null);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);

  const userRole = (user?.role || '').trim().toUpperCase();
  const canEvaluate = ['QA', 'QC', 'ADMIN'].includes(userRole);

  const batch = useMemo(() => batches.find((b) => b.id === id), [batches, id]);
  const resolver = useCriteriaResolver((batch as any)?.tccs);

  const boundTccs = useMemo(() => {
    return (batch as any)?.tccs || tccsList.find((t: any) => t.id === batch?.tccsId);
  }, [batch, tccsList]);

  const inspectionCalc = useMemo(() => {
    if (!batch) return null;
    return BatchInspectionProgressService.calculateInspectionProgress({
      batch,
      testResults: viewBatchResults,
      tccs: boundTccs,
      tccsList,
    });
  }, [batch, viewBatchResults, boundTccs, tccsList]);

  const resolvedInspectionStatus = useMemo(() => {
    if (!batch) return 'NOT_TESTED';
    return BatchInspectionProgressService.resolveInspectionStatusWithFallback({
      batch,
      testResults: viewBatchResults,
      tccs: boundTccs,
      tccsList,
    });
  }, [batch, viewBatchResults, boundTccs, tccsList]);

  // Tải danh sách kết quả kiểm nghiệm của Lô
  useEffect(() => {
    let isMounted = true;
    if (batch?.id) {
      setIsLoadingHistory(true);
      fetchTestResultsByBatchId(batch.id)
        .then((res) => {
          if (isMounted) {
            setViewBatchResults(ensureArray(res));
          }
        })
        .catch((err) => {
          console.error('Lỗi tải kết quả kiểm nghiệm của Lô:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoadingHistory(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [batch?.id]);

  // Phân tách phiếu Nội bộ QC vs Ngoại kiểm
  const internalResults = useMemo(() => {
    return viewBatchResults.filter(
      (r) =>
        !r.labName ||
        r.labName.toLowerCase().includes('nội bộ') ||
        r.labName.toLowerCase().includes('qc') ||
        r.labName.toLowerCase().includes('v-biotech')
    );
  }, [viewBatchResults]);

  const externalResults = useMemo(() => {
    return viewBatchResults.filter(
      (r) =>
        r.labName &&
        !r.labName.toLowerCase().includes('nội bộ') &&
        !r.labName.toLowerCase().includes('v-biotech')
    );
  }, [viewBatchResults]);

  // Tiến độ kiểm nghiệm theo TCCS
  const { progressPercent, missingCriteria } = useMemo(() => {
    return calculateBatchProgress(batch, viewBatchResults);
  }, [batch, viewBatchResults]);

  // Tra cứu định lượng thành phần hoạt chất
  const allCriteriaMap = useMemo(() => {
    const map = new Map<string, any>();
    ensureArray((batch as any)?.tccs?.criteria).forEach((c) => {
      if (c && c.name) map.set(c.name.trim().toLowerCase(), c);
    });
    return map;
  }, [batch]);

  const getContentPercent = useCallback(
    (critName: string, actualVal: string | number) => {
      if (!critName || !actualVal || !batch) return null;
      const cDef = allCriteriaMap.get(critName.trim().toLowerCase());
      if (!cDef) return null;

      const formula = productFormulas.find((f: any) => f.productId === batch.productId);
      const basis = resolveDeclaredBasis(cDef, formula?.ingredients || []);
      if (!basis) return null;

      const pct = calculateRelativePercentage(actualVal, basis.basis);
      return pct != null ? `${pct}% nhãn` : null;
    },
    [allCriteriaMap, batch, productFormulas]
  );

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

      const isPass = normalizeCriterionPassStatus(item.isPass);
      if (isPass === false) {
        failedCriteria.push({
          criteriaName: item.criteriaName,
          actualValue: item.value,
          specification: reqText || 'Theo tiêu chuẩn',
          unit: item.unit,
        });
      } else if (isPass === true) {
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
      failedCriteria,
      passedCriteria,
      labName: res?.labName || 'Phòng QC',
      testDate: res?.testDate || '',
      formulaIngredients: formula?.ingredients || [],
    });
    setIsOOSOpen(true);
  };

  if (!batch) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-ink-muted">Không tìm thấy thông tin Lô sản xuất.</p>
        <button
          onClick={() => navigate('/batches')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-surface text-ink text-xs font-semibold rounded-lg border border-border"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Quay lại danh sách Lô
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <PageHeader
        title={`Hồ sơ Lô: ${batch.batchNo}`}
        subtitle={`Theo dõi chất lượng, tiến độ kiểm nghiệm và đối chiếu kết quả của sản phẩm ${batch.product?.name || ''}`}
        icon={Square3Stack3DIcon}
        badge={
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={resolvedInspectionStatus} />
            {batch.status === 'RELEASED' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <ShieldCheckIcon className="w-3.5 h-3.5" />
                ĐÃ XUẤT XƯỞNG
              </span>
            )}
            {batch.status === 'REJECTED' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                <XMarkIcon className="w-3.5 h-3.5" />
                TỪ CHỐI XUẤT XƯỞNG
              </span>
            )}
            {batch.status === 'BLOCKED' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                <LockClosedIcon className="w-3.5 h-3.5" />
                TẠM KHÓA
              </span>
            )}
          </div>
        }
        breadcrumbs={[{ label: 'Theo dõi theo Lô', path: '/batches' }, { label: batch.batchNo }]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsComparisonOpen(true)}
              disabled={viewBatchResults.length < 2}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-semibold shadow-xs text-xs cursor-pointer transition-colors disabled:opacity-40"
              title={
                viewBatchResults.length < 2
                  ? 'Cần ít nhất 2 phiếu kiểm nghiệm để đối chiếu'
                  : 'Đối chiếu phiếu nội bộ và ngoại kiểm của Lô này'
              }
            >
              <ScaleIcon className="h-4 w-4" />
              Đối chiếu Lab (Nội/Ngoại)
            </button>

            <button
              type="button"
              onClick={() => navigate(`/test-results/new?batchId=${batch.id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface text-ink hover:bg-surface-2 rounded-lg font-medium border border-border text-xs cursor-pointer transition-colors shadow-xs"
            >
              <PlusCircleIcon className="h-4 w-4 text-emerald-600" />
              Nhập kết quả mới
            </button>

            <button
              type="button"
              onClick={() => navigate(`/test-results/coa/${batch.id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface text-ink-soft hover:bg-surface-2 rounded-lg font-medium border border-border text-xs cursor-pointer transition-colors shadow-xs"
            >
              <PrinterIcon className="h-4 w-4" /> In CoA / Báo cáo
            </button>

            {(isAdmin || role === 'ADMIN') && (
              <button
                type="button"
                onClick={() => navigate(`/batches/edit/${batch.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface text-ink-muted hover:text-ink hover:bg-surface-2 rounded-lg font-medium border border-border text-xs cursor-pointer transition-colors shadow-xs"
              >
                <PencilSquareIcon className="h-4 w-4" /> Sửa Lô
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Cột trái: Thông tin Lô & Tổng kết chất lượng */}
        <div className="xl:col-span-1 space-y-6">
          <Surface variant="flat" padding="lg">
            <div className="mb-4 pb-4 border-b border-border">
              <p className="text-xs font-semibold text-ink-muted mb-1">Sản phẩm</p>
              <h4
                onClick={() => batch.productId && navigate(`/products/${batch.productId}`)}
                className="font-bold text-ink text-base leading-tight mb-1 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-colors"
                title="Nhấn để xem chi tiết sản phẩm"
              >
                {batch.product?.name}
              </h4>
              <p className="text-xs font-mono font-medium text-emerald-700 dark:text-emerald-400">
                Mã: {batch.product?.code}
              </p>
            </div>

            <div className="mb-4 pb-4 border-b border-border">
              <p className="text-xs font-semibold text-ink-muted mb-1">Số Lô sản xuất</p>
              <h4 className="font-mono font-bold text-ink text-xl">{batch.batchNo}</h4>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="font-medium text-ink-muted">Ngày sản xuất:</span>
                <span className="font-semibold text-ink">{formatDateStandard(batch.mfgDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-ink-muted">Hạn dùng:</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {formatDateStandard(batch.expDate)}
                </span>
              </div>

              <div className="pt-3 border-t border-border">
                <span className="font-medium text-ink-muted block mb-1">
                  Tiêu chuẩn áp dụng (TCCS):
                </span>
                {(batch as any).tccs?.id ? (
                  <Link
                    to={`/tccs/detail/${(batch as any).tccs?.id}`}
                    className="font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded inline-flex items-center gap-1 transition-colors border border-emerald-500/20"
                    title="Nhấn để xem chi tiết TCCS"
                  >
                    <DocumentTextIcon className="h-3.5 w-3.5" />
                    {(batch as any).tccs?.code || 'Xem TCCS'}
                  </Link>
                ) : (
                  <span className="font-medium text-ink-muted">Chưa gắn TCCS</span>
                )}
              </div>
            </div>
          </Surface>

          {/* Tiến độ kiểm nghiệm */}
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
                  {missingCriteria.length} chỉ tiêu theo TCCS:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {missingCriteria.map((c, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-surface rounded text-[11px] font-medium text-ink-soft border border-border"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                Đã kiểm nghiệm đầy đủ 100% các chỉ tiêu theo TCCS.
              </div>
            )}
          </Surface>

          {/* Kết luận chất lượng kiểm nghiệm chính thức */}
          <Surface variant="flat" padding="lg" className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheckIcon className="w-4 h-4 text-emerald-600" />
                Kết luận chất lượng
              </h4>
              <StatusBadge status={resolvedInspectionStatus} />
            </div>

            {batch.inspectionEvaluation ? (
              <div className="space-y-2 text-xs">
                <div
                  className={`p-3 rounded-xl border ${
                    batch.inspectionEvaluation.status === 'PASS'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-100'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-100'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1.5">
                      {batch.inspectionEvaluation.status === 'PASS' ? (
                        <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <XMarkIcon className="w-4 h-4 text-rose-600" />
                      )}
                      {batch.inspectionEvaluation.status === 'PASS'
                        ? 'ĐẠT (PASS)'
                        : 'KHÔNG ĐẠT (FAIL)'}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface/60 border border-current/20">
                      {batch.inspectionEvaluation.evaluatorRole}
                    </span>
                  </div>

                  <div className="mt-2 text-[11px] space-y-0.5 text-ink-muted">
                    <div>
                      Người xác nhận:{' '}
                      <span className="font-medium text-ink">
                        {batch.inspectionEvaluation.evaluatorName}
                      </span>
                    </div>
                    <div>
                      Thời điểm:{' '}
                      <span className="font-medium text-ink">
                        {formatDateStandard(batch.inspectionEvaluation.evaluatedAt)}
                      </span>
                    </div>
                    {batch.inspectionEvaluation.evaluationHash && (
                      <div
                        className="font-mono text-[10px] truncate"
                        title={`Niêm phong SHA-256: ${batch.inspectionEvaluation.evaluationHash}`}
                      >
                        Mã niêm phong: {batch.inspectionEvaluation.evaluationHash.slice(0, 16)}...
                      </div>
                    )}
                  </div>

                  {batch.inspectionEvaluation.reason && (
                    <div className="mt-2 pt-2 border-t border-current/20 text-xs">
                      <span className="font-semibold">Lý do: </span>
                      {batch.inspectionEvaluation.reason}
                    </div>
                  )}
                </div>

                {inspectionCalc?.isEvaluationStale && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Cảnh báo sai lệch dữ liệu:</div>
                      <div className="text-[11px]">{inspectionCalc.staleReason}</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {resolvedInspectionStatus === 'PENDING_REVIEW' ? (
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2.5">
                    <p className="text-indigo-900 dark:text-indigo-200">
                      Đã hoàn thành 100% chỉ tiêu bắt buộc. Hồ sơ sẵn sàng để người dùng có thẩm
                      quyền (QA/QC/ADMIN) đưa ra kết luận chất lượng.
                    </p>
                    {canEvaluate ? (
                      <button
                        type="button"
                        onClick={() => setIsEvaluationModalOpen(true)}
                        className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <ShieldCheckIcon className="w-4 h-4" />
                        Xác nhận Đạt / Không đạt
                      </button>
                    ) : (
                      <p className="text-[11px] text-ink-muted italic">
                        Cần tài khoản có vai trò QA, QC hoặc ADMIN để thẩm định kết luận.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-ink-muted text-xs">
                    {resolvedInspectionStatus === 'IN_PROGRESS'
                      ? 'Đang tiến hành kiểm nghiệm... Cần hoàn thành đủ 100% chỉ tiêu để mở bước thẩm định.'
                      : 'Chưa có kết quả kiểm nghiệm nào hoàn thành.'}
                  </p>
                )}
              </div>
            )}
          </Surface>

          {/* Thống kê Phiếu Nội bộ vs Ngoại kiểm */}
          <Surface variant="flat" padding="lg" className="space-y-3">
            <h4 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <BuildingOffice2Icon className="w-4 h-4 text-emerald-600" />
              Nguồn Phiếu Kiểm Nghiệm ({viewBatchResults.length})
            </h4>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-surface-2/60 rounded-xl border border-border flex items-center justify-between">
                <div>
                  <span className="font-semibold text-ink block">QC Nội bộ (V-Biotech)</span>
                  <span className="text-[11px] text-ink-muted">
                    {internalResults.length > 0
                      ? `${internalResults.length} phiếu · Mới nhất: ${formatDateStandard(internalResults[0]?.testDate)}`
                      : 'Chưa có phiếu nội bộ'}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    internalResults.some((r) => r.overallStatus === 'PASS')
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-surface-3 text-ink-muted'
                  }`}
                >
                  {internalResults.length > 0 ? `${internalResults.length} phiếu` : '0'}
                </span>
              </div>

              <div className="p-3 bg-surface-2/60 rounded-xl border border-border flex items-center justify-between">
                <div>
                  <span className="font-semibold text-ink block">
                    Ngoại kiểm (Quatest, CASE...)
                  </span>
                  <span className="text-[11px] text-ink-muted">
                    {externalResults.length > 0
                      ? `${externalResults.length} phiếu · Mới nhất: ${formatDateStandard(externalResults[0]?.testDate)}`
                      : 'Chưa có phiếu gửi ngoài'}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    externalResults.length > 0
                      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                      : 'bg-surface-3 text-ink-muted'
                  }`}
                >
                  {externalResults.length > 0 ? `${externalResults.length} phiếu` : '0'}
                </span>
              </div>
            </div>

            {internalResults.length > 0 && externalResults.length > 0 && (
              <button
                type="button"
                onClick={() => setIsComparisonOpen(true)}
                className="w-full mt-2 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <ScaleIcon className="w-4 h-4" />
                Đối chiếu 2 nguồn kết quả (AI Bias Analysis)
              </button>
            )}
          </Surface>
        </div>

        {/* Cột phải: Danh sách chi tiết các phiếu kiểm nghiệm */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <ClipboardDocumentCheckIcon className="h-5 w-5 text-emerald-600" />
              Kết quả Kiểm nghiệm ({viewBatchResults.length} phiếu)
            </h3>
            <button
              onClick={() => setShowHistoryTable(!showHistoryTable)}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <Square3Stack3DIcon className="h-4 w-4" />
              {showHistoryTable ? 'Xem dạng Thẻ' : 'Xem Bảng Tổng hợp'}
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
                  <ArrowPathIcon className="animate-spin h-5 w-5 text-emerald-600" />
                  Đang tải dữ liệu kiểm nghiệm...
                </div>
              ) : viewBatchResults.length === 0 ? (
                <div className="p-10 text-center border border-border rounded-xl bg-surface shadow-xs text-ink-muted italic text-sm">
                  Chưa có kết quả kiểm nghiệm nào cho Lô này. Nhấp "Nhập kết quả mới" để bắt đầu.
                </div>
              ) : (
                viewBatchResults.map((res) => (
                  <div
                    key={res.id}
                    className="bg-surface border border-border rounded-xl overflow-hidden shadow-xs"
                  >
                    <div className="bg-surface-2/60 px-4 py-3 flex justify-between items-center border-b border-border flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={resolveTestResultStatus(res)} />
                        <div>
                          <p className="text-sm font-semibold text-ink flex items-center gap-1.5">
                            <BuildingOffice2Icon className="w-4 h-4 text-ink-muted" />
                            {res.labName || 'QC Nội bộ'}
                          </p>
                          <p className="text-xs text-ink-muted mt-0.5">
                            Ngày thử: {formatDateStandard(res.testDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {resolveTestResultStatus(res) !== 'PASS' && (
                          <button
                            type="button"
                            onClick={() => handleOpenOOS(res)}
                            className="text-xs font-medium text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <ShieldExclamationIcon className="h-3.5 w-3.5 text-rose-500" />
                            Ghi chú OOS
                          </button>
                        )}
                        <button
                          type="button"
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
                            <th className="px-3 py-2.5 text-center">Mức Yêu Cầu</th>
                            <th className="px-4 py-2.5 text-right">Kết quả Thử nghiệm</th>
                            <th className="px-3 py-2.5 text-center">Đơn vị</th>
                            <th className="px-3 py-2.5 text-center">Đánh giá</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {ensureArray(res.results).map((item, idx) => {
                            const pct = getContentPercent(item.criteriaName, item.value);
                            const cDef = allCriteriaMap.get(
                              item.criteriaName?.trim().toLowerCase()
                            );
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
                            const isPass = normalizeCriterionPassStatus(item.isPass);

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
                                  {item.unit || '—'}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {isPass === true ? (
                                    <CheckCircleIcon className="h-4 w-4 mx-auto text-emerald-600" />
                                  ) : isPass === false ? (
                                    <XMarkIcon className="h-4 w-4 mx-auto text-rose-600" />
                                  ) : (
                                    <span className="text-[10px] text-ink-muted font-mono">
                                      Đang kiểm
                                    </span>
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

      {/* Modal Điều tra OOS */}
      {isOOSOpen && oosModalData && (
        <OOSInvestigationModal
          isOpen={isOOSOpen}
          onClose={() => setIsOOSOpen(false)}
          initialData={oosModalData}
        />
      )}

      {/* Modal Đối chiếu Lab Nội bộ vs Ngoại kiểm */}
      {isComparisonOpen && batch && (
        <LabComparisonModal
          isOpen={isComparisonOpen}
          onClose={() => setIsComparisonOpen(false)}
          batch={batch}
          initialResult1={internalResults[0]}
          initialResult2={
            externalResults[0] || (internalResults.length > 1 ? internalResults[1] : undefined)
          }
        />
      )}

      {/* Modal Đánh giá chất lượng kiểm nghiệm */}
      {isEvaluationModalOpen && batch && inspectionCalc && (
        <InspectionEvaluationModal
          isOpen={isEvaluationModalOpen}
          onClose={() => setIsEvaluationModalOpen(false)}
          batch={batch}
          calculation={inspectionCalc}
          testResults={viewBatchResults}
          onSuccess={() => {
            if (batch?.id) {
              fetchTestResultsByBatchId(batch.id).then((res) => {
                setViewBatchResults(ensureArray(res));
              });
            }
          }}
        />
      )}
    </div>
  );
};

export default BatchDetailPage;
