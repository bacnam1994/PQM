import React from 'react';
import { ClockIcon, BeakerIcon, ShieldCheckIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
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
        <div className="p-8 text-center bg-surface-2 rounded-2xl border-2 border-dashed border-border">
          <ExclamationCircleIcon className="w-12 h-12 mx-auto text-ink-muted/50 mb-3" />
          <p className="text-sm font-semibold text-ink uppercase">Không tìm thấy hồ sơ TCCS hiệu lực!</p>
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
    <div className="space-y-6">
      <div className="flex flex-col gap-2 bg-surface-2 p-4 rounded-xl border border-border">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <ClockIcon className="w-4 h-4" /> TIÊU CHUẨN ÁP DỤNG
          </h4>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <select
            value={activeTCCS.id}
            onChange={(e) => setManualTccsId(e.target.value)}
            className="flex-1 bg-surface border border-border text-ink text-sm font-medium rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all cursor-pointer"
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
        icon={<BeakerIcon className="w-4 h-4" />}
        colorClass="text-emerald-600 dark:text-emerald-400"
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
          icon={<ShieldCheckIcon className="w-4 h-4" />}
          colorClass="text-emerald-600 dark:text-emerald-400"
          activeTCCS={activeTCCS}
          testResultsMap={testResultsMap}
          setMapValue={setMapValue}
          existingResultsForBatch={existingResultsForBatch}
          aiFilledFields={aiFilledFields}
        />
      )}

      {metal.length > 0 && (
        <CriteriaInputGroup
          title="Kim loại nặng & Độc tố"
          criteria={metal}
          icon={<ShieldCheckIcon className="w-4 h-4" />}
          colorClass="text-amber-600 dark:text-amber-400"
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
