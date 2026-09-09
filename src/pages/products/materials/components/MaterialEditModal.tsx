import React from 'react';
import {
  IdentificationIcon,
  HashtagIcon,
  ExclamationTriangleIcon,
  Square3Stack3DIcon,
  XMarkIcon,
  PlusIcon,
  CheckIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  CubeIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
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
      icon={IdentificationIcon}
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
          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex flex-wrap items-center gap-3">
            <InformationCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Đang sử dụng trong:</span>
            {usedProds.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 rounded-md text-[11px] font-bold">
                <CubeIcon className="h-3 w-3" />
                {usedProds.length} sản phẩm
              </span>
            )}
            {usedFormulas.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 rounded-md text-[11px] font-bold">
                <BeakerIcon className="h-3 w-3" />
                {usedFormulas.length} công thức
              </span>
            )}
            <span className="text-[10px] text-ink-muted ml-auto">Thay đổi tên/alias sẽ ảnh hưởng đến toàn bộ liên kết này.</span>
          </div>
        );
      })()}

      <form onSubmit={handleSaveMaterial} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-ink-muted uppercase tracking-wider pl-0.5 flex items-center gap-1">
              <HashtagIcon className="h-3 w-3" />
              Mã nguyên liệu
            </label>
            <input
              type="text"
              value={formCode}
              onChange={e => setFormCode(e.target.value)}
              placeholder="VD: NL-GINKGO-01"
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg font-mono font-semibold text-xs outline-none focus:ring-2 focus:ring-emerald-500 text-ink placeholder:text-ink-muted"
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-bold text-ink-muted uppercase tracking-wider pl-0.5">
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
              className={`w-full px-3 py-2 bg-surface-2 border rounded-lg font-semibold text-xs outline-none focus:ring-2 text-ink placeholder:text-ink-muted ${
                duplicateWarnings.length > 0
                  ? 'border-amber-400 focus:ring-amber-400'
                  : 'border-border focus:ring-emerald-500'
              }`}
            />
            {duplicateWarnings.length > 0 && (
              <div className="mt-1.5 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300 mb-1">
                  <ExclamationTriangleIcon className="h-3 w-3" />
                  <span>Phát hiện {duplicateWarnings.length} nguyên liệu tương đồng trong Master Catalog!</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {duplicateWarnings.map(w => (
                    <span key={w.id} className="inline-flex items-center gap-1 bg-surface border border-amber-200 dark:border-amber-700 px-2 py-0.5 rounded text-[10px] font-medium text-amber-800 dark:text-amber-300">
                      {w.name}{w.code ? ` (${w.code})` : ''}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">💡 Kiểm tra kỹ trước khi lưu để tránh trùng lặp. Sử dụng AI Rà soát để gộp nếu cần.</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-ink-muted uppercase tracking-wider pl-0.5">Phân loại</label>
            <select
              value={formCategory}
              onChange={e => setFormCategory(e.target.value as any)}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg font-semibold text-xs outline-none focus:ring-2 focus:ring-emerald-500 text-ink"
            >
              <option value="ACTIVE">Hoạt chất (Active)</option>
              <option value="EXCIPIENT">Tá dược (Excipient)</option>
              <option value="OTHER">Khác (Bao bì, Dung môi...)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-ink-muted uppercase tracking-wider pl-0.5">Tiêu chuẩn áp dụng</label>
            <input
              type="text"
              list="standards-datalist"
              value={formStandard}
              onChange={e => setFormStandard(e.target.value)}
              placeholder="VD: DĐVN V, USP..."
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg font-semibold text-xs outline-none focus:ring-2 focus:ring-emerald-500 text-ink placeholder:text-ink-muted"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-ink-muted uppercase tracking-wider pl-0.5">Mã CAS (Tùy chọn)</label>
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
              className={`w-full px-3 py-2 bg-surface-2 border rounded-lg font-mono text-xs outline-none focus:ring-2 text-ink placeholder:text-ink-muted ${
                formCasError ? 'border-rose-400 focus:ring-rose-400' : 'border-border focus:ring-emerald-500'
              }`}
            />
            {formCasError && (
              <p className="text-[10px] text-rose-500 font-semibold pl-1 flex items-center gap-1">
                <ExclamationTriangleIcon className="h-3 w-3" /> {formCasError}
              </p>
            )}
          </div>
        </div>

        {/* Aliases Tag Input */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-ink-muted uppercase tracking-wider pl-0.5 flex items-center gap-1.5">
            <Square3Stack3DIcon className="h-3.5 w-3.5 text-emerald-500" />
            Các tên gọi khác & Bí danh (Aliases)
          </label>
          <div className="p-2 bg-surface-2 rounded-lg border border-border flex flex-wrap gap-1.5 min-h-[44px] items-center focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
            {formAliases.map((alias, i) => (
              <div key={i} className="flex items-center gap-1 bg-surface border border-border text-ink text-xs font-semibold px-2 py-0.5 rounded shadow-sm">
                {alias}
                <button type="button" onClick={() => removeAlias(i)} className="text-ink-muted hover:text-rose-500 cursor-pointer">
                  <XMarkIcon className="h-3 w-3" />
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
                className="flex-1 bg-transparent outline-none text-xs p-1 placeholder:text-ink-muted font-medium text-ink"
              />
              <button 
                type="button" 
                onClick={handleAddAlias}
                disabled={!formAliasInput.trim()}
                className="ml-1 p-1 bg-surface border border-border text-ink-muted rounded hover:text-emerald-600 transition-colors disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-ink-muted pl-0.5">Nhấn Enter hoặc dán danh sách phân cách bằng dấu phẩy để thêm nhiều alias.</p>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-ink-muted uppercase tracking-wider pl-0.5">Mô tả / Ghi chú</label>
          <textarea
            value={formDescription}
            onChange={e => setFormDescription(e.target.value)}
            placeholder="Ghi chú về nguồn gốc, nhà sản xuất..."
            rows={2}
            className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg font-medium text-xs outline-none focus:ring-2 focus:ring-emerald-500 text-ink placeholder:text-ink-muted resize-none"
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-ink-soft hover:text-ink font-semibold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer transition-colors"
          >
            {isSubmitting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
            {mode === 'ADD' ? "Thêm mới" : "Cập nhật"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
