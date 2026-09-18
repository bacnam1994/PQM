import React, { useMemo, useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  CubeIcon,
  Square3Stack3DIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  ArrowTrendingUpIcon,
  ArrowRightIcon,
  ClockIcon,
  ShieldExclamationIcon,
  SparklesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import { Link, useNavigate } from 'react-router-dom';
import { Surface } from '../../components/ui';
import { BATCH_STATUS, PRODUCT_STATUS, TEST_RESULT_STATUS } from '../../utils';
import { useShallow } from 'zustand/react/shallow';
import { useQualityAlerts } from '../../hooks/useQualityAlerts';
import { QAQCActionQueue } from '../../components/features/QAQCActionQueue';

// Gauge Chart Component — SVG Inline Needle Gauge
const GaugeChart: React.FC<{ passRate: number | null }> = ({ passRate }) => {
  // -90° = 0%, +90° = 100%
  const needleRotation = -90 + ((passRate ?? 0) / 100) * 180;

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      {/* SVG Gauge Arc */}
      <div className="relative w-40 h-20 overflow-hidden">
        <svg className="w-40 h-40 transform -rotate-180" viewBox="0 0 100 100">
          {/* Vùng đỏ: 0-50% */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#ef4444"
            strokeWidth="7"
            strokeDasharray="62.8 126"
            strokeDashoffset="-62.8"
          />
          {/* Vùng vàng: 50-75% */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="7"
            strokeDasharray="31.4 126"
            strokeDashoffset="-94.2"
          />
          {/* Vùng xanh: 75-100% */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#10b981"
            strokeWidth="7"
            strokeDasharray="31.4 126"
            strokeDashoffset="-125.6"
          />
        </svg>
        {/* Kim đo xoay động theo passRate */}
        <div
          className="absolute bottom-0 left-1/2 w-0.5 h-12 bg-ink origin-bottom rounded-full shadow transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-50%) rotate(${needleRotation}deg)` }}
        />
        {/* Trụ kim trung tâm */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-surface shadow border-2 border-ink" />
      </div>
      {/* Nhãn giá trị */}
      <div className="text-center -mt-0.5">
        <span className="text-2xl font-bold tracking-tight tabular-nums text-ink">
          {passRate !== null ? `${passRate}%` : 'N/A'}
        </span>
        <span className="text-xs text-ink-muted font-medium block">Tỷ lệ đạt chuẩn</span>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | 'testing' | 'rejected'>('all');

  const {
    products,
    batches,
    tccsList,
    testResultsRealtime,
    allTestResults,
    fetchAllTestResultsForDashboard,
    user,
  } = useAppStore(
    useShallow((state) => ({
      products: state.products,
      batches: state.batches,
      tccsList: state.tccsList,
      testResultsRealtime: state.testResults || [],
      allTestResults: state.allTestResults || [],
      fetchAllTestResultsForDashboard: state.fetchAllTestResultsForDashboard,
      user: state.user,
    }))
  );

  // Quality alerts from custom hook
  const { alerts } = useQualityAlerts(30);

  // Fetch all test results once on dashboard mount
  useEffect(() => {
    fetchAllTestResultsForDashboard();
  }, [fetchAllTestResultsForDashboard]);

  // Merge background fetch results + realtime results
  const testResults = useMemo(() => {
    const map = new Map(allTestResults.map((r) => [r.id, r]));
    testResultsRealtime.forEach((r) => map.set(r.id, r));
    return Array.from(map.values());
  }, [allTestResults, testResultsRealtime]);

  // Aggregate global statistics
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const activeProducts = products.filter((p) => p.status === PRODUCT_STATUS.ACTIVE).length;

    let pendingBatches = 0,
      testingBatches = 0,
      releasedBatches = 0,
      rejectedBatches = 0;
    batches.forEach((b) => {
      if (b.status === BATCH_STATUS.PENDING) pendingBatches++;
      else if (b.status === BATCH_STATUS.TESTING) testingBatches++;
      else if (b.status === BATCH_STATUS.RELEASED) releasedBatches++;
      else if (b.status === BATCH_STATUS.REJECTED) rejectedBatches++;
    });
    const totalBatches = batches.length;

    let passResults = 0;
    testResults.forEach((r) => {
      if (r.overallStatus === TEST_RESULT_STATUS.PASS) passResults++;
    });
    const totalResults = testResults.length;
    const totalTCCS = tccsList.length;

    return {
      totalProducts,
      activeProducts,
      totalBatches,
      pendingBatches,
      testingBatches,
      releasedBatches,
      rejectedBatches,
      totalResults,
      passResults,
      totalTCCS,
    };
  }, [products, batches, tccsList, testResults]);

  // Calculate percentages
  const passRate =
    stats.totalResults > 0 ? Math.round((stats.passResults / stats.totalResults) * 100) : null;

  // Pipeline stage allocation based on actual database statuses and progress
  const pipelineStages = useMemo(() => {
    let pending = 0; // Nguyên liệu (PENDING)
    let production = 0; // Sản xuất (TESTING & progress === 0)
    let testing = 0; // Kiểm nghiệm (TESTING & 0 < progress < 100)
    let review = 0; // Phê duyệt (TESTING & progress === 100)
    let exported = 0; // Xuất kho (RELEASED)

    batches.forEach((b) => {
      if (b.status === BATCH_STATUS.PENDING) {
        pending++;
      } else if (b.status === BATCH_STATUS.TESTING) {
        const progress = b.progressPercent ?? 0;
        if (progress === 0) {
          production++;
        } else if (progress < 100) {
          testing++;
        } else {
          review++;
        }
      } else if (b.status === BATCH_STATUS.RELEASED) {
        exported++;
      }
    });

    return { pending, production, testing, review, exported };
  }, [batches]);

  // Filtered recent lot records
  const filteredBatches = useMemo(() => {
    let list = [...batches].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (activeTab === 'testing') {
      list = list.filter((b) => b.status === BATCH_STATUS.TESTING);
    } else if (activeTab === 'rejected') {
      list = list.filter((b) => b.status === BATCH_STATUS.REJECTED);
    }
    return list.slice(0, 5);
  }, [batches, activeTab]);

  // Generate greeting according to current hour
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  }, []);

  const userName = user?.displayName || user?.email?.split('@')[0] || 'Quản lý';

  // Trigger global assistant prompt injection
  const triggerAIChat = (prompt: string) => {
    window.dispatchEvent(new CustomEvent('trigger-ai-chat', { detail: { prompt } }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ================= HERO BANNER ================= */}
      <div className="p-5 sm:p-6 rounded-xl bg-surface border border-border shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 relative">
        <div className="space-y-3.5 max-w-xl z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <SparklesIcon className="w-3.5 h-3.5" />
            Tổng quan chất lượng · Hôm nay
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {greeting}, {userName}
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-1 leading-relaxed">
              <strong className="text-ink font-semibold">{stats.totalBatches}</strong> lô đang được
              theo dõi trong hệ thống.{' '}
              <strong className="text-amber-600 dark:text-amber-400 font-semibold">
                {alerts.length}
              </strong>{' '}
              chỉ tiêu chất lượng cần chú ý thẩm định.
            </p>
          </div>

          <div className="flex items-center gap-5 pt-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-sm font-semibold text-ink tabular-nums">
                {stats.releasedBatches}
              </span>
              <span className="text-xs text-ink-muted">Đã duyệt</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-sm font-semibold text-ink tabular-nums">
                {stats.testingBatches}
              </span>
              <span className="text-xs text-ink-muted">Chờ kiểm</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span className="text-sm font-semibold text-ink tabular-nums">{alerts.length}</span>
              <span className="text-xs text-ink-muted">Cảnh báo</span>
            </div>
          </div>

          <div>
            <Link
              to="/reports/quality-summary"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-lg text-xs font-medium shadow-2xs transition-all"
            >
              <DocumentTextIcon className="w-4 h-4" />
              Xem báo cáo tổng hợp chất lượng
            </Link>
          </div>
        </div>

        <div className="p-4 bg-surface-2/60 border border-border rounded-xl shrink-0">
          <GaugeChart passRate={passRate} />
        </div>
      </div>

      {/* ================= QA/QC ACTION WORKBENCH QUEUE ================= */}
      <QAQCActionQueue />

      {/* ================= KPI STATS CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-surface p-4 sm:p-5 rounded-xl border border-border shadow-xs hover:border-emerald-500/30 transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Square3Stack3DIcon className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <SparklesIcon className="w-3 h-3" /> Live
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-ink tracking-tight tabular-nums">
              {stats.totalBatches}
            </div>
            <div className="text-xs font-medium text-ink-muted mt-0.5">Lô theo dõi trong tháng</div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-surface p-4 sm:p-5 rounded-xl border border-border shadow-xs hover:border-emerald-500/30 transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ClipboardDocumentCheckIcon className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <ArrowTrendingUpIcon className="w-3 h-3" />{' '}
              {passRate !== null ? (passRate >= 90 ? 'Đạt chuẩn' : 'Khá') : 'Chưa có'}
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-ink tracking-tight tabular-nums">
              {passRate !== null ? `${passRate}%` : 'N/A'}
            </div>
            <div className="text-xs font-medium text-ink-muted mt-0.5">
              Tỷ lệ đạt chỉ tiêu kiểm nghiệm
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-surface p-4 sm:p-5 rounded-xl border border-border shadow-xs hover:border-amber-500/30 transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ClockIcon className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
              Quy trình
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-ink tracking-tight tabular-nums">
              {stats.testingBatches}
            </div>
            <div className="text-xs font-medium text-ink-muted mt-0.5">
              Lô đang kiểm nghiệm tại Lab
            </div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-surface p-4 sm:p-5 rounded-xl border border-border shadow-xs hover:border-rose-500/30 transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ShieldExclamationIcon className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400">
              Cần xử lý
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-ink tracking-tight tabular-nums">
              {alerts.length}
            </div>
            <div className="text-xs font-medium text-ink-muted mt-0.5">
              Cảnh báo chất lượng phát hiện
            </div>
          </div>
        </div>
      </div>

      {/* ================= SIGNATURE PIPELINE ================= */}
      <div className="p-5 sm:p-6 rounded-xl bg-surface border border-border shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-border">
          <div>
            <h2 className="text-sm sm:text-base font-semibold tracking-tight text-ink">
              Chuỗi xử lý lô — Từ nguyên liệu đến xuất kho
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Số lượng lô thực tế phân bổ tại mỗi công đoạn GMP
            </p>
          </div>
          <Link
            to="/batches"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            <Square3Stack3DIcon className="w-4 h-4" /> Xem chi tiết danh sách lô &rarr;
          </Link>
        </div>

        {/* Pipeline Nodes */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          {/* Stage 1 */}
          <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border text-center flex flex-col items-center hover:bg-surface-2 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
              <CubeIcon className="w-4 h-4" />
            </div>
            <div className="text-lg font-bold text-ink tabular-nums">{pipelineStages.pending}</div>
            <div className="text-xs font-semibold text-ink mt-0.5">Nguyên liệu</div>
            <div className="text-[11px] text-ink-muted">Chờ cấp phép</div>
          </div>

          {/* Stage 2 */}
          <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border text-center flex flex-col items-center hover:bg-surface-2 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
              <ArrowTrendingUpIcon className="w-4 h-4" />
            </div>
            <div className="text-lg font-bold text-ink tabular-nums">
              {pipelineStages.production}
            </div>
            <div className="text-xs font-semibold text-ink mt-0.5">Sản xuất</div>
            <div className="text-[11px] text-ink-muted">Đang pha chế</div>
          </div>

          {/* Stage 3 */}
          <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border text-center flex flex-col items-center hover:bg-surface-2 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
              <ClipboardDocumentCheckIcon className="w-4 h-4" />
            </div>
            <div className="text-lg font-bold text-ink tabular-nums">{pipelineStages.testing}</div>
            <div className="text-xs font-semibold text-ink mt-0.5">Kiểm nghiệm</div>
            <div className="text-[11px] text-ink-muted">Phòng Lab QC</div>
          </div>

          {/* Stage 4 */}
          <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border text-center flex flex-col items-center hover:bg-surface-2 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-2">
              <DocumentTextIcon className="w-4 h-4" />
            </div>
            <div className="text-lg font-bold text-ink tabular-nums">{pipelineStages.review}</div>
            <div className="text-xs font-semibold text-ink mt-0.5">Phê duyệt</div>
            <div className="text-[11px] text-ink-muted">Chờ QA duyệt</div>
          </div>

          {/* Stage 5 */}
          <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border text-center flex flex-col items-center col-span-2 sm:col-span-1 hover:bg-surface-2 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
              <CheckBadgeIcon className="w-4 h-4" />
            </div>
            <div className="text-lg font-bold text-ink tabular-nums">{pipelineStages.exported}</div>
            <div className="text-xs font-semibold text-ink mt-0.5">Xuất kho</div>
            <div className="text-[11px] text-ink-muted">Đạt chuẩn phát hành</div>
          </div>
        </div>
      </div>

      {/* ================= TWO COLUMN GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Batches List (2 cols wide) */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-surface border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h3 className="font-semibold text-ink text-sm sm:text-base">Lô hàng gần đây</h3>
            <Link
              to="/batches"
              className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Xem tất cả &rarr;
            </Link>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border ${
                activeTab === 'all'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-surface-2 text-ink-muted hover:text-ink border-border'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setActiveTab('testing')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border ${
                activeTab === 'testing'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-surface-2 text-ink-muted hover:text-ink border-border'
              }`}
            >
              Đang kiểm
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border ${
                activeTab === 'rejected'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-surface-2 text-ink-muted hover:text-ink border-border'
              }`}
            >
              Không đạt
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-xs font-semibold text-ink-muted">
                  <th className="py-2.5 px-3">Số lô</th>
                  <th className="py-2.5 px-3">Sản phẩm</th>
                  <th className="py-2.5 px-3">Hạn dùng</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredBatches.map((b) => {
                  const product = products.find((p) => p.id === b.productId);
                  let statusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-3 text-ink-muted">
                      Chờ duyệt
                    </span>
                  );

                  if (b.status === BATCH_STATUS.RELEASED) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        Đạt chuẩn
                      </span>
                    );
                  } else if (b.status === BATCH_STATUS.TESTING) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        Đang kiểm
                      </span>
                    );
                  } else if (b.status === BATCH_STATUS.REJECTED) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                        Không đạt
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={b.id}
                      onClick={() => navigate(`/batches/${b.id}`)}
                      className="cursor-pointer hover:bg-surface-2/60 transition-colors"
                    >
                      <td className="py-3 px-3 font-mono font-medium text-ink">{b.batchNo}</td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-ink">
                          {product?.name || 'Sản phẩm không rõ'}
                        </div>
                        <div className="text-[11px] font-mono text-ink-muted">
                          {product?.code || '---'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-ink-soft">
                        {b.expDate ? b.expDate.split('-').reverse().slice(0, 2).join('/') : '---'}
                      </td>
                      <td className="py-3 px-3">{statusBadge}</td>
                    </tr>
                  );
                })}
                {filteredBatches.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-ink-muted font-medium text-xs">
                      Không tìm thấy lô hàng nào phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Alerts & AI Card (1 col wide) */}
        <div className="space-y-4">
          {/* Quality Alerts */}
          <div className="p-5 rounded-xl bg-surface border border-border shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-semibold text-ink text-sm sm:text-base">Cảnh báo chất lượng</h3>
              <Link
                to="/alerts"
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Tất cả &rarr;
              </Link>
            </div>

            <div className="divide-y divide-border">
              {alerts.slice(0, 4).map((anomaly, idx) => {
                const isHigh = anomaly.severity === 'HIGH';
                return (
                  <div key={idx} className="py-2.5 flex items-start gap-2.5">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        isHigh
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {isHigh ? (
                        <ShieldExclamationIcon className="w-3.5 h-3.5" />
                      ) : (
                        <ClockIcon className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-ink truncate">{anomaly.title}</div>
                      <div className="text-[11px] text-ink-muted truncate mt-0.5">
                        {anomaly.detail} {anomaly.batchNo ? `· Lô: ${anomaly.batchNo}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
              {alerts.length === 0 && (
                <div className="py-6 text-center text-ink-muted font-medium text-xs">
                  Không có cảnh báo chất lượng cần xử lý.
                </div>
              )}
            </div>
          </div>

          {/* AI Quick Prompt Widget */}
          <div className="p-5 rounded-xl bg-surface border border-border shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-ink font-semibold text-sm">
              <SparklesIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Trợ lý AI phân tích</span>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Hỏi trợ lý về tình trạng lô, phân tích nguyên nhân gốc (5 Why) hoặc trích xuất dữ liệu
              kết quả phiếu kiểm nghiệm.
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => triggerAIChat('Tổng quan tình trạng tất cả lô hàng hiện tại')}
                className="w-full text-left p-2.5 bg-surface-2 hover:bg-surface-3 border border-border rounded-lg text-xs text-ink-soft transition-colors flex items-center gap-2"
              >
                <SparklesIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">Tổng quan tình trạng tất cả lô hàng hiện tại</span>
              </button>

              <button
                onClick={() => triggerAIChat('Xuất báo cáo chất lượng tháng này ra Excel')}
                className="w-full text-left p-2.5 bg-surface-2 hover:bg-surface-3 border border-border rounded-lg text-xs text-ink-soft transition-colors flex items-center gap-2"
              >
                <SparklesIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">Xuất báo cáo chất lượng tháng này ra Excel</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
