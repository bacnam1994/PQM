import React, { useState } from 'react';
import { PlusIcon, XMarkIcon, LinkIcon } from '@heroicons/react/24/outline';
import { FormulaIngredient, RawMaterial } from '../../../types';
import { normalizeSearch } from '../../../utils';

interface FormulaIngredientsTableProps {
  ingredients: FormulaIngredient[];
  rawMaterials: RawMaterial[];
  materialMap: Map<string, RawMaterial>;
  onAddIngredient: () => void;
  onChangeIngredient: (index: number, field: keyof FormulaIngredient, value: any) => void;
  onSelectMaterial: (index: number, material: RawMaterial) => void;
  onQuickCreateMaterial: (index: number, name: string) => Promise<void>;
  onRemoveIngredient: (index: number) => void;
}

export const FormulaIngredientsTable: React.FC<FormulaIngredientsTableProps> = ({
  ingredients,
  rawMaterials,
  materialMap,
  onAddIngredient,
  onChangeIngredient,
  onSelectMaterial,
  onQuickCreateMaterial,
  onRemoveIngredient,
}) => {
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">
            Thành phần Hoạt chất
          </h4>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-medium border border-emerald-500/20">
            {ingredients.length} hoạt chất
          </span>
        </div>
        <button
          type="button"
          onClick={onAddIngredient}
          className="px-3 py-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-500/15 transition-colors text-xs font-medium flex items-center gap-1.5 border border-emerald-500/20 active:scale-[0.98]"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Thêm hoạt chất
        </button>
      </div>

      {ingredients.length > 0 && (
        <div className="grid grid-cols-12 gap-2 px-1 text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
          <span className="col-span-5 pl-1">Tên hoạt chất & Kho nguyên liệu</span>
          <span className="col-span-2 text-right pr-1">Hàm lượng</span>
          <span className="col-span-2 text-center">ĐVT</span>
          <span className="col-span-2 text-right pr-1">HL Nguyên tố</span>
          <span className="col-span-1"></span>
        </div>
      )}

      <div className="space-y-2">
        {ingredients.map((ing, index) => {
          const linkedMaterial = ing.materialId ? materialMap.get(ing.materialId) : undefined;
          const matchingMaterials = rawMaterials.filter(
            (m) =>
              !ing.name ||
              normalizeSearch(m.name).includes(normalizeSearch(ing.name)) ||
              (Array.isArray(m.aliases) &&
                m.aliases.some((a) => normalizeSearch(a).includes(normalizeSearch(ing.name))))
          );

          return (
            <div
              key={ing.id || index}
              className="grid grid-cols-12 gap-2 items-center bg-surface-2/60 hover:bg-surface-2 p-2 rounded-xl border border-border transition-all relative"
            >
              <div className="col-span-5 relative">
                <div className="relative flex items-center">
                  <input
                    placeholder="Nhập hoặc chọn tên hoạt chất..."
                    value={ing.name}
                    onChange={(e) => {
                      onChangeIngredient(index, 'name', e.target.value);
                      setActiveDropdownIndex(index);
                    }}
                    onFocus={() => setActiveDropdownIndex(index)}
                    onBlur={() => setTimeout(() => setActiveDropdownIndex(null), 250)}
                    className={`w-full pl-3 pr-8 py-2 bg-surface border rounded-lg text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 ${
                      linkedMaterial
                        ? 'border-emerald-300 dark:border-emerald-700'
                        : 'border-border'
                    }`}
                  />
                  {linkedMaterial ? (
                    <span
                      title={`Đã liên kết: ${linkedMaterial.name} (${linkedMaterial.code || 'RM'})`}
                      className="absolute right-2 text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span
                      title="Chưa liên kết kho nguyên liệu"
                      className="absolute right-2 text-ink-muted opacity-40"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>

                {/* Dropdown gợi ý từ Kho nguyên liệu */}
                {activeDropdownIndex === index &&
                  (matchingMaterials.length > 0 || ing.name.trim()) && (
                    <div className="absolute z-40 w-full mt-1 bg-surface rounded-xl shadow-xl border border-border max-h-56 overflow-y-auto">
                      <div className="p-1.5 bg-surface-2 border-b border-border text-[9px] font-semibold text-ink-muted uppercase tracking-wider">
                        Gợi ý từ Danh mục Nguyên liệu ({matchingMaterials.length})
                      </div>
                      {matchingMaterials.map((m) => (
                        <div
                          key={m.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            onSelectMaterial(index, m);
                            setActiveDropdownIndex(null);
                          }}
                          className="p-2 hover:bg-surface-2 cursor-pointer border-b border-border last:border-none flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <span className="font-semibold text-ink">{m.name}</span>
                            {m.aliases && m.aliases.length > 0 && (
                              <span className="text-[10px] text-ink-muted ml-1.5">
                                ({m.aliases.join(', ')})
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                              m.category === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : 'bg-surface-3 text-ink-muted'
                            }`}
                          >
                            {m.category === 'ACTIVE' ? 'Hoạt chất' : 'Tá dược'}
                          </span>
                        </div>
                      ))}
                      {ing.name.trim() &&
                        !matchingMaterials.some(
                          (m) => m.name.toLowerCase() === ing.name.trim().toLowerCase()
                        ) && (
                          <div
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={async () => {
                              await onQuickCreateMaterial(index, ing.name);
                              setActiveDropdownIndex(null);
                            }}
                            className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium text-xs cursor-pointer flex items-center gap-1.5 border-t border-emerald-500/20 transition-colors"
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                            <span>+ Thêm nhanh "{ing.name}" vào Danh mục chuẩn</span>
                          </div>
                        )}
                    </div>
                  )}
              </div>

              <input
                placeholder="0"
                value={ing.declaredContent}
                onChange={(e) => onChangeIngredient(index, 'declaredContent', e.target.value)}
                className="col-span-2 px-3 py-2 bg-surface border border-border rounded-lg text-xs font-medium text-ink outline-none text-right focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500"
              />
              <input
                placeholder="ĐVT"
                value={ing.unit}
                onChange={(e) => onChangeIngredient(index, 'unit', e.target.value)}
                className="col-span-2 px-3 py-2 bg-surface border border-border rounded-lg text-xs font-medium text-ink outline-none text-center focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500"
                list="formula-unit-suggestions"
              />
              <input
                placeholder="(Tùy chọn)"
                value={ing.elementalContent || ''}
                onChange={(e) => onChangeIngredient(index, 'elementalContent', e.target.value)}
                className="col-span-2 px-3 py-2 bg-surface border border-border rounded-lg text-xs font-medium text-ink outline-none text-right focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => onRemoveIngredient(index)}
                className="col-span-1 p-2 text-ink-muted hover:text-rose-600 transition-colors flex justify-center"
                title="Xóa hoạt chất"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
