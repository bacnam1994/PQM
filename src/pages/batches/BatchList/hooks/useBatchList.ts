import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../../../store/useAppStore';
import { useUIStore } from '../../../../store/useUIStore';
import { useDataGraph } from '../../../../hooks/useDataGraph';
import { useDebounce } from '../../../../hooks/useDebounce';
import { useCrud } from '../../../../hooks/useCrud';
import { Batch, ElectronicSignature } from '../../../../types';
import {
  BATCH_STATUS,
  formatDateStandard,
  parseDateToISO,
  generateId,
  normalizeSearch,
} from '../../../../utils';
import { logAuditAction } from '../../../../services/auditService';
import { fetchTestResultsByBatchId } from '../../../../services/testResultService';
import { ReleaseRules } from '../../../../domain/rules';

export function useBatchList() {
  const navigate = useNavigate();
  const products = useAppStore((s) => s.products);
  const batches = useAppStore((s) => s.batches);
  const tccsList = useAppStore((s) => s.tccsList);
  const addBatch = useAppStore((s) => s.addBatch);
  const deleteBatch = useAppStore((s) => s.deleteBatch);
  const updateBatchStatus = useAppStore((s) => s.updateBatchStatus);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const notify = useAppStore((s) => s.notify);
  const testResults = useAppStore((s) => s.testResults);
  const allTestResults = useAppStore((s) => s.allTestResults);
  const sourceResults = allTestResults && allTestResults.length > 0 ? allTestResults : testResults;
  const user = useAppStore((s) => s.user);

  const { batches: hydratedBatches } = useDataGraph();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const viewMode = useUIStore((s) => s.batchViewMode);
  const setViewMode = useUIStore((s) => s.setBatchViewMode);

  const filterStatus = useUIStore((s) => s.batchFilterStatus);
  const setFilterStatus = useUIStore((s) => s.setBatchFilterStatus);

  const filterYear = useUIStore((s) => s.batchFilterYear);
  const setFilterYear = useUIStore((s) => s.setBatchFilterYear);

  const filterMonth = useUIStore((s) => s.batchFilterMonth);
  const setFilterMonth = useUIStore((s) => s.setBatchFilterMonth);

  const filterProductId = useUIStore((s) => s.batchFilterProductId);
  const setFilterProductId = useUIStore((s) => s.setBatchFilterProductId);

  const sortConfig = useUIStore((s) => s.batchSortConfig);
  const setSortConfig = useUIStore((s) => s.setBatchSortConfig);

  const [currentPage, setCurrentPage] = useState(1);
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const itemsPerPage = 12;

  // Expansion
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  // Status Confirmation & ESignature
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{
    status: string;
    batchId: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [eSignatureTarget, setESignatureTarget] = useState<{
    batchId: string;
    batch?: Batch;
  } | null>(null);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportResultModalOpen, setIsImportResultModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; errors: string[] }>({
    count: 0,
    errors: [],
  });
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const crud = useCrud<Batch>();

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    hydratedBatches.forEach((b) => {
      if (b.mfgDate) {
        years.add(new Date(b.mfgDate).getFullYear().toString());
      }
    });
    return Array.from(years).sort().reverse();
  }, [hydratedBatches]);

  // Lọc dữ liệu
  const filteredBatches = useMemo(() => {
    return hydratedBatches
      .filter((batch) => {
        // Tìm kiếm từ khóa
        if (debouncedSearchTerm) {
          const query = normalizeSearch(debouncedSearchTerm);
          const matchBatchNo = normalizeSearch(batch.batchNo).includes(query);
          const matchProductName = normalizeSearch(batch.product?.name || '').includes(query);
          const matchProductCode = normalizeSearch(batch.product?.code || '').includes(query);
          if (!matchBatchNo && !matchProductName && !matchProductCode) return false;
        }

        // Bộ lọc trạng thái
        if (filterStatus !== 'ALL' && batch.status !== filterStatus) return false;

        // Bộ lọc sản phẩm
        if (filterProductId && batch.productId !== filterProductId) return false;

        // Bộ lọc thời gian
        if (batch.mfgDate) {
          const d = new Date(batch.mfgDate);
          if (filterYear !== 'ALL' && d.getFullYear().toString() !== filterYear) return false;
          if (filterMonth !== 'ALL' && (d.getMonth() + 1).toString() !== filterMonth) return false;
        }

        // Khoảng ngày nâng cao
        if (dateRange.from && batch.mfgDate && batch.mfgDate < dateRange.from) return false;
        if (dateRange.to && batch.mfgDate && batch.mfgDate > dateRange.to) return false;

        return true;
      })
      .sort((a, b) => {
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        if (sortConfig.key === 'createdAt') {
          return (
            (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()) *
            (sortConfig.direction === 'desc' ? 1 : -1)
          );
        }
        if (sortConfig.key === 'mfgDate') {
          return (new Date(a.mfgDate || 0).getTime() - new Date(b.mfgDate || 0).getTime()) * dir;
        }
        if (sortConfig.key === 'batchNo') {
          return a.batchNo.localeCompare(b.batchNo) * dir;
        }
        return 0;
      });
  }, [
    hydratedBatches,
    debouncedSearchTerm,
    filterStatus,
    filterProductId,
    filterYear,
    filterMonth,
    dateRange,
    sortConfig,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredBatches.length / itemsPerPage));
  const currentBatches = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBatches.slice(start, start + itemsPerPage);
  }, [filteredBatches, currentPage, itemsPerPage]);

  const handleEditClick = useCallback(
    (batch: Batch) => {
      navigate(`/batches/edit/${batch.id}`);
    },
    [navigate]
  );

  const handleViewClick = useCallback(
    (batch: Batch) => {
      navigate(`/batches/${batch.id}`);
    },
    [navigate]
  );

  const handleDeleteClick = useCallback(
    (batch: Batch) => {
      crud.openDelete(batch);
    },
    [crud]
  );

  const handleExpandClick = useCallback((id: string) => {
    setExpandedBatchId((prevId) => {
      const isExpanding = prevId !== id;
      if (isExpanding) {
        fetchTestResultsByBatchId(id);
      }
      return isExpanding ? id : null;
    });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (crud.selectedItem) {
      try {
        await deleteBatch(crud.selectedItem.id);
        crud.close();
        notify({
          type: 'SUCCESS',
          title: 'Đã xóa',
          message: `Đã xóa lô ${crud.selectedItem.batchNo}`,
        });
        try {
          logAuditAction({
            action: 'DELETE',
            collection: 'BATCHES',
            documentId: crud.selectedItem.id,
            details: `Xóa lô ID: ${crud.selectedItem.id}`,
            performedBy: user?.email || 'unknown',
          });
        } catch (logErr) {
          console.warn('Ghi log thất bại:', logErr);
        }
      } catch (error) {
        console.error('Failed to delete batch:', error);
      }
    } else {
      crud.close();
    }
  }, [crud, deleteBatch, notify, user]);

  const handleUpdateBatchStatusClick = useCallback(
    (newStatus: string, batchId: string) => {
      if (newStatus === 'RELEASED') {
        const targetBatch = hydratedBatches.find((b) => b.id === batchId);
        if (!targetBatch) return;
        const batchTests = sourceResults.filter((r) => r.batchId === batchId);
        const releaseEval = ReleaseRules.evaluateReleasePrerequisites({
          batch: targetBatch,
          testResults: batchTests,
          userRole: user?.role,
          boundTccs: (targetBatch as any)?.tccs,
        });
        if (!releaseEval.isEligibleForRelease) {
          notify({
            type: 'ERROR',
            title: 'Quy chuẩn GMP & Release Guard',
            message: releaseEval.blockers[0] || 'Không thể duyệt xuất xưởng lô chưa đạt chuẩn GMP.',
          });
          return;
        }
        setESignatureTarget({ batchId, batch: targetBatch });
        return;
      }
      setRejectReason('');
      setPendingStatusUpdate({ status: newStatus, batchId });
      setIsStatusConfirmOpen(true);
    },
    [hydratedBatches, sourceResults, notify, user]
  );

  const handleESignatureSuccess = async (signature: ElectronicSignature) => {
    if (!eSignatureTarget) return;
    try {
      await updateBatchStatus(eSignatureTarget.batchId, 'RELEASED', undefined, signature);
      notify({
        type: 'SUCCESS',
        title: 'Xuất xưởng Lô thành công',
        message: `Đã phê duyệt xuất xưởng Lô ${eSignatureTarget.batch?.batchNo || eSignatureTarget.batchId} với chữ ký điện tử hợp lệ (21 CFR Part 11).`,
      });
    } catch (error: any) {
      console.error('Lỗi xuất xưởng Lô có chữ ký điện tử:', error);
      notify({
        type: 'ERROR',
        title: 'Lỗi xuất xưởng',
        message: error.message || 'Không thể cập nhật trạng thái Lô',
      });
    } finally {
      setESignatureTarget(null);
    }
  };

  const confirmBatchStatusUpdate = async () => {
    if (!pendingStatusUpdate) return;
    try {
      await updateBatchStatus(
        pendingStatusUpdate.batchId,
        pendingStatusUpdate.status as any,
        rejectReason
      );
      notify({
        type: 'SUCCESS',
        title: 'Cập nhật trạng thái',
        message: `Đã chuyển trạng thái lô sang: ${pendingStatusUpdate.status}`,
      });
    } catch (error) {
      console.error('Lỗi cập nhật trạng thái:', error);
      notify({ type: 'ERROR', message: 'Không thể cập nhật trạng thái lô.' });
    } finally {
      setIsStatusConfirmOpen(false);
      setPendingStatusUpdate(null);
    }
  };

  const handleExportExcel = () => {
    if (filteredBatches.length === 0)
      return notify({ type: 'WARNING', message: 'Không có dữ liệu để xuất!' });
    const headers = ['Số Lô', 'Mã SP', 'Tên Sản phẩm', 'Ngày SX', 'Hạn dùng', 'Trạng thái'];
    const rows = filteredBatches.map((b) => [
      b.batchNo,
      b.product?.code || '',
      `"${b.product?.name || ''}"`,
      formatDateStandard(b.mfgDate),
      formatDateStandard(b.expDate),
      b.status === 'RELEASED'
        ? 'Phê duyệt'
        : b.status === 'REJECTED'
          ? 'Từ chối'
          : b.status === 'TESTING'
            ? 'Đang kiểm'
            : 'Kế hoạch',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Danh_sach_lo_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportSubmit = async () => {
    if (!importText.trim()) return;
    setIsSubmitting(true);
    const lines = importText.trim().split('\n');
    let count = 0;
    const errors: string[] = [];
    const processedBatchNos = new Set<string>();

    try {
      const productCodeMap = new Map(products.map((p) => [p.code.toUpperCase(), p]));
      const existingBatchesSet = new Set(batches.map((b) => `${b.productId}-${b.batchNo}`));

      for (const line of lines) {
        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        const pCode = parts[0]?.trim().toUpperCase();
        const batchNo = parts[1]?.trim().toUpperCase();

        if (!pCode || !batchNo) continue;

        const product = productCodeMap.get(pCode);
        if (!product) {
          errors.push(`Không tìm thấy sản phẩm mã "${pCode}" cho lô ${batchNo}`);
          continue;
        }

        const availableTccs = tccsList
          .filter((t) => t.productId === product.id)
          .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());

        if (availableTccs.length === 0) {
          errors.push(`Sản phẩm "${pCode}" chưa có TCCS để gán cho lô ${batchNo}`);
          continue;
        }

        const mfgDateStr = parseDateToISO(parts[2]);
        let assignedTccs = availableTccs[0];
        if (mfgDateStr) {
          const mfgTime = new Date(mfgDateStr).getTime();
          const match = availableTccs.find((t) => new Date(t.issueDate).getTime() <= mfgTime);
          assignedTccs = match || availableTccs[availableTccs.length - 1];
        }

        const compositeKey = `${product.id}-${batchNo}`;
        if (existingBatchesSet.has(compositeKey) || processedBatchNos.has(compositeKey)) {
          errors.push(`Lô "${batchNo}" của sản phẩm "${pCode}" đã tồn tại (hoặc bị trùng lặp)`);
          continue;
        }

        await addBatch({
          id: generateId('batch'),
          productId: product.id,
          tccsId: assignedTccs.id,
          batchNo: batchNo,
          mfgDate: mfgDateStr,
          expDate: parseDateToISO(parts[3]),
          theoreticalYield: 0,
          actualYield: 0,
          yieldUnit: '',
          packaging: '',
          status: BATCH_STATUS.PENDING,
          createdAt: new Date().toISOString(),
        } as any);
        processedBatchNos.add(compositeKey);
        count++;
      }

      if (count > 0) {
        logAuditAction({
          action: 'IMPORT',
          collection: 'BATCHES',
          details: `Nhập khẩu ${count} lô hàng từ Excel`,
          performedBy: user?.email || 'unknown',
        });
      }

      notify({
        type: 'SUCCESS',
        title: 'Nhập liệu hoàn tất',
        message: `Đã nhập thành công ${count} lô hàng.`,
      });
      setImportResult({ count, errors });
      setIsImportResultModalOpen(true);
      setIsImportModalOpen(false);
      setImportText('');
    } catch (e) {
      console.error('Lỗi nhập liệu:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) setImportText(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return {
    products,
    batches,
    hydratedBatches,
    currentBatches,
    filteredBatches,
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
  };
}
