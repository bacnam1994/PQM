/**
 * PQM V4 Platform - Change Control Management Page (GMP-WHO / ICH Q10)
 * Quản lý Hồ sơ Yêu cầu Thay đổi & Kế hoạch Hành động
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ArrowsRightLeftIcon, 
  PlusIcon, 
  MagnifyingGlassIcon, 
  ArrowPathIcon, 
  ArrowRightIcon,
  ShieldExclamationIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useAppStore } from '../../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { 
  ChangeRequest, ChangeCategory, ChangeType, ChangeStatus, 
  CreateChangeRequestInput, FMEARiskAssessment 
} from '../../../types/changeControl';
import { changeControlAppService } from '../../../services/app/ChangeControlAppService';
import { ChangeControlDetailModal } from './ChangeControlDetailModal';
import { formatDateStandard } from '../../../utils';
import { Modal } from '../../../components/ui/CommonUI';

export const ChangeControlListPage: React.FC = () => {
  const { user, role, products } = useAppStore(useShallow(s => ({
    user: s.user,
    role: s.role,
    products: s.products
  })));

  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedCR, setSelectedCR] = useState<ChangeRequest | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New CR Form State
  const [newForm, setNewForm] = useState<CreateChangeRequestInput>({
    title: '',
    category: 'MANUFACTURING_PROCESS',
    changeType: 'MAJOR',
    justification: '',
    description: '',
    targetImplementationDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    productId: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await changeControlAppService.getAll();
      setChangeRequests(data);
    } catch {
      toast.error('Không thể tải danh sách Change Control');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync selectedCR with fresh data
  useEffect(() => {
    if (selectedCR) {
      const fresh = changeRequests.find(r => r.id === selectedCR.id);
      if (fresh) setSelectedCR(fresh);
    }
  }, [changeRequests]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.title.trim() || !newForm.justification.trim() || !newForm.description.trim()) {
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }

    try {
      const prod = products.find(p => p.id === newForm.productId);
      await changeControlAppService.createChangeRequest({
        ...newForm,
        productName: prod?.name
      }, user || { email: 'anonymous@pqm.com' });

      toast.success('Đã khởi tạo Yêu cầu Thay đổi GMP thành công!');
      setShowCreateModal(false);
      setNewForm({
        title: '',
        category: 'MANUFACTURING_PROCESS',
        changeType: 'MAJOR',
        justification: '',
        description: '',
        targetImplementationDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        productId: ''
      });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khởi tạo Change Request');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: ChangeStatus, notes?: string) => {
    try {
      await changeControlAppService.updateStatus(id, newStatus, { email: user?.email, role }, notes);
      toast.success('Đã cập nhật trạng thái Change Request!');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật trạng thái');
    }
  };

  const handleAssessFMEA = async (id: string, fmea: Omit<FMEARiskAssessment, 'rpn' | 'riskLevel'>) => {
    try {
      await changeControlAppService.assessFMEARisk(id, fmea, { email: user?.email });
      toast.success('Đã lưu đánh giá rủi ro FMEA!');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu FMEA');
    }
  };

  const handleAddAction = async (id: string, item: { title: string; responsible: string; deadline: string }) => {
    try {
      await changeControlAppService.addActionItem(id, item, { email: user?.email });
      toast.success('Đã thêm hành động vào kế hoạch thay đổi!');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi thêm hành động');
    }
  };

  const handleCompleteAction = async (id: string, actionId: string) => {
    try {
      await changeControlAppService.completeActionItem(id, actionId, { email: user?.email });
      toast.success('Đã hoàn tất hành động!');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi hoàn tất hành động');
    }
  };

  // KPIs
  const total = changeRequests.length;
  const assessmentCount = changeRequests.filter(r => r.status === 'IMPACT_ASSESSMENT').length;
  const implementingCount = changeRequests.filter(r => r.status === 'IMPLEMENTATION' || r.status === 'APPROVED').length;
  const closedCount = changeRequests.filter(r => r.status === 'CLOSED').length;
  const criticalCount = changeRequests.filter(r => r.changeType === 'CRITICAL' || r.changeType === 'EMERGENCY').length;

  const filtered = useMemo(() => {
    return changeRequests.filter(cr => {
      if (statusFilter !== 'ALL' && cr.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && cr.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = cr.crNo.toLowerCase().includes(q);
        const matchTitle = cr.title.toLowerCase().includes(q);
        const matchProd = cr.productName?.toLowerCase().includes(q);
        if (!matchNo && !matchTitle && !matchProd) return false;
      }
      return true;
    });
  }, [changeRequests, statusFilter, categoryFilter, searchQuery]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
            <ArrowsRightLeftIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              Quản lý Thay đổi Chuẩn GMP (Change Control)
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted">
              Kiểm soát các thay đổi về công thức, quy trình, tiêu chuẩn, thiết bị và nhà cung cấp (ICH Q10 / PIC/S)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-border bg-surface text-ink-soft hover:bg-surface-2 transition-colors"
            title="Tải lại dữ liệu"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all"
          >
            <PlusIcon className="h-4 w-4 stroke-[2.5]" />
            <span>Tạo Yêu cầu Thay đổi</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-surface border border-border shadow-sm">
          <span className="text-[10px] font-black uppercase text-ink-muted tracking-wider">Tổng yêu cầu</span>
          <p className="text-2xl font-black text-ink mt-1">{total}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 shadow-sm">
          <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 tracking-wider">Đánh giá tác động</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-300 mt-1">{assessmentCount}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/50 shadow-sm">
          <span className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-400 tracking-wider">Đang triển khai</span>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-300 mt-1">{implementingCount}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 shadow-sm">
          <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">Đã đóng (Closed)</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-300 mt-1">{closedCount}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 shadow-sm">
          <span className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-400 tracking-wider">Critical / Khẩn cấp</span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-300 mt-1">{criticalCount}</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-surface p-4 rounded-2xl border border-border shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            placeholder="Tìm theo mã CR, tiêu đề thay đổi hoặc sản phẩm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-2 border border-border rounded-xl text-xs font-bold text-ink placeholder:text-ink-muted outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs font-bold outline-none text-ink"
          >
            <option value="ALL">Tất cả phân loại</option>
            <option value="FORMULA">Công thức (Formula)</option>
            <option value="RAW_MATERIAL">Nguyên liệu (Raw Material)</option>
            <option value="MANUFACTURING_PROCESS">Quy trình sản xuất</option>
            <option value="ANALYTICAL_METHOD">Phương pháp kiểm nghiệm</option>
            <option value="EQUIPMENT">Thiết bị</option>
            <option value="PACKAGING">Bao bì đóng gói</option>
            <option value="SPECIFICATION">Tiêu chuẩn (TCCS)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs font-bold outline-none text-ink"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="IMPACT_ASSESSMENT">Đánh giá tác động</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="IMPLEMENTATION">Đang triển khai</option>
            <option value="CLOSED">Đã đóng</option>
          </select>
        </div>
      </div>

      {/* Change Requests Table */}
      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-ink-muted uppercase tracking-wider font-black">
                <th className="p-4 w-36">Mã CR</th>
                <th className="p-4 min-w-[260px]">Tiêu đề Thay đổi</th>
                <th className="p-4 w-40">Phân loại</th>
                <th className="p-4 w-28">Mức độ</th>
                <th className="p-4 w-32">FMEA RPN</th>
                <th className="p-4 w-36">Hạn hoàn thành</th>
                <th className="p-4 w-32 text-center">Trạng thái</th>
                <th className="p-4 w-20 text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-ink-muted font-medium">
                    Chưa có Yêu cầu Thay đổi nào phù hợp.
                  </td>
                </tr>
              ) : (
                filtered.map(cr => {
                  const rpn = cr.riskAssessment?.rpn;
                  const rpnColor = rpn 
                    ? rpn >= 60 ? 'text-rose-600 bg-rose-500/10 border-rose-500/30' 
                    : rpn >= 25 ? 'text-amber-600 bg-amber-500/10 border-amber-500/30' 
                    : 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30'
                    : 'text-ink-muted bg-surface-2 border-border';

                  return (
                    <tr 
                      key={cr.id}
                      onClick={() => setSelectedCR(cr)}
                      className="hover:bg-surface-2 transition-colors cursor-pointer"
                    >
                      <td className="p-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {cr.crNo}
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-ink">{cr.title}</p>
                        {cr.productName && (
                          <span className="text-[11px] text-ink-muted">Sản phẩm: {cr.productName}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="font-medium text-ink-soft">{cr.category}</span>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase border border-border text-ink-soft">
                          {cr.changeType}
                        </span>
                      </td>
                      <td className="p-4">
                        {rpn ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border ${rpnColor}`}>
                            RPN: {rpn}
                          </span>
                        ) : (
                          <span className="text-ink-muted text-[11px]">Chưa tính</span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-ink-soft">
                        {formatDateStandard(cr.targetImplementationDate)}
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-surface-2 text-ink-soft border border-border">
                          {cr.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <ArrowRightIcon className="h-3.5 w-3.5 text-ink-muted mx-auto" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <ChangeControlDetailModal
        isOpen={!!selectedCR}
        onClose={() => setSelectedCR(null)}
        changeRequest={selectedCR}
        onUpdateStatus={handleUpdateStatus}
        onAssessFMEA={handleAssessFMEA}
        onAddActionItem={handleAddAction}
        onCompleteActionItem={handleCompleteAction}
        currentUserRole={role}
      />

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Khởi tạo Yêu cầu Thay đổi GMP (Change Request)"
        icon={PlusIcon}
        color="bg-emerald-600"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-ink block mb-1">
              Tiêu đề Yêu cầu Thay đổi <span className="text-rose-500">*</span>:
            </label>
            <input
              type="text"
              placeholder="VD: Thay đổi thông số nhiệt độ ép vỉ màng nhôm..."
              value={newForm.title}
              onChange={(e) => setNewForm(f => ({ ...f, title: e.target.value }))}
              className="w-full p-2.5 bg-surface-2 border border-border rounded-xl font-medium text-ink outline-none focus:border-emerald-500 transition-colors"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-ink block mb-1">Phân loại:</label>
              <select
                value={newForm.category}
                onChange={(e) => setNewForm(f => ({ ...f, category: e.target.value as ChangeCategory }))}
                className="w-full p-2.5 bg-surface-2 border border-border rounded-xl font-bold text-ink"
              >
                <option value="MANUFACTURING_PROCESS">Quy trình sản xuất</option>
                <option value="FORMULA">Công thức sản phẩm</option>
                <option value="RAW_MATERIAL">Nguyên liệu đầu vào</option>
                <option value="ANALYTICAL_METHOD">Phương pháp kiểm nghiệm</option>
                <option value="EQUIPMENT">Thiết bị</option>
                <option value="PACKAGING">Bao bì đóng gói</option>
                <option value="SPECIFICATION">Tiêu chuẩn (TCCS)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-ink block mb-1">Mức độ thay đổi:</label>
              <select
                value={newForm.changeType}
                onChange={(e) => setNewForm(f => ({ ...f, changeType: e.target.value as ChangeType }))}
                className="w-full p-2.5 bg-surface-2 border border-border rounded-xl font-bold text-ink"
              >
                <option value="MINOR">Nhẹ (Minor)</option>
                <option value="MAJOR">Đáng kể (Major)</option>
                <option value="CRITICAL">Nghiêm trọng (Critical)</option>
                <option value="EMERGENCY">Khẩn cấp (Emergency)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-ink block mb-1">Sản phẩm liên đới (tùy chọn):</label>
            <select
              value={newForm.productId}
              onChange={(e) => setNewForm(f => ({ ...f, productId: e.target.value }))}
              className="w-full p-2.5 bg-surface-2 border border-border rounded-xl font-medium text-ink"
            >
              <option value="">-- Không gắn sản phẩm cụ thể --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-ink block mb-1">
              Lý do và tính cần thiết (Justification) <span className="text-rose-500">*</span>:
            </label>
            <textarea
              rows={2}
              placeholder="Tại sao cần thực hiện thay đổi này..."
              value={newForm.justification}
              onChange={(e) => setNewForm(f => ({ ...f, justification: e.target.value }))}
              className="w-full p-2.5 bg-surface-2 border border-border rounded-xl font-medium text-ink outline-none focus:border-emerald-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="font-bold text-ink block mb-1">
              Nội dung và phạm vi thay đổi cụ thể (Description) <span className="text-rose-500">*</span>:
            </label>
            <textarea
              rows={3}
              placeholder="Mô tả chi tiết những gì sẽ thay đổi, thông số cũ vs mới..."
              value={newForm.description}
              onChange={(e) => setNewForm(f => ({ ...f, description: e.target.value }))}
              className="w-full p-2.5 bg-surface-2 border border-border rounded-xl font-medium text-ink outline-none focus:border-emerald-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="font-bold text-ink block mb-1">
              Hạn dự kiến hoàn thành triển khai:
            </label>
            <input
              type="date"
              value={newForm.targetImplementationDate}
              onChange={(e) => setNewForm(f => ({ ...f, targetImplementationDate: e.target.value }))}
              className="w-full p-2.5 bg-surface-2 border border-border rounded-xl font-medium text-ink outline-none focus:border-emerald-500 transition-colors"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-ink-muted hover:text-ink font-bold uppercase text-xs hover:bg-surface-2 rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-xs rounded-xl shadow-sm transition-all"
            >
              Lưu Change Request
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default ChangeControlListPage;
