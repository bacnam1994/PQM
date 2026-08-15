import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Package, Layers, FileText, Activity, TrendingUp, AlertTriangle, 
  Settings, Users, ArrowRight, CornerDownLeft, Sparkles, X, ShieldAlert
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

interface PaletteItem {
  id: string;
  category: 'Trang' | 'Sản phẩm' | 'Lô sản xuất' | 'TCCS' | 'Phiếu kiểm nghiệm';
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  path: string;
  badge?: string;
}

export const GlobalCommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { products, batches, tccsList, testResults, role } = useAppStore(
    useShallow(s => ({
      products: s.products,
      batches: s.batches,
      tccsList: s.tccsList,
      testResults: s.testResults,
      role: s.role,
    }))
  );

  // Lắng nghe sự kiện toggle mở/đóng palette từ CustomEvent
  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    const handleClose = () => setIsOpen(false);

    window.addEventListener('pqm:toggle-command-palette', handleToggle);
    window.addEventListener('pqm:close-modals', handleClose);

    return () => {
      window.removeEventListener('pqm:toggle-command-palette', handleToggle);
      window.removeEventListener('pqm:close-modals', handleClose);
    };
  }, []);

  // Tự động focus vào input khi mở
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Danh mục điều hướng trang mặc định
  const staticNavigationItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [
      { id: 'nav-dash', category: 'Trang', title: 'Bảng điều khiển (Dashboard)', subtitle: 'Tổng quan chỉ số và thống kê', icon: Activity, path: '/' },
      { id: 'nav-prod', category: 'Trang', title: 'Danh sách Sản phẩm', subtitle: 'Quản lý danh mục sản phẩm', icon: Package, path: '/products' },
      { id: 'nav-batch', category: 'Trang', title: 'Quản lý Lô sản xuất', subtitle: 'Theo dõi tiến độ và trạng thái lô', icon: Layers, path: '/batches' },
      { id: 'nav-tccs', category: 'Trang', title: 'Hồ sơ Tiêu chuẩn Cơ sở (TCCS)', subtitle: 'Tra cứu tiêu chuẩn kỹ thuật', icon: FileText, path: '/tccs' },
      { id: 'nav-test', category: 'Trang', title: 'Phiếu kiểm nghiệm', subtitle: 'Danh sách kết quả kiểm nghiệm Lab', icon: Activity, path: '/test-results' },
      { id: 'nav-trend', category: 'Trang', title: 'Phân tích Xu hướng Chất lượng', subtitle: 'Biểu đồ biến động và trôi chỉ tiêu', icon: TrendingUp, path: '/reports/trend-analysis' },
      { id: 'nav-alerts', category: 'Trang', title: 'Cảnh báo Bất thường', subtitle: 'Cảnh báo hạn dùng, drift, fail rate', icon: AlertTriangle, path: '/alerts' },
      { id: 'nav-settings', category: 'Trang', title: 'Cài đặt Hệ thống', subtitle: 'Tùy chỉnh giao diện và tài khoản', icon: Settings, path: '/settings' },
    ];

    if (role === 'ADMIN') {
      items.push(
        { id: 'nav-users', category: 'Trang', title: 'Quản lý Người dùng & Phân quyền', subtitle: 'Duyệt thành viên và cấp quyền Admin', icon: Users, path: '/users', badge: 'Admin' },
        { id: 'nav-alias', category: 'Trang', title: 'Quản lý Alias Chỉ tiêu TCCS', subtitle: 'Cấu hình tương thích ngược tên chỉ tiêu', icon: Sparkles, path: '/criteria-aliases', badge: 'Admin' }
      );
    }
    return items;
  }, [role]);

  // Tìm kiếm dữ liệu động trên toàn bộ hệ thống
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return staticNavigationItems;
    }

    const results: PaletteItem[] = [];

    // 1. Lọc trang tĩnh
    staticNavigationItems.forEach(item => {
      if (item.title.toLowerCase().includes(q) || item.subtitle?.toLowerCase().includes(q)) {
        results.push(item);
      }
    });

    // 2. Tìm Sản phẩm
    products.forEach(p => {
      if (p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.registrationNo?.toLowerCase().includes(q)) {
        results.push({
          id: `p-${p.id}`,
          category: 'Sản phẩm',
          title: p.name,
          subtitle: `Mã: ${p.code} | SĐK: ${p.registrationNo || '---'}`,
          icon: Package,
          path: `/products/${p.id}`,
        });
      }
    });

    // 3. Tìm Lô sản xuất
    batches.forEach(b => {
      if (b.batchNo.toLowerCase().includes(q)) {
        const prod = products.find(p => p.id === b.productId);
        results.push({
          id: `b-${b.id}`,
          category: 'Lô sản xuất',
          title: `Lô ${b.batchNo}`,
          subtitle: `SP: ${prod?.name || b.productId} | Trạng thái: ${b.status}`,
          icon: Layers,
          path: `/batches/${b.id}`,
          badge: b.status,
        });
      }
    });

    // 4. Tìm TCCS
    tccsList.forEach(t => {
      if (t.code.toLowerCase().includes(q)) {
        const prod = products.find(p => p.id === t.productId);
        results.push({
          id: `t-${t.id}`,
          category: 'TCCS',
          title: `TCCS: ${t.code}`,
          subtitle: `Áp dụng cho: ${prod?.name || t.productId}`,
          icon: FileText,
          path: `/tccs/detail/${t.id}`,
        });
      }
    });

    // 5. Tìm Phiếu kiểm nghiệm
    testResults.forEach(tr => {
      if (tr.id.toLowerCase().includes(q) || tr.labName?.toLowerCase().includes(q)) {
        results.push({
          id: `tr-${tr.id}`,
          category: 'Phiếu kiểm nghiệm',
          title: `Phiếu KN: ...${tr.id.slice(-6)}`,
          subtitle: `Lab: ${tr.labName || 'Nội bộ'} | Ngày: ${tr.testDate} | Kết quả: ${tr.overallStatus}`,
          icon: Activity,
          path: `/test-results/coa/${tr.batchId}`,
          badge: tr.overallStatus,
        });
      }
    });

    return results.slice(0, 15); // Giới hạn 15 kết quả hàng đầu
  }, [searchQuery, staticNavigationItems, products, batches, tccsList, testResults]);

  // Điều hướng và đóng modal
  const handleSelect = (item: PaletteItem) => {
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
            placeholder="Tìm nhanh Sản phẩm, Lô, TCCS, Phiếu KN, Chức năng... (Ctrl+K)"
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
              const isSelected = index === selectedIndex;
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                    isSelected 
                      ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-900 dark:text-primary-100 shadow-sm' 
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isSelected 
                        ? 'bg-primary-100 dark:bg-primary-900/60 text-primary-600 dark:text-primary-400' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{item.title}</span>
                        {item.badge && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            item.badge === 'PASS' || item.badge === 'RELEASED'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : item.badge === 'FAIL' || item.badge === 'REJECTED'
                              ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                              : 'bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          <span className="font-medium text-slate-500 dark:text-slate-400">[{item.category}]</span> {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-2">
                    {isSelected ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-primary-600 dark:text-primary-400 bg-primary-100/60 dark:bg-primary-900/40 px-2 py-1 rounded-md">
                        Chọn <CornerDownLeft size={12} />
                      </span>
                    ) : (
                      <ArrowRight size={14} className="text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-medium">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-xs text-slate-600 dark:text-slate-300">↑</kbd> <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-xs text-slate-600 dark:text-slate-300">↓</kbd> Di chuyển</span>
            <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-xs text-slate-600 dark:text-slate-300">Enter</kbd> Chọn</span>
            <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-xs text-slate-600 dark:text-slate-300">Esc</kbd> Đóng</span>
          </div>
          <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
            <Sparkles size={12} /> PQM Pro Search
          </span>
        </div>
      </div>
    </div>
  );
};
export default GlobalCommandPalette;
