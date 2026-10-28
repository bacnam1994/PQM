/**
 * PharmacopoeiaManager.tsx
 * ========================
 * Giao diện Quản trị Cơ sở Dữ liệu Tiêu chuẩn Dược điển (DĐVN, USP, BP, EP)
 * Cho phép bộ phận QA chủ động thêm, sửa, xóa các tiêu chuẩn dược điển động trên RTDB.
 * Dữ liệu này được AI truy xuất động (Dynamic Context) khi thực thi prompt phân tích chất lượng.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpenIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import {
  PharmacopoeiaStandard,
  getPharmacopoeiaStandards,
  savePharmacopoeiaStandard,
  deletePharmacopoeiaStandard,
  seedPharmacopoeiaStandards,
  DEFAULT_PHARMACOPOEIA_DB,
} from '../../../services/pharmacopoeiaService';
import { Modal, ConfirmationModal } from '../../../components';
import { generateId } from '../../../utils';

export const PharmacopoeiaManager: React.FC = () => {
  const [standards, setStandards] = useState<PharmacopoeiaStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<PharmacopoeiaStandard> | null>(null);
  const [keywordsText, setKeywordsText] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getPharmacopoeiaStandards();
      setStandards(data);
    } catch (err) {
      console.error('Lỗi nạp dữ liệu dược điển:', err);
      showNotify('error', 'Không thể kết nối đến cơ sở dữ liệu dược điển.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    standards.forEach(s => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set);
  }, [standards]);

  const filteredStandards = useMemo(() => {
    return standards.filter(item => {
      if (filterCategory !== 'ALL' && item.category !== filterCategory) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(term);
        const matchSource = (item.source || '').toLowerCase().includes(term);
        const matchKeywords = (item.keywords || []).some(k => k.toLowerCase().includes(term));
        const matchStandard = (item.standard || '').toLowerCase().includes(term);
        if (!matchTitle && !matchSource && !matchKeywords && !matchStandard) return false;
      }
      return true;
    });
  }, [standards, searchTerm, filterCategory]);

  const handleOpenAdd = () => {
    setEditingItem({
      id: generateId('pharma-std'),
      title: '',
      category: 'Lý hóa',
      source: 'DĐVN V / USP',
      standard: '',
    });
    setKeywordsText('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: PharmacopoeiaStandard) => {
    setEditingItem({ ...item });
    setKeywordsText((item.keywords || []).join(', '));
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.title?.trim()) {
      showNotify('error', 'Vui lòng nhập Tiêu đề chỉ tiêu / Dược chất.');
      return;
    }

    try {
      const rawKeywords = keywordsText
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);

      const payload: PharmacopoeiaStandard = {
        id: editingItem.id || generateId('pharma-std'),
        title: editingItem.title.trim(),
        category: editingItem.category?.trim() || 'Lý hóa',
        source: editingItem.source?.trim() || 'DĐVN V',
        keywords: rawKeywords.length > 0 ? rawKeywords : [editingItem.title.trim().toLowerCase()],
        standard: editingItem.standard?.trim() || '',
        updatedAt: new Date().toISOString(),
        updatedBy: 'QA_ADMIN'
      };

      await savePharmacopoeiaStandard(payload);
      showNotify('success', `Đã lưu tiêu chuẩn "${payload.title}".`);
      setIsModalOpen(false);
      setEditingItem(null);
      await loadData();
    } catch (err) {
      console.error('Lỗi lưu tiêu chuẩn:', err);
      showNotify('error', 'Không thể lưu dữ liệu tiêu chuẩn.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deletePharmacopoeiaStandard(deletingId);
      showNotify('success', 'Đã xóa tiêu chuẩn dược điển.');
      setIsDeleteModalOpen(false);
      setDeletingId(null);
      await loadData();
    } catch (err) {
      console.error('Lỗi xóa tiêu chuẩn:', err);
      showNotify('error', 'Không thể xóa tiêu chuẩn dược điển.');
    }
  };

  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    try {
      await seedPharmacopoeiaStandards();
      showNotify('success', `Đã đồng bộ ${DEFAULT_PHARMACOPOEIA_DB.length} tiêu chuẩn DĐVN/USP/BP lên CSDL RTDB.`);
      await loadData();
    } catch (err) {
      console.error('Lỗi nạp dữ liệu mẫu:', err);
      showNotify('error', 'Không thể đồng bộ dữ liệu mẫu.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <section className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4 lg:col-span-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <BookOpenIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-ink">Cơ sở Dữ liệu Dược điển & AI Context</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                {standards.length} tiêu chuẩn
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              Quản lý các tiêu chuẩn DĐVN, USP, BP được AI truy xuất động (Dynamic Context) khi thực thi prompt.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSeedDefaults}
            disabled={isSeeding}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-ink text-xs font-semibold rounded-lg border border-border transition-all disabled:opacity-50"
            title="Đồng bộ lại 31 tiêu chuẩn mẫu DĐVN/USP/BP"
          >
            <DocumentDuplicateIcon className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : 'text-indigo-500'}`} />
            {isSeeding ? 'Đang nạp...' : 'Nạp dữ liệu chuẩn'}
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Thêm tiêu chuẩn
          </button>
        </div>
      </div>

      {/* Thông báo */}
      {notification && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between animate-in fade-in duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <MagnifyingGlassIcon className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm tiêu đề, từ khóa, nguồn dược điển..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface-2 border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filterCategory === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-surface-2 text-ink-muted hover:text-ink hover:bg-surface-3'
            }`}
          >
            Tất cả phân loại
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filterCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-surface-2 text-ink-muted hover:text-ink hover:bg-surface-3'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Bảng dữ liệu */}
      {loading ? (
        <div className="p-8 text-center text-xs text-ink-muted flex items-center justify-center gap-2">
          <ArrowPathIcon className="w-4 h-4 animate-spin text-indigo-500" />
          Đang tải dữ liệu tiêu chuẩn dược điển...
        </div>
      ) : filteredStandards.length === 0 ? (
        <div className="p-8 text-center bg-surface-2/40 rounded-xl border border-dashed border-border space-y-2">
          <BookOpenIcon className="w-8 h-8 mx-auto text-ink-muted opacity-60" />
          <p className="text-xs font-medium text-ink">Chưa có tiêu chuẩn nào khớp với tìm kiếm</p>
          <p className="text-[11px] text-ink-muted">Bạn có thể bấm "Nạp dữ liệu chuẩn" để khôi phục 31 tiêu chuẩn mẫu hoặc bấm "Thêm tiêu chuẩn".</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-2/70 text-ink-muted font-semibold border-b border-border">
              <tr>
                <th className="px-3.5 py-2.5">Tiêu chuẩn / Chỉ tiêu</th>
                <th className="px-3 py-2.5">Phân loại</th>
                <th className="px-3 py-2.5">Nguồn Dược điển</th>
                <th className="px-3 py-2.5">Từ khóa nhận diện AI</th>
                <th className="px-3 py-2.5">Nội dung quy định</th>
                <th className="px-3 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredStandards.map((item) => (
                <tr key={item.id} className="hover:bg-surface-2/50 transition-colors">
                  <td className="px-3.5 py-2.5 font-semibold text-ink">
                    <div className="flex items-center gap-1.5">
                      <SparklesIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>{item.title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">{item.category}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-md font-mono text-[10px] font-bold border border-indigo-500/20">
                      {item.source}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ink-muted text-[11px] max-w-[200px] truncate" title={(item.keywords || []).join(', ')}>
                    {(item.keywords || []).slice(0, 3).join(', ')}{(item.keywords || []).length > 3 ? '...' : ''}
                  </td>
                  <td className="px-3 py-2.5 text-ink-muted text-[11px] max-w-xs truncate" title={item.standard}>
                    {item.standard}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1 text-ink-muted hover:text-indigo-600 transition-colors mr-1"
                      title="Chỉnh sửa"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setDeletingId(item.id);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-1 text-ink-muted hover:text-rose-600 transition-colors"
                      title="Xóa tiêu chuẩn"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Thêm / Sửa Tiêu chuẩn */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem?.id && standards.some(s => s.id === editingItem.id) ? 'Chỉnh sửa Tiêu chuẩn Dược điển' : 'Thêm Tiêu chuẩn Dược điển mới'}
        icon={BookOpenIcon}
        color="bg-indigo-600"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-muted">Tên Tiêu chuẩn / Chỉ tiêu *</label>
              <input
                type="text"
                required
                value={editingItem?.title || ''}
                onChange={(e) => setEditingItem(prev => ({ ...prev, title: e.target.value }))}
                placeholder="VD: Độ hòa tan (Dissolution)"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-muted">Phân loại *</label>
              <input
                type="text"
                required
                value={editingItem?.category || ''}
                onChange={(e) => setEditingItem(prev => ({ ...prev, category: e.target.value }))}
                placeholder="VD: Lý hóa, Định lượng, Vi sinh..."
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-muted">Nguồn Dược điển *</label>
            <input
              type="text"
              required
              value={editingItem?.source || ''}
              onChange={(e) => setEditingItem(prev => ({ ...prev, source: e.target.value }))}
              placeholder="VD: DĐVN V, Phụ lục 11.4 / USP <711>"
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-muted">Từ khóa nhận diện AI (phân cách bởi dấu phẩy)</label>
            <input
              type="text"
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder="VD: độ hòa tan, dissolution, hòa tan, in-vitro"
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-muted">Nội dung quy định / Tiêu chuẩn chi tiết (Markdown)</label>
            <textarea
              rows={4}
              required
              value={editingItem?.standard || ''}
              onChange={(e) => setEditingItem(prev => ({ ...prev, standard: e.target.value }))}
              placeholder="Nhập chi tiết giới hạn, phương pháp, điều kiện kiểm nghiệm..."
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-ink-muted hover:text-ink rounded-lg"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-all"
            >
              Lưu tiêu chuẩn
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal xác nhận xóa */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Xóa tiêu chuẩn dược điển"
        message="Bạn có chắc chắn muốn xóa tiêu chuẩn này khỏi cơ sở dữ liệu động? AI sẽ không thể truy xuất tiêu chuẩn này trong các lượt truy vấn tiếp theo."
        confirmText="Xác nhận xóa"
      />
    </section>
  );
};
