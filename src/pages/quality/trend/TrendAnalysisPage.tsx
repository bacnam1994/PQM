import React from 'react';
import { 
  ArrowTrendingUpIcon, 
  ArrowDownTrayIcon, 
  ChartBarIcon, 
  InformationCircleIcon 
} from '@heroicons/react/24/outline';
import { PageHeader, DSCard } from '../../../components';
import { Surface } from '../../../components/ui';
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
        icon={ArrowTrendingUpIcon}
        action={
          state.chartData.length > 0 ? (
            <button
              onClick={state.handleExport}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase text-[11px] tracking-wider transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <ArrowDownTrayIcon className="w-4 h-4" /> Xuất Excel
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
          <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      )}

      {!state.loading && !state.selectedProductId && (
        <Surface variant="flat" padding="lg" className="text-center py-12">
          <ChartBarIcon className="w-12 h-12 text-ink-muted mx-auto mb-3" />
          <p className="text-ink font-bold text-base">Chọn một sản phẩm để bắt đầu phân tích xu hướng SPC</p>
          <p className="text-ink-muted text-xs mt-1.5 max-w-md mx-auto leading-relaxed">
            Hệ thống sẽ tự động tổng hợp kết quả kiểm nghiệm, tính toán năng lực quy trình Cpk, giới hạn kiểm soát 3σ (UCL, LCL) và dự báo độ ổn định theo thời gian bảo quản.
          </p>
        </Surface>
      )}

      {!state.loading && state.selectedProductId && state.selectedCriteriaName && state.chartData.length === 0 && (
        <Surface variant="flat" padding="lg" className="text-center py-12">
          <InformationCircleIcon className="w-10 h-10 text-ink-muted mx-auto mb-3" />
          <p className="text-ink font-bold">Chưa có dữ liệu định lượng cho chỉ tiêu: &quot;{state.selectedCriteriaName}&quot;</p>
          <p className="text-ink-muted text-xs mt-1">Vui lòng chọn chỉ tiêu khác hoặc kiểm tra lại phiếu kiểm nghiệm của sản phẩm này.</p>
        </Surface>
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
        <Surface variant="flat" padding="md" className="text-center py-8">
          <InformationCircleIcon className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-ink font-semibold text-sm">Cần ít nhất 2 điểm dữ liệu để tính toán SPC</p>
          <p className="text-ink-muted text-xs mt-1">Hiện có 1 lô: <strong>{state.chartData[0].batchNo}</strong> = {state.chartData[0].value}</p>
        </Surface>
      )}
    </div>
  );
};

export default TrendAnalysisPage;
