import React from 'react';
import { Link } from 'react-router-dom';
import {
  LinkIcon,
  ExclamationCircleIcon,
  CubeIcon,
  PlusIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
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
      <thead className="bg-surface-2 border-b border-border">
        <tr className="text-ink-soft text-[10px] font-bold uppercase tracking-wider">
          <th className="px-4 py-3 text-left">Tên thành phần trong Công thức</th>
          <th className="px-4 py-3 text-left">Phân loại</th>
          <th className="px-4 py-3 text-left">Trạng thái Master Catalog</th>
          <th className="px-4 py-3 text-left">Sản phẩm & Hàm lượng áp dụng</th>
          <th className="px-4 py-3 text-right">Hành động</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {paginatedItems.map(item => {
          const isLinked = !!item.materialId && materialMap.has(item.materialId);
          const master = item.linkedMaterial;

          return (
            <tr key={item.id} className="hover:bg-surface-2 transition-colors">
              <td className="px-4 py-3.5 font-semibold text-ink text-sm">
                {item.name}
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap">
                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                  item.type === 'ACTIVE' 
                    ? 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400' 
                    : 'bg-surface-2 text-ink-soft border border-border'
                }`}>
                  {item.type === 'ACTIVE' ? 'Hoạt chất' : 'Tá dược'}
                </span>
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap">
                {isLinked && master ? (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 px-2.5 py-1 rounded-md w-fit">
                    <LinkIcon className="h-3.5 w-3.5" />
                    <span>{master.name}</span>
                    {master.code && <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-300">({master.code})</span>}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-2.5 py-1 rounded-md w-fit">
                    <ExclamationCircleIcon className="h-3.5 w-3.5" />
                    <span>Chưa liên kết Master Catalog</span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3.5">
                <div className="flex flex-wrap gap-1.5 items-center">
                  {item.relatedProducts.map(p => (
                    <Link
                      key={p.id}
                      to={`/products/${p.id}`}
                      className="inline-flex items-center gap-1 bg-surface border border-border px-2.5 py-1 rounded-md text-xs font-semibold text-ink hover:border-emerald-400 transition-colors shadow-sm"
                    >
                      <CubeIcon className="h-3.5 w-3.5 text-emerald-500" />
                      <span>{p.name}</span>
                      {p.content && <span className="text-[11px] font-mono text-ink-muted">({p.content})</span>}
                    </Link>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3.5 text-right whitespace-nowrap">
                {!isLinked && isAdmin ? (
                  <button
                    type="button"
                    onClick={() => onOpenAdd(item.name, item.type)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-400 rounded-md text-xs font-semibold transition-all border border-emerald-200 dark:border-emerald-900/50"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    <span>+ Thêm vào Master</span>
                  </button>
                ) : isLinked && master && isAdmin ? (
                  <button
                    type="button"
                    onClick={() => onOpenEdit(master)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-ink-soft hover:text-emerald-600 text-xs font-semibold rounded-md hover:bg-surface-2 transition-colors"
                  >
                    <PencilSquareIcon className="h-3.5 w-3.5" />
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
