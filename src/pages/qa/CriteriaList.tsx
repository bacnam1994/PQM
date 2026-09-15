import React, { useState, useMemo, memo, useCallback, useEffect } from 'react';
import {
  BeakerIcon,
  PencilSquareIcon,
  CheckIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Squares2X2Icon,
  ListBulletIcon,
  PlusCircleIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store/useAppStore';
import {
  DSFilterBar,
  DSSearchInput,
  DSTable,
  DSFormInput,
  DSViewToggle,
  DSCard,
  PageHeader,
  Modal,
  VirtualizedTableBody,
} from '../../components';
import { useUIStore } from '../../store/useUIStore';
import { bulkRenameCriteriaInAllTestResults } from '../../services/testResultService';
import {
  MasterCriterion,
  MasterCriterionCategory,
  MasterCriterionFormData,
  MASTER_CRITERION_CATEGORY_LABELS,
  MASTER_CRITERION_CATEGORY_COLORS,
} from '../../types';
import {
  useMasterCriteriaQuery,
  useCreateMasterCriterionMutation,
  useUpdateMasterCriterionMutation,
  useDeleteMasterCriterionMutation,
  useToggleMasterCriterionActiveMutation,
} from '../../hooks/queries/useMasterCriterionQueries';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CriteriaSummary {
  id: string;
  name: string;
  count: number;
  relatedTCCS: { id: string; code: string; product: string; productId?: string }[];
  types: Set<string>;
  masterCriterionId?: string;
}

type ActiveTab = 'master' | 'frequency';

// ─── Tab 1: Master Data CRUD ──────────────────────────────────────────────────

const EMPTY_FORM: MasterCriterionFormData = {
  canonicalName: '',
  category: 'QUALITY',
  defaultUnit: '',
  type: 'NUMBER',
  linkedMaterialId: undefined,
  defaultCalculationBasis: undefined,
  description: undefined,
  isActive: true,
};

function CategoryBadge({ category }: { category: MasterCriterionCategory }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${MASTER_CRITERION_CATEGORY_COLORS[category]}`}
    >
      {MASTER_CRITERION_CATEGORY_LABELS[category]}
    </span>
  );
}

interface MasterCriterionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editing: MasterCriterion | null;
  rawMaterials: { id: string; name: string }[];
}

const MasterCriterionModal: React.FC<MasterCriterionModalProps> = memo(
  ({ isOpen, onClose, editing, rawMaterials }) => {
    const [form, setForm] = useState<MasterCriterionFormData>(EMPTY_FORM);
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
        setForm(EMPTY_FORM);
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

// ─── Tab 1: Master Data Table ─────────────────────────────────────────────────

interface MasterDataTabProps {
  rawMaterials: { id: string; name: string }[];
  isAdmin: boolean;
}

const MasterDataTab: React.FC<MasterDataTabProps> = ({ rawMaterials, isAdmin }) => {
  const { data: masterCriteria = [], isLoading } = useMasterCriteriaQuery();
  const toggleMutation = useToggleMasterCriterionActiveMutation();
  const deleteMutation = useDeleteMasterCriterionMutation();
  const notify = useAppStore((s) => s.notify);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MasterCriterionCategory | 'ALL'>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterCriterion | null>(null);

  const filtered = useMemo(() => {
    let list = masterCriteria;
    if (categoryFilter !== 'ALL') list = list.filter((c) => c.category === categoryFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) => c.canonicalName.toLowerCase().includes(q) || c.defaultUnit.toLowerCase().includes(q)
      );
    }
    return list;
  }, [masterCriteria, categoryFilter, search]);

  const handleEdit = (item: MasterCriterion) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleToggle = async (item: MasterCriterion) => {
    await toggleMutation.mutateAsync({ id: item.id, isActive: !item.isActive });
    notify({
      type: 'SUCCESS',
      title: item.isActive ? 'Đã ẩn chỉ tiêu' : 'Đã kích hoạt',
      message: `"${item.canonicalName}" ${item.isActive ? 'đã bị ẩn khỏi Autocomplete.' : 'đã được kích hoạt.'}`,
    });
  };

  const handleDelete = async (item: MasterCriterion) => {
    if (
      !window.confirm(
        `Xác nhận xóa chỉ tiêu "${item.canonicalName}"? Hành động này không thể hoàn tác.`
      )
    )
      return;
    await deleteMutation.mutateAsync(item.id);
    notify({
      type: 'SUCCESS',
      title: 'Đã xóa',
      message: `Đã xóa chỉ tiêu "${item.canonicalName}".`,
    });
  };

  const materialMap = useMemo(
    () => new Map(rawMaterials.map((m) => [m.id, m.name])),
    [rawMaterials]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-ink-muted">
        <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> Đang tải Master Data...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <DSFilterBar>
        <DSSearchInput
          placeholder="Tìm tên chỉ tiêu hoặc đơn vị..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as any)}
          className="px-3 py-2 bg-surface border border-border text-xs text-ink rounded-lg outline-none cursor-pointer"
        >
          <option value="ALL">Tất cả nhóm</option>
          {(Object.keys(MASTER_CRITERION_CATEGORY_LABELS) as MasterCriterionCategory[]).map((k) => (
            <option key={k} value={k}>
              {MASTER_CRITERION_CATEGORY_LABELS[k]}
            </option>
          ))}
        </select>
        <div className="px-3.5 py-2 bg-surface-2 text-ink-soft rounded-lg text-xs font-medium whitespace-nowrap border border-border">
          {filtered.length} / {masterCriteria.length} chỉ tiêu
        </div>
        {isAdmin && (
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
          >
            <PlusCircleIcon className="w-4 h-4" /> Tạo mới
          </button>
        )}
      </DSFilterBar>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-ink-muted text-sm italic bg-surface rounded-xl border border-border">
          {masterCriteria.length === 0
            ? 'Chưa có chỉ tiêu nào. Nhấn "Tạo mới" để bắt đầu xây dựng Master Data.'
            : 'Không tìm thấy chỉ tiêu phù hợp.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <DSTable>
            <thead className="bg-surface-2 border-b border-border sticky top-0 z-10 backdrop-blur-xs">
              <tr className="text-ink-muted text-xs font-semibold uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Tên chuẩn</th>
                <th className="px-4 py-3 text-left">Nhóm</th>
                <th className="px-4 py-3 text-left">Đơn vị</th>
                <th className="px-4 py-3 text-left">Nguyên liệu</th>
                <th className="px-4 py-3 text-left">Quy tắc %</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                {isAdmin && <th className="px-4 py-3 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-ink">{item.canonicalName}</span>
                      <span className="text-[10px] text-ink-muted font-mono mt-0.5 select-all">
                        {item.id}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={item.category} />
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-ink-soft">
                    {item.defaultUnit || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {item.linkedMaterialId ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <LinkIcon className="w-3 h-3" />
                        {materialMap.get(item.linkedMaterialId) ??
                          item.linkedMaterialId.slice(0, 12)}
                      </span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {item.defaultCalculationBasis ? (
                      <span
                        className={`font-semibold ${item.defaultCalculationBasis === 'ELEMENTAL' ? 'text-violet-600 dark:text-violet-400' : 'text-amber-600 dark:text-amber-400'}`}
                      >
                        {item.defaultCalculationBasis}
                      </span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                        <CheckCircleIcon className="w-3 h-3" /> Hoạt động
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-ink-muted border border-border">
                        <XCircleIcon className="w-3 h-3" /> Đã ẩn
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1.5 text-ink-muted hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-surface-2 rounded-lg transition-all"
                          title="Chỉnh sửa"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(item)}
                          className="p-1.5 text-ink-muted hover:text-amber-600 dark:hover:text-amber-400 hover:bg-surface-2 rounded-lg transition-all"
                          title={item.isActive ? 'Ẩn chỉ tiêu' : 'Kích hoạt'}
                        >
                          {item.isActive ? (
                            <XCircleIcon className="w-4 h-4" />
                          ) : (
                            <CheckCircleIcon className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 text-ink-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                          title="Xóa vĩnh viễn"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </DSTable>
        </div>
      )}

      <MasterCriterionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editingItem}
        rawMaterials={rawMaterials}
      />
    </div>
  );
};

// ─── Tab 2: Frequency Analysis (legacy) ───────────────────────────────────────

const CriteriaGridItem = memo(
  ({
    item,
    onEdit,
    isAdmin,
    masterCriteriaMap,
  }: {
    item: CriteriaSummary;
    onEdit: (item: CriteriaSummary) => void;
    isAdmin: boolean;
    masterCriteriaMap: Map<string, string>;
  }) => {
    const isLinked = !!item.masterCriterionId && masterCriteriaMap.has(item.masterCriterionId);
    return (
      <DSCard className="p-5 flex flex-col gap-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group relative overflow-hidden h-full bg-surface border border-border">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 relative z-10">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
            <BeakerIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Chỉ tiêu phân tích</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isLinked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60">
                <LinkIcon className="w-3 h-3" /> Master
              </span>
            )}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-ink-muted border border-border">
              Tần suất: {item.count}
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-surface-2 border border-border rounded-xl p-4 flex flex-col gap-3 relative z-10 flex-grow">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-100 dark:border-emerald-900/30">
              <BeakerIcon className="w-6 h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="font-semibold text-ink text-base leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2 truncate">
                {item.name}
              </h3>
              <p className="text-xs text-ink-muted mt-1">
                Sử dụng trong {item.relatedTCCS.length} hồ sơ
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2.5 border-t border-border mt-auto">
            <div className="flex flex-wrap gap-1.5">
              {item.relatedTCCS.slice(0, 3).map((t, idx) => (
                <span
                  key={idx}
                  className="bg-surface border border-border px-2 py-0.5 rounded text-xs font-medium text-ink-soft truncate max-w-full"
                  title={t.product}
                >
                  {t.code}
                </span>
              ))}
              {item.relatedTCCS.length > 3 && (
                <span className="bg-surface-3 px-1.5 py-0.5 rounded text-xs text-ink-muted font-medium border border-border">
                  +{item.relatedTCCS.length - 3}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        {isAdmin && (
          <div className="flex items-center justify-between pt-3 mt-auto border-t border-border relative z-10">
            <div className="opacity-90 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(item)}
                className="p-1.5 text-ink-muted hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-surface-2 rounded-lg transition-all"
                title="Đổi tên chỉ tiêu"
              >
                <PencilSquareIcon className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => onEdit(item)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface-2 text-ink-soft hover:bg-surface-3 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all ml-auto border border-border"
            >
              <PencilSquareIcon className="w-3.5 h-3.5" /> Đổi tên
            </button>
          </div>
        )}
      </DSCard>
    );
  }
);

const CriteriaListItem = memo(
  ({
    item,
    onEdit,
    isAdmin,
    masterCriteriaMap,
  }: {
    item: CriteriaSummary;
    onEdit: (item: CriteriaSummary) => void;
    isAdmin: boolean;
    masterCriteriaMap: Map<string, string>;
  }) => {
    const isLinked = !!item.masterCriterionId && masterCriteriaMap.has(item.masterCriterionId);
    return (
      <tr className="hover:bg-surface-2 transition-colors group">
        <td className="px-6 py-3.5 font-medium text-ink text-sm">{item.name}</td>
        <td className="px-6 py-3.5 text-center">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
            {item.count}
          </span>
        </td>
        <td className="px-6 py-3.5">
          <div className="flex flex-wrap gap-1">
            {item.relatedTCCS.slice(0, 3).map((t, idx) => (
              <span
                key={idx}
                className="text-xs bg-surface text-ink-soft px-2 py-0.5 rounded border border-border truncate max-w-[150px]"
                title={t.product}
              >
                {t.code}
              </span>
            ))}
            {item.relatedTCCS.length > 3 && (
              <span className="text-xs bg-surface-3 text-ink-muted px-1.5 py-0.5 rounded border border-border font-medium">
                +{item.relatedTCCS.length - 3}
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-3.5 text-center">
          {isLinked ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60">
              <LinkIcon className="w-3 h-3" /> Đã liên kết
            </span>
          ) : (
            <span className="text-[10px] text-ink-muted">Chưa liên kết</span>
          )}
        </td>
        <td className="px-6 py-3.5 text-right">
          {isAdmin && (
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 text-ink-muted hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-surface-2 rounded-lg transition-all"
              title="Đổi tên chỉ tiêu"
            >
              <PencilSquareIcon className="w-4 h-4" />
            </button>
          )}
        </td>
      </tr>
    );
  }
);

// ─── Main Component ───────────────────────────────────────────────────────────

const CriteriaList = () => {
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const tccsList = useAppStore((state) => state.tccsList);
  const products = useAppStore((state) => state.products);
  const rawMaterials = useAppStore((state) => state.rawMaterials);
  const updateTCCS = useAppStore((state) => state.updateTCCS);
  const notify = useAppStore((state) => state.notify);
  const isAdmin = useAppStore((state) => state.isAdmin);
  const testResults = useAppStore((state) => state.testResults);
  const allTestResults = useAppStore((state) => state.allTestResults);
  const fetchAllTestResultsForDashboard = useAppStore(
    (state) => state.fetchAllTestResultsForDashboard
  );
  const batches = useAppStore((state) => state.batches);

  const [activeTab, setActiveTab] = useState<ActiveTab>('master');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCriteria, setSelectedCriteria] = useState<CriteriaSummary | null>(null);
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameScope, setRenameScope] = useState<'global' | 'product'>('global');
  const [targetProductId, setTargetProductId] = useState<string>('');
  const viewMode = useUIStore((s) => s.criteriaViewMode);
  const setViewMode = useUIStore((s) => s.setCriteriaViewMode);

  const { data: masterCriteria = [] } = useMasterCriteriaQuery();

  useEffect(() => {
    fetchAllTestResultsForDashboard().catch(() => {});
  }, [fetchAllTestResultsForDashboard]);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 15;

  // Build map: masterCriterionId → canonicalName (để check liên kết)
  const masterCriteriaMap = useMemo(
    () => new Map(masterCriteria.map((c) => [c.id, c.canonicalName])),
    [masterCriteria]
  );

  // ─── Frequency Analysis (Tab 2 logic) ─────────────────────────────────────
  const criteriaList = useMemo(() => {
    const map = new Map<string, CriteriaSummary>();
    const productMap = new Map(products.map((p) => [p.id, p]));
    const batchMap = new Map(batches.map((b) => [b.id, b]));
    const tccsMap = new Map(tccsList.map((t) => [t.id, t]));
    const effectiveTestResults =
      allTestResults && allTestResults.length > 0 ? allTestResults : testResults;

    tccsList.forEach((tccs) => {
      const product = productMap.get(tccs.productId);
      const productName = product
        ? product.name
        : tccs.productId
          ? `Sản phẩm đã xóa (${tccs.productId.slice(-6)})`
          : 'Chưa gán sản phẩm';

      const processCriteria = (list: any[], _type: string) => {
        if (!list) return;
        list.forEach((c) => {
          if (!c || !c.name) return;
          const normalizedName = c.name.trim();

          if (!map.has(normalizedName)) {
            map.set(normalizedName, {
              id: normalizedName,
              name: normalizedName,
              count: 0,
              relatedTCCS: [],
              types: new Set(),
              masterCriterionId: c.masterCriterionId,
            });
          }

          const entry = map.get(normalizedName)!;
          entry.count++;
          entry.types.add(_type);
          // Cập nhật masterCriterionId nếu có
          if (c.masterCriterionId && !entry.masterCriterionId) {
            entry.masterCriterionId = c.masterCriterionId;
          }

          if (!entry.relatedTCCS.some((r) => r.id === tccs.id)) {
            entry.relatedTCCS.push({
              id: tccs.id,
              code: tccs.code,
              product: productName,
              productId: tccs.productId,
            });
          }
        });
      };

      processCriteria(tccs.mainQualityCriteria, 'MAIN');
      processCriteria(tccs.safetyCriteria, 'SAFETY');
    });

    effectiveTestResults.forEach((result) => {
      const batch = (result.batchId ? batchMap.get(result.batchId) : null) || result.batch;

      let productId = batch?.productId;
      if (!productId && batch?.tccsId) {
        const linkedTccs = tccsMap.get(batch.tccsId);
        productId = linkedTccs?.productId;
      }

      const product = productId ? productMap.get(productId) : null;
      const batchNo = batch?.batchNo || 'Không rõ số lô';
      const productName = product
        ? product.name
        : productId
          ? `Sản phẩm đã xóa (${productId.slice(-6)})`
          : `Lô ${batchNo}`;

      (result.results || []).forEach((entry) => {
        if (!entry || !entry.criteriaName) return;
        const normalizedName = entry.criteriaName.trim();

        if (!map.has(normalizedName)) {
          map.set(normalizedName, {
            id: normalizedName,
            name: normalizedName,
            count: 0,
            relatedTCCS: [],
            types: new Set(),
          });
        }

        const mapEntry = map.get(normalizedName)!;
        if (entry.isExtra) {
          mapEntry.types.add('EXTRA');
        }

        const tccsId = batch?.tccsId;
        const existingTCCS = tccsId ? mapEntry.relatedTCCS.find((r) => r.id === tccsId) : null;

        if (!existingTCCS) {
          if (!mapEntry.relatedTCCS.some((r) => r.id === result.id)) {
            mapEntry.relatedTCCS.push({
              id: result.id,
              code: `Phiếu: Lô ${batchNo}`,
              product: productName,
              productId: productId,
            });
            mapEntry.count++;
          }
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tccsList, products, testResults, allTestResults, batches]);

  const filteredList = useMemo(() => {
    let result = criteriaList;
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(lowerTerm));
    }
    return result;
  }, [criteriaList, searchTerm]);

  const totalPages = Math.ceil(filteredList.length / ITEMS_PER_PAGE);
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredList.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredList, currentPage, ITEMS_PER_PAGE]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, viewMode]);

  const productsUsingCriteria = useMemo(() => {
    if (!selectedCriteria) return [];
    const prodMap = new Map<string, string>();
    selectedCriteria.relatedTCCS.forEach((r) => {
      if (r.productId) {
        prodMap.set(r.productId, r.product);
      } else {
        const tccs = tccsList.find((t) => t.id === r.id);
        if (tccs) {
          const prod = products.find((p) => p.id === tccs.productId);
          if (prod) prodMap.set(prod.id, prod.name);
        }
      }
    });
    return Array.from(prodMap.entries()).map(([id, name]) => ({ id, name }));
  }, [selectedCriteria, tccsList, products]);

  const handleOpenEdit = useCallback((item: CriteriaSummary) => {
    setSelectedCriteria(item);
    setNewName(item.name);
    setRenameScope('global');
    setTargetProductId('');
  }, []);

  const handleRename = async () => {
    if (!selectedCriteria || !newName.trim()) return;
    if (renameScope === 'product' && !targetProductId) {
      notify({
        type: 'WARNING',
        title: 'Thiếu thông tin',
        message: 'Vui lòng chọn sản phẩm cần áp dụng đổi tên.',
      });
      return;
    }
    if (newName.trim() === selectedCriteria.name) {
      setSelectedCriteria(null);
      return;
    }

    setIsRenaming(true);
    try {
      const oldName = selectedCriteria.name;
      const targetName = newName.trim();
      const tccsUpdates: Promise<void>[] = [];

      tccsList.forEach((tccs) => {
        if (renameScope === 'product' && tccs.productId !== targetProductId) return;
        let hasChange = false;

        const newMainCriteria = (tccs.mainQualityCriteria || []).map((c) => {
          if (c.name === oldName) {
            hasChange = true;
            return { ...c, name: targetName };
          }
          return c;
        });
        const newSafetyCriteria = (tccs.safetyCriteria || []).map((c) => {
          if (c.name === oldName) {
            hasChange = true;
            return { ...c, name: targetName };
          }
          return c;
        });

        if (hasChange) {
          tccsUpdates.push(
            updateTCCS({
              ...tccs,
              mainQualityCriteria: newMainCriteria,
              safetyCriteria: newSafetyCriteria,
            })
          );
        }
      });

      const { updatedCount } = await bulkRenameCriteriaInAllTestResults(
        oldName,
        targetName,
        renameScope === 'product' ? targetProductId : undefined
      );

      await Promise.all(tccsUpdates);

      notify({
        type: 'SUCCESS',
        title: 'Đổi tên thành công',
        message:
          renameScope === 'product'
            ? `Đã cập nhật chỉ tiêu từ "${oldName}" thành "${targetName}" cho sản phẩm được chọn (${tccsUpdates.length} TCCS, ${updatedCount} phiếu).`
            : `Đã cập nhật "${oldName}" thành "${targetName}" toàn hệ thống (${tccsUpdates.length} TCCS, ${updatedCount} phiếu).`,
      });
      setSelectedCriteria(null);
    } catch (error) {
      console.error('Lỗi đổi tên chỉ tiêu:', error);
      notify({
        type: 'ERROR',
        title: 'Lỗi hệ thống',
        message: 'Không thể cập nhật tên chỉ tiêu. Vui lòng thử lại.',
      });
    } finally {
      setIsRenaming(false);
    }
  };

  const rawMaterialsForModal = useMemo(
    () => rawMaterials.map((m) => ({ id: m.id, name: m.name })),
    [rawMaterials]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Danh mục Chỉ tiêu"
        subtitle="Quản lý Master Data chuẩn hóa và phân tích tần suất tên chỉ tiêu trên toàn hệ thống."
        icon={BeakerIcon}
      />

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-surface-2 rounded-xl border border-border w-fit">
        <button
          onClick={() => setActiveTab('master')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'master'
              ? 'bg-surface text-ink shadow-xs'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <BeakerIcon className="w-4 h-4" />
          Quản lý Master Data
        </button>
        <button
          onClick={() => setActiveTab('frequency')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'frequency'
              ? 'bg-surface text-ink shadow-xs'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <ListBulletIcon className="w-4 h-4" />
          Phân tích Tần suất
        </button>
      </div>

      {/* ─── Tab 1: Master Data CRUD ─── */}
      {activeTab === 'master' && (
        <MasterDataTab rawMaterials={rawMaterialsForModal} isAdmin={isAdmin} />
      )}

      {/* ─── Tab 2: Frequency Analysis ─── */}
      {activeTab === 'frequency' && (
        <div className="space-y-4">
          <DSFilterBar>
            <DSSearchInput
              placeholder="Tìm kiếm chỉ tiêu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="px-3.5 py-2 bg-surface-2 text-ink-soft rounded-lg text-xs font-medium whitespace-nowrap border border-border">
              Tổng: {filteredList.length} chỉ tiêu
            </div>
            <DSViewToggle
              viewMode={viewMode}
              setViewMode={setViewMode}
              gridIcon={Squares2X2Icon}
              listIcon={ListBulletIcon}
            />
          </DSFilterBar>

          {paginatedList.length === 0 ? (
            <div className="p-8 text-center text-ink-muted text-sm italic bg-surface rounded-xl border border-border">
              Không tìm thấy chỉ tiêu nào phù hợp.
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedList.map((item) => (
                <CriteriaGridItem
                  key={item.id}
                  item={item}
                  onEdit={handleOpenEdit}
                  isAdmin={isAdmin}
                  masterCriteriaMap={masterCriteriaMap}
                />
              ))}
            </div>
          ) : (
            <div
              ref={tableContainerRef}
              className="overflow-x-auto max-h-[720px] overflow-y-auto rounded-xl"
            >
              <DSTable>
                <thead className="bg-surface-2 border-b border-border sticky top-0 z-10 backdrop-blur-xs">
                  <tr className="text-ink-muted text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-3">Tên Chỉ tiêu</th>
                    <th className="px-6 py-3 text-center">Tần suất</th>
                    <th className="px-6 py-3">Sử dụng trong (Ví dụ)</th>
                    <th className="px-6 py-3 text-center">Đã liên kết Master</th>
                    <th className="px-6 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <VirtualizedTableBody
                  items={paginatedList}
                  parentRef={tableContainerRef}
                  estimateSize={54}
                  colSpan={5}
                  renderRow={(item) => (
                    <CriteriaListItem
                      key={item.id}
                      item={item}
                      onEdit={handleOpenEdit}
                      isAdmin={isAdmin}
                      masterCriteriaMap={masterCriteriaMap}
                    />
                  )}
                />
              </DSTable>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-6 pt-4 border-t border-border">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-border bg-surface text-ink-soft hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium text-ink-muted">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-border bg-surface text-ink-soft hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Rename Modal (Tab 2) */}
      <Modal
        isOpen={!!selectedCriteria}
        onClose={() => setSelectedCriteria(null)}
        title="Đổi tên Chỉ tiêu"
        icon={PencilSquareIcon}
      >
        <div className="space-y-5">
          <div className="bg-amber-50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/40 flex gap-2.5">
            <ExclamationCircleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              {renameScope === 'product' ? (
                <>
                  Bạn đang đổi tên chỉ tiêu này cho <strong>sản phẩm đã chọn</strong>. Hệ thống sẽ
                  cập nhật hồ sơ TCCS và toàn bộ các phiếu kết quả cũ của riêng sản phẩm này.
                </>
              ) : (
                <>
                  Bạn đang đổi tên cho <strong>{selectedCriteria?.count}</strong> vị trí sử dụng.
                  Hành động này sẽ cập nhật đồng loạt trên tất cả các hồ sơ TCCS liên quan.
                </>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-muted">Tên hiện tại</label>
            <div className="p-2.5 bg-surface-2 rounded-lg text-sm font-medium text-ink-soft border border-border">
              {selectedCriteria?.name}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-muted">Phạm vi áp dụng</label>
            <div className="flex bg-surface-2 p-1 rounded-lg gap-1 border border-border">
              <button
                type="button"
                onClick={() => {
                  setRenameScope('global');
                  setTargetProductId('');
                }}
                className={`flex-1 py-1.5 text-center text-xs font-medium rounded-md transition-all ${
                  renameScope === 'global'
                    ? 'bg-surface text-ink shadow-xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Toàn hệ thống
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenameScope('product');
                  if (productsUsingCriteria.length > 0)
                    setTargetProductId(productsUsingCriteria[0].id);
                }}
                className={`flex-1 py-1.5 text-center text-xs font-medium rounded-md transition-all ${
                  renameScope === 'product'
                    ? 'bg-surface text-ink shadow-xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Chỉ một sản phẩm
              </button>
            </div>
          </div>

          {renameScope === 'product' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-muted">
                Chọn sản phẩm cần đổi tên chỉ tiêu *
              </label>
              <select
                value={targetProductId}
                onChange={(e) => setTargetProductId(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border focus:border-emerald-500 rounded-lg text-xs text-ink outline-none transition-colors cursor-pointer"
              >
                <option value="">-- Chọn sản phẩm --</option>
                {productsUsingCriteria.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <DSFormInput
            label="Tên mới"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nhập tên chuẩn hóa..."
            autoFocus
          />
        </div>

        <div className="pt-4 mt-4 border-t border-border flex justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setSelectedCriteria(null)}
            className="px-4 py-2 text-ink-soft hover:bg-surface-2 rounded-lg text-xs font-medium transition-colors border border-border"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleRename}
            disabled={
              isRenaming ||
              !newName.trim() ||
              newName === selectedCriteria?.name ||
              (renameScope === 'product' && !targetProductId)
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg shadow-xs disabled:opacity-50 disabled:pointer-events-none transition-all"
          >
            {isRenaming ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <CheckIcon className="w-4 h-4" />
            )}
            Lưu thay đổi
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default CriteriaList;
