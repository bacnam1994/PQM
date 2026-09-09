import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Package, Layers, FileText, Activity, TrendingUp, AlertTriangle, 
  Settings, Users, ArrowRight, CornerDownLeft, Sparkles, X, ShieldAlert,
  FlaskConical, GitPullRequest, Zap
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { 
  searchUniversal, 
  UniversalSearchResult, 
  SearchResultCategory 
} from '../../services/core/universalSearchIndex';

const categoryIconMap: Record<SearchResultCategory, React.ElementType> = {
  PRODUCT: Package,
  BATCH: Layers,
  TCCS: FileText,
  TEST_RESULT: Activity,
  MATERIAL: FlaskConical,
  DEVIATION: AlertTriangle,
  CHANGE_CONTROL: GitPullRequest,
  ACTION: Zap,
  PAGE: ArrowRight
};

const categoryLabelMap: Record<SearchResultCategory, string> = {
  PRODUCT: 'Sản phẩm',
  BATCH: 'Lô sản xuất',
  TCCS: 'Tiêu chuẩn (TCCS)',
  TEST_RESULT: 'Phiếu kiểm nghiệm',
  MATERIAL: 'Nguyên vật liệu',
  DEVIATION: 'Sai lệch (Deviation)',
  CHANGE_CONTROL: 'Yêu cầu Thay đổi (CR)',
  ACTION: 'Tác vụ nhanh',
  PAGE: 'Trang hệ thống'
};

export const GlobalCommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { products, batches, tccsList, testResults, rawMaterials, role } = useAppStore(
    useShallow(s => ({
      products: s.products,
      batches: s.batches,
      tccsList: s.tccsList,
      testResults: s.testResults,
      rawMaterials: s.rawMaterials,
      role: s.role,
    }))
  );

  // Lắng nghe sự kiện toggle mở/đóng palette từ CustomEvent hoặc Ctrl+K
  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    const handleClose = () => setIsOpen(false);

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('pqm:toggle-command-palette', handleToggle);
    window.addEventListener('pqm:close-modals', handleClose);
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('pqm:toggle-command-palette', handleToggle);
      window.removeEventListener('pqm:close-modals', handleClose);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isOpen]);

  // Tự động focus vào input khi mở
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Tìm kiếm dữ liệu đa phân hệ bằng universalSearchIndex
  const searchResults: UniversalSearchResult[] = useMemo(() => {
    return searchUniversal(searchQuery, {
      products,
      batches,
      tccsList,
      testResults,
      rawMaterials
    }, 18);
  }, [searchQuery, products, batches, tccsList, testResults, rawMaterials]);

  // Điều hướng và đóng modal
  const handleSelect = (item: UniversalSearchResult) => {
    setIsOpen(false);
    navigate(item.path);
  };

  // Xử lý phím bấm lên/xuống/enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        handleSelect(searchResults[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center pt-20 px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Tìm nhanh Sản phẩm, Số lô, TCCS, Hoạt chất, CAS, Sai lệch... (Ctrl+K)"
            className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-base outline-none font-medium"
          />
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-2"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 flex-1 space-y-1">
          {searchResults.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Không tìm thấy kết quả phù hợp cho "{searchQuery}"</p>
            </div>
          ) : (
            searchResults.map((item, index) => {
              const Icon = categoryIconMap[item.category] || ArrowRight;
              const isSelected = index === selectedIndex;
              const categoryLabel = categoryLabelMap[item.category] || item.category;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 border border-blue-200/60 dark:border-blue-800/60' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isSelected 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate text-slate-900 dark:text-slate-100">
                          {item.title}
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {categoryLabel}
                        </span>
                        {item.badge && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.badgeColor === 'green' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' :
                            item.badgeColor === 'red' ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300' :
                            item.badgeColor === 'amber' ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' :
                            item.badgeColor === 'purple' ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300' :
                            'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-semibold pl-2 shrink-0">
                      <span>Mở</span>
                      <CornerDownLeft size={13} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer phím tắt */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-xs text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-xs text-[10px]">↓</kbd> Di chuyển
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-xs text-[10px]">Enter</kbd> Chọn
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-xs text-[10px]">Esc</kbd> Đóng
            </span>
          </div>
          <span className="font-semibold text-blue-600 dark:text-blue-400">PQM Universal 2.0</span>
        </div>
      </div>
    </div>
  );
};
