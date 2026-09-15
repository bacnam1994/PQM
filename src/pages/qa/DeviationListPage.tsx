/**
 * PQM 3.0 - Quality Deviation & CAPA Management Page
 * ===================================================
 * Quản lý Hồ sơ Sai lệch Chất lượng & Hành động Khắc phục / Phòng ngừa (CAPA)
 * Tuân thủ tiêu chuẩn GMP-WHO và FDA 21 CFR Part 211.
 * Tích hợp AI Gateway (Phân tích Nguyên nhân gốc rễ 5-Why & Ishikawa) và Kiểm soát State Machine.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldExclamationIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowRightIcon,
  SparklesIcon,
  XMarkIcon,
  DocumentTextIcon,
  EyeIcon,
  ArrowPathIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import {
  QualityDeviation,
  DeviationStatus,
  DeviationSeverity,
  DeviationSource,
} from '../../types/deviation';
import { useDeviationsQuery } from '../../hooks/queries/useDeviationQueries';
import { useQueryClient } from '@tanstack/react-query';
import { DEVIATION_QUERY_KEYS } from '../../constants/queryKeys';
import { deviationAppService } from '../../services/app/DeviationAppService';
import { aiGateway } from '../../services/ai/AIGateway';
import { formatDateStandard } from '../../utils';
import { Modal } from '../../components/ui/CommonUI';
import { DeviationMetricsBar } from '../quality/deviations/DeviationMetricsBar';
import { CAPATrackerView } from '../quality/deviations/CAPATrackerView';
import { DeviationWorkflowModal } from '../quality/deviations/DeviationWorkflowModal';

// Trạng thái workflow hiển thị
const STATUS_CONFIG: Record<
  DeviationStatus,
  { label: string; bg: string; text: string; border: string; step: number }
> = {
  LOGGED: {
    label: 'Mới ghi nhận',
    bg: 'bg-surface-2',
    text: 'text-ink-soft',
    border: 'border-border',
    step: 1,
  },
  UNDER_INVESTIGATION: {
    label: 'Đang điều tra',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    step: 2,
  },
  CAPA_PLANNED: {
    label: 'Đang thực hiện CAPA',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800',
    step: 3,
  },
  EFFECTIVENESS_REVIEW: {
    label: 'Đánh giá hiệu quả',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    step: 4,
  },
  CLOSED: {
    label: 'Đã đóng hồ sơ',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    step: 5,
  },
};

const SEVERITY_CONFIG: Record<DeviationSeverity, { label: string; badge: string; dot: string }> = {
  CRITICAL: {
    label: 'Nghiêm trọng (Critical)',
    badge:
      'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
  MAJOR: {
    label: 'Đáng kể (Major)',
    badge:
      'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  MINOR: {
    label: 'Nhẹ (Minor)',
    badge: 'bg-surface-2 text-ink-muted border-border',
    dot: 'bg-surface-3',
  },
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
  const { user, role, isAdmin, batches, products } = useAppStore(
    useShallow((s) => ({
      user: s.user,
      role: s.role,
      isAdmin: s.isAdmin,
      batches: s.batches,
      products: s.products,
    }))
  );

  const queryClient = useQueryClient();
  const { data: deviations = [], isLoading: loading, refetch } = useDeviationsQuery();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [selectedDeviation, setSelectedDeviation] = useState<QualityDeviation | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<'DEVIATIONS' | 'CAPA_TRACKER'>('DEVIATIONS');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState<DeviationStatus>('UNDER_INVESTIGATION');

  const handleWorkflowConfirm = async (
    status: DeviationStatus,
    notes: string,
    investigator?: string
  ) => {
    if (!selectedDeviation) return;
    try {
      await deviationAppService.updateStatus(
        selectedDeviation.id,
        status,
        { ...user, role, isAdmin: isAdmin || role === 'ADMIN' },
        { notes, investigator }
      );
      toast.success(
        `Hồ sơ ${selectedDeviation.deviationNo} đã chuyển sang "${STATUS_CONFIG[status].label}"`
      );
      setShowTransitionModal(false);
      await loadDeviations();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi chuyển đổi trạng thái.');
      throw err;
    }
  };

  const handleCompleteCAPAItem = async (deviationId: string, capaId: string) => {
    try {
      await deviationAppService.completeCAPAItem(deviationId, capaId, user);
      toast.success('Đã cập nhật hoàn tất hành động CAPA!');
      await loadDeviations();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật CAPA');
    }
  };

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
    immediateAction: '',
  });

  // CAPA Action Item Form state inside drawer
  const [showAddCapa, setShowAddCapa] = useState(false);
  const [capaForm, setCapaForm] = useState({
    action: '',
    type: 'CORRECTIVE' as 'CORRECTIVE' | 'PREVENTIVE' | 'IMMEDIATE',
    responsible: '',
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  });

  // Tải lại danh sách sai lệch qua TanStack Query Cache
  const loadDeviations = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: DEVIATION_QUERY_KEYS.all });
    await refetch();
  }, [queryClient, refetch]);

  useEffect(() => {
    if (selectedDeviation) {
      const fresh = deviations.find((d) => d.id === selectedDeviation.id);
      if (fresh) setSelectedDeviation(fresh);
    }
  }, [deviations, selectedDeviation]);

  // Lọc theo bộ lọc
  const filteredDeviations = useMemo(() => {
    return deviations.filter((d) => {
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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.title.trim()) {
      toast.error('Vui lòng nhập tiêu đề sai lệch.');
      return;
    }

    try {
      const batch = batches.find((b) => b.id === newForm.batchId);
      const product = batch ? products.find((p) => p.id === batch.productId) : undefined;

      await deviationAppService.createDeviation(
        {
          title: newForm.title.trim(),
          source: newForm.source,
          severity: newForm.severity,
          batchId: newForm.batchId || undefined,
          batchNo: batch?.batchNo,
          productId: batch?.productId,
          productName: product?.name,
          description: newForm.description.trim() || undefined,
          immediateAction: newForm.immediateAction.trim() || undefined,
        },
        user
      );

      toast.success('Khởi tạo hồ sơ sai lệch thành công!');
      setShowCreateModal(false);
      setNewForm({
        title: '',
        source: 'OOS_TEST_RESULT',
        severity: 'MAJOR',
        batchId: '',
        description: '',
        immediateAction: '',
      });
      await loadDeviations();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi tạo hồ sơ sai lệch.');
    }
  };

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
          status: 'PENDING',
        },
        user
      );

      toast.success('Đã thêm hành động CAPA vào hồ sơ!');
      setCapaForm({
        action: '',
        type: 'CORRECTIVE',
        responsible: '',
        deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      });
      setShowAddCapa(false);
      await loadDeviations();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi thêm CAPA.');
    }
  };

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
        immediateAction: selectedDeviation.immediateAction,
      };

      const response = await aiGateway.execute({
        promptId: 'DEVIATION_REPORT',
        input: promptInput,
        options: {
          userId: user?.uid,
          userEmail: user?.email,
          documentType: 'DEVIATION',
          documentId: selectedDeviation.id,
        },
      });

      if (response.success && response.data) {
        setAiAnalysis({
          content: response.data,
          metadata: response.metadata,
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
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-500/20 flex items-center justify-center shrink-0">
              <ShieldExclamationIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
                Quản lý Sai lệch & CAPA
              </h1>
              <p className="text-xs sm:text-sm text-ink-muted">
                Theo dõi sự cố OOS, điều tra nguyên nhân gốc rễ và kiểm soát hành động khắc
                phục/phòng ngừa (GMP-WHO / 21 CFR Part 211)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDeviations}
            disabled={loading}
            className="p-2 rounded-lg border border-border text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
            title="Tải lại dữ liệu"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-medium text-xs shadow-2xs transition-all"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Khởi tạo sai lệch</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <DeviationMetricsBar
        deviations={deviations}
        activeFilter={statusFilter}
        onSelectFilter={(filter) => {
          setStatusFilter(filter);
          setActiveViewTab('DEVIATIONS');
        }}
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveViewTab('DEVIATIONS')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            activeViewTab === 'DEVIATIONS'
              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-surface-2'
          }`}
        >
          Hồ sơ sai lệch ({deviations.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveViewTab('CAPA_TRACKER')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            activeViewTab === 'CAPA_TRACKER'
              ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-surface-2'
          }`}
        >
          Theo dõi hành động CAPA (CAPA Tracker)
        </button>
      </div>

      {activeViewTab === 'CAPA_TRACKER' ? (
        <CAPATrackerView
          deviations={deviations}
          onCompleteItem={handleCompleteCAPAItem}
          onSelectDeviation={(dev) => {
            setSelectedDeviation(dev);
            setActiveViewTab('DEVIATIONS');
          }}
        />
      ) : (
        <>
          {/* Search & Filter Bar */}
          <div className="bg-surface p-3 rounded-xl border border-border shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder="Tìm theo mã hồ sơ (DEV-...), lô sản xuất, tên sản phẩm hoặc tiêu đề..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-surface-2 border border-border rounded-xl text-xs text-ink outline-none focus:ring-2 focus:ring-rose-500/20 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-1.5 bg-surface-2 border border-border rounded-xl px-2.5 py-1">
                <FunnelIcon className="w-3.5 h-3.5 text-ink-muted" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-medium outline-none cursor-pointer text-ink"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="LOGGED">Mới ghi nhận</option>
                  <option value="UNDER_INVESTIGATION">Đang điều tra</option>
                  <option value="CAPA_PLANNED">Đang thực hiện CAPA</option>
                  <option value="EFFECTIVENESS_REVIEW">Đánh giá hiệu quả</option>
                  <option value="CLOSED">Đã đóng hồ sơ</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-surface-2 border border-border rounded-xl px-2.5 py-1">
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="bg-transparent text-xs font-medium outline-none cursor-pointer text-ink"
                >
                  <option value="ALL">Tất cả mức độ</option>
                  <option value="CRITICAL">Nghiêm trọng (Critical)</option>
                  <option value="MAJOR">Đáng kể (Major)</option>
                  <option value="MINOR">Nhẹ (Minor)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Deviations Data Table */}
          <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-ink-muted">
                <ArrowPathIcon className="animate-spin mb-2.5 text-rose-500 w-8 h-8" />
                <p className="text-xs">Đang tải danh sách hồ sơ sai lệch...</p>
              </div>
            ) : filteredDeviations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center text-ink-muted mb-2.5">
                  <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-sm font-semibold text-ink">Không có hồ sơ sai lệch nào</h3>
                <p className="text-xs text-ink-muted mt-1 max-w-sm">
                  Không tìm thấy hồ sơ sai lệch nào phù hợp với bộ lọc hiện tại. Tất cả các lô và
                  chỉ tiêu đang trong ngưỡng an toàn.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/60 text-ink-muted font-semibold text-xs">
                      <th className="py-3 px-4">Mã hồ sơ</th>
                      <th className="py-3 px-4">Tiêu đề & Nguồn</th>
                      <th className="py-3 px-4">Lô / Sản phẩm</th>
                      <th className="py-3 px-4">Mức độ</th>
                      <th className="py-3 px-4">Trạng thái Workflow</th>
                      <th className="py-3 px-4">Tiến độ CAPA</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredDeviations.map((dev) => {
                      const statusInfo = STATUS_CONFIG[dev.status] || STATUS_CONFIG.LOGGED;
                      const severityInfo = SEVERITY_CONFIG[dev.severity] || SEVERITY_CONFIG.MINOR;
                      const capaTotal = dev.capaItems?.length || 0;
                      const capaDone =
                        dev.capaItems?.filter((c) => c.status === 'COMPLETED').length || 0;

                      return (
                        <tr
                          key={dev.id}
                          className="hover:bg-surface-2 transition-colors cursor-pointer group"
                          onClick={() => {
                            setSelectedDeviation(dev);
                            setAiAnalysis(null);
                          }}
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-semibold text-ink flex items-center gap-1.5">
                              <span>{dev.deviationNo}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-ink-muted font-mono border border-border">
                                v{dev.version}
                              </span>
                            </div>
                            <div className="text-[11px] text-ink-muted mt-0.5">
                              {formatDateStandard(dev.loggedAt)}
                            </div>
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-medium text-ink truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                              {dev.title}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-2 text-ink-soft border border-border">
                                {SOURCE_LABELS[dev.source] || dev.source}
                              </span>
                              {dev.failedCriteria && dev.failedCriteria.length > 0 && (
                                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                                  ({dev.failedCriteria.length} chỉ tiêu OOS)
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            {dev.batchNo ? (
                              <>
                                <div className="font-medium text-ink">
                                  Lô: <span className="font-semibold">{dev.batchNo}</span>
                                </div>
                                <div className="text-xs text-ink-muted truncate max-w-[180px]">
                                  {dev.productName || 'Chế phẩm liên kết'}
                                </div>
                              </>
                            ) : (
                              <span className="text-xs text-ink-muted italic">
                                Không gắn lô cụ thể
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${severityInfo.badge}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${severityInfo.dot}`} />
                              {severityInfo.label.split(' ')[0]}
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            {capaTotal > 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${capaDone === capaTotal ? 'bg-emerald-500' : 'bg-sky-500'} rounded-full`}
                                    style={{
                                      width: `${Math.round((capaDone / capaTotal) * 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-ink-muted font-mono">
                                  {capaDone}/{capaTotal}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-ink-muted">Chưa tạo CAPA</span>
                            )}
                          </td>

                          <td
                            className="py-3 px-4 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setSelectedDeviation(dev);
                                  setAiAnalysis(null);
                                }}
                                className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
                                title="Xem chi tiết & CAPA"
                              >
                                <EyeIcon className="w-4 h-4" />
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
                                      CLOSED: 'CLOSED',
                                    };
                                    setTargetStatus(nextMap[dev.status]);
                                    setShowTransitionModal(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 text-xs font-medium text-ink-soft transition-colors border border-border"
                                >
                                  <span>Chuyển bước</span>
                                  <ArrowRightIcon className="w-3 h-3" />
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
        </>
      )}

      {/* Drawer */}
      {selectedDeviation && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-3xl bg-surface h-full shadow-xl flex flex-col border-l border-border overflow-y-auto">
            <div className="p-4 border-b border-border flex items-start justify-between sticky top-0 bg-surface/95 backdrop-blur-xs z-10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-ink font-mono">
                    {selectedDeviation.deviationNo}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border ${SEVERITY_CONFIG[selectedDeviation.severity].badge}`}
                  >
                    {SEVERITY_CONFIG[selectedDeviation.severity].label}
                  </span>
                </div>
                <h2 className="text-sm font-medium text-ink mt-0.5">{selectedDeviation.title}</h2>
              </div>
              <button
                onClick={() => setSelectedDeviation(null)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Pipeline */}
            <div className="p-3 bg-surface-2 border-b border-border">
              <div className="flex items-center justify-between">
                {(
                  [
                    'LOGGED',
                    'UNDER_INVESTIGATION',
                    'CAPA_PLANNED',
                    'EFFECTIVENESS_REVIEW',
                    'CLOSED',
                  ] as DeviationStatus[]
                ).map((st) => {
                  const cfg = STATUS_CONFIG[st];
                  const currentStep = STATUS_CONFIG[selectedDeviation.status].step;
                  const isPassed = currentStep > cfg.step;
                  const isCurrent = currentStep === cfg.step;

                  return (
                    <div key={st} className="flex-1 flex flex-col items-center relative">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                          isPassed
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                              ? 'bg-rose-600 text-white ring-2 ring-rose-200 dark:ring-rose-950'
                              : 'bg-surface-3 text-ink-muted'
                        }`}
                      >
                        {isPassed ? <CheckIcon className="w-3.5 h-3.5" /> : cfg.step}
                      </div>
                      <span
                        className={`text-[10px] font-medium mt-1 text-center hidden sm:block ${
                          isCurrent
                            ? 'text-rose-600 dark:text-rose-400 font-semibold'
                            : 'text-ink-muted'
                        }`}
                      >
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-5 space-y-5 flex-1 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-surface-2 border border-border">
                <div>
                  <span className="text-ink-muted block">Nguồn phát sinh:</span>
                  <span className="font-semibold text-ink mt-0.5 block">
                    {SOURCE_LABELS[selectedDeviation.source]}
                  </span>
                </div>
                <div>
                  <span className="text-ink-muted block">Lô sản xuất:</span>
                  <span className="font-semibold text-ink mt-0.5 block">
                    {selectedDeviation.batchNo || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-ink-muted block">Người ghi nhận:</span>
                  <span className="font-semibold text-ink mt-0.5 block truncate">
                    {selectedDeviation.loggedBy}
                  </span>
                </div>
                <div>
                  <span className="text-ink-muted block">Thời gian:</span>
                  <span className="font-semibold text-ink mt-0.5 block">
                    {formatDateStandard(selectedDeviation.loggedAt)}
                  </span>
                </div>
              </div>

              {selectedDeviation.failedCriteria && selectedDeviation.failedCriteria.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                    <span>Các chỉ tiêu không đạt tiêu chuẩn (OOS Findings)</span>
                  </h3>
                  <div className="border border-rose-200 dark:border-rose-900/50 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-medium">
                        <tr>
                          <th className="p-2">Tên chỉ tiêu</th>
                          <th className="p-2">Kết quả thực tế</th>
                          <th className="p-2">Giới hạn TCCS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100 dark:divide-rose-950/40">
                        {selectedDeviation.failedCriteria.map((c, i) => (
                          <tr key={i} className="bg-surface">
                            <td className="p-2 font-medium text-ink">{c.name}</td>
                            <td className="p-2 font-semibold text-rose-600 dark:text-rose-400">
                              {c.actualValue}
                            </td>
                            <td className="p-2 text-ink-muted">{c.specification}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                <div>
                  <span className="text-xs font-medium text-ink-muted uppercase">
                    Mô tả hiện tượng sai lệch:
                  </span>
                  <p className="mt-1 p-2.5 rounded-lg bg-surface-2 text-ink border border-border">
                    {selectedDeviation.description || 'Không có mô tả bổ sung.'}
                  </p>
                </div>
                {selectedDeviation.immediateAction && (
                  <div>
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1">
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      <span>Hành động xử lý tức thời (Biệt trữ / Ngăn chặn):</span>
                    </span>
                    <p className="mt-1 p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900/50">
                      {selectedDeviation.immediateAction}
                    </p>
                  </div>
                )}
              </div>

              {/* AI Assistant */}
              <div className="p-3.5 rounded-xl bg-surface-2 border border-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-ink font-semibold text-xs">
                    <SparklesIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>AI Phân tích Nguyên nhân Gốc rễ (5-Why & Ishikawa)</span>
                  </div>
                  <button
                    onClick={handleRunAIAnalysis}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors shadow-xs disabled:opacity-50"
                  >
                    {aiLoading ? (
                      <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <SparklesIcon className="w-3.5 h-3.5" />
                    )}
                    <span>{aiAnalysis ? 'Phân tích lại' : 'Chạy AI phân tích'}</span>
                  </button>
                </div>

                {aiLoading && (
                  <div className="py-4 text-center text-ink-muted text-xs">
                    <ArrowPathIcon className="w-5 h-5 animate-spin mx-auto mb-1 text-emerald-600" />
                    <p>Đang gửi dữ liệu đến AI Gateway...</p>
                  </div>
                )}

                {aiAnalysis && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between text-[11px] text-ink-muted">
                      <span>
                        Mô hình: <b className="text-ink">{aiAnalysis.metadata?.modelUsed}</b>
                      </span>
                      <span>
                        Độ tin cậy:{' '}
                        <b className="text-emerald-600 font-semibold">
                          {aiAnalysis.metadata?.confidenceLevel} (
                          {Math.round(aiAnalysis.metadata?.confidenceScore * 100)}%)
                        </b>
                      </span>
                    </div>

                    <div className="p-2.5 bg-surface rounded-lg border border-border text-ink whitespace-pre-line leading-relaxed">
                      {typeof aiAnalysis.content === 'string'
                        ? aiAnalysis.content
                        : JSON.stringify(aiAnalysis.content, null, 2)}
                    </div>
                  </div>
                )}
              </div>

              {/* CAPA Items */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-ink flex items-center gap-1.5 uppercase">
                    <ClockIcon className="w-4 h-4 text-sky-500" />
                    <span>Hành động Khắc phục & Phòng ngừa (CAPA Items)</span>
                  </h3>
                  {selectedDeviation.status !== 'CLOSED' && (
                    <button
                      onClick={() => setShowAddCapa(true)}
                      className="inline-flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                      <span>Thêm hành động</span>
                    </button>
                  )}
                </div>

                {showAddCapa && (
                  <form
                    onSubmit={handleAddCAPASubmit}
                    className="p-3 rounded-lg bg-surface-2 border border-border space-y-2"
                  >
                    <div className="flex gap-2">
                      <select
                        value={capaForm.type}
                        onChange={(e) =>
                          setCapaForm((f) => ({ ...f, type: e.target.value as any }))
                        }
                        className="px-2 py-1 rounded bg-surface border border-border text-ink outline-none"
                      >
                        <option value="CORRECTIVE">Khắc phục (Corrective)</option>
                        <option value="PREVENTIVE">Phòng ngừa (Preventive)</option>
                        <option value="IMMEDIATE">Tức thời (Immediate)</option>
                      </select>

                      <input
                        type="date"
                        value={capaForm.deadline}
                        onChange={(e) => setCapaForm((f) => ({ ...f, deadline: e.target.value }))}
                        className="px-2 py-1 rounded bg-surface border border-border text-ink outline-none"
                      />
                    </div>

                    <textarea
                      placeholder="Mô tả cụ thể hành động cần thực hiện..."
                      value={capaForm.action}
                      onChange={(e) => setCapaForm((f) => ({ ...f, action: e.target.value }))}
                      rows={2}
                      className="w-full p-2 rounded bg-surface border border-border text-ink outline-none"
                    />

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddCapa(false)}
                        className="px-2.5 py-1 rounded text-ink-muted hover:bg-surface-3"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-700 text-white font-medium"
                      >
                        Lưu hành động
                      </button>
                    </div>
                  </form>
                )}

                {!selectedDeviation.capaItems || selectedDeviation.capaItems.length === 0 ? (
                  <p className="text-xs text-ink-muted italic p-3 bg-surface-2 rounded-lg text-center border border-border">
                    Chưa có hành động CAPA nào được gán cho hồ sơ này.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedDeviation.capaItems.map((capa) => {
                      const isDone = capa.status === 'COMPLETED';
                      return (
                        <div
                          key={capa.id}
                          className={`p-2.5 rounded-lg border flex items-start justify-between gap-3 text-xs ${
                            isDone
                              ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                              : 'bg-surface border-border'
                          }`}
                        >
                          <div className="space-y-0.5 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  capa.type === 'CORRECTIVE'
                                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                    : 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                                }`}
                              >
                                {capa.type === 'CORRECTIVE' ? 'KHẮC PHỤC' : 'PHÒNG NGỪA'}
                              </span>
                              <span className="text-ink-muted">Hạn: {capa.deadline}</span>
                              <span className="text-ink-muted">· {capa.responsible}</span>
                            </div>
                            <p
                              className={`font-medium ${isDone ? 'line-through text-ink-muted' : 'text-ink'}`}
                            >
                              {capa.action}
                            </p>
                            {isDone && (
                              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <CheckIcon className="w-3 h-3" />
                                <span>
                                  Đã hoàn thành lúc {formatDateStandard(capa.completedAt)}
                                </span>
                              </p>
                            )}
                          </div>

                          {!isDone && selectedDeviation.status !== 'CLOSED' && (
                            <button
                              onClick={() => handleToggleCAPA(capa.id)}
                              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shrink-0"
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

              {selectedDeviation.status === 'CLOSED' && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold uppercase">
                    <CheckCircleIcon className="w-4 h-4" />
                    <span>Hồ sơ đã thẩm định và chính thức Đóng (GMP Closed)</span>
                  </div>
                  <p className="text-ink-soft italic">
                    "
                    {selectedDeviation.closureNotes ||
                      'Đã kiểm tra tính hiệu quả của CAPA và phê duyệt đóng hồ sơ.'}
                    "
                  </p>
                  <div className="text-[11px] text-ink-muted pt-0.5">
                    Đóng bởi: <b>{selectedDeviation.closedBy || 'QA Officer'}</b> vào lúc{' '}
                    {formatDateStandard(selectedDeviation.closedAt)}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3.5 border-t border-border bg-surface-2 flex items-center justify-between sticky bottom-0">
              <span className="text-xs text-ink-muted">
                Phiên bản hồ sơ: v{selectedDeviation.version}
              </span>

              {selectedDeviation.status !== 'CLOSED' && (
                <button
                  onClick={() => {
                    const nextMap: Record<DeviationStatus, DeviationStatus> = {
                      LOGGED: 'UNDER_INVESTIGATION',
                      UNDER_INVESTIGATION: 'CAPA_PLANNED',
                      CAPA_PLANNED: 'EFFECTIVENESS_REVIEW',
                      EFFECTIVENESS_REVIEW: 'CLOSED',
                      CLOSED: 'CLOSED',
                    };
                    setTargetStatus(nextMap[selectedDeviation.status]);
                    setShowTransitionModal(true);
                  }}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium shadow-xs transition-all"
                >
                  <span>Chuyển trạng thái quy trình</span>
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <DeviationWorkflowModal
        isOpen={showTransitionModal}
        onClose={() => setShowTransitionModal(false)}
        deviation={selectedDeviation}
        targetStatus={targetStatus}
        onConfirm={handleWorkflowConfirm}
        currentUserRole={role}
        isAdmin={isAdmin || role === 'ADMIN'}
      />

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Khởi tạo Hồ sơ Sai lệch Chất lượng (GMP Deviation)"
        icon={PlusIcon}
        color="bg-rose-600"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              Tiêu đề sai lệch <span className="text-rose-500">*</span>:
            </label>
            <input
              type="text"
              placeholder="VD: Nhiệt độ kho bảo quản vượt ngưỡng 32°C trong 4 giờ"
              value={newForm.title}
              onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))}
              required
              className="w-full p-2 bg-surface-2 border border-border rounded-lg text-ink outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                Nguồn phát sinh:
              </label>
              <select
                value={newForm.source}
                onChange={(e) => setNewForm((f) => ({ ...f, source: e.target.value as any }))}
                className="w-full p-2 bg-surface-2 border border-border rounded-lg text-ink"
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
              <label className="block text-xs font-medium text-ink-muted mb-1">
                Mức độ nghiêm trọng:
              </label>
              <select
                value={newForm.severity}
                onChange={(e) => setNewForm((f) => ({ ...f, severity: e.target.value as any }))}
                className="w-full p-2 bg-surface-2 border border-border rounded-lg text-ink"
              >
                <option value="MINOR">Nhẹ (Minor)</option>
                <option value="MAJOR">Đáng kể (Major)</option>
                <option value="CRITICAL">Nghiêm trọng (Critical)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              Lô sản xuất liên quan (nếu có):
            </label>
            <select
              value={newForm.batchId}
              onChange={(e) => setNewForm((f) => ({ ...f, batchId: e.target.value }))}
              className="w-full p-2 bg-surface-2 border border-border rounded-lg text-ink"
            >
              <option value="">-- Không gắn lô cụ thể --</option>
              {batches.map((b) => {
                const prod = products.find((p) => p.id === b.productId);
                return (
                  <option key={b.id} value={b.id}>
                    {b.batchNo} - {prod?.name || 'Sản phẩm'}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              Mô tả chi tiết sự cố:
            </label>
            <textarea
              rows={2}
              placeholder="Mô tả diễn biến, thời điểm phát hiện, thiết bị liên quan..."
              value={newForm.description}
              onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full p-2 bg-surface-2 border border-border rounded-lg text-ink outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              Hành động xử lý tức thời (Biệt trữ, dừng máy...):
            </label>
            <input
              type="text"
              placeholder="VD: Dán nhãn Biệt trữ (Quarantine) khu vực bị ảnh hưởng"
              value={newForm.immediateAction}
              onChange={(e) => setNewForm((f) => ({ ...f, immediateAction: e.target.value }))}
              className="w-full p-2 bg-surface-2 border border-border rounded-lg text-ink outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-3.5 py-1.5 rounded-lg text-ink-soft hover:bg-surface-2 border border-border"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-xs"
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
