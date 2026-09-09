import React from 'react';
import { Link } from 'react-router-dom';
import {
  HashtagIcon,
  ShieldCheckIcon,
  Square3Stack3DIcon,
  CubeIcon,
  PencilSquareIcon,
  TrashIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';
import { DSCard, DSTable, ActionButtons } from '../../../../components';
import { RawMaterial } from '../../../../types';

interface MaterialCatalogTableProps {
  viewMode: 'grid' | 'list';
  paginatedItems: RawMaterial[];
  hydratedMap: Map<string, any>;
  isAdmin: boolean;
  onEdit: (material: RawMaterial) => void;
  onDelete: (material: RawMaterial) => void;
  filteredCatalogLength: number;
}

export const MaterialCatalogTable: React.FC<MaterialCatalogTableProps> = ({
  viewMode,
  paginatedItems,
  hydratedMap,
  isAdmin,
  onEdit,
  onDelete,
  filteredCatalogLength
}) => {
  return (
    <>
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedItems.map(material => {
            const hydrated = hydratedMap.get(material.id);
            const usedProducts = hydrated?.usedInProducts || [];

            return (
              <DSCard key={material.id} className="p-5 flex flex-col justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-200 group relative overflow-hidden bg-surface border border-border">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-ink-muted">
                      <HashtagIcon className="h-3.5 w-3.5 text-emerald-500" />
                      <span>{material.code || 'MÃ: CHƯA GÁN'}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      material.category === 'ACTIVE' 
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50' 
                        : material.category === 'EXCIPIENT' 
                          ? 'bg-surface-2 text-ink-soft border border-border' 
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
                    }`}>
                      {material.category === 'ACTIVE' ? 'Hoạt chất' : material.category === 'EXCIPIENT' ? 'Tá dược' : 'Khác'}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-ink group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">
                    {material.name}
                  </h3>

                  {material.description && (
                    <p className="text-xs text-ink-muted mt-1 line-clamp-2 leading-relaxed">
                      {material.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {material.standard && (
                      <span className="inline-flex items-center gap-1 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-900/50 px-2 py-0.5 rounded text-[10px] font-semibold">
                        <ShieldCheckIcon className="h-3 w-3" />
                        {material.standard}
                      </span>
                    )}
                    {material.casNumber && (
                      <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
                        CAS: {material.casNumber}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-border/60">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1.5 flex items-center gap-1">
                      <Square3Stack3DIcon className="h-3 w-3" />
                      <span>Tên gọi khác ({material.aliases?.length || 0})</span>
                    </div>
                    {material.aliases && material.aliases.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {material.aliases.slice(0, 3).map((al, aIdx) => (
                          <span key={aIdx} className="bg-surface-2 text-ink-soft border border-border px-2 py-0.5 rounded text-[10px] font-medium">
                            {al}
                          </span>
                        ))}
                        {material.aliases.length > 3 && (
                          <span className="bg-surface-3 text-ink-muted px-1.5 py-0.5 rounded text-[10px] font-semibold">
                            +{material.aliases.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-ink-muted italic">Chưa có alias</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {usedProducts.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 px-2 py-0.5 rounded-md">
                        <CubeIcon className="h-3 w-3" />
                        {usedProducts.length} sản phẩm
                      </span>
                    ) : (
                      <span className="text-[11px] text-ink-muted italic">
                        Chưa dùng
                      </span>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(material)}
                        className="p-1.5 text-ink-muted hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-surface-2 rounded-lg transition-colors"
                        title="Chỉnh sửa"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(material)}
                        className="p-1.5 text-ink-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                        title="Xóa nguyên liệu"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </DSCard>
            );
          })}
        </div>
      ) : (
        <DSTable>
          <thead className="bg-surface-2 border-b border-border">
            <tr className="text-ink-soft text-[10px] font-bold uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Mã NL</th>
              <th className="px-4 py-3 text-left">Tên Nguyên liệu Chuẩn</th>
              <th className="px-4 py-3 text-left">Tiêu chuẩn & CAS</th>
              <th className="px-4 py-3 text-left">Các tên gọi khác (Aliases)</th>
              <th className="px-4 py-3 text-center">Phân loại</th>
              <th className="px-4 py-3 text-left">Sản phẩm đang dùng</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedItems.map(material => {
              const hydrated = hydratedMap.get(material.id);
              const usedProducts = hydrated?.usedInProducts || [];

              return (
                <tr key={material.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3.5 font-mono font-semibold text-xs text-ink whitespace-nowrap">
                    {material.code || <span className="text-ink-muted font-normal italic">Chưa gán</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-ink text-sm">{material.name}</div>
                    {material.description && (
                      <p className="text-[11px] text-ink-muted mt-0.5 line-clamp-1">{material.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="space-y-1">
                      {material.standard && (
                        <span className="inline-block bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-900/50 px-2 py-0.5 rounded text-[10px] font-semibold">
                          {material.standard}
                        </span>
                      )}
                      {material.casNumber && (
                        <div className="text-[10px] font-mono text-ink-muted">CAS: {material.casNumber}</div>
                      )}
                      {!material.standard && !material.casNumber && (
                        <span className="text-[10px] text-ink-muted italic">---</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {material.aliases && material.aliases.length > 0 ? (
                      <div className="flex flex-wrap gap-1 items-center">
                        {material.aliases.map((al, aIdx) => (
                          <span key={aIdx} className="bg-surface-2 text-ink-soft border border-border px-2 py-0.5 rounded text-[11px] font-medium">
                            {al}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-ink-muted text-xs italic">Chưa có alias</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      material.category === 'ACTIVE' ? 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400' :
                      material.category === 'EXCIPIENT' ? 'bg-surface-2 text-ink-soft border border-border' :
                      'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                    }`}>
                      {material.category === 'ACTIVE' ? 'Hoạt chất' : material.category === 'EXCIPIENT' ? 'Tá dược' : 'Khác'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {usedProducts.length > 0 ? (
                      <div className="flex flex-wrap gap-1 items-center">
                        {usedProducts.map(p => (
                          <Link 
                            key={p.id} 
                            to={`/products/${p.id}`}
                            className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40"
                          >
                            <CubeIcon className="h-3 w-3" />
                            {p.name}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-ink-muted italic">Chưa sử dụng</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <ActionButtons 
                      onEdit={() => onEdit(material)} 
                      onDelete={() => onDelete(material)} 
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DSTable>
      )}

      {filteredCatalogLength === 0 && (
        <div className="p-12 text-center bg-surface rounded-xl border border-border">
          <IdentificationIcon className="h-10 w-10 mx-auto text-ink-muted mb-3 opacity-40" />
          <p className="text-ink font-bold text-sm">Không tìm thấy nguyên liệu nào phù hợp.</p>
          <p className="text-xs text-ink-muted mt-1">Hãy thử thay đổi từ khóa tìm kiếm hoặc bấm nút "Thêm Nguyên liệu" để tạo mới.</p>
        </div>
      )}
    </>
  );
};
