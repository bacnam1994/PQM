import React from 'react';
import {
  IdentificationIcon,
  SparklesIcon,
  PlusIcon,
  BeakerIcon,
  ShieldCheckIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { PageHeader, Pagination, Modal } from '../../../components';
import { Surface } from '../../../components/ui';
import { COMMON_PHARMA_STANDARDS } from '../MaterialFormPage';
import { useMaterialListState } from './hooks/useMaterialListState';
import { MaterialMetricsBar } from './components/MaterialMetricsBar';
import { MaterialFilterSection } from './components/MaterialFilterSection';
import { MaterialCatalogTable } from './components/MaterialCatalogTable';
import { MaterialMatrixTable } from './components/MaterialMatrixTable';
import { MaterialConsistencyView } from './components/MaterialConsistencyView';
import { MaterialEditModal } from './components/MaterialEditModal';
import { MaterialHarmonizerModal } from './components/MaterialHarmonizerModal';

export const MaterialListPage: React.FC = () => {
  const state = useMaterialListState();

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-200">
      <datalist id="standards-datalist">
        {COMMON_PHARMA_STANDARDS.map(s => <option key={s} value={s} />)}
      </datalist>

      {/* Page Header */}
      <PageHeader 
        title="Quản lý Nguyên liệu & Thành phần" 
        subtitle="Trung tâm Quản lý Danh mục Nguyên liệu chuẩn (Master Catalog), Tiêu chuẩn Dược điển, Ma trận Công thức và Rà soát AI"
        icon={IdentificationIcon}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={state.handleOpenHarmonizer}
              className="px-3.5 py-2 bg-surface hover:bg-surface-2 text-ink border border-border rounded-lg text-xs font-medium flex items-center gap-2 transition-colors shadow-2xs cursor-pointer"
            >
              <SparklesIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>AI rà soát & chuẩn hóa</span>
            </button>
            {state.isAdmin && (
              <button
                type="button"
                onClick={() => state.handleOpenAdd()}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-lg text-xs font-medium flex items-center gap-2 transition-all shadow-2xs cursor-pointer"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Thêm nguyên liệu</span>
              </button>
            )}
          </div>
        }
      />

      {/* Metrics Banner */}
      <MaterialMetricsBar metrics={state.metrics} />

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-border pb-2 overflow-x-auto scrollbar-hide">
        <button
          type="button"
          onClick={() => state.setActiveTab('CATALOG')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            state.activeTab === 'CATALOG'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-surface-2'
          }`}
        >
          <IdentificationIcon className="h-4 w-4" />
          <span>Danh mục chuẩn ({state.rawMaterials.length})</span>
        </button>

        <button
          type="button"
          onClick={() => state.setActiveTab('MATRIX')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            state.activeTab === 'MATRIX'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-surface-2'
          }`}
        >
          <BeakerIcon className="h-4 w-4" />
          <span>Ma trận công thức ({state.aggregatedFormulaItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => state.setActiveTab('CONSISTENCY')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            state.activeTab === 'CONSISTENCY'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-surface-2'
          }`}
        >
          <ShieldCheckIcon className="h-4 w-4" />
          <span>Toàn vẹn & Auto-Link</span>
          {state.metrics.unlinkedIngredients > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[11px] font-medium">
              {state.metrics.unlinkedIngredients}
            </span>
          )}
        </button>
      </div>

      {/* Filter Bar */}
      <MaterialFilterSection
        activeTab={state.activeTab}
        searchTerm={state.searchTerm}
        setSearchTerm={state.setSearchTerm}
        filterCategory={state.filterCategory}
        setFilterCategory={state.setFilterCategory}
        filterStandard={state.filterStandard}
        setFilterStandard={state.setFilterStandard}
        filterUsage={state.filterUsage}
        setFilterUsage={state.setFilterUsage}
        filterProductId={state.filterProductId}
        setFilterProductId={state.setFilterProductId}
        products={state.products}
        viewMode={state.viewMode}
        setViewMode={state.setViewMode}
      />

      {/* Tab 1: Catalog */}
      {state.activeTab === 'CATALOG' && (
        <MaterialCatalogTable
          viewMode={state.viewMode}
          paginatedItems={state.paginatedItems as any}
          hydratedMap={state.hydratedMap}
          isAdmin={state.isAdmin}
          onEdit={state.handleOpenEdit}
          onDelete={state.crud.openDelete}
          filteredCatalogLength={state.filteredCatalog.length}
        />
      )}

      {/* Tab 2: Formula Matrix */}
      {state.activeTab === 'MATRIX' && (
        <MaterialMatrixTable
          paginatedItems={state.paginatedItems as any}
          materialMap={state.materialMap}
          isAdmin={state.isAdmin}
          onOpenAdd={state.handleOpenAdd}
          onOpenEdit={state.handleOpenEdit}
        />
      )}

      {/* Tab 3: Consistency & Auto-link */}
      {state.activeTab === 'CONSISTENCY' && (
        <MaterialConsistencyView
          metrics={state.metrics}
          aggregatedFormulaItems={state.aggregatedFormulaItems}
          materialMap={state.materialMap}
          rawMaterials={state.rawMaterials}
          onAutoLink={state.handleAutoLinkFormulaItem}
          onOpenAdd={state.handleOpenAdd}
        />
      )}

      {/* Pagination */}
      {state.totalPages > 1 && (
        <Pagination 
          currentPage={state.currentPage} 
          totalPages={state.totalPages} 
          onPageChange={state.setCurrentPage} 
        />
      )}

      {/* Modal: Thêm / Sửa nguyên liệu */}
      <MaterialEditModal
        isOpen={state.crud.mode === 'ADD' || state.crud.mode === 'EDIT'}
        onClose={state.crud.close}
        mode={state.crud.mode}
        selectedItem={state.crud.selectedItem}
        hydratedMap={state.hydratedMap}
        productFormulas={state.productFormulas}
        formCode={state.formCode}
        setFormCode={state.setFormCode}
        formName={state.formName}
        setFormName={state.setFormName}
        formCategory={state.formCategory}
        setFormCategory={state.setFormCategory}
        formStandard={state.formStandard}
        setFormStandard={state.setFormStandard}
        formCasNumber={state.formCasNumber}
        setFormCasNumber={state.setFormCasNumber}
        formCasError={state.formCasError}
        setFormCasError={state.setFormCasError}
        formAliases={state.formAliases}
        formAliasInput={state.formAliasInput}
        setFormAliasInput={state.setFormAliasInput}
        formDescription={state.formDescription}
        setFormDescription={state.setFormDescription}
        duplicateWarnings={state.duplicateWarnings}
        checkDuplicateNames={state.checkDuplicateNames}
        handleAddAlias={state.handleAddAlias}
        removeAlias={state.removeAlias}
        handleAliasKeyDown={state.handleAliasKeyDown}
        handlePasteAlias={state.handlePasteAlias}
        handleSaveMaterial={state.handleSaveMaterial}
        isSubmitting={state.isSubmitting}
      />

      {/* Modal: AI Harmonizer */}
      <MaterialHarmonizerModal
        isOpen={state.isHarmonizerOpen}
        onClose={() => state.setIsHarmonizerOpen(false)}
        isAnalyzingHarmonization={state.isAnalyzingHarmonization}
        harmonizationReport={state.harmonizationReport}
        executingMergeGroupId={state.executingMergeGroupId}
        handleExecuteMerge={state.handleExecuteMerge}
      />

      {/* Modal: Xóa nguyên liệu */}
      {state.crud.selectedItem && (
        <Modal
          isOpen={state.crud.mode === 'DELETE'}
          onClose={state.crud.close}
          title="Xác nhận Xóa Nguyên liệu"
          icon={TrashIcon}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-zinc-300">
              Bạn có chắc chắn muốn xóa nguyên liệu <strong>"{state.crud.selectedItem.name}"</strong> khỏi Master Catalog?
            </p>
            {state.hydratedMap.get(state.crud.selectedItem.id)?.usedInProducts?.length ? (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-400 font-medium">
                ⚠️ Cảnh báo: Nguyên liệu này đang được sử dụng trong {state.hydratedMap.get(state.crud.selectedItem.id)?.usedInProducts.length} sản phẩm. Xóa nguyên liệu sẽ làm mất liên kết trong các công thức sản phẩm đó.
              </div>
            ) : null}

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-zinc-850">
              <button
                type="button"
                onClick={state.crud.close}
                className="px-4 py-2 text-slate-500 font-bold uppercase text-xs hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={state.handleDeleteMaterial}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold uppercase text-xs shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Xác nhận Xóa
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
