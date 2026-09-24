import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon, ArrowPathIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { useAppStore } from '../../store/useAppStore';
import { useForm, useFormDraft } from '../../hooks';
import { CriterionType, TCCS, Criterion, Product, AlternateRule } from '../../types';
import {
  generateId,
  parseFlexibleValue,
  normalizeNumericString,
  autoFormatInput,
  parseNumberFromText,
} from '../../utils';
import {
  PHARMACOPOEIA_TEMPLATES,
  generateCriteriaFromFormula,
  DosageFormType,
} from '../../services/ai/tccsAssistantService';
import { useCreateTCCSMutation, useUpdateTCCSMutation } from '../../hooks/queries/useTCCSQueries';
import { TccsGeneralSection } from './tccs-form/TccsGeneralSection';
import { TccsMainCriteriaTable } from './tccs-form/TccsMainCriteriaTable';
import { TccsSafetyCriteriaTable } from './tccs-form/TccsSafetyCriteriaTable';
import { TccsAlternateRulesSection } from './tccs-form/TccsAlternateRulesSection';
import { tccsFormSchema } from '../../schemas';
import { OperationalDraftBanner } from '../../components/operational';
import toast from 'react-hot-toast';

export const COMMON_CRITERIA_UNITS = [
  'mg/viên',
  'g/gói',
  'mg/gói',
  'mg/ml',
  'mcg/ml',
  'µg/ml',
  'mg',
  'g',
  'kg',
  'mcg',
  'µg',
  'ml',
  'l',
  '%',
  '% w/w',
  '% w/v',
  'CFU/g',
  'CFU/ml',
  'CFU/10g',
  'CFU/25g',
  'ppm',
  'ppb',
  'mg/kg',
  'µg/kg',
  'viên',
  'nang',
  'ống',
  'gói',
  'lọ',
  'chai',
  'độ',
];

const calculateRangePreview = (text: string): string | null => {
  const fmt = (n: number): string => {
    if (isNaN(n)) return '...';
    const num = parseFloat(n.toPrecision(12));
    if (num === 0) return '0';
    if (Math.abs(num) >= 1000 || (Math.abs(num) > 0 && Math.abs(num) <= 0.001)) {
      const exponent = Math.floor(Math.log10(Math.abs(num)));
      const mantissa = num / Math.pow(10, exponent);
      const roundedMantissa = Math.round(mantissa * 1000) / 1000;
      if (roundedMantissa === 1) return `10^${exponent}`;
      return `${roundedMantissa} × 10^${exponent}`;
    }
    return num.toLocaleString('vi-VN');
  };
  const lower = normalizeNumericString(text.toLowerCase());
  if (['không được có', 'không có', 'âm tính', 'negative', 'kđc'].some((k) => lower.includes(k)))
    return 'Yêu cầu: Không phát hiện / Âm tính';
  const pmSymbol = text.includes('±') ? '±' : text.includes('+/-') ? '+/-' : null;
  if (pmSymbol) {
    const parts = text.split(pmSymbol);
    const base = parseFlexibleValue(parts[0]);
    const tolerancePart = parts[1] || '';
    let tolerance = parseFlexibleValue(tolerancePart);
    if (base !== null && tolerance !== null) {
      if (tolerancePart.includes('%')) tolerance = base * (tolerance / 100);
      return `Khoảng chấp nhận: ${fmt(base - tolerance)} ~ ${fmt(base + tolerance)}`;
    }
  }
  const numbers = (lower.match(/-?\d+(\.\d+)?(e[+-]?\d+)?/g) || []).map(Number);
  const isRange =
    lower.includes('đến') ||
    lower.includes('~') ||
    (lower.includes('-') && !lower.startsWith('-') && numbers.length > 1);
  if (isRange && numbers.length >= 2)
    return `Khoảng chấp nhận: ${fmt(numbers[0])} ~ ${fmt(numbers[1])}`;
  const isGreater = /lớn hơn|>/g.test(lower);
  const isLess = /nhỏ hơn|bé hơn|</g.test(lower);
  if (numbers.length > 0) {
    if (isGreater && isLess && numbers.length >= 2) {
      const sorted = numbers.sort((a, b) => a - b);
      return `Khoảng chấp nhận: ${fmt(sorted[0])} ~ ${fmt(sorted[1])}`;
    }
    if (isGreater)
      return `Yêu cầu: ${lower.includes('≥') || lower.includes('bằng') ? '≥' : '>'} ${fmt(numbers[0])}`;
    if (isLess)
      return `Yêu cầu: ${lower.includes('≤') || lower.includes('bằng') ? '≤' : '<'} ${fmt(numbers[0])}`;
  }
  return null;
};

interface TccsFormState {
  productId: string;
  code: string;
  issueDate: string;
  packaging: string;
  storage: string;
  shelfLife: string;
  standardRefs: string[];
  mainCriteria: (Criterion & { notes?: string })[];
  microbiologicalCriteria: (Criterion & { notes?: string })[];
  heavyMetalCriteria: (Criterion & { notes?: string })[];
  mycotoxinCriteria: (Criterion & { notes?: string })[];
  alternateRules: AlternateRule[];
}

const initialTccsFormState: TccsFormState = {
  productId: '',
  code: '',
  issueDate: new Date().toISOString().split('T')[0],
  packaging: '',
  storage: '',
  shelfLife: '',
  standardRefs: [],
  mainCriteria: [
    { name: '', unit: '', min: undefined, max: undefined, type: CriterionType.NUMBER, notes: '' },
  ],
  microbiologicalCriteria: [
    { name: '', unit: '', max: undefined, type: CriterionType.NUMBER, notes: '' },
  ],
  heavyMetalCriteria: [
    { name: '', unit: '', max: undefined, type: CriterionType.NUMBER, notes: '' },
  ],
  mycotoxinCriteria: [],
  alternateRules: [],
};

const validateTCCS = (values: TccsFormState) => {
  const errors: Record<string, string> = {};

  const zodResult = tccsFormSchema.safeParse({
    productId: values.productId,
    code: values.code,
    issueDate: values.issueDate,
    packaging: values.packaging || '',
    storage: values.storage || '',
    shelfLife: values.shelfLife || '',
    mainQualityCriteria: values.mainCriteria || [],
    safetyCriteria: [
      ...(values.microbiologicalCriteria || []),
      ...(values.heavyMetalCriteria || []),
      ...(values.mycotoxinCriteria || []),
    ],
  });

  if (!zodResult.success) {
    for (const issue of zodResult.error.issues) {
      const field = issue.path[0] as string;
      if (field && !errors[field]) {
        errors[field] = issue.message;
      }
    }
  }

  const checkMinMax = (list: Criterion[], sectionName: string, label: string) => {
    (list || []).forEach((c, idx) => {
      if (
        c.type === CriterionType.NUMBER &&
        c.min !== undefined &&
        c.max !== undefined &&
        c.min !== null &&
        c.max !== null
      ) {
        const minNum = Number(c.min);
        const maxNum = Number(c.max);
        if (!isNaN(minNum) && !isNaN(maxNum) && minNum > maxNum) {
          errors[`minMax_${sectionName}_${idx}`] =
            `Mục ${label} - Chỉ tiêu "${c.name || `#${idx + 1}`}": Min (${minNum}) không được lớn hơn Max (${maxNum})`;
        }
      }
    });
  };

  checkMinMax(values.mainCriteria, 'main', 'Chất lượng chính');
  checkMinMax(values.microbiologicalCriteria, 'micro', 'Vi sinh');
  checkMinMax(values.heavyMetalCriteria, 'metal', 'Kim loại nặng');
  checkMinMax(values.mycotoxinCriteria, 'mycotoxin', 'Độc tố vi nấm & Khác');

  return errors;
};

const TCCSFormPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const cloneId = searchParams.get('cloneId');
  const navigate = useNavigate();

  const { products, tccsList, productFormulas, notify } = useAppStore();
  const currentUser = useAppStore((state) => state.user);

  const createTCCSMutation = useCreateTCCSMutation();
  const updateTCCSMutation = useUpdateTCCSMutation();

  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const {
    values: formValues,
    setValues,
    handleChange,
    setFieldValue,
    addToArray,
    removeFromArray,
    updateInArray,
    errors,
  } = useForm(initialTccsFormState, validateTCCS);

  const { clearDraft, hasDraft, draftTimestamp, restoreDraft, discardDraft } = useFormDraft({
    key: 'tccs_form_draft',
    formValues,
    setFormValues: setValues,
    isEnabled: !id && !cloneId,
    onDraftLoaded: (draft) => {
      if (!id && !cloneId) {
        setValues(draft);
        if (draft.productId) {
          const p = products.find((prod) => prod.id === draft.productId);
          if (p) setProductSearch(`${p.code} - ${p.name}`);
        }
      }
    },
  });

  useEffect(() => {
    const targetId = id || cloneId;
    if (targetId && tccsList.length > 0) {
      const existing = tccsList.find((t) => t.id === targetId);
      if (existing) {
        setValues({
          productId: existing.productId,
          code: cloneId ? `${existing.code}-COPY` : existing.code,
          issueDate: existing.issueDate || new Date().toISOString().split('T')[0],
          packaging: existing.packaging || '',
          storage: existing.storage || '',
          shelfLife: existing.shelfLife || '',
          standardRefs:
            typeof existing.standardRefs === 'string'
              ? [existing.standardRefs]
              : existing.standardRefs || [],
          mainCriteria: existing.mainQualityCriteria || [],
          microbiologicalCriteria: (existing.safetyCriteria || []).filter(
            (c: any) => c.category === 'micro'
          ),
          heavyMetalCriteria: (existing.safetyCriteria || []).filter(
            (c: any) => c.category === 'metal'
          ),
          mycotoxinCriteria: (existing.safetyCriteria || []).filter(
            (c: any) => c.category === 'mycotoxin'
          ),
          alternateRules: existing.alternateRules || [],
        });
        const p = products.find((prod) => prod.id === existing.productId);
        if (p) setProductSearch(`${p.code} - ${p.name}`);
      }
    }
  }, [id, cloneId, tccsList, products, setValues]);

  const selectedFormula = useMemo(() => {
    return productFormulas.find((f) => f.productId === formValues.productId);
  }, [productFormulas, formValues.productId]);

  const productIngredients = useMemo(() => {
    if (!selectedFormula) return [];
    return [...(selectedFormula.ingredients || []), ...(selectedFormula.excipients || [])];
  }, [selectedFormula]);

  const allCriteriaNames = useMemo(() => {
    const names = new Set<string>();
    tccsList.forEach((t) => {
      (t.mainQualityCriteria || []).forEach((c) => c?.name && names.add(c.name));
      (t.safetyCriteria || []).forEach((c) => c?.name && names.add(c.name));
    });
    return Array.from(names).sort();
  }, [tccsList]);

  const handleApplyPharmacopoeiaTemplate = (dosageForm: DosageFormType) => {
    const template = PHARMACOPOEIA_TEMPLATES[dosageForm];
    if (!template) return;
    let added = 0;
    template.criteria.forEach((crit) => {
      if (!formValues.mainCriteria.some((c) => c.name.toLowerCase() === crit.name.toLowerCase())) {
        addToArray('mainCriteria', crit);
        added++;
      }
    });
    toast.success(`Đã thêm ${added} chỉ tiêu từ Dược điển cho dạng ${template.label}!`);
  };

  const handleFetchCriteriaFromFormula = (tolerancePercent: number) => {
    if (!selectedFormula) {
      toast.error('Sản phẩm chưa có công thức!');
      return;
    }
    const criteria = generateCriteriaFromFormula(selectedFormula, tolerancePercent);
    let added = 0;
    criteria.forEach((crit) => {
      if (!formValues.mainCriteria.some((c) => c.name.toLowerCase() === crit.name.toLowerCase())) {
        addToArray('mainCriteria', crit);
        added++;
      }
    });
    toast.success(`Đã đồng bộ ${added} chỉ tiêu từ công thức!`);
  };

  const handleProductSelect = (product: Product) => {
    setFieldValue('productId', product.id);
    setProductSearch(`${product.code} - ${product.name}`);
    setShowProductDropdown(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(errors).length > 0) {
      toast.error('Vui lòng kiểm tra lại các trường lỗi!');
      return;
    }

    const tccsData: TCCS = {
      id: id && !cloneId ? id : generateId('tccs'),
      productId: formValues.productId,
      code: formValues.code.toUpperCase(),
      issueDate: formValues.issueDate,
      packaging: formValues.packaging,
      storage: formValues.storage,
      shelfLife: formValues.shelfLife,
      standardRefs: formValues.standardRefs?.join(', ') || '',
      isActive: true,
      composition: '',
      mainQualityCriteria: formValues.mainCriteria.filter((c) => c.name),
      safetyCriteria: [
        ...formValues.microbiologicalCriteria
          .filter((c) => c.name)
          .map((c) => ({ ...(c as any), category: 'micro' })),
        ...formValues.heavyMetalCriteria
          .filter((c) => c.name)
          .map((c) => ({ ...(c as any), category: 'metal' })),
        ...formValues.mycotoxinCriteria
          .filter((c) => c.name)
          .map((c) => ({ ...(c as any), category: 'mycotoxin' })),
      ],
      alternateRules: formValues.alternateRules.filter((r) => r.main && r.alt),
      createdAt: new Date().toISOString(),
    };

    try {
      if (id && !cloneId) {
        const oldTCCS = tccsList.find((t) => t.id === id);
        await updateTCCSMutation.mutateAsync({ tccs: tccsData, oldTCCS });
        notify({ type: 'SUCCESS', title: 'Thành công', message: 'Đã cập nhật hồ sơ TCCS.' });
      } else {
        await createTCCSMutation.mutateAsync({ tccs: tccsData });
        clearDraft();
        notify({ type: 'SUCCESS', title: 'Thành công', message: 'Đã tạo hồ sơ TCCS mới.' });
      }
      navigate('/tccs');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi lưu TCCS');
    }
  };

  const isSubmitting = createTCCSMutation.isPending || updateTCCSMutation.isPending;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/tccs')}
          className="p-2 bg-surface text-ink-muted hover:text-emerald-700 dark:hover:text-emerald-400 rounded-lg border border-border shadow-xs transition-colors cursor-pointer"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
            {id && !cloneId ? 'Chỉnh sửa TCCS' : cloneId ? 'Sao chép TCCS' : 'Tạo TCCS mới'}
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Xây dựng và cấu hình tiêu chuẩn chất lượng cơ sở cho sản phẩm
          </p>
        </div>
      </div>
      <OperationalDraftBanner
        hasDraft={hasDraft && !id && !cloneId}
        draftTimestamp={draftTimestamp}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />

      <div className="bg-surface rounded-xl shadow-xs border border-border p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <datalist id="criteria-name-suggestions">
            {allCriteriaNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <datalist id="criteria-unit-suggestions">
            {COMMON_CRITERIA_UNITS.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>

          {(!id || cloneId) && (
            <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 flex gap-3">
              <InformationCircleIcon className="text-blue-600 dark:text-blue-400 shrink-0 w-5 h-5 mt-0.5" />
              <div className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                Để đổi tên một chỉ tiêu đã có trên toàn hệ thống, vui lòng sử dụng trang{' '}
                <a href="/criteria" target="_blank" className="font-bold underline">
                  Danh mục Chỉ tiêu
                </a>
                . Việc sửa tên trực tiếp ở đây sẽ tạo một chỉ tiêu mới.
              </div>
            </div>
          )}

          {/* Sub-component 1: Thông tin chung */}
          <TccsGeneralSection
            productId={formValues.productId}
            code={formValues.code}
            issueDate={formValues.issueDate}
            packaging={formValues.packaging}
            storage={formValues.storage}
            shelfLife={formValues.shelfLife}
            standardRefs={formValues.standardRefs}
            products={products}
            errors={errors}
            productSearch={productSearch}
            setProductSearch={setProductSearch}
            showProductDropdown={showProductDropdown}
            setShowProductDropdown={setShowProductDropdown}
            onProductSelect={handleProductSelect}
            onChange={handleChange}
            onDateChange={setFieldValue}
          />

          {/* Sub-component 2: Chỉ tiêu chất lượng chính */}
          <TccsMainCriteriaTable
            mainCriteria={formValues.mainCriteria}
            productId={formValues.productId}
            selectedFormula={selectedFormula}
            productIngredients={productIngredients}
            onApplyPharmacopoeiaTemplate={handleApplyPharmacopoeiaTemplate}
            onFetchCriteriaFromFormula={handleFetchCriteriaFromFormula}
            onAddCriterion={() =>
              addToArray('mainCriteria', {
                name: '',
                unit: '',
                min: undefined,
                max: undefined,
                type: CriterionType.NUMBER,
                notes: '',
              })
            }
            onUpdateCriterion={(idx, fld, val) => updateInArray('mainCriteria', idx, fld, val)}
            onRemoveCriterion={(idx) => removeFromArray('mainCriteria', idx)}
            calculateRangePreview={calculateRangePreview}
            autoFormatInput={autoFormatInput}
            parseNumberFromText={parseNumberFromText}
            alternateRules={formValues.alternateRules}
          />

          {/* Sub-component 3: Chỉ tiêu an toàn */}
          <TccsSafetyCriteriaTable
            microbiologicalCriteria={formValues.microbiologicalCriteria}
            heavyMetalCriteria={formValues.heavyMetalCriteria}
            mycotoxinCriteria={formValues.mycotoxinCriteria}
            alternateRules={formValues.alternateRules}
            onAdd={(cat) =>
              addToArray(cat, {
                name: '',
                unit: '',
                max: undefined,
                type: CriterionType.NUMBER,
                notes: '',
              })
            }
            onUpdate={(cat, idx, fld, val) => updateInArray(cat, idx, fld, val)}
            onRemove={(cat, idx) => removeFromArray(cat, idx)}
            autoFormatInput={autoFormatInput}
            parseNumberFromText={parseNumberFromText}
          />

          {/* Sub-component 4: Quy tắc thay thế */}
          <TccsAlternateRulesSection
            alternateRules={formValues.alternateRules}
            allCriteriaNames={allCriteriaNames}
            onAddRule={() => addToArray('alternateRules', { main: '', alt: '' })}
            onUpdateRule={(idx, fld, val) => updateInArray('alternateRules', idx, fld, val)}
            onRemoveRule={(idx) => removeFromArray('alternateRules', idx)}
          />

          <div className="pt-6 border-t border-border flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/tccs')}
              className="px-5 py-2 text-ink-muted hover:text-ink font-medium text-xs hover:bg-surface-2 rounded-lg border border-border transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs shadow-xs flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
              {id && !cloneId ? 'Cập nhật TCCS' : 'Lưu hồ sơ TCCS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TCCSFormPage;
