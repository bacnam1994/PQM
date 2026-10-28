import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { useQualityAlerts } from '../../hooks/useQualityAlerts';
import { QAQCActionQueue } from '../../components/features/QAQCActionQueue';
import { useAIChatHostStore } from '../../store/useAIChatHostStore';
import { BATCH_STATUS, PRODUCT_STATUS, TEST_RESULT_STATUS } from '../../utils';
import { BatchInspectionProgressService } from '../../domain/batch/BatchInspectionProgressService';

// Subcomponents
import { DashboardHeader } from './dashboard/DashboardHeader';
import { DashboardQuickActions } from './dashboard/DashboardQuickActions';
import { DashboardKpiCards } from './dashboard/DashboardKpiCards';
import { DashboardPipeline } from './dashboard/DashboardPipeline';
import { DashboardCharts } from './dashboard/DashboardCharts';
import { DashboardRecentTable } from './dashboard/DashboardRecentTable';
import { DashboardAlertsAndAI } from './dashboard/DashboardAlertsAndAI';
import {
  DateRangeFilter,
  PipelineStageKey,
  DashboardStats,
  MonthlyTestTrend,
  LabDistributionStat,
  ExpiringBatchItem,
} from './dashboard/types';

const Dashboard: React.FC = () => {
  // Filters & State
  const [dateRange, setDateRange] = useState<DateRangeFilter>('ALL');
  const [selectedStage, setSelectedStage] = useState<PipelineStageKey>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Store data via shallow selector
  const {
    products,
    batches,
    tccsList,
    rawMaterials,
    testResultsRealtime,
    allTestResults,
    fetchAllTestResultsForDashboard,
    user,
    syncStatus,
  } = useAppStore(
    useShallow((state) => ({
      products: state.products || [],
      batches: state.batches || [],
      tccsList: state.tccsList || [],
      rawMaterials: state.rawMaterials || [],
      testResultsRealtime: state.testResults || [],
      allTestResults: state.allTestResults || [],
      fetchAllTestResultsForDashboard: state.fetchAllTestResultsForDashboard,
      user: state.user,
      syncStatus: state.syncStatus || 'IDLE',
    }))
  );

  // Quality alerts from custom hook
  const { alerts, highCount } = useQualityAlerts(30);

  // Fetch all test results once on dashboard mount
  useEffect(() => {
    fetchAllTestResultsForDashboard();
  }, [fetchAllTestResultsForDashboard]);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchAllTestResultsForDashboard(true);
    } catch (err) {
      console.error('Lỗi làm mới dữ liệu Dashboard:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchAllTestResultsForDashboard]);

  // Merge background fetch results + realtime results
  const testResults = useMemo(() => {
    const map = new Map(allTestResults.map((r) => [r.id, r]));
    testResultsRealtime.forEach((r) => map.set(r.id, r));
    return Array.from(map.values());
  }, [allTestResults, testResultsRealtime]);

  // Date filtering logic
  const dateThreshold = useMemo(() => {
    const now = new Date();
    if (dateRange === '30D') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d.getTime();
    }
    if (dateRange === '90D') {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      return d.getTime();
    }
    if (dateRange === 'YTD') {
      return new Date(now.getFullYear(), 0, 1).getTime();
    }
    return 0; // 'ALL'
  }, [dateRange]);

  // Batches within the selected date range
  const filteredBatchesByDate = useMemo(() => {
    if (dateThreshold === 0) return batches;
    return batches.filter((b) => {
      const dateStr = b.mfgDate || b.createdAt;
      if (!dateStr) return true;
      return new Date(dateStr).getTime() >= dateThreshold;
    });
  }, [batches, dateThreshold]);

  // Test results within the selected date range
  const filteredResultsByDate = useMemo(() => {
    if (dateThreshold === 0) return testResults;
    return testResults.filter((r) => {
      const dateStr = r.testDate || r.createdAt;
      if (!dateStr) return true;
      return new Date(dateStr).getTime() >= dateThreshold;
    });
  }, [testResults, dateThreshold]);

  // Product map for quick lookup
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Expiring batches (within 90 days or expired)
  const expiringBatches = useMemo<ExpiringBatchItem[]>(() => {
    const now = Date.now();
    const items: ExpiringBatchItem[] = [];

    batches.forEach((b) => {
      if (!b.expDate) return;
      const expTime = new Date(b.expDate).getTime();
      const diffDays = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));

      if (diffDays <= 90) {
        items.push({
          batch: b,
          product: productMap.get(b.productId),
          daysRemaining: diffDays,
          isExpired: diffDays < 0,
          urgency: diffDays < 0 ? 'EXPIRED' : diffDays <= 30 ? 'CRITICAL' : 'WARNING',
        });
      }
    });

    return items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [batches, productMap]);

  // Aggregate global statistics
  const stats = useMemo<DashboardStats>(() => {
    const totalProducts = products.length;
    const activeProducts = products.filter((p) => p.status === PRODUCT_STATUS.ACTIVE).length;

    let notTestedBatches = 0;
    let testingBatches = 0; // IN_PROGRESS
    let reviewBatches = 0; // PENDING_REVIEW
    let releasedBatches = 0; // RELEASED
    let rejectedBatches = 0; // REJECTED or FAIL
    let passBatches = 0;

    filteredBatchesByDate.forEach((b) => {
      const boundTccs = (b as any).tccs || tccsList.find((t) => t.id === b.tccsId);
      const inspectionStatus =
        b.inspectionStatus ||
        BatchInspectionProgressService.resolveInspectionStatusWithFallback({
          batch: b,
          testResults,
          tccs: boundTccs,
          tccsList,
        });

      if (b.status === BATCH_STATUS.RELEASED) {
        releasedBatches++;
      }
      if (b.status === BATCH_STATUS.REJECTED || inspectionStatus === 'FAIL') {
        rejectedBatches++;
      }

      if (inspectionStatus === 'NOT_TESTED') {
        notTestedBatches++;
      } else if (inspectionStatus === 'IN_PROGRESS') {
        testingBatches++;
      } else if (inspectionStatus === 'PENDING_REVIEW') {
        reviewBatches++;
      } else if (inspectionStatus === 'PASS') {
        passBatches++;
      }
    });

    const totalBatches = filteredBatchesByDate.length;

    let passResults = 0;
    let failResults = 0;
    let pendingResults = 0;

    filteredResultsByDate.forEach((r) => {
      if (r.overallStatus === TEST_RESULT_STATUS.PASS) passResults++;
      else if (r.overallStatus === TEST_RESULT_STATUS.FAIL) failResults++;
      else pendingResults++;
    });

    const totalResults = filteredResultsByDate.length;
    const passRate = totalResults > 0 ? Math.round((passResults / totalResults) * 100) : null;

    const totalTCCS = tccsList.length;
    const activeTCCS = tccsList.filter((t) => t.isActive).length;
    const totalMaterials = rawMaterials.length;

    return {
      totalBatches,
      notTestedBatches,
      testingBatches,
      reviewBatches,
      releasedBatches,
      rejectedBatches,
      passBatches,
      totalResults,
      passResults,
      failResults,
      pendingResults,
      passRate,
      totalProducts,
      activeProducts,
      totalTCCS,
      activeTCCS,
      totalMaterials,
      expiringBatchesCount: expiringBatches.length,
    };
  }, [
    products,
    filteredBatchesByDate,
    tccsList,
    rawMaterials,
    filteredResultsByDate,
    testResults,
    expiringBatches.length,
  ]);

  // Calculate monthly testing trends (last 6 months)
  const monthlyTrends = useMemo<MonthlyTestTrend[]>(() => {
    const monthsMap = new Map<string, MonthlyTestTrend>();
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
      monthsMap.set(key, { month: label, pass: 0, fail: 0, pending: 0, total: 0 });
    }

    testResults.forEach((r) => {
      const dateStr = r.testDate || r.createdAt;
      if (!dateStr) return;
      const key = dateStr.slice(0, 7);
      const bucket = monthsMap.get(key);
      if (bucket) {
        bucket.total++;
        if (r.overallStatus === TEST_RESULT_STATUS.PASS) bucket.pass++;
        else if (r.overallStatus === TEST_RESULT_STATUS.FAIL) bucket.fail++;
        else bucket.pending++;
      }
    });

    return Array.from(monthsMap.values());
  }, [testResults]);

  // Calculate laboratory distribution stats
  const labDistribution = useMemo<LabDistributionStat[]>(() => {
    const labMap = new Map<string, { total: number; pass: number; fail: number }>();

    testResults.forEach((r) => {
      const name = (r.labName || 'Nội bộ').trim();
      const current = labMap.get(name) || { total: 0, pass: 0, fail: 0 };
      current.total++;
      if (r.overallStatus === TEST_RESULT_STATUS.PASS) current.pass++;
      else if (r.overallStatus === TEST_RESULT_STATUS.FAIL) current.fail++;
      labMap.set(name, current);
    });

    const totalTests = testResults.length || 1;
    const list: LabDistributionStat[] = [];

    labMap.forEach((val, labName) => {
      list.push({
        labName,
        totalTests: val.total,
        passCount: val.pass,
        failCount: val.fail,
        passRate: val.total > 0 ? Math.round((val.pass / val.total) * 100) : 0,
        percentageOfAll: Math.round((val.total / totalTests) * 100),
      });
    });

    return list.sort((a, b) => b.totalTests - a.totalTests);
  }, [testResults]);

  // Trigger global AI assistant chat
  const triggerAIChat = useCallback((prompt: string) => {
    const chatHostStore = useAIChatHostStore.getState();
    if (chatHostStore?.openChat) {
      chatHostStore.openChat(prompt || undefined);
    }
    if (prompt) {
      window.dispatchEvent(new CustomEvent('trigger-ai-chat', { detail: { prompt } }));
    }
  }, []);

  return (
    // Golden ratio vertical rhythm: 24px (mobile) -> 28px (desktop) between major regions,
    // 20px (gap-5) between sibling panels, 14px (gap-3.5) inside groups.
    <div className="space-y-6 sm:space-y-7 pb-4">
      {/* 1. Header with Role, Date Filter Pill & Gauge Chart */}
      <DashboardHeader
        stats={stats}
        user={user}
        dateRange={dateRange}
        setDateRange={setDateRange}
        syncStatus={syncStatus}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        selectedStage={selectedStage}
        onSelectStage={setSelectedStage}
      />

      {/* 2. Core KPI Stat Cards (Tier 1 Primary Hero + Tier 2 Supporting Cards) */}
      <DashboardKpiCards stats={stats} alertsCount={alerts.length} highAlertsCount={highCount} />

      {/* 3. Quick Action Hub */}
      <DashboardQuickActions onTriggerAI={triggerAIChat} />

      {/* 4. QA/QC Action Workbench Queue */}
      <QAQCActionQueue />

      {/* 5. GMP 5-Stage Batch & Quality Lifecycle Pipeline */}
      <DashboardPipeline
        stats={stats}
        selectedStage={selectedStage}
        onSelectStage={setSelectedStage}
      />

      {/* 6. Visual Testing Analytics & Lab Distribution Charts */}
      <DashboardCharts monthlyTrends={monthlyTrends} labDistribution={labDistribution} />

      {/* 7. Operational Activities (8 cols) & Right Column Alerts/AI (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 min-w-0">
          <DashboardRecentTable
            batches={filteredBatchesByDate}
            testResults={filteredResultsByDate}
            products={products}
            expiringBatches={expiringBatches}
            selectedStage={selectedStage}
            onSelectStage={setSelectedStage}
          />
        </div>

        <div className="lg:col-span-4 min-w-0">
          <DashboardAlertsAndAI alerts={alerts} onTriggerAI={triggerAIChat} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
