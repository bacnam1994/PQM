/**
 * PQM 3.0 - Quality Deviation & CAPA Management Page
 * ===================================================
 * Quản lý Hồ sơ Sai lệch Chất lượng & Hành động Khắc phục / Phòng ngừa (CAPA)
 * Tuân thủ tiêu chuẩn GMP-WHO và FDA 21 CFR Part 211.
 * Tích hợp AI Gateway (Phân tích Nguyên nhân gốc rễ 5-Why & Ishikawa) và Kiểm soát State Machine.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ShieldAlert, Plus, Search, Filter, AlertTriangle, CheckCircle2, 
  Clock, ArrowRight, Sparkles, X, CheckCircle, 
  FileText, Eye, RefreshCw, Loader2, AlertOctagon, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { QualityDeviation, DeviationStatus, DeviationSeverity, DeviationSource } from '../../types/deviation';
import { firebaseDeviationRepository } from '../../repositories/firebase/FirebaseDeviationRepository';
import { deviationAppService } from '../../services/app/DeviationAppService';
import { aiGateway } from '../../services/ai/AIGateway';
import { formatDateStandard } from '../../utils';
import { Modal } from '../../components/ui/CommonUI';

// Trạng thái workflow hiển thị
const STATUS_CONFIG: Record<DeviationStatus, { label: string; bg: string; text: string; border: string; step: number }> = {
  LOGGED: { label: 'Mới ghi nhận', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-700 dark:text-zinc-300', border: 'border-zinc-300 dark:border-zinc-700', step: 1 },
  UNDER_INVESTIGATION: { label: 'Đang điều tra', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700', step: 2 },
  CAPA_PLANNED: { label: 'Đang thực hiện CAPA', bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700', step: 3 },
  EFFECTIVENESS_REVIEW: { label: 'Đánh giá hiệu quả', bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700', step: 4 },
  CLOSED: { label: 'Đã đóng hồ sơ', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-700', step: 5 },
};

const SEVERITY_CONFIG: Record<DeviationSeverity, { label: string; badge: string; dot: string }> = {
  CRITICAL: { label: 'Nghiêm trọng (Critical)', badge: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800', dot: 'bg-rose-500' },
  MAJOR: { label: 'Đáng kể (Major)', badge: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' },
  MINOR: { label: 'Nhẹ (Minor)', badge: 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800', dot: 'bg-slate-400' },
};

const SOURCE_LABELS: Record<DeviationSource, string> = {
  OOS_TEST_RESULT: 'OOS Kiểm nghiệm',
  OOT_TREND: 'Xu hướng OOT',
  MANUFACTURING: 'Sản xuất',
  RAW_MATERIAL: 'Nguyên vật liệu',
  STORAGE_ENVIRONMENT: 'Môi trường / Kho',
  INTERNAL_AUDIT: 'Audit nội bộ',
};

const DeviationListPage: React.FC = () => {
  const { user, role, batches, products } = useAppStore(useShallow(s => ({
    user: s.user,
    role: s.role,
    batches: s.batches,
    products: s.products
  })));

  const [deviations, setDeviations] = useState<QualityDeviation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [selectedDeviation, setSelectedDeviation] = useState<QualityDeviation | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionNotes, setTransitionNotes] = useState('');
  const [targetStatus, setTargetStatus] = useState<DeviationStatus>('UNDER_INVESTIGATION');

  // AI Root Cause state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any | null>(null);

  // New Deviation Form state
  const [newForm, setNewForm] = useState({
    title: '',
    source: 'OOS_TEST_RESULT' as DeviationSource,
    severity: 'MAJOR' as DeviationSeverity,
    batchId: '',
    description: '',
    immediateAction: ''
  });

  // CAPA Action Item Form state inside drawer
  const [showAddCapa, setShowAddCapa] = useState(false);
  const [capaForm, setCapaForm] = useState({
    action: '',
    type: 'CORRECTIVE' as 'CORRECTIVE' | 'PREVENTIVE' | 'IMMEDIATE',
    responsible: '',
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  });

  // Tải danh sách sai lệch từ kho lưu trữ
  const loadDeviations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await firebaseDeviationRepository.findAll();
      // Sắp xếp mới nhất lên đầu
      setDeviations(data.sort((a, b) => (b.loggedAt || '').localeCompare(a.loggedAt || '')));
    } catch (error) {
      console.error('Lỗi nạp danh sách sai lệch:', error);
      toast.error('Không thể tải dữ liệu hồ sơ sai lệch.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeviations();
  }, [loadDeviations]);

  // Cập nhật selectedDeviation khi deviations thay đổi (đảm bảo drawer luôn mới nhất)
  useEffect(() => {
    if (selectedDeviation) {
      const fresh = deviations.find(d => d.id === selectedDeviation.id);
      if (fresh) setSelectedDeviation(fresh);
    }
  }, [deviations]);

  // Thống kê nhanh theo KPI
  const stats = useMemo(() => {
    const total = deviations.length;
    const underInvest = deviations.filter(d => d.status === 'UNDER_INVESTIGATION' || d.status === 'LOGGED').length;
    const capa = deviations.filter(d => d.status === 'CAPA_PLANNED').length;
    const review = deviations.filter(d => d.status === 'EFFECTIVENESS_REVIEW').length;
    const closed = deviations.filter(d => d.status === 'CLOSED').length;
    const critical = deviations.filter(d => d.severity === 'CRITICAL' && d.status !== 'CLOSED').length;
    return { total, underInvest, capa, review, closed, critical };
  }, [deviations]);

  // Lọc theo bộ lọc
  const filteredDeviations = useMemo(() => {
    return deviations.filter(d => {
      if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
      if (severityFilter !== 'ALL' && d.severity !== severityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = (d.deviationNo || '').toLowerCase().includes(q);
        const matchTitle = (d.title || '').toLowerCase().includes(q);
        const matchBatch = (d.batchNo || '').toLowerCase().includes(q);
        const matchProduct = (d.productName || '').toLowerCase().includes(q);
        if (!matchNo && !matchTitle && !matchBatch && !matchProduct) return false;
      }
      return true;
    });
  }, [deviations, statusFilter, severityFilter, searchQuery]);

  // Xử lý tạo Sai lệch thủ công
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.title.trim()) {
      toast.error('Vui lòng nhập tiêu đề sai lệch.');
      return;
    }

    try {
      const batch = batches.find(b => b.id === newForm.batchId);
      const product = batch ? products.find(p => p.id === batch.productId) : undefined;

      await deviationAppService.createDeviation({
        title: newForm.title.trim(),
        source: newForm.source,
        severity: newForm.severity,
        batchId: newForm.batchId || undefined,
        batchNo: batch?.batchNo,
        productId: batch?.productId,
        productName: product?.name,
        description: newForm.description.trim() || undefined,
        immediateAction: newForm.immediateAction.trim() || undefined
      }, user);

      toast.success('Khởi tạo hồ sơ sai lệch thành công!');
      setShowCreateModal(false);
      setNewForm({
        title: '',
        source: 'OOS_TEST_RESULT',
        severity: 'MAJOR',
        batchId: '',
        description: '',
        immediateAction: ''
      });
      await loadDeviations();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi tạo hồ sơ sai lệch.');
    }
  };

  // Xử lý chuyển đổi trạng thái State Machine
  const handleTransitionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviation) return;

    if (targetStatus === 'CLOSED') {
      if (role !== 'QA' && role !== 'ADMIN') {
        toast.error('Chỉ Trưởng phòng QA hoặc Quản trị viên mới có thẩm quyền Đóng hồ sơ sai lệch.');
        return;
      }
      if (!transitionNotes.trim()) {
        toast.error('Quy chuẩn GMP: Bắt buộc phải ghi nhận ý kiến đánh giá hiệu quả và kết luận đóng hồ sơ.');
        return;
      }
    }

    try {
      await deviationAppService.updateStatus(
        selectedDeviation.id,
        targetStatus,
        user,
        { notes: transitionNotes.trim() }
      );

      toast.success(`Hồ sơ ${selectedDeviation.deviationNo} đã chuyển sang "${STATUS_CONFIG[targetStatus].label}"`);
      setShowTransitionModal(false);
      setTransitionNotes('');
      await loadDeviations();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi chuyển đổi trạng thái.');
    }
  };

  // Xử lý thêm hành động CAPA
  const handleAddCAPASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviation) return;
    if (!capaForm.action.trim()) {
      toast.error('Vui lòng nhập nội dung hành động CAPA.');
      return;
    }

    try {
      await deviationAppService.addCAPAItem(
        selectedDeviation.id,
        {
          action: capaForm.action.trim(),
          type: capaForm.type,
          responsible: capaForm.responsible.trim() || user?.email || 'QA Staff',
          deadline: capaForm.deadline,
          status: 'PENDING'
        },
        user
      );

      toast.success('Đã thêm hành động CAPA vào hồ sơ!');
      setCapaForm({
        action: '',
        type: 'CORRECTIVE',
        responsible: '',
        deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
      });
      setShowAddCapa(false);
      await loadDeviations();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi thêm CAPA.');
    }
  };

  // Đánh dấu hoàn tất một hành động CAPA
  const handleToggleCAPA = async (capaId: string) => {
    if (!selectedDeviation) return;
    try {
      await deviationAppService.completeCAPAItem(selectedDeviation.id, capaId, user);
      toast.success('Đã cập nhật hoàn thành hành động CAPA!');
      await loadDeviations();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi cập nhật CAPA.');
    }
  };

  // AI Root Cause Analysis (5-Why & Ishikawa)
  const handleRunAIAnalysis = async () => {
    if (!selectedDeviation) return;
    setAiLoading(true);
    setAiAnalysis(null);

    try {
      const promptInput = {
        deviationNo: selectedDeviation.deviationNo,
        title: selectedDeviation.title,
        severity: selectedDeviation.severity,
        source: selectedDeviation.source,
        batchNo: selectedDeviation.batchNo || 'Không xác định',
        productName: selectedDeviation.productName || 'Không xác định',
        failedCriteria: selectedDeviation.failedCriteria || [],
        description: selectedDeviation.description || 'Không có mô tả chi tiết',
        immediateAction: selectedDeviation.immediateAction
      };

      const response = await aiGateway.execute({
        promptId: 'DEVIATION_REPORT',
        input: promptInput,
        options: {
          userId: user?.uid,
          userEmail: user?.email,
          documentType: 'DEVIATION',
          documentId: selectedDeviation.id
        }
      });

      if (response.success && response.data) {
        setAiAnalysis({
          content: response.data,
          metadata: response.metadata
        });
        toast.success('AI đã hoàn thành phân tích nguyên nhân gốc rễ!');
      } else {
        throw new Error(response.error || 'AI không trả về dữ liệu phân tích.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi suy luận AI.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Header & Top Actions ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-900/50">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Quản lý Sai lệch & CAPA
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                Theo dõi sự cố OOS, điều tra nguyên nhân gốc rễ và kiểm soát hành động khắc phục/phòng ngừa (GMP-WHO / 21 CFR Part 211)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadDeviations}
            disabled={loading}
            className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm shadow-sm transition-all focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
          >
            <Plus size={16} />
            <span>Khởi tạo Sai lệch</span>
          </button>
        </div>
      </div>

      {/* ─── KPI Metric Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tổng hồ sơ</p>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{stats.total}</span>
            <FileText size={16} className="text-zinc-400" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Đang điều tra</p>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.underInvest}</span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Thực hiện CAPA</p>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.capa}</span>
            <Clock size={16} className="text-blue-500" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm">
          <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Đánh giá hiệu quả</p>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.review}</span>
            <Activity size={16} className="text-purple-500" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Đã đóng (Closed)</p>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.closed}</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/60 shadow-sm">
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Nghiêm trọng (Critical)</p>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.critical}</span>
            <AlertOctagon size={16} className="text-rose-500" />
          </div>
        </div>
      </div>

      {/* ─── Search & Filter Bar ─── */}
      <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            type="text"
            placeholder="Tìm theo mã hồ sơ (DEV-...), lô sản xuất, tên sản phẩm hoặc tiêu đề..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-sm outline-none focus:border-rose-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Filter Status */}
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-3 py-1.5">
            <Filter size={14} className="text-zinc-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-medium outline-none cursor-pointer text-zinc-700 dark:text-zinc-300"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="LOGGED">Mới ghi nhận</option>
              <option value="UNDER_INVESTIGATION">Đang điều tra</option>
              <option value="CAPA_PLANNED">Đang thực hiện CAPA</option>
              <option value="EFFECTIVENESS_REVIEW">Đánh giá hiệu quả</option>
              <option value="CLOSED">Đã đóng hồ sơ</option>
            </select>
          </div>

          {/* Filter Severity */}
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-3 py-1.5">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-transparent text-xs font-medium outline-none cursor-pointer text-zinc-700 dark:text-zinc-300"
            >
              <option value="ALL">Tất cả mức độ</option>
              <option value="CRITICAL">Nghiêm trọng (Critical)</option>
              <option value="MAJOR">Đáng kể (Major)</option>
              <option value="MINOR">Nhẹ (Minor)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Deviations Data Table / List ─── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
            <Loader2 className="animate-spin mb-3 text-rose-500" size={32} />
            <p className="text-sm">Đang tải danh sách hồ sơ sai lệch...</p>
          </div>
        ) : filteredDeviations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </div>
            <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Không có hồ sơ sai lệch nào</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
              Không tìm thấy hồ sơ sai lệch nào phù hợp với bộ lọc hiện tại. Tất cả các lô và chỉ tiêu đang trong ngưỡng an toàn.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200/70 dark:border-zinc-800/70 bg-zinc-50/70 dark:bg-zinc-900/50 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Mã hồ sơ</th>
                  <th className="py-3.5 px-4">Tiêu đề & Nguồn</th>
                  <th className="py-3.5 px-4">Lô / Sản phẩm</th>
                  <th className="py-3.5 px-4">Mức độ</th>
                  <th className="py-3.5 px-4">Trạng thái Workflow</th>
                  <th className="py-3.5 px-4">Tiến độ CAPA</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800/50 text-sm">
                {filteredDeviations.map(dev => {
                  const statusInfo = STATUS_CONFIG[dev.status] || STATUS_CONFIG.LOGGED;
                  const severityInfo = SEVERITY_CONFIG[dev.severity] || SEVERITY_CONFIG.MINOR;
                  const capaTotal = dev.capaItems?.length || 0;
                  const capaDone = dev.capaItems?.filter(c => c.status === 'COMPLETED').length || 0;

                  return (
                    <tr 
                      key={dev.id} 
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                      onClick={() => {
                        setSelectedDeviation(dev);
                        setAiAnalysis(null);
                      }}
                    >
                      {/* Mã hồ sơ & Ngày */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          <span>{dev.deviationNo}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono">v{dev.version}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          {formatDateStandard(dev.loggedAt)}
                        </div>
                      </td>

                      {/* Tiêu đề & Nguồn */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                          {dev.title}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {SOURCE_LABELS[dev.source] || dev.source}
                          </span>
                          {dev.failedCriteria && dev.failedCriteria.length > 0 && (
                            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                              ({dev.failedCriteria.length} chỉ tiêu OOS)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Lô / Sản phẩm */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {dev.batchNo ? (
                          <>
                            <div className="font-medium text-zinc-800 dark:text-zinc-200">
                              Lô: <span className="font-semibold">{dev.batchNo}</span>
                            </div>
                            <div className="text-xs text-zinc-400 truncate max-w-[180px]">
                              {dev.productName || 'Chế phẩm liên kết'}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-400 italic">Không gắn lô cụ thể</span>
                        )}
                      </td>

                      {/* Mức độ rủi ro */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${severityInfo.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${severityInfo.dot}`} />
                          {severityInfo.label.split(' ')[0]}
                        </span>
                      </td>

                      {/* Trạng thái workflow */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-medium border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Tiến độ CAPA */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {capaTotal > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${capaDone === capaTotal ? 'bg-emerald-500' : 'bg-blue-500'} rounded-full`} 
                                style={{ width: `${Math.round((capaDone / capaTotal) * 100)}%` }} 
                              />
                            </div>
                            <span className="text-xs text-zinc-500 font-mono">{capaDone}/{capaTotal}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">Chưa tạo CAPA</span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedDeviation(dev);
                              setAiAnalysis(null);
                            }}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            title="Xem chi tiết & CAPA"
                          >
                            <Eye size={16} />
                          </button>

                          {dev.status !== 'CLOSED' && (
                            <button
                              onClick={() => {
                                setSelectedDeviation(dev);
                                const nextMap: Record<DeviationStatus, DeviationStatus> = {
                                  LOGGED: 'UNDER_INVESTIGATION',
                                  UNDER_INVESTIGATION: 'CAPA_PLANNED',
                                  CAPA_PLANNED: 'EFFECTIVENESS_REVIEW',
                                  EFFECTIVENESS_REVIEW: 'CLOSED',
                                  CLOSED: 'CLOSED'
                                };
                                setTargetStatus(nextMap[dev.status]);
                                setShowTransitionModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
                            >
                              <span>Chuyển bước</span>
                              <ArrowRight size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Drawer: Hồ sơ Chi tiết & Điều tra CAPA ─── */}
      {selectedDeviation && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800 overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-start justify-between sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur z-10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50 font-mono">
                    {selectedDeviation.deviationNo}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${SEVERITY_CONFIG[selectedDeviation.severity].badge}`}>
                    {SEVERITY_CONFIG[selectedDeviation.severity].label}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mt-1">
                  {selectedDeviation.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedDeviation(null)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Stepper Pipeline: 5 bước chuẩn GMP */}
            <div className="p-4 bg-zinc-50/80 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                {(['LOGGED', 'UNDER_INVESTIGATION', 'CAPA_PLANNED', 'EFFECTIVENESS_REVIEW', 'CLOSED'] as DeviationStatus[]).map((st) => {
                  const cfg = STATUS_CONFIG[st];
                  const currentStep = STATUS_CONFIG[selectedDeviation.status].step;
                  const isPassed = currentStep > cfg.step;
                  const isCurrent = currentStep === cfg.step;

                  return (
                    <div key={st} className="flex-1 flex flex-col items-center relative group">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isPassed 
                          ? 'bg-emerald-600 text-white' 
                          : isCurrent 
                            ? 'bg-rose-600 text-white ring-4 ring-rose-100 dark:ring-rose-950/60' 
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
                      }`}>
                        {isPassed ? <CheckCircle size={14} /> : cfg.step}
                      </div>
                      <span className={`text-[10px] font-medium mt-1 text-center hidden sm:block ${
                        isCurrent ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-zinc-500'
                      }`}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Drawer Content */}
            <div className="p-6 space-y-6 flex-1">
              {/* Thông tin hành chính & Lô */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800/60 text-xs">
                <div>
                  <span className="text-zinc-400 block">Nguồn phát sinh:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                    {SOURCE_LABELS[selectedDeviation.source]}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Lô sản xuất:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                    {selectedDeviation.batchNo || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Người ghi nhận:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block truncate">
                    {selectedDeviation.loggedBy}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Thời gian:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                    {formatDateStandard(selectedDeviation.loggedAt)}
                  </span>
                </div>
              </div>

              {/* Bảng chỉ tiêu OOS (nếu có) */}
              {selectedDeviation.failedCriteria && selectedDeviation.failedCriteria.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    <span>Các chỉ tiêu không đạt tiêu chuẩn (OOS Findings)</span>
                  </h3>
                  <div className="border border-rose-200 dark:border-rose-900/50 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-semibold">
                        <tr>
                          <th className="p-2.5">Tên chỉ tiêu</th>
                          <th className="p-2.5">Kết quả thực tế</th>
                          <th className="p-2.5">Giới hạn TCCS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100 dark:divide-rose-950/40">
                        {selectedDeviation.failedCriteria.map((c, i) => (
                          <tr key={i} className="bg-white dark:bg-zinc-900">
                            <td className="p-2.5 font-medium text-zinc-900 dark:text-zinc-100">{c.name}</td>
                            <td className="p-2.5 font-bold text-rose-600 dark:text-rose-400">{c.actualValue}</td>
                            <td className="p-2.5 text-zinc-500 dark:text-zinc-400">{c.specification}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Mô tả & Biệt trữ tức thời */}
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs font-semibold text-zinc-400 uppercase">Mô tả hiện tượng sai lệch:</span>
                  <p className="mt-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-800/50">
                    {selectedDeviation.description || 'Không có mô tả bổ sung.'}
                  </p>
                </div>
                {selectedDeviation.immediateAction && (
                  <div>
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1">
                      <CheckCircle size={13} />
                      <span>Hành động xử lý tức thời (Biệt trữ / Ngăn chặn):</span>
                    </span>
                    <p className="mt-1 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-200/50 dark:border-amber-900/50">
                      {selectedDeviation.immediateAction}
                    </p>
                  </div>
                )}
              </div>

              {/* ─── AI Root Cause Analysis Assistant ─── */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/60 to-purple-50/60 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200/70 dark:border-indigo-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-semibold text-sm">
                    <Sparkles size={18} className="text-indigo-500" />
                    <span>AI Phân tích Nguyên nhân Gốc rễ (5-Why & Ishikawa)</span>
                  </div>
                  <button
                    onClick={handleRunAIAnalysis}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
                  >
                    {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span>{aiAnalysis ? 'Phân tích lại' : 'Chạy AI phân tích'}</span>
                  </button>
                </div>

                {aiLoading && (
                  <div className="py-6 text-center text-indigo-600 dark:text-indigo-400 text-xs">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                    <p>Đang gửi dữ liệu đến AI Gateway (Prompt DEVIATION_REPORT@2.0.0)...</p>
                  </div>
                )}

                {aiAnalysis && (
                  <div className="space-y-3 pt-2 text-xs border-t border-indigo-200/60 dark:border-indigo-800/60">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                      <span>Mô hình: <b className="text-zinc-800 dark:text-zinc-200">{aiAnalysis.metadata?.modelUsed}</b></span>
                      <span>Độ tin cậy: <b className="text-emerald-600 font-semibold">{aiAnalysis.metadata?.confidenceLevel} ({Math.round(aiAnalysis.metadata?.confidenceScore * 100)}%)</b></span>
                    </div>

                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-indigo-100 dark:border-indigo-900/60 text-zinc-800 dark:text-zinc-200 whitespace-pre-line leading-relaxed">
                      {typeof aiAnalysis.content === 'string' 
                        ? aiAnalysis.content 
                        : JSON.stringify(aiAnalysis.content, null, 2)}
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Kế hoạch Hành động CAPA (Action Items) ─── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Clock size={16} className="text-blue-500" />
                    <span>Hành động Khắc phục & Phòng ngừa (CAPA Items)</span>
                  </h3>
                  {selectedDeviation.status !== 'CLOSED' && (
                    <button
                      onClick={() => setShowAddCapa(true)}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                    >
                      <Plus size={14} />
                      <span>Thêm hành động</span>
                    </button>
                  )}
                </div>

                {/* Form thêm CAPA mới */}
                {showAddCapa && (
                  <form onSubmit={handleAddCAPASubmit} className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 space-y-3 text-xs">
                    <div className="flex gap-2">
                      <select
                        value={capaForm.type}
                        onChange={e => setCapaForm(f => ({ ...f, type: e.target.value as any }))}
                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 outline-none font-medium"
                      >
                        <option value="CORRECTIVE">Khắc phục (Corrective)</option>
                        <option value="PREVENTIVE">Phòng ngừa (Preventive)</option>
                        <option value="IMMEDIATE">Tức thời (Immediate)</option>
                      </select>

                      <input
                        type="date"
                        value={capaForm.deadline}
                        onChange={e => setCapaForm(f => ({ ...f, deadline: e.target.value }))}
                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 outline-none"
                      />
                    </div>

                    <textarea
                      placeholder="Mô tả cụ thể hành động cần thực hiện..."
                      value={capaForm.action}
                      onChange={e => setCapaForm(f => ({ ...f, action: e.target.value }))}
                      rows={2}
                      className="w-full p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 outline-none"
                    />

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddCapa(false)}
                        className="px-3 py-1 rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      >
                        Lưu hành động
                      </button>
                    </div>
                  </form>
                )}

                {/* Danh sách CAPA items */}
                {(!selectedDeviation.capaItems || selectedDeviation.capaItems.length === 0) ? (
                  <p className="text-xs text-zinc-400 italic p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl text-center">
                    Chưa có hành động CAPA nào được gán cho hồ sơ này.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedDeviation.capaItems.map(capa => {
                      const isDone = capa.status === 'COMPLETED';
                      return (
                        <div 
                          key={capa.id}
                          className={`p-3 rounded-xl border transition-colors flex items-start justify-between gap-3 text-xs ${
                            isDone 
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50' 
                              : 'bg-white dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                capa.type === 'CORRECTIVE' 
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' 
                                  : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                              }`}>
                                {capa.type === 'CORRECTIVE' ? 'KHẮC PHỤC' : 'PHÒNG NGỪA'}
                              </span>
                              <span className="text-zinc-400">Hạn: {capa.deadline}</span>
                              <span className="text-zinc-400">· Phụ trách: {capa.responsible}</span>
                            </div>
                            <p className={`font-medium ${isDone ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                              {capa.action}
                            </p>
                            {isDone && (
                              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle size={12} />
                                <span>Đã hoàn thành lúc {formatDateStandard(capa.completedAt)}</span>
                              </p>
                            )}
                          </div>

                          {!isDone && selectedDeviation.status !== 'CLOSED' && (
                            <button
                              onClick={() => handleToggleCAPA(capa.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium shrink-0"
                            >
                              Xong
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ─── Thông tin Kết luận & Đóng hồ sơ (nếu đã CLOSED) ─── */}
              {selectedDeviation.status === 'CLOSED' && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold uppercase">
                    <CheckCircle2 size={16} />
                    <span>Hồ sơ đã thẩm định và chính thức Đóng (GMP Closed)</span>
                  </div>
                  <p className="text-zinc-700 dark:text-zinc-300 italic">
                    "{selectedDeviation.closureNotes || 'Đã kiểm tra tính hiệu quả của CAPA và phê duyệt đóng hồ sơ.'}"
                  </p>
                  <div className="text-[11px] text-zinc-400 pt-1">
                    Đóng bởi: <b>{selectedDeviation.closedBy || 'QA Officer'}</b> vào lúc {formatDateStandard(selectedDeviation.closedAt)}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 flex items-center justify-between sticky bottom-0">
              <span className="text-xs text-zinc-400">
                Optimistic Concurrency Version: v{selectedDeviation.version}
              </span>

              {selectedDeviation.status !== 'CLOSED' && (
                <button
                  onClick={() => {
                    const nextMap: Record<DeviationStatus, DeviationStatus> = {
                      LOGGED: 'UNDER_INVESTIGATION',
                      UNDER_INVESTIGATION: 'CAPA_PLANNED',
                      CAPA_PLANNED: 'EFFECTIVENESS_REVIEW',
                      EFFECTIVENESS_REVIEW: 'CLOSED',
                      CLOSED: 'CLOSED'
                    };
                    setTargetStatus(nextMap[selectedDeviation.status]);
                    setShowTransitionModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  <span>Chuyển trạng thái quy trình</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Chuyển đổi trạng thái Workflow ─── */}
      <Modal
        isOpen={showTransitionModal}
        onClose={() => setShowTransitionModal(false)}
        title="Chuyển bước Trạng thái Sai lệch (Workflow Transition)"
        icon={ArrowRight}
        color="bg-rose-600"
      >
        <form onSubmit={handleTransitionSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">
              Trạng thái tiếp theo:
            </label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as DeviationStatus)}
              className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-medium"
            >
              <option value="UNDER_INVESTIGATION">2. Đang điều tra (Under Investigation)</option>
              <option value="CAPA_PLANNED">3. Đang thực hiện CAPA (CAPA Planned)</option>
              <option value="EFFECTIVENESS_REVIEW">4. Đánh giá hiệu quả CAPA (Effectiveness Review)</option>
              <option value="CLOSED">5. Đóng hồ sơ (Closed - Yêu cầu quyền QA/Admin)</option>
            </select>
          </div>

          {targetStatus === 'CLOSED' && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
              <p className="font-semibold flex items-center gap-1 mb-1">
                <AlertTriangle size={14} />
                <span>Yêu cầu tiêu chuẩn GMP-WHO:</span>
              </p>
              Chỉ Trưởng phòng QA hoặc Quản trị viên mới được phép Đóng hồ sơ sai lệch. Bắt buộc phải nhập kết luận thẩm định hiệu quả của các hành động CAPA bên dưới.
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">
              Ghi chú chuyển bước {targetStatus === 'CLOSED' && <span className="text-rose-500">*</span>}:
            </label>
            <textarea
              rows={3}
              placeholder={targetStatus === 'CLOSED' ? 'Nhập kết luận đánh giá hiệu quả CAPA và xác nhận đóng hồ sơ...' : 'Ghi chú lý do chuyển trạng thái...'}
              value={transitionNotes}
              onChange={(e) => setTransitionNotes(e.target.value)}
              required={targetStatus === 'CLOSED'}
              className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowTransitionModal(false)}
              className="px-4 py-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              Xác nhận chuyển bước
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Modal: Khởi tạo Hồ sơ Sai lệch Mới ─── */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Khởi tạo Hồ sơ Sai lệch Chất lượng (GMP Deviation)"
        icon={Plus}
        color="bg-rose-600"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">
              Tiêu đề sai lệch <span className="text-rose-500">*</span>:
            </label>
            <input
              type="text"
              placeholder="VD: Nhiệt độ kho bảo quản vượt ngưỡng 32°C trong 4 giờ"
              value={newForm.title}
              onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))}
              required
              className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">
                Nguồn phát sinh:
              </label>
              <select
                value={newForm.source}
                onChange={e => setNewForm(f => ({ ...f, source: e.target.value as any }))}
                className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              >
                <option value="OOS_TEST_RESULT">OOS Kiểm nghiệm</option>
                <option value="INTERNAL_AUDIT">Audit nội bộ</option>
                <option value="MANUFACTURING">Sản xuất</option>
                <option value="RAW_MATERIAL">Nguyên vật liệu</option>
                <option value="STORAGE_ENVIRONMENT">Môi trường / Kho</option>
                <option value="OOT_TREND">Xu hướng OOT</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">
                Mức độ nghiêm trọng:
              </label>
              <select
                value={newForm.severity}
                onChange={e => setNewForm(f => ({ ...f, severity: e.target.value as any }))}
                className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              >
                <option value="MINOR">Nhẹ (Minor)</option>
                <option value="MAJOR">Đáng kể (Major)</option>
                <option value="CRITICAL">Nghiêm trọng (Critical)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">
              Lô sản xuất liên quan (nếu có):
            </label>
            <select
              value={newForm.batchId}
              onChange={e => setNewForm(f => ({ ...f, batchId: e.target.value }))}
              className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
            >
              <option value="">-- Không gắn lô cụ thể --</option>
              {batches.map(b => {
                const prod = products.find(p => p.id === b.productId);
                return (
                  <option key={b.id} value={b.id}>
                    {b.batchNo} - {prod?.name || 'Sản phẩm'}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">
              Mô tả chi tiết sự cố:
            </label>
            <textarea
              rows={2}
              placeholder="Mô tả diễn biến, thời điểm phát hiện, thiết bị liên quan..."
              value={newForm.description}
              onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
              className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">
              Hành động xử lý tức thời (Biệt trữ, dừng máy...):
            </label>
            <input
              type="text"
              placeholder="VD: Dán nhãn Biệt trữ (Quarantine) khu vực bị ảnh hưởng"
              value={newForm.immediateAction}
              onChange={e => setNewForm(f => ({ ...f, immediateAction: e.target.value }))}
              className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              Tạo hồ sơ sai lệch
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DeviationListPage;
