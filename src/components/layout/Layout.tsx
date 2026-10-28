import React, { useState, useEffect, Fragment } from 'react';
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
  CubeIcon,
  BellIcon,
  Cog6ToothIcon,
  SparklesIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  Bars3Icon,
  XMarkIcon,
  MagnifyingGlassIcon,
  SunIcon,
  MoonIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { MOTION_SPRINGS } from '../../lib/motion';
import { AnimatedSidebarContent } from './AnimatedSidebar';
import { useAppStore } from '../../store/useAppStore';
import { useUIStore } from '../../store/useUIStore';
import { useShallow } from 'zustand/react/shallow';
import { useQualityAlerts } from '../../hooks/useQualityAlerts';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { GlobalCommandPalette } from './GlobalCommandPalette';
import { ConfirmationModal } from '../ui/CommonUI';

import { useAIChatHostStore } from '../../store/useAIChatHostStore';

const LazyAIAssistantChat = React.lazy(() =>
  import('../features/AIAssistantChat').then((m) => ({ default: m.AIAssistantChat }))
);

const AIChatSessionHost: React.FC = () => {
  const isOpen = useAIChatHostStore((state) => state.isOpen);
  const hasLoaded = useAIChatHostStore((state) => state.hasLoaded);
  const openChat = useAIChatHostStore((state) => state.openChat);
  const closeChat = useAIChatHostStore((state) => state.closeChat);

  useEffect(() => {
    // Preload AI chunk khi trình duyệt rảnh rỗi (Phase 16)
    if ('requestIdleCallback' in window) {
      const handle = (window as any).requestIdleCallback(() => {
        import('../features/AIAssistantChat');
      });
      return () => (window as any).cancelIdleCallback?.(handle);
    } else {
      const timer = setTimeout(() => {
        import('../features/AIAssistantChat');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handlePreload = () => {
    // Preload AI chunk on hover/focus to guarantee zero latency when clicked
    import('../features/AIAssistantChat');
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => openChat()}
          onMouseEnter={handlePreload}
          onFocus={handlePreload}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 shadow-xl shadow-emerald-500/30 ring-4 ring-emerald-500/20 hover:scale-110 hover:shadow-emerald-500/50 hover:ring-emerald-500/40 active:scale-95 transition-all duration-300 z-50 group cursor-pointer"
          title="Trợ lý AI V-Biotech"
          aria-label="Mở trợ lý AI"
        >
          <SparklesIcon className="w-7 h-7 group-hover:rotate-12 transition-transform duration-300 drop-shadow" />
        </button>
      )}

      {hasLoaded && (
        <React.Suspense fallback={null}>
          <LazyAIAssistantChat isOpen={isOpen} onClose={closeChat} />
        </React.Suspense>
      )}
    </>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const shouldReduceMotion = useReducedMotion();
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

  // Kích hoạt hệ thống phím tắt toàn cục (Ctrl+K, Ctrl+B, Esc, Ctrl+S)
  useKeyboardShortcuts({ onToggleSidebar: toggleSidebar });

  useEffect(() => {
    const handleToggleSidebarEvent = () => toggleSidebar();
    window.addEventListener('pqm:toggle-sidebar', handleToggleSidebarEvent);
    return () => window.removeEventListener('pqm:toggle-sidebar', handleToggleSidebarEvent);
  }, [toggleSidebar]);

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
    if (pathname.startsWith('/criteria-aliases'))
      return {
        title: 'Từ điển Chỉ tiêu OCR',
        subtitle: 'Ánh xạ thông minh tên chỉ tiêu kiểm nghiệm giữa các phiếu và TCCS',
      };
    if (pathname.startsWith('/criteria'))
      return { title: 'Danh mục Chỉ tiêu', subtitle: 'Quản lý chỉ tiêu kiểm soát chất lượng' };
    if (pathname.startsWith('/laboratories'))
      return {
        title: 'Đơn vị Kiểm nghiệm',
        subtitle: 'Quản lý phòng thí nghiệm nội bộ và trung tâm kiểm nghiệm đối tác',
      };
    if (pathname.startsWith('/quality/comparison'))
      return {
        title: 'Đối chiếu Kết quả Lab',
        subtitle: 'So sánh độ lệch %RPD giữa kết quả Nội kiểm và Ngoại kiểm',
      };
    if (pathname.startsWith('/reports/trend-analysis'))
      return {
        title: 'Phân tích Xu hướng (SPC)',
        subtitle: 'Giám sát năng lực quy trình Cpk và 8 quy tắc kiểm soát Nelson',
      };
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
                <div className="flex grow flex-col overflow-hidden bg-surface/95 backdrop-blur-xl ring-1 ring-border shadow-2xl">
                  {/* Brand & Close Button */}
                  <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-border/80">
                    <div className="flex items-center gap-2.5">
                      <img
                        src="/logo-mark.png"
                        alt="V-Biotech"
                        className="w-8 h-8 rounded-full object-contain shadow-sm ring-1 ring-emerald-500/25 shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold tracking-tight text-ink font-display">
                            V-Biotech
                          </span>
                          <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            PQM
                          </span>
                        </div>
                        <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">
                          Quality Management
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

                  {/* Mobile Nav Content */}
                  <nav className="flex-1 overflow-hidden">
                    <AnimatedSidebarContent
                      isCollapsed={false}
                      onToggleCollapse={toggleSidebar}
                      role={role}
                      isAdmin={isAdmin}
                      alertCount={alertCount}
                      hasAlerts={hasAlerts}
                      onLogout={handleLogout}
                      isMobile
                      onMobileItemClick={() => setMobileMenuOpen(false)}
                    />
                  </nav>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      {/* ============ DESKTOP SIDEBAR (ANIMATE UI SPRING COLLAPSIBLE + RAIL) ============ */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 68 : 264 }}
        transition={shouldReduceMotion ? { duration: 0 } : MOTION_SPRINGS.smooth}
        className="hidden xl:flex flex-col shrink-0 border-r border-border/80 bg-surface/90 dark:bg-surface/85 backdrop-blur-xl sticky top-0 h-screen z-40 group/sidebar relative"
      >
        {/* Floating Edge Toggle Button (Animate UI SidebarTrigger on Border) */}
        <button
          type="button"
          onClick={toggleSidebar}
          title={
            isCollapsed ? 'Mở rộng thanh điều hướng (Ctrl+B)' : 'Thu gọn thanh điều hướng (Ctrl+B)'
          }
          aria-label={isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          className="absolute -right-3 top-5 z-50 w-6 h-6 rounded-full bg-surface border border-border shadow-md flex items-center justify-center text-ink-muted hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/50 hover:scale-110 active:scale-95 transition-all cursor-pointer"
        >
          <motion.span
            initial={false}
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={MOTION_SPRINGS.snappy}
            className="inline-flex items-center justify-center"
          >
            <ChevronLeftIcon className="w-3.5 h-3.5 stroke-[2.5]" />
          </motion.span>
        </button>

        {/* Interactive Sidebar Rail (Click anywhere on the right border to expand/collapse) */}
        <div
          onClick={toggleSidebar}
          title={
            isCollapsed ? 'Nhấn để mở rộng Sidebar (Ctrl+B)' : 'Nhấn để thu gọn Sidebar (Ctrl+B)'
          }
          aria-hidden="true"
          className="absolute top-14 bottom-0 -right-1 w-2 z-30 cursor-ew-resize group/rail flex justify-center"
        >
          <div className="w-[2px] h-full rounded-full bg-transparent group-hover/rail:bg-emerald-500/40 transition-colors duration-200" />
        </div>

        {/* Brand Header */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-border/80 bg-surface/50 backdrop-blur-xs overflow-hidden ${
            isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <Link to="/" className="flex items-center gap-2.5 min-w-0 group">
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { scale: 1.06, rotate: -3 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
              transition={MOTION_SPRINGS.snappy}
              className="w-9 h-9 rounded-full flex items-center justify-center shadow-sm shadow-emerald-500/15 ring-1 ring-emerald-500/25 shrink-0 bg-white dark:bg-surface"
            >
              <img
                src="/logo-mark.png"
                alt="V-Biotech"
                className="w-full h-full object-contain rounded-full"
              />
            </motion.div>

            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="min-w-0 overflow-hidden whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold tracking-tight text-emerald-700 dark:text-emerald-400 truncate font-display">
                      V-Biotech
                    </span>
                    <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      PQM
                    </span>
                  </div>
                  <div className="text-[10px] font-semibold text-ink-muted tracking-wider uppercase truncate">
                    Quality Management
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
        </div>

        {/* Animated Sidebar Navigation & Footer */}
        <div className="flex-1 min-h-0 flex flex-col">
          <AnimatedSidebarContent
            isCollapsed={isCollapsed}
            onToggleCollapse={toggleSidebar}
            role={role}
            isAdmin={isAdmin}
            alertCount={alertCount}
            hasAlerts={hasAlerts}
            onLogout={handleLogout}
          />
        </div>
      </motion.aside>

      {/* ============ MAIN CONTENT WRAPPER ============ */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-x-4 border-b border-border/80 bg-surface/80 dark:bg-surface/75 px-4 sm:px-6 lg:px-8 backdrop-blur-xl transition-colors shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="xl:hidden p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors -ml-1.5 cursor-pointer"
              aria-label="Mở menu"
            >
              <Bars3Icon className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold tracking-tight text-ink truncate font-display">
                  {headerInfo.title}
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  GMP LIVE
                </span>
              </div>
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
                  className="hidden md:flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border border-border/80 bg-surface-2/60 hover:bg-surface-2 text-xs font-medium text-ink-muted hover:text-ink hover:border-emerald-500/40 transition-all shadow-2xs hover:shadow-xs group cursor-pointer"
                  title="Tìm kiếm nhanh toàn hệ thống (Ctrl+K)"
                  aria-label="Tìm kiếm nhanh toàn hệ thống"
                >
                  <MagnifyingGlassIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span>Tìm kiếm nhanh...</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface border border-border rounded-md text-ink-muted shadow-2xs group-hover:border-emerald-500/30">
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
              className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-surface-2 border border-border/80 transition-all shadow-2xs hover:border-emerald-500/40 active:scale-95 cursor-pointer"
              title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
              aria-label="Chuyển chế độ sáng/tối"
            >
              {theme === 'dark' ? (
                <SunIcon className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform duration-300" />
              ) : (
                <MoonIcon className="w-4 h-4 text-indigo-500 hover:-rotate-12 transition-transform duration-300" />
              )}
            </button>

            {/* Quality Alerts Notification */}
            {role !== 'GUEST' && <QualityAlertBadge />}

            {/* User Profile Dropdown Menu (Tailwind UI Menu) */}
            <Menu as="div" className="relative ml-1">
              <MenuButton
                className="flex items-center gap-2 rounded-full sm:rounded-xl p-0.5 sm:pl-1.5 sm:pr-2.5 sm:py-1 bg-transparent sm:bg-surface-2/60 hover:bg-surface-2 border border-transparent sm:border-border/80 hover:border-emerald-500/40 transition-all focus:outline-none cursor-pointer shadow-2xs"
                aria-label="Menu tài khoản"
              >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Avatar"
                    className="w-7 h-7 rounded-full object-cover shadow-2xs ring-1 ring-border"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold text-[11px] shadow-2xs">
                    {user?.email ? user.email.slice(0, 2).toUpperCase() : 'US'}
                  </div>
                )}
                <div className="hidden md:flex flex-col text-left max-w-[130px]">
                  <span className="text-[11px] font-semibold text-ink truncate leading-tight">
                    {user?.displayName || user?.email?.split('@')[0] || 'Người dùng'}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 leading-tight">
                    {role === 'ADMIN' || isAdmin ? 'ADMIN' : role || 'GUEST'}
                  </span>
                </div>
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-transparent">
          <motion.div
            key={location.pathname}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="mx-auto max-w-7xl"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {role !== 'GUEST' && <AIChatSessionHost />}
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
