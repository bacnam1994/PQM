import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  ArrowPathIcon, 
  MagnifyingGlassIcon, 
  CheckCircleIcon, 
  XMarkIcon, 
  PlusIcon, 
  InformationCircleIcon, 
  ChartBarSquareIcon, 
  ShieldCheckIcon, 
  ArrowsRightLeftIcon, 
  ArrowDownRightIcon, 
  ArrowRightIcon, 
  BeakerIcon, 
  CubeIcon, 
  ExclamationCircleIcon, 
  SparklesIcon 
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store/useAppStore';
import { useForm, useFormDraft } from '../../hooks';
import { CriterionType, TCCS, Criterion } from '../../types';
import { generateId, parseFlexibleValue, normalizeNumericString, autoFormatInput, parseNumberFromText, parseDateToISO } from '../../utils';
import { SpecialCharToolbar, DSDateInput } from '../../components';
import { logAuditAction } from '../../services/auditService';
import { PHARMACOPOEIA_TEMPLATES, generateCriteriaFromFormula, checkTCCSFormulaConflicts, DosageFormType } from '../../services/ai/tccsAssistantService';
import toast from 'react-hot-toast';

export const COMMON_CRITERIA_UNITS = [
  'mg/viên', 'g/gói', 'mg/gói', 'mg/ml', 'mcg/ml', 'µg/ml',
  'mg', 'g', 'kg', 'mcg', 'µg', 'ml', 'l',
  '%', '% w/w', '% w/v',
  'CFU/g', 'CFU/ml', 'CFU/10g', 'CFU/25g',
  'ppm', 'ppb', 'mg/kg', 'µg/kg',
  'viên', 'nang', 'ống', 'gói', 'lọ', 'chai', 'độ'
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
  if (['không được có', 'không có', 'âm tính', 'negative', 'kđc'].some(k => lower.includes(k))) return 'Yêu cầu: Không phát hiện / Âm tính';
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
  const isRange = lower.includes('đến') || lower.includes('~') || (lower.includes('-') && !lower.startsWith('-') && numbers.length > 1);
  if (isRange && numbers.length >= 2) return `Khoảng chấp nhận: ${fmt(numbers[0])} ~ ${fmt(numbers[1])}`;
  const isGreater = /lớn hơn|>/g.test(lower);
  const isLess = /nhỏ hơn|bé hơn|</g.test(lower);
  if (numbers.length > 0) {
    if (isGreater && isLess && numbers.length >= 2) {
      const sorted = numbers.sort((a, b) => a - b);
      return `Khoảng chấp nhận: ${fmt(sorted[0])} ~ ${fmt(sorted[1])}`;
    }
    if (isGreater) return `Yêu cầu: ${lower.includes('≥') || lower.includes('bằng') ? '≥' : '>'} ${fmt(numbers[0])}`;
    if (isLess) return `Yêu cầu: ${lower.includes('≤') || lower.includes('bằng') ? '≤' : '<'} ${fmt(numbers[0])}`;
  }
  return null;
};

const initialTccsFormState = {
  productId: '',
  code: '',
  issueDate: new Date().toISOString().split('T')[0],
  mainCriteria: [{ name: '', unit: '', min: undefined, max: undefined, type: CriterionType.NUMBER, notes: '' }] as (Criterion & { notes?: string })[],
  microbiologicalCriteria: [{ name: '', unit: '', max: undefined, type: CriterionType.NUMBER, notes: '' }] as (Criterion & { notes?: string })[],
  heavyMetalCriteria: [{ name: '', unit: '', max: undefined, type: CriterionType.NUMBER, notes: '' }] as (Criterion & { notes?: string })[],
  mycotoxinCriteria: [] as (Criterion & { notes?: string })[],
  alternateRules: [] as { main: string, alt: string, type?: 'FAIL_RETRY' | 'CONDITIONAL_CHECK', conditionValue?: string }[],
};

const validateTCCS = (values: typeof initialTccsFormState) => {
  const errors: Record<string, string> = {};
  if (!values.productId) errors.productId = 'Vui lòng chọn sản phẩm';
  if (!values.code) errors.code = 'Vui lòng nhập mã TCCS';
  if (!values.issueDate) errors.issueDate = 'Vui lòng chọn ngày ban hành';

  const checkMinMax = (list: Criterion[], sectionName: string, label: string) => {
    (list || []).forEach((c, idx) => {
      if (c.type === CriterionType.NUMBER && c.min !== undefined && c.max !== undefined && c.min !== null && c.max !== null) {
        const minNum = Number(c.min);
        const maxNum = Number(c.max);
        if (!isNaN(minNum) && !isNaN(maxNum) && minNum > maxNum) {
          errors[`minMax_${sectionName}_${idx}`] = `Mục ${label} - Chỉ tiêu "${c.name || `#${idx + 1}`}": Min (${minNum}) không được lớn hơn Max (${maxNum})`;
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

  const { products, tccsList, productFormulas, addTCCS, updateTCCS, notify } = useAppStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const { values: formValues, setValues, handleChange, setFieldValue, addToArray, removeFromArray, updateInArray, resetForm, errors } = useForm(
    initialTccsFormState,
    validateTCCS
  );

  const { clearDraft } = useFormDraft({
    key: 'tccs_form_draft',
    formValues,
    setFormValues: setValues,
    onDraftLoaded: (draft) => {
      if (!id && !cloneId) {
        setValues(draft);
        if (draft.productId) {
          const p = products.find(prod => prod.id === draft.productId);
          if (p) setProductSearch(`${p.code} - ${p.name}`);
        }
      }
    }
  });

  useEffect(() => {
    const targetId = cloneId || id;
    if (targetId) {
      const tccs = tccsList.find(t => t.id === targetId);
      if (tccs) {
        const micro = (tccs.safetyCriteria || []).filter(c => (c as any).category === 'micro');
        const metal = (tccs.safetyCriteria || []).filter(c => (c as any).category === 'metal');
        const myco = (tccs.safetyCriteria || []).filter(c => (c as any).category === 'mycotoxin');

        setValues({
          productId: tccs.productId,
          code: cloneId ? `${tccs.code}_COPY` : tccs.code,
          issueDate: cloneId ? new Date().toISOString().split('T')[0] : parseDateToISO(tccs.issueDate),
          mainCriteria: (tccs.mainQualityCriteria || []).map(c => ({ ...c, notes: (c as any).notes || '' })),
          microbiologicalCriteria: micro.map(c => ({ ...c, notes: (c as any).notes || '' })),
          heavyMetalCriteria: metal.map(c => ({ ...c, notes: (c as any).notes || '' })),
          mycotoxinCriteria: myco.map(c => ({ ...c, notes: (c as any).notes || '' })),
          alternateRules: tccs.alternateRules || [],
        });

        const p = products.find(prod => prod.id === tccs.productId);
        if (p) setProductSearch(`${p.code} - ${p.name}`);
      }
    }
  }, [id, cloneId, tccsList, products, setValues]);

  const handleApplyPharmacopoeiaTemplate = (dosageForm: DosageFormType) => {
    const template = PHARMACOPOEIA_TEMPLATES[dosageForm];
    if (!template || !template.criteria) return;
    template.criteria.forEach(item => {
      const exists = formValues.mainCriteria.some(c => c.name.toLowerCase() === item.name.toLowerCase());
      if (!exists) {
        addToArray('mainCriteria', {
          name: item.name,
          unit: item.unit,
          expectedText: item.expectedText,
          type: item.type,
          notes: item.notes,
        });
      }
    });
    notify({
      type: 'SUCCESS',
      message: `Đã áp dụng mẫu dược điển: ${template.label}`
    });
  };

  const handleFetchCriteriaFromFormula = (defaultTolerancePercent: number = 10) => {
    if (!formValues.productId) {
      toast.error('Vui lòng chọn sản phẩm trước!');
      return;
    }
    const formula = productFormulas.find(f => f.productId === formValues.productId);
    if (!formula) {
      toast.error('Sản phẩm này chưa có công thức được phê duyệt!');
      return;
    }
    const criteria = generateCriteriaFromFormula(formula, defaultTolerancePercent);
    if (criteria.length === 0) {
      toast.error('Không tìm thấy hoạt chất nào trong công thức!');
      return;
    }
    let addedCount = 0;
    criteria.forEach(crit => {
      const exists = formValues.mainCriteria.some(c => c.name.toLowerCase() === crit.name.toLowerCase());
      if (!exists) {
        addToArray('mainCriteria', crit);
        addedCount++;
      }
    });
    toast.success(`Đã đồng bộ ${addedCount} chỉ tiêu từ công thức!`);
  };

  const handleSave = async (e: React.FormEvent) => {
     e.preventDefault();
     if (Object.keys(errors).length > 0) {
       toast.error('Vui lòng kiểm tra lại các trường lỗi!');
       return;
     }

     setIsSubmitting(true);
     try {
       const tccsData: TCCS = {
         id: id && !cloneId ? id : generateId('tccs'),
         productId: formValues.productId,
         code: formValues.code.toUpperCase(),
         issueDate: formValues.issueDate,
         isActive: true,
         composition: '',
         mainQualityCriteria: formValues.mainCriteria.filter(c => c.name),
         safetyCriteria: [
           ...formValues.microbiologicalCriteria.filter(c => c.name).map(c => ({ ...(c as any), category: 'micro' })),
           ...formValues.heavyMetalCriteria.filter(c => c.name).map(c => ({ ...(c as any), category: 'metal' })),
           ...(formValues.mycotoxinCriteria || []).filter(c => c.name).map(c => ({ ...(c as any), category: 'mycotoxin' }))
         ],
         alternateRules: formValues.alternateRules.filter(r => r.main && r.alt),
         createdAt: new Date().toISOString(),
       };

       if (id && !cloneId) {
         const existingTCCS = tccsList.find(t => t.id === id);
         if (existingTCCS) {
           await updateTCCS({ ...existingTCCS, ...tccsData });
           notify({ type: 'SUCCESS', title: 'Thành công', message: 'Đã cập nhật hồ sơ TCCS.' });
           logAuditAction({
             action: 'UPDATE',
             collection: 'TCCS',
             documentId: id,
             details: `Cập nhật hồ sơ TCCS: ${tccsData.code}`,
             performedBy: useAppStore.getState().user?.email || 'unknown'
           });
         }
       } else {
         await addTCCS(tccsData);
         clearDraft();
         notify({ type: 'SUCCESS', title: 'Thành công', message: 'Đã tạo hồ sơ TCCS mới.' });
         logAuditAction({
           action: 'CREATE',
           collection: 'TCCS',
           documentId: tccsData.id,
           details: `${cloneId ? 'Sao chép' : 'Tạo mới'} hồ sơ TCCS: ${tccsData.code}`,
           performedBy: useAppStore.getState().user?.email || 'unknown'
         });
       }
       navigate('/tccs');
     } catch (error) {
       console.error(error);
     } finally {
       setIsSubmitting(false);
     }
  };

  const allCriteriaNames = useMemo(() => {
    const names = new Set<string>();
    tccsList.forEach(t => {
        (t.mainQualityCriteria || []).forEach(c => c && c.name && names.add(c.name));
        (t.safetyCriteria || []).forEach(c => c && c.name && names.add(c.name));
    });
    return Array.from(names).sort();
  }, [tccsList]);

  const selectedFormula = useMemo(() => {
    return productFormulas.find(f => f.productId === formValues.productId);
  }, [productFormulas, formValues.productId]);

  const productIngredients = useMemo(() => {
    if (!selectedFormula) return [];
    return [...(selectedFormula.ingredients || []), ...(selectedFormula.excipients || [])];
  }, [selectedFormula]);

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

      <div className="bg-surface rounded-xl shadow-xs border border-border p-6">
        <form onSubmit={handleSave}>
          <div className="space-y-6 pr-1">
            <datalist id="criteria-name-suggestions">{allCriteriaNames.map(name => <option key={name} value={name} />)}</datalist>
            <datalist id="criteria-unit-suggestions">{COMMON_CRITERIA_UNITS.map(unit => <option key={unit} value={unit} />)}</datalist>
            
            {(!id || cloneId) && (
              <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 flex gap-3">
                  <InformationCircleIcon className="text-blue-600 dark:text-blue-400 shrink-0 w-5 h-5 mt-0.5" />
                  <div className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                      Để đổi tên một chỉ tiêu đã có trên toàn hệ thống, vui lòng sử dụng trang <a href="/criteria" target="_blank" className="font-bold underline">Danh mục Chỉ tiêu</a>. Việc sửa tên trực tiếp ở đây sẽ tạo một chỉ tiêu mới.
                  </div>
              </div>
            )}

            <SpecialCharToolbar className="-mx-2 px-2" />

            {/* 1. Thông tin Sản phẩm */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <CubeIcon className="w-4 h-4" /> 1. Thông tin Sản phẩm
                </div>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted w-5 h-5" />
                  <input 
                    type="text" 
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                      if (!e.target.value) setFieldValue('productId', '');
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                    placeholder="Tìm sản phẩm để tạo TCCS mới..."
                    className={`w-full pl-10 pr-10 py-2.5 bg-surface border border-border rounded-xl font-medium text-ink placeholder:text-ink-muted outline-none text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all ${errors.productId ? 'ring-2 ring-red-500 border-red-500' : ''}`}
                    disabled={!!id && !cloneId} 
                  />
                  {formValues.productId && <CheckCircleIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-600 w-5 h-5" />}
                  
                  {showProductDropdown && (!id || cloneId) && (
                    <div className="absolute z-20 w-full mt-2 bg-surface rounded-xl shadow-xl border border-border max-h-60 overflow-y-auto divide-y divide-border">
                      {products.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                          <div 
                            key={p.id} onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setFieldValue('productId', p.id); setProductSearch(`${p.code} - ${p.name}`); setShowProductDropdown(false); }}
                            className={`px-4 py-3 hover:bg-surface-2 cursor-pointer transition-colors ${formValues.productId === p.id ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : ''}`}
                          >
                            <p className="text-sm font-semibold text-ink">{p.name}</p>
                            <p className="text-[11px] font-mono text-ink-muted uppercase">{p.code}</p>
                          </div>
                      ))}
                    </div>
                  )}
                  {errors.productId && <p className="text-red-500 text-xs font-medium mt-1 pl-1">{errors.productId}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <input 
                      placeholder="Mã hiệu TCCS (VD: TCCS-01:2024)" 
                      name="code" 
                      value={formValues.code} 
                      onChange={handleChange} 
                      className={`w-full px-4 py-2.5 bg-surface border border-border rounded-xl font-medium text-ink placeholder:text-ink-muted outline-none text-sm uppercase focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all ${errors.code ? 'ring-2 ring-red-500 border-red-500' : ''}`} 
                    />
                    {errors.code && <p className="text-red-500 text-xs font-medium mt-1 pl-1">{errors.code}</p>}
                  </div>
                  <div className="space-y-1 flex items-end">
                    <DSDateInput value={formValues.issueDate} onChange={(val) => setFieldValue('issueDate', val)} />
                    {errors.issueDate && <p className="text-red-500 text-xs font-medium mt-1 pl-1">{errors.issueDate}</p>}
                  </div>
                </div>
            </div>

            {/* 2. Chỉ tiêu chất lượng */}
            <div className="space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <ChartBarSquareIcon className="h-4 w-4" /> 2. Chỉ tiêu Chất lượng chính
                </div>
                
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Dropdown Mẫu Dược điển */}
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleApplyPharmacopoeiaTemplate(e.target.value as DosageFormType);
                        e.target.value = '';
                      }
                    }}
                    className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 px-2.5 py-1.5 rounded-lg outline-none cursor-pointer hover:bg-indigo-100 transition-colors"
                    defaultValue=""
                  >
                    <option value="" disabled>📖 AI Gợi ý mẫu Dược điển...</option>
                    <option value="TABLET">💊 Viên nén (DĐVN V)</option>
                    <option value="CAPSULE">💊 Viên nang (DĐVN V)</option>
                    <option value="SYRUP">🧪 Siro / Dung dịch uống</option>
                    <option value="POWDER_GRANULE">🌾 Cốm / Bột pha</option>
                    <option value="INJECTION">💉 Thuốc tiêm / Truyền</option>
                    <option value="CREAM_OINTMENT">🧴 Thuốc mỡ / Kem</option>
                  </select>

                  {/* Dropdown Đồng bộ Công thức */}
                  <select
                    disabled={!formValues.productId}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleFetchCriteriaFromFormula(Number(e.target.value));
                        e.target.value = '';
                      }
                    }}
                    className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 px-2.5 py-1.5 rounded-lg outline-none cursor-pointer hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    defaultValue=""
                  >
                    <option value="" disabled>⚡ Đồng bộ từ Công thức...</option>
                    <option value="5">Chuẩn Dược điển (±5%)</option>
                    <option value="10">Chuẩn TCCS thông thường (±10%)</option>
                    <option value="20">Biên độ rộng (±20%)</option>
                  </select>

                  <button 
                    type="button" 
                    onClick={() => addToArray('mainCriteria', { name: '', unit: '', min: undefined, max: undefined, type: CriterionType.NUMBER, notes: '' })} 
                    className="p-2 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors border border-amber-200 dark:border-amber-800/40" 
                    title="Thêm chỉ tiêu thủ công"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Conflict Warnings */}
              {formValues.productId && selectedFormula && checkTCCSFormulaConflicts(formValues.mainCriteria, selectedFormula).length > 0 && (
                <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl space-y-1">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <ExclamationCircleIcon className="h-4 w-4 text-amber-600" /> Cảnh báo đồng bộ Công thức & TCCS:
                  </p>
                  <ul className="text-xs font-medium text-amber-700 dark:text-amber-400 space-y-0.5 pl-4 list-disc">
                    {checkTCCSFormulaConflicts(formValues.mainCriteria, selectedFormula).map((warn, wIdx) => (
                      <li key={wIdx}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}
              {formValues.mainCriteria.map((c, i) => {
                const isMinMaxError = c.type === CriterionType.NUMBER && c.min !== undefined && c.max !== undefined && c.min !== null && c.max !== null && Number(c.min) > Number(c.max);
                return (
                <div key={i} className={`flex flex-col gap-1 p-2 rounded-xl border transition-all group ${isMinMaxError ? 'bg-rose-500/10 border-rose-500/30' : 'bg-surface-2 border-border hover:border-border-strong'}`}>
                  <div className="flex gap-2 items-center">
                    <select value={c.type} onChange={(e) => updateInArray('mainCriteria', i, 'type', e.target.value as any)} className="w-16 px-1 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none border border-border shadow-xs"><option value="NUMBER">Số</option><option value="TEXT">Chữ</option></select>
                    <input placeholder="Tên chỉ tiêu" value={c.name} onChange={(e) => updateInArray('mainCriteria', i, 'name', e.target.value)} className="flex-[2] px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none border border-border shadow-xs" list="criteria-name-suggestions" />
                    <input placeholder="ĐVT" value={c.unit} onChange={(e) => updateInArray('mainCriteria', i, 'unit', e.target.value)} className="w-16 px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none text-center border border-border shadow-xs" list="criteria-unit-suggestions" />
                    {c.type === CriterionType.NUMBER ? (
                      <><input type="text" inputMode="decimal" placeholder="Min" value={c.min ?? ''} onChange={(e) => { const v = autoFormatInput(e.target.value); updateInArray('mainCriteria', i, 'min', v === '' ? undefined : v as any); }} onBlur={(e) => { const v = e.target.value; const n = parseNumberFromText(v); if (v !== '' && !isNaN(n) && !v.trim().endsWith('.')) updateInArray('mainCriteria', i, 'min', n); }} className={`w-20 px-3 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none text-right border border-border shadow-xs font-mono ${isMinMaxError ? 'border-rose-500 text-rose-600 bg-rose-500/10' : ''}`} />
                       <input type="text" inputMode="decimal" placeholder="Max" value={c.max ?? ''} onChange={(e) => { const v = autoFormatInput(e.target.value); updateInArray('mainCriteria', i, 'max', v === '' ? undefined : v as any); }} onBlur={(e) => { const v = e.target.value; const n = parseNumberFromText(v); if (v !== '' && !isNaN(n) && !v.trim().endsWith('.')) updateInArray('mainCriteria', i, 'max', n); }} className={`w-20 px-3 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none text-right border border-border shadow-xs font-mono ${isMinMaxError ? 'border-rose-500 text-rose-600 bg-rose-500/10' : ''}`} />
                       <input type="text" placeholder="HL công bố" value={c.declaredContent ?? ''} onChange={(e) => { const v = autoFormatInput(e.target.value); updateInArray('mainCriteria', i, 'declaredContent', v === '' ? undefined : v); }} className="w-24 px-3 py-2 bg-emerald-500/10 rounded-lg text-xs font-semibold outline-none text-right border border-emerald-500/20 shadow-xs font-mono text-emerald-700 dark:text-emerald-400" title="Hàm lượng công bố (để làm gốc tính %)" /></>
                    ) : (
                      <div className="flex-[2] flex gap-2">
                        <div className="flex-1 flex flex-col gap-1">
                          <input type="text" placeholder="Mức quy định (VD: 15 ± 20%...)" value={c.expectedText || ''} onChange={(e) => updateInArray('mainCriteria', i, 'expectedText', e.target.value)} className="w-full px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none border border-border shadow-xs" />
                          {c.expectedText && calculateRangePreview(c.expectedText) && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold pl-1">{calculateRangePreview(c.expectedText)}</span>}
                        </div>
                        <input type="text" placeholder="HL công bố" value={c.declaredContent ?? ''} onChange={(e) => { const v = autoFormatInput(e.target.value); updateInArray('mainCriteria', i, 'declaredContent', v === '' ? undefined : v); }} className="w-24 px-3 py-2 bg-emerald-500/10 rounded-lg text-xs font-semibold outline-none text-right border border-emerald-500/20 shadow-xs font-mono text-emerald-700 dark:text-emerald-400 shrink-0" title="Hàm lượng công bố" />
                      </div>
                    )}
                    <button type="button" onClick={() => removeFromArray('mainCriteria', i)} className="p-2 text-ink-muted hover:text-rose-500 transition-colors"><XMarkIcon className="w-4 h-4" /></button>
                  </div>
                  {isMinMaxError && (
                    <p className="text-xs font-semibold text-rose-500 pl-2 flex items-center gap-1">
                      <ExclamationCircleIcon className="w-3.5 h-3.5 shrink-0" />
                      Giá trị Min ({c.min}) không được lớn hơn Max ({c.max})
                    </p>
                  )}
                  <div className="flex items-center gap-2 px-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <ArrowDownRightIcon className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                      <input placeholder="Ghi chú / Điều kiện (VD: Phương pháp thử...)" value={(c as any).notes || ''} onChange={(e) => updateInArray('mainCriteria', i, 'notes', e.target.value)} className="w-full bg-transparent text-xs text-ink-muted outline-none border-b border-transparent focus:border-border transition-colors" />
                  </div>
                  <div className="flex items-center gap-2 px-2 mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <ArrowDownRightIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <select 
                      value={c.formulaIngredientId || ''} 
                      onChange={(e) => updateInArray('mainCriteria', i, 'formulaIngredientId', e.target.value)}
                      className="px-2 py-1 bg-surface text-emerald-700 dark:text-emerald-400 rounded text-xs font-semibold outline-none border border-emerald-500/20 cursor-pointer"
                    >
                      <option value="">-- Liên kết với thành phần để tính % (Tùy chọn) --</option>
                      {productIngredients.map(ing => (
                        <option key={ing.id} value={ing.name}>{ing.name} ({ing.declaredContent} {ing.unit})</option>
                      ))}
                    </select>
                    {c.formulaIngredientId && (
                      <select 
                        value={c.calculationBasis || 'DECLARED'} 
                        onChange={(e) => updateInArray('mainCriteria', i, 'calculationBasis', e.target.value as any)}
                        className="px-2 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded text-xs font-semibold outline-none border border-emerald-500/20 cursor-pointer"
                      >
                        <option value="DECLARED">Tính % theo Muối/Hợp chất (Mặc định)</option>
                        <option value="ELEMENTAL">Tính % theo Ion/Base</option>
                      </select>
                    )}
                  </div>
                </div>
              );})}
            </div>

            {/* 3, 4 & 5. Chỉ tiêu Vi sinh, Kim loại, Độc tố vi nấm */}
            <div className="grid grid-cols-1 gap-6">
              {/* 3. Vi sinh vật */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheckIcon className="w-4 h-4" /> 3. Giới hạn Vi sinh vật
                  </div>
                  <button type="button" onClick={() => addToArray('microbiologicalCriteria', { name: '', unit: '', max: undefined, type: CriterionType.NUMBER, notes: '' })} className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-500/20 transition-colors"><PlusIcon className="w-4 h-4" /></button>
                </div>
                {formValues.microbiologicalCriteria.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center bg-surface-2 p-2 rounded-xl border border-border hover:border-border-strong transition-all">
                    <select value={c.type} onChange={(e) => updateInArray('microbiologicalCriteria', i, 'type', e.target.value as any)} className="w-16 px-1 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none border border-border shadow-xs"><option value="NUMBER">Số</option><option value="TEXT">Chữ</option></select>
                    <input placeholder="Tên chỉ tiêu" value={c.name} onChange={(e) => updateInArray('microbiologicalCriteria', i, 'name', e.target.value)} className="flex-[2] px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none border border-border shadow-xs" list="criteria-name-suggestions" />
                    <input placeholder="ĐVT" value={c.unit} onChange={(e) => updateInArray('microbiologicalCriteria', i, 'unit', e.target.value)} className="w-16 px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none text-center border border-border shadow-xs" list="criteria-unit-suggestions" />
                    {c.type === CriterionType.NUMBER ? (<div className="flex items-center gap-2 bg-surface px-3 w-32 border border-border shadow-xs rounded-lg"><span className="text-xs font-bold text-ink-muted">≤</span><input type="text" inputMode="decimal" placeholder="Max" value={c.max ?? ''} onChange={(e) => { const v = autoFormatInput(e.target.value); updateInArray('microbiologicalCriteria', i, 'max', v === '' ? undefined : v as any); }} onBlur={(e) => { const v = e.target.value; const n = parseNumberFromText(v); if (v !== '' && !isNaN(n) && !v.trim().endsWith('.')) updateInArray('microbiologicalCriteria', i, 'max', n); }} className="w-full bg-transparent py-2 text-xs font-semibold text-ink outline-none text-right font-mono" /></div>
                    ) : (<input type="text" placeholder="Giới hạn" value={c.expectedText || ''} onChange={(e) => updateInArray('microbiologicalCriteria', i, 'expectedText', e.target.value)} className="flex-[2] px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none border border-border shadow-xs" />)}
                    <button type="button" onClick={() => removeFromArray('microbiologicalCriteria', i)} className="p-2 text-ink-muted hover:text-rose-500 transition-colors"><XMarkIcon className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              
              {/* 4. Kim loại nặng */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheckIcon className="w-4 h-4" /> 4. Giới hạn Kim loại nặng
                  </div>
                  <button type="button" onClick={() => addToArray('heavyMetalCriteria', { name: '', unit: '', max: undefined, type: CriterionType.NUMBER, notes: '' })} className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-500/20 transition-colors"><PlusIcon className="w-4 h-4" /></button>
                </div>
                {formValues.heavyMetalCriteria.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center bg-surface-2 p-2 rounded-xl border border-border hover:border-border-strong transition-all">
                    <select value={c.type} onChange={(e) => updateInArray('heavyMetalCriteria', i, 'type', e.target.value as any)} className="w-16 px-1 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none border border-border shadow-xs"><option value="NUMBER">Số</option><option value="TEXT">Chữ</option></select>
                    <input placeholder="Tên chỉ tiêu" value={c.name} onChange={(e) => updateInArray('heavyMetalCriteria', i, 'name', e.target.value)} className="flex-[2] px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none border border-border shadow-xs" list="criteria-name-suggestions" />
                    <input placeholder="ĐVT" value={c.unit} onChange={(e) => updateInArray('heavyMetalCriteria', i, 'unit', e.target.value)} className="w-16 px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none text-center border border-border shadow-xs" list="criteria-unit-suggestions" />
                    {c.type === CriterionType.NUMBER ? (<div className="flex items-center gap-2 bg-surface px-3 w-32 border border-border shadow-xs rounded-lg"><span className="text-xs font-bold text-ink-muted">≤</span><input type="text" inputMode="decimal" placeholder="Max" value={c.max ?? ''} onChange={(e) => { const v = autoFormatInput(e.target.value); updateInArray('heavyMetalCriteria', i, 'max', v === '' ? undefined : v as any); }} onBlur={(e) => { const v = e.target.value; const n = parseNumberFromText(v); if (v !== '' && !isNaN(n) && !v.trim().endsWith('.')) updateInArray('heavyMetalCriteria', i, 'max', n); }} className="w-full bg-transparent py-2 text-xs font-semibold text-ink outline-none text-right font-mono" /></div>
                    ) : (<input type="text" placeholder="Giới hạn" value={c.expectedText || ''} onChange={(e) => updateInArray('heavyMetalCriteria', i, 'expectedText', e.target.value)} className="flex-[2] px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none border border-border shadow-xs" />)}
                    <button type="button" onClick={() => removeFromArray('heavyMetalCriteria', i)} className="p-2 text-ink-muted hover:text-rose-500 transition-colors"><XMarkIcon className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              {/* 5. Độc tố vi nấm & Khác */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheckIcon className="w-4 h-4" /> 5. Độc tố vi nấm & Chỉ tiêu An toàn khác
                  </div>
                  <button type="button" onClick={() => addToArray('mycotoxinCriteria', { name: '', unit: '', max: undefined, type: CriterionType.NUMBER, notes: '' })} className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors"><PlusIcon className="w-4 h-4" /></button>
                </div>
                {(formValues.mycotoxinCriteria || []).length === 0 ? (
                  <p className="text-xs text-ink-muted italic bg-surface-2 p-3 rounded-xl border border-border">Chưa có chỉ tiêu độc tố vi nấm / dư lượng nào. Nhấn dấu (+) để thêm nếu sản phẩm yêu cầu.</p>
                ) : (
                  (formValues.mycotoxinCriteria || []).map((c, i) => (
                    <div key={i} className="flex gap-2 items-center bg-surface-2 p-2 rounded-xl border border-border hover:border-border-strong transition-all">
                      <select value={c.type} onChange={(e) => updateInArray('mycotoxinCriteria', i, 'type', e.target.value as any)} className="w-16 px-1 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none border border-border shadow-xs"><option value="NUMBER">Số</option><option value="TEXT">Chữ</option></select>
                      <input placeholder="Tên chỉ tiêu (VD: Aflatoxin B1...)" value={c.name} onChange={(e) => updateInArray('mycotoxinCriteria', i, 'name', e.target.value)} className="flex-[2] px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none border border-border shadow-xs" list="criteria-name-suggestions" />
                      <input placeholder="ĐVT" value={c.unit} onChange={(e) => updateInArray('mycotoxinCriteria', i, 'unit', e.target.value)} className="w-16 px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none text-center border border-border shadow-xs" list="criteria-unit-suggestions" />
                      {c.type === CriterionType.NUMBER ? (<div className="flex items-center gap-2 bg-surface px-3 w-32 border border-border shadow-xs rounded-lg"><span className="text-xs font-bold text-ink-muted">≤</span><input type="text" inputMode="decimal" placeholder="Max" value={c.max ?? ''} onChange={(e) => { const v = autoFormatInput(e.target.value); updateInArray('mycotoxinCriteria', i, 'max', v === '' ? undefined : v as any); }} onBlur={(e) => { const v = e.target.value; const n = parseNumberFromText(v); if (v !== '' && !isNaN(n) && !v.trim().endsWith('.')) updateInArray('mycotoxinCriteria', i, 'max', n); }} className="w-full bg-transparent py-2 text-xs font-semibold text-ink outline-none text-right font-mono" /></div>
                      ) : (<input type="text" placeholder="Giới hạn" value={c.expectedText || ''} onChange={(e) => updateInArray('mycotoxinCriteria', i, 'expectedText', e.target.value)} className="flex-[2] px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none border border-border shadow-xs" />)}
                      <button type="button" onClick={() => removeFromArray('mycotoxinCriteria', i)} className="p-2 text-ink-muted hover:text-rose-500 transition-colors"><XMarkIcon className="w-4 h-4" /></button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 6. Điều kiện thay thế */}
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <ArrowsRightLeftIcon className="w-4 h-4" /> 6. Điều kiện thay thế (Tự động Pass)
                </div>
                <button type="button" onClick={() => addToArray('alternateRules', { main: '', alt: '' })} className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors"><PlusIcon className="w-4 h-4" /></button>
              </div>
              {formValues.alternateRules.map((rule, i) => (
                <div key={i} className="flex flex-col gap-2 bg-surface-2 p-3 rounded-xl border border-border">
                  <div className="flex items-center gap-2">
                    <select value={rule.main} onChange={(e) => updateInArray('alternateRules', i, 'main', e.target.value)} className="flex-1 px-3 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none border border-border shadow-xs">
                      <option value="">-- TC1 (Chỉ tiêu chính) --</option>{allCriteriaNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <ArrowRightIcon className="w-4 h-4 text-ink-muted shrink-0" />
                    <select value={rule.alt} onChange={(e) => updateInArray('alternateRules', i, 'alt', e.target.value)} className="flex-1 px-3 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none border border-border shadow-xs">
                      <option value="">-- TC2 (Chỉ tiêu phụ thuộc) --</option>{allCriteriaNames.filter(n => n !== rule.main).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <button type="button" onClick={() => removeFromArray('alternateRules', i)} className="p-2 text-ink-muted hover:text-rose-500 transition-colors"><XMarkIcon className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center gap-2 pl-2">
                    <select value={rule.type || 'FAIL_RETRY'} onChange={(e) => updateInArray('alternateRules', i, 'type', e.target.value as any)} className="px-2 py-1.5 bg-surface text-ink rounded-lg text-xs font-medium outline-none border border-border shadow-xs">
                      <option value="FAIL_RETRY">Nếu TC1 RỚT -&gt; Kiểm tra TC2</option>
                      <option value="CONDITIONAL_CHECK">Nếu TC1 ĐẠT và &gt; Giá trị -&gt; Kiểm tra TC2</option>
                    </select>
                    {rule.type === 'CONDITIONAL_CHECK' && <input type="number" placeholder="Ngưỡng..." value={rule.conditionValue || ''} onChange={(e) => updateInArray('alternateRules', i, 'conditionValue', e.target.value)} className="w-24 px-2 py-1.5 bg-surface text-ink rounded-lg text-xs font-semibold outline-none border border-border shadow-xs" />}
                  </div>
                </div>
              ))}
            </div>

          </div>
          
          <div className="pt-6 border-t border-border mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => navigate('/tccs')} className="px-5 py-2 text-ink-muted hover:text-ink font-medium text-xs hover:bg-surface-2 rounded-lg border border-border transition-colors">Hủy</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs shadow-xs flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50">
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
