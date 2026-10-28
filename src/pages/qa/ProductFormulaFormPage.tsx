import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, ArrowPathIcon, CubeIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useAppStore } from '../../store/useAppStore';
import { generateId, autoFormatInput, parseNumberFromText } from '../../utils';
import { ProductFormula, FormulaIngredient, RawMaterial } from '../../types';
import { SpecialCharToolbar } from '../../components';
import { COMMON_CRITERIA_UNITS } from './TCCSFormPage';
import { normalizeName } from '../../services/criteriaAliasService';
import { productFormulaFormSchema } from '../../schemas';
import {
  useProductsQuery,
  useProductFormulasQuery,
  useRawMaterialsQuery,
  useCreateFormulaMutation,
  useUpdateFormulaMutation,
  useCreateMaterialMutation,
} from '../../hooks/queries/useProductQueries';
import { FormulaProductSelect } from './formula-form/FormulaProductSelect';
import { FormulaIngredientsTable } from './formula-form/FormulaIngredientsTable';
import { FormulaExcipientsTable } from './formula-form/FormulaExcipientsTable';
import { FormulaSensorySection } from './formula-form/FormulaSensorySection';

const ProductFormulaFormPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const notify = useAppStore((state) => state.notify);

  // TanStack Query Server State
  const { data: products = [] } = useProductsQuery();
  const { data: productFormulas = [] } = useProductFormulasQuery();
  const { data: rawMaterials = [] } = useRawMaterialsQuery();

  const createFormulaMutation = useCreateFormulaMutation();
  const updateFormulaMutation = useUpdateFormulaMutation();
  const createMaterialMutation = useCreateMaterialMutation();

  const [formulaToEdit, setFormulaToEdit] = useState<ProductFormula | null>(null);
  const [ingredients, setIngredients] = useState<FormulaIngredient[]>([]);
  const [excipients, setExcipients] = useState<FormulaIngredient[]>([]);

  // State Dropdown tìm kiếm Sản phẩm
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Load dữ liệu khi có id
  useEffect(() => {
    if (id && productFormulas.length > 0) {
      const formula = productFormulas.find((f) => f.id === id);
      if (formula) {
        setFormulaToEdit(formula);
        setSelectedProductId(formula.productId);
        const p = products.find((prod) => prod.id === formula.productId);
        setProductSearch(p ? `${p.code} - ${p.name}` : '');
        setIngredients(formula.ingredients || []);
        setExcipients(formula.excipients || []);
      } else {
        notify({ type: 'ERROR', message: 'Không tìm thấy Công thức!' });
        navigate('/product-formulas');
      }
    }
  }, [id, productFormulas, products, navigate, notify]);

  const materialMap = useMemo(() => new Map(rawMaterials.map((m) => [m.id, m])), [rawMaterials]);

  const handleIngredientChange = (index: number, field: keyof FormulaIngredient, value: any) => {
    const newIngredients = [...ingredients];
    const formatted =
      field === 'declaredContent' || field === 'elementalContent'
        ? autoFormatInput(String(value))
        : value;
    (newIngredients[index] as any)[field] = formatted;

    if (field === 'name') {
      const normVal = normalizeName(String(value));
      const matched = rawMaterials.find(
        (m) =>
          normalizeName(m.name) === normVal ||
          (Array.isArray(m.aliases) && m.aliases.some((a) => normalizeName(a) === normVal))
      );
      if (matched) {
        newIngredients[index].materialId = matched.id;
      }
    }
    setIngredients(newIngredients);
  };

  const handleSelectMaterialForIngredient = (index: number, material: RawMaterial) => {
    const newIngredients = [...ingredients];
    newIngredients[index].name = material.name;
    newIngredients[index].materialId = material.id;
    if (!newIngredients[index].unit) {
      newIngredients[index].unit = 'mg/viên';
    }
    setIngredients(newIngredients);
  };

  const handleQuickCreateMaterialForIngredient = async (index: number, name: string) => {
    const newId = generateId('rm');
    const newMat: RawMaterial = {
      id: newId,
      name: name.trim(),
      category: 'ACTIVE',
      aliases: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await createMaterialMutation.mutateAsync(newMat);
    const newIngredients = [...ingredients];
    newIngredients[index].materialId = newId;
    setIngredients(newIngredients);
    notify({ type: 'SUCCESS', message: `Đã thêm "${name}" vào Danh mục Nguyên liệu chuẩn!` });
  };

  const handleExcipientChange = (index: number, field: keyof FormulaIngredient, value: any) => {
    const newExcipients = [...excipients];
    const formatted =
      field === 'declaredContent' || field === 'elementalContent'
        ? autoFormatInput(String(value))
        : value;
    (newExcipients[index] as any)[field] = formatted;

    if (field === 'name') {
      const normVal = normalizeName(String(value));
      const matched = rawMaterials.find(
        (m) =>
          normalizeName(m.name) === normVal ||
          (Array.isArray(m.aliases) && m.aliases.some((a) => normalizeName(a) === normVal))
      );
      if (matched) {
        newExcipients[index].materialId = matched.id;
      }
    }
    setExcipients(newExcipients);
  };

  const handleSelectMaterialForExcipient = (index: number, material: RawMaterial) => {
    const newExcipients = [...excipients];
    newExcipients[index].name = material.name;
    newExcipients[index].materialId = material.id;
    if (!newExcipients[index].unit) {
      newExcipients[index].unit = 'mg/viên';
    }
    setExcipients(newExcipients);
  };

  const handleQuickCreateMaterialForExcipient = async (index: number, name: string) => {
    const newId = generateId('rm');
    const newMat: RawMaterial = {
      id: newId,
      name: name.trim(),
      category: 'EXCIPIENT',
      aliases: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await createMaterialMutation.mutateAsync(newMat);
    const newExcipients = [...excipients];
    newExcipients[index].materialId = newId;
    setExcipients(newExcipients);
    notify({ type: 'SUCCESS', message: `Đã thêm "${name}" vào Danh mục Nguyên liệu chuẩn!` });
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProductId) {
      notify({ type: 'WARNING', message: 'Vui lòng chọn một sản phẩm!' });
      return;
    }

    try {
      const formData = new FormData(e.currentTarget);

      const zodValidation = productFormulaFormSchema.safeParse({
        productId: selectedProductId,
        ingredients: ingredients.map((i) => ({
          ...i,
          name: i.name || '',
          declaredContent: String(i.declaredContent ?? ''),
          elementalContent: i.elementalContent !== undefined ? String(i.elementalContent) : '',
          unit: i.unit || '',
        })),
        excipients: excipients.map((ex) => ({
          ...ex,
          name: ex.name || '',
          declaredContent: String(ex.declaredContent ?? ''),
          elementalContent: ex.elementalContent !== undefined ? String(ex.elementalContent) : '',
          unit: ex.unit || '',
        })),
        packaging: formData.get('packaging')?.toString() || '',
        storage: formData.get('storage')?.toString() || '',
        shelfLife: formData.get('shelfLife')?.toString() || '',
      });

      if (!zodValidation.success) {
        const firstIssue = zodValidation.error.issues[0];
        notify({
          type: 'WARNING',
          title: 'Kiểm tra thất bại',
          message: firstIssue?.message || 'Dữ liệu công thức không hợp lệ',
        });
        return;
      }

      const sanitizeIngredient = (item: FormulaIngredient) => {
        let dc = item.declaredContent;
        if (typeof dc === 'string') {
          const parsed = parseNumberFromText(dc);
          dc = isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
        } else if (typeof dc !== 'number' || isNaN(dc) || !isFinite(dc)) {
          dc = 0;
        }

        let ec = item.elementalContent;
        if (ec !== undefined && ec !== null && String(ec).trim() !== '') {
          if (typeof ec === 'string') {
            const parsed = parseNumberFromText(ec);
            ec = isNaN(parsed) || !isFinite(parsed) ? undefined : parsed;
          } else if (typeof ec !== 'number' || isNaN(ec) || !isFinite(ec)) {
            ec = undefined;
          }
        } else {
          ec = undefined;
        }

        return { ...item, declaredContent: dc, elementalContent: ec };
      };

      const formulaData = {
        productId: selectedProductId,
        ingredients: ingredients.filter((i) => i.name).map(sanitizeIngredient),
        excipients: excipients.filter((ex) => ex.name).map(sanitizeIngredient),
        sensory: {
          dosageForm: formData.get('dosageForm')?.toString() || '',
          appearance: formData.get('appearance')?.toString() || '',
          color: formData.get('color')?.toString() || '',
          smellTaste: formData.get('smellTaste')?.toString() || '',
        },
        packaging: formData.get('packaging')?.toString() || '',
        storage: formData.get('storage')?.toString() || '',
        shelfLife: formData.get('shelfLife')?.toString() || '',
      };

      if (id && formulaToEdit) {
        await updateFormulaMutation.mutateAsync({
          formula: {
            ...formulaToEdit,
            ...formulaData,
            updatedAt: new Date().toISOString(),
          },
        });
        notify({
          type: 'SUCCESS',
          title: 'Đã cập nhật',
          message: 'Cập nhật công thức thành công.',
        });
      } else {
        await createFormulaMutation.mutateAsync({
          id: generateId('form'),
          ...formulaData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        notify({ type: 'SUCCESS', title: 'Thành công', message: 'Đã tạo công thức mới.' });
      }
      navigate('/product-formulas');
    } catch (error) {
      console.error('Lỗi khi lưu công thức:', error);
    }
  };

  const isSubmitting = createFormulaMutation.isPending || updateFormulaMutation.isPending;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/product-formulas')}
          className="p-2 bg-surface hover:bg-surface-2 text-ink-muted hover:text-ink rounded-lg border border-border transition-colors active:scale-[0.98]"
          title="Quay lại danh sách"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink flex items-center gap-2">
            <CubeIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {id ? 'Chỉnh sửa Công thức' : 'Tạo Công thức mới'}
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Liên kết trực tiếp với Danh mục Nguyên liệu chuẩn và Tiêu chuẩn cơ sở (TCCS).
          </p>
        </div>
      </div>

      <div className="bg-surface rounded-xl shadow-xs border border-border p-6">
        {(!id || formulaToEdit) && (
          <form onSubmit={handleSave} className="space-y-6">
            <datalist id="formula-unit-suggestions">
              {COMMON_CRITERIA_UNITS.map((unit) => (
                <option key={unit} value={unit} />
              ))}
            </datalist>
            <SpecialCharToolbar />

            {/* Sub-component 1: Chọn sản phẩm */}
            <FormulaProductSelect
              selectedProductId={selectedProductId}
              productSearch={productSearch}
              showProductDropdown={showProductDropdown}
              isEditMode={!!id}
              products={products}
              setProductSearch={setProductSearch}
              setShowProductDropdown={setShowProductDropdown}
              onSelectProduct={(p) => {
                setSelectedProductId(p.id);
                setProductSearch(`${p.code} - ${p.name}`);
                setShowProductDropdown(false);
              }}
              onClearProduct={() => setSelectedProductId('')}
            />

            {/* Sub-component 2: Hoạt chất */}
            <FormulaIngredientsTable
              ingredients={ingredients}
              rawMaterials={rawMaterials}
              materialMap={materialMap}
              onAddIngredient={() =>
                setIngredients([
                  ...ingredients,
                  { id: generateId('ing'), name: '', declaredContent: 0, unit: 'mg/viên' },
                ])
              }
              onChangeIngredient={handleIngredientChange}
              onSelectMaterial={handleSelectMaterialForIngredient}
              onQuickCreateMaterial={handleQuickCreateMaterialForIngredient}
              onRemoveIngredient={(idx) => setIngredients(ingredients.filter((_, i) => i !== idx))}
            />

            {/* Sub-component 3: Tá dược */}
            <FormulaExcipientsTable
              excipients={excipients}
              rawMaterials={rawMaterials}
              materialMap={materialMap}
              onAddExcipient={() =>
                setExcipients([
                  ...excipients,
                  { id: generateId('exc'), name: '', declaredContent: 0, unit: 'mg/viên' },
                ])
              }
              onChangeExcipient={handleExcipientChange}
              onSelectMaterial={handleSelectMaterialForExcipient}
              onQuickCreateMaterial={handleQuickCreateMaterialForExcipient}
              onRemoveExcipient={(idx) => setExcipients(excipients.filter((_, i) => i !== idx))}
            />

            {/* Sub-component 4: Cảm quan & Thông tin khác */}
            <FormulaSensorySection
              sensory={formulaToEdit?.sensory}
              packaging={formulaToEdit?.packaging}
              storage={formulaToEdit?.storage}
              shelfLife={formulaToEdit?.shelfLife}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-border">
              <button
                type="button"
                onClick={() => navigate('/product-formulas')}
                className="px-4 py-2 text-ink-muted hover:text-ink font-medium text-xs hover:bg-surface-2 rounded-lg border border-border transition-colors active:scale-[0.98]"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg shadow-xs transition-all flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckIcon className="h-4 w-4" />
                )}
                {id ? 'Cập nhật Công thức' : 'Lưu Công thức'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProductFormulaFormPage;
