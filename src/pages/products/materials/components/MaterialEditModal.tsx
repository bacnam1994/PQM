import React from 'react';
import { BookUser, Hash, AlertTriangle, Layers3, X as XIcon, Plus, Save, Loader2, Info, Package, FlaskConical } from 'lucide-react';
import { Modal } from '../../../../components';
import { RawMaterial, ProductFormula } from '../../../../types';
import { validateCasNumber } from '../hooks/useMaterialListState';

interface MaterialEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: string | null;
  selectedItem: RawMaterial | null;
  hydratedMap: Map<string, any>;
  productFormulas: ProductFormula[];
  formCode: string;
  setFormCode: (v: string) => void;
  formName: string;
  setFormName: (v: string) => void;
  formCategory: 'ACTIVE' | 'EXCIPIENT' | 'OTHER';
  setFormCategory: (v: 'ACTIVE' | 'EXCIPIENT' | 'OTHER') => void;
  formStandard: string;
  setFormStandard: (v: string) => void;
  formCasNumber: string;
  setFormCasNumber: (v: string) => void;
  formCasError: string;
  setFormCasError: (v: string) => void;
  formAliases: string[];
  formAliasInput: string;
  setFormAliasInput: (v: string) => void;
  formDescription: string;
  setFormDescription: (v: string) => void;
  duplicateWarnings: RawMaterial[];
  checkDuplicateNames: (name: string, currentId?: string) => void;
  handleAddAlias: () => void;
  removeAlias: (index: number) => void;
  handleAliasKeyDown: (e: React.KeyboardEvent) => void;
  handlePasteAlias: (e: React.ClipboardEvent) => void;
  handleSaveMaterial: (e: React.FormEvent) => Promise<void>;
  isSubmitting: boolean;
}

export const MaterialEditModal: React.FC<MaterialEditModalProps> = ({
  isOpen,
  onClose,
  mode,
  selectedItem,
  hydratedMap,
  productFormulas,
  formCode,
  setFormCode,
  formName,
  setFormName,
  formCategory,
  setFormCategory,
  formStandard,
  setFormStandard,
  formCasNumber,
  setFormCasNumber,
  formCasError,
  setFormCasError,
  formAliases,
  formAliasInput,
  setFormAliasInput,
  formDescription,
  setFormDescription,
  duplicateWarnings,
  checkDuplicateNames,
  handleAddAlias,
  removeAlias,
  handleAliasKeyDown,
  handlePasteAlias,
  handleSaveMaterial,
  isSubmitting
}) => {
  if (!isOpen) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={mode === 'ADD' ? "Thêm Nguyên liệu Chuẩn" : "Cập nhật Nguyên liệu"} 
      icon={BookUser}
    >
      {mode === 'EDIT' && selectedItem && (() => {
        const hydrated = hydratedMap.get(selectedItem.id);
        const usedProds = hydrated?.usedInProducts || [];
        const usedFormulas = productFormulas.filter(f =>
          (f.ingredients || []).some(i => i.materialId === selectedItem.id) ||
          (f.excipients || []).some(e => e.materialId === selectedItem.id)
        );
        if (usedProds.length === 0 && usedFormulas.length === 0) return null;
        return (
          <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl flex flex-wrap items-center gap-3">
            <Info size={14} className="text-indigo-500 shrink-0" />
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Đang sử dụng trong:</span>
            {usedProds.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 rounded-lg text-[11px] font-bold">
                <Package size={11} />
                {usedProds.length} sản phẩm
              </span>
            )}
            {usedFormulas.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 rounded-lg text-[11px] font-bold">
                <FlaskConical size={11} />
                {usedFormulas.length} công thức
              </span>
            )}
            <span className="text-[10px] text-indigo-400 dark:text-indigo-500 ml-auto">Thay đổi tên/alias sẽ ảnh hưởng đến toàn bộ liên kết này.</span>
          </div>
        );
      })()}

      <form onSubmit={handleSaveMaterial} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1 flex items-center gap-1">
              <Hash size={11} />
              Mã nguyên liệu
            </label>
            <input
              type="text"
              value={formCode}
              onChange={e => setFormCode(e.target.value)}
              placeholder="VD: NL-GINKGO-01"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400"
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1">
              Tên nguyên liệu chuẩn *
            </label>
            <input
              type="text"
              value={formName}
              onChange={e => {
                setFormName(e.target.value);
                checkDuplicateNames(e.target.value, selectedItem?.id);
              }}
              placeholder="VD: Ginkgo Biloba Extract (Cao khô Bạch quả)"
              required
              className={`w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border rounded-xl font-bold text-xs outline-none focus:ring-2 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 ${
                duplicateWarnings.length > 0
                  ? 'border-amber-400 dark:border-amber-600 focus:ring-amber-400'
                  : 'border-slate-200 dark:border-zinc-800 focus:ring-indigo-500'
              }`}
            />
            {duplicateWarnings.length > 0 && (
              <div className="mt-1.5 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 mb-1.5">
                  <AlertTriangle size={11} />
                  <span>Phát hiện {duplicateWarnings.length} nguyên liệu tương đồng trong Master Catalog!</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {duplicateWarnings.map(w => (
                    <span key={w.id} className="inline-flex items-center gap-1 bg-white dark:bg-zinc-800 border border-amber-200 dark:border-amber-700 px-2 py-0.5 rounded text-[10px] font-bold text-amber-800 dark:text-amber-300">
                      {w.name}{w.code ? ` (${w.code})` : ''}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1">💡 Kiểm tra kỹ trước khi lưu để tránh trùng lặp. Sử dụng AI Rà soát để gộp nếu cần.</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1">Phân loại</label>
            <select
              value={formCategory}
              onChange={e => setFormCategory(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200"
            >
              <option value="ACTIVE">Hoạt chất (Active)</option>
              <option value="EXCIPIENT">Tá dược (Excipient)</option>
              <option value="OTHER">Khác (Bao bì, Dung môi...)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1">Tiêu chuẩn áp dụng</label>
            <input
              type="text"
              list="standards-datalist"
              value={formStandard}
              onChange={e => setFormStandard(e.target.value)}
              placeholder="VD: DĐVN V, USP..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1">Mã CAS (Tùy chọn)</label>
            <input
              type="text"
              value={formCasNumber}
              onChange={e => {
                setFormCasNumber(e.target.value);
                if (formCasError) setFormCasError('');
              }}
              onBlur={e => {
                if (e.target.value && !validateCasNumber(e.target.value)) {
                  setFormCasError('Định dạng CAS không hợp lệ. Ví dụ đúng: 90045-36-6');
                } else {
                  setFormCasError('');
                }
              }}
              placeholder="VD: 90045-36-6"
              className={`w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border rounded-xl font-mono text-xs outline-none focus:ring-2 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 ${
                formCasError ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-400' : 'border-slate-200 dark:border-zinc-800 focus:ring-indigo-500'
              }`}
            />
            {formCasError && (
              <p className="text-[10px] text-rose-500 font-bold pl-1 flex items-center gap-1">
                <AlertTriangle size={10} /> {formCasError}
              </p>
            )}
          </div>
        </div>

        {/* Aliases Tag Input */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1 flex items-center gap-1.5">
            <Layers3 size={12} className="text-indigo-500" />
            Các tên gọi khác & Bí danh (Aliases)
          </label>
          <div className="p-2 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 flex flex-wrap gap-1.5 min-h-[44px] items-center focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
            {formAliases.map((alias, i) => (
              <div key={i} className="flex items-center gap-1 bg-white dark:bg-zinc-800 border border-indigo-100 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-400 text-xs font-bold px-2 py-0.5 rounded-lg shadow-2xs">
                {alias}
                <button type="button" onClick={() => removeAlias(i)} className="text-indigo-300 hover:text-rose-500 cursor-pointer">
                  <XIcon size={13} />
                </button>
              </div>
            ))}
            <div className="flex-1 flex items-center min-w-[120px]">
              <input
                type="text"
                value={formAliasInput}
                onChange={e => setFormAliasInput(e.target.value)}
                onKeyDown={handleAliasKeyDown}
                onPaste={handlePasteAlias}
                placeholder="Gõ tên khác rồi nhấn Enter..."
                className="flex-1 bg-transparent outline-none text-xs p-1 placeholder:text-slate-400 font-medium text-slate-800 dark:text-zinc-200"
              />
              <button 
                type="button" 
                onClick={handleAddAlias}
                disabled={!formAliasInput.trim()}
                className="ml-1 p-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 pl-1">Nhấn Enter hoặc dán danh sách phân cách bằng dấu phẩy để thêm nhiều alias.</p>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1">Mô tả / Ghi chú</label>
          <textarea
            value={formDescription}
            onChange={e => setFormDescription(e.target.value)}
            placeholder="Ghi chú về nguồn gốc, nhà sản xuất..."
            rows={2}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-medium text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-zinc-850">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-slate-500 dark:text-zinc-400 font-bold uppercase text-xs hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-xl cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {mode === 'ADD' ? "Thêm mới" : "Cập nhật"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
