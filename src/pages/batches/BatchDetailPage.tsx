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
} from '@heroicons/react/24/outline';
import { useDataGraph } from '../../hooks/useDataGraph';
import { useAppStore } from '../../store/useAppStore';
import { formatDateStandard, ensureArray, parseNumberFromText } from '../../utils';
import { resolveDeclaredBasis, calculateRelativePercentage } from '../../utils/basisCalculation';
import { useCriteriaResolver } from '../../hooks/useCriteriaResolver';
import { fetchTestResultsByBatchId } from '../../services/testResultService';
import { TestResult, Criterion, FormulaIngredient } from '../../types';
import { CircularProgress, BatchCriteriaHistory } from '../../components';
import { OOSInvestigationModal } from '../../components/features/OOSInvestigationModal';
import { AIBatchClearanceModal } from '../../components/features/AIBatchClearanceModal';
import { DeviationReportModal } from '../../components/features/DeviationReportModal';
import { BatchGenealogyModal } from '../../components/features/BatchGenealogyModal';
import { ESignatureModal } from '../../components/features/ESignatureModal';
import { ElectronicSignature } from '../../types/signature';
import { useDeviationsByBatchQuery } from '../../hooks/queries/useDeviationQueries';
import { Surface, PageHeader, StatusBadge } from '../../components/ui';
import { ReleaseRules } from '../../domain/rules';
import { normalizeCriterionPassStatus } from '../../domain/test-result/testResultStatusResolver';

// Helper tính tiến độ lô
const calculateBatchProgress = (batch: any, batchResults: TestResult[]) => {
  const tccs = batch.tccs;
  const requiredCriteria = tccs
    ? [...ensureArray(tccs.mainQualityCriteria), ...ensureArray(tccs.safetyCriteria)].filter(
        (c) => c && c.name && c.name.trim() !== ''
      )
    : [];
  if (requiredCriteria.length === 0)
    return { progressPercent: 0, missingCriteria: [], requiredCriteria: [] };

  const testedCriteriaNames = new Set<string>();
  const latestResultsMap = new Map<string, { value: any; isPass: boolean }>();
  if (batchResults.length > 0) {
    const sortedBatchResults = [...batchResults]
      .filter((r) => r.batchId === batch.id)
      .sort((a, b) => {
        const dateCmp = a.testDate.localeCompare(b.testDate);
        return dateCmp !== 0 ? dateCmp : (a.createdAt || '').localeCompare(b.createdAt || '');
      });
    sortedBatchResults.forEach((r) =>
      ensureArray(r.results).forEach((res) => {
        if (res && res.criteriaName) {
          testedCriteriaNames.add(res.criteriaName.trim().toLowerCase());
          latestResultsMap.set(res.criteriaName.trim().toLowerCase(), {
            value: res.value,
            isPass: res.isPass,
          });
        }
      })
    );
  }
  const rulesMap = new Map<string, any>();
  if (tccs && tccs.alternateRules)
    tccs.alternateRules.forEach((r: any) => {
      if (r && r.alt) rulesMap.set(r.alt.trim().toLowerCase(), r);
    });

  const missingCriteria = requiredCriteria.filter((c) => {
    const cName = c.name.trim().toLowerCase();
    if (testedCriteriaNames.has(cName)) return false;
    const rule = rulesMap.get(cName);
    if (rule) {
      const mainRes = latestResultsMap.get((rule.main || '').trim().toLowerCase());
      if (mainRes !== undefined) {
        if (rule.type === 'CONDITIONAL_CHECK') {
          const extractNum = (val: any) => {
            const str = String(val || '')
              .trim()
              .toUpperCase();
            if (
              [
                'ND',
                'KPH',
                'K.P.H',
                'KHÔNG PHÁT HIỆN',
                'NOT DETECTED',
                'ÂM TÍNH',
                'NEGATIVE',
                'KHÔNG CÓ',
              ].some((kw) => str.includes(kw))
            )
              return 0;
            const match = str.match(/[-+]?[0-9]*[.,]?[0-9]+/);
            return match ? Number(match[0].replace(',', '.')) : parseNumberFromText(str);
          };
          if (mainRes.isPass && extractNum(mainRes.value) <= extractNum(rule.conditionValue))
            return false;
        } else {
          if (mainRes.isPass) return false;
        }
      }
    }
    return true;
  });

  return {
    progressPercent: Math.round(
      ((requiredCriteria.length - missingCriteria.length) / requiredCriteria.length) * 100
    ),
    missingCriteria,
    requiredCriteria,
  };
};

const BatchDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { batches } = useDataGraph();
  const tccsList = useAppStore((state) => state.tccsList);
  const productFormulas = useAppStore((state) => (state as any).productFormulas || []);
  const updateBatchStatus = useAppStore((state) => state.updateBatchStatus);
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
  const { data: batchDeviations = [] } = useDeviationsByBatchQuery(id);

  const batch = useMemo(() => batches.find((b) => b.id === id), [batches, id]);
  const resolver = useCriteriaResolver((batch as any)?.tccs);
  const canSignRelease = isAdmin || role === 'ADMIN' || role === 'QA';

  const handleOpenSignRelease = () => {
    if (!batch) return;

    const releaseEval = ReleaseRules.evaluateReleasePrerequisites({
      batch,
      testResults: viewBatchResults,
      deviations: batchDeviations,
      userRole: role,
      boundTccs: (batch as any)?.tccs,
    });

    if (!releaseEval.isEligibleForRelease) {
      notify({
        type: 'ERROR',
        title: 'Quy chuẩn GMP & Release Guard',
        message: releaseEval.blockers[0] || 'Lô chưa đủ điều kiện xuất xưởng.',
      });
      return;
    }

    setIsSignReleaseOpen(true);
  };

  const handleSignReleaseSuccess = async (signature: ElectronicSignature) => {
    if (!batch) return;
    try {
      await updateBatchStatus(batch.id, 'RELEASED', undefined, signature);
      notify({
        type: 'SUCCESS',
        title: 'Xuất xưởng Lô thành công',
        message: `Đã phê duyệt xuất xưởng Lô ${batch.batchNo} với chữ ký điện tử hợp lệ (FDA 21 CFR Part 11).`,
      });
    } catch (error: any) {
      console.error('Lỗi xuất xưởng Lô:', error);
      notify({
        type: 'ERROR',
        title: 'Lỗi xuất xưởng',
        message: error.message || 'Không thể xuất xưởng Lô',
      });
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
        badge={<StatusBadge status={batch.status} />}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {batch.status === 'RELEASED' ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg font-medium text-xs">
                <ShieldCheckIcon className="h-4 w-4" />
                <span>Đã xuất xưởng</span>
              </div>
            ) : canSignRelease ? (
              <button
                type="button"
                onClick={handleOpenSignRelease}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-medium shadow-xs text-xs cursor-pointer transition-colors"
              >
                <ShieldCheckIcon className="h-4 w-4" /> Ký xuất xưởng
              </button>
            ) : null}
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
                        <StatusBadge status={res.overallStatus === 'PASS' ? 'PASS' : 'FAIL'} />
                        <div>
                          <p className="text-sm font-semibold text-ink">{res.labName}</p>
                          <p className="text-xs text-ink-muted mt-0.5">
                            Ngày thử: {formatDateStandard(res.testDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {res.overallStatus !== 'PASS' && (
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
      {isSignReleaseOpen && batch && (
        <ESignatureModal
          isOpen={isSignReleaseOpen}
          onClose={() => setIsSignReleaseOpen(false)}
          documentType="BATCH_RELEASE"
          documentId={batch.id}
          documentTitle={`Lô sản xuất: ${batch.batchNo} - ${batch.product?.name || ''}`}
          documentVersion={batch.version}
          onSuccess={handleSignReleaseSuccess}
        />
      )}
    </div>
  );
};
export default BatchDetailPage;
