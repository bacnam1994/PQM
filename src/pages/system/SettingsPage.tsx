import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { testResultRepository } from '../../repositories/firebase/FirebaseTestResultRepository';
import {
  CircleStackIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  TrashIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
  DocumentTextIcon,
  AdjustmentsHorizontalIcon,
  HashtagIcon,
  CalendarIcon,
  SparklesIcon,
  UserCircleIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  ChartBarIcon,
  FunnelIcon,
  Bars3Icon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  CpuChipIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FolderOpenIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

const CookieIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
    <path d="M8.5 8.5v.01" />
    <path d="M16 15.5v.01" />
    <path d="M12 12v.01" />
    <path d="M11 17v.01" />
    <path d="M7 14v.01" />
  </svg>
);
import { ConfirmationModal } from '../../components';
import { DataConsistencyCenter } from '../../components/features/DataConsistencyCenter';
import { PharmacopoeiaManager } from './components/PharmacopoeiaManager';
import { generateId } from '../../utils';
import { ProductFormula, FormulaIngredient } from '../../types';
import { useUIStore } from '../../store/useUIStore';
import { resetConsent } from '../../hooks/useCookieConsent';
import { useShallow } from 'zustand/react/shallow';
import { AVAILABLE_GEMINI_MODELS, DEFAULT_GEMINI_MODEL } from '../../services/ai/geminiService';

/** Panel hiển thị trạng thái bộ lọc đã lưu và cho phép reset từng trang */
const FilterStatusPanel: React.FC = () => {
  const {
    batchFilterStatus,
    batchFilterYear,
    batchFilterMonth,
    batchFilterProductId,
    batchSortConfig,
    productFilterType,
    productFilterStatus,
    productSort,
    testResultFilterYear,
    testResultFilterMonth,
    testResultFilterProductId,
    testResultSortConfig,
    resetPreferences,
  } = useUIStore(
    useShallow((s) => ({
      batchFilterStatus: s.batchFilterStatus,
      batchFilterYear: s.batchFilterYear,
      batchFilterMonth: s.batchFilterMonth,
      batchFilterProductId: s.batchFilterProductId,
      batchSortConfig: s.batchSortConfig,
      productFilterType: s.productFilterType,
      productFilterStatus: s.productFilterStatus,
      productSort: s.productSort,
      testResultFilterYear: s.testResultFilterYear,
      testResultFilterMonth: s.testResultFilterMonth,
      testResultFilterProductId: s.testResultFilterProductId,
      testResultSortConfig: s.testResultSortConfig,
      resetPreferences: s.resetPreferences,
    }))
  );

  const batchHasFilters =
    batchFilterStatus !== 'ALL' ||
    batchFilterYear !== 'ALL' ||
    batchFilterMonth !== 'ALL' ||
    batchFilterProductId !== '';
  const productHasFilters =
    productFilterType !== 'ALL' || productFilterStatus !== 'ALL' || productSort.key !== 'createdAt';
  const testResultHasFilters =
    testResultFilterYear !== 'ALL' ||
    testResultFilterMonth !== 'ALL' ||
    testResultFilterProductId !== '';
  const anyFilter = batchHasFilters || productHasFilters || testResultHasFilters;

  const resetBatchFilters = () =>
    useUIStore.setState({
      batchFilterStatus: 'ALL',
      batchFilterYear: 'ALL',
      batchFilterMonth: 'ALL',
      batchFilterProductId: '',
      batchSortConfig: { key: 'createdAt', direction: 'desc' },
    });
  const resetProductFilters = () =>
    useUIStore.setState({
      productFilterType: 'ALL',
      productFilterStatus: 'ALL',
      productSort: { key: 'createdAt', direction: 'desc' },
    });
  const resetTestResultFilters = () =>
    useUIStore.setState({
      testResultFilterYear: 'ALL',
      testResultFilterMonth: 'ALL',
      testResultFilterProductId: '',
      testResultSortConfig: { key: 'testDate', direction: 'desc' },
    });

  return (
    <div className="pt-2 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-semibold text-ink flex items-center gap-2">
          <FunnelIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Bộ lọc đã lưu
          {anyFilter ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Đang lưu
            </span>
          ) : (
            <span className="text-[10px] font-normal text-ink-muted">(mặc định)</span>
          )}
        </label>
        {anyFilter && (
          <button
            onClick={resetPreferences}
            className="text-xs text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-1 active:scale-[0.98]"
          >
            <ArrowPathIcon className="w-3 h-3" /> Xóa tất cả bộ lọc
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Lô hàng */}
        <div
          className={`rounded-xl border p-3 space-y-1.5 transition-all ${batchHasFilters ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-surface-2/60 border-border'}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
              Trang Lô hàng
            </p>
            {batchHasFilters && (
              <button
                onClick={resetBatchFilters}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Reset
              </button>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Trạng thái:</span>
              <span
                className={`font-medium ${batchFilterStatus !== 'ALL' ? 'text-indigo-600 dark:text-indigo-400' : 'text-ink-muted'}`}
              >
                {batchFilterStatus}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Năm / Tháng:</span>
              <span
                className={`font-medium ${batchFilterYear !== 'ALL' || batchFilterMonth !== 'ALL' ? 'text-indigo-600 dark:text-indigo-400' : 'text-ink-muted'}`}
              >
                {batchFilterYear === 'ALL' ? '—' : batchFilterYear} /{' '}
                {batchFilterMonth === 'ALL' ? '—' : `T${batchFilterMonth}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Sắp xếp:</span>
              <span className="font-medium text-ink-muted">
                {batchSortConfig.key} {batchSortConfig.direction}
              </span>
            </div>
          </div>
        </div>

        {/* Sản phẩm */}
        <div
          className={`rounded-xl border p-3 space-y-1.5 transition-all ${productHasFilters ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-surface-2/60 border-border'}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
              Trang Sản phẩm
            </p>
            {productHasFilters && (
              <button
                onClick={resetProductFilters}
                className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Reset
              </button>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Nguồn gốc:</span>
              <span
                className={`font-medium ${productFilterType !== 'ALL' ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-muted'}`}
              >
                {productFilterType}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Trạng thái:</span>
              <span
                className={`font-medium ${productFilterStatus !== 'ALL' ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-muted'}`}
              >
                {productFilterStatus}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Sắp xếp:</span>
              <span className="font-medium text-ink-muted">
                {productSort.key} {productSort.direction}
              </span>
            </div>
          </div>
        </div>

        {/* Kết quả Lab */}
        <div
          className={`rounded-xl border p-3 space-y-1.5 transition-all ${testResultHasFilters ? 'bg-sky-500/5 border-sky-500/20' : 'bg-surface-2/60 border-border'}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
              Kết quả Lab
            </p>
            {testResultHasFilters && (
              <button
                onClick={resetTestResultFilters}
                className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline"
              >
                Reset
              </button>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Năm / Tháng:</span>
              <span
                className={`font-medium ${testResultFilterYear !== 'ALL' || testResultFilterMonth !== 'ALL' ? 'text-sky-600 dark:text-sky-400' : 'text-ink-muted'}`}
              >
                {testResultFilterYear === 'ALL' ? '—' : testResultFilterYear} /{' '}
                {testResultFilterMonth === 'ALL' ? '—' : `T${testResultFilterMonth}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Sản phẩm:</span>
              <span
                className={`font-medium ${testResultFilterProductId ? 'text-sky-600 dark:text-sky-400' : 'text-ink-muted'}`}
              >
                {testResultFilterProductId ? '● Đã chọn' : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-ink-muted">Sắp xếp:</span>
              <span className="font-medium text-ink-muted">
                {testResultSortConfig.key} {testResultSortConfig.direction}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsPage: React.FC = () => {
  // Tối ưu 1: Gom nhóm selectors của Zustand bằng useShallow
  // Giúp trang Settings KHÔNG BỊ re-render khi các dữ liệu không liên quan (như Lô hàng, Kết quả test) thay đổi.
  const {
    resetToDemoData,
    clearAllData,
    loadBackup,
    addProductFormula,
    updateProductFormula,
    tccsList,
    productFormulas,
  } = useAppStore(
    useShallow((state) => ({
      resetToDemoData: state.resetToDemoData,
      clearAllData: state.clearAllData,
      loadBackup: state.loadBackup,
      addProductFormula: state.addProductFormula,
      updateProductFormula: state.updateProductFormula,
      tccsList: state.tccsList,
      productFormulas: state.productFormulas,
    }))
  );

  // Generic confirmation modal state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // ─── AI API Key State ──────────────────────────────────────────────
  const [apiKeyInput, setApiKeyInput] = useState(
    () => localStorage.getItem('GEMINI_API_KEY') || ''
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  // ─── AI Model and Thinking Mode States ──────────────────────────────
  const [defaultModel, setDefaultModel] = useState(
    () => localStorage.getItem('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL
  );
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(
    () => localStorage.getItem('GEMINI_THINKING_ENABLED') !== 'false'
  );

  const handleSaveModel = (model: string) => {
    setDefaultModel(model);
    localStorage.setItem('GEMINI_MODEL', model);
  };

  const handleToggleThinking = (enabled: boolean) => {
    setIsThinkingEnabled(enabled);
    localStorage.setItem('GEMINI_THINKING_ENABLED', String(enabled));
  };

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    if (trimmed) {
      localStorage.setItem('GEMINI_API_KEY', trimmed);
    } else {
      localStorage.removeItem('GEMINI_API_KEY');
    }
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 3000);
  };

  const handleClearApiKey = () => {
    setApiKeyInput('');
    localStorage.removeItem('GEMINI_API_KEY');
    setApiKeySaved(false);
  };

  // Thống kê learned mappings
  const aiLearnedMappings = useAppStore((state) => state.aiLearnedMappings) || [];
  const hasEnvKey = !!(import.meta as any).env?.VITE_GEMINI_API_KEY;
  const hasLocalKey = !!localStorage.getItem('GEMINI_API_KEY');
  const isAiConfigured = hasEnvKey || hasLocalKey;

  // Tối ưu 2: Gom nhóm selectors của useUIStore
  const {
    decimalSeparator,
    setDecimalSeparator,
    dateFormat,
    setDateFormat,
    rowsPerPage,
    setRowsPerPage,
    defaultBatchFilter,
    setDefaultBatchFilter,
    defaultTestResultFilter,
    setDefaultTestResultFilter,
    searchHistory,
    clearSearchHistory,
    resetPreferences,
    googleDriveFolderUrl,
    googleDriveFolderId,
    googleDriveClientId,
    googleDriveApiKey,
    useGoogleDriveUpload,
    setGoogleDriveFolderUrl,
    setGoogleDriveClientId,
    setGoogleDriveApiKey,
    setUseGoogleDriveUpload,
  } = useUIStore() as any;

  const openConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmProps({ title, message, onConfirm });
    setIsConfirmOpen(true);
  };

  const handleExportData = async () => {
    try {
      // Lấy toàn bộ dữ liệu TestResults từ Repository để đảm bảo backup đầy đủ
      const allTestResults = await testResultRepository.findAll();

      // Giả lập lại fullData để tương thích với cấu trúc Export cũ
      const fullData: any = { testResults: allTestResults };
      const currentState = useAppStore.getState();
      [
        'products',
        'batches',
        'tccsList',
        'productFormulas',
        'rawMaterials',
        'criteriaAliases',
        'aiLearnedMappings',
      ].forEach((key) => {
        fullData[key] = currentState[key as keyof typeof currentState];
      });

      const dataStr = JSON.stringify(fullData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qa_manager_backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Lỗi khi tạo bản sao lưu:', error);
      alert('Không thể tạo bản sao lưu. Vui lòng kiểm tra kết nối mạng.');
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);

          // Basic validation structure check
          if (!data || typeof data !== 'object') {
            throw new Error('File không phải là JSON hợp lệ');
          }

          if (
            !Array.isArray(data.products) ||
            !Array.isArray(data.batches) ||
            !Array.isArray(data.testResults)
          ) {
            throw new Error('Cấu trúc dữ liệu bị thiếu (products, batches, hoặc testResults)');
          }

          openConfirmation(
            'Xác nhận Khôi phục',
            'Khôi phục dữ liệu sẽ ghi đè toàn bộ thông tin hiện tại. Bạn có chắc chắn muốn tiếp tục?',
            () => loadBackup(data)
          );
        } catch (err) {
          alert('Tệp dữ liệu không hợp lệ hoặc bị hỏng!');
          console.error(err);
        }
      };
      reader.readAsText(file);
    }
  };

  // Helper to parse numbers, including scientific notation like 10^6
  const normalizeAndParseContent = (contentStr: string): { value: number; unit: string } => {
    if (!contentStr) return { value: 0, unit: '' };
    // Chuẩn hóa: thay dấu phẩy, xử lý ký hiệu 1.5x10^6 và 10^6
    let s = contentStr.toLowerCase().trim().replace(/,/g, '.');
    s = s.replace(/([\d.]+)\s*x\s*10\s*\^\s*(-?\d+)/g, '$1e$2'); // 1.5 x 10^3 -> 1.5e3
    s = s.replace(/10\s*\^\s*(-?\d+)/g, '1e$2'); // 10^3 -> 1e3
    const match = s.match(/^(-?[\d.]+(?:e[+-]?\d+)?)\s*(.*)/);
    return match
      ? { value: parseFloat(match[1]), unit: match[2].trim() }
      : { value: 0, unit: contentStr };
  };

  // Admin utilities have been cleaned up as the data migration is complete.

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">Cấu hình Hệ thống</h1>
        <p className="text-ink-muted mt-1 text-xs">
          Quản lý cơ sở dữ liệu và các thiết lập nâng cao.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Format Configuration */}
        <section className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <AdjustmentsHorizontalIcon className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-ink">Cấu hình Định dạng</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Number Format */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-ink-muted flex items-center gap-2">
                <HashtagIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Định
                dạng số (Thập phân)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDecimalSeparator('dot')}
                  className={`p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${decimalSeparator === 'dot' ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/30' : 'bg-surface border-border hover:bg-surface-2'}`}
                >
                  <div className="font-semibold text-ink text-sm">Dấu chấm (.)</div>
                  <div className="text-[10px] text-ink-muted mt-0.5">VD: 1,234.56</div>
                </button>
                <button
                  onClick={() => setDecimalSeparator('comma')}
                  className={`p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${decimalSeparator === 'comma' ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/30' : 'bg-surface border-border hover:bg-surface-2'}`}
                >
                  <div className="font-semibold text-ink text-sm">Dấu phẩy (,)</div>
                  <div className="text-[10px] text-ink-muted mt-0.5">VD: 1.234,56</div>
                </button>
              </div>
            </div>

            {/* Date Format */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-ink-muted flex items-center gap-2">
                <CalendarIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Định
                dạng ngày tháng
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full p-2.5 bg-surface border border-border rounded-xl font-medium text-ink text-sm outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</option>
              </select>
              <p className="text-[10px] text-ink-muted italic">
                Lưu ý: Cấu hình này áp dụng cho việc hiển thị và nhập liệu ngày tháng trên toàn hệ
                thống.
              </p>
            </div>
          </div>
        </section>

        {/* === PERSONALIZATION SECTION === */}
        <section className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <UserCircleIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-ink">Cá nhân hóa</h3>
                <p className="text-xs text-ink-muted">
                  Tùy chỉnh thói quen sử dụng — lưu riêng cho từng tài khoản trên thiết bị này.
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                openConfirmation(
                  'Đặt lại về mặc định',
                  'Toàn bộ tùy chỉnh cá nhân (bộ lọc, số dòng, v.v.) sẽ bị reset. Bạn có chắc chắn?',
                  resetPreferences
                )
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-muted border border-border rounded-lg hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/30 transition-all active:scale-[0.98]"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              Reset mặc định
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Rows per page */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink-muted flex items-center gap-2">
                <Bars3Icon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Số dòng
                mỗi trang
              </label>
              <div className="grid grid-cols-4 gap-2">
                {([10, 20, 50, 100] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setRowsPerPage(n)}
                    className={`py-2 rounded-xl border text-sm font-bold transition-all ${
                      rowsPerPage === n
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30'
                        : 'bg-surface-2 border-border text-ink-muted hover:bg-surface hover:text-ink hover:shadow-sm'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Default Batch Filter */}
            <div className="space-y-2.5">
              <label className="text-sm font-bold text-ink-muted flex items-center gap-2">
                <FunnelIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Bộ lọc Lô
                hàng mặc định
              </label>
              <select
                value={defaultBatchFilter}
                onChange={(e) => setDefaultBatchFilter(e.target.value as any)}
                className="w-full p-2.5 bg-surface-2 border border-border rounded-xl font-semibold text-ink text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">Tất cả</option>
                <option value="PENDING">Chờ kiểm</option>
                <option value="TESTING">Đang kiểm</option>
                <option value="RELEASED">Đã xuất</option>
                <option value="REJECTED">Bị loại</option>
              </select>
            </div>

            {/* Default Test Result Filter */}
            <div className="space-y-2.5">
              <label className="text-sm font-bold text-ink-muted flex items-center gap-2">
                <ChartBarIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Bộ lọc
                KQ kiểm nghiệm
              </label>
              <select
                value={defaultTestResultFilter}
                onChange={(e) => setDefaultTestResultFilter(e.target.value as any)}
                className="w-full p-2.5 bg-surface-2 border border-border rounded-xl font-semibold text-ink text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">Tất cả</option>
                <option value="PASS">Đạt (PASS)</option>
                <option value="FAIL">Không đạt (FAIL)</option>
              </select>
            </div>
          </div>

          {/* Search History */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-ink-muted flex items-center gap-2">
                <MagnifyingGlassIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />{' '}
                Lịch sử tìm kiếm
                <span className="text-xs font-normal text-ink-muted">
                  ({searchHistory.length}/10 mục)
                </span>
              </label>
              {searchHistory.length > 0 && (
                <button
                  onClick={() =>
                    openConfirmation(
                      'Xóa lịch sử tìm kiếm',
                      'Toàn bộ lịch sử tìm kiếm đã lưu sẽ bị xóa.',
                      clearSearchHistory
                    )
                  }
                  className="text-xs text-rose-500 hover:text-rose-600 hover:underline transition-colors font-medium"
                >
                  Xóa tất cả
                </button>
              )}
            </div>
            {searchHistory.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {searchHistory.map((q, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-1 bg-surface-2 text-ink border border-border rounded-full text-xs font-medium"
                  >
                    <MagnifyingGlassIcon className="w-3 h-3 text-ink-muted" />
                    {q}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted italic">Chưa có lịch sử tìm kiếm nào.</p>
            )}
          </div>

          {/* Cookie Management */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CookieIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-ink">Quản lý Cookie</p>
                  <p className="text-xs text-ink-muted">
                    Đặt lại lựa chọn đồng ý cookie để hiển thị lại banner thông báo.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  resetConsent();
                  window.location.reload();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20 bg-amber-500/10 rounded-xl hover:bg-amber-500/20 transition-all"
              >
                <ChevronRightIcon className="w-3.5 h-3.5" />
                Đặt lại Cookie
              </button>
            </div>
          </div>

          {/* Saved Filter Status */}
          <FilterStatusPanel />
        </section>

        {/* === AI CONFIGURATION SECTION === */}
        <section className="bg-surface p-6 rounded-2xl border border-border shadow-sm space-y-5 lg:col-span-2">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-ink">Cấu hình AI (Gemini)</h3>
              <p className="text-xs text-ink-muted">
                Quản lý API Key và xem thống kê học máy của hệ thống AI.
              </p>
            </div>
          </div>

          {/* Trạng thái AI */}
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
              isAiConfigured
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300'
            }`}
          >
            {isAiConfigured ? (
              <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
            ) : (
              <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
            )}
            <div>
              <p className="text-sm font-bold">
                {isAiConfigured ? 'AI đang hoạt động ✅' : 'Chưa cấu hình API Key ⚠️'}
              </p>
              <p className="text-xs opacity-80">
                {hasEnvKey
                  ? 'API Key được tải từ biến môi trường (.env) — mức độ bảo mật cao nhất.'
                  : hasLocalKey
                    ? 'API Key cá nhân đang được dùng (lưu trong localStorage).'
                    : 'Nhập API Key Gemini bên dưới để kích hoạt tính năng AI.'}
              </p>
            </div>
          </div>

          {/* Nhập API Key cá nhân */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-ink-muted flex items-center gap-2">
              <KeyIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Gemini API Key cá nhân
              <span className="text-[10px] font-normal text-ink-muted">
                (lưu cục bộ trên thiết bị này, không đồng bộ cloud)
              </span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <CpuChipIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Dán Gemini API Key vào đây (AIza...)"
                  className="w-full pl-9 pr-10 py-2.5 bg-surface-2 border border-border rounded-xl text-sm font-mono text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
                >
                  {showApiKey ? (
                    <EyeSlashIcon className="w-4 h-4" />
                  ) : (
                    <EyeIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
              <button
                onClick={handleSaveApiKey}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${
                  apiKeySaved
                    ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
              >
                {apiKeySaved ? '✓ Đã lưu!' : 'Lưu Key'}
              </button>
              {(apiKeyInput || hasLocalKey) && (
                <button
                  onClick={handleClearApiKey}
                  className="px-3 py-2.5 rounded-xl text-sm font-bold text-rose-500 border border-rose-500/20 hover:bg-rose-500/10 transition-all"
                >
                  Xóa
                </button>
              )}
            </div>
            <p className="text-[10px] text-ink-muted italic pl-1">
              Lấy API Key miễn phí tại{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
              >
                Google AI Studio
              </a>
              . Key cá nhân sẽ ưu tiên dùng thay cho key chung, giúp tránh lỗi vượt hạn mức (429).
            </p>
          </div>

          {/* Cấu hình mô hình và suy luận */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-border">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-ink-muted flex items-center gap-2">
                <CpuChipIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Mô hình mặc định
              </label>
              <select
                value={defaultModel}
                onChange={(e) => handleSaveModel(e.target.value)}
                className="w-full p-2.5 bg-surface-2 border border-border rounded-xl font-semibold text-ink text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
              >
                <optgroup label="⚡ Gemini 2.5 (Tiêu chuẩn)">
                  {AVAILABLE_GEMINI_MODELS.filter((m) => m.group.includes('2.5')).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.badge}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="📦 Gemini 2.0 (Tương thích)">
                  {AVAILABLE_GEMINI_MODELS.filter((m) => m.group.includes('2.0')).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.badge}
                    </option>
                  ))}
                </optgroup>
              </select>

              {(() => {
                const activeModelInfo = AVAILABLE_GEMINI_MODELS.find((m) => m.id === defaultModel);
                return activeModelInfo ? (
                  <div className="p-2.5 rounded-xl bg-surface-2 border border-border text-[11px] text-ink animate-in fade-in duration-200">
                    <div className="font-bold flex items-center gap-1.5 mb-0.5 text-emerald-600 dark:text-emerald-400">
                      <SparklesIcon className="w-3.5 h-3.5" />
                      {activeModelInfo.name}
                    </div>
                    <p className="text-[10px] text-ink-muted leading-relaxed">
                      {activeModelInfo.description}
                    </p>
                  </div>
                ) : null;
              })()}
            </div>

            <div className="space-y-1.5 flex flex-col justify-between">
              <label className="text-sm font-bold text-ink-muted flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Chế độ suy luận (Chain of Thought)
              </label>
              <div className="flex items-center justify-between p-2 bg-surface-2 border border-border rounded-xl h-[42px] px-3.5">
                <span className="text-xs text-ink font-semibold">Hiện quy trình suy nghĩ</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isThinkingEnabled}
                    onChange={(e) => handleToggleThinking(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
              <p className="text-[10px] text-ink-muted italic pl-1">
                AI sẽ giải thích quy trình lập luận từng bước trước khi trả lời.
              </p>
            </div>
          </div>

          {/* Thống kê Learned Mappings */}
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-ink-muted flex items-center gap-2">
                <CpuChipIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Cơ sở Kiến thức AI đã học
                <span className="text-xs font-normal text-ink-muted">
                  ({aiLearnedMappings.length} ánh xạ)
                </span>
              </label>
            </div>
            {aiLearnedMappings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {aiLearnedMappings.slice(0, 20).map((m: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-[11px] bg-surface-2 rounded-xl px-3 py-1.5 border border-border"
                  >
                    <span className="text-ink-muted truncate max-w-[120px]" title={m.originalName}>
                      {m.originalName}
                    </span>
                    <span className="text-ink-muted/50 flex-shrink-0">→</span>
                    <span
                      className="text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-[120px]"
                      title={m.systemName}
                    >
                      {m.systemName}
                    </span>
                    <span className="ml-auto text-[9px] text-ink-muted flex-shrink-0">
                      ×{m.frequency}
                    </span>
                  </div>
                ))}
                {aiLearnedMappings.length > 20 && (
                  <p className="text-[10px] text-ink-muted italic col-span-2 text-center">
                    ... và {aiLearnedMappings.length - 20} ánh xạ khác
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-muted italic">
                Chưa có dữ liệu học máy. AI sẽ tự học khi bạn xác nhận ánh xạ tên chỉ tiêu trong quá
                trình nhập liệu.
              </p>
            )}
          </div>
        </section>

        {/* === GOOGLE DRIVE STORAGE CONFIGURATION === */}
        <section className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <CircleStackIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink">Cấu hình Lưu trữ Google Drive</h3>
              <p className="text-xs text-ink-muted">
                Thiết lập thư mục Google Drive để lưu trữ các tài liệu, ảnh chụp, file đính kèm.
              </p>
            </div>
          </div>

          {/* URL thư mục */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-ink-muted flex items-center gap-2">
              <FolderOpenIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Đường dẫn Thư mục Google Drive lưu trữ *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={googleDriveFolderUrl}
                onChange={(e) => setGoogleDriveFolderUrl(e.target.value)}
                placeholder="VD: https://drive.google.com/drive/folders/..."
                className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all shadow-2xs"
              />
              <button
                type="button"
                onClick={() =>
                  window.open(googleDriveFolderUrl || 'https://drive.google.com', '_blank')
                }
                className="px-3.5 py-2.5 bg-surface text-ink border border-border rounded-xl text-xs font-medium hover:bg-surface-2 hover:border-emerald-500/30 transition-all flex items-center gap-2 shrink-0 active:scale-[0.98]"
                title="Mở thư mục kiểm tra"
              >
                <ArrowTopRightOnSquareIcon className="w-4 h-4 text-ink-muted" />
                Mở thư mục
              </button>
            </div>
            {googleDriveFolderId && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium pl-1">
                ✓ Trích xuất ID thư mục thành công:{' '}
                <span className="font-mono">{googleDriveFolderId}</span>
              </p>
            )}
          </div>

          {/* Checkbox kích hoạt tự động API upload */}
          <div className="pt-2 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-ink">Tự động tải lên qua Google API</p>
                <p className="text-[11px] text-ink-muted">
                  Kích hoạt để tự động đẩy file lên Google Drive ngay khi chọn file trên ứng dụng
                  (yêu cầu cấu hình API cá nhân).
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useGoogleDriveUpload}
                  onChange={(e) => setUseGoogleDriveUpload(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {useGoogleDriveUpload && (
              <div className="p-3.5 bg-surface-2/60 rounded-xl border border-border space-y-3 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink-muted pl-1">
                    Google OAuth Client ID
                  </label>
                  <input
                    type="text"
                    value={googleDriveClientId}
                    onChange={(e) => setGoogleDriveClientId(e.target.value)}
                    placeholder="VD: 123456-abcdef.apps.googleusercontent.com"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-xs font-mono text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink-muted pl-1">
                    Google API Key
                  </label>
                  <input
                    type="password"
                    value={googleDriveApiKey}
                    onChange={(e) => setGoogleDriveApiKey(e.target.value)}
                    placeholder="Nhập Google API Key của bạn..."
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-xs font-mono text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500"
                  />
                </div>

                <p className="text-[10px] text-ink-muted italic font-medium">
                  💡 Nếu không bật API tự động tải lên hoặc chưa điền thông tin, hệ thống sẽ sử dụng
                  **Firebase Storage** sẵn có để lưu file, hoặc cho phép bạn nhấn nút mở thư mục
                  Google Drive để thả file rồi dán liên kết thủ công.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Pharmacopoeia Standards & Dynamic AI Context */}
        <PharmacopoeiaManager />

        {/* Data Consistency & Linkage Center */}
        <div className="lg:col-span-2">
          <DataConsistencyCenter />
        </div>

        {/* Backup & Restore */}
        <section className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <CircleStackIcon className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-ink">Dữ liệu & Sao lưu</h3>
          </div>
          <div className="space-y-2.5">
            <button
              onClick={handleExportData}
              className="w-full flex items-center justify-between p-3 bg-surface border border-border rounded-xl hover:bg-surface-2 transition-all group active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <ArrowDownTrayIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform" />
                <div className="text-left">
                  <p className="font-semibold text-ink text-xs">Xuất dữ liệu (.json)</p>
                  <p className="text-[11px] text-ink-muted">Tải toàn bộ cơ sở dữ liệu về máy.</p>
                </div>
              </div>
            </button>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
                id="import-input"
              />
              <label
                htmlFor="import-input"
                className="w-full flex items-center justify-between p-3 bg-surface border border-border rounded-xl hover:bg-surface-2 transition-all group cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <ArrowUpTrayIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform" />
                  <div className="text-left">
                    <p className="font-semibold text-ink text-xs">Khôi phục dữ liệu</p>
                    <p className="text-[11px] text-ink-muted">Tải lên tệp sao lưu .json đã có.</p>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </section>

        {/* Development Tools */}
        <section className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
              <ShieldExclamationIcon className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-ink">Tiện ích Admin</h3>
          </div>
          <div className="space-y-2.5">
            <button
              onClick={() =>
                openConfirmation(
                  'Nạp dữ liệu mẫu',
                  'Tải dữ liệu mẫu sẽ xóa sạch dữ liệu hiện tại. Bạn có chắc chắn muốn đồng ý?',
                  resetToDemoData
                )
              }
              className="w-full flex items-center justify-between p-3 bg-surface border border-border rounded-xl hover:bg-surface-2 transition-all group active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <ArrowPathIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 group-hover:rotate-180 transition-transform duration-500" />
                <div className="text-left">
                  <p className="font-semibold text-ink text-xs">Nạp dữ liệu mẫu</p>
                  <p className="text-[11px] text-ink-muted">Reset và dùng bộ dữ liệu demo.</p>
                </div>
              </div>
            </button>
            <button
              onClick={() =>
                openConfirmation(
                  'XÓA SẠCH DỮ LIỆU',
                  'HÀNH ĐỘNG NÀY KHÔNG THỂ KHÔI PHỤC! Bạn có hoàn toàn chắc chắn muốn xóa toàn bộ dữ liệu ngay bây giờ không?',
                  clearAllData
                )
              }
              className="w-full flex items-center justify-between p-3 border border-rose-500/20 bg-rose-500/5 rounded-xl hover:bg-rose-500/10 transition-all group active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <TrashIcon className="w-5 h-5 text-rose-500" />
                <div className="text-left">
                  <p className="font-semibold text-rose-600 dark:text-rose-400 text-xs">
                    Xóa sạch vĩnh viễn
                  </p>
                  <p className="text-[11px] text-rose-500/70">
                    Xóa dữ liệu trên Cloud và Máy cục bộ.
                  </p>
                </div>
              </div>
            </button>
          </div>
        </section>
      </div>

      <div className="rounded-xl p-4 bg-surface border border-border flex items-center gap-4 text-xs text-ink-muted shadow-xs">
        <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
          <DocumentTextIcon className="w-5 h-5" />
        </div>
        <div className="space-y-0.5 min-w-0">
          <div className="font-semibold text-ink text-sm flex items-center gap-2">
            QA Manager v2.5 Enterprise
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Offline-First
            </span>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            Hệ thống hoạt động với kiến trúc Offline-First. Dữ liệu được đồng bộ tự động lên
            Firebase Realtime Database ngay khi có kết nối mạng. Hãy sao lưu định kỳ trước khi thực
            hiện các thay đổi cấu trúc lớn.
          </p>
        </div>
      </div>

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title={confirmProps.title}
        message={confirmProps.message}
        onConfirm={() => {
          confirmProps.onConfirm();
          setIsConfirmOpen(false);
        }}
        confirmText="Xác nhận"
        icon={ShieldExclamationIcon}
      />
    </div>
  );
};

export default SettingsPage;
