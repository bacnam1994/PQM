import React from 'react';
import { Link } from 'react-router-dom';
import { Link2, Unlink, Package, Plus, Edit2 } from 'lucide-react';
import { DSTable } from '../../../../components';
import { RawMaterial } from '../../../../types';
import { AggregatedFormulaItem } from '../types';

interface MaterialMatrixTableProps {
  paginatedItems: AggregatedFormulaItem[];
  materialMap: Map<string, RawMaterial>;
  isAdmin: boolean;
  onOpenAdd: (name: string, type: 'ACTIVE' | 'EXCIPIENT') => void;
  onOpenEdit: (material: RawMaterial) => void;
}

export const MaterialMatrixTable: React.FC<MaterialMatrixTableProps> = ({
  paginatedItems,
  materialMap,
  isAdmin,
  onOpenAdd,
  onOpenEdit
}) => {
  return (
    <DSTable>
      <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800/80">
        <tr className="text-slate-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest">
          <th className="px-4 py-3">Tên thành phần trong Công thức</th>
          <th className="px-4 py-3">Phân loại</th>
          <th className="px-4 py-3">Trạng thái Master Catalog</th>
          <th className="px-4 py-3">Sản phẩm & Hàm lượng áp dụng</th>
          <th className="px-4 py-3 text-right">Hành động</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
        {paginatedItems.map(item => {
          const isLinked = !!item.materialId && materialMap.has(item.materialId);
          const master = item.linkedMaterial;

          return (
            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition-colors">
              <td className="px-4 py-3 font-bold text-slate-800 dark:text-zinc-100 text-sm">
                {item.name}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  item.type === 'ACTIVE' 
                    ? 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/40 dark:text-rose-400' 
                    : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300'
                }`}>
                  {item.type === 'ACTIVE' ? 'Hoạt chất' : 'Tá dược'}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {isLinked && master ? (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 px-2.5 py-1 rounded-lg w-fit">
                    <Link2 size={13} />
                    <span>{master.name}</span>
                    {master.code && <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300">({master.code})</span>}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-2.5 py-1 rounded-lg w-fit">
                    <Unlink size={13} />
                    <span>Chưa liên kết Master Catalog</span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5 items-center">
                  {item.relatedProducts.map(p => (
                    <Link
                      key={p.id}
                      to={`/products/${p.id}`}
                      className="inline-flex items-center gap-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:border-indigo-300 transition-colors shadow-2xs"
                    >
                      <Package size={12} className="text-indigo-500" />
                      <span>{p.name}</span>
                      {p.content && <span className="text-[11px] font-mono text-slate-400">({p.content})</span>}
                    </Link>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                {!isLinked && isAdmin ? (
                  <button
                    type="button"
                    onClick={() => onOpenAdd(item.name, item.type)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold transition-all border border-indigo-200 dark:border-indigo-900"
                  >
                    <Plus size={13} />
                    <span>+ Thêm vào Master Catalog</span>
                  </button>
                ) : isLinked && master && isAdmin ? (
                  <button
                    type="button"
                    onClick={() => onOpenEdit(master)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-500 hover:text-indigo-600 dark:text-zinc-400 text-xs font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Edit2 size={13} />
                    <span>Sửa Master</span>
                  </button>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </DSTable>
  );
};
