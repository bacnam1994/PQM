import React from 'react';
import { ListPlus, Trash2 } from 'lucide-react';

export interface ExtraCriterion {
  id: string;
  name: string;
  value: string;
  unit: string;
  limit: string;
}

export interface ExtraCriteriaSectionProps {
  extraCriteria: ExtraCriterion[];
  addToArray: (field: string, item: any) => void;
  updateInArray: (field: string, index: number, key: string, value: any) => void;
  removeFromArray: (field: string, index: number) => void;
}

export const ExtraCriteriaSection: React.FC<ExtraCriteriaSectionProps> = ({
  extraCriteria,
  addToArray,
  updateInArray,
  removeFromArray,
}) => {
  return (
    <div className="space-y-4 pt-4 border-t border-slate-100">
      <div className="flex justify-between items-center">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
          <ListPlus size={20} /> CHỈ TIÊU BỔ SUNG
        </h4>
        <button
          type="button"
          onClick={() =>
            addToArray('extraCriteria', {
              id: 'extra_' + Date.now(),
              name: '',
              value: '',
              unit: '',
              limit: '',
            })
          }
          className="text-[10px] font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 hover:text-indigo-600"
        >
          Thêm dòng
        </button>
      </div>
      {extraCriteria.map((item, idx) => (
        <div key={item.id} className="flex gap-2 items-start animate-in slide-in-from-left-2">
          <input
            placeholder="Tên chỉ tiêu"
            value={item.name}
            onChange={(e) => updateInArray('extraCriteria', idx, 'name', e.target.value)}
            className="flex-[2] px-3 py-2 bg-slate-50 border-none rounded-lg text-sm font-bold"
          />
          <input
            placeholder="Kết quả"
            value={item.value}
            onChange={(e) => updateInArray('extraCriteria', idx, 'value', e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-50 border-none rounded-lg text-sm font-black text-indigo-700"
          />
          <input
            placeholder="ĐVT"
            value={item.unit}
            onChange={(e) => updateInArray('extraCriteria', idx, 'unit', e.target.value)}
            className="w-16 px-3 py-2 bg-slate-50 border-none rounded-lg text-sm font-bold"
          />
          <button
            type="button"
            onClick={() => removeFromArray('extraCriteria', idx)}
            className="p-2 text-slate-300 hover:text-red-500"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
