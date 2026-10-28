import React, { useState, useEffect, memo } from 'react';
import { BeakerIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useAppStore } from '../../../store/useAppStore';
import { Modal, DSFormInput } from '../../../components';
import {
  MasterCriterion,
  MasterCriterionCategory,
  MasterCriterionFormData,
  MASTER_CRITERION_CATEGORY_LABELS,
} from '../../../types';
import {
  useCreateMasterCriterionMutation,
  useUpdateMasterCriterionMutation,
} from '../../../hooks/queries/useMasterCriterionQueries';

export const EMPTY_CRITERION_FORM: MasterCriterionFormData = {
  canonicalName: '',
  category: 'QUALITY',
  defaultUnit: '',
  type: 'NUMBER',
  linkedMaterialId: undefined,
  defaultCalculationBasis: undefined,
  description: undefined,
  isActive: true,
};

export interface MasterCriterionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editing: MasterCriterion | null;
  rawMaterials: { id: string; name: string }[];
}

export const MasterCriterionModal: React.FC<MasterCriterionModalProps> = memo(
  ({ isOpen, onClose, editing, rawMaterials }) => {
    const [form, setForm] = useState<MasterCriterionFormData>(EMPTY_CRITERION_FORM);
    const createMutation = useCreateMasterCriterionMutation();
    const updateMutation = useUpdateMasterCriterionMutation();
    const notify = useAppStore((s) => s.notify);

    useEffect(() => {
      if (editing) {
        setForm({
          canonicalName: editing.canonicalName,
          category: editing.category,
          defaultUnit: editing.defaultUnit,
          type: editing.type,
          linkedMaterialId: editing.linkedMaterialId,
          defaultCalculationBasis: editing.defaultCalculationBasis,
          description: editing.description,
          isActive: editing.isActive,
        });
      } else {
        setForm(EMPTY_CRITERION_FORM);
      }
    }, [editing, isOpen]);

    const isPending = createMutation.isPending || updateMutation.isPending;

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.canonicalName.trim()) return;
      try {
        if (editing) {
          await updateMutation.mutateAsync({ id: editing.id, formData: form });
          notify({
            type: 'SUCCESS',
            title: 'Đã cập nhật',
            message: `Cập nhật "${form.canonicalName}" thành công.`,
          });
        } else {
          await createMutation.mutateAsync(form);
          notify({
            type: 'SUCCESS',
            title: 'Đã tạo mới',
            message: `Tạo chỉ tiêu "${form.canonicalName}" thành công.`,
          });
        }
        onClose();
      } catch {
        notify({
          type: 'ERROR',
          title: 'Lỗi',
          message: 'Không thể lưu chỉ tiêu. Vui lòng thử lại.',
        });
      }
    };

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={editing ? 'Chỉnh sửa MasterCriterion' : 'Tạo mới Chỉ tiêu Chuẩn'}
        icon={BeakerIcon}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tên chuẩn */}
          <DSFormInput
            label="Tên chuẩn hóa *"
            value={form.canonicalName}
            onChange={(e) => setForm((f) => ({ ...f, canonicalName: e.target.value }))}
            placeholder="VD: Hàm lượng Đồng, Tổng Aerobic..."
            autoFocus
            required
          />

          {/* Nhóm & Kiểu */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-muted">Nhóm phân loại *</label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value as MasterCriterionCategory }))
                }
                className="w-full px-3 py-2 bg-surface border border-border focus:border-emerald-500 rounded-lg text-xs text-ink outline-none transition-colors cursor-pointer"
              >
                {(Object.keys(MASTER_CRITERION_CATEGORY_LABELS) as MasterCriterionCategory[]).map(
                  (k) => (
                    <option key={k} value={k}>
                      {MASTER_CRITERION_CATEGORY_LABELS[k]}
                    </option>
                  )
                )}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-muted">Kiểu dữ liệu *</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))}
                className="w-full px-3 py-2 bg-surface border border-border focus:border-emerald-500 rounded-lg text-xs text-ink outline-none transition-colors cursor-pointer"
              >
                <option value="NUMBER">Số (NUMBER)</option>
                <option value="TEXT">Văn bản (TEXT)</option>
              </select>
            </div>
          </div>

          {/* Đơn vị */}
          <DSFormInput
            label="Đơn vị mặc định *"
            value={form.defaultUnit}
            onChange={(e) => setForm((f) => ({ ...f, defaultUnit: e.target.value }))}
            placeholder="VD: mg, ppm, CFU/g, IU, %"
            required
          />

          {/* Nguyên liệu liên kết */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-muted">
              Liên kết Nguyên liệu (tùy chọn)
            </label>
            <select
              value={form.linkedMaterialId || ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, linkedMaterialId: e.target.value || undefined }))
              }
              className="w-full px-3 py-2 bg-surface border border-border focus:border-emerald-500 rounded-lg text-xs text-ink outline-none transition-colors cursor-pointer"
            >
              <option value="">-- Không liên kết --</option>
              {rawMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quy tắc tính (chỉ hiện khi có liên kết nguyên liệu) */}
          {form.linkedMaterialId && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-muted">Quy tắc tính % mặc định</label>
              <select
                value={form.defaultCalculationBasis || ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    defaultCalculationBasis: (e.target.value as any) || undefined,
                  }))
                }
                className="w-full px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 focus:border-emerald-500 rounded-lg text-xs text-ink outline-none transition-colors cursor-pointer"
              >
                <option value="">-- Chưa chỉ định --</option>
                <option value="DECLARED">DECLARED — Tính theo Muối/Hợp chất</option>
                <option value="ELEMENTAL">ELEMENTAL — Tính theo Ion/Nguyên tố gốc</option>
              </select>
            </div>
          )}

          {/* Mô tả */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-muted">Mô tả / Phương pháp thử</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || undefined }))}
              placeholder="Tài liệu tham chiếu, phương pháp thử nghiệm..."
              rows={2}
              className="w-full px-3 py-2 bg-surface border border-border focus:border-emerald-500 rounded-lg text-xs text-ink outline-none resize-none transition-colors"
            />
          </div>

          {/* isActive toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex w-10 h-5 rounded-full transition-colors ${form.isActive ? 'bg-emerald-500' : 'bg-surface-3 border border-border'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : ''}`}
              />
            </button>
            <span className="text-xs font-medium text-ink-soft">
              {form.isActive ? 'Đang hoạt động (hiện trong Autocomplete)' : 'Đã ẩn'}
            </span>
          </div>

          {/* Actions */}
          <div className="pt-4 mt-2 border-t border-border flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-ink-soft hover:bg-surface-2 rounded-lg text-xs font-medium transition-colors border border-border"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isPending || !form.canonicalName.trim() || !form.defaultUnit.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg shadow-xs disabled:opacity-50 disabled:pointer-events-none transition-all"
            >
              {isPending ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <CheckIcon className="w-4 h-4" />
              )}
              {editing ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </Modal>
    );
  }
);
