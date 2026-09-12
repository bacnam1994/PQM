import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  ArrowPathIcon, 
  CheckIcon, 
  PlusIcon, 
  XMarkIcon, 
  Square3Stack3DIcon, 
  BookOpenIcon, 
  ShieldCheckIcon, 
  HashtagIcon, 
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store/useAppStore';
import { DSFormInput, DSSelect } from '../../components';
import { generateId } from '../../utils';
import { RawMaterial } from '../../types';
import { logAuditAction } from '../../services/auditService';
import { calculateStringSimilarity } from '../../services/ai/materialHarmonizerService';

export const COMMON_PHARMA_STANDARDS = [
  'Dược điển Việt Nam V (DĐVN V)',
  'USP (United States Pharmacopeia)',
  'Ph.Eur (European Pharmacopoeia)',
  'BP (British Pharmacopoeia)',
  'JP (Japanese Pharmacopoeia)',
  'TCCS - Tiêu chuẩn Nhà sản xuất',
  'Food Grade / Tiêu chuẩn Thực phẩm',
  'In-house Standard (Chuẩn nội bộ)'
];

// Validate định dạng CAS Number: digits-digits-digit (ví dụ: 90045-36-6)
const CAS_REGEX = /^\d{2,7}-\d{2}-\d{1}$/;
const validateCasNumber = (cas: string): boolean => {
  if (!cas || !cas.trim()) return true;
  return CAS_REGEX.test(cas.trim());
};

const MaterialFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // 1. Khởi tạo Hook & State
  const { rawMaterials, addRawMaterial, updateRawMaterial, notify, user } = useAppStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<RawMaterial | null>(null);

  // Form Fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'ACTIVE' | 'EXCIPIENT' | 'OTHER'>('ACTIVE');
  const [standard, setStandard] = useState('');
  const [casNumber, setCasNumber] = useState('');
  const [casError, setCasError] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [aliasInput, setAliasInput] = useState('');
  const [description, setDescription] = useState('');

  // Duplicate name warning (real-time debounce)
  const [duplicateWarnings, setDuplicateWarnings] = useState<RawMaterial[]>([]);
  const duplicateCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkDuplicateNames = useCallback((inputName: string, currentId?: string) => {
    if (duplicateCheckTimer.current) clearTimeout(duplicateCheckTimer.current);
    if (!inputName.trim() || inputName.trim().length < 3) {
      setDuplicateWarnings([]);
      return;
    }
    duplicateCheckTimer.current = setTimeout(() => {
      const warnings = rawMaterials.filter(m => {
        if (m.id === currentId) return false;
        const score = calculateStringSimilarity(inputName, m.name);
        if (score >= 0.80) return true;
        return (m.aliases || []).some(a => calculateStringSimilarity(inputName, a) >= 0.85);
      });
      setDuplicateWarnings(warnings);
    }, 400);
  }, [rawMaterials]);
  
  // 2. Load dữ liệu
  useEffect(() => {
    if (id && id !== 'new') {
      const material = rawMaterials.find(m => m.id === id);

      if (material) {
        setMaterialToEdit(material);
        setCode(material.code || '');
        setName(material.name || '');
        setCategory(material.category || 'ACTIVE');
        setStandard(material.standard || '');
        setCasNumber(material.casNumber || '');
        setCasError('');
        setAliases(material.aliases || []);
        setDescription(material.description || '');
      } else {
        notify({ type: 'ERROR', message: 'Không tìm thấy thông tin nguyên liệu này trong danh mục!' });
      }
    }
  }, [id, rawMaterials, notify]);

  const handleAddAlias = () => {
    const trimmed = aliasInput.trim();
    if (trimmed && !aliases.includes(trimmed)) {
      setAliases([...aliases, trimmed]);
      setAliasInput('');
    }
  };

  const removeAlias = (index: number) => {
    setAliases(aliases.filter((_, i) => i !== index));
  };

  const handleAliasKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAlias();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    const newAliases = pasteData
      .split(/[,;\n]+/)
      .map(item => item.trim())
      .filter(item => item !== '' && !aliases.includes(item));

    if (newAliases.length > 0) {
      setAliases(prev => [...prev, ...newAliases]);
    }
  };

  // 3. Hàm Save
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
     e.preventDefault();
     if (!name.trim()) {
       notify({ type: 'WARNING', message: 'Vui lòng nhập Tên nguyên liệu!' });
       return;
     }

     // Validate CAS Number
     if (casNumber.trim() && !validateCasNumber(casNumber)) {
       setCasError('Định dạng CAS không hợp lệ. Ví dụ đúng: 90045-36-6');
       return;
     }
     setCasError('');

     setIsSubmitting(true);
     try {
       const data: RawMaterial = {
         id: materialToEdit?.id || generateId('rm'),
         code: code.trim() || undefined,
         name: name.trim(),
         category,
         standard: standard.trim() || undefined,
         casNumber: casNumber.trim() || undefined,
         aliases: aliases.filter(a => a.trim() !== ''),
         description: description.trim() || undefined,
         createdAt: materialToEdit?.createdAt || new Date().toISOString(),
         updatedAt: new Date().toISOString(),
       };

       if (materialToEdit) {
         await updateRawMaterial(data);
         notify({ type: 'SUCCESS', title: 'Đã cập nhật', message: 'Thông tin nguyên liệu đã được lưu.' });
       } else {
         await addRawMaterial(data);
         notify({ type: 'SUCCESS', title: 'Thành công', message: 'Đã thêm nguyên liệu mới vào danh mục.' });
       }
       navigate('/materials');
     } catch (error) {
       console.error("Lỗi khi lưu nguyên liệu:", error);
     } finally {
       setIsSubmitting(false);
     }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <datalist id="pharma-standards-list">
        {COMMON_PHARMA_STANDARDS.map(s => <option key={s} value={s} />)}
      </datalist>

      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/materials')} 
          className="p-2 bg-surface text-ink-muted hover:text-emerald-700 dark:hover:text-emerald-400 rounded-lg border border-border shadow-xs transition-colors cursor-pointer"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
            {materialToEdit ? 'Chỉnh sửa Nguyên liệu Master' : 'Thêm Nguyên liệu Master mới'}
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            {materialToEdit 
              ? `Cập nhật thông tin chuẩn hóa cho: ${materialToEdit.name}` 
              : 'Định nghĩa tên chuẩn (canonical) và quy chuẩn kiểm soát cho danh mục toàn hệ thống.'}
          </p>
        </div>
      </div>

      <div className="bg-surface rounded-xl shadow-xs border border-border p-6 md:p-8">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-muted flex items-center gap-1.5">
                <HashtagIcon className="w-3.5 h-3.5 text-emerald-600" />
                Mã nguyên liệu (Code)
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="VD: NL-GINKGO-01"
                className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl font-medium text-sm outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 text-ink placeholder:text-ink-faint transition-all"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-ink-muted flex items-center gap-1.5">
                <BookOpenIcon className="w-3.5 h-3.5 text-emerald-600" />
                Tên nguyên liệu chuẩn (Canonical Name) *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  checkDuplicateNames(e.target.value, materialToEdit?.id);
                }}
                placeholder="VD: Ginkgo Biloba Extract (Cao khô Bạch quả)"
                required
                className={`w-full px-3.5 py-2.5 bg-surface border rounded-xl font-medium text-sm outline-none focus:ring-2 text-ink placeholder:text-ink-faint transition-all ${
                  duplicateWarnings.length > 0
                    ? 'border-amber-500 focus:ring-amber-500/20'
                    : 'border-border focus:ring-emerald-500/15 focus:border-emerald-500'
                }`}
              />
              {duplicateWarnings.length > 0 && (
                <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    <span>Phát hiện {duplicateWarnings.length} nguyên liệu tương đồng trong Master Catalog!</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {duplicateWarnings.map(w => (
                      <span key={w.id} className="inline-flex items-center gap-1 bg-surface border border-amber-500/30 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-800 dark:text-amber-300">
                        {w.name}{w.code ? ` (${w.code})` : ''}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1.5">💡 Kiểm tra kỹ trước khi lưu để tránh trùng lặp. Sử dụng AI Rà soát để gộp sau nếu cần.</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-muted">Phân loại</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl font-medium text-sm outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 text-ink cursor-pointer transition-all"
              >
                <option value="ACTIVE">Hoạt chất (Active Ingredient)</option>
                <option value="EXCIPIENT">Tá dược / Phụ liệu (Excipient)</option>
                <option value="OTHER">Khác (Bao bì, Dung môi...)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-muted flex items-center gap-1.5">
                <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                Tiêu chuẩn áp dụng
              </label>
              <input
                type="text"
                list="pharma-standards-list"
                value={standard}
                onChange={e => setStandard(e.target.value)}
                placeholder="VD: DĐVN V, USP 43..."
                className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl font-medium text-sm outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 text-ink placeholder:text-ink-faint transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-muted">Mã số CAS (Tùy chọn)</label>
              <input
                type="text"
                value={casNumber}
                onChange={e => {
                  setCasNumber(e.target.value);
                  if (casError) setCasError('');
                }}
                onBlur={e => {
                  if (e.target.value && !validateCasNumber(e.target.value)) {
                    setCasError('Định dạng CAS không hợp lệ. Ví dụ đúng: 90045-36-6');
                  } else {
                    setCasError('');
                  }
                }}
                placeholder="VD: 90045-36-6"
                className={`w-full px-3.5 py-2.5 bg-surface border rounded-xl font-medium text-sm outline-none focus:ring-2 text-ink placeholder:text-ink-faint font-mono transition-all ${
                  casError ? 'border-rose-500 focus:ring-rose-500/20' : 'border-border focus:ring-emerald-500/15 focus:border-emerald-500'
                }`}
              />
              {casError && (
                <p className="text-xs text-rose-500 font-medium pl-1 flex items-center gap-1 mt-1">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5" /> {casError}
                </p>
              )}
            </div>
          </div>

          {/* Aliases Tag Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-ink-muted flex items-center gap-2">
              <Square3Stack3DIcon className="w-4 h-4 text-emerald-600" />
              Các tên gọi khác & Bí danh (Aliases)
            </label>
            <div className="p-2.5 bg-surface-2/60 rounded-xl border border-border flex flex-wrap gap-2 min-h-[50px] items-center focus-within:ring-2 focus-within:ring-emerald-500/15 focus-within:border-emerald-500 transition-all">
              {aliases.map((alias, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-surface border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium px-2.5 py-1 rounded-lg shadow-xs">
                  {alias}
                  <button type="button" onClick={() => removeAlias(i)} className="text-ink-muted hover:text-rose-500 transition-colors cursor-pointer">
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex-1 flex items-center min-w-[140px]">
                <input
                  type="text"
                  value={aliasInput}
                  onChange={e => setAliasInput(e.target.value)}
                  onKeyDown={handleAliasKeyDown}
                  onPaste={handlePaste}
                  placeholder="Gõ tên khác rồi nhấn Enter hoặc dán danh sách..."
                  className="flex-1 bg-transparent outline-none text-xs p-1 placeholder:text-ink-faint font-medium text-ink"
                />
                <button 
                  type="button" 
                  onClick={handleAddAlias}
                  disabled={!aliasInput.trim()}
                  className="ml-2 p-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-600 hover:text-white transition-colors disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-ink-muted pl-1">
              💡 Gợi ý: Hỗ trợ tự động ánh xạ khi nhập phiếu kiểm nghiệm hoặc công thức có tên viết tắt.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-muted">Mô tả & Nguồn gốc xuất xứ</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ghi chú về nguồn gốc, quy cách bảo quản, nhà sản xuất, đặc tính kỹ thuật..."
              rows={3}
              className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl font-medium text-sm outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 text-ink placeholder:text-ink-faint resize-none transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
            <button
              type="button"
              onClick={() => navigate('/materials')}
              className="px-4 py-2 text-ink-muted hover:text-ink font-medium text-xs hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-medium text-xs flex items-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
              {materialToEdit ? 'Cập nhật Nguyên liệu' : 'Lưu Nguyên liệu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaterialFormPage;