import React from 'react';
import { Link } from 'react-router-dom';
import { Hash, ShieldCheck, Layers3, Package, Edit2, Trash2, BookUser } from 'lucide-react';
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {paginatedItems.map(material => {
            const hydrated = hydratedMap.get(material.id);
            const usedProducts = hydrated?.usedInProducts || [];

            return (
              <DSCard key={material.id} className="p-5 flex flex-col justify-between hover:-translate-y-1.5 hover:shadow-lg transition-all duration-300 group relative overflow-hidden bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-500 dark:text-zinc-400">
                      <Hash size={13} className="text-indigo-500" />
                      <span>{material.code || 'MÃ: CHƯA GÁN'}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      material.category === 'ACTIVE' 
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50' 
                        : material.category === 'EXCIPIENT' 
                          ? 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700' 
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50'
                    }`}>
                      {material.category === 'ACTIVE' ? 'Hoạt chất' : material.category === 'EXCIPIENT' ? 'Tá dược' : 'Khác'}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-slate-800 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug">
                    {material.name}
                  </h3>

                  {material.description && (
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                      {material.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {material.standard && (
                      <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 px-2 py-0.5 rounded-md text-[10px] font-bold">
                        <ShieldCheck size={11} />
                        {material.standard}
                      </span>
                    )}
                    {material.casNumber && (
                      <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">
                        CAS: {material.casNumber}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5 flex items-center gap-1">
                      <Layers3 size={11} />
                      <span>Tên gọi khác ({material.aliases?.length || 0})</span>
                    </div>
                    {material.aliases && material.aliases.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {material.aliases.slice(0, 3).map((al, aIdx) => (
                          <span key={aIdx} className="bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40 px-2 py-0.5 rounded text-[10px] font-semibold">
                            {al}
                          </span>
                        ))}
                        {material.aliases.length > 3 && (
                          <span className="bg-slate-100 dark:bg-zinc-800 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            +{material.aliases.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Chưa có alias</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {usedProducts.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 px-2 py-0.5 rounded-lg">
                        <Package size={12} />
                        {usedProducts.length} sản phẩm
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500 italic">
                        Chưa dùng
                      </span>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(material)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(material)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                        title="Xóa nguyên liệu"
                      >
                        <Trash2 size={15} />
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
          <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800/80">
            <tr className="text-slate-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest">
              <th className="px-4 py-3">Mã NL</th>
              <th className="px-4 py-3">Tên Nguyên liệu Chuẩn</th>
              <th className="px-4 py-3">Tiêu chuẩn & CAS</th>
              <th className="px-4 py-3">Các tên gọi khác (Aliases)</th>
              <th className="px-4 py-3 text-center">Phân loại</th>
              <th className="px-4 py-3">Sản phẩm đang dùng</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
            {paginatedItems.map(material => {
              const hydrated = hydratedMap.get(material.id);
              const usedProducts = hydrated?.usedInProducts || [];

              return (
                <tr key={material.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-xs text-slate-600 dark:text-zinc-300 whitespace-nowrap">
                    {material.code || <span className="text-slate-300 font-normal italic">Chưa gán</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800 dark:text-zinc-100 text-sm">{material.name}</div>
                    {material.description && (
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 line-clamp-1">{material.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="space-y-1">
                      {material.standard && (
                        <span className="inline-block bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 px-2 py-0.5 rounded text-[10px] font-bold">
                          {material.standard}
                        </span>
                      )}
                      {material.casNumber && (
                        <div className="text-[10px] font-mono text-slate-400">CAS: {material.casNumber}</div>
                      )}
                      {!material.standard && !material.casNumber && (
                        <span className="text-[10px] text-slate-300 italic">---</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {material.aliases && material.aliases.length > 0 ? (
                      <div className="flex flex-wrap gap-1 items-center">
                        {material.aliases.map((al, aIdx) => (
                          <span key={aIdx} className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 px-2 py-0.5 rounded text-[11px] font-semibold">
                            {al}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Chưa có alias</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      material.category === 'ACTIVE' ? 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/40 dark:text-rose-400' :
                      material.category === 'EXCIPIENT' ? 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300' :
                      'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400'
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
                            className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold transition-colors"
                          >
                            <Package size={11} />
                            {p.name}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Chưa sử dụng</span>
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
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800">
          <BookUser size={36} className="mx-auto text-slate-300 dark:text-zinc-600 mb-3" />
          <p className="text-slate-500 dark:text-zinc-400 font-bold text-sm">Không tìm thấy nguyên liệu nào phù hợp.</p>
          <p className="text-xs text-slate-400 mt-1">Hãy thử thay đổi từ khóa tìm kiếm hoặc bấm nút "Thêm Nguyên liệu" để tạo mới.</p>
        </div>
      )}
    </>
  );
};
