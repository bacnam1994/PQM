import React, { useMemo, useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { TestResultEntry, TestResult, Criterion, FormulaIngredient } from '../../types';
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { ensureArray, formatScientific, getFromCache, parseNumberFromText, formatDateStandard, getActiveLocale } from '../../utils';
import { ref, query, orderByChild, equalTo, get } from 'firebase/database';
import { db } from '../../firebase';
import { useCriteriaResolver } from '../../hooks/useCriteriaResolver';
import { normalizeName } from '../../services/criteriaAliasService';

interface BatchCriteriaHistoryProps {
  batchId: string;
}

interface HistoryEntry extends TestResultEntry {
  testDate: string;
  labName: string;
  resId: string;
}

const BatchCriteriaHistory: React.FC<BatchCriteriaHistoryProps> = ({ batchId }) => {
  const batches = useAppStore(state => state.batches);
  const tccsList = useAppStore(state => state.tccsList);
  const testResults = useAppStore(state => state.testResults);
  const allTestResults = useAppStore(state => (state as any).allTestResults) as TestResult[] || [];
  const productFormulas = useAppStore(state => (state as any).productFormulas || []);

  const [isLoading, setIsLoading] = useState(true);

  // Targeted Fetching: Lấy dữ liệu chủ đích cho lô này ngay khi component được mount
  useEffect(() => {
    let isMounted = true;
    const fetchHistoryForBatch = async () => {
      setIsLoading(true);
      if (!batchId) {
        if (isMounted) setIsLoading(false);
        return;
      }
      try {
        let fbResults: TestResult[] = [];
        let localResults: TestResult[] = [];

        try {
          const testResultsRef = ref(db, 'testResults');
          const batchQuery = query(testResultsRef, orderByChild('batchId'), equalTo(batchId));
          const snapshot = await get(batchQuery);
          if (snapshot.exists()) {
            fbResults = Object.values(snapshot.val()) as TestResult[];
          }
        } catch (error) { console.warn("Lỗi tải PKN từ DB:", error); }

        try {
          const cached = await getFromCache('testResults');
          if (cached && Array.isArray(cached)) {
            localResults = cached.filter((r: any) => r.batchId === batchId);
          }
        } catch (error) { console.warn("Lỗi tải PKN từ Cache:", error); }

        if (!isMounted) return;

        const merged = new Map<string, TestResult>();
        [...localResults, ...fbResults].forEach(r => merged.set(r.id, r));
        const finalResults = Array.from(merged.values());

        // Bơm dữ liệu vào Global Store
        const mergeTestResults = (useAppStore.getState() as any).mergeTestResults;
        if (mergeTestResults && finalResults.length > 0) {
          mergeTestResults(finalResults);
        }
      } catch (error) {
        console.error("Lỗi lấy dữ liệu chủ đích:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchHistoryForBatch();
    return () => { isMounted = false; };
  }, [batchId]);

  const { activeTCCS, batch } = useMemo(() => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return { activeTCCS: null, batch: null };

    // 1. Xác định TCCS đang áp dụng
    let activeTCCS = tccsList.find(t => t.id === batch.tccsId);
    
    // Fallback logic: Nếu lô cũ chưa có tccsId, tìm theo ngày sản xuất
    if (!activeTCCS) {
        const productTccs = tccsList.filter(t => t.productId === batch.productId)
            .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
        
        if (productTccs.length > 0) {
            if (batch.mfgDate) {
                 const mfgTime = new Date(batch.mfgDate).getTime();
                 activeTCCS = productTccs.find(t => new Date(t.issueDate).getTime() <= mfgTime) || productTccs[productTccs.length - 1];
            } else {
                 activeTCCS = productTccs[0];
            }
        }
    }

    return { activeTCCS, batch };
  }, [batchId, batches, tccsList]);

  // Khởi tạo resolver cho TCCS của lô
  const resolver = useCriteriaResolver(activeTCCS ?? undefined);

  const { tccs, historyData, extraData } = useMemo(() => {
    try {
      if (!batch || !activeTCCS) return { tccs: null, historyData: [], extraData: [] };

    // 2. Lấy danh sách kết quả của lô, sắp xếp mới nhất trước
    // Ưu tiên dùng allTestResults (nơi chứa dữ liệu vừa được fetch)
    const sourceResults = (allTestResults && allTestResults.length > 0) ? allTestResults : testResults;
    const batchResults = sourceResults
        .filter(r => r.batchId === batchId)
        .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime());

    // 3. Gom nhóm theo chỉ tiêu trong TCCS
    const tccsCriteria = [
        ...(ensureArray(activeTCCS.mainQualityCriteria) || []), 
        ...(ensureArray(activeTCCS.safetyCriteria) || [])
    ].filter(c => c && c.name);

    const groupedData = tccsCriteria.map(criterion => {
        const history: HistoryEntry[] = [];
        
        batchResults.forEach(res => {
            // [ALIAS FIX] Dùng resolver.isMatch thay vì exact string compare
            const match = ensureArray(res.results).find(r => r && resolver.isMatch(r.criteriaName, criterion.name));
            if (match) {
                history.push({
                    ...match,
                    testDate: res.testDate,
                    labName: res.labName,
                    resId: res.id
                });
            }
        });

        return {
            criterion,
            history
        };
    });

    // 4. Gom nhóm chỉ tiêu Ngoài TCCS (Extra) - Nếu có
    const extraMap = new Map<string, HistoryEntry[]>();
    batchResults.forEach(res => {
        ensureArray(res.results).forEach(r => {
            // Nếu không nằm trong danh sách chỉ tiêu của TCCS (kể cả qua Alias) thì coi là Extra
            if (!r || !r.criteriaName) return;
            const isMatchedInTCCS = tccsCriteria.some(c => c && resolver.isMatch(r.criteriaName, c.name));
            if (!isMatchedInTCCS) {
                 if (!extraMap.has(r.criteriaName)) extraMap.set(r.criteriaName, []);
                 extraMap.get(r.criteriaName)?.push({
                    ...r,
                    testDate: res.testDate,
                    labName: res.labName,
                    resId: res.id
                 });
            }
        });
    });

    const extraDataList = Array.from(extraMap.entries()).map(([name, history]) => ({
        name,
        history
    }));

    return { tccs: activeTCCS, historyData: groupedData, extraData: extraDataList };
    } catch (err) {
      console.error("Lỗi kết xuất Lịch sử Tổng hợp:", err);
      return { tccs: null, historyData: [], extraData: [] };
    }
  }, [batchId, batch, activeTCCS, testResults, allTestResults, resolver]);

  // Build formula lookup maps cho % hàm lượng
  const { allCriteriaMap, formulaItemMap } = useMemo(() => {
    const batch = batches.find(b => b.id === batchId);
    const criteriaMap = new Map<string, Criterion>();
    if (tccs) {
      [...ensureArray(tccs.mainQualityCriteria), ...ensureArray(tccs.safetyCriteria)]
        .forEach((c: Criterion) => c && c.name && criteriaMap.set(c.name.trim().toLowerCase(), c));
    }
    const formula = batch ? productFormulas.find((f: any) => f.productId === batch.productId) : null;
    const fMap = new Map<string, FormulaIngredient>();
    if (formula) {
      [...ensureArray(formula.ingredients), ...ensureArray(formula.excipients)]
        .forEach((ing: FormulaIngredient) => ing && ing.name && fMap.set(ing.name.trim().toLowerCase(), ing));
    }
    return { allCriteriaMap: criteriaMap, formulaItemMap: fMap };
  }, [batchId, batches, tccs, productFormulas]);

  // Helper: tính % hàm lượng
  // - Chỉ tiêu trong TCCS mainQualityCriteria: dùng declaredContent TCCS hoặc công thức
  // - Chỉ tiêu ngoài TCCS nhưng tên khớp với thành phần công thức: vẫn tính %
  const getContentPercent = (criteriaName: string, value: string | number): string | null => {
    // [ALIAS FIX] Resolve criteriaName sang tên chuẩn trước khi tra cứu
    const resolvedName = resolver.resolve(criteriaName);
    const rName = normalizeName(resolvedName);
    const isMainCriteria = ensureArray(tccs?.mainQualityCriteria).some((c: any) => c && c.name && normalizeName(c.name) === rName);

    const criterion = resolver.lookupCriterion(criteriaName, allCriteriaMap);
    let basis: number | undefined;

    if (isMainCriteria) {
      // Chỉ tiêu trong TCCS: ưu tiên declaredContent khai báo trong TCCS
      if (criterion?.declaredContent != null) {
        basis = typeof criterion.declaredContent === 'string' ? parseNumberFromText(criterion.declaredContent as any) : criterion.declaredContent;
      } else {
        let formulaItem = formulaItemMap.get(rName) || formulaItemMap.get(normalizeName(criteriaName));
        if (criterion?.formulaIngredientId) {
          const linked = formulaItemMap.get(normalizeName(criterion.formulaIngredientId));
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
    return pct.toLocaleString(getActiveLocale(), { maximumFractionDigits: 2 }) + '%';
  };

  if (isLoading) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center space-y-3 text-ink-muted bg-surface-2 rounded-xl border border-border">
        <ArrowPathIcon className="w-7 h-7 animate-spin text-emerald-600 dark:text-emerald-400" />
        <span className="text-sm font-medium">Đang tải chi tiết lịch sử kiểm nghiệm...</span>
      </div>
    );
  }

  if (!tccs) return <div className="p-4 text-center text-ink-muted italic">Chưa xác định được TCCS cho lô này.</div>;

  // Helper hiển thị yêu cầu kỹ thuật
  const renderRequirement = (c: any) => {
      if (c.type === 'NUMBER') {
          if (c.min != null && c.max != null) return `${c.min} ~ ${c.max} ${c.unit || ''}`;
          if (c.min != null) return `≥ ${c.min} ${c.unit || ''}`;
          if (c.max != null) return `≤ ${c.max} ${c.unit || ''}`;
      }
      return c.expectedText ? `${c.expectedText} ${c.unit && !String(c.expectedText).includes(c.unit) ? c.unit : ''}`.trim() : '';
  };

  // Helper render dòng lịch sử
  const renderHistoryRow = (entry: HistoryEntry, idx: number, tccsUnit?: string) => {
    const displayUnit = tccsUnit || entry.unit || '';
    const pct = getContentPercent(entry.criteriaName, entry.value);
    return (
      <div key={idx} className="flex items-center gap-3 text-xs bg-surface border border-border p-2.5 rounded-lg shadow-sm mb-1 last:mb-0">
          <div className={`shrink-0 ${entry.isPass ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`} title={entry.isPass ? 'Đạt' : 'Không đạt'}>
              {entry.isPass ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
          </div>
          <div className="w-28 flex flex-col items-end">
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-ink">{formatScientific(entry.value)}</span>
                <span className="text-[10px] text-ink-muted font-medium truncate max-w-[40px]" title={displayUnit}>{displayUnit}</span>
              </div>
              {pct && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">({pct})</span>}
          </div>
          <div className="flex-1 text-ink-muted text-[10px] flex items-center gap-1.5">
              <span className="font-bold text-emerald-700 dark:text-emerald-300 truncate max-w-[120px]" title={entry.labName}>{entry.labName}</span>
              <span className="text-ink-muted/40">•</span>
              <span>{formatDateStandard(entry.testDate)}</span>
          </div>
          {/* Hiển thị giới hạn nếu là chỉ tiêu Extra có limit riêng */}
          {(entry as any).limit && <div className="text-[9px] text-ink-muted hidden sm:block">(GH: {(entry as any).limit})</div>}
      </div>
    );
  };

  return (
    <div className="space-y-4 font-sans animate-in fade-in">
      <div className="bg-surface-2 px-3.5 py-2.5 rounded-xl border border-border flex justify-between items-center">
        <span className="text-xs font-bold text-ink-muted uppercase">TCCS Áp dụng:</span>
        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{tccs.code}</span>
      </div>

      <div className="overflow-hidden border border-border rounded-xl bg-surface">
        <table className="w-full text-xs">
          <thead className="bg-surface-2 text-ink-muted font-bold uppercase border-b border-border">
            <tr>
              <th className="py-2.5 px-4 text-left w-[35%]">Chỉ tiêu / Yêu cầu</th>
              <th className="py-2.5 px-4 text-left">Lịch sử kiểm nghiệm (Mới nhất → Cũ nhất)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {historyData.map(({ criterion, history }, idx) => (
              <tr key={idx} className="hover:bg-surface-2/50 transition-colors">
                <td className="py-2.5 px-4 align-top">
                  <p className="font-bold text-ink">{criterion.name}</p>
                  <p className="text-[10px] text-ink-muted mt-0.5">{renderRequirement(criterion)}</p>
                  {history.length === 0 && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-surface-2 text-ink-muted rounded text-[9px] font-bold">Chưa kiểm</span>
                  )}
                </td>
                <td className="py-2.5 px-4 bg-surface-2/20">
                  {history.length > 0 ? (
                    <div className="py-1">
                      {history.map((entry, hIdx) => renderHistoryRow(entry, hIdx, criterion.unit))}
                    </div>
                  ) : (
                    <div className="py-2 text-center text-ink-muted/40 italic">-</div>
                  )}
                </td>
              </tr>
            ))}
            
            {extraData.length > 0 && (
                 <tr>
                    <td colSpan={2} className="py-2.5 px-4 bg-surface-2 font-black text-ink-muted text-[10px] uppercase tracking-widest border-t border-border">
                        Chỉ tiêu bổ sung (Ngoài TCCS)
                    </td>
                 </tr>
            )}

            {extraData.map(({ name, history }, idx) => (
               <tr key={`extra-${idx}`} className="hover:bg-surface-2/50 transition-colors">
                <td className="py-2.5 px-4 align-top">
                  <p className="font-bold text-ink">{name}</p>
                </td>
                <td className="py-2.5 px-4 bg-surface-2/20">
                    <div className="py-1">
                      {history.map((entry, hIdx) => renderHistoryRow(entry, hIdx, entry.unit))}
                    </div>
                </td>
               </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BatchCriteriaHistory;