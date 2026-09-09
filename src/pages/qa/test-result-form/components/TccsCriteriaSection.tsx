import React from 'react';
import { History, Beaker, ShieldCheck, AlertCircle } from 'lucide-react';
import { CriteriaInputGroup } from '../../../../components';
import { formatDateStandard } from '../../../../utils';
import { TCCS } from '../../../../types';

export interface TccsCriteriaSectionProps {
  activeTCCS: TCCS | null | undefined;
  batchId: string;
  availableTCCSList: TCCS[];
  setManualTccsId: (id: string) => void;
  testResultsMap: Record<string, string | number>;
  setMapValue: (field: string, key: string, value: any) => void;
  existingResultsForBatch: any[];
  aiFilledFields: Set<string>;
}

export const TccsCriteriaSection: React.FC<TccsCriteriaSectionProps> = ({
  activeTCCS,
  batchId,
  availableTCCSList,
  setManualTccsId,
  testResultsMap,
  setMapValue,
  existingResultsForBatch,
  aiFilledFields,
}) => {
  if (!activeTCCS) {
    if (batchId) {
      return (
        <div className="p-8 text-center bg-indigo-50/30 rounded-2xl border-4 border-dashed border-indigo-100">
          <AlertCircle size={48} className="mx-auto text-indigo-200 mb-4" />
          <p className="text-sm font-black text-indigo-800 uppercase">Không tìm thấy hồ sơ TCCS hiệu lực!</p>
        </div>
      );
    }
    return null;
  }

  const HEAVY_METAL_KEYWORDS = ['asen', 'chì', 'thủy ngân', 'cadmi'];
  const safety = activeTCCS.safetyCriteria || [];
  const micro = safety.filter(c => {
    if (!c) return false;
    const nameLower = (c.name || '').toLowerCase();
    if ((c as any).category === 'micro') return true;
    if (!(c as any).category && !HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
    return false;
  });
  const metal = safety.filter(c => {
    if (!c) return false;
    const nameLower = (c.name || '').toLowerCase();
    if ((c as any).category === 'metal') return true;
    if (!(c as any).category && HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
    return false;
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-black text-indigo-600 uppercase tracking-[0.3em] flex items-center gap-2">
            <History size={20} /> TIÊU CHUẨN ÁP DỤNG
          </h4>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <select
            value={activeTCCS.id}
            onChange={(e) => setManualTccsId(e.target.value)}
            className="flex-1 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {availableTCCSList.map(t => (
              <option key={t.id} value={t.id}>
                {t.code} (Ban hành: {formatDateStandard(t.issueDate)})
              </option>
            ))}
          </select>
        </div>
      </div>

      <CriteriaInputGroup
        title="Lý hóa & Cảm quan"
        criteria={activeTCCS.mainQualityCriteria || []}
        icon={<Beaker size={16} />}
        colorClass="text-indigo-600"
        activeTCCS={activeTCCS}
        testResultsMap={testResultsMap}
        setMapValue={setMapValue}
        existingResultsForBatch={existingResultsForBatch}
        aiFilledFields={aiFilledFields}
      />

      {micro.length > 0 && (
        <CriteriaInputGroup
          title="Giới hạn Vi sinh vật"
          criteria={micro}
          icon={<ShieldCheck size={16} />}
          colorClass="text-emerald-600"
          activeTCCS={activeTCCS}
          testResultsMap={testResultsMap}
          setMapValue={setMapValue}
          existingResultsForBatch={existingResultsForBatch}
          aiFilledFields={aiFilledFields}
        />
      )}

      {metal.length > 0 && (
        <CriteriaInputGroup
          title="Giới hạn Kim loại nặng"
          criteria={metal}
          icon={<ShieldCheck size={16} />}
          colorClass="text-red-600"
          activeTCCS={activeTCCS}
          testResultsMap={testResultsMap}
          setMapValue={setMapValue}
          existingResultsForBatch={existingResultsForBatch}
          aiFilledFields={aiFilledFields}
        />
      )}
    </div>
  );
};
