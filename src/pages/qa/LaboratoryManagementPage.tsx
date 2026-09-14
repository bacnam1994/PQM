import React, { useState, useMemo } from 'react';
import {
  BuildingOffice2Icon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  SparklesIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  TagIcon,
  CheckIcon,
  Squares2X2Icon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { TestingLaboratory, LabType } from '../../types/laboratory';
import {
  DEFAULT_TESTING_LABORATORIES,
  detectUnmappedTestResults,
  UnmappedLabDetectionResult,
} from '../../services/laboratoryService';
import {
  PageHeader,
  DSCard,
  DSFilterBar,
  DSSearchInput,
  DSSelect,
  DSViewToggle,
  DSTable,
  Modal,
  ConfirmationModal,
  DSEmptyState,
} from '../../components';
import { formatDateStandard } from '../../utils';
import toast from 'react-hot-toast';

export const LaboratoryManagementPage: React.FC = () => {
  const {
    testingLaboratories,
    testResults,
    allTestResults,
    batches,
    role,
    isAdmin,
    addTestingLaboratory,
    updateTestingLaboratory,
    deleteTestingLaboratory,
    updateTestResult,
  } = useAppStore(
    useShallow((s) => ({
      testingLaboratories: s.testingLaboratories,
      testResults: s.testResults,
      allTestResults: s.allTestResults,
      batches: s.batches,
      role: s.role,
      isAdmin: s.isAdmin,
      addTestingLaboratory: s.addTestingLaboratory,
      updateTestingLaboratory: s.updateTestingLaboratory,
      deleteTestingLaboratory: s.deleteTestingLaboratory,
      updateTestResult: s.updateTestResult,
    }))
  );

  const canManage = isAdmin || role === 'QA';

  // Danh mục phòng lab
  const laboratories = useMemo<TestingLaboratory[]>(() => {
    return Array.isArray(testingLaboratories) && testingLaboratories.length > 0
      ? testingLaboratories
      : DEFAULT_TESTING_LABORATORIES;
  }, [testingLaboratories]);

  // Danh sách toàn bộ kết quả kiểm nghiệm để tính thống kê và chuẩn hóa
  const combinedTestResults = useMemo(() => {
    const list = [...(allTestResults || []), ...(testResults || [])];
    const uniqueMap = new Map<string, any>();
    list.forEach((r) => {
      if (r?.id) uniqueMap.set(r.id, r);
    });
    return Array.from(uniqueMap.values());
  }, [allTestResults, testResults]);

  // Tính số lượng phiếu kiểm nghiệm liên kết theo từng lab
  const labUsageStats = useMemo(() => {
    const stats: Record<string, { total: number; pass: number; fail: number }> = {};
    laboratories.forEach((l) => {
      stats[l.id] = { total: 0, pass: 0, fail: 0 };
    });

    combinedTestResults.forEach((tr) => {
      if (tr.labId && stats[tr.labId]) {
        stats[tr.labId].total += 1;
        if (tr.overallStatus === 'PASS') stats[tr.labId].pass += 1;
        else stats[tr.labId].fail += 1;
      }
    });

    return stats;
  }, [laboratories, combinedTestResults]);

  // Quét các phiếu kiểm nghiệm chưa chuẩn hóa
  const unmappedResults = useMemo<UnmappedLabDetectionResult[]>(() => {
    return detectUnmappedTestResults(combinedTestResults, laboratories, batches);
  }, [combinedTestResults, laboratories, batches]);

  // State Tabs: 'LIST' | 'UNMAPPED'
  const [activeTab, setActiveTab] = useState<'LIST' | 'UNMAPPED'>('LIST');

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | LabType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Modal State: Create / Edit
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingLab, setEditingLab] = useState<TestingLaboratory | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    canonicalName: '',
    type: 'EXTERNAL' as LabType,
    aliasesText: '',
    description: '',
    isActive: true,
  });

  // Modal State: Delete
  const [labToDelete, setLabToDelete] = useState<TestingLaboratory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal State: Quick Seed
  const [isSeeding, setIsSeeding] = useState(false);

  // State cho dropdown chọn Lab khi chuẩn hóa từng phiếu
  const [selectedMappingLab, setSelectedMappingLab] = useState<Record<string, string>>({});

  // Lọc danh sách Lab theo bộ lọc
  const filteredLabs = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();

    return laboratories.filter((lab) => {
      if (typeFilter !== 'ALL' && lab.type !== typeFilter) return false;
      if (statusFilter === 'ACTIVE' && lab.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && lab.isActive !== false) return false;

      if (!query) return true;

      const inCode = lab.code.toLowerCase().includes(query);
      const inName = lab.canonicalName.toLowerCase().includes(query);
      const inAliases =
        Array.isArray(lab.aliases) && lab.aliases.some((a) => a.toLowerCase().includes(query));
      const inDesc = (lab.description || '').toLowerCase().includes(query);

      return inCode || inName || inAliases || inDesc;
    });
  }, [laboratories, searchTerm, typeFilter, statusFilter]);

  // Khởi tạo form thêm mới
  const handleOpenAddModal = (presetName = '') => {
    setEditingLab(null);
    setFormData({
      code: '',
      canonicalName: presetName,
      type: 'EXTERNAL',
      aliasesText: presetName ? presetName : '',
      description: '',
      isActive: true,
    });
    setIsFormModalOpen(true);
  };

  // Khởi tạo form chỉnh sửa
  const handleOpenEditModal = (lab: TestingLaboratory) => {
    setEditingLab(lab);
    setFormData({
      code: lab.code,
      canonicalName: lab.canonicalName,
      type: lab.type,
      aliasesText: Array.isArray(lab.aliases) ? lab.aliases.join(', ') : '',
      description: lab.description || '',
      isActive: lab.isActive !== false,
    });
    setIsFormModalOpen(true);
  };

  // Lưu Form (Tạo mới / Cập nhật)
  const handleSaveLab = async (e: React.FormEvent) => {
    e.preventDefault();

    const code = formData.code.trim().toUpperCase();
    const canonicalName = formData.canonicalName.trim();

    if (!code) {
      toast.error('Vui lòng nhập mã đơn vị!');
      return;
    }
    if (!canonicalName) {
      toast.error('Vui lòng nhập tên chuẩn hóa của đơn vị!');
      return;
    }

    // Tách aliases từ chuỗi
    const aliases = formData.aliasesText
      .split(/[,;\n]/)
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    // Kiểm tra trùng mã code
    const isCodeDuplicated = laboratories.some(
      (l) => l.code.toUpperCase() === code && (!editingLab || l.id !== editingLab.id)
    );
    if (isCodeDuplicated) {
      toast.error(`Mã đơn vị "${code}" đã tồn tại trên hệ thống!`);
      return;
    }

    try {
      const now = new Date().toISOString();

      if (editingLab) {
        // Cập nhật
        const updatedLab: TestingLaboratory = {
          ...editingLab,
          code,
          canonicalName,
          type: formData.type,
          aliases,
          description: formData.description.trim(),
          isActive: formData.isActive,
          updatedAt: now,
        };
        await updateTestingLaboratory(updatedLab);
        toast.success(`Đã cập nhật đơn vị "${canonicalName}"`);
      } else {
        // Tạo mới
        const id = `lab_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;
        const newLab: TestingLaboratory = {
          id,
          code,
          canonicalName,
          type: formData.type,
          aliases,
          description: formData.description.trim(),
          isActive: formData.isActive,
          createdAt: now,
        };
        await addTestingLaboratory(newLab);
        toast.success(`Đã thêm mới đơn vị "${canonicalName}"`);
      }

      setIsFormModalOpen(false);
    } catch (err: any) {
      toast.error(`Lỗi lưu dữ liệu: ${err.message}`);
    }
  };

  // Bật/Tắt hoạt động
  const handleToggleActive = async (lab: TestingLaboratory) => {
    if (!canManage) return;
    try {
      const updated: TestingLaboratory = {
        ...lab,
        isActive: lab.isActive === false ? true : false,
        updatedAt: new Date().toISOString(),
      };
      await updateTestingLaboratory(updated);
      toast.success(
        updated.isActive
          ? `Đã kích hoạt đơn vị "${lab.canonicalName}"`
          : `Đã tạm dừng đơn vị "${lab.canonicalName}"`
      );
    } catch (err: any) {
      toast.error(`Lỗi thay đổi trạng thái: ${err.message}`);
    }
  };

  // Xóa Lab
  const handleConfirmDelete = async () => {
    if (!labToDelete || !canManage) return;
    setIsDeleting(true);
    try {
      await deleteTestingLaboratory(labToDelete.id);
      toast.success(`Đã xóa đơn vị "${labToDelete.canonicalName}"`);
      setLabToDelete(null);
    } catch (err: any) {
      toast.error(`Lỗi xóa đơn vị: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Khôi phục nạp nhanh danh mục mẫu mặc định
  const handleSeedDefaults = async () => {
    if (!canManage) return;
    setIsSeeding(true);
    try {
      let addedCount = 0;
      for (const defLab of DEFAULT_TESTING_LABORATORIES) {
        const exists = laboratories.some(
          (l) => l.code.toUpperCase() === defLab.code.toUpperCase() || l.id === defLab.id
        );
        if (!exists) {
          await addTestingLaboratory(defLab);
          addedCount++;
        }
      }
      if (addedCount > 0) {
        toast.success(`Đã bổ sung ${addedCount} đơn vị kiểm nghiệm chuẩn mẫu!`);
      } else {
        toast.success('Danh mục đơn vị kiểm nghiệm chuẩn đã đầy đủ.');
      }
    } catch (err: any) {
      toast.error(`Lỗi nạp danh mục: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  // Chuẩn hóa 1 phiếu kiểm nghiệm đơn lẻ
  const handleNormalizeSingleResult = async (
    item: UnmappedLabDetectionResult,
    targetLabId?: string
  ) => {
    const labIdToUse = targetLabId || selectedMappingLab[item.testResultId] || item.matchedLab?.id;
    if (!labIdToUse) {
      toast.error('Vui lòng chọn đơn vị kiểm nghiệm chuẩn!');
      return;
    }

    const labObj = laboratories.find((l) => l.id === labIdToUse);
    if (!labObj) {
      toast.error('Đơn vị được chọn không hợp lệ!');
      return;
    }

    const targetTestResult = combinedTestResults.find((r) => r.id === item.testResultId);
    if (!targetTestResult) {
      toast.error('Không tìm thấy phiếu kiểm nghiệm trong hệ thống!');
      return;
    }

    try {
      const updatedResult = {
        ...targetTestResult,
        labId: labObj.id,
        labName: labObj.canonicalName,
        updatedAt: new Date().toISOString(),
      };
      await updateTestResult(updatedResult);
      toast.success(`Đã chuẩn hóa phiếu ${item.batchNo} sang đơn vị "${labObj.canonicalName}"`);
    } catch (err: any) {
      toast.error(`Lỗi chuẩn hóa phiếu: ${err.message}`);
    }
  };

  // Chuẩn hóa hàng loạt các phiếu có gợi ý tin cậy cao (EXACT hoặc ALIAS hoặc SUBSTRING)
  const handleBatchNormalizeHighConfidence = async () => {
    const candidates = unmappedResults.filter(
      (r) =>
        r.matchedLab &&
        (r.confidence === 'EXACT' || r.confidence === 'ALIAS' || r.similarity >= 0.9)
    );

    if (candidates.length === 0) {
      toast('Không có phiếu nào có độ tin cậy cao để tự động chuẩn hóa.');
      return;
    }

    const confirmed = window.confirm(
      `Bạn có chắc muốn tự động chuẩn hóa ${candidates.length} phiếu kiểm nghiệm có độ tin cậy cao?`
    );
    if (!confirmed) return;

    let successCount = 0;
    for (const item of candidates) {
      if (!item.matchedLab) continue;
      const targetTestResult = combinedTestResults.find((r) => r.id === item.testResultId);
      if (!targetTestResult) continue;

      try {
        await updateTestResult({
          ...targetTestResult,
          labId: item.matchedLab.id,
          labName: item.matchedLab.canonicalName,
          updatedAt: new Date().toISOString(),
        });
        successCount++;
      } catch (e) {
        console.warn('Lỗi chuẩn hóa phiếu:', item.testResultId, e);
      }
    }

    toast.success(`Đã tự động chuẩn hóa thành công ${successCount} phiếu kiểm nghiệm!`);
  };

  // KPIs
  const totalLabs = laboratories.length;
  const externalLabs = laboratories.filter((l) => l.type === 'EXTERNAL').length;
  const internalLabs = laboratories.filter((l) => l.type === 'INTERNAL').length;
  const activeLabs = laboratories.filter((l) => l.isActive !== false).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <PageHeader
        title="Quản lý Đơn vị Kiểm nghiệm"
        subtitle="Danh mục đơn vị / phòng kiểm nghiệm chuẩn hóa (Nội bộ & Ngoại kiểm), quản lý bí danh phục vụ OCR AI và chuẩn hóa dữ liệu."
        icon={BuildingOffice2Icon}
        action={
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={handleSeedDefaults}
                  disabled={isSeeding}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-surface text-ink-soft hover:text-ink hover:bg-surface-2 transition-colors text-xs font-semibold uppercase tracking-wider shadow-xs disabled:opacity-50"
                  title="Khôi phục danh mục chuẩn mặc định (Quatest 3, CASE, NIFC, Eurofins, Pasteur, Phòng QC)"
                >
                  <ArrowPathIcon className={`w-4 h-4 ${isSeeding ? 'animate-spin' : ''}`} />
                  <span>Nạp Lab chuẩn</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenAddModal()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs uppercase tracking-wider shadow-sm hover:shadow transition-all"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Thêm đơn vị</span>
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DSCard className="p-4 bg-surface border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Tổng số đơn vị
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <BuildingOffice2Icon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{totalLabs}</span>
            <span className="text-xs text-ink-muted">({activeLabs} đang hoạt động)</span>
          </div>
        </DSCard>

        <DSCard className="p-4 bg-surface border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Ngoại kiểm (External)
            </span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <BuildingOffice2Icon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {externalLabs}
            </span>
            <span className="text-xs text-ink-muted">đơn vị độc lập</span>
          </div>
        </DSCard>

        <DSCard className="p-4 bg-surface border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Nội bộ (Internal)
            </span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <BuildingOffice2Icon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {internalLabs}
            </span>
            <span className="text-xs text-ink-muted">phòng QC/QA nội bộ</span>
          </div>
        </DSCard>

        <div
          className="cursor-pointer"
          onClick={() => {
            if (unmappedResults.length > 0) setActiveTab('UNMAPPED');
          }}
        >
          <DSCard
            className={`p-4 bg-surface border transition-all ${
              unmappedResults.length > 0
                ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500'
                : 'border-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                Chờ chuẩn hóa
              </span>
              <div
                className={`p-2 rounded-lg ${
                  unmappedResults.length > 0
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    : 'bg-surface-2 text-ink-muted'
                }`}
              >
                <SparklesIcon className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold ${
                  unmappedResults.length > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-ink-soft'
                }`}
              >
                {unmappedResults.length}
              </span>
              <span className="text-xs text-ink-muted">phiếu kiểm nghiệm</span>
            </div>
          </DSCard>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('LIST')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
            activeTab === 'LIST'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-ink-muted hover:text-ink hover:bg-surface-2'
          }`}
        >
          <BuildingOffice2Icon className="w-4 h-4" />
          <span>Danh mục Đơn vị ({laboratories.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('UNMAPPED')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
            activeTab === 'UNMAPPED'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-ink-muted hover:text-ink hover:bg-surface-2'
          }`}
        >
          <SparklesIcon className="w-4 h-4" />
          <span>Rà soát & Chuẩn hóa</span>
          {unmappedResults.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white">
              {unmappedResults.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: DANH MỤC ĐƠN VỊ KIỂM NGHIỆM */}
      {activeTab === 'LIST' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <DSFilterBar>
            <div className="flex-1 min-w-[240px]">
              <DSSearchInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClear={() => setSearchTerm('')}
                placeholder="Tìm kiếm theo mã, tên, bí danh..."
              />
            </div>

            <div className="w-44">
              <DSSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
                <option value="ALL">Tất cả phân loại</option>
                <option value="EXTERNAL">Ngoại kiểm (External)</option>
                <option value="INTERNAL">Nội bộ (Internal)</option>
              </DSSelect>
            </div>

            <div className="w-40">
              <DSSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Tạm dừng</option>
              </DSSelect>
            </div>

            <DSViewToggle
              viewMode={viewMode}
              setViewMode={setViewMode}
              gridIcon={Squares2X2Icon}
              listIcon={ListBulletIcon}
            />
          </DSFilterBar>

          {/* Labs List / Grid */}
          {filteredLabs.length === 0 ? (
            <div className="space-y-3">
              <DSEmptyState
                icon={BuildingOffice2Icon}
                title="Không tìm thấy đơn vị kiểm nghiệm nào"
                message="Thử thay đổi bộ lọc tìm kiếm hoặc nạp danh mục đơn vị chuẩn mẫu."
              />
              {canManage && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold uppercase tracking-wider hover:bg-emerald-700 transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Thêm đơn vị mới
                  </button>
                </div>
              )}
            </div>
          ) : viewMode === 'list' ? (
            <DSTable>
              <thead className="bg-surface-2/60 border-b border-border text-xs font-semibold text-ink-muted">
                <tr>
                  <th className="px-4 py-3 text-left w-28">Mã</th>
                  <th className="px-4 py-3 text-left">Tên đơn vị chuẩn hóa</th>
                  <th className="px-4 py-3 text-center w-28">Phân loại</th>
                  <th className="px-4 py-3 text-left">Bí danh (Aliases)</th>
                  <th className="px-4 py-3 text-center w-24">Số phiếu</th>
                  <th className="px-4 py-3 text-center w-28">Trạng thái</th>
                  {canManage && <th className="px-4 py-3 text-right w-28">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {filteredLabs.map((lab) => {
                  const stats = labUsageStats[lab.id] || { total: 0, pass: 0, fail: 0 };
                  const isExternal = lab.type === 'EXTERNAL';

                  return (
                    <tr key={lab.id} className="hover:bg-surface-2/50 transition-colors group">
                      <td className="px-4 py-3 font-mono font-bold text-ink-soft">
                        <span className="px-2 py-1 bg-surface-2 rounded-lg border border-border">
                          {lab.code}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink text-sm">{lab.canonicalName}</div>
                        {lab.description && (
                          <div className="text-ink-muted text-[11px] mt-0.5 line-clamp-1">
                            {lab.description}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isExternal
                              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                          }`}
                        >
                          {isExternal ? 'Ngoại kiểm' : 'Nội bộ'}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {Array.isArray(lab.aliases) && lab.aliases.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {lab.aliases.slice(0, 4).map((alias, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-surface-2 text-ink-soft text-[11px] border border-border"
                              >
                                {alias}
                              </span>
                            ))}
                            {lab.aliases.length > 4 && (
                              <span className="px-1.5 py-0.5 rounded bg-surface-3 text-ink-muted text-[10px] font-medium border border-border">
                                +{lab.aliases.length - 4}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-ink-muted italic">Chưa có bí danh</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center font-semibold text-ink">
                        <span
                          className="px-2 py-0.5 rounded-full bg-surface-2 text-ink-soft"
                          title={`Tổng: ${stats.total} (Đạt: ${stats.pass}, Hỏng: ${stats.fail})`}
                        >
                          {stats.total}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => handleToggleActive(lab)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all ${
                            lab.isActive !== false
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-surface-3 text-ink-muted border-border hover:bg-surface-2'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              lab.isActive !== false ? 'bg-emerald-500' : 'bg-ink-muted'
                            }`}
                          />
                          {lab.isActive !== false ? 'Hoạt động' : 'Tạm dừng'}
                        </button>
                      </td>

                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(lab)}
                              className="p-1.5 rounded-lg text-ink-muted hover:text-emerald-600 hover:bg-surface-2 transition-colors"
                              title="Chỉnh sửa đơn vị"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setLabToDelete(lab)}
                              className="p-1.5 rounded-lg text-ink-muted hover:text-rose-600 hover:bg-surface-2 transition-colors"
                              title="Xóa đơn vị"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </DSTable>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLabs.map((lab) => {
                const stats = labUsageStats[lab.id] || { total: 0, pass: 0, fail: 0 };
                const isExternal = lab.type === 'EXTERNAL';

                return (
                  <DSCard
                    key={lab.id}
                    className="p-5 flex flex-col justify-between hover:shadow-md transition-all duration-200 group bg-surface border border-border"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface-2 text-ink border border-border">
                            {lab.code}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isExternal
                                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
                                : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                            }`}
                          >
                            {isExternal ? 'Ngoại kiểm' : 'Nội bộ'}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => handleToggleActive(lab)}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                            lab.isActive !== false
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-surface-3 text-ink-muted border-border'
                          }`}
                        >
                          {lab.isActive !== false ? 'Hoạt động' : 'Tạm dừng'}
                        </button>
                      </div>

                      <h3 className="text-base font-bold text-ink mt-3 leading-snug group-hover:text-emerald-600 transition-colors">
                        {lab.canonicalName}
                      </h3>

                      {lab.description && (
                        <p className="text-xs text-ink-muted mt-1 line-clamp-2">
                          {lab.description}
                        </p>
                      )}

                      <div className="mt-4 pt-3 border-t border-border space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-ink-muted font-medium">
                          <TagIcon className="w-3.5 h-3.5" />
                          <span>Bí danh ({lab.aliases?.length || 0}):</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(lab.aliases) && lab.aliases.length > 0 ? (
                            lab.aliases.slice(0, 5).map((alias, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-surface-2 text-ink-soft text-[11px] border border-border"
                              >
                                {alias}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-ink-muted italic">
                              Chưa thiết lập bí danh
                            </span>
                          )}
                          {lab.aliases && lab.aliases.length > 5 && (
                            <span className="px-1.5 py-0.5 rounded bg-surface-3 text-ink-muted text-[10px] font-medium border border-border">
                              +{lab.aliases.length - 5}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-border flex items-center justify-between text-xs">
                      <div className="text-ink-muted">
                        Liên kết: <b className="text-ink font-semibold">{stats.total}</b> phiếu
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(lab)}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-emerald-600 hover:bg-surface-2 transition-colors"
                            title="Sửa"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLabToDelete(lab)}
                            className="p-1.5 rounded-lg text-ink-muted hover:text-rose-600 hover:bg-surface-2 transition-colors"
                            title="Xóa"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </DSCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RÀ SOÁT & CHUẨN HÓA PHIẾU KIỂM NGHIỆM */}
      {activeTab === 'UNMAPPED' && (
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <SparklesIcon className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  Phát hiện {unmappedResults.length} phiếu kiểm nghiệm chưa chuẩn hóa mã Lab
                </h4>
                <p className="text-xs text-amber-700/90 dark:text-amber-400/90 mt-0.5">
                  Hệ thống tự động phân tích tên đơn vị nhập tự do, tính điểm tương đồng và đề xuất
                  phòng lab chuẩn. Chuẩn hóa sẽ giúp dữ liệu xu hướng SPC và truy vết CoA chuẩn xác
                  100%.
                </p>
              </div>
            </div>

            {canManage && unmappedResults.length > 0 && (
              <button
                type="button"
                onClick={handleBatchNormalizeHighConfidence}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold uppercase tracking-wider transition-colors shrink-0 shadow-xs"
              >
                <CheckIcon className="w-4 h-4" />
                <span>Chuẩn hóa hàng loạt (Độ tin cậy cao)</span>
              </button>
            )}
          </div>

          {unmappedResults.length === 0 ? (
            <DSEmptyState
              icon={CheckCircleIcon}
              title="Dữ liệu kiểm nghiệm đã hoàn toàn chuẩn hóa!"
              message="Tất cả phiếu kiểm nghiệm trong hệ thống đã được gắn chính xác với danh mục phòng Lab chuẩn hóa."
            />
          ) : (
            <DSTable>
              <thead className="bg-surface-2/60 border-b border-border text-xs font-semibold text-ink-muted">
                <tr>
                  <th className="px-4 py-3 text-left">Lô hàng / Sản phẩm</th>
                  <th className="px-4 py-3 text-left">Ngày xuất phiếu</th>
                  <th className="px-4 py-3 text-left">Tên đơn vị ghi nhận (Tự do)</th>
                  <th className="px-4 py-3 text-left">Gợi ý Lab chuẩn</th>
                  <th className="px-4 py-3 text-center w-28">Độ tương đồng</th>
                  {canManage && <th className="px-4 py-3 text-right w-48">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {unmappedResults.map((item) => {
                  const pct = Math.round(item.similarity * 100);
                  const confidenceBadge =
                    pct >= 90
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                      : pct >= 70
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                        : 'bg-surface-2 text-ink-muted border-border';

                  return (
                    <tr key={item.testResultId} className="hover:bg-surface-2/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">{item.batchNo}</div>
                        <div className="text-ink-muted text-[11px] line-clamp-1">
                          {item.productName}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-ink-soft">
                        {item.testDate ? formatDateStandard(item.testDate) : '---'}
                      </td>

                      <td className="px-4 py-3 font-semibold text-ink">
                        <span className="px-2 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-500/20">
                          "{item.rawLabName}"
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {item.matchedLab ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                              <ShieldCheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>{item.matchedLab.canonicalName}</span>
                            </div>
                            <div className="font-mono text-[10px] text-ink-muted">
                              Mã: {item.matchedLab.code} (
                              {item.matchedLab.type === 'EXTERNAL' ? 'Ngoại kiểm' : 'Nội bộ'})
                            </div>
                          </div>
                        ) : (
                          <select
                            value={selectedMappingLab[item.testResultId] || ''}
                            onChange={(e) =>
                              setSelectedMappingLab((prev) => ({
                                ...prev,
                                [item.testResultId]: e.target.value,
                              }))
                            }
                            className="px-2.5 py-1.5 bg-surface border border-border rounded-lg text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">-- Chọn đơn vị chuẩn --</option>
                            {laboratories.map((lab) => (
                              <option key={lab.id} value={lab.id}>
                                {lab.code} - {lab.canonicalName}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${confidenceBadge}`}
                        >
                          {item.confidence !== 'NONE'
                            ? `${pct}% (${item.confidence})`
                            : 'Chưa khớp'}
                        </span>
                      </td>

                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleNormalizeSingleResult(item)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs"
                              title="Gán mã Lab chuẩn cho phiếu này"
                            >
                              Gán chuẩn
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenAddModal(item.rawLabName)}
                              className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-ink-soft hover:text-ink font-semibold text-xs border border-border transition-colors"
                              title="Tạo phòng Lab mới từ tên này"
                            >
                              Tạo Lab
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </DSTable>
          )}
        </div>
      )}

      {/* MODAL: THÊM MỚI / CHỈNH SỬA PHÒNG LAB */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingLab ? `Chỉnh sửa Đơn vị: ${editingLab.code}` : 'Thêm Đơn vị Kiểm nghiệm Mới'}
      >
        <form onSubmit={handleSaveLab} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">
                Mã đơn vị (Code) *
              </label>
              <input
                type="text"
                required
                placeholder="VD: QUATEST3, CASE, NIFC..."
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl font-mono text-xs font-bold text-ink uppercase outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              <span className="text-[10px] text-ink-muted mt-1 block">
                Mã định danh viết tắt, duy nhất trong hệ thống.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">
                Phân loại đơn vị *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as LabType })}
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              >
                <option value="EXTERNAL">Ngoại kiểm (External Lab độc lập)</option>
                <option value="INTERNAL">Nội bộ (Phòng QC/QA V-Biotech)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">
              Tên chuẩn hóa (Canonical Name) *
            </label>
            <input
              type="text"
              required
              placeholder="VD: Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3"
              value={formData.canonicalName}
              onChange={(e) => setFormData({ ...formData, canonicalName: e.target.value })}
              className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-xs font-semibold text-ink outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
            <span className="text-[10px] text-ink-muted mt-1 block">
              Tên hiển thị chính thức trên Phiếu kết quả, Chứng nhận CoA và Biểu đồ SPC.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">
              Danh sách Bí danh (Aliases)
            </label>
            <textarea
              rows={3}
              placeholder="Nhập các tên viết tắt, tên gọi khác, cách viết sai dấu... ngăn cách bằng dấu phẩy hoặc xuống dòng.
VD: Quatest 3, KT3, Trung tâm KT 3, Trung tâm Kỹ thuật 3"
              value={formData.aliasesText}
              onChange={(e) => setFormData({ ...formData, aliasesText: e.target.value })}
              className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-xs text-ink outline-none focus:ring-2 focus:ring-emerald-500 transition-all leading-relaxed"
            />
            <span className="text-[10px] text-ink-muted mt-1 block">
              Rất quan trọng cho việc nhận diện OCR AI từ file scan và tự động gợi ý combobox.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">
              Mô tả / Ghi chú
            </label>
            <textarea
              rows={2}
              placeholder="Thông tin thêm về địa chỉ, năng lực kiểm định, chứng chỉ ISO/IEC 17025..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-xs text-ink outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-border"
            />
            <label htmlFor="isActiveCheck" className="text-xs font-medium text-ink cursor-pointer">
              Đang hoạt động (Hiển thị trong gợi ý nhập phiếu kết quả)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-border bg-surface text-ink-muted hover:text-ink hover:bg-surface-2 text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold uppercase tracking-wider shadow-sm hover:shadow transition-all"
            >
              {editingLab ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: XÁC NHẬN XÓA PHÒNG LAB */}
      <ConfirmationModal
        isOpen={!!labToDelete}
        onClose={() => setLabToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Xác nhận xóa Đơn vị kiểm nghiệm"
        message={
          <div>
            <p>
              Bạn có chắc chắn muốn xóa đơn vị <b>"{labToDelete?.canonicalName}"</b> (Mã:{' '}
              {labToDelete?.code})?
            </p>
            {labToDelete && (labUsageStats[labToDelete.id]?.total || 0) > 0 && (
              <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-700 dark:text-rose-400">
                <ExclamationTriangleIcon className="w-4 h-4 inline mr-1.5 shrink-0" />
                <b>Cảnh báo:</b> Đang có <b>{labUsageStats[labToDelete.id]?.total}</b> phiếu kiểm
                nghiệm liên kết với đơn vị này. Việc xóa đơn vị sẽ khiến các phiếu mất liên kết
                chuẩn hóa. Bạn nên chọn <b>"Tạm dừng hoạt động"</b> thay vì xóa vĩnh viễn.
              </div>
            )}
          </div>
        }
        confirmText={isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
        confirmButtonColor="bg-rose-600 hover:bg-rose-700 text-white"
      />
    </div>
  );
};

export default LaboratoryManagementPage;
