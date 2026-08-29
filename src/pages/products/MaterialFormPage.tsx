import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, Plus, X as XIcon, Layers3, BookOpen, ShieldCheck, Hash, AlertTriangle } from 'lucide-react';
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
      // ✅ Bug 3 Fix: chỉ lookup by exact ID — không fallback theo name để tránh nhầm nguyên liệu
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
         // audit log đã được ghi trong store (updateRawMaterial)
         notify({ type: 'SUCCESS', title: 'Đã cập nhật', message: 'Thông tin nguyên liệu đã được lưu.' });
       } else {
         await addRawMaterial(data);
         // audit log đã được ghi trong store (addRawMaterial)
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
    <div className="p-6 max-w-4xl mx-auto animate-in fade-in duration-500 space-y-6">
      <datalist id="pharma-standards-list">
        {COMMON_PHARMA_STANDARDS.map(s => <option key={s} value={s} />)}
      </datalist>

      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/materials')} className="p-2.5 bg-white dark:bg-zinc-900 text-slate-500 hover:text-indigo-600 rounded-xl shadow-xs border border-slate-200/80 dark:border-zinc-800 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-zinc-100 uppercase tracking-tight">
            {materialToEdit ? 'Chỉnh sửa Nguyên liệu' : 'Thêm Nguyên liệu mới'}
          </h1>
          <p className="text-xs text-slate-400 dark:text-zinc-500 font-medium">
            Quản lý hồ sơ nguyên liệu chuẩn (Master Catalog), tiêu chuẩn Dược điển và bí danh (Aliases).
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-850 p-6 md:p-8">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-2 flex items-center gap-1.5">
                <Hash size={12} />
                Mã nguyên liệu (Code)
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="VD: NL-GINKGO-01"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-2 flex items-center gap-1.5">
                <BookOpen size={12} />
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
                className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-900 border rounded-xl font-bold text-sm outline-none focus:ring-2 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 ${
                  duplicateWarnings.length > 0
                    ? 'border-amber-400 dark:border-amber-600 focus:ring-amber-400'
                    : 'border-slate-200/80 dark:border-zinc-800 focus:ring-indigo-500'
                }`}
              />
              {/* Upgrade B: Cảnh báo trùng tên real-time trong FormPage */}
              {duplicateWarnings.length > 0 && (
                <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 mb-2">
                    <AlertTriangle size={12} />
                    <span>Phát hiện {duplicateWarnings.length} nguyên liệu tương đồng trong Master Catalog!</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {duplicateWarnings.map(w => (
                      <span key={w.id} className="inline-flex items-center gap-1 bg-white dark:bg-zinc-800 border border-amber-200 dark:border-amber-700 px-2.5 py-1 rounded-lg text-[11px] font-bold text-amber-800 dark:text-amber-300">
                        {w.name}{w.code ? ` (${w.code})` : ''}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-1.5">💡 Kiểm tra kỹ trước khi lưu để tránh trùng lặp. Sử dụng AI Rà soát để gộp sau nếu cần.</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-2">Phân loại</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200"
              >
                <option value="ACTIVE">Hoạt chất (Active Ingredient)</option>
                <option value="EXCIPIENT">Tá dược / Phụ liệu (Excipient)</option>
                <option value="OTHER">Khác (Bao bì, Dung môi...)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-2 flex items-center gap-1.5">
                <ShieldCheck size={12} />
                Tiêu chuẩn áp dụng
              </label>
              <input
                type="text"
                list="pharma-standards-list"
                value={standard}
                onChange={e => setStandard(e.target.value)}
                placeholder="VD: DĐVN V, USP 43..."
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-2">Mã số CAS (Tùy chọn)</label>
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
                className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-900 border rounded-xl font-bold text-sm outline-none focus:ring-2 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 font-mono ${
                  casError ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-400' : 'border-slate-200/80 dark:border-zinc-800 focus:ring-indigo-500'
                }`}
              />
              {casError && (
                <p className="text-[11px] text-rose-500 font-bold pl-2 flex items-center gap-1 mt-0.5">
                  <AlertTriangle size={11} /> {casError}
                </p>
              )}
            </div>
          </div>

          {/* Aliases Tag Input */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-2 flex items-center gap-2">
              <Layers3 size={13} className="text-indigo-500" />
              Các tên gọi khác & Bí danh (Aliases)
            </label>
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200/80 dark:border-zinc-800 flex flex-wrap gap-2 min-h-[50px] items-center focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
              {aliases.map((alias, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-indigo-100 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-400 text-xs font-bold px-2.5 py-1 rounded-lg shadow-xs animate-in zoom-in duration-200">
                  {alias}
                  <button type="button" onClick={() => removeAlias(i)} className="text-indigo-300 hover:text-rose-500 transition-colors">
                    <XIcon size={14} />
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
                  className="flex-1 bg-transparent outline-none text-xs p-1 placeholder:text-slate-400 font-medium text-slate-800 dark:text-zinc-200"
                />
                <button 
                  type="button" 
                  onClick={handleAddAlias}
                  disabled={!aliasInput.trim()}
                  className="ml-2 p-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors disabled:opacity-0 disabled:pointer-events-none"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 pl-2">
              💡 Gợi ý: Hỗ trợ tự động ánh xạ khi nhập phiếu kiểm nghiệm hoặc công thức có tên viết tắt.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-2">Mô tả & Nguồn gốc xuất xứ</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ghi chú về nguồn gốc, quy cách bảo quản, nhà sản xuất, đặc tính kỹ thuật..."
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl font-medium text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-zinc-850">
            <button
              type="button"
              onClick={() => navigate('/materials')}
              className="px-6 py-2.5 text-slate-500 dark:text-zinc-400 font-bold uppercase text-xs hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {materialToEdit ? 'Cập nhật Nguyên liệu' : 'Lưu Nguyên liệu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaterialFormPage;