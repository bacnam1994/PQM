import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  CubeIcon,
  Square3Stack3DIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
  ArrowPathRoundedSquareIcon,
  BoltIcon,
  ArrowRightIcon,
  XMarkIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import {
  searchUniversal,
  UniversalSearchResult,
  SearchResultCategory,
} from '../../services/core/universalSearchIndex';

const categoryIconMap: Record<SearchResultCategory, React.ElementType> = {
  PRODUCT: CubeIcon,
  BATCH: Square3Stack3DIcon,
  TCCS: DocumentTextIcon,
  TEST_RESULT: ClipboardDocumentCheckIcon,
  MATERIAL: BeakerIcon,
  DEVIATION: ExclamationTriangleIcon,
  CHANGE_CONTROL: ArrowPathRoundedSquareIcon,
  ACTION: BoltIcon,
  PAGE: ArrowRightIcon,
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
  PAGE: 'Trang hệ thống',
};

export const GlobalCommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { products, batches, tccsList, testResults, rawMaterials, testingLaboratories } =
    useAppStore(
      useShallow((s) => ({
        products: s.products,
        batches: s.batches,
        tccsList: s.tccsList,
        testResults: s.testResults,
        rawMaterials: s.rawMaterials,
        testingLaboratories: s.testingLaboratories,
      }))
    );

  // Lắng nghe sự kiện toggle mở/đóng palette từ CustomEvent hoặc Ctrl+K
  useEffect(() => {
    const handleToggle = () => setIsOpen((prev) => !prev);
    const handleClose = () => setIsOpen(false);

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
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
    return searchUniversal(
      searchQuery,
      {
        products,
        batches,
        tccsList,
        testResults,
        rawMaterials,
        laboratories: testingLaboratories,
      },
      18
    );
  }, [searchQuery, products, batches, tccsList, testResults, rawMaterials, testingLaboratories]);

  // Điều hướng và đóng modal
  const handleSelect = (item: UniversalSearchResult) => {
    setIsOpen(false);
    navigate(item.path);
  };

  // Xử lý phím bấm lên/xuống/enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        handleSelect(searchResults[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center pt-20 px-4 bg-black/40 dark:bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-border/80 bg-surface">
          <MagnifyingGlassIcon className="w-5 h-5 text-ink-faint shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Tìm nhanh Sản phẩm, Số lô, TCCS, Hoạt chất, CAS, Sai lệch... (Ctrl+K)"
            className="w-full bg-transparent text-ink placeholder-ink-faint text-sm sm:text-base outline-none font-medium"
          />
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-2 transition-colors ml-2"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 flex-1 space-y-1">
          {searchResults.length === 0 ? (
            <div className="py-12 text-center text-ink-faint">
              <MagnifyingGlassIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">
                Không tìm thấy kết quả phù hợp cho "{searchQuery}"
              </p>
            </div>
          ) : (
            searchResults.map((item, index) => {
              const Icon = categoryIconMap[item.category] || ArrowRightIcon;
              const isSelected = index === selectedIndex;
              const categoryLabel = categoryLabelMap[item.category] || item.category;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium ring-1 ring-emerald-500/20'
                      : 'hover:bg-surface-2 text-ink border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-surface-2 text-ink-muted'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate text-ink">
                          {item.title}
                        </span>
                        <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-surface-3/60 text-ink-muted border border-border">
                          {categoryLabel}
                        </span>
                        {item.badge && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              item.badgeColor === 'green'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : item.badgeColor === 'red'
                                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                  : item.badgeColor === 'amber'
                                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                    : item.badgeColor === 'purple'
                                      ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-xs text-ink-muted truncate mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold pl-2 shrink-0">
                      <span>Mở</span>
                      <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer phím tắt */}
        <div className="px-4 py-2.5 bg-surface-2 border-t border-border flex items-center justify-between text-xs text-ink-faint">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded shadow-2xs text-[10px] font-mono">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded shadow-2xs text-[10px] font-mono">
                ↓
              </kbd>{' '}
              Di chuyển
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded shadow-2xs text-[10px] font-mono">
                Enter
              </kbd>{' '}
              Chọn
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded shadow-2xs text-[10px] font-mono">
                Esc
              </kbd>{' '}
              Đóng
            </span>
          </div>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            PQM Universal 2.0
          </span>
        </div>
      </div>
    </div>
  );
};
