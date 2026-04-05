import React, { useMemo, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { TestResultEntry } from '../types';
import { CheckCircle2, XCircle } from 'lucide-react';
import { ensureArray, formatScientific } from '../utils';

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

  const { tccs, historyData, extraData } = useMemo(() => {
    try {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return { tccs: null, historyData: [], extraData: [] };

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

    if (!activeTCCS) return { tccs: null, historyData: [], extraData: [] };

    // 2. Lấy danh sách kết quả của lô, sắp xếp mới nhất trước
    const batchResults = testResults
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
            const match = ensureArray(res.results).find(r => r && r.criteriaName === criterion.name);
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
            // Nếu không nằm trong danh sách chỉ tiêu của TCCS thì coi là Extra
            if (!r || !r.criteriaName) return;
            if (!tccsCriteria.some(c => c && c.name === r.criteriaName)) {
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
  }, [batchId, batches, testResults, tccsList]);

  if (!tccs) return <div className="p-4 text-center text-slate-500 italic">Chưa xác định được TCCS cho lô này.</div>;

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
    return (
      <div key={idx} className="flex items-center gap-3 text-xs bg-white border border-slate-100 p-2 rounded shadow-sm mb-1 last:mb-0">
          <div className={`shrink-0 ${entry.isPass ? 'text-emerald-500' : 'text-red-500'}`} title={entry.isPass ? 'Đạt' : 'Không đạt'}>
              {entry.isPass ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          </div>
          <div className="w-28 flex justify-end items-baseline gap-1">
              <span className="font-black text-slate-800">{formatScientific(entry.value)}</span>
              <span className="text-[10px] text-slate-500 font-medium truncate max-w-[40px]" title={displayUnit}>{displayUnit}</span>
          </div>
          <div className="flex-1 text-slate-500 text-[10px] flex items-center gap-1.5">
              <span className="font-bold text-indigo-600 truncate max-w-[120px]" title={entry.labName}>{entry.labName}</span>
              <span className="text-slate-300">•</span>
              <span>{new Date(entry.testDate).toLocaleDateString('en-GB')}</span>
          </div>
          {/* Hiển thị giới hạn nếu là chỉ tiêu Extra có limit riêng */}
          {(entry as any).limit && <div className="text-[9px] text-slate-400 hidden sm:block">(GH: {(entry as any).limit})</div>}
      </div>
    );
  };

  return (
    <div className="space-y-4 font-sans animate-in fade-in">
      <div className="bg-slate-50 px-3 py-2 rounded border border-slate-200 flex justify-between items-center">
        <span className="text-xs font-bold text-slate-500 uppercase">TCCS Áp dụng:</span>
        <span className="text-sm font-black text-indigo-700">{tccs.code}</span>
      </div>

      <div className="overflow-hidden border border-slate-200 rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 text-slate-500 font-bold uppercase border-b border-slate-200">
            <tr>
              <th className="py-2 px-4 text-left w-[35%]">Chỉ tiêu / Yêu cầu</th>
              <th className="py-2 px-4 text-left">Lịch sử kiểm nghiệm (Mới nhất → Cũ nhất)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {historyData.map(({ criterion, history }, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="py-2 px-4 align-top">
                  <p className="font-bold text-slate-700">{criterion.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{renderRequirement(criterion)}</p>
                  {history.length === 0 && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-400 rounded text-[9px] font-bold">Chưa kiểm</span>
                  )}
                </td>
                <td className="py-2 px-4 bg-slate-50/30">
                  {history.length > 0 ? (
                    <div className="py-1">
                      {history.map((entry, hIdx) => renderHistoryRow(entry, hIdx, criterion.unit))}
                    </div>
                  ) : (
                    <div className="py-2 text-center text-slate-300 italic">-</div>
                  )}
                </td>
              </tr>
            ))}
            
            {extraData.length > 0 && (
                 <tr>
                    <td colSpan={2} className="py-2 px-4 bg-slate-100 font-black text-slate-500 text-[10px] uppercase tracking-widest border-t border-slate-200">
                        Chỉ tiêu bổ sung (Ngoài TCCS)
                    </td>
                 </tr>
            )}

            {extraData.map(({ name, history }, idx) => (
               <tr key={`extra-${idx}`} className="hover:bg-slate-50">
                <td className="py-2 px-4 align-top">
                  <p className="font-bold text-slate-700">{name}</p>
                </td>
                <td className="py-2 px-4 bg-slate-50/30">
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