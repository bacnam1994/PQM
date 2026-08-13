
import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { get, ref, update } from 'firebase/database';
import { db } from '../../firebase';
import { Database, Download, Upload, Trash2, RefreshCcw, ShieldAlert, FileJson, Settings2, Hash, Calendar, FlaskConical, Wand2, UserCircle2, RotateCcw, Search, Cookie, ChevronRight, BarChart3, ListFilter, Rows3, Sparkles, KeyRound, Eye, EyeOff, Bot, CheckCircle2, AlertTriangle, HardDrive, FolderOpen, ExternalLink } from 'lucide-react';
import { ConfirmationModal } from '../../components';
import { generateId } from '../../utils';
import { ProductFormula, FormulaIngredient } from '../../types';
import { useUIStore } from '../../store/useUIStore';
import { resetConsent } from '../../hooks/useCookieConsent';
import { useShallow } from 'zustand/react/shallow';

/** Panel hiển thị trạng thái bộ lọc đã lưu và cho phép reset từng trang */
const FilterStatusPanel: React.FC = () => {
  const {
    batchFilterStatus, batchFilterYear, batchFilterMonth, batchFilterProductId, batchSortConfig,
    productFilterType, productFilterStatus, productSort,
    testResultFilterYear, testResultFilterMonth, testResultFilterProductId, testResultSortConfig,
    resetPreferences,
  } = useUIStore(useShallow(s => ({
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
  })));

  const batchHasFilters = batchFilterStatus !== 'ALL' || batchFilterYear !== 'ALL' || batchFilterMonth !== 'ALL' || batchFilterProductId !== '';
  const productHasFilters = productFilterType !== 'ALL' || productFilterStatus !== 'ALL' || productSort.key !== 'createdAt';
  const testResultHasFilters = testResultFilterYear !== 'ALL' || testResultFilterMonth !== 'ALL' || testResultFilterProductId !== '';
  const anyFilter = batchHasFilters || productHasFilters || testResultHasFilters;

  const resetBatchFilters = () => useUIStore.setState({ batchFilterStatus: 'ALL', batchFilterYear: 'ALL', batchFilterMonth: 'ALL', batchFilterProductId: '', batchSortConfig: { key: 'createdAt', direction: 'desc' } });
  const resetProductFilters = () => useUIStore.setState({ productFilterType: 'ALL', productFilterStatus: 'ALL', productSort: { key: 'createdAt', direction: 'desc' } });
  const resetTestResultFilters = () => useUIStore.setState({ testResultFilterYear: 'ALL', testResultFilterMonth: 'ALL', testResultFilterProductId: '', testResultSortConfig: { key: 'testDate', direction: 'desc' } });

  return (
    <div className="pt-2 border-t border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
          <ListFilter size={15} className="text-indigo-500" />
          Bộ lọc đã lưu
          {anyFilter ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-full border border-indigo-100">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
              Đang lưu
            </span>
          ) : (
            <span className="text-[10px] font-normal text-slate-400">(mặc định)</span>
          )}
        </label>
        {anyFilter && (
          <button onClick={resetPreferences} className="text-xs text-red-400 hover:text-red-600 hover:underline transition-colors flex items-center gap-1">
            <RotateCcw size={11} /> Xóa tất cả bộ lọc
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Lô hàng */}
        <div className={`rounded-xl border p-3 space-y-1.5 transition-all ${batchHasFilters ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Trang Lô hàng</p>
            {batchHasFilters && (
              <button onClick={resetBatchFilters} className="text-[10px] text-indigo-500 hover:underline">Reset</button>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Trạng thái:</span>
              <span className={`font-bold ${batchFilterStatus !== 'ALL' ? 'text-indigo-600' : 'text-slate-400'}`}>{batchFilterStatus}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Năm / Tháng:</span>
              <span className={`font-bold ${(batchFilterYear !== 'ALL' || batchFilterMonth !== 'ALL') ? 'text-indigo-600' : 'text-slate-400'}`}>
                {batchFilterYear === 'ALL' ? '—' : batchFilterYear} / {batchFilterMonth === 'ALL' ? '—' : `T${batchFilterMonth}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Sắp xếp:</span>
              <span className="font-bold text-slate-500">{batchSortConfig.key} {batchSortConfig.direction}</span>
            </div>
          </div>
        </div>

        {/* Sản phẩm */}
        <div className={`rounded-xl border p-3 space-y-1.5 transition-all ${productHasFilters ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Trang Sản phẩm</p>
            {productHasFilters && (
              <button onClick={resetProductFilters} className="text-[10px] text-emerald-600 hover:underline">Reset</button>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Nguồn gốc:</span>
              <span className={`font-bold ${productFilterType !== 'ALL' ? 'text-emerald-600' : 'text-slate-400'}`}>{productFilterType}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Trạng thái:</span>
              <span className={`font-bold ${productFilterStatus !== 'ALL' ? 'text-emerald-600' : 'text-slate-400'}`}>{productFilterStatus}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Sắp xếp:</span>
              <span className="font-bold text-slate-500">{productSort.key} {productSort.direction}</span>
            </div>
          </div>
        </div>

        {/* Kết quả Lab */}
        <div className={`rounded-xl border p-3 space-y-1.5 transition-all ${testResultHasFilters ? 'bg-cyan-50 border-cyan-100' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Kết quả Lab</p>
            {testResultHasFilters && (
              <button onClick={resetTestResultFilters} className="text-[10px] text-cyan-600 hover:underline">Reset</button>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Năm / Tháng:</span>
              <span className={`font-bold ${(testResultFilterYear !== 'ALL' || testResultFilterMonth !== 'ALL') ? 'text-cyan-600' : 'text-slate-400'}`}>
                {testResultFilterYear === 'ALL' ? '—' : testResultFilterYear} / {testResultFilterMonth === 'ALL' ? '—' : `T${testResultFilterMonth}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Sản phẩm:</span>
              <span className={`font-bold ${testResultFilterProductId ? 'text-cyan-600' : 'text-slate-400'}`}>
                {testResultFilterProductId ? '● Đã chọn' : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Sắp xếp:</span>
              <span className="font-bold text-slate-500">{testResultSortConfig.key} {testResultSortConfig.direction}</span>
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
  const { resetToDemoData, clearAllData, loadBackup, addProductFormula, updateProductFormula, tccsList, productFormulas } = useAppStore(useShallow(state => ({
    resetToDemoData: state.resetToDemoData,
    clearAllData: state.clearAllData,
    loadBackup: state.loadBackup,
    addProductFormula: state.addProductFormula,
    updateProductFormula: state.updateProductFormula,
    tccsList: state.tccsList,
    productFormulas: state.productFormulas
  })));

  // Generic confirmation modal state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // ─── AI API Key State ──────────────────────────────────────────────
  const [apiKeyInput, setApiKeyInput] = useState(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  // ─── AI Model and Thinking Mode States ──────────────────────────────
  const [defaultModel, setDefaultModel] = useState(() => localStorage.getItem('GEMINI_MODEL') || 'gemini-2.5-flash');
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(() => localStorage.getItem('GEMINI_THINKING_ENABLED') !== 'false');

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
  const aiLearnedMappings = useAppStore(state => state.aiLearnedMappings) || [];
  const hasEnvKey = !!(import.meta as any).env?.VITE_GEMINI_API_KEY;
  const hasLocalKey = !!localStorage.getItem('GEMINI_API_KEY');
  const isAiConfigured = hasEnvKey || hasLocalKey;

  // Tối ưu 2: Gom nhóm selectors của useUIStore
  const { decimalSeparator, setDecimalSeparator, dateFormat, setDateFormat,
    rowsPerPage, setRowsPerPage,
    defaultBatchFilter, setDefaultBatchFilter,
    defaultTestResultFilter, setDefaultTestResultFilter,
    searchHistory, clearSearchHistory,
    resetPreferences,
    googleDriveFolderUrl, googleDriveFolderId, googleDriveClientId, googleDriveApiKey, useGoogleDriveUpload,
    setGoogleDriveFolderUrl, setGoogleDriveClientId, setGoogleDriveApiKey, setUseGoogleDriveUpload
  } = useUIStore() as any;

  const openConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmProps({ title, message, onConfirm });
    setIsConfirmOpen(true);
  };

  const handleExportData = async () => {
    try {
      // Lấy toàn bộ dữ liệu TestResults từ Firebase để đảm bảo backup đầy đủ
      // (Vì trong state của AppContext hiện tại testResults chỉ là mảng rỗng)
      const trSnapshot = await get(ref(db, 'testResults'));
      const allTestResults = trSnapshot.exists() ? Object.values(trSnapshot.val()) : [];

      // Giả lập lại fullData để tương thích với cấu trúc Export cũ
      const fullData: any = { testResults: allTestResults };
      const currentState = useAppStore.getState();
      ['products', 'batches', 'tccsList', 'productFormulas', 'rawMaterials', 'criteriaAliases', 'aiLearnedMappings'].forEach(key => {
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
      console.error("Lỗi khi tạo bản sao lưu:", error);
      alert("Không thể tạo bản sao lưu. Vui lòng kiểm tra kết nối mạng.");
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
             throw new Error("File không phải là JSON hợp lệ");
          }
          
          if (!Array.isArray(data.products) || !Array.isArray(data.batches) || !Array.isArray(data.testResults)) {
             throw new Error("Cấu trúc dữ liệu bị thiếu (products, batches, hoặc testResults)");
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
  const normalizeAndParseContent = (contentStr: string): { value: number, unit: string } => {
    if (!contentStr) return { value: 0, unit: '' };
    // Chuẩn hóa: thay dấu phẩy, xử lý ký hiệu 1.5x10^6 và 10^6
    let s = contentStr.toLowerCase().trim().replace(/,/g, '.');
    s = s.replace(/([\d.]+)\s*x\s*10\s*\^\s*(-?\d+)/g, '$1e$2'); // 1.5 x 10^3 -> 1.5e3
    s = s.replace(/10\s*\^\s*(-?\d+)/g, '1e$2'); // 10^3 -> 1e3
    const match = s.match(/^(-?[\d.]+(?:e[+-]?\d+)?)\s*(.*)/);
    return match ? { value: parseFloat(match[1]), unit: match[2].trim() } : { value: 0, unit: contentStr };
  };

  // Admin utilities have been cleaned up as the data migration is complete.

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-700">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">Cấu hình Hệ thống</h1>
        <p className="text-slate-500 mt-1">Quản lý cơ sở dữ liệu và các thiết lập nâng cao.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Format Configuration */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center gap-3 border-b pb-3">
            <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
              <Settings2 size={20} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Cấu hình Định dạng</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Number Format */}
            <div className="space-y-3">
               <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                 <Hash size={16} /> Định dạng số (Thập phân)
               </label>
               <div className="grid grid-cols-2 gap-3">
                 <button 
                   onClick={() => setDecimalSeparator('dot')}
                   className={`p-3 rounded-xl border text-left transition-all ${decimalSeparator === 'dot' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                 >
                    <div className="font-bold text-slate-800 text-sm">Dấu chấm (.)</div>
                    <div className="text-[10px] text-slate-500 mt-1">VD: 1,234.56</div>
                 </button>
                 <button 
                   onClick={() => setDecimalSeparator('comma')}
                   className={`p-3 rounded-xl border text-left transition-all ${decimalSeparator === 'comma' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                 >
                    <div className="font-bold text-slate-800 text-sm">Dấu phẩy (,)</div>
                    <div className="text-[10px] text-slate-500 mt-1">VD: 1.234,56</div>
                 </button>
               </div>
            </div>

            {/* Date Format */}
            <div className="space-y-3">
               <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                 <Calendar size={16} /> Định dạng ngày tháng
               </label>
               <select 
                 value={dateFormat} 
                 onChange={(e) => setDateFormat(e.target.value)}
                 className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
               >
                 <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</option>
                 <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</option>
                 <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</option>
               </select>
               <p className="text-[10px] text-slate-400 italic">
                 Lưu ý: Cấu hình này áp dụng cho việc hiển thị và nhập liệu ngày tháng trên toàn hệ thống.
               </p>
            </div>
          </div>
        </section>

        {/* === PERSONALIZATION SECTION === */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5 lg:col-span-2">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
                <UserCircle2 size={20} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Cá nhân hóa</h3>
                <p className="text-xs text-slate-400">Tùy chỉnh thói quen sử dụng — lưu riêng cho từng tài khoản trên thiết bị này.</p>
              </div>
            </div>
            <button
              onClick={() => openConfirmation(
                'Đặt lại về mặc định',
                'Toàn bộ tùy chỉnh cá nhân (bộ lọc, số dòng, v.v.) sẽ bị reset. Bạn có chắc chắn?',
                resetPreferences
              )}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
            >
              <RotateCcw size={13} />
              Reset mặc định
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Rows per page */}
            <div className="space-y-2.5">
              <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                <Rows3 size={15} /> Số dòng mỗi trang
              </label>
              <div className="grid grid-cols-4 gap-2">
                {([10, 20, 50, 100] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setRowsPerPage(n)}
                    className={`py-2 rounded-xl border text-sm font-bold transition-all ${
                      rowsPerPage === n
                        ? 'bg-violet-50 border-violet-200 text-violet-700 ring-1 ring-violet-200'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Default Batch Filter */}
            <div className="space-y-2.5">
              <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                <ListFilter size={15} /> Bộ lọc Lô hàng mặc định
              </label>
              <select
                value={defaultBatchFilter}
                onChange={(e) => setDefaultBatchFilter(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border-none rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-violet-100"
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
              <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                <BarChart3 size={15} /> Bộ lọc KQ kiểm nghiệm
              </label>
              <select
                value={defaultTestResultFilter}
                onChange={(e) => setDefaultTestResultFilter(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border-none rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-violet-100"
              >
                <option value="ALL">Tất cả</option>
                <option value="PASS">Đạt (PASS)</option>
                <option value="FAIL">Không đạt (FAIL)</option>
              </select>
            </div>
          </div>

          {/* Search History */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                <Search size={15} /> Lịch sử tìm kiếm
                <span className="text-xs font-normal text-slate-400">({searchHistory.length}/10 mục)</span>
              </label>
              {searchHistory.length > 0 && (
                <button
                  onClick={() => openConfirmation(
                    'Xóa lịch sử tìm kiếm',
                    'Toàn bộ lịch sử tìm kiếm đã lưu sẽ bị xóa.',
                    clearSearchHistory
                  )}
                  className="text-xs text-red-400 hover:text-red-600 hover:underline transition-colors"
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
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium"
                  >
                    <Search size={10} className="text-slate-400" />
                    {q}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Chưa có lịch sử tìm kiếm nào.</p>
            )}
          </div>

          {/* Cookie Management */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cookie size={15} className="text-amber-500" />
                <div>
                  <p className="text-sm font-bold text-slate-600">Quản lý Cookie</p>
                  <p className="text-xs text-slate-400">Đặt lại lựa chọn đồng ý cookie để hiển thị lại banner thông báo.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  resetConsent();
                  window.location.reload();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-600 border border-amber-200 bg-amber-50 rounded-lg hover:bg-amber-100 transition-all"
              >
                <ChevronRight size={13} />
                Đặt lại Cookie
              </button>
            </div>
          </div>

          {/* Saved Filter Status */}
          <FilterStatusPanel />
        </section>

        {/* === AI CONFIGURATION SECTION === */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5 lg:col-span-2">
          <div className="flex items-center gap-3 border-b pb-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Cấu hình AI (Gemini)</h3>
              <p className="text-xs text-slate-400">Quản lý API Key và xem thống kê học máy của hệ thống AI.</p>
            </div>
          </div>

          {/* Trạng thái AI */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
            isAiConfigured
              ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
              : 'bg-amber-50 border-amber-100 text-amber-700'
          }`}>
            {isAiConfigured
              ? <CheckCircle2 size={18} className="flex-shrink-0" />
              : <AlertTriangle size={18} className="flex-shrink-0" />}
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
            <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
              <KeyRound size={15} />
              Gemini API Key cá nhân
              <span className="text-[10px] font-normal text-slate-400">(lưu cục bộ trên thiết bị này, không đồng bộ cloud)</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Bot size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Dán Gemini API Key vào đây (AIza...)"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                onClick={handleSaveApiKey}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${
                  apiKeySaved
                    ? 'bg-emerald-500 text-white shadow-emerald-100'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                }`}
              >
                {apiKeySaved ? '✓ Đã lưu!' : 'Lưu Key'}
              </button>
              {(apiKeyInput || hasLocalKey) && (
                <button
                  onClick={handleClearApiKey}
                  className="px-3 py-2.5 rounded-xl text-sm font-bold text-red-500 border border-red-100 hover:bg-red-50 transition-all"
                >
                  Xóa
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400 italic pl-1">
              Lấy API Key miễn phí tại{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline font-medium">Google AI Studio</a>.
              {' '}Key cá nhân sẽ ưu tiên dùng thay cho key chung, giúp tránh lỗi vượt hạn mức (429).
            </p>
          </div>

          {/* Cấu hình mô hình và suy luận */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                <Bot size={15} className="text-indigo-500" />
                Mô hình mặc định
              </label>
              <select
                value={defaultModel}
                onChange={(e) => handleSaveModel(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-xs outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
              >
                <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash (Mặc định - Nhanh)</option>
                <option value="gemini-2.5-pro">🧠 Gemini 2.5 Pro (Suy luận chuyên sâu)</option>
              </select>
              <p className="text-[10px] text-slate-400 italic pl-1">
                Pro cung cấp câu trả lời sắc sảo hơn nhưng phản hồi lâu hơn.
              </p>
            </div>
            
            <div className="space-y-1.5 flex flex-col justify-between">
              <label className="text-sm font-bold text-slate-650 flex items-center gap-2">
                <Sparkles size={15} className="text-indigo-500" />
                Chế độ suy luận (Chain of Thought)
              </label>
              <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl h-[42px] px-3.5">
                <span className="text-xs text-slate-600 font-semibold">Hiện quy trình suy nghĩ</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isThinkingEnabled}
                    onChange={(e) => handleToggleThinking(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-slate-205 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-650"></div>
                </label>
              </div>
              <p className="text-[10px] text-slate-400 italic pl-1">
                AI sẽ giải thích quy trình lập luận từng bước trước khi trả lời.
              </p>
            </div>
          </div>

          {/* Thống kê Learned Mappings */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                <Bot size={15} className="text-indigo-500" />
                Cơ sở Kiến thức AI đã học
                <span className="text-xs font-normal text-slate-400">({aiLearnedMappings.length} ánh xạ)</span>
              </label>
            </div>
            {aiLearnedMappings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {aiLearnedMappings.slice(0, 20).map((m: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-100">
                    <span className="text-slate-500 truncate max-w-[120px]" title={m.originalName}>{m.originalName}</span>
                    <span className="text-slate-300 flex-shrink-0">→</span>
                    <span className="text-indigo-700 font-bold truncate max-w-[120px]" title={m.systemName}>{m.systemName}</span>
                    <span className="ml-auto text-[9px] text-slate-400 flex-shrink-0">×{m.frequency}</span>
                  </div>
                ))}
                {aiLearnedMappings.length > 20 && (
                  <p className="text-[10px] text-slate-400 italic col-span-2 text-center">... và {aiLearnedMappings.length - 20} ánh xạ khác</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">
                Chưa có dữ liệu học máy. AI sẽ tự học khi bạn xác nhận ánh xạ tên chỉ tiêu trong quá trình nhập liệu.
              </p>
            )}
          </div>
        </section>

        {/* === GOOGLE DRIVE STORAGE CONFIGURATION === */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5 lg:col-span-2">
          <div className="flex items-center gap-3 border-b pb-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <HardDrive size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Cấu hình Lưu trữ Google Drive</h3>
              <p className="text-xs text-slate-400">Thiết lập thư mục Google Drive để lưu trữ các tài liệu, ảnh chụp, file đính kèm.</p>
            </div>
          </div>

          {/* URL thư mục */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
              <FolderOpen size={16} className="text-indigo-500" />
              Đường dẫn Thư mục Google Drive lưu trữ *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={googleDriveFolderUrl}
                onChange={(e) => setGoogleDriveFolderUrl(e.target.value)}
                placeholder="VD: https://drive.google.com/drive/folders/..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              />
              <button
                type="button"
                onClick={() => window.open(googleDriveFolderUrl || 'https://drive.google.com', '_blank')}
                className="px-4 py-2.5 bg-slate-105 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition flex items-center gap-2"
                title="Mở thư mục kiểm tra"
              >
                <ExternalLink size={15} />
                Mở thư mục
              </button>
            </div>
            {googleDriveFolderId && (
              <p className="text-[10px] text-emerald-600 font-bold pl-1">
                ✓ Trích xuất ID thư mục thành công: <span className="font-mono">{googleDriveFolderId}</span>
              </p>
            )}
          </div>

          {/* Checkbox kích hoạt tự động API upload */}
          <div className="pt-2 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-slate-700">Tự động tải lên qua Google API</p>
                <p className="text-xs text-slate-400">Kích hoạt để tự động đẩy file lên Google Drive ngay khi chọn file trên ứng dụng (yêu cầu cấu hình API cá nhân).</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useGoogleDriveUpload}
                  onChange={(e) => setUseGoogleDriveUpload(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {useGoogleDriveUpload && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider pl-1">Google OAuth Client ID</label>
                  <input
                    type="text"
                    value={googleDriveClientId}
                    onChange={(e) => setGoogleDriveClientId(e.target.value)}
                    placeholder="VD: 123456-abcdef.apps.googleusercontent.com"
                    className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider pl-1">Google API Key</label>
                  <input
                    type="password"
                    value={googleDriveApiKey}
                    onChange={(e) => setGoogleDriveApiKey(e.target.value)}
                    placeholder="Nhập Google API Key của bạn..."
                    className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <p className="text-[10px] text-slate-400 italic font-medium">
                  💡 Nếu không bật API tự động tải lên hoặc chưa điền thông tin, hệ thống sẽ sử dụng **Firebase Storage** sẵn có để lưu file, hoặc cho phép bạn nhấn nút mở thư mục Google Drive để thả file rồi dán liên kết thủ công.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Backup & Restore */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b pb-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Database size={20} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Dữ liệu & Sao lưu</h3>
          </div>
          <div className="space-y-3">
            <button 
              onClick={handleExportData}
              className="w-full flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <Download className="text-indigo-500 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <p className="font-bold text-slate-700">Xuất dữ liệu (.json)</p>
                  <p className="text-xs text-slate-400">Tải toàn bộ cơ sở dữ liệu về máy.</p>
                </div>
              </div>
            </button>
            <div className="relative">
              <input type="file" accept=".json" onChange={handleImportData} className="hidden" id="import-input" />
              <label 
                htmlFor="import-input"
                className="w-full flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white hover:shadow-md transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Upload className="text-emerald-500 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <p className="font-bold text-slate-700">Khôi phục dữ liệu</p>
                    <p className="text-xs text-slate-400">Tải lên tệp sao lưu .json đã có.</p>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </section>

        {/* Development Tools */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b pb-3">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <ShieldAlert size={20} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Tiện ích Admin</h3>
          </div>
          <div className="space-y-3">
            <button 
              onClick={() => openConfirmation(
                'Nạp dữ liệu mẫu',
                'Tải dữ liệu mẫu sẽ xóa sạch dữ liệu hiện tại. Bạn có chắc chắn muốn đồng ý?',
                resetToDemoData
              )}
              className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-100 transition-all group"
            >
              <div className="flex items-center gap-3">
                <RefreshCcw className="text-indigo-500 group-hover:rotate-180 transition-transform duration-500" />
                <div className="text-left">
                  <p className="font-bold text-slate-700">Nạp dữ liệu mẫu</p>
                  <p className="text-xs text-slate-400">Reset và dùng bộ dữ liệu demo.</p>
                </div>
              </div>
            </button>
            <button 
              onClick={() => openConfirmation(
                'XÓA SẠCH DỮ LIỆU',
                'HÀNH ĐỘNG NÀY KHÔNG THỂ KHÔI PHỤC! Bạn có hoàn toàn chắc chắn muốn xóa toàn bộ dữ liệu ngay bây giờ không?',
                clearAllData
              )}
              className="w-full flex items-center justify-between p-3 border border-red-50 rounded-xl hover:bg-red-50 hover:border-red-100 transition-all group"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="text-red-500 group-hover:animate-bounce" />
                <div className="text-left">
                  <p className="font-bold text-red-700">Xóa sạch vĩnh viễn</p>
                  <p className="text-xs text-red-400">Xóa dữ liệu trên Cloud và Máy cục bộ.</p>
                </div>
              </div>
            </button>
          </div>
        </section>
      </div>

      <div className="bg-indigo-900 rounded-2xl p-8 text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
          <div className="bg-white/10 p-3 rounded-xl backdrop-blur-md border border-white/20">
             <FileJson size={32} />
          </div>
          <div className="space-y-2">
            <h4 className="text-2xl font-bold">QA Manager v2.5 Enterprise</h4>
            <p className="text-indigo-200 text-sm leading-relaxed max-w-xl">Hệ thống đang hoạt động trong chế độ <b>Offline-First</b>. Dữ liệu của bạn được đồng bộ tự động lên Firebase Realtime Database ngay khi có kết nối mạng. Hãy đảm bảo bạn đã sao lưu dữ liệu trước khi thực hiện các thay đổi cấu trúc lớn.</p>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full -ml-10 -mb-10 blur-3xl" />
      </div>

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title={confirmProps.title}
        message={confirmProps.message}
        onConfirm={() => { confirmProps.onConfirm(); setIsConfirmOpen(false); }}
        confirmText="Xác nhận"
        icon={ShieldAlert}
      />
    </div>
  );
};

export default SettingsPage;
