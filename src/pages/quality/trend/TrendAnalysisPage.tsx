import React from 'react';
import { Activity, Download, BarChart2, Info } from 'lucide-react';
import { PageHeader, DSCard } from '../../../components';
import { useTrendAnalyticsState } from './hooks/useTrendAnalyticsState';
import { TrendFilterPanel } from './components/TrendFilterPanel';
import { StatsSummaryCards } from './components/StatsSummaryCards';
import { ControlChartSection } from './components/ControlChartSection';
import { AIStabilitySection } from './components/AIStabilitySection';
import { BatchHistoryTable } from './components/BatchHistoryTable';

export const TrendAnalysisPage: React.FC = () => {
  const state = useTrendAnalyticsState();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phân tích xu hướng chất lượng"
        subtitle="Statistical Process Control (SPC) — Biểu đồ kiểm soát quá trình sản xuất"
        icon={Activity}
        action={
          state.chartData.length > 0 ? (
            <button
              onClick={state.handleExport}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase text-[11px] tracking-wider transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <Download size={15} /> Xuất Excel
            </button>
          ) : undefined
        }
      />

      {/* Bộ lọc sản phẩm & chỉ tiêu */}
      <TrendFilterPanel
        selectedProduct={state.selectedProduct}
        selectedProductId={state.selectedProductId}
        selectedProductStat={state.selectedProductStat}
        activeTccs={state.activeTccs}
        dropdownRef={state.dropdownRef}
        searchInputRef={state.searchInputRef}
        isDropdownOpen={state.isDropdownOpen}
        setIsDropdownOpen={state.setIsDropdownOpen}
        productSearch={state.productSearch}
        setProductSearch={state.setProductSearch}
        onlyWithData={state.onlyWithData}
        setOnlyWithData={state.setOnlyWithData}
        productGroups={state.productGroups}
        selectedGroupFilter={state.selectedGroupFilter}
        setSelectedGroupFilter={state.setSelectedGroupFilter}
        activeProducts={state.activeProducts}
        filteredProducts={state.filteredProducts}
        topProductsWithData={state.topProductsWithData}
        productStats={state.productStats}
        handleSelectProduct={state.handleSelectProduct}
        handleClearProduct={state.handleClearProduct}
        criteriaList={state.criteriaList}
        filteredCriteriaList={state.filteredCriteriaList}
        criteriaSearch={state.criteriaSearch}
        setCriteriaSearch={state.setCriteriaSearch}
        selectedCriteriaName={state.selectedCriteriaName}
        setSelectedCriteriaName={state.setSelectedCriteriaName}
        selectedCriteria={state.selectedCriteria}
        declaredBasis={state.declaredBasis}
        basisInfo={state.basisInfo}
        manualBasisChoice={state.manualBasisChoice}
        setManualBasisChoice={state.setManualBasisChoice}
        dateFrom={state.dateFrom}
        setDateFrom={state.setDateFrom}
        dateTo={state.dateTo}
        setDateTo={state.setDateTo}
        activeDatePreset={state.activeDatePreset}
        handleApplyDatePreset={state.handleApplyDatePreset}
      />

      {/* Trạng thái tải dữ liệu */}
      {state.loading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      )}

      {!state.loading && !state.selectedProductId && (
        <DSCard className="p-12 text-center">
          <BarChart2 size={48} className="text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-zinc-300 font-bold text-base">Chọn một sản phẩm để bắt đầu phân tích xu hướng SPC</p>
          <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1 max-w-md mx-auto">
            Hệ thống sẽ tự động tổng hợp kết quả kiểm nghiệm, tính toán năng lực quy trình Cpk, giới hạn kiểm soát 3σ (UCL, LCL) và dự báo độ ổn định theo thời gian bảo quản.
          </p>
        </DSCard>
      )}

      {!state.loading && state.selectedProductId && state.selectedCriteriaName && state.chartData.length === 0 && (
        <DSCard className="p-12 text-center">
          <Info size={40} className="text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-zinc-300 font-bold">Chưa có dữ liệu định lượng cho chỉ tiêu: &quot;{state.selectedCriteriaName}&quot;</p>
          <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1">Vui lòng chọn chỉ tiêu khác hoặc kiểm tra lại phiếu kiểm nghiệm của sản phẩm này.</p>
        </DSCard>
      )}

      {/* Khi có đủ từ 2 điểm dữ liệu trở lên */}
      {!state.loading && state.chartData.length >= 2 && state.spcStats && (
        <>
          <StatsSummaryCards
            chartDataLength={state.chartData.length}
            spcStats={state.spcStats}
            selectedCriteria={state.selectedCriteria}
          />

          <ControlChartSection
            selectedCriteriaName={state.selectedCriteriaName}
            selectedCriteria={state.selectedCriteria}
            spcStats={state.spcStats}
            enrichedData={state.enrichedData}
            gridColor={state.gridColor}
            axisColor={state.axisColor}
            isDark={state.isDark}
          />

          <AIStabilitySection
            stabilityReport={state.stabilityReport}
            aiStabilitySummary={state.aiStabilitySummary}
            isGeneratingAiStability={state.isGeneratingAiStability}
            handleEnrichStabilityWithAI={state.handleEnrichStabilityWithAI}
          />

          <BatchHistoryTable
            chartDataLength={state.chartData.length}
            selectedCriteria={state.selectedCriteria}
            enrichedData={state.enrichedData}
          />
        </>
      )}

      {!state.loading && state.chartData.length === 1 && (
        <DSCard className="p-6 text-center">
          <Info size={36} className="text-amber-400 mx-auto mb-2" />
          <p className="text-slate-600 dark:text-zinc-300 font-medium">Cần ít nhất 2 điểm dữ liệu để tính toán SPC</p>
          <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1">Hiện có 1 lô: <strong>{state.chartData[0].batchNo}</strong> = {state.chartData[0].value}</p>
        </DSCard>
      )}
    </div>
  );
};

export default TrendAnalysisPage;
