import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, FlaskConical, ClipboardCheck, Layers, Printer, CheckCircle2, X, AlertTriangle, ShieldAlert, Sparkles, GitBranch, FileWarning, FileText } from 'lucide-react';
import { useDataGraph } from '../../hooks/useDataGraph';
import { useAppStore } from '../../store/useAppStore';
import { formatDateStandard, ensureArray, parseNumberFromText } from '../../utils';
import { fetchTestResultsByBatchId } from '../../services/testResultService';
import { TestResult, Criterion, FormulaIngredient } from '../../types';
import { CircularProgress, BatchCriteriaHistory } from '../../components';
import { OOSInvestigationModal } from '../../components/features/OOSInvestigationModal';
import { AIBatchClearanceModal } from '../../components/features/AIBatchClearanceModal';
import { DeviationReportModal } from '../../components/features/DeviationReportModal';
import { BatchGenealogyModal } from '../../components/features/BatchGenealogyModal';
import { FileCheck2 } from 'lucide-react';

// Helper tính tiến độ lô
const calculateBatchProgress = (batch: any, batchResults: TestResult[]) => {
  const tccs = batch.tccs;
  const requiredCriteria = tccs ? [...ensureArray(tccs.mainQualityCriteria), ...ensureArray(tccs.safetyCriteria)].filter(c => c && c.name && c.name.trim() !== '') : [];
  if (requiredCriteria.length === 0) return { progressPercent: 0, missingCriteria: [], requiredCriteria: [] };

  const testedCriteriaNames = new Set<string>();
  const latestResultsMap = new Map<string, { value: any, isPass: boolean }>();
  if (batchResults.length > 0) {
    const sortedBatchResults = [...batchResults].filter(r => r.batchId === batch.id).sort((a, b) => {
      const dateCmp = a.testDate.localeCompare(b.testDate);
      return dateCmp !== 0 ? dateCmp : (a.createdAt || '').localeCompare(b.createdAt || '');
    });
    sortedBatchResults.forEach(r => ensureArray(r.results).forEach(res => {
      if (res && res.criteriaName) {
        testedCriteriaNames.add(res.criteriaName.trim().toLowerCase());
        latestResultsMap.set(res.criteriaName.trim().toLowerCase(), { value: res.value, isPass: res.isPass });
      }
    }));
  }
  const rulesMap = new Map<string, any>();
  if (tccs && tccs.alternateRules) tccs.alternateRules.forEach((r: any) => { if (r && r.alt) rulesMap.set(r.alt.trim().toLowerCase(), r); });

  const missingCriteria = requiredCriteria.filter(c => {
    const cName = c.name.trim().toLowerCase();
    if (testedCriteriaNames.has(cName)) return false;
    const rule = rulesMap.get(cName);
    if (rule) {
      const mainRes = latestResultsMap.get((rule.main || '').trim().toLowerCase());
      if (mainRes !== undefined) {
        if (rule.type === 'CONDITIONAL_CHECK') {
          const extractNum = (val: any) => {
            const str = String(val || '').trim().toUpperCase();
            if (['ND', 'KPH', 'K.P.H', 'KHÔNG PHÁT HIỆN', 'NOT DETECTED', 'ÂM TÍNH', 'NEGATIVE', 'KHÔNG CÓ'].some(kw => str.includes(kw))) return 0;
            const match = str.match(/[-+]?[0-9]*[.,]?[0-9]+/);
            return match ? Number(match[0].replace(',', '.')) : parseNumberFromText(str);
          };
          if (mainRes.isPass && extractNum(mainRes.value) <= extractNum(rule.conditionValue)) return false;
        } else {
          if (mainRes.isPass) return false;
        }
      }
    }
    return true;
  });

  return { progressPercent: Math.round(((requiredCriteria.length - missingCriteria.length) / requiredCriteria.length) * 100), missingCriteria, requiredCriteria };
};

const BatchDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { batches } = useDataGraph();
  const tccsList = useAppStore(state => state.tccsList);
  const productFormulas = useAppStore(state => (state as any).productFormulas || []);

  const [viewBatchResults, setViewBatchResults] = useState<TestResult[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistoryTable, setShowHistoryTable] = useState(false);
  const [isOOSOpen, setIsOOSOpen] = useState(false);
  const [oosModalData, setOosModalData] = useState<any>(null);
  const [isClearanceModalOpen, setIsClearanceModalOpen] = useState(false);
  const [isDeviationOpen, setIsDeviationOpen] = useState(false);
  const [deviationData, setDeviationData] = useState<any>(null);
  const [isGenealogyOpen, setIsGenealogyOpen] = useState(false);

  const batch = useMemo(() => batches.find(b => b.id === id), [batches, id]);

  const handleOpenOOS = (res?: TestResult) => {
    if (!batch) return;
    const targetResults = res ? ensureArray(res.results) : viewBatchResults.flatMap(r => ensureArray(r.results));
    const failedCriteria: { criteriaName: string; actualValue: string | number; specification: string; unit?: string }[] = [];
    const passedCriteria: { criteriaName: string; actualValue: string | number }[] = [];

    targetResults.forEach(item => {
      if (!item || !item.criteriaName) return;
      const cDef = allCriteriaMap.get(item.criteriaName.trim().toLowerCase());
      const reqText = cDef
        ? cDef.type === 'NUMBER'
          ? (cDef.min != null && cDef.max != null ? `${cDef.min} ~ ${cDef.max}` : cDef.min != null ? `≥ ${cDef.min}` : cDef.max != null ? `≤ ${cDef.max}` : '')
          : (cDef.expectedText || '')
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
      failedCriteria: failedCriteria.length > 0 ? failedCriteria : [{ criteriaName: 'Chỉ tiêu chất lượng', actualValue: 'Không đạt', specification: 'TCCS' }],
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
      [...ensureArray(tccs.mainQualityCriteria), ...ensureArray(tccs.safetyCriteria)]
        .forEach((c: Criterion) => c && c.name && criteriaMap.set(c.name.trim().toLowerCase(), c));
    }
    const formula = productFormulas.find((f: any) => f.productId === batch?.productId);
    const fMap = new Map<string, FormulaIngredient>();
    if (formula) {
      [...ensureArray(formula.ingredients), ...ensureArray(formula.excipients)]
        .forEach((ing: FormulaIngredient) => ing && ing.name && fMap.set(ing.name.trim().toLowerCase(), ing));
    }
    return { allCriteriaMap: criteriaMap, formulaItemMap: fMap };
  }, [batch, productFormulas]);

  // Helper: tính % hàm lượng cho 1 chỉ tiêu
  // - Chỉ tiêu trong TCCS mainQualityCriteria: dùng declaredContent TCCS hoặc công thức
  // - Chỉ tiêu ngoài TCCS nhưng tên khớp với thành phần công thức: vẫn tính % theo công thức
  const getContentPercent = (criteriaName: string, value: string | number): string | null => {
    const rName = criteriaName.trim().toLowerCase();
    const tccs = (batch as any)?.tccs;
    const isMainCriteria = ensureArray(tccs?.mainQualityCriteria).some((c: any) => c && c.name && c.name.trim().toLowerCase() === rName);

    const criterion = allCriteriaMap.get(rName);
    let basis: number | undefined;

    if (isMainCriteria) {
      // Chỉ tiêu trong TCCS: ưu tiên declaredContent khai báo trong TCCS
      if (criterion?.declaredContent != null) {
        basis = typeof criterion.declaredContent === 'string' ? parseNumberFromText(criterion.declaredContent as any) : criterion.declaredContent;
      } else {
        let formulaItem = formulaItemMap.get(rName);
        if (criterion?.formulaIngredientId) {
          const linked = formulaItemMap.get(criterion.formulaIngredientId.trim().toLowerCase());
          if (linked) formulaItem = linked;
        }
        if (!formulaItem) return null;

        let declaredContent: number | undefined = formulaItem.declaredContent;
        if (typeof declaredContent === 'string') declaredContent = parseNumberFromText(declaredContent as any);
        let elementalContent: number | undefined = formulaItem.elementalContent;
        if (typeof elementalContent === 'string') elementalContent = parseNumberFromText(elementalContent as any);

        if (criterion?.formulaIngredientId) {
          basis = criterion.calculationBasis === 'ELEMENTAL' && elementalContent && elementalContent > 0
            ? elementalContent : declaredContent;
        } else {
          basis = (elementalContent && elementalContent > 0) ? elementalContent : declaredContent;
        }
      }
    } else {
      // Chỉ tiêu ngoài TCCS: tìm theo tên trong công thức, nếu có thì vẫn tính %
      const formulaItem = formulaItemMap.get(rName);
      if (!formulaItem) return null;

      let declaredContent: number | undefined = formulaItem.declaredContent;
      if (typeof declaredContent === 'string') declaredContent = parseNumberFromText(declaredContent as any);
      let elementalContent: number | undefined = formulaItem.elementalContent;
      if (typeof elementalContent === 'string') elementalContent = parseNumberFromText(elementalContent as any);

      basis = (elementalContent && elementalContent > 0) ? elementalContent : declaredContent;
    }

    const actual = parseNumberFromText(String(value));
    if (!basis || basis <= 0 || !actual || actual <= 0) return null;
    const pct = (actual / basis) * 100;
    return pct.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '%';
  };

  useEffect(() => {
    if (id) {
      setIsLoadingHistory(true);
      fetchTestResultsByBatchId(id)
        .then(res => setViewBatchResults(res))
        .catch(err => console.error(err))
        .finally(() => setIsLoadingHistory(false));
    }
  }, [id]);

  if (!batch) return <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-bold bg-white dark:bg-slate-800 rounded-xl shadow-sm max-w-4xl mx-auto mt-8 border border-slate-100 dark:border-slate-700">Không tìm thấy thông tin Lô hàng hoặc dữ liệu đang tải...</div>;

  const { progressPercent, missingCriteria } = calculateBatchProgress(batch, viewBatchResults);

  return (
    <div className="p-6 max-w-5xl mx-auto animate-in fade-in duration-500 space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/batches')} className="p-2 bg-white dark:bg-slate-800 text-slate-500 hover:text-indigo-600 rounded-xl shadow-sm transition-all border border-slate-100 dark:border-slate-700">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Chi tiết Lô hàng</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsGenealogyOpen(true)}
            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl font-black shadow-sm border border-slate-200 dark:border-slate-700 transition-all uppercase text-xs w-fit"
          >
            <GitBranch size={16} /> Truy vết nguồn gốc
          </button>
          <button 
            type="button"
            onClick={() => setIsClearanceModalOpen(true)}
            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-black shadow-md shadow-indigo-200 dark:shadow-none transition-all uppercase text-xs w-fit"
          >
            <Sparkles size={16} /> Thẩm định Lô (AI)
          </button>
          <button onClick={() => navigate(`/test-results/coa/${batch.id}`)} className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-lg shadow-indigo-200 transition-all uppercase text-xs w-fit">
            <Printer size={16} /> In CoA Tổng hợp
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Sản phẩm</p>
              <h4 
                onClick={() => batch.productId && navigate(`/products/${batch.productId}`)}
                className="font-bold text-slate-800 dark:text-slate-100 text-base leading-tight mb-1 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                title="Nhấn để xem chi tiết hồ sơ sản phẩm"
              >
                {batch.product?.name}
              </h4>
              <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">{batch.product?.code}</p>
            </div>
            <div className="mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Số Lô</p>
              <h4 className="font-black text-slate-800 dark:text-slate-100 text-2xl">{batch.batchNo}</h4>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between"><span className="font-bold text-slate-500 dark:text-slate-400">NSX:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{formatDateStandard(batch.mfgDate)}</span></div>
              <div className="flex justify-between"><span className="font-bold text-slate-500 dark:text-slate-400">HSD:</span> <span className="font-bold text-red-600">{formatDateStandard(batch.expDate)}</span></div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                <span className="font-bold text-slate-500 dark:text-slate-400 block mb-1">Tiêu chuẩn áp dụng:</span>
                {(batch as any).tccs?.id ? (
                  <Link
                    to={`/tccs/detail/${(batch as any).tccs?.id}`}
                    className="font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-1 rounded inline-flex items-center gap-1 transition-colors"
                    title="Nhấn để xem chi tiết TCCS"
                  >
                    <FileText size={12} /> {(batch as any).tccs?.code || 'Không xác định'}
                  </Link>
                ) : (
                  <span className="font-bold text-slate-500 dark:text-slate-400">Không xác định</span>
                )}
              </div>

              {/* Link đến Công thức sản phẩm (nếu có) */}
              {(batch as any).formula && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                  <span className="font-bold text-slate-500 dark:text-slate-400 block mb-1">Công thức sản phẩm:</span>
                  <Link
                    to={`/product-formulas`}
                    className="font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 px-2 py-1 rounded inline-flex items-center gap-1 transition-colors text-[11px]"
                    title="Xem công thức sản phẩm"
                  >
                    <FlaskConical size={11} /> Xem công thức
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-4 mb-4">
              <CircularProgress progress={progressPercent} />
              <div>
                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><FlaskConical size={12} /> Tiến độ kiểm</h4>
                <p className="text-sm text-slate-700 dark:text-slate-200 font-bold mt-0.5">Hoàn thành {progressPercent}%</p>
              </div>
            </div>
            {missingCriteria.length > 0 ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 p-4 rounded-xl">
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1 mb-2"><AlertTriangle size={12} /> Còn thiếu {missingCriteria.length} chỉ tiêu:</p>
                <div className="flex flex-wrap gap-1.5">
                  {missingCriteria.map((c: any, idx: number) => <span key={idx} className="px-2 py-1 bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 text-[10px] font-bold rounded border border-amber-200 dark:border-amber-700">{c.name}</span>)}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/40 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Đã kiểm đủ tất cả chỉ tiêu.</span>
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex gap-2">
            <button onClick={() => setShowHistoryTable(false)} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${!showHistoryTable ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>Phiếu Kiểm Nghiệm ({viewBatchResults.length})</button>
            <button onClick={() => setShowHistoryTable(true)} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${showHistoryTable ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}><Layers size={14} /> Bảng Tổng hợp</button>
          </div>

          {showHistoryTable ? (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden"><BatchCriteriaHistory batchId={batch.id} /></div>
          ) : (
            <div className="space-y-4">
              {isLoadingHistory ? (
                <div className="p-10 text-center text-slate-500 dark:text-slate-400 italic text-sm flex justify-center items-center gap-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm"><Loader2 className="animate-spin" size={20} /> Đang tải dữ liệu kiểm nghiệm...</div>
              ) : viewBatchResults.length === 0 ? (
                <div className="p-10 text-center border border-slate-100 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 shadow-sm text-slate-400 dark:text-slate-500 italic text-sm">Chưa có kết quả kiểm nghiệm nào.</div>
              ) : (
                viewBatchResults.map(res => (
                  <div key={res.id} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                    <div className="bg-slate-50 dark:bg-slate-900/50 px-5 py-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${res.overallStatus === 'PASS' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>{res.overallStatus === 'PASS' ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>
                        <div><p className="text-sm font-bold text-slate-700 dark:text-slate-200">{res.labName}</p><p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{formatDateStandard(res.testDate)}</p></div>
                      </div>
                      <div className="flex items-center gap-2">
                        {res.overallStatus !== 'PASS' && (
                          <>
                            <button 
                              onClick={() => handleOpenOOS(res)} 
                              className="text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-3 py-2 rounded-lg shadow-sm hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all flex items-center gap-1.5 uppercase tracking-wider"
                            >
                              <ShieldAlert size={14} className="text-rose-500" /> Điều tra OOS (AI)
                            </button>
                            <button
                              onClick={() => {
                                const formula = productFormulas.find((f: any) => f.productId === batch.productId);
                                const failed = ensureArray(res.results).filter((r: any) => !r.isPass).map((r: any) => ({
                                  name: r.criteriaName,
                                  actualValue: r.value,
                                  unit: r.unit,
                                  specification: (() => { const c = allCriteriaMap.get(r.criteriaName?.toLowerCase()); return c ? c.type === 'NUMBER' ? (c.min != null && c.max != null ? `${c.min}~${c.max}` : c.min != null ? `≥${c.min}` : `≤${c.max}`) : (c.expectedText || '') : ''; })(),
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
                              className="text-[10px] font-black text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/60 px-3 py-2 rounded-lg shadow-sm hover:bg-orange-100 dark:hover:bg-orange-900/60 transition-all flex items-center gap-1.5 uppercase tracking-wider"
                            >
                              <FileWarning size={14} /> Deviation Report
                            </button>
                          </>
                        )}
                        <button onClick={() => navigate(`/test-results/print/${res.id}`)} className="text-[10px] font-black text-indigo-600 bg-white dark:bg-slate-700 border border-indigo-100 dark:border-slate-600 px-4 py-2.5 rounded-lg shadow-sm hover:bg-indigo-50 hover:border-indigo-200 transition-all flex items-center gap-2 uppercase tracking-widest"><Printer size={14} /> In Phiếu này</button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left"><thead className="bg-white dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 font-bold border-b border-slate-50 dark:border-slate-700"><tr><th className="px-5 py-3">Chỉ tiêu</th><th className="px-4 py-3 text-center">Mức Y/C</th><th className="px-5 py-3 text-right">Kết quả</th><th className="px-4 py-3 text-center">ĐVT</th><th className="px-4 py-3 text-center">Đánh giá</th></tr></thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                          {res.results.map((item, idx) => {
                            const pct = getContentPercent(item.criteriaName, item.value);
                            const cDef = allCriteriaMap.get(item.criteriaName.trim().toLowerCase());
                            const reqText = cDef
                              ? cDef.type === 'NUMBER'
                                ? (cDef.min != null && cDef.max != null ? `${cDef.min} ~ ${cDef.max}` : cDef.min != null ? `≥ ${cDef.min}` : cDef.max != null ? `≤ ${cDef.max}` : '')
                                : (cDef.expectedText || '')
                              : '';
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                                <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-300">{item.criteriaName}</td>
                                <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400 font-mono text-[10px] whitespace-nowrap">{reqText || '—'}</td>
                                <td className="px-5 py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                                  {item.value}
                                  {pct && <span className="block text-[10px] font-normal text-indigo-500 dark:text-indigo-400">({pct})</span>}
                                </td>
                                <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">{item.unit}</td>
                                <td className="px-4 py-3 text-center">{item.isPass ? <CheckCircle2 size={16} className="mx-auto text-emerald-500" /> : <X size={16} className="mx-auto text-red-500" />}</td>
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
    </div>
  );
};
export default BatchDetailPage;