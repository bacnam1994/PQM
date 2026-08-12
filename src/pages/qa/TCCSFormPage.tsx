import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, CheckCircle2, X, Plus, Info, Activity, ShieldCheck, ArrowRightLeft, CornerDownRight, ArrowRight, FlaskConical, Package, AlertCircle, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useForm, useFormDraft } from '../../hooks';
import { CriterionType, TCCS, Criterion } from '../../types';
import { generateId, parseFlexibleValue, normalizeNumericString, autoFormatInput, parseNumberFromText, parseDateToISO } from '../../utils';
import { SpecialCharToolbar, DSDateInput } from '../../components';
import { logAuditAction } from '../../services/auditService';

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

  // Kiểm tra Min > Max
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cloneId = searchParams.get('cloneId');

  // 1. Khởi tạo Hook & Bóc tách State
  const { tccsList, products, productFormulas, addTCCS, updateTCCS, notify } = useAppStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const {
    values: formValues, errors, setValues: setFormValues, resetForm: resetHookForm,
    validate, handleChange, setFieldValue, updateInArray, addToArray, removeFromArray,
  } = useForm(initialTccsFormState, validateTCCS);

  // --- USE FORM DRAFT HOOK ---
  const { checkDraft, clearDraft } = useFormDraft({
    key: 'TCCS_NEW_DRAFT',
    formValues,
    setFormValues,
    isEnabled: !id && !cloneId,
    onDraftLoaded: (data) => {
      setIsCloning(true);
      if (data.productId) {
        const p = products.find(x => x.id === data.productId);
        if (p) setProductSearch(`${p.code} - ${p.name}`);
      }
    }
  });

  // 2. Nạp dữ liệu khi Edit hoặc Clone
  useEffect(() => {
    const targetId = id || cloneId;
    if (targetId) {
      const tccs = tccsList.find(t => t.id === targetId);
      if (tccs) {
        const product = products.find(p => p.id === tccs.productId);
        setProductSearch(product ? `${product.code} - ${product.name}` : '');
        setIsCloning(!!cloneId);

        const HEAVY_METAL_KEYWORDS = ['asen', 'chì', 'thủy ngân', 'cadmi', 'pb', 'cd', 'hg', 'as'];
        const MYCOTOXIN_KEYWORDS = ['aflatoxin', 'ochratoxin', 'patulin', 'zearalenone', 'độc tố vi nấm', 'mycotoxin', 'dư lượng'];

        const micro = (tccs.safetyCriteria || []).filter(c => {
            if (!c) return false;
            const nameLower = (c.name || '').toLowerCase();
            if ((c as any).category === 'micro') return true;
            if (!(c as any).category && !HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw)) && !MYCOTOXIN_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
            return false;
        }).map(c => ({...c}));
        
        const metal = (tccs.safetyCriteria || []).filter(c => {
            if (!c) return false;
            const nameLower = (c.name || '').toLowerCase();
            if ((c as any).category === 'metal') return true;
            if (!(c as any).category && HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
            return false;
        }).map(c => ({...c}));

        const myco = (tccs.safetyCriteria || []).filter(c => {
            if (!c) return false;
            const nameLower = (c.name || '').toLowerCase();
            if ((c as any).category === 'mycotoxin' || (c as any).category === 'other') return true;
            if (!(c as any).category && MYCOTOXIN_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
            return false;
        }).map(c => ({...c}));

        setFormValues({
          productId: tccs.productId,
          code: cloneId ? `${tccs.code}-COPY` : tccs.code,
          issueDate: cloneId ? new Date().toISOString().split('T')[0] : parseDateToISO(tccs.issueDate),
          mainCriteria: (tccs.mainQualityCriteria || []).filter(c => c).length > 0 ? (tccs.mainQualityCriteria || []).filter(c => c).map(c => ({...c})) : initialTccsFormState.mainCriteria,
          microbiologicalCriteria: micro.length > 0 ? micro : initialTccsFormState.microbiologicalCriteria,
          heavyMetalCriteria: metal.length > 0 ? metal : initialTccsFormState.heavyMetalCriteria,
          mycotoxinCriteria: myco,
          alternateRules: ((tccs as any).alternateRules || []).map((r: any) => ({...r})),
        });
      } else {
        notify({ type: 'ERROR', message: 'Không tìm thấy hồ sơ TCCS!' });
        navigate('/tccs');
      }
    } else {
      checkDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, cloneId]);

  // Tự động điền dữ liệu TCCS cũ khi chọn Sản phẩm (chỉ khi tạo mới)
  useEffect(() => {
    if (formValues.productId && !id && !cloneId && !isCloning) {
      const latestVersion = tccsList
        .filter(t => t.productId === formValues.productId)
        .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())[0];

      if (latestVersion) {
        setFormValues(prev => ({
          ...prev,
          mainCriteria: (latestVersion.mainQualityCriteria || []).filter(c => c).length > 0 ? (latestVersion.mainQualityCriteria || []).map(c => ({...c})) : initialTccsFormState.mainCriteria,
          microbiologicalCriteria: (latestVersion.safetyCriteria || []).filter(c => c && (c as any).category === 'micro').length > 0 ? (latestVersion.safetyCriteria || []).filter(c => c && (c as any).category === 'micro').map(c => ({...c})) : initialTccsFormState.microbiologicalCriteria,
          heavyMetalCriteria: (latestVersion.safetyCriteria || []).filter(c => c && (c as any).category === 'metal').length > 0 ? (latestVersion.safetyCriteria || []).filter(c => c && (c as any).category === 'metal').map(c => ({...c})) : initialTccsFormState.heavyMetalCriteria,
          mycotoxinCriteria: (latestVersion.safetyCriteria || []).filter(c => c && ((c as any).category === 'mycotoxin' || (c as any).category === 'other')).map(c => ({...c})),
          alternateRules: ((latestVersion as any).alternateRules || []).map((r: any) => ({...r})),
        }));
      }
    }
  }, [formValues.productId, id, cloneId, tccsList, setFormValues, isCloning]);

  const handleFetchCriteriaFromFormula = () => {
    if (!formValues.productId) return notify({ type: 'WARNING', message: 'Vui lòng chọn sản phẩm trước.' });
    const formula = productFormulas.find(f => f.productId === formValues.productId);
    if (!formula || !formula.ingredients || formula.ingredients.length === 0) {
      return notify({ type: 'INFO', message: 'Sản phẩm này chưa có công thức hoặc công thức không có hoạt chất nào.' });
    }
    const newCriteria = formula.ingredients.map(ing => ({
      name: ing.name, unit: ing.unit, min: undefined, max: undefined, type: CriterionType.NUMBER, notes: `Hàm lượng công bố: ${ing.declaredContent} ${ing.unit}`
    }));
    const hasExisting = formValues.mainCriteria.some(c => c.name.trim() !== '');
    if (hasExisting && !window.confirm('Thao tác này sẽ ghi đè lên các chỉ tiêu chất lượng chính hiện tại. Tiếp tục?')) return;
    setFieldValue('mainCriteria', newCriteria);
    notify({ type: 'SUCCESS', message: `Đã lấy ${newCriteria.length} chỉ tiêu từ công thức.` });
  };

  // 3. Hàm Lưu chung
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
     e.preventDefault();
     if (!validate()) {
       const errorKeys = Object.keys(errors);
       const minMaxError = errorKeys.find(k => k.startsWith('minMax_'));
       if (minMaxError) {
         notify({ type: 'ERROR', title: 'Lỗi giá trị Min - Max', message: errors[minMaxError] });
       }
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

  const getAllCurrentCriteriaNames = () => {
    return [
      ...formValues.mainCriteria.map(c => c.name),
      ...formValues.microbiologicalCriteria.map(c => c.name),
      ...formValues.heavyMetalCriteria.map(c => c.name),
      ...(formValues.mycotoxinCriteria || []).map(c => c.name)
    ].filter(n => n.trim() !== '');
  };

  const selectedFormula = useMemo(() => {
    return productFormulas.find(f => f.productId === formValues.productId);
  }, [productFormulas, formValues.productId]);

  const productIngredients = useMemo(() => {
    if (!selectedFormula) return [];
    return [...(selectedFormula.ingredients || []), ...(selectedFormula.excipients || [])];
  }, [selectedFormula]);

  return (
    <div className="p-6 max-w-6xl mx-auto animate-in fade-in duration-500 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/tccs')} className="p-2 bg-white text-slate-500 hover:text-indigo-600 rounded-xl shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
          {id && !cloneId ? 'Chỉnh sửa TCCS' : cloneId ? 'Sao chép TCCS' : 'Tạo TCCS mới'}
        </h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <form onSubmit={handleSave}>
          <div className="space-y-6 pr-4">
            <datalist id="criteria-name-suggestions">{allCriteriaNames.map(name => <option key={name} value={name} />)}</datalist>
            <datalist id="criteria-unit-suggestions">{COMMON_CRITERIA_UNITS.map(unit => <option key={unit} value={unit} />)}</datalist>
            
            {(!id || cloneId) && (
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3">
                  <Info className="text-blue-600 shrink-0 mt-0.5" size={18} />
                  <div className="text-xs text-blue-800 leading-relaxed">
                      Để đổi tên một chỉ tiêu đã có trên toàn hệ thống, vui lòng sử dụng trang <a href="/criteria" target="_blank" className="font-bold underline">Danh mục Chỉ tiêu</a>. Việc sửa tên trực tiếp ở đây sẽ tạo một chỉ tiêu mới.
                  </div>
              </div>
            )}

            <SpecialCharToolbar className="-mx-4 px-4" />

            {/* 1. Thông tin Sản phẩm */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[#009639] font-black text-[10px] uppercase tracking-widest"><Package size={14}/> 1. Thông tin Sản phẩm</div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                      if (!e.target.value) setFieldValue('productId', '');
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                    placeholder="Tìm sản phẩm để tạo TCCS mới..."
                    className={`w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none shadow-inner text-sm focus:ring-2 focus:ring-[#009639] ${errors.productId ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                    disabled={!!id && !cloneId} 
                  />
                  {formValues.productId && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-[#009639]" size={16} />}
                  
                  {showProductDropdown && (!id || cloneId) && (
                    <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto">
                      {products.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                          <div 
                            key={p.id} onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setFieldValue('productId', p.id); setProductSearch(`${p.code} - ${p.name}`); setShowProductDropdown(false); }}
                            className={`px-4 py-3 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-none transition-colors ${formValues.productId === p.id ? 'bg-emerald-50' : ''}`}
                          >
                            <p className="text-sm font-bold text-slate-700">{p.name}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase">{p.code}</p>
                          </div>
                      ))}
                    </div>
                  )}
                  {errors.productId && <p className="text-red-500 text-[10px] font-bold mt-1 pl-2">{errors.productId}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <input placeholder="Mã hiệu TCCS" name="code" value={formValues.code} onChange={handleChange} className={`w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-black outline-none shadow-inner text-sm ${errors.code ? 'ring-2 ring-red-500 bg-red-50' : ''}`} />
                    {errors.code && <p className="text-red-500 text-[10px] font-bold pl-2">{errors.code}</p>}
                  </div>
                  <div className="space-y-1 flex items-end">
                    <DSDateInput value={formValues.issueDate} onChange={(val) => setFieldValue('issueDate', val)} />
                    {errors.issueDate && <p className="text-red-500 text-[10px] font-bold pl-2">{errors.issueDate}</p>}
                  </div>
                </div>
            </div>

            {/* 2. Chỉ tiêu chất lượng */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-amber-600 font-black text-[10px] uppercase tracking-widest"><Activity size={14}/> 2. Chỉ tiêu Chất lượng chính</div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleFetchCriteriaFromFormula} disabled={!formValues.productId} className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 transition-colors disabled:opacity-50">
                    <FlaskConical size={12} /> Lấy từ công thức
                  </button>
                  <button type="button" onClick={() => addToArray('mainCriteria', { name: '', unit: '', min: undefined, max: undefined, type: CriterionType.NUMBER, notes: '' })} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors"><Plus size={16}/></button>
                </div>
              </div>
              {formValues.mainCriteria.map((c, i) => {
                const isMinMaxError = c.type === CriterionType.NUMBER && c.min !== undefined && c.max !== undefined && c.min !== null && c.max !== null && Number(c.min) > Number(c.max);
                return (
                <div key={i} className={`flex flex-col gap-1 p-1.5 rounded-xl border transition-all group ${isMinMaxError ? 'bg-red-50/50 border-red-200' : 'bg-slate-50/50 hover:border-slate-200'}`}>
                  <div className="flex gap-2 items-center">
                    <select value={c.type} onChange={(e) => updateInArray('mainCriteria', i, 'type', e.target.value as any)} className="w-16 px-1 py-2 bg-white rounded-lg text-[10px] font-bold outline-none border border-slate-100 shadow-sm"><option value="NUMBER">Số</option><option value="TEXT">Chữ</option></select>
                    <input placeholder="Tên chỉ tiêu" value={c.name} onChange={(e) => updateInArray('mainCriteria', i, 'name', e.target.value)} className="flex-[2] px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100 shadow-sm" list="criteria-name-suggestions" />
                    <input placeholder="ĐVT" value={c.unit} onChange={(e) => updateInArray('mainCriteria', i, 'unit', e.target.value)} className="w-16 px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none text-center border border-slate-100 shadow-sm" list="criteria-unit-suggestions" />
                    {c.type === CriterionType.NUMBER ? (
                      <><input type="text" inputMode="decimal" placeholder="Min" value={c.min ?? ''} onChange={(e) => { const v = autoFormatInput(e.target.value); updateInArray('mainCriteria', i, 'min', v === '' ? undefined : v as any); }} onBlur={(e) => { const v = e.target.value; const n = parseNumberFromText(v); if (v !== '' && !isNaN(n) && !v.trim().endsWith('.')) updateInArray('mainCriteria', i, 'min', n); }} className={`w-20 px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none text-right border shadow-sm font-mono ${isMinMaxError ? 'border-red-400 text-red-700 bg-red-50' : ''}`} />
                       <input type="text" inputMode="decimal" placeholder="Max" value={c.max ?? ''} onChange={(e) => { const v = autoFormatInput(e.target.value); updateInArray('mainCriteria', i, 'max', v === '' ? undefined : v as any); }} onBlur={(e) => { const v = e.target.value; const n = parseNumberFromText(v); if (v !== '' && !isNaN(n) && !v.trim().endsWith('.')) updateInArray('mainCriteria', i, 'max', n); }} className={`w-20 px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none text-right border shadow-sm font-mono ${isMinMaxError ? 'border-red-400 text-red-700 bg-red-50' : ''}`} />
                       <input type="text" placeholder="HL công bố" value={c.declaredContent ?? ''} onChange={(e) => { const v = autoFormatInput(e.target.value); updateInArray('mainCriteria', i, 'declaredContent', v === '' ? undefined : v); }} className="w-24 px-3 py-2 bg-indigo-50/50 rounded-lg text-xs font-bold outline-none text-right border border-indigo-100 shadow-sm font-mono text-indigo-700" title="Hàm lượng công bố (để làm gốc tính %)" /></>
                    ) : (
                      <div className="flex-[2] flex gap-2">
                        <div className="flex-1 flex flex-col gap-1">
                          <input type="text" placeholder="Mức quy định (VD: 15 ± 20%...)" value={c.expectedText || ''} onChange={(e) => updateInArray('mainCriteria', i, 'expectedText', e.target.value)} className="w-full px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border shadow-sm" />
                          {c.expectedText && calculateRangePreview(c.expectedText) && <span className="text-[9px] text-emerald-600 font-black pl-1">{calculateRangePreview(c.expectedText)}</span>}
                        </div>
                        <input type="text" placeholder="HL công bố" value={c.declaredContent ?? ''} onChange={(e) => { const v = autoFormatInput(e.target.value); updateInArray('mainCriteria', i, 'declaredContent', v === '' ? undefined : v); }} className="w-24 px-3 py-2 bg-indigo-50/50 rounded-lg text-xs font-bold outline-none text-right border border-indigo-100 shadow-sm font-mono text-indigo-700 shrink-0" title="Hàm lượng công bố" />
                      </div>
                    )}
                    <button type="button" onClick={() => removeFromArray('mainCriteria', i)} className="p-2 text-slate-300 hover:text-red-500"><X size={16}/></button>
                  </div>
                  {isMinMaxError && (
                    <p className="text-[10px] font-bold text-red-600 pl-2 flex items-center gap-1">
                      <AlertCircle size={12} className="shrink-0" />
                      Giá trị Min ({c.min}) không được lớn hơn Max ({c.max})
                    </p>
                  )}
                  <div className="flex items-center gap-2 px-2 opacity-50 group-hover:opacity-100 transition-opacity">
                      <CornerDownRight size={12} className="text-slate-300 shrink-0" />
                      <input placeholder="Ghi chú / Điều kiện (VD: Phương pháp thử...)" value={(c as any).notes || ''} onChange={(e) => updateInArray('mainCriteria', i, 'notes', e.target.value)} className="w-full bg-transparent text-[10px] font-medium text-slate-500 outline-none border-b border-transparent focus:border-slate-300 transition-colors" />
                  </div>
                  <div className="flex items-center gap-2 px-2 mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <CornerDownRight size={12} className="text-indigo-300 shrink-0" />
                    <select 
                      value={c.formulaIngredientId || ''} 
                      onChange={(e) => updateInArray('mainCriteria', i, 'formulaIngredientId', e.target.value)}
                      className="px-2 py-1 bg-indigo-50/50 text-indigo-700 rounded text-[10px] font-bold outline-none border border-indigo-100 cursor-pointer"
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
                        className="px-2 py-1 bg-emerald-50/50 text-emerald-700 rounded text-[10px] font-bold outline-none border border-emerald-100 cursor-pointer"
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
                  <div className="flex items-center gap-2 text-red-600 font-black text-[10px] uppercase tracking-widest"><ShieldCheck size={14}/> 3. Giới hạn Vi sinh vật</div>
                  <button type="button" onClick={() => addToArray('microbiologicalCriteria', { name: '', unit: '', max: undefined, type: CriterionType.NUMBER, notes: '' })} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"><Plus size={16}/></button>
                </div>
                {formValues.microbiologicalCriteria.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center bg-slate-50/50 p-1.5 rounded-xl border hover:border-slate-200">
                    <select value={c.type} onChange={(e) => updateInArray('microbiologicalCriteria', i, 'type', e.target.value as any)} className="w-16 px-1 py-2 bg-white rounded-lg text-[10px] font-bold outline-none border border-slate-100 shadow-sm"><option value="NUMBER">Số</option><option value="TEXT">Chữ</option></select>
                    <input placeholder="Tên chỉ tiêu" value={c.name} onChange={(e) => updateInArray('microbiologicalCriteria', i, 'name', e.target.value)} className="flex-[2] px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border shadow-sm" list="criteria-name-suggestions" />
                    <input placeholder="ĐVT" value={c.unit} onChange={(e) => updateInArray('microbiologicalCriteria', i, 'unit', e.target.value)} className="w-16 px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none text-center border shadow-sm" list="criteria-unit-suggestions" />
                    {c.type === CriterionType.NUMBER ? (<div className="flex items-center gap-2 bg-white px-3 w-32 border shadow-sm rounded-lg"><span className="text-[10px] font-bold text-slate-400">≤</span><input type="text" inputMode="decimal" placeholder="Max" value={c.max ?? ''} onChange={(e) => { const v = autoFormatInput(e.target.value); updateInArray('microbiologicalCriteria', i, 'max', v === '' ? undefined : v as any); }} onBlur={(e) => { const v = e.target.value; const n = parseNumberFromText(v); if (v !== '' && !isNaN(n) && !v.trim().endsWith('.')) updateInArray('microbiologicalCriteria', i, 'max', n); }} className="w-full bg-transparent py-2 text-xs font-bold outline-none text-right font-mono" /></div>
                    ) : (<input type="text" placeholder="Giới hạn" value={c.expectedText || ''} onChange={(e) => updateInArray('microbiologicalCriteria', i, 'expectedText', e.target.value)} className="flex-[2] px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border shadow-sm" />)}
                    <button type="button" onClick={() => removeFromArray('microbiologicalCriteria', i)} className="p-2 text-slate-300 hover:text-red-500"><X size={16}/></button>
                  </div>
                ))}
              </div>
              
              {/* 4. Kim loại nặng */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-red-600 font-black text-[10px] uppercase tracking-widest"><ShieldCheck size={14}/> 4. Giới hạn Kim loại nặng</div>
                  <button type="button" onClick={() => addToArray('heavyMetalCriteria', { name: '', unit: '', max: undefined, type: CriterionType.NUMBER, notes: '' })} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"><Plus size={16}/></button>
                </div>
                {formValues.heavyMetalCriteria.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center bg-slate-50/50 p-1.5 rounded-xl border hover:border-slate-200">
                    <select value={c.type} onChange={(e) => updateInArray('heavyMetalCriteria', i, 'type', e.target.value as any)} className="w-16 px-1 py-2 bg-white rounded-lg text-[10px] font-bold outline-none border border-slate-100 shadow-sm"><option value="NUMBER">Số</option><option value="TEXT">Chữ</option></select>
                    <input placeholder="Tên chỉ tiêu" value={c.name} onChange={(e) => updateInArray('heavyMetalCriteria', i, 'name', e.target.value)} className="flex-[2] px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border shadow-sm" list="criteria-name-suggestions" />
                    <input placeholder="ĐVT" value={c.unit} onChange={(e) => updateInArray('heavyMetalCriteria', i, 'unit', e.target.value)} className="w-16 px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none text-center border shadow-sm" list="criteria-unit-suggestions" />
                    {c.type === CriterionType.NUMBER ? (<div className="flex items-center gap-2 bg-white px-3 w-32 border shadow-sm rounded-lg"><span className="text-[10px] font-bold text-slate-400">≤</span><input type="text" inputMode="decimal" placeholder="Max" value={c.max ?? ''} onChange={(e) => { const v = autoFormatInput(e.target.value); updateInArray('heavyMetalCriteria', i, 'max', v === '' ? undefined : v as any); }} onBlur={(e) => { const v = e.target.value; const n = parseNumberFromText(v); if (v !== '' && !isNaN(n) && !v.trim().endsWith('.')) updateInArray('heavyMetalCriteria', i, 'max', n); }} className="w-full bg-transparent py-2 text-xs font-bold outline-none text-right font-mono" /></div>
                    ) : (<input type="text" placeholder="Giới hạn" value={c.expectedText || ''} onChange={(e) => updateInArray('heavyMetalCriteria', i, 'expectedText', e.target.value)} className="flex-[2] px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border shadow-sm" />)}
                    <button type="button" onClick={() => removeFromArray('heavyMetalCriteria', i)} className="p-2 text-slate-300 hover:text-red-500"><X size={16}/></button>
                  </div>
                ))}
              </div>

              {/* 5. Độc tố vi nấm & Khác */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-amber-600 font-black text-[10px] uppercase tracking-widest"><ShieldCheck size={14}/> 5. Độc tố vi nấm & Chỉ tiêu An toàn khác</div>
                  <button type="button" onClick={() => addToArray('mycotoxinCriteria', { name: '', unit: '', max: undefined, type: CriterionType.NUMBER, notes: '' })} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors"><Plus size={16}/></button>
                </div>
                {(formValues.mycotoxinCriteria || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl">Chưa có chỉ tiêu độc tố vi nấm / dư lượng nào. Nhấn dấu (+) để thêm nếu sản phẩm yêu cầu.</p>
                ) : (
                  (formValues.mycotoxinCriteria || []).map((c, i) => (
                    <div key={i} className="flex gap-2 items-center bg-slate-50/50 p-1.5 rounded-xl border hover:border-slate-200">
                      <select value={c.type} onChange={(e) => updateInArray('mycotoxinCriteria', i, 'type', e.target.value as any)} className="w-16 px-1 py-2 bg-white rounded-lg text-[10px] font-bold outline-none border border-slate-100 shadow-sm"><option value="NUMBER">Số</option><option value="TEXT">Chữ</option></select>
                      <input placeholder="Tên chỉ tiêu (VD: Aflatoxin B1...)" value={c.name} onChange={(e) => updateInArray('mycotoxinCriteria', i, 'name', e.target.value)} className="flex-[2] px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border shadow-sm" list="criteria-name-suggestions" />
                      <input placeholder="ĐVT" value={c.unit} onChange={(e) => updateInArray('mycotoxinCriteria', i, 'unit', e.target.value)} className="w-16 px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none text-center border shadow-sm" list="criteria-unit-suggestions" />
                      {c.type === CriterionType.NUMBER ? (<div className="flex items-center gap-2 bg-white px-3 w-32 border shadow-sm rounded-lg"><span className="text-[10px] font-bold text-slate-400">≤</span><input type="text" inputMode="decimal" placeholder="Max" value={c.max ?? ''} onChange={(e) => { const v = autoFormatInput(e.target.value); updateInArray('mycotoxinCriteria', i, 'max', v === '' ? undefined : v as any); }} onBlur={(e) => { const v = e.target.value; const n = parseNumberFromText(v); if (v !== '' && !isNaN(n) && !v.trim().endsWith('.')) updateInArray('mycotoxinCriteria', i, 'max', n); }} className="w-full bg-transparent py-2 text-xs font-bold outline-none text-right font-mono" /></div>
                      ) : (<input type="text" placeholder="Giới hạn" value={c.expectedText || ''} onChange={(e) => updateInArray('mycotoxinCriteria', i, 'expectedText', e.target.value)} className="flex-[2] px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border shadow-sm" />)}
                      <button type="button" onClick={() => removeFromArray('mycotoxinCriteria', i)} className="p-2 text-slate-300 hover:text-red-500"><X size={16}/></button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 6. Điều kiện thay thế */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest"><ArrowRightLeft size={14}/> 6. Điều kiện thay thế (Tự động Pass)</div>
                <button type="button" onClick={() => addToArray('alternateRules', { main: '', alt: '' })} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"><Plus size={16}/></button>
              </div>
              {formValues.alternateRules.map((rule, i) => (
                <div key={i} className="flex flex-col gap-2 bg-indigo-50/30 p-3 rounded-xl border border-indigo-100">
                  <div className="flex items-center gap-2">
                    <select value={rule.main} onChange={(e) => updateInArray('alternateRules', i, 'main', e.target.value)} className="flex-1 px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border shadow-sm">
                      <option value="">-- TC1 (Chỉ tiêu chính) --</option>{getAllCurrentCriteriaNames().map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <ArrowRight size={16} className="text-indigo-400" />
                    <select value={rule.alt} onChange={(e) => updateInArray('alternateRules', i, 'alt', e.target.value)} className="flex-1 px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border shadow-sm">
                      <option value="">-- TC2 (Chỉ tiêu phụ thuộc) --</option>{getAllCurrentCriteriaNames().filter(n => n !== rule.main).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <button type="button" onClick={() => removeFromArray('alternateRules', i)} className="p-2 text-slate-300 hover:text-red-500"><X size={16}/></button>
                  </div>
                  <div className="flex items-center gap-2 pl-2">
                    <select value={rule.type || 'FAIL_RETRY'} onChange={(e) => updateInArray('alternateRules', i, 'type', e.target.value as any)} className="px-2 py-1.5 bg-white rounded-lg text-[10px] font-bold outline-none border shadow-sm">
                      <option value="FAIL_RETRY">Nếu TC1 RỚT -&gt; Kiểm tra TC2</option>
                      <option value="CONDITIONAL_CHECK">Nếu TC1 ĐẠT và &gt; Giá trị -&gt; Kiểm tra TC2</option>
                    </select>
                    {rule.type === 'CONDITIONAL_CHECK' && <input type="number" placeholder="Ngưỡng..." value={rule.conditionValue || ''} onChange={(e) => updateInArray('alternateRules', i, 'conditionValue', e.target.value)} className="w-24 px-2 py-1.5 bg-white rounded-lg text-[10px] font-bold outline-none border shadow-sm" />}
                  </div>
                </div>
              ))}
            </div>

          </div>
          
          <div className="pt-6 border-t mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => navigate('/tccs')} className="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-50 rounded-xl">Hủy</button>
            <button type="submit" disabled={isSubmitting} className="px-10 py-3 bg-[#009639] text-white rounded-xl font-black uppercase text-xs shadow-lg flex items-center gap-2">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {id && !cloneId ? 'Cập nhật TCCS' : 'Lưu hồ sơ TCCS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TCCSFormPage;
