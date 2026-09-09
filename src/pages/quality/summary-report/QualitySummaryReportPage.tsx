import React from 'react';
import { FileText, Download, Dna, Package, BarChart2 } from 'lucide-react';
import { PageHeader, DSCard } from '../../../components';
import { useQualitySummaryReportState } from './hooks/useQualitySummaryReportState';
import { ReportFilterBar } from './components/ReportFilterBar';
import { ReportKpiBanner } from './components/ReportKpiBanner';
import { ReportTabsSection } from './components/ReportTabsSection';
import { PQRNarrativeSection } from './components/PQRNarrativeSection';
import { CriteriaSpcSummaryTable } from './components/CriteriaSpcSummaryTable';

export const QualitySummaryReportPage: React.FC = () => {
  const state = useQualitySummaryReportState();

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-500">
      <PageHeader
        title="Báo cáo Tổng hợp Chất lượng"
        subtitle="Product Quality Review (PQR / APR) — Tổng kết xu hướng, năng lực quy trình SPC và nhận xét chất lượng định kỳ"
        icon={FileText}
      />

      {/* Filter Bar */}
      <ReportFilterBar
        productSearch={state.productSearch}
        setProductSearch={state.setProductSearch}
        showProductDropdown={state.showProductDropdown}
        setShowProductDropdown={state.setShowProductDropdown}
        filteredProducts={state.filteredProducts}
        selectedProductId={state.selectedProductId}
        setSelectedProductId={state.setSelectedProductId}
        handleInputBlur={state.handleInputBlur}
        dateRange={state.dateRange}
        setDateRange={state.setDateRange}
        reportDataLength={state.reportData.length}
        handleExportExcel={state.handleExportExcel}
        handleGeneratePQR={state.handleGeneratePQR}
        isGeneratingNarrative={state.isGeneratingNarrative}
      />

      {/* Loading state */}
      {state.loading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Empty selection state */}
      {!state.loading && !state.selectedProductId && (
        <DSCard className="p-12 text-center">
          <BarChart2 size={48} className="text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-zinc-300 font-bold text-base">Chọn một sản phẩm để tạo Báo cáo Tổng hợp Chất lượng PQR</p>
          <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1 max-w-md mx-auto">
            Hệ thống sẽ tính toán toàn diện các chỉ số năng lực quy trình (Cp, Cpk, Mean, Std Dev, CV%), phát hiện lô vượt tiêu chuẩn và hỗ trợ AI sinh văn bản nhận xét tự động theo chuẩn GMP.
          </p>
        </DSCard>
      )}

      {/* When product selected but no data */}
      {!state.loading && state.selectedProductId && state.reportData.length === 0 && (
        <DSCard className="p-12 text-center">
          <Package size={44} className="text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-zinc-300 font-bold">Chưa tìm thấy dữ liệu kiểm nghiệm cho sản phẩm trong khoảng thời gian đã chọn</p>
          <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1">Hãy thử xóa khoảng ngày lọc hoặc kiểm tra lại danh sách lô sản xuất.</p>
        </DSCard>
      )}

      {/* Main Report View */}
      {!state.loading && state.selectedProductId && state.reportData.length > 0 && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <ReportKpiBanner stats={state.stats} />

          {/* AI Executive Narrative Box */}
          <PQRNarrativeSection
            pqrNarrative={state.pqrNarrative}
            copied={state.copied}
            copyToClipboard={state.copyToClipboard}
          />

          {/* Charts Tabs Section */}
          <ReportTabsSection
            activeTab={state.activeTab}
            setActiveTab={state.setActiveTab}
            trendChartData={state.trendChartData}
            spcChartData={state.spcChartData}
            failCriteriaSummary={state.failCriteriaSummary}
            mainCriteria={state.mainCriteria}
            criteriaStats={state.criteriaStats}
            spcCriteriaName={state.spcCriteriaName}
            setSpcCriteriaName={state.setSpcCriteriaName}
            isDark={state.isDark}
          />

          {/* SPC Summary Table */}
          <CriteriaSpcSummaryTable
            mainCriteria={state.mainCriteria}
            criteriaStats={state.criteriaStats}
            selectedCriteriaName={state.selectedCriteriaName}
            setSelectedCriteriaName={state.setSelectedCriteriaName}
            histogramData={state.histogramData}
            getInsight={state.getInsight}
            isDark={state.isDark}
          />
        </div>
      )}
    </div>
  );
};

export default QualitySummaryReportPage;
