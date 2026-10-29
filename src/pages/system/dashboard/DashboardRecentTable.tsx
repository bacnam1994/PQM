import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Square3Stack3DIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { Batch, Product, TestResult } from '../../../types';
import { BATCH_STATUS } from '../../../utils';
import { PipelineStageKey, ExpiringBatchItem } from './types';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { AnimatedTabs, AnimatedTabItem } from '../../../components/ui';
import { BatchStatusSelect } from '../../batches/BatchList/components/BatchStatusSelect';
import { BatchInspectionProgressService } from '../../../domain/batch/BatchInspectionProgressService';
import { useAppStore } from '../../../store/useAppStore';

interface DashboardRecentTableProps {
  batches: Batch[];
  testResults: TestResult[];
  products: Product[];
  expiringBatches: ExpiringBatchItem[];
  selectedStage: PipelineStageKey;
  onSelectStage: (stage: PipelineStageKey) => void;
}

export const DashboardRecentTable: React.FC<DashboardRecentTableProps> = ({
  batches,
  testResults,
  products,
  expiringBatches,
  selectedStage,
  onSelectStage,
}) => {
  const navigate = useNavigate();
  const tccsList = useAppStore((state) => state.tccsList);
  const isAdmin = useAppStore((state) => Boolean(state.isAdmin || state.user?.role === 'ADMIN'));

  const [activeTab, setActiveTab] = useState<'batches' | 'testResults' | 'expiring'>('batches');
  const [testResultFilter, setTestResultFilter] = useState<'ALL' | 'PASS' | 'FAIL' | 'PENDING'>(
    'ALL'
  );

  // Filter batches by selected pipeline stage
  const filteredBatches = React.useMemo(() => {
    const list = [...batches].sort((a, b) =>
      (b.createdAt || b.mfgDate || '').localeCompare(a.createdAt || a.mfgDate || '')
    );

    if (selectedStage === 'ALL') {
      return list.slice(0, 7);
    }

    return list
      .filter((b) => {
        const boundTccs = (b as any).tccs || tccsList.find((t) => t.id === b.tccsId);
        const resolved =
          b.inspectionStatus ||
          BatchInspectionProgressService.resolveInspectionStatusWithFallback({
            batch: b,
            testResults,
            tccs: boundTccs,
            tccsList,
          });

        if (selectedStage === 'NOT_TESTED' || (selectedStage as string) === 'PENDING') {
          return resolved === 'NOT_TESTED';
        }
        if (selectedStage === 'IN_PROGRESS' || (selectedStage as string) === 'TESTING') {
          return resolved === 'IN_PROGRESS';
        }
        if (selectedStage === 'PENDING_REVIEW' || (selectedStage as string) === 'REVIEW') {
          return resolved === 'PENDING_REVIEW';
        }
        if (selectedStage === 'PASS') {
          return resolved === 'PASS';
        }
        if (selectedStage === 'FAIL') {
          return resolved === 'FAIL';
        }
        if (selectedStage === 'RELEASED') {
          return b.status === BATCH_STATUS.RELEASED;
        }
        if (selectedStage === 'REJECTED') {
          return b.status === BATCH_STATUS.REJECTED || resolved === 'FAIL';
        }
        return true;
      })
      .slice(0, 7);
  }, [batches, selectedStage, testResults, tccsList]);

  // Filter test results
  const filteredTestResults = React.useMemo(() => {
    let list = [...testResults].sort((a, b) =>
      (b.testDate || b.createdAt || '').localeCompare(a.testDate || a.createdAt || '')
    );

    if (testResultFilter === 'PASS') {
      list = list.filter((r) => r.overallStatus === 'PASS');
    } else if (testResultFilter === 'FAIL') {
      list = list.filter((r) => r.overallStatus === 'FAIL');
    } else if (testResultFilter === 'PENDING') {
      list = list.filter((r) => r.overallStatus === 'PENDING' || r.overallStatus === 'UNKNOWN');
    }

    return list.slice(0, 7);
  }, [testResults, testResultFilter]);

  // Lookup helpers
  const productMap = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const batchMap = React.useMemo(() => new Map(batches.map((b) => [b.id, b])), [batches]);

  const recentTabs: AnimatedTabItem<'batches' | 'testResults' | 'expiring'>[] = [
    {
      id: 'batches',
      label: 'Lô sản xuất gần đây',
      icon: Square3Stack3DIcon,
      count: filteredBatches.length,
    },
    {
      id: 'testResults',
      label: 'Phiếu kiểm nghiệm mới',
      icon: ClipboardDocumentCheckIcon,
      count: filteredTestResults.length,
    },
    {
      id: 'expiring',
      label: 'Lô cận hạn / Hết hạn',
      icon: ClockIcon,
      count: expiringBatches.length > 0 ? expiringBatches.length : undefined,
      countClassName: 'bg-rose-500 text-white font-bold',
    },
  ];

  return (
    <section
      aria-label="Hoạt động kiểm nghiệm và lô sản xuất gần đây"
      className="contain-layout-section p-5 sm:p-6 rounded-2xl bg-surface/90 dark:bg-surface/85 backdrop-blur-md border border-border/80 space-y-4 shadow-xs"
    >
      {/* Table Navigation & Main Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-border/70">
        <div className="overflow-x-auto hide-scrollbar -mx-1 px-1">
          <AnimatedTabs<'batches' | 'testResults' | 'expiring'>
            tabs={recentTabs}
            activeTab={activeTab}
            onChange={setActiveTab}
            layoutId="dashboard-recent-table-tab"
          />
        </div>

        <div className="shrink-0">
          {activeTab === 'batches' && (
            <Link
              to="/batches"
              className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Xem tất cả ({batches.length} lô)</span>
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </Link>
          )}
          {activeTab === 'testResults' && (
            <Link
              to="/test-results"
              className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Xem tất cả ({testResults.length} phiếu)</span>
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </Link>
          )}
          {activeTab === 'expiring' && (
            <span className="text-xs text-ink-muted">Cảnh báo hạn dùng theo ICH Q1A</span>
          )}
        </div>
      </div>

      {/* Sub-filters for current tab — Ghost buttons with low-opacity accent active state per ui-craft */}
      {activeTab === 'batches' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-muted mr-1">Giai đoạn:</span>
          {(
            [
              { key: 'ALL', label: 'Tất cả' },
              { key: 'NOT_TESTED', label: 'Chưa kiểm' },
              { key: 'IN_PROGRESS', label: 'Đang kiểm' },
              { key: 'PENDING_REVIEW', label: 'Chờ đánh giá' },
              { key: 'PASS', label: 'Đạt chuẩn' },
              { key: 'RELEASED', label: 'Đã xuất xưởng' },
              { key: 'REJECTED', label: 'Không đạt / OOS' },
            ] as const
          ).map((item) => {
            const active = selectedStage === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectStage(item.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors duration-150 border cursor-pointer ${
                  active
                    ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/35 font-semibold'
                    : 'bg-transparent text-ink-muted hover:text-ink border-border/70 hover:bg-surface-2/70'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          {selectedStage !== 'ALL' && (
            <button
              type="button"
              onClick={() => onSelectStage('ALL')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline ml-1 cursor-pointer"
            >
              Đặt lại
            </button>
          )}
        </div>
      )}

      {activeTab === 'testResults' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-muted mr-1">Kết luận:</span>
          {(
            [
              { key: 'ALL', label: 'Tất cả phiếu' },
              { key: 'PASS', label: 'Đạt chuẩn' },
              { key: 'FAIL', label: 'Không đạt' },
              { key: 'PENDING', label: 'Chờ kết quả' },
            ] as const
          ).map((item) => {
            const active = testResultFilter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTestResultFilter(item.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors duration-150 border cursor-pointer ${
                  active
                    ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/35 font-semibold'
                    : 'bg-transparent text-ink-muted hover:text-ink border-border/70 hover:bg-surface-2/70'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          {testResultFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setTestResultFilter('ALL')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline ml-1 cursor-pointer"
            >
              Đặt lại
            </button>
          )}
        </div>
      )}

      {/* ================= TAB 1: BATCHES TABLE ================= */}
      {activeTab === 'batches' && (
        <div
          tabIndex={0}
          role="region"
          aria-label="Bảng lô sản xuất gần đây"
          className="overflow-x-auto custom-scrollbar [scrollbar-gutter:stable] -mx-1 px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 rounded-xl"
        >
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/80 bg-surface-2/50 text-xs font-medium text-ink-muted">
                <th className="py-2.5 px-3 font-medium">Số lô</th>
                <th className="py-2.5 px-3 font-medium">Sản phẩm</th>
                <th className="py-2.5 px-3 font-medium">Ngày SX · Hạn dùng</th>
                <th className="py-2.5 px-3 font-medium text-right">Sản lượng</th>
                <th className="py-2.5 px-3 font-medium">Tiến độ kiểm nghiệm</th>
                <th className="py-2.5 px-3 font-medium">Trạng thái</th>
                <th className="py-2.5 px-3 font-medium text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredBatches.map((b) => {
                const product = productMap.get(b.productId);
                const boundTccs = (b as any).tccs || tccsList.find((t) => t.id === b.tccsId);
                const inspectionCalc = BatchInspectionProgressService.calculateInspectionProgress({
                  batch: b,
                  testResults,
                  tccs: boundTccs,
                  tccsList,
                });
                const completedCount = inspectionCalc.progress.completedCount;
                const requiredCount = inspectionCalc.progress.requiredCount;
                const progress = inspectionCalc.progress.percentage;

                return (
                  <tr
                    key={b.id}
                    onClick={() => navigate(`/batches/${b.id}`)}
                    className="cursor-pointer hover:bg-surface-2/60 transition-colors duration-120 group"
                  >
                    <td className="py-3 px-3 font-mono font-semibold text-ink tabular-nums whitespace-nowrap">
                      <span className="group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {b.batchNo}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-ink max-w-[200px] truncate">
                        {product?.name || 'Sản phẩm không rõ'}
                      </div>
                      <div className="text-[11px] font-mono text-ink-muted">
                        {product?.code || '—'}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-ink-soft whitespace-nowrap font-mono text-[11px] tabular-nums">
                      <div>SX: {b.mfgDate ? b.mfgDate.split('-').reverse().join('/') : '—'}</div>
                      <div className="text-ink-muted">
                        HD: {b.expDate ? b.expDate.split('-').reverse().join('/') : '—'}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-ink text-right tabular-nums whitespace-nowrap">
                      {b.actualYield
                        ? `${b.actualYield.toLocaleString()} ${b.yieldUnit || ''}`
                        : '—'}
                    </td>
                    <td className="py-3 px-3 min-w-[136px]">
                      <div className="flex items-center gap-2">
                        <div className="w-full h-1.5 rounded-full bg-surface-3 overflow-hidden">
                          <div
                            style={{ width: `${progress}%` }}
                            className={`h-full rounded-full transition-all duration-300 ${
                              progress === 100 ? 'bg-emerald-500' : 'bg-sky-500'
                            }`}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-semibold text-ink tabular-nums">
                          {progress}%
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-muted mt-0.5 tabular-nums">
                        {completedCount}/{requiredCount} chỉ tiêu
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col items-start gap-1">
                        <BatchStatusSelect
                          status={b.status}
                          batchId={b.id}
                          batch={b}
                          testResults={testResults}
                          tccs={boundTccs}
                          releaseGateProgress={b.releaseGateProgress}
                          releaseStage={b.releaseStage}
                          isAdmin={isAdmin}
                        />
                        <div className="text-[10px] text-ink-muted flex items-center gap-1 font-medium tabular-nums">
                          <span
                            className={
                              b.status === 'RELEASED'
                                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                : ''
                            }
                          >
                            {b.status === 'RELEASED'
                              ? 'Đã xuất xưởng'
                              : `Xuất xưởng: ${b.releaseGateProgress?.completed ?? 0}/7`}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-ink-muted group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 inline-block transition-[transform,color] duration-150">
                        &rarr;
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredBatches.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-muted text-xs">
                    Chưa có lô sản xuất trong giai đoạn này. Chọn giai đoạn khác hoặc{' '}
                    <Link
                      to="/batches"
                      className="text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      mở danh sách lô
                    </Link>
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= TAB 2: TEST RESULTS TABLE ================= */}
      {activeTab === 'testResults' && (
        <div className="overflow-x-auto [scrollbar-gutter:stable] -mx-1 px-1">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/80 bg-surface-2/50 text-xs font-medium text-ink-muted">
                <th className="py-2.5 px-3 font-medium">Mã phiếu</th>
                <th className="py-2.5 px-3 font-medium">Số lô</th>
                <th className="py-2.5 px-3 font-medium">Sản phẩm</th>
                <th className="py-2.5 px-3 font-medium">Đơn vị kiểm nghiệm</th>
                <th className="py-2.5 px-3 font-medium">Ngày kiểm</th>
                <th className="py-2.5 px-3 font-medium">Niêm phong ALCOA+</th>
                <th className="py-2.5 px-3 font-medium">Kết luận</th>
                <th className="py-2.5 px-3 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredTestResults.map((r) => {
                const batch = batchMap.get(r.batchId);
                const product = batch?.productId ? productMap.get(batch.productId) : undefined;
                const isSealed = Boolean(r.evaluationSnapshot?.evaluationHash);

                return (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/test-results/edit/${r.id}`)}
                    className="cursor-pointer hover:bg-surface-2/60 transition-colors duration-120 group"
                  >
                    <td className="py-3 px-3 font-mono font-semibold text-ink tabular-nums whitespace-nowrap">
                      <span className="group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {r.id.length > 10 ? `${r.id.slice(0, 10)}…` : r.id}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-ink tabular-nums whitespace-nowrap">
                      {batch?.batchNo || r.batchId}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-ink max-w-[180px] truncate">
                        {product?.name || '—'}
                      </div>
                      <div className="text-[11px] font-mono text-ink-muted">
                        {product?.code || '—'}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-ink">{r.labName || 'Nội bộ'}</td>
                    <td className="py-3 px-3 font-mono text-ink-soft whitespace-nowrap tabular-nums">
                      {r.testDate ? r.testDate.split('-').reverse().join('/') : '—'}
                    </td>
                    <td className="py-3 px-3">
                      {isSealed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          <LockClosedIcon className="w-3 h-3 text-emerald-600" />
                          SHA-256
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                          <span className="w-1.5 h-1.5 rounded-full bg-ink-faint" />
                          Bản nháp
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={r.overallStatus} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/test-results/edit/${r.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-ink-muted hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-surface-3 inline-flex items-center justify-center transition-colors"
                        title="Mở phiếu kiểm nghiệm"
                        aria-label="Mở phiếu kiểm nghiệm"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filteredTestResults.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-ink-muted text-xs">
                    Chưa có phiếu kiểm nghiệm phù hợp. Bạn có thể{' '}
                    <Link
                      to="/test-results/new"
                      className="text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      nhập phiếu mới
                    </Link>
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= TAB 3: EXPIRING BATCHES TABLE ================= */}
      {activeTab === 'expiring' && (
        <div className="overflow-x-auto [scrollbar-gutter:stable] -mx-1 px-1">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/80 bg-surface-2/50 text-xs font-medium text-ink-muted">
                <th className="py-2.5 px-3 font-medium">Số lô</th>
                <th className="py-2.5 px-3 font-medium">Sản phẩm</th>
                <th className="py-2.5 px-3 font-medium">Hạn sử dụng</th>
                <th className="py-2.5 px-3 font-medium">Thời gian còn lại</th>
                <th className="py-2.5 px-3 font-medium text-right">Sản lượng</th>
                <th className="py-2.5 px-3 font-medium">Trạng thái</th>
                <th className="py-2.5 px-3 font-medium text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {expiringBatches.map(({ batch: b, product, daysRemaining, isExpired, urgency }) => {
                let badge = null;
                if (isExpired) {
                  badge = (
                    <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold tabular-nums">
                      <XCircleIcon className="w-3.5 h-3.5 shrink-0" />
                      Quá hạn {Math.abs(daysRemaining)} ngày
                    </span>
                  );
                } else if (urgency === 'CRITICAL') {
                  badge = (
                    <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold tabular-nums">
                      <ExclamationTriangleIcon className="w-3.5 h-3.5 shrink-0" />
                      Còn {daysRemaining} ngày
                    </span>
                  );
                } else {
                  badge = (
                    <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium tabular-nums">
                      <ClockIcon className="w-3.5 h-3.5 shrink-0" />
                      Còn {daysRemaining} ngày
                    </span>
                  );
                }

                return (
                  <tr
                    key={b.id}
                    onClick={() => navigate(`/batches/${b.id}`)}
                    className="cursor-pointer hover:bg-surface-2/60 transition-colors duration-120 group"
                  >
                    <td className="py-3 px-3 font-mono font-semibold text-ink tabular-nums whitespace-nowrap">
                      <span className="group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {b.batchNo}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-ink max-w-[200px] truncate">
                        {product?.name || '—'}
                      </div>
                      <div className="text-[11px] font-mono text-ink-muted">
                        {product?.code || '—'}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-ink tabular-nums whitespace-nowrap">
                      {b.expDate ? b.expDate.split('-').reverse().join('/') : '—'}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">{badge}</td>
                    <td className="py-3 px-3 font-mono text-right tabular-nums text-ink whitespace-nowrap">
                      {b.actualYield
                        ? `${b.actualYield.toLocaleString()} ${b.yieldUnit || ''}`
                        : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-ink-muted group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 inline-block transition-[transform,color] duration-150">
                        &rarr;
                      </span>
                    </td>
                  </tr>
                );
              })}
              {expiringBatches.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-muted text-xs">
                    <CheckCircleIcon className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                    Không có lô sản xuất nào cận hạn (≤90 ngày) hoặc hết hạn.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
