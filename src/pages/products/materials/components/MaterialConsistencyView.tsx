import React from 'react';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  LinkIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
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
      <div className="bg-surface rounded-xl border border-border p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5 text-emerald-600" />
              <span>Trạng thái Toàn vẹn Liên kết Nguyên liệu</span>
            </h3>
            <p className="text-xs text-ink-muted mt-1">
              Rà soát 100% các thành phần trong công thức sản phẩm để đảm bảo đã được ánh xạ chuẩn vào Master Catalog.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {metrics.unlinkedIngredients === 0 ? '100%' : `${Math.max(0, 100 - metrics.unlinkedIngredients * 10)}%`}
              </div>
              <div className="text-[10px] font-semibold text-ink-muted uppercase">Điểm liên kết (Data Health)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Unlinked Items List */}
      <div className="bg-surface rounded-xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
            <span>Thành phần trong Công thức chưa liên kết ({metrics.unlinkedIngredients})</span>
          </h4>
        </div>

        {metrics.unlinkedIngredients === 0 ? (
          <div className="p-8 text-center bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
            <CheckCircleIcon className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
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
                <div key={unlinked.id} className="p-4 bg-surface-2 rounded-xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink text-sm">{unlinked.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        {unlinked.type === 'ACTIVE' ? 'Hoạt chất' : 'Tá dược'}
                      </span>
                    </div>
                    <div className="text-xs text-ink-muted mt-1 flex flex-wrap gap-1">
                      <span>Sử dụng trong:</span>
                      {unlinked.relatedProducts.map(p => (
                        <span key={p.id} className="font-medium text-ink-soft">{p.name} ({p.content}), </span>
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
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                        <span>Khớp với: "{suggested.name}" (1-Click Link)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenAdd(unlinked.name, unlinked.type)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
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
