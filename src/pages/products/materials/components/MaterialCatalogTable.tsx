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
              <div key={material.id} className="p-4 rounded-xl flex flex-col justify-between hover:border-emerald-500/30 transition-all duration-200 group relative overflow-hidden bg-surface border border-border shadow-xs">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-ink-muted">
                      <HashtagIcon className="h-3.5 w-3.5 text-emerald-500" />
                      <span>{material.code || 'Mã: chưa gán'}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      material.category === 'ACTIVE' 
                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20' 
                        : material.category === 'EXCIPIENT' 
                          ? 'bg-surface-2 text-ink-soft border border-border' 
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {material.category === 'ACTIVE' ? 'Hoạt chất' : material.category === 'EXCIPIENT' ? 'Tá dược' : 'Khác'}
                    </span>
                  </div>

                  <h3 className="font-semibold text-base text-ink group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">
                    {material.name}
                  </h3>

                  {material.description && (
                    <p className="text-xs text-ink-muted mt-1 line-clamp-2 leading-relaxed">
                      {material.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                    {material.standard && (
                      <span className="inline-flex items-center gap-1 bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full text-[11px] font-medium">
                        <ShieldCheckIcon className="h-3 w-3" />
                        {material.standard}
                      </span>
                    )}
                    {material.casNumber && (
                      <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium">
                        CAS: {material.casNumber}
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 pt-2.5 border-t border-border/80">
                    <div className="text-xs font-medium text-ink-muted mb-1 flex items-center gap-1">
                      <Square3Stack3DIcon className="h-3.5 w-3.5" />
                      <span>Tên gọi khác ({material.aliases?.length || 0})</span>
                    </div>
                    {material.aliases && material.aliases.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {material.aliases.slice(0, 3).map((al, aIdx) => (
                          <span key={aIdx} className="bg-surface-2 text-ink-soft border border-border px-2 py-0.5 rounded-full text-[11px] font-medium">
                            {al}
                          </span>
                        ))}
                        {material.aliases.length > 3 && (
                          <span className="bg-surface-3 text-ink-muted px-1.5 py-0.5 rounded-full text-[11px] font-medium">
                            +{material.aliases.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-ink-muted italic">Chưa có alias</span>
                    )}
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-border/80 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {usedProducts.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <CubeIcon className="h-3 w-3" />
                        {usedProducts.length} sản phẩm
                      </span>
                    ) : (
                      <span className="text-xs text-ink-muted italic">
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
                        className="p-1.5 text-ink-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Xóa nguyên liệu"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <DSTable>
          <thead className="bg-surface-2/60 border-b border-border">
            <tr className="text-ink-muted text-xs font-semibold">
              <th className="px-4 py-3 text-left">Mã NL</th>
              <th className="px-4 py-3 text-left">Tên nguyên liệu chuẩn</th>
              <th className="px-4 py-3 text-left">Tiêu chuẩn & CAS</th>
              <th className="px-4 py-3 text-left">Tên gọi khác (Aliases)</th>
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
                <tr key={material.id} className="hover:bg-surface-2/60 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-xs text-ink whitespace-nowrap">
                    {material.code || <span className="text-ink-muted font-normal italic">Chưa gán</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink text-sm">{material.name}</div>
                    {material.description && (
                      <p className="text-xs text-ink-muted mt-0.5 line-clamp-1">{material.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="space-y-0.5">
                      {material.standard && (
                        <span className="inline-block bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full text-[11px] font-medium">
                          {material.standard}
                        </span>
                      )}
                      {material.casNumber && (
                        <div className="text-xs font-mono text-ink-muted">CAS: {material.casNumber}</div>
                      )}
                      {!material.standard && !material.casNumber && (
                        <span className="text-xs text-ink-muted italic">---</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {material.aliases && material.aliases.length > 0 ? (
                      <div className="flex flex-wrap gap-1 items-center">
                        {material.aliases.map((al, aIdx) => (
                          <span key={aIdx} className="bg-surface-2 text-ink-soft border border-border px-2 py-0.5 rounded-full text-[11px] font-medium">
                            {al}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-ink-muted text-xs italic">Chưa có alias</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      material.category === 'ACTIVE' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20' :
                      material.category === 'EXCIPIENT' ? 'bg-surface-2 text-ink-soft border border-border' :
                      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {material.category === 'ACTIVE' ? 'Hoạt chất' : material.category === 'EXCIPIENT' ? 'Tá dược' : 'Khác'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {usedProducts.length > 0 ? (
                      <div className="flex flex-wrap gap-1 items-center">
                        {usedProducts.map(p => (
                          <Link 
                            key={p.id} 
                            to={`/products/${p.id}`}
                            className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors"
                          >
                            <CubeIcon className="h-3 w-3" />
                            {p.name}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-ink-muted italic">Chưa sử dụng</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
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
