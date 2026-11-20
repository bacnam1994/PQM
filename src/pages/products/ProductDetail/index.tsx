import React from 'react';
import { useProductDetail } from './hooks/useProductDetail';
import { ProductHeader } from './components/ProductHeader';
import { ProductMetricsCard } from './components/ProductMetricsCard';
import { ProductInfoTab } from './components/ProductInfoTab';
import { ProductFormulaTab } from './components/ProductFormulaTab';
import { ProductTccsTab } from './components/ProductTccsTab';
import { ProductHistoryTab } from './components/ProductHistoryTab';
import { ProductAnalyticsTab } from './components/ProductAnalyticsTab';
import { Surface, DeleteModal } from '../../../components';

export const ProductDetail: React.FC = () => {
  const {
    product,
    productTCCSList,
    activeTCCS,
    productFormula,
    batches,
    allProductResults,
    isFetchingAll,
    hasFetchedAll,
    activeTab,
    setActiveTab,
    allQualityCriteriaNames,
    selectedCriteria,
    toggleCriterion,
    selectAllCriteria,
    clearAllCriteria,
    criteriaViewModes,
    toggleCriterionViewMode,
    expandedTables,
    toggleCriterionTable,
    analyticsDataMap,
    metrics,
    isAdmin,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    handleDeleteProduct,
    navigate,
  } = useProductDetail();

  if (!product) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="bg-surface border border-border rounded-2xl p-8 text-center max-w-md w-full space-y-3 shadow-xs">
          <h2 className="text-lg font-bold text-ink">Không tìm thấy sản phẩm</h2>
          <p className="text-sm text-ink-muted">
            Hồ sơ sản phẩm không tồn tại, đã bị xóa hoặc dữ liệu đang được đồng bộ.
          </p>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Quay lại Danh mục Sản phẩm
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <ProductHeader
        product={product}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isAdmin={isAdmin}
        onDeleteClick={() => setIsDeleteModalOpen(true)}
      />

      {/* KPI Metrics */}
      <ProductMetricsCard
        totalBatches={metrics.totalBatches}
        totalTestResults={metrics.totalTestResults}
        passRate={metrics.passRate}
        activeTccsCode={metrics.activeTccsCode}
        lastTestDate={metrics.lastTestDate}
      />

      {/* Tab Panels */}
      <Surface variant="flat" padding="lg" className="min-h-[400px]">
        {activeTab === 'info' && (
          <ProductInfoTab
            product={product}
            productFormula={productFormula}
            activeTCCS={activeTCCS}
            productTCCSList={productTCCSList}
            batches={batches}
            allProductResults={allProductResults}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'formula' && (
          <ProductFormulaTab productFormula={productFormula} isAdmin={isAdmin} />
        )}

        {activeTab === 'tccs' && <ProductTccsTab productTCCSList={productTCCSList} />}

        {activeTab === 'history' && (
          <ProductHistoryTab
            allProductResults={allProductResults}
            batches={batches}
            isFetchingAll={isFetchingAll}
            hasFetchedAll={hasFetchedAll}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'analytics' && (
          <ProductAnalyticsTab
            allQualityCriteriaNames={allQualityCriteriaNames}
            selectedCriteria={selectedCriteria}
            toggleCriterion={toggleCriterion}
            selectAllCriteria={selectAllCriteria}
            clearAllCriteria={clearAllCriteria}
            analyticsDataMap={analyticsDataMap}
            criteriaViewModes={criteriaViewModes}
            toggleCriterionViewMode={toggleCriterionViewMode}
            expandedTables={expandedTables}
            toggleCriterionTable={toggleCriterionTable}
          />
        )}
      </Surface>

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteProduct}
        itemName={product.name}
        warningMessage="Hành động này sẽ xóa toàn bộ liên kết TCCS và dữ liệu liên quan."
      />
    </div>
  );
};

export default ProductDetail;
