import React from 'react';
import { ShieldCheck, Unlink, CheckCircle2, Link2, Plus } from 'lucide-react';
import { RawMaterial } from '../../../../types';
import { AggregatedFormulaItem } from '../types';

interface MaterialConsistencyViewProps {
  metrics: {
    unlinkedIngredients: number;
  };
  aggregatedFormulaItems: AggregatedFormulaItem[];
  materialMap: Map<string, RawMaterial>;
  rawMaterials: RawMaterial[];
  onAutoLink: (formulaId: string, ingredientName: string, targetMaterialId: string, isIngredient: boolean) => void;
  onOpenAdd: (name: string, type: 'ACTIVE' | 'EXCIPIENT') => void;
}

export const MaterialConsistencyView: React.FC<MaterialConsistencyViewProps> = ({
  metrics,
  aggregatedFormulaItems,
  materialMap,
  rawMaterials,
  onAutoLink,
  onOpenAdd
}) => {
  return (
    <div className="space-y-6">
      {/* Consistency Overview Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              <ShieldCheck size={20} className="text-indigo-600" />
              <span>Trạng thái Toàn vẹn Liên kết Nguyên liệu</span>
            </h3>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
              Rà soát 100% các thành phần trong công thức sản phẩm để đảm bảo đã được ánh xạ chuẩn vào Master Catalog.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {metrics.unlinkedIngredients === 0 ? '100%' : `${Math.max(0, 100 - metrics.unlinkedIngredients * 10)}%`}
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Điểm liên kết (Data Health)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Unlinked Items List */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black text-slate-700 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
            <Unlink size={16} className="text-amber-500" />
            <span>Thành phần trong Công thức chưa liên kết ({metrics.unlinkedIngredients})</span>
          </h4>
        </div>

        {metrics.unlinkedIngredients === 0 ? (
          <div className="p-8 text-center bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
            <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
            <p className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">Tuyệt vời! 100% thành phần công thức đã được liên kết chuẩn xác.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {aggregatedFormulaItems.filter(i => !i.materialId || !materialMap.has(i.materialId)).map(unlinked => {
              const suggested = rawMaterials.find(m => 
                m.name.toLowerCase() === unlinked.name.toLowerCase() ||
                (m.aliases && m.aliases.some(a => a.toLowerCase() === unlinked.name.toLowerCase()))
              );

              return (
                <div key={unlinked.id} className="p-4 bg-slate-50 dark:bg-zinc-850 rounded-xl border border-slate-200/80 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-zinc-100 text-sm">{unlinked.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                        {unlinked.type === 'ACTIVE' ? 'Hoạt chất' : 'Tá dược'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 dark:text-zinc-500 mt-1 flex flex-wrap gap-1">
                      <span>Sử dụng trong:</span>
                      {unlinked.relatedProducts.map(p => (
                        <span key={p.id} className="font-bold text-slate-600 dark:text-zinc-300">{p.name} ({p.content}), </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {suggested ? (
                      <button
                        type="button"
                        onClick={() => {
                          unlinked.relatedProducts.forEach(p => {
                            onAutoLink(p.formulaId, unlinked.name, suggested.id, unlinked.type === 'ACTIVE');
                          });
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      >
                        <Link2 size={13} />
                        <span>Khớp với: "{suggested.name}" (1-Click Link)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenAdd(unlinked.name, unlinked.type)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>+ Thêm mới vào Master Catalog</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
