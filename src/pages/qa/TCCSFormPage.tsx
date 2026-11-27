import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  DocumentDuplicateIcon,
  SparklesIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { useForm, useFormDraft } from '../../hooks';
import { CriterionType, TCCS, Criterion, Product, AlternateRule } from '../../types';
import {
  generateId,
  ensureArray,
  removeUndefined,
  parseFlexibleValue,
  normalizeNumericString,
  autoFormatInput,
  parseNumberFromText,
} from '../../utils';
import { SpecialCharToolbar } from '../../components';
import {
  PHARMACOPOEIA_TEMPLATES,
  generateCriteriaFromFormula,
  DosageFormType,
} from '../../services/ai/tccsAssistantService';
import {
  extractTccsFromFiles,
  NormalizedTccsExtractionResult,
} from '../../services/ai/tccsOcrService';
import { useCreateTCCSMutation, useUpdateTCCSMutation } from '../../hooks/queries/useTCCSQueries';
import { TccsGeneralSection } from './tccs-form/TccsGeneralSection';
import { TccsMainCriteriaTable } from './tccs-form/TccsMainCriteriaTable';
import { TccsSafetyCriteriaTable } from './tccs-form/TccsSafetyCriteriaTable';
import { TccsAlternateRulesSection } from './tccs-form/TccsAlternateRulesSection';
import { tccsFormSchema } from '../../schemas';
import { OperationalDraftBanner } from '../../components/operational';
import { useWorkflowActions } from '../../hooks/useWorkflowActions';
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

  const nonEmptyMain = ensureArray(values.mainCriteria).filter(
    (c) => c && c.name && c.name.trim() !== ''
  );
  const nonEmptySafety = [
    ...ensureArray(values.microbiologicalCriteria),
    ...ensureArray(values.heavyMetalCriteria),
    ...ensureArray(values.mycotoxinCriteria),
  ].filter((c) => c && c.name && c.name.trim() !== '');

  const zodResult = tccsFormSchema.safeParse({
    productId: values.productId,
    code: values.code,
    issueDate: values.issueDate,
    packaging: values.packaging || '',
    storage: values.storage || '',
    shelfLife: values.shelfLife || '',
    mainQualityCriteria: nonEmptyMain,
    safetyCriteria: nonEmptySafety,
  });

  if (!zodResult.success) {
    for (const issue of zodResult.error.issues) {
      const field = issue.path[0] as string;
      if (field && !errors[field]) {
        errors[field] = issue.message;
      }
    }
  }

  if (nonEmptyMain.length === 0 && nonEmptySafety.length === 0) {
    errors.mainQualityCriteria =
      'Vui lòng nhập ít nhất 1 chỉ tiêu chất lượng hoặc chỉ tiêu an toàn';
  }

  const checkMinMax = (list: Criterion[], sectionName: string, label: string) => {
    ensureArray(list).forEach((c, idx) => {
      if (
        c &&
        c.name &&
        c.name.trim() !== '' &&
        c.type === CriterionType.NUMBER &&
        c.min !== undefined &&
        c.max !== undefined &&
        c.min !== null &&
        c.max !== null &&
        String(c.min).trim() !== '' &&
        String(c.max).trim() !== ''
      ) {
        const minNum = parseNumberFromText(String(c.min));
        const maxNum = parseNumberFromText(String(c.max));
        if (!isNaN(minNum) && !isNaN(maxNum) && minNum > maxNum) {
          errors[`minMax_${sectionName}_${idx}`] =
            `Mục ${label} - Chỉ tiêu "${c.name || `#${idx + 1}`}": Min (${c.min}) không được lớn hơn Max (${c.max})`;
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

  const { products, tccsList, productFormulas, notify } = useAppStore(
    useShallow((s) => ({
      products: s.products,
      tccsList: s.tccsList,
      productFormulas: s.productFormulas,
      notify: s.notify,
    }))
  );
  const currentUser = useAppStore((state) => state.user);

  const createTCCSMutation = useCreateTCCSMutation();
  const updateTCCSMutation = useUpdateTCCSMutation();
  const { canExecute } = useWorkflowActions('TCCS', id);

  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const isInitializedRef = useRef<string | null>(null);
  const tccsFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isScanningTccs, setIsScanningTccs] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ step: string; percent: number } | null>(null);
  const [scanSummary, setScanSummary] = useState<NormalizedTccsExtractionResult | null>(null);

  const {
    values: formValues,
    setValues,
    validate,
    handleChange,
    setFieldValue,
    addToArray,
    removeFromArray,
    updateInArray,
    errors,
  } = useForm(initialTccsFormState, validateTCCS);

  const skipSave = useCallback((vals: TccsFormState) => {
    const hasCode = Boolean(vals?.code && vals.code.trim() !== '');
    const hasProduct = Boolean(vals?.productId && vals.productId.trim() !== '');
    const hasCriterionName = [
      ...(vals?.mainCriteria || []),
      ...(vals?.microbiologicalCriteria || []),
      ...(vals?.heavyMetalCriteria || []),
      ...(vals?.mycotoxinCriteria || []),
    ].some((c) => Boolean(c?.name && c.name.trim() !== ''));
    return !hasCode && !hasProduct && !hasCriterionName;
  }, []);

  const { clearDraft, hasDraft, draftTimestamp, restoreDraft, discardDraft } = useFormDraft({
    key: 'tccs_form_draft',
    formValues,
    setFormValues: setValues,
    isEnabled: !id && !cloneId,
    skipSave,
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
    if (!targetId) {
      isInitializedRef.current = null;
      return;
    }
    if (tccsList.length > 0 && isInitializedRef.current !== targetId) {
      const existing = tccsList.find((t) => t.id === targetId);
      if (existing) {
        isInitializedRef.current = targetId;
        const HEAVY_METAL_KEYWORDS = ['asen', 'chì', 'thủy ngân', 'cadmi', 'pb', 'cd', 'hg', 'as'];
        const MYCOTOXIN_KEYWORDS = [
          'aflatoxin',
          'ochratoxin',
          'patulin',
          'zearalenone',
          'độc tố vi nấm',
          'mycotoxin',
          'dư lượng',
        ];
        const safetyList = existing.safetyCriteria || [];
        const microList = safetyList.filter((c: any) => {
          if (!c) return false;
          if (c.category === 'micro') return true;
          if (c.category) return false;
          const nl = (c.name || '').toLowerCase();
          return (
            !HEAVY_METAL_KEYWORDS.some((kw) => nl.includes(kw)) &&
            !MYCOTOXIN_KEYWORDS.some((kw) => nl.includes(kw))
          );
        });
        const metalList = safetyList.filter((c: any) => {
          if (!c) return false;
          if (c.category === 'metal') return true;
          if (c.category) return false;
          const nl = (c.name || '').toLowerCase();
          return HEAVY_METAL_KEYWORDS.some((kw) => nl.includes(kw));
        });
        const mycotoxinList = safetyList.filter((c: any) => {
          if (!c) return false;
          if (c.category === 'mycotoxin' || c.category === 'other') return true;
          if (c.category) return false;
          const nl = (c.name || '').toLowerCase();
          return MYCOTOXIN_KEYWORDS.some((kw) => nl.includes(kw));
        });

        setValues({
          productId: existing.productId,
          code: cloneId ? `${existing.code}-COPY` : existing.code,
          issueDate: existing.issueDate || new Date().toISOString().split('T')[0],
          packaging: existing.packaging || '',
          storage: existing.storage || '',
          shelfLife: existing.shelfLife || '',
          standardRefs:
            typeof existing.standardRefs === 'string'
              ? existing.standardRefs
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : existing.standardRefs || [],
          mainCriteria: existing.mainQualityCriteria || [],
          microbiologicalCriteria: microList,
          heavyMetalCriteria: metalList,
          mycotoxinCriteria: mycotoxinList,
          alternateRules: existing.alternateRules || [],
        });
        const p = products.find((prod) => prod.id === existing.productId);
        if (p) setProductSearch(`${p.code} - ${p.name}`);
      } else {
        notify({ type: 'ERROR', message: 'Không tìm thấy hồ sơ TCCS!' });
        navigate('/tccs');
      }
    } else if (
      targetId &&
      isInitializedRef.current === targetId &&
      !productSearch &&
      formValues.productId &&
      products.length > 0
    ) {
      const p = products.find((prod) => prod.id === formValues.productId);
      if (p) setProductSearch(`${p.code} - ${p.name}`);
    }
  }, [
    id,
    cloneId,
    tccsList,
    products,
    productSearch,
    formValues.productId,
    setValues,
    notify,
    navigate,
  ]);

  const selectedFormula = useMemo(() => {
    return productFormulas.find((f) => f.productId === formValues.productId);
  }, [productFormulas, formValues.productId]);

  const productIngredients = useMemo(() => {
    if (!selectedFormula) return [];
    return [...(selectedFormula.ingredients || []), ...(selectedFormula.excipients || [])];
  }, [selectedFormula]);

  const allCriteriaNames = useMemo(() => {
    const currentFormNames: string[] = [];
    const seen = new Set<string>();
    const addName = (name?: string, toCurrent = false) => {
      const clean = (name || '').trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        if (toCurrent) currentFormNames.push(clean);
      }
    };

    // Ưu tiên đưa các chỉ tiêu đang nhập trên chính TCCS này lên đầu danh sách (phục vụ chọn Điều kiện thay thế TC1 -> TC2)
    [
      ...ensureArray(formValues.mainCriteria),
      ...ensureArray(formValues.microbiologicalCriteria),
      ...ensureArray(formValues.heavyMetalCriteria),
      ...ensureArray(formValues.mycotoxinCriteria),
    ].forEach((c) => addName(c?.name, true));

    const historicalNames: string[] = [];
    tccsList.forEach((t) => {
      ensureArray(t.mainQualityCriteria).forEach((c) => {
        const clean = (c?.name || '').trim();
        if (clean && !seen.has(clean.toLowerCase())) {
          seen.add(clean.toLowerCase());
          historicalNames.push(clean);
        }
      });
      ensureArray(t.safetyCriteria).forEach((c) => {
        const clean = (c?.name || '').trim();
        if (clean && !seen.has(clean.toLowerCase())) {
          seen.add(clean.toLowerCase());
          historicalNames.push(clean);
        }
      });
    });

    return [...currentFormNames, ...historicalNames.sort((a, b) => a.localeCompare(b, 'vi'))];
  }, [
    tccsList,
    formValues.mainCriteria,
    formValues.microbiologicalCriteria,
    formValues.heavyMetalCriteria,
    formValues.mycotoxinCriteria,
  ]);

  const handleApplyPharmacopoeiaTemplate = (dosageForm: DosageFormType) => {
    const template = PHARMACOPOEIA_TEMPLATES[dosageForm];
    if (!template) return;
    let added = 0;
    template.criteria.forEach((crit) => {
      if (
        !ensureArray(formValues.mainCriteria).some(
          (c) => (c?.name || '').toLowerCase() === (crit.name || '').toLowerCase()
        )
      ) {
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

  // Tự động mở hộp thoại chọn file nếu điều hướng từ nút "Scan bản cứng TCCS" (?autoScan=1)
  useEffect(() => {
    if (searchParams.get('autoScan') === '1' && tccsFileInputRef.current) {
      const timer = setTimeout(() => {
        tccsFileInputRef.current?.click();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const handleScanTccsFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files: File[] = Array.from(fileList);
    e.target.value = '';

    setIsScanningTccs(true);
    setScanProgress({ step: 'Đang chuẩn bị đọc bản cứng TCCS...', percent: 5 });

    try {
      const extracted = await extractTccsFromFiles(files, products, (step, percent) => {
        setScanProgress({ step, percent });
      });

      setScanSummary(extracted);

      setValues((prev) => ({
        ...prev,
        productId: extracted.matchedProduct?.id || prev.productId,
        code: extracted.code || prev.code,
        issueDate: extracted.issueDate || prev.issueDate,
        packaging: extracted.packaging || prev.packaging,
        storage: extracted.storage || prev.storage,
        shelfLife: extracted.shelfLife || prev.shelfLife,
        standardRefs:
          extracted.standardRefs.length > 0 ? extracted.standardRefs : prev.standardRefs,
        mainCriteria:
          extracted.mainCriteria.length > 0 ? extracted.mainCriteria : prev.mainCriteria,
        microbiologicalCriteria:
          extracted.microbiologicalCriteria.length > 0
            ? extracted.microbiologicalCriteria
            : prev.microbiologicalCriteria,
        heavyMetalCriteria:
          extracted.heavyMetalCriteria.length > 0
            ? extracted.heavyMetalCriteria
            : prev.heavyMetalCriteria,
        mycotoxinCriteria:
          extracted.mycotoxinCriteria.length > 0
            ? extracted.mycotoxinCriteria
            : prev.mycotoxinCriteria,
        alternateRules:
          extracted.alternateRules.length > 0 ? extracted.alternateRules : prev.alternateRules,
      }));

      if (extracted.matchedProduct) {
        setProductSearch(`${extracted.matchedProduct.code} - ${extracted.matchedProduct.name}`);
      } else if (extracted.productName) {
        setProductSearch(extracted.productName);
        setShowProductDropdown(true);
      }

      const totalCriteriaCount =
        extracted.mainCriteria.length +
        extracted.microbiologicalCriteria.length +
        extracted.heavyMetalCriteria.length +
        extracted.mycotoxinCriteria.length;

      toast.success(
        `Đã trích xuất thành công ${totalCriteriaCount} chỉ tiêu từ bản cứng TCCS (${extracted.pageCount} trang)!`
      );
    } catch (err: any) {
      console.error('[TCCS OCR Error]:', err);
      toast.error(err?.message || 'Lỗi khi quét bản cứng TCCS. Vui lòng thử lại.');
    } finally {
      setIsScanningTccs(false);
      setScanProgress(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      const currentErrors = validateTCCS(formValues);
      const firstErrorMsg = Object.values(currentErrors)[0];
      toast.error(
        firstErrorMsg ||
          'Vui lòng kiểm tra lại các trường thông tin bắt buộc hoặc giới hạn Min/Max!'
      );
      return;
    }

    const existingTccs = id && !cloneId ? tccsList.find((t) => t.id === id) : undefined;

    const sanitizeCriterion = (c: any, category?: string) => {
      const cleaned: any = {
        ...c,
        name: String(c.name || '').trim(),
        unit: String(c.unit || '').trim(),
        type:
          c.type === CriterionType.TEXT || c.type === 'TEXT'
            ? CriterionType.TEXT
            : CriterionType.NUMBER,
      };
      if (category) cleaned.category = category;
      if (cleaned.type === CriterionType.NUMBER) {
        if (c.min !== undefined && c.min !== null && String(c.min).trim() !== '') {
          const parsedMin = parseNumberFromText(String(c.min));
          cleaned.min = !isNaN(parsedMin) ? parsedMin : c.min;
        } else {
          delete cleaned.min;
        }
        if (c.max !== undefined && c.max !== null && String(c.max).trim() !== '') {
          const parsedMax = parseNumberFromText(String(c.max));
          cleaned.max = !isNaN(parsedMax) ? parsedMax : c.max;
        } else {
          delete cleaned.max;
        }
      } else {
        delete cleaned.min;
        delete cleaned.max;
      }
      return removeUndefined(cleaned);
    };

    const tccsData: TCCS = removeUndefined({
      id: id && !cloneId ? id : generateId('tccs'),
      productId: formValues.productId,
      code: formValues.code.toUpperCase(),
      issueDate: formValues.issueDate,
      packaging: formValues.packaging,
      storage: formValues.storage,
      shelfLife: formValues.shelfLife,
      standardRefs: formValues.standardRefs?.join(', ') || '',
      isActive: existingTccs ? existingTccs.isActive : true,
      composition: existingTccs?.composition || '',
      mainQualityCriteria: ensureArray(formValues.mainCriteria)
        .filter((c) => c && c.name && String(c.name).trim() !== '')
        .map((c) => sanitizeCriterion(c)),
      safetyCriteria: [
        ...ensureArray(formValues.microbiologicalCriteria)
          .filter((c) => c && c.name && String(c.name).trim() !== '')
          .map((c) => sanitizeCriterion(c, 'micro')),
        ...ensureArray(formValues.heavyMetalCriteria)
          .filter((c) => c && c.name && String(c.name).trim() !== '')
          .map((c) => sanitizeCriterion(c, 'metal')),
        ...ensureArray(formValues.mycotoxinCriteria)
          .filter((c) => c && c.name && String(c.name).trim() !== '')
          .map((c) => sanitizeCriterion(c, 'mycotoxin')),
      ],
      alternateRules: ensureArray(formValues.alternateRules).filter((r) => r && r.main && r.alt),
      createdAt: existingTccs?.createdAt || new Date().toISOString(),
    });

    try {
      if (id && !cloneId) {
        await updateTCCSMutation.mutateAsync({ tccs: tccsData, oldTCCS: existingTccs });
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
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
              Xây dựng tiêu chuẩn cơ sở thủ công hoặc quét tự động từ bản cứng TCCS (PDF / Ảnh chụp)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={tccsFileInputRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="hidden"
            onChange={handleScanTccsFiles}
          />
          <button
            type="button"
            disabled={isScanningTccs}
            onClick={() => tccsFileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {isScanningTccs ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <SparklesIcon className="w-4 h-4" />
            )}
            <span>
              {isScanningTccs ? 'Đang đọc bản cứng TCCS...' : 'Scan bản cứng TCCS (PDF / Ảnh)'}
            </span>
          </button>
        </div>
      </div>

      {/* Thanh tiến trình AI Scan bản cứng TCCS */}
      {isScanningTccs && scanProgress && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2 animate-pulse">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <span className="flex items-center gap-2">
              <ArrowPathIcon className="w-4 h-4 animate-spin text-emerald-600" />
              {scanProgress.step}
            </span>
            <span className="font-mono">{scanProgress.percent}%</span>
          </div>
          <div className="w-full h-1.5 bg-emerald-500/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
              style={{ width: `${scanProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Tóm tắt kết quả sau khi Scan bản cứng TCCS */}
      {scanSummary && !isScanningTccs && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                Đã nạp dữ liệu từ bản cứng TCCS ({scanSummary.pageCount} trang)
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {scanSummary.code && (
                  <span className="px-2 py-0.5 rounded bg-surface/80 border border-emerald-500/20 text-ink">
                    Mã TCCS: <strong>{scanSummary.code}</strong>
                  </span>
                )}
                {scanSummary.productName && (
                  <span className="px-2 py-0.5 rounded bg-surface/80 border border-emerald-500/20 text-ink">
                    Sản phẩm trên bản cứng: <strong>{scanSummary.productName}</strong>
                    {scanSummary.matchedProduct ? (
                      <span className="ml-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        (✓ Đã khớp mã {scanSummary.matchedProduct.code})
                      </span>
                    ) : (
                      <span className="ml-1 text-amber-600 dark:text-amber-400 font-semibold">
                        (⚠ Vui lòng chọn sản phẩm tương ứng trong danh mục)
                      </span>
                    )}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded bg-surface/80 border border-emerald-500/20 text-ink">
                  Chất lượng chính: <strong>{scanSummary.mainCriteria.length}</strong>
                </span>
                <span className="px-2 py-0.5 rounded bg-surface/80 border border-emerald-500/20 text-ink">
                  Vi sinh: <strong>{scanSummary.microbiologicalCriteria.length}</strong>
                </span>
                <span className="px-2 py-0.5 rounded bg-surface/80 border border-emerald-500/20 text-ink">
                  Kim loại nặng: <strong>{scanSummary.heavyMetalCriteria.length}</strong>
                </span>
                {scanSummary.mycotoxinCriteria.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-surface/80 border border-emerald-500/20 text-ink">
                    Độc tố vi nấm: <strong>{scanSummary.mycotoxinCriteria.length}</strong>
                  </span>
                )}
                {scanSummary.alternateRules.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-surface/80 border border-emerald-500/20 text-ink">
                    Quy tắc thay thế: <strong>{scanSummary.alternateRules.length}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setScanSummary(null)}
            className="p-1 text-ink-muted hover:text-ink rounded-lg"
            title="Đóng thông báo"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}
      <OperationalDraftBanner
        hasDraft={hasDraft && !id && !cloneId}
        draftTimestamp={draftTimestamp}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />

      <div className="bg-surface rounded-xl shadow-xs border border-border p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <SpecialCharToolbar />
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
              disabled={
                isSubmitting || !canExecute(id && !cloneId ? 'TCCS_UPDATE_DRAFT' : 'TCCS_CREATE')
              }
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
