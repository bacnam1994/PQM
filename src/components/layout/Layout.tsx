import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, FileText, ClipboardCheck, Settings, 
  Menu, X, Leaf, Cloud, CloudOff, RefreshCw, Layers,
  LogOut, User as UserIcon, FlaskConical, Users, Activity,
  ChevronDown, Search, Moon, Sun, ShieldAlert
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { AIAssistantChat } from '../features/AIAssistantChat';
import { useQualityAlerts } from '../../hooks/useQualityAlerts';

// Tối ưu 1: Đưa cấu hình Menu tĩnh ra ngoài Component
// Tránh việc mảng bị khởi tạo lại liên tục mỗi khi chuyển trang hoặc gõ tìm kiếm
const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { 
    name: 'Danh mục', 
    icon: Package,
    children: [
      { name: 'Sản phẩm', path: '/products', icon: Package },
      { name: 'Nguyên liệu', path: '/materials', icon: Layers },
      { name: 'Chỉ tiêu', path: '/criteria', icon: Activity },
    ]
  },
  { 
    name: 'Hồ sơ', 
    icon: FileText,
    children: [
      { name: 'Hồ sơ TCCS', path: '/tccs', icon: FileText },
      { name: 'Công thức sản phẩm', path: '/product-formulas', icon: FlaskConical },
    ]
  },
  { 
    name: 'Nghiệp vụ', 
    icon: Layers,
    children: [
      { name: 'Quản lý Lô', path: '/batches', icon: Layers },
      { name: 'Kiểm soát Lab', path: '/test-results', icon: ClipboardCheck },
      { name: 'Báo cáo tổng hợp', path: '/reports/quality-summary', icon: FileText },
    ]
  },
  { 
    name: 'Hệ thống', 
    icon: Settings,
    children: [
      { name: 'Người dùng', path: '/users', icon: Users, adminOnly: true },
      { name: 'Cấu hình', path: '/settings', icon: Settings },
    ]
  }
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const lastSync = useAppStore(state => state.lastSync);
  const syncStatus = useAppStore(state => state.syncStatus);
  const user = useAppStore(state => state.user);
  const role = useAppStore(state => state.role);
  const logout = useAppStore(state => state.logout);
  const theme = useAppStore(state => state.theme);
  const setTheme = useAppStore(state => state.setTheme);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const { products, batches, tccsList, rawMaterials } = useAppStore(useShallow(s => ({
    products: s.products,
    batches: s.batches,
    tccsList: s.tccsList,
    rawMaterials: s.rawMaterials
  })));

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const searchResults = React.useMemo(() => {
    if (!searchTerm.trim()) return null;
    const lowerQuery = searchTerm.toLowerCase();
    return {
      products: products.filter(p => p.name.toLowerCase().includes(lowerQuery) || p.code.toLowerCase().includes(lowerQuery)).slice(0, 3),
      batches: batches.filter(b => b.batchNo.toLowerCase().includes(lowerQuery)).slice(0, 3),
      tccs: tccsList.filter(t => t.code.toLowerCase().includes(lowerQuery)).slice(0, 3),
      materials: rawMaterials.filter(m => m.name.toLowerCase().includes(lowerQuery) || (m.code || '').toLowerCase().includes(lowerQuery)).slice(0, 3)
    };
  }, [searchTerm, products, batches, tccsList, rawMaterials]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
      setSearchTerm(''); 
      setShowDropdown(false);
      searchInputRef.current?.blur();
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      await logout();
      navigate('/login');
    }
  };

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  // Helper to resolve title & subtitle for the topbar based on active route
  const getPageHeaderInfo = (pathname: string) => {
    if (pathname === '/') return { title: 'Bảng điều khiển', subtitle: 'Tổng quan hoạt động nghiệp vụ QMS V-Biotech' };
    if (pathname.startsWith('/products')) return { title: 'Danh mục Sản phẩm', subtitle: 'Quản lý sản phẩm lưu hành và TCCS áp dụng' };
    if (pathname.startsWith('/materials')) return { title: 'Danh mục Nguyên liệu', subtitle: 'Quản lý nguyên vật liệu sản xuất' };
    if (pathname.startsWith('/criteria')) return { title: 'Danh mục Chỉ tiêu', subtitle: 'Quản lý chỉ tiêu kiểm soát chất lượng' };
    if (pathname.startsWith('/tccs')) return { title: 'Hồ sơ TCCS', subtitle: 'Tiêu chuẩn cơ sở áp dụng cho từng sản phẩm' };
    if (pathname.startsWith('/product-formulas')) return { title: 'Công thức Sản phẩm', subtitle: 'Định mức nguyên liệu và công thức chế phẩm' };
    if (pathname.startsWith('/batches')) return { title: 'Quản lý Lô', subtitle: 'Theo dõi trạng thái, hồ sơ và kiểm nghiệm lô sản xuất' };
    if (pathname.startsWith('/test-results')) return { title: 'Kiểm soát Lab', subtitle: 'Nhập kết quả kiểm nghiệm và phát hành CoA' };
    if (pathname.startsWith('/reports')) return { title: 'Báo cáo tổng hợp', subtitle: 'Thống kê chất lượng và báo cáo định kỳ' };
    if (pathname.startsWith('/users')) return { title: 'Người dùng', subtitle: 'Quản lý tài khoản và phân quyền thành viên' };
    if (pathname.startsWith('/settings')) return { title: 'Cấu hình', subtitle: 'Thông tin hệ thống và tùy chọn kết nối API AI' };
    if (pathname.startsWith('/account')) return { title: 'Tài khoản cá nhân', subtitle: 'Thông tin hồ sơ người dùng đang đăng nhập' };
    if (pathname.startsWith('/alerts')) return { title: 'Cảnh báo chất lượng', subtitle: 'Giám sát chỉ tiêu vượt ngưỡng cảnh báo' };
    if (pathname.startsWith('/search')) return { title: 'Kết quả tìm kiếm', subtitle: 'Tìm kiếm dữ liệu toàn hệ thống' };
    return { title: 'Hệ thống QMS', subtitle: 'Nền tảng kiểm soát chất lượng V-Biotech' };
  };

  const headerInfo = getPageHeaderInfo(location.pathname);

  // Format current date dynamically
  const getFormattedDate = () => {
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const now = new Date();
    const dayName = days[now.getDay()];
    const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${dayName}, ${dateStr} · Cập nhật theo thời gian thực`;
  };

  return (
    <div className="shell min-h-screen bg-transparent">
      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-xs transition-opacity xl:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ============ SIDEBAR ============ */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''} transition-all duration-300`} id="sidebar">
        <div className="sb-brand">
          <div className="sb-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 2v6.5L4.5 17a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L15 8.5V2"/><path d="M9 2h6"/><path d="M7.5 14h9"/></svg>
          </div>
          <div className="sb-word">
            <div className="name">V-Biotech</div>
            <div className="tag">QMS Platform</div>
          </div>
        </div>

        <nav className="sb-nav">
          <div className="sb-group-label">Tổng quan</div>
          <Link to="/" className={`sb-item ${location.pathname === '/' ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
            <LayoutDashboard size={18} />
            <span className="label">Bảng điều khiển</span>
          </Link>

          {navItems.slice(1).map((group, idx) => {
            const visibleChildren = group.children.filter(child => !child.adminOnly || role === 'ADMIN');
            if (visibleChildren.length === 0) return null;
            return (
              <React.Fragment key={idx}>
                <div className="sb-group-label">{group.name}</div>
                {visibleChildren.map((child) => {
                  const isActive = location.pathname === child.path || (child.path !== '/' && location.pathname.startsWith(child.path));
                  return (
                    <Link key={child.path} to={child.path} className={`sb-item ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                      <child.icon size={18} />
                      <span className="label">{child.name}</span>
                    </Link>
                  );
                })}
              </React.Fragment>
            );
          })}

          <div className="sb-group-label">Hệ thống</div>
          <button 
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              window.dispatchEvent(new CustomEvent('trigger-ai-chat', { detail: { prompt: 'Tổng quan tình trạng tất cả lô hàng hiện tại' } }));
            }}
            className="sb-item w-full text-left bg-transparent border-none outline-none"
          >
            <Activity size={18} />
            <span className="label">Trợ lý AI</span>
          </button>
          
          <button 
            type="button"
            onClick={handleLogout}
            className="sb-item w-full text-left bg-transparent border-none outline-none text-red-500 hover:bg-red-50/10"
          >
            <LogOut size={18} />
            <span className="label text-red-500">Đăng xuất</span>
          </button>
        </nav>

        <div className="sb-foot">
          <button className="sb-collapse-btn" onClick={toggleSidebar}>
            <ChevronDown className="-rotate-90" size={16} />
            <span className="label">Thu gọn</span>
          </button>
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <div className="main flex flex-col flex-1 min-w-0">
        <header className="topbar">
          <div className="tb-left">
            <div>
              <div className="tb-title">{headerInfo.title}</div>
              <div className="tb-sub">{getFormattedDate()}</div>
            </div>
          </div>
          
          <div className="tb-right">
            {role !== 'GUEST' && (
              <div className="search-box relative group">
                <Search className="text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-zinc-100 transition-colors" size={15} />
                <form onSubmit={handleSearch} className="w-full">
                  <input 
                    ref={searchInputRef}
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    placeholder="Tìm số lô, sản phẩm, chỉ tiêu…" 
                    className="w-full bg-transparent border-none outline-none text-xs text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:ring-0 focus:outline-none"
                  />
                </form>
                {/* Search Dropdown */}
                {showDropdown && searchResults && (
                  <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-zinc-950 rounded-xl shadow-lg border border-zinc-200/50 dark:border-zinc-800/80 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 p-1">
                    <div className="max-h-[60vh] overflow-y-auto custom-scrollbar space-y-1.5 p-1">
                      {searchResults.products.length > 0 && (
                        <div>
                          <div className="px-2.5 py-1 text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5"><Package size={11}/> Sản phẩm</div>
                          {searchResults.products.map(p => (
                            <button key={p.id} type="button" onClick={() => { navigate(`/products/${p.id}`); setSearchTerm(''); setShowDropdown(false); }} className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors flex flex-col">
                              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{p.name}</span>
                              <span className="text-[10px] text-zinc-400 font-medium">{p.code}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.batches.length > 0 && (
                        <div>
                          <div className="px-2.5 py-1 text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5"><Layers size={11}/> Lô hàng</div>
                          {searchResults.batches.map(b => (
                            <button key={b.id} type="button" onClick={() => { navigate(`/batches/${b.id}`); setSearchTerm(''); setShowDropdown(false); }} className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors flex flex-col">
                              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Lô: {b.batchNo}</span>
                              <span className="text-[10px] text-zinc-400 font-medium">NSX: {b.mfgDate || '---'}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.materials.length > 0 && (
                        <div>
                          <div className="px-2.5 py-1 text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5"><Layers size={11}/> Nguyên liệu</div>
                          {searchResults.materials.map(m => (
                            <button key={m.id} type="button" onClick={() => { navigate(`/materials/catalog`); setSearchTerm(''); setShowDropdown(false); }} className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors flex flex-col">
                              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{m.name}</span>
                              <span className="text-[10px] text-zinc-400 font-medium">{m.code || m.id}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.products.length === 0 && searchResults.batches.length === 0 && searchResults.tccs.length === 0 && searchResults.materials.length === 0 && (
                        <div className="p-3 text-center text-xs font-medium text-zinc-400">Không tìm thấy kết quả</div>
                      )}
                    </div>
                    <div className="p-1 border-t border-zinc-100 dark:border-zinc-900">
                      <button type="button" onClick={(e) => { handleSearch(e); }} className="w-full py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-955/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-955/45 rounded-lg transition-colors text-center">
                        Xem tất cả kết quả &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button onClick={toggleTheme} className="icon-btn" title="Chế độ tối/sáng">
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {role !== 'GUEST' && <QualityAlertBadge />}

            <div className="flex items-center gap-2 pl-2 border-l border-zinc-200 dark:border-zinc-800">
              <Link to="/account" className="avatar overflow-hidden">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold">{user?.email ? user.email.slice(0, 2).toUpperCase() : 'US'}</span>
                )}
              </Link>
            </div>

            <button onClick={() => setMobileMenuOpen(!isMobileMenuOpen)} className="xl:hidden icon-btn" title="Menu">
              <Menu size={17} />
            </button>
          </div>
        </header>

        <main className="content flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {role !== 'GUEST' && <AIAssistantChat />}
    </div>
  );
};

export default Layout;

/**
 * QualityAlertBadge — Hiển thị nút cảnh báo chất lượng trên thanh header.
 * Tách thành component riêng để tránh re-render Layout không cần thiết.
 */
const QualityAlertBadge: React.FC = () => {
  const location = useLocation();
  const { totalCount, hasAlerts } = useQualityAlerts(30);
  const isActive = location.pathname === '/alerts';

  return (
    <Link
      to="/alerts"
      title={hasAlerts ? `${totalCount} cảnh báo chất lượng` : 'Không có cảnh báo'}
      className={`icon-btn relative ${
        isActive ? 'border-red-500 text-red-500 dark:text-red-400' : ''
      }`}
    >
      <ShieldAlert size={17} />
      {hasAlerts && (
        <span className="dot-alert" />
      )}
    </Link>
  );
};
