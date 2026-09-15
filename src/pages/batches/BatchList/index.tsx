import React from 'react';
import {
  Square3Stack3DIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ChevronUpDownIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  CalendarDaysIcon,
  XMarkIcon,
  TableCellsIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';
import {
  PageHeader,
  Modal,
  Pagination,
  ConfirmationModal,
  DSFilterBar,
  DSSearchInput,
  DSSelect,
  DSViewToggle,
  DSTable,
  DeleteModal,
  AddButton,
  DSEmptyState,
  VirtualizedTableBody,
} from '../../../components';
import { ESignatureModal } from '../../../components/features/ESignatureModal';
import { BATCH_STATUS } from '../../../utils';
import { useBatchList } from './hooks/useBatchList';
import { BatchGridItem } from './components/BatchGridItem';
import { BatchListItem } from './components/BatchListItem';

export const BatchList: React.FC = () => {
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const {
    products,
    currentBatches,
    sourceResults,
    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    filterStatus,
    setFilterStatus,
    filterYear,
    setFilterYear,
    filterMonth,
    setFilterMonth,
    filterProductId,
    setFilterProductId,
    sortConfig,
    setSortConfig,
    availableYears,
    currentPage,
    setCurrentPage,
    totalPages,
    isAdvancedFilterOpen,
    setIsAdvancedFilterOpen,
    dateRange,
    setDateRange,
    expandedBatchId,
    handleExpandClick,
    handleEditClick,
    handleViewClick,
    handleDeleteClick,
    handleConfirmDelete,
    handleUpdateBatchStatusClick,
    handleESignatureSuccess,
    confirmBatchStatusUpdate,
    handleExportExcel,
    handleImportSubmit,
    handleFileRead,
    isStatusConfirmOpen,
    setIsStatusConfirmOpen,
    pendingStatusUpdate,
    rejectReason,
    setRejectReason,
    eSignatureTarget,
    setESignatureTarget,
    isImportModalOpen,
    setIsImportModalOpen,
    isImportResultModalOpen,
    setIsImportResultModalOpen,
    importText,
    setImportText,
    isSubmitting,
    importResult,
    errorModalOpen,
    setErrorModalOpen,
    errorMessage,
    crud,
    isAdmin,
    navigate,
  } = useBatchList();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <PageHeader
        title="Quản lý Lô & Tồn kho"
        subtitle="Quản lý dòng đời sản phẩm và tiến độ kiểm nghiệm theo GMP."
        icon={Square3Stack3DIcon}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border text-ink rounded-lg hover:bg-surface-2 font-medium text-xs transition-colors shadow-2xs"
            >
              <ArrowDownTrayIcon className="h-4 w-4 text-ink-muted" /> Xuất Excel
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border text-ink rounded-lg hover:bg-surface-2 font-medium text-xs transition-colors shadow-2xs"
            >
              <ArrowUpTrayIcon className="h-4 w-4 text-ink-muted" /> Nhập Excel
            </button>
            <AddButton onClick={() => navigate('/batches/new')} label="Đăng ký Lô mới" />
          </div>
        }
      />

      <DSFilterBar>
        <DSSearchInput
          placeholder="Tìm số lô, tên sản phẩm..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
        />

        {!isAdvancedFilterOpen && (
          <>
            <DSSelect
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-32"
            >
              <option value="ALL">Tất cả năm</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  Năm {year}
                </option>
              ))}
            </DSSelect>
            <DSSelect
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-32"
            >
              <option value="ALL">Tất cả tháng</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month.toString()}>
                  Tháng {month}
                </option>
              ))}
            </DSSelect>
          </>
        )}
        <DSSelect
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="w-36"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value={BATCH_STATUS.PENDING}>Kế hoạch</option>
          <option value={BATCH_STATUS.TESTING}>Đang kiểm</option>
          <option value={BATCH_STATUS.RELEASED}>Phê duyệt</option>
          <option value={BATCH_STATUS.REJECTED}>Loại bỏ</option>
        </DSSelect>
        <DSSelect
          icon={ChevronUpDownIcon}
          value={`${sortConfig.key}-${sortConfig.direction}`}
          onChange={(e) => {
            const [key, direction] = e.target.value.split('-');
            setSortConfig({ key: key as any, direction: direction as any });
          }}
          className="w-36"
        >
          <option value="createdAt-desc">Mới tạo nhất</option>
          <option value="mfgDate-desc">Ngày SX (Mới)</option>
          <option value="mfgDate-asc">Ngày SX (Cũ)</option>
          <option value="batchNo-asc">Số lô (A-Z)</option>
          <option value="batchNo-desc">Số lô (Z-A)</option>
        </DSSelect>

        <button
          onClick={() => setIsAdvancedFilterOpen(!isAdvancedFilterOpen)}
          className={`p-2 rounded-xl border transition-colors ${isAdvancedFilterOpen ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-surface border-border text-ink-muted hover:text-ink hover:bg-surface-2'}`}
          title="Lọc nâng cao"
        >
          <FunnelIcon className="h-4 w-4" />
        </button>

        <DSViewToggle
          viewMode={viewMode}
          setViewMode={setViewMode}
          gridIcon={Squares2X2Icon}
          listIcon={ListBulletIcon}
        />
      </DSFilterBar>

      {isAdvancedFilterOpen && (
        <div className="bg-surface p-4 rounded-xl border border-border shadow-xs grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-muted flex items-center gap-1">
              <CalendarDaysIcon className="h-3.5 w-3.5" /> Từ ngày (SX)
            </label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-muted flex items-center gap-1">
              <CalendarDaysIcon className="h-3.5 w-3.5" /> Đến ngày (SX)
            </label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-ink-muted">Sản phẩm cụ thể</label>
              <button
                onClick={() => {
                  setDateRange({ from: '', to: '' });
                  setFilterProductId('');
                  setFilterStatus('ALL' as any);
                }}
                className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
              >
                <XMarkIcon className="h-3 w-3" /> Xóa bộ lọc
              </button>
            </div>
            <select
              value={filterProductId}
              onChange={(e) => setFilterProductId(e.target.value)}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="" className="bg-surface text-ink">
                -- Tất cả sản phẩm --
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id} className="bg-surface text-ink">
                  {p.name} - {p.code}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {currentBatches.length === 0 ? (
        <DSEmptyState
          icon={ArchiveBoxIcon}
          title="Không tìm thấy lô hàng"
          message="Không có lô hàng nào khớp với điều kiện tìm kiếm hoặc bộ lọc hiện tại của bạn."
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {currentBatches.map((batch) => (
            <BatchGridItem
              key={batch.id}
              batch={batch}
              isExpanded={expandedBatchId === batch.id}
              onExpand={handleExpandClick}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              onView={handleViewClick}
              testResults={sourceResults}
              onUpdateBatchStatus={handleUpdateBatchStatusClick}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      ) : (
        <div
          ref={tableContainerRef}
          className="overflow-x-auto max-h-[720px] overflow-y-auto rounded-xl"
        >
          <DSTable>
            <thead className="bg-surface-2/60 border-b border-border sticky top-0 z-10 backdrop-blur-xs">
              <tr className="text-ink-muted text-xs font-semibold">
                <th className="px-4 py-3 text-left">Số lô</th>
                <th className="px-4 py-3 text-left">Sản phẩm</th>
                <th className="px-4 py-3 text-left">Ngày SX / Hạn dùng</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <VirtualizedTableBody
              items={currentBatches}
              parentRef={tableContainerRef}
              estimateSize={64}
              colSpan={5}
              renderRow={(batch) => (
                <BatchListItem
                  key={batch.id}
                  batch={batch}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                  onView={handleViewClick}
                  onUpdateBatchStatus={handleUpdateBatchStatusClick}
                  isAdmin={isAdmin}
                  testResults={sourceResults}
                />
              )}
            />
          </DSTable>
        </div>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {/* Modal Nhập Excel hàng loạt */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Nhập dữ liệu hàng loạt"
        icon={TableCellsIcon}
        color="bg-emerald-600"
      >
        <div className="space-y-6">
          <div className="bg-emerald-50 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
            <h4 className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] uppercase tracking-wider mb-3">
              <InformationCircleIcon className="h-4 w-4" /> Hướng dẫn xếp cột (Excel/Google Sheets)
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-3 leading-relaxed">
              Bạn có thể copy trực tiếp các vùng dữ liệu từ Excel và dán vào ô bên dưới. Hệ thống sẽ
              tự nhận diện theo thứ tự các cột như sau:
            </p>
            <div className="grid grid-cols-1 gap-2">
              {[
                '1. Mã Sản phẩm (Bắt buộc - Phải tồn tại)',
                '2. Số Lô (Bắt buộc)',
                '3. Ngày SX (YYYY-MM-DD)',
                '4. Hạn dùng (YYYY-MM-DD)',
              ].map((txt, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 bg-surface/60 px-3 py-1.5 rounded-lg border border-emerald-100/50 dark:border-emerald-900/30"
                >
                  <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />{' '}
                  {txt}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-emerald-200/50 dark:border-emerald-900/30">
              <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1.5">
                Ví dụ dữ liệu chuẩn:
              </p>
              <code className="block p-2.5 bg-surface rounded-lg text-[10px] text-ink font-mono border border-border">
                VB-001, B010124, 2024-01-01, 2027-01-01
              </code>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileRead}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button className="px-3.5 py-2 bg-surface-2 hover:bg-surface-3 text-ink-soft rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors border border-border">
                <ArrowUpTrayIcon className="h-4 w-4" /> Tải lên file CSV/TXT
              </button>
            </div>
            <p className="text-[10px] text-ink-muted italic">
              Hỗ trợ file văn bản (.txt, .csv) ngăn cách bởi dấu phẩy hoặc tab.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-ink-muted uppercase tracking-wider pl-1">
              Dán dữ liệu vào đây
            </label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={7}
              className="w-full p-4 bg-surface-2 border border-dashed border-border rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-ink"
              placeholder="Copy từ Excel và dán tại đây..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsImportModalOpen(false)}
              className="px-5 py-2.5 text-ink-soft hover:text-ink font-semibold text-xs rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleImportSubmit}
              disabled={!importText.trim() || isSubmitting}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-bold uppercase text-xs hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-colors"
            >
              {isSubmitting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
              Tiến hành nhập
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Xác nhận xóa */}
      <DeleteModal
        isOpen={crud.mode === 'DELETE'}
        onClose={crud.close}
        onConfirm={handleConfirmDelete}
        itemName={crud.selectedItem?.batchNo}
        warningMessage="Tất cả kết quả kiểm nghiệm liên quan cũng sẽ bị xóa. Hành động này không thể hoàn tác."
      />

      {/* Modal Kết quả Nhập Excel */}
      <Modal
        isOpen={isImportResultModalOpen}
        onClose={() => setIsImportResultModalOpen(false)}
        title="Kết quả nhập hàng loạt"
        icon={InformationCircleIcon}
      >
        <div>
          <p className="text-ink text-sm">
            Đã nhập thành công <strong className="text-emerald-600">{importResult.count}</strong> lô
            hàng.
          </p>
          {importResult.errors.length > 0 && (
            <div className="mt-4">
              <p className="font-semibold text-xs text-rose-600 mb-1">
                Lỗi phát hiện ({importResult.errors.length}):
              </p>
              <ul className="list-disc list-inside max-h-40 overflow-y-auto bg-surface-2 p-3 rounded-lg border border-border space-y-1">
                {importResult.errors.map((error, index) => (
                  <li key={index} className="text-rose-600 text-xs">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={() => setIsImportResultModalOpen(false)}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-bold uppercase text-xs hover:bg-emerald-700 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Lỗi */}
      <Modal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Lỗi"
        icon={ExclamationTriangleIcon}
      >
        <div>
          <p className="text-ink text-sm">{errorMessage}</p>
          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={() => setErrorModalOpen(false)}
              className="px-6 py-2.5 bg-rose-600 text-white rounded-lg font-bold uppercase text-xs hover:bg-rose-700 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Xác nhận đổi trạng thái */}
      <ConfirmationModal
        isOpen={isStatusConfirmOpen}
        onClose={() => setIsStatusConfirmOpen(false)}
        onConfirm={confirmBatchStatusUpdate}
        title="Xác nhận chuyển trạng thái"
        message={
          <div className="space-y-3">
            <p className="text-ink text-sm">
              Bạn có chắc chắn muốn chuyển trạng thái lô hàng sang{' '}
              <strong className="text-emerald-600">
                {pendingStatusUpdate?.status === 'RELEASED'
                  ? 'PHÊ DUYỆT'
                  : pendingStatusUpdate?.status === 'REJECTED'
                    ? 'TỪ CHỐI'
                    : pendingStatusUpdate?.status}
              </strong>{' '}
              không?
            </p>
            {pendingStatusUpdate?.status === 'REJECTED' && (
              <div>
                <label className="text-xs font-semibold text-ink-muted block mb-1">
                  Lý do từ chối:
                </label>
                <textarea
                  className="w-full border border-border rounded-lg p-3 text-xs bg-surface-2 text-ink focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Nhập lý do từ chối..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
        }
        confirmText="Đồng ý"
        icon={ShieldCheckIcon}
      />

      {/* Modal Ký duyệt Điện tử (FDA 21 CFR Part 11) cho Xuất xưởng Lô */}
      {eSignatureTarget && (
        <ESignatureModal
          isOpen={!!eSignatureTarget}
          onClose={() => setESignatureTarget(null)}
          documentType="BATCH_RELEASE"
          documentId={eSignatureTarget.batchId}
          documentTitle={`Lô sản xuất: ${eSignatureTarget.batch?.batchNo || eSignatureTarget.batchId}${(eSignatureTarget.batch as any)?.product?.name ? ` - ${(eSignatureTarget.batch as any).product.name}` : ''}`}
          documentVersion={eSignatureTarget.batch?.version}
          onSuccess={handleESignatureSuccess}
        />
      )}
    </div>
  );
};

export default BatchList;
