import React, { useState, Fragment } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from '@headlessui/react';
import {
  Squares2X2Icon,
  CubeIcon,
  CircleStackIcon,
  AdjustmentsHorizontalIcon,
  DocumentTextIcon,
  BeakerIcon,
  Square3Stack3DIcon,
  ClipboardDocumentCheckIcon,
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
  ArrowPathRoundedSquareIcon,
  BellIcon,
  DocumentChartBarIcon,
  ChartBarIcon,
  UsersIcon,
  ShieldCheckIcon,
  LinkIcon,
  Cog6ToothIcon,
  SparklesIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Bars3Icon,
  XMarkIcon,
  MagnifyingGlassIcon,
  SunIcon,
  MoonIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store/useAppStore';
import { useUIStore } from '../../store/useUIStore';
import { useShallow } from 'zustand/react/shallow';
import { useQualityAlerts } from '../../hooks/useQualityAlerts';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { GlobalCommandPalette } from './GlobalCommandPalette';
import { ConfirmationModal } from '../ui/CommonUI';

const LazyAIAssistantChat = React.lazy(() =>
  import('../features/AIAssistantChat').then((m) => ({ default: m.AIAssistantChat }))
);

const AIChatLauncher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const handleOpen = () => {
    setHasLoaded(true);
    setIsOpen(true);
  };

  const handlePreload = () => {
    // Preload AI chunk on hover/focus to guarantee zero latency when clicked
    import('../features/AIAssistantChat');
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={handleOpen}
          onMouseEnter={handlePreload}
          onFocus={handlePreload}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 hover:scale-105 hover:from-emerald-700 hover:to-teal-700 transition-all z-50 group cursor-pointer"
          title="Trợ lý AI V-Biotech"
          aria-label="Mở trợ lý AI"
        >
          <SparklesIcon className="w-7 h-7 group-hover:animate-pulse" />
        </button>
      )}

      {hasLoaded && (
        <React.Suspense fallback={null}>
          <LazyAIAssistantChat isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </React.Suspense>
      )}
    </>
  );
};

interface NavItemChild {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  isAlerts?: boolean;
}

interface NavGroup {
  name: string;
  path?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItemChild[];
}

const navItems: NavGroup[] = [
  { name: 'Bảng điều khiển', path: '/', icon: Squares2X2Icon },
  {
    name: 'Danh mục',
    icon: CubeIcon,
    children: [
      { name: 'Sản phẩm', path: '/products', icon: CubeIcon },
      { name: 'Nguyên liệu', path: '/materials', icon: CircleStackIcon },
      { name: 'Chỉ tiêu', path: '/criteria', icon: AdjustmentsHorizontalIcon },
      { name: 'Đơn vị kiểm nghiệm', path: '/laboratories', icon: BuildingOffice2Icon },
    ],
  },
  {
    name: 'Hồ sơ',
    icon: DocumentTextIcon,
    children: [
      { name: 'Hồ sơ TCCS', path: '/tccs', icon: DocumentTextIcon },
      { name: 'Công thức sản phẩm', path: '/product-formulas', icon: BeakerIcon },
    ],
  },
  {
    name: 'Nghiệp vụ',
    icon: Square3Stack3DIcon,
    children: [
      { name: 'Quản lý Lô', path: '/batches', icon: Square3Stack3DIcon },
      { name: 'Phiếu kiểm nghiệm', path: '/test-results', icon: ClipboardDocumentCheckIcon },
      { name: 'Quản lý Sai lệch (CAPA)', path: '/deviations', icon: ExclamationTriangleIcon },
      { name: 'Quản lý Thay đổi (CR)', path: '/change-control', icon: ArrowPathRoundedSquareIcon },
      { name: 'Cảnh báo chất lượng', path: '/alerts', icon: BellIcon, isAlerts: true },
      { name: 'Báo cáo tổng hợp', path: '/reports/quality-summary', icon: DocumentChartBarIcon },
      { name: 'Phân tích xu hướng', path: '/reports/trend-analysis', icon: ChartBarIcon },
    ],
  },
  {
    name: 'Hệ thống',
    icon: Cog6ToothIcon,
    children: [
      { name: 'Người dùng', path: '/users', icon: UsersIcon, adminOnly: true },
      { name: 'Nhật ký kiểm toán', path: '/audit-logs', icon: ShieldCheckIcon, adminOnly: true },
      { name: 'Liên kết chỉ tiêu', path: '/criteria-aliases', icon: LinkIcon, adminOnly: true },
      { name: 'Cấu hình', path: '/settings', icon: Cog6ToothIcon },
    ],
  },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const user = useAppStore((state) => state.user);
  const role = useAppStore((state) => state.role);
  const isAdmin = useAppStore((state) => state.isAdmin);
  const logout = useAppStore((state) => state.logout);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const { products, batches, tccsList, rawMaterials } = useAppStore(
    useShallow((s) => ({
      products: s.products,
      batches: s.batches,
      tccsList: s.tccsList,
      rawMaterials: s.rawMaterials,
    }))
  );

  // Kích hoạt hệ thống phím tắt toàn cục (Ctrl+K, Esc, Ctrl+S)
  useKeyboardShortcuts();

  const searchResults = React.useMemo(() => {
    if (!searchTerm.trim()) return null;
    const lowerQuery = searchTerm.toLowerCase();
    return {
      products: products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(lowerQuery) || p.code.toLowerCase().includes(lowerQuery)
        )
        .slice(0, 3),
      batches: batches.filter((b) => b.batchNo.toLowerCase().includes(lowerQuery)).slice(0, 3),
      tccs: tccsList.filter((t) => t.code.toLowerCase().includes(lowerQuery)).slice(0, 3),
      materials: rawMaterials
        .filter(
          (m) =>
            m.name.toLowerCase().includes(lowerQuery) ||
            (m.code || '').toLowerCase().includes(lowerQuery)
        )
        .slice(0, 3),
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

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = async () => {
    setIsLogoutModalOpen(false);
    await logout();
    navigate('/login');
  };

  const getPageHeaderInfo = (pathname: string) => {
    if (pathname === '/')
      return { title: 'Bảng điều khiển', subtitle: 'Tổng quan hoạt động nghiệp vụ QMS V-Biotech' };
    if (pathname.startsWith('/products'))
      return { title: 'Danh mục Sản phẩm', subtitle: 'Quản lý sản phẩm lưu hành và TCCS áp dụng' };
    if (pathname.startsWith('/materials'))
      return { title: 'Danh mục Nguyên liệu', subtitle: 'Quản lý nguyên vật liệu sản xuất' };
    if (pathname.startsWith('/criteria'))
      return { title: 'Danh mục Chỉ tiêu', subtitle: 'Quản lý chỉ tiêu kiểm soát chất lượng' };
    if (pathname.startsWith('/tccs'))
      return { title: 'Hồ sơ TCCS', subtitle: 'Tiêu chuẩn cơ sở áp dụng cho từng sản phẩm' };
    if (pathname.startsWith('/product-formulas'))
      return {
        title: 'Công thức Sản phẩm',
        subtitle: 'Định mức nguyên liệu và công thức chế phẩm',
      };
    if (pathname.startsWith('/batches'))
      return {
        title: 'Quản lý Lô',
        subtitle: 'Theo dõi trạng thái, hồ sơ và kiểm nghiệm lô sản xuất',
      };
    if (pathname.startsWith('/test-results'))
      return { title: 'Kiểm soát Lab', subtitle: 'Nhập kết quả kiểm nghiệm và phát hành CoA' };
    if (pathname.startsWith('/deviations'))
      return {
        title: 'Quản lý Sai lệch & CAPA',
        subtitle:
          'Theo dõi sự cố OOS, điều tra nguyên nhân gốc rễ và kiểm soát hành động khắc phục',
      };
    if (pathname.startsWith('/change-control'))
      return {
        title: 'Quản lý Thay đổi (CR)',
        subtitle: 'Đánh giá rủi ro FMEA và kiểm soát thay đổi chuẩn GMP',
      };
    if (pathname.startsWith('/reports'))
      return { title: 'Báo cáo tổng hợp', subtitle: 'Thống kê chất lượng và báo cáo định kỳ' };
    if (pathname.startsWith('/users'))
      return { title: 'Người dùng', subtitle: 'Quản lý tài khoản và phân quyền thành viên' };
    if (pathname.startsWith('/settings'))
      return { title: 'Cấu hình', subtitle: 'Thông tin hệ thống và tùy chọn kết nối API AI' };
    if (pathname.startsWith('/account'))
      return { title: 'Tài khoản cá nhân', subtitle: 'Thông tin hồ sơ người dùng đang đăng nhập' };
    if (pathname.startsWith('/alerts'))
      return { title: 'Cảnh báo chất lượng', subtitle: 'Giám sát chỉ tiêu vượt ngưỡng cảnh báo' };
    if (pathname.startsWith('/audit-logs'))
      return {
        title: 'Nhật ký kiểm toán',
        subtitle: 'Lịch sử thay đổi dữ liệu và truy vết hệ thống (Audit Trail)',
      };
    if (pathname.startsWith('/search'))
      return { title: 'Kết quả tìm kiếm', subtitle: 'Tìm kiếm dữ liệu toàn hệ thống' };
    return { title: 'Hệ thống QMS', subtitle: 'Nền tảng kiểm soát chất lượng V-Biotech' };
  };

  const headerInfo = getPageHeaderInfo(location.pathname);
  const { totalCount: alertCount, hasAlerts } = useQualityAlerts(30);

  const getFormattedDate = () => {
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const now = new Date();
    const dayName = days[now.getDay()];
    const dateStr = now.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `${dayName}, ${dateStr} · Realtime`;
  };

  const renderNavLinks = (onItemClick?: () => void) => (
    <div className="space-y-5">
      {/* Dashboard Item */}
      <div>
        <Link
          to="/"
          onClick={onItemClick}
          className={`group relative flex items-center gap-x-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            location.pathname === '/'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-emerald-600 before:rounded-r'
              : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
          }`}
          title="Bảng điều khiển"
        >
          <Squares2X2Icon
            className={`w-4 h-4 shrink-0 ${location.pathname === '/' ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-muted group-hover:text-ink'}`}
          />
          {!isCollapsed && <span className="truncate">Bảng điều khiển</span>}
        </Link>
      </div>

      {/* Nav Groups */}
      {navItems.slice(1).map((group, idx) => {
        const visibleChildren = (group.children || []).filter(
          (child) => !child.adminOnly || role === 'ADMIN' || isAdmin
        );
        if (visibleChildren.length === 0) return null;

        return (
          <div key={idx} className="space-y-0.5">
            {!isCollapsed ? (
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {group.name}
              </div>
            ) : (
              <div className="w-5 mx-auto my-2 border-t border-border" />
            )}

            {visibleChildren.map((child) => {
              const isActive =
                location.pathname === child.path ||
                (child.path !== '/' && location.pathname.startsWith(child.path));
              const IconComp = child.icon;

              return (
                <Link
                  key={child.path}
                  to={child.path}
                  onClick={onItemClick}
                  className={`group relative flex items-center gap-x-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-emerald-600 before:rounded-r'
                      : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                  }`}
                  title={child.name}
                >
                  <IconComp
                    className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-muted group-hover:text-ink'}`}
                  />
                  {!isCollapsed && <span className="flex-1 truncate">{child.name}</span>}
                  {child.isAlerts && hasAlerts && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500 text-white shrink-0">
                      {alertCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}

      {/* Tools / Actions */}
      <div className="space-y-0.5 pt-2 border-t border-border">
        {!isCollapsed && (
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Công cụ
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            onItemClick && onItemClick();
            window.dispatchEvent(
              new CustomEvent('trigger-ai-chat', {
                detail: { prompt: 'Tổng quan tình trạng tất cả lô hàng hiện tại' },
              })
            );
          }}
          className="w-full group flex items-center gap-x-3 rounded-lg px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors text-left"
          title="Trợ lý AI Copilot"
        >
          <SparklesIcon className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform" />
          {!isCollapsed && <span className="truncate">Trợ lý AI Copilot</span>}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full group flex items-center gap-x-3 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
          title="Đăng xuất"
        >
          <ArrowRightOnRectangleIcon className="w-4 h-4 shrink-0 text-rose-500 group-hover:translate-x-0.5 transition-transform" />
          {!isCollapsed && <span className="truncate">Đăng xuất</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-transparent flex">
      {/* ============ MOBILE SIDEBAR (Slide-over Dialog) ============ */}
      <Transition show={isMobileMenuOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 xl:hidden" onClose={setMobileMenuOpen}>
          <TransitionChild
            as={Fragment}
            enter="transition-opacity ease-linear duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs" />
          </TransitionChild>

          <div className="fixed inset-0 flex">
            <TransitionChild
              as={Fragment}
              enter="transition ease-in-out duration-200 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-200 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <DialogPanel className="relative mr-16 flex w-full max-w-xs flex-1">
                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-surface px-6 pb-6 ring-1 ring-border shadow-2xl">
                  {/* Brand & Close Button */}
                  <div className="flex h-16 shrink-0 items-center justify-between border-b border-border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        <CubeIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold tracking-tight text-ink">V-Biotech</div>
                        <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">
                          QMS Platform
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
                      aria-label="Đóng menu"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Nav links */}
                  <nav className="flex flex-1 flex-col">
                    {renderNavLinks(() => setMobileMenuOpen(false))}
                  </nav>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      {/* ============ DESKTOP SIDEBAR ============ */}
      <aside
        className={`hidden xl:flex flex-col shrink-0 border-r border-border bg-surface transition-all duration-200 sticky top-0 h-screen z-30 ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between px-5 border-b border-border">
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <CubeIcon className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="text-sm font-bold tracking-tight text-ink truncate">V-Biotech</div>
                <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase truncate">
                  QMS Platform
                </div>
              </div>
            )}
          </Link>
        </div>

        {/* Sidebar Nav */}
        <div className="flex-1 overflow-y-auto px-3 py-3.5 custom-scrollbar">
          {renderNavLinks()}
        </div>

        {/* Sidebar Footer / Toggle */}
        <div className="p-3 border-t border-border shrink-0">
          <button
            type="button"
            onClick={toggleSidebar}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            aria-label={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            {isCollapsed ? (
              <ChevronRightIcon className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeftIcon className="w-4 h-4" />
                <span>Thu gọn</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ============ MAIN CONTENT WRAPPER ============ */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-x-4 border-b border-border bg-surface/90 px-4 sm:px-6 lg:px-8 backdrop-blur-md transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="xl:hidden p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors -ml-1.5"
              aria-label="Mở menu"
            >
              <Bars3Icon className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-ink truncate">
                {headerInfo.title}
              </h2>
              <p className="text-[11px] text-ink-muted truncate hidden sm:block">
                {getFormattedDate()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {role !== 'GUEST' && (
              <>
                {/* Desktop Global Search Trigger */}
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('pqm:toggle-command-palette'))
                  }
                  className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border bg-surface-2/60 hover:bg-surface-2 text-xs font-medium text-ink-muted hover:text-ink transition-all shadow-2xs"
                  title="Tìm kiếm nhanh toàn hệ thống (Ctrl+K)"
                  aria-label="Tìm kiếm nhanh toàn hệ thống"
                >
                  <MagnifyingGlassIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Tìm kiếm nhanh...</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface border border-border rounded text-ink-muted shadow-2xs">
                    Ctrl K
                  </kbd>
                </button>

                {/* Mobile Search Dropdown Trigger */}
                <div className="relative md:hidden">
                  <div className="flex items-center bg-surface-2 rounded-xl px-2 py-1 border border-border">
                    <MagnifyingGlassIcon className="w-4 h-4 text-ink-faint mr-1.5" />
                    <form onSubmit={handleSearch}>
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
                        placeholder="Tìm kiếm…"
                        className="w-24 sm:w-32 bg-transparent text-xs text-ink outline-none"
                      />
                    </form>
                  </div>

                  {showDropdown && searchResults && (
                    <div className="absolute top-full right-0 mt-2 w-72 bg-surface rounded-2xl shadow-xl border border-border overflow-hidden z-50 p-2 text-xs">
                      {searchResults.products.length > 0 && (
                        <div className="mb-2">
                          <div className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider px-2 py-1">
                            Sản phẩm
                          </div>
                          {searchResults.products.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                navigate(`/products/${p.id}`);
                                setSearchTerm('');
                                setShowDropdown(false);
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface-2 transition-colors flex flex-col"
                            >
                              <span className="font-semibold text-ink">{p.name}</span>
                              <span className="text-[10px] text-ink-faint">{p.code}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.batches.length > 0 && (
                        <div className="mb-2">
                          <div className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider px-2 py-1">
                            Lô hàng
                          </div>
                          {searchResults.batches.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => {
                                navigate(`/batches/${b.id}`);
                                setSearchTerm('');
                                setShowDropdown(false);
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface-2 transition-colors flex flex-col"
                            >
                              <span className="font-semibold text-ink">Lô: {b.batchNo}</span>
                              <span className="text-[10px] text-ink-faint">
                                NSX: {b.mfgDate || '---'}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleSearch}
                        className="w-full py-1.5 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg hover:bg-emerald-100 transition-colors mt-1"
                      >
                        Xem tất cả kết quả &rarr;
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Dark / Light Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 border border-border transition-colors shadow-2xs"
              title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
              aria-label="Chuyển chế độ sáng/tối"
            >
              {theme === 'dark' ? (
                <SunIcon className="w-4 h-4" />
              ) : (
                <MoonIcon className="w-4 h-4" />
              )}
            </button>

            {/* Quality Alerts Notification */}
            {role !== 'GUEST' && <QualityAlertBadge />}

            {/* User Profile Dropdown Menu (Tailwind UI Menu) */}
            <Menu as="div" className="relative ml-1">
              <MenuButton
                className="flex items-center gap-2 rounded-full p-0.5 ring-2 ring-transparent hover:ring-emerald-500/40 transition-all focus:outline-none cursor-pointer"
                aria-label="Menu tài khoản"
              >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full object-cover shadow-2xs ring-1 ring-border"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                    {user?.email ? user.email.slice(0, 2).toUpperCase() : 'US'}
                  </div>
                )}
              </MenuButton>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <MenuItems className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-xl bg-surface p-1.5 shadow-xl border border-border focus:outline-none text-xs">
                  <div className="px-3 py-2 border-b border-border mb-1">
                    <div className="font-semibold text-ink truncate">
                      {user?.displayName || user?.email || 'Người dùng'}
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mt-0.5">
                      {role === 'ADMIN' || isAdmin ? 'ADMIN' : role || 'GUEST'}
                    </div>
                  </div>

                  <MenuItem>
                    {({ active }) => (
                      <Link
                        to="/account"
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                          active ? 'bg-surface-2 text-ink' : 'text-ink-soft'
                        }`}
                      >
                        <UserCircleIcon className="w-4 h-4 text-ink-muted" />
                        <span>Hồ sơ cá nhân</span>
                      </Link>
                    )}
                  </MenuItem>

                  <MenuItem>
                    {({ active }) => (
                      <Link
                        to="/settings"
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                          active ? 'bg-surface-2 text-ink' : 'text-ink-soft'
                        }`}
                      >
                        <Cog6ToothIcon className="w-4 h-4 text-ink-muted" />
                        <span>Cài đặt hệ thống</span>
                      </Link>
                    )}
                  </MenuItem>

                  <div className="my-1 border-t border-border" />

                  <MenuItem>
                    {({ active }) => (
                      <button
                        type="button"
                        onClick={handleLogout}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-rose-600 dark:text-rose-400 ${
                          active ? 'bg-rose-500/10' : ''
                        }`}
                      >
                        <ArrowRightOnRectangleIcon className="w-4 h-4" />
                        <span>Đăng xuất</span>
                      </button>
                    )}
                  </MenuItem>
                </MenuItems>
              </Transition>
            </Menu>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-surface-2/30">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {role !== 'GUEST' && <AIChatLauncher />}
      <GlobalCommandPalette />
      <ConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={confirmLogout}
        title="Xác nhận đăng xuất"
        message="Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc hiện tại?"
        confirmText="Đăng xuất"
        cancelText="Hủy"
        confirmButtonColor="bg-rose-600 hover:bg-rose-700 text-white"
      />
    </div>
  );
};

export default Layout;

/**
 * QualityAlertBadge — Hiển thị nút cảnh báo chất lượng trên thanh header.
 */
const QualityAlertBadge: React.FC = () => {
  const location = useLocation();
  const { totalCount, hasAlerts, highCount } = useQualityAlerts(30);
  const isActive = location.pathname === '/alerts';

  return (
    <Link
      to="/alerts"
      title={
        hasAlerts
          ? `${totalCount} cảnh báo chất lượng (${highCount} mức cao)`
          : 'Không có cảnh báo chất lượng'
      }
      className={`p-2 rounded-lg relative border transition-colors shadow-2xs ${
        isActive
          ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-500/10'
          : 'border-border text-ink-muted hover:text-ink hover:bg-surface-2'
      }`}
      aria-label="Xem cảnh báo chất lượng"
    >
      <BellIcon
        className={`w-4 h-4 ${hasAlerts && highCount > 0 ? 'text-rose-500 animate-pulse' : ''}`}
      />
      {hasAlerts && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs border-2 border-surface">
          {totalCount > 99 ? '99+' : totalCount}
        </span>
      )}
    </Link>
  );
};
