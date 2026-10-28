import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
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
  ScaleIcon,
  PlusCircleIcon,
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
  MagnifyingGlassIcon,
  ChevronUpDownIcon,
} from '@heroicons/react/24/outline';
import { AnimatedCollapsible } from '../ui/AnimatedCollapsible';
import { AnimatedChevron } from '../ui/AnimatedChevron';
import { MOTION_SPRINGS } from '../../lib/motion';
import { useAIChatHostStore } from '../../store/useAIChatHostStore';

export interface NavItemChild {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  isAlerts?: boolean;
}

export interface NavGroup {
  id: string;
  name: string;
  path?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItemChild[];
}

export const NAV_GROUPS: NavGroup[] = [
  { id: 'dashboard', name: 'Tổng quan chất lượng', path: '/', icon: Squares2X2Icon },
  {
    id: 'products',
    name: 'Danh mục sản phẩm',
    icon: CubeIcon,
    children: [
      { name: 'Sản phẩm', path: '/products', icon: CubeIcon },
      { name: 'Nguyên liệu', path: '/materials', icon: CircleStackIcon },
    ],
  },
  {
    id: 'standards',
    name: 'Tiêu chuẩn chất lượng',
    icon: DocumentTextIcon,
    children: [
      { name: 'Hồ sơ TCCS', path: '/tccs', icon: DocumentTextIcon },
      { name: 'Chỉ tiêu kiểm nghiệm', path: '/criteria', icon: AdjustmentsHorizontalIcon },
      { name: 'Công thức sản phẩm', path: '/product-formulas', icon: BeakerIcon },
    ],
  },
  {
    id: 'testing',
    name: 'Phiếu kiểm nghiệm',
    icon: ClipboardDocumentCheckIcon,
    children: [
      { name: 'Theo dõi theo Lô', path: '/batches', icon: Square3Stack3DIcon },
      { name: 'Nhập phiếu mới', path: '/test-results/new', icon: PlusCircleIcon },
      { name: 'Danh sách phiếu', path: '/test-results', icon: ClipboardDocumentCheckIcon },
      { name: 'Đơn vị kiểm nghiệm', path: '/laboratories', icon: BuildingOffice2Icon },
    ],
  },
  {
    id: 'analytics',
    name: 'So sánh & Xu hướng',
    icon: ChartBarIcon,
    children: [
      { name: 'Đối chiếu Lab (Nội/Ngoại)', path: '/quality/comparison', icon: ScaleIcon },
      { name: 'Phân tích xu hướng (SPC)', path: '/reports/trend-analysis', icon: ChartBarIcon },
      { name: 'Cảnh báo chất lượng', path: '/alerts', icon: BellIcon, isAlerts: true },
    ],
  },
  {
    id: 'reports',
    name: 'Báo cáo',
    icon: DocumentChartBarIcon,
    children: [
      { name: 'Báo cáo tổng hợp', path: '/reports/quality-summary', icon: DocumentChartBarIcon },
    ],
  },
  {
    id: 'system',
    name: 'Hệ thống',
    icon: Cog6ToothIcon,
    children: [
      { name: 'Người dùng', path: '/users', icon: UsersIcon, adminOnly: true },
      { name: 'Từ điển chỉ tiêu OCR', path: '/criteria-aliases', icon: LinkIcon, adminOnly: true },
      { name: 'Nhật ký kiểm toán', path: '/audit-logs', icon: ShieldCheckIcon, adminOnly: true },
      { name: 'Cấu hình', path: '/settings', icon: Cog6ToothIcon },
    ],
  },
];

const COLLAPSED_GROUPS_STORAGE_KEY = 'pqm_sidebar_collapsed_groups';

export interface AnimatedSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  role?: string | null;
  isAdmin?: boolean;
  alertCount: number;
  hasAlerts: boolean;
  onLogout: () => void;
  isMobile?: boolean;
  onMobileItemClick?: () => void;
}

/**
 * Check if a child nav item matches the current pathname accurately
 * (handling nested paths like /test-results vs /test-results/new)
 */
function isChildPathActive(pathname: string, childPath: string, siblings: NavItemChild[]): boolean {
  if (pathname === childPath) return true;
  if (childPath === '/') return pathname === '/';
  if (pathname.startsWith(childPath + '/')) {
    // Ensure a more specific sibling path doesn't match better (e.g. /test-results/new)
    const moreSpecificMatch = siblings.some(
      (s) =>
        s.path !== childPath &&
        s.path.length > childPath.length &&
        (pathname === s.path || pathname.startsWith(s.path + '/'))
    );
    return !moreSpecificMatch;
  }
  return false;
}

export const AnimatedSidebarContent: React.FC<AnimatedSidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  role,
  isAdmin,
  alertCount,
  hasAlerts,
  onLogout,
  isMobile = false,
  onMobileItemClick,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  // Collapsed mode only applies on desktop
  const effectiveCollapsed = isMobile ? false : isCollapsed;

  // Hover highlight state (Animate UI MotionHighlight pattern)
  const [hoveredItemKey, setHoveredItemKey] = useState<string | null>(null);
  // Flyout menu state when sidebar is in collapsed icon-rail mode
  const [hoveredRailGroupId, setHoveredRailGroupId] = useState<string | null>(null);

  // Track which accordion groups are collapsed (persisted in localStorage)
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveCollapsedGroups = useCallback((next: string[]) => {
    setCollapsedGroupIds(next);
    try {
      localStorage.setItem(COLLAPSED_GROUPS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }, []);

  // Automatically expand the group that contains the active route
  useEffect(() => {
    const activeGroup = NAV_GROUPS.slice(1).find((g) =>
      (g.children || []).some((c) => isChildPathActive(location.pathname, c.path, g.children || []))
    );
    if (activeGroup && collapsedGroupIds.includes(activeGroup.id)) {
      saveCollapsedGroups(collapsedGroupIds.filter((id) => id !== activeGroup.id));
    }
  }, [location.pathname, collapsedGroupIds, saveCollapsedGroups]);

  const toggleGroup = (groupId: string) => {
    if (collapsedGroupIds.includes(groupId)) {
      saveCollapsedGroups(collapsedGroupIds.filter((id) => id !== groupId));
    } else {
      saveCollapsedGroups([...collapsedGroupIds, groupId]);
    }
  };

  const collapsibleGroups = NAV_GROUPS.slice(1).filter((group) => {
    const visible = (group.children || []).filter(
      (child) => !child.adminOnly || role === 'ADMIN' || isAdmin
    );
    return visible.length > 0;
  });

  const allGroupsCollapsed =
    collapsibleGroups.length > 0 &&
    collapsibleGroups.every((g) => collapsedGroupIds.includes(g.id));

  const handleToggleAllGroups = () => {
    if (allGroupsCollapsed) {
      saveCollapsedGroups([]);
    } else {
      saveCollapsedGroups(collapsibleGroups.map((g) => g.id));
    }
  };

  const isDashboardActive = location.pathname === '/';

  const layoutPrefix = isMobile ? 'mobile-sidebar' : 'desktop-sidebar';

  return (
    <div
      className="flex flex-col h-full select-none"
      onMouseLeave={() => {
        setHoveredItemKey(null);
        setHoveredRailGroupId(null);
      }}
    >
      {/* ============ QUICK COMMAND & SECTION CONTROLS ============ */}
      {role !== 'GUEST' && (
        <div
          className={`px-3 pt-3 pb-1 shrink-0 ${effectiveCollapsed ? 'flex flex-col items-center' : ''}`}
        >
          {!effectiveCollapsed ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onMobileItemClick?.();
                  window.dispatchEvent(new CustomEvent('pqm:toggle-command-palette'));
                }}
                className="flex-1 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-surface-2/70 hover:bg-surface-2 border border-border/80 hover:border-emerald-500/40 text-xs text-ink-muted hover:text-ink transition-all shadow-2xs group cursor-pointer"
                title="Tìm kiếm nhanh & Lệnh (Ctrl+K)"
              >
                <span className="flex items-center gap-2 truncate">
                  <MagnifyingGlassIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="truncate font-medium">Tìm nhanh...</span>
                </span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface border border-border rounded-md text-ink-faint group-hover:text-ink-muted group-hover:border-emerald-500/30 shrink-0">
                  Ctrl K
                </kbd>
              </button>

              <button
                type="button"
                onClick={handleToggleAllGroups}
                className="p-1.5 rounded-xl bg-surface-2/70 hover:bg-surface-2 border border-border/80 hover:border-emerald-500/40 text-ink-muted hover:text-ink transition-all shadow-2xs cursor-pointer shrink-0"
                title={allGroupsCollapsed ? 'Mở rộng tất cả nhóm menu' : 'Thu gọn tất cả nhóm menu'}
                aria-label={
                  allGroupsCollapsed ? 'Mở rộng tất cả nhóm menu' : 'Thu gọn tất cả nhóm menu'
                }
              >
                <ChevronUpDownIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              className="relative"
              onMouseEnter={() => setHoveredRailGroupId('quick-search')}
              onMouseLeave={() => setHoveredRailGroupId(null)}
            >
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('pqm:toggle-command-palette'))}
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-2/70 hover:bg-emerald-500/15 border border-border/80 hover:border-emerald-500/40 text-ink-muted hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer"
                aria-label="Tìm kiếm nhanh (Ctrl+K)"
              >
                <MagnifyingGlassIcon className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {hoveredRailGroupId === 'quick-search' && (
                  <motion.div
                    initial={
                      shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -6, scale: 0.96 }
                    }
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -4, scale: 0.96 }}
                    transition={MOTION_SPRINGS.snappy}
                    className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 px-2.5 py-1.5 rounded-xl bg-surface/95 backdrop-blur-xl border border-border shadow-xl whitespace-nowrap flex items-center gap-2 pointer-events-none"
                  >
                    <span className="text-xs font-semibold text-ink">Tìm kiếm nhanh</span>
                    <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface-2 border border-border rounded text-ink-muted">
                      Ctrl K
                    </kbd>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* ============ SCROLLABLE NAVIGATION BODY ============ */}
      <div
        className={`flex-1 px-2.5 py-2.5 space-y-1.5 ${
          effectiveCollapsed ? 'overflow-visible' : 'overflow-y-auto custom-scrollbar'
        }`}
      >
        {/* 1. Dashboard Top Item */}
        <div
          className="relative"
          onMouseEnter={() => {
            setHoveredItemKey('nav-dashboard');
            if (effectiveCollapsed) setHoveredRailGroupId('dashboard');
          }}
          onMouseLeave={() => {
            if (effectiveCollapsed) setHoveredRailGroupId(null);
          }}
        >
          <Link
            to="/"
            onClick={onMobileItemClick}
            className={`group relative flex items-center rounded-xl text-xs font-medium transition-colors z-10 ${
              effectiveCollapsed ? 'w-10 h-10 mx-auto justify-center' : 'gap-x-2.5 px-3 py-2'
            } ${
              isDashboardActive
                ? 'text-emerald-800 dark:text-emerald-300 font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {/* Gliding Active Pill (Animate UI MotionHighlight) */}
            {isDashboardActive && (
              <>
                <motion.div
                  layoutId={`${layoutPrefix}-active-pill`}
                  transition={MOTION_SPRINGS.snappy}
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/18 via-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 shadow-2xs -z-10"
                />
                <motion.div
                  layoutId={`${layoutPrefix}-active-bar`}
                  transition={MOTION_SPRINGS.snappy}
                  className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-emerald-500 to-teal-600"
                />
              </>
            )}

            {/* Gliding Hover Highlight */}
            {hoveredItemKey === 'nav-dashboard' && !isDashboardActive && (
              <motion.div
                layoutId={`${layoutPrefix}-hover-pill`}
                transition={MOTION_SPRINGS.snappy}
                className="absolute inset-0 rounded-xl bg-surface-2/90 dark:bg-surface-2/60 -z-10"
              />
            )}

            <Squares2X2Icon
              className={`w-[18px] h-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                isDashboardActive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-ink-muted group-hover:text-ink'
              }`}
            />

            {!effectiveCollapsed && <span className="truncate">Bảng điều khiển</span>}
          </Link>

          {/* Floating Tooltip when Collapsed */}
          <AnimatePresence>
            {effectiveCollapsed && hoveredRailGroupId === 'dashboard' && (
              <motion.div
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -6, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -4, scale: 0.96 }}
                transition={MOTION_SPRINGS.snappy}
                className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 px-3 py-1.5 rounded-xl bg-surface/95 backdrop-blur-xl border border-border shadow-xl whitespace-nowrap pointer-events-none"
              >
                <span className="text-xs font-semibold text-ink">Bảng điều khiển</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Subtle Divider */}
        <div className="mx-2 my-1 border-t border-border/60" />

        {/* 2. Collapsible Nav Groups (Accordion Tree in Expanded / Flyout Popover in Collapsed) */}
        {collapsibleGroups.map((group) => {
          const visibleChildren = (group.children || []).filter(
            (child) => !child.adminOnly || role === 'ADMIN' || isAdmin
          );
          if (visibleChildren.length === 0) return null;

          const activeChild = visibleChildren.find((child) =>
            isChildPathActive(location.pathname, child.path, visibleChildren)
          );
          const hasGroupActive = Boolean(activeChild);
          const groupHasAlertBadge = visibleChildren.some((c) => c.isAlerts) && hasAlerts;
          const isGroupOpen = !collapsedGroupIds.includes(group.id);
          const GroupIcon = group.icon;

          // ====== MODE A: COLLAPSED ICON-RAIL WITH FLOATING FLYOUT SUBMENU ======
          if (effectiveCollapsed) {
            const isFlyoutOpen = hoveredRailGroupId === group.id;

            return (
              <div
                key={group.id}
                className="relative"
                onMouseEnter={() => {
                  setHoveredRailGroupId(group.id);
                  setHoveredItemKey(`group-${group.id}`);
                }}
                onMouseLeave={() => setHoveredRailGroupId(null)}
              >
                <button
                  type="button"
                  onClick={() => navigate((activeChild || visibleChildren[0]).path)}
                  className={`group relative w-10 h-10 mx-auto flex items-center justify-center rounded-xl transition-colors cursor-pointer z-10 ${
                    hasGroupActive
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                  aria-label={group.name}
                >
                  {hasGroupActive && (
                    <>
                      <motion.div
                        layoutId={`${layoutPrefix}-active-pill`}
                        transition={MOTION_SPRINGS.snappy}
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/18 via-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 shadow-2xs -z-10"
                      />
                      <motion.div
                        layoutId={`${layoutPrefix}-active-bar`}
                        transition={MOTION_SPRINGS.snappy}
                        className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-emerald-500 to-teal-600"
                      />
                    </>
                  )}

                  {hoveredItemKey === `group-${group.id}` && !hasGroupActive && (
                    <motion.div
                      layoutId={`${layoutPrefix}-hover-pill`}
                      transition={MOTION_SPRINGS.snappy}
                      className="absolute inset-0 rounded-xl bg-surface-2/90 dark:bg-surface-2/60 -z-10"
                    />
                  )}

                  <GroupIcon
                    className={`w-[18px] h-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                      hasGroupActive
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-ink-muted group-hover:text-ink'
                    }`}
                  />

                  {/* Alert Dot on Collapsed Group Icon */}
                  {groupHasAlertBadge && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-surface animate-pulse" />
                  )}
                </button>

                {/* Animate UI Floating Flyout Card */}
                <AnimatePresence>
                  {isFlyoutOpen && (
                    <motion.div
                      initial={
                        shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -8, scale: 0.96 }
                      }
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -6, scale: 0.96 }}
                      transition={MOTION_SPRINGS.snappy}
                      className="absolute left-full top-0 ml-3 z-50 w-56 rounded-2xl bg-surface/95 dark:bg-surface/95 backdrop-blur-xl border border-border shadow-2xl p-2 before:absolute before:-left-4 before:inset-y-0 before:w-4"
                    >
                      <div className="px-2.5 py-1.5 mb-1 border-b border-border/60 flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                          {group.name}
                        </span>
                        <span className="text-[10px] font-mono text-ink-faint">
                          {visibleChildren.length} mục
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        {visibleChildren.map((child) => {
                          const isChildActive = isChildPathActive(
                            location.pathname,
                            child.path,
                            visibleChildren
                          );
                          const ChildIcon = child.icon;

                          return (
                            <Link
                              key={child.path}
                              to={child.path}
                              onClick={() => setHoveredRailGroupId(null)}
                              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${
                                isChildActive
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/25'
                                  : 'text-ink-soft hover:bg-surface-2 hover:text-ink'
                              }`}
                            >
                              <ChildIcon
                                className={`w-4 h-4 shrink-0 ${
                                  isChildActive
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-ink-muted'
                                }`}
                              />
                              <span className="flex-1 truncate">{child.name}</span>
                              {child.isAlerts && hasAlerts && (
                                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500 text-white shrink-0 shadow-xs">
                                  {alertCount}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          // ====== MODE B: EXPANDED ACCORDION TREE (ANIMATE UI SIDEBAR SUBMENU) ======
          return (
            <div key={group.id} className="space-y-0.5">
              {/* Collapsible Group Header Button */}
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                onMouseEnter={() => setHoveredItemKey(`header-${group.id}`)}
                aria-expanded={isGroupOpen}
                className={`group relative w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer z-10 ${
                  hasGroupActive && !isGroupOpen
                    ? 'text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-500/8'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {hoveredItemKey === `header-${group.id}` && (
                  <motion.div
                    layoutId={`${layoutPrefix}-hover-pill`}
                    transition={MOTION_SPRINGS.snappy}
                    className="absolute inset-0 rounded-xl bg-surface-2/70 dark:bg-surface-2/40 -z-10"
                  />
                )}

                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      hasGroupActive
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30'
                        : 'bg-surface-2/80 text-ink-muted group-hover:text-ink group-hover:bg-surface-3/60'
                    }`}
                  >
                    <GroupIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider truncate">
                    {group.name}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Show active dot or alert badge when group is collapsed */}
                  {!isGroupOpen && groupHasAlertBadge && (
                    <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-rose-500 text-white">
                      {alertCount}
                    </span>
                  )}
                  {!isGroupOpen && hasGroupActive && !groupHasAlertBadge && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
                  )}

                  <AnimatedChevron
                    isOpen={isGroupOpen}
                    className="w-3.5 h-3.5 text-ink-faint group-hover:text-ink-muted"
                  />
                </div>
              </button>

              {/* Animated Tree Sub-Items */}
              <AnimatedCollapsible isOpen={isGroupOpen}>
                <div className="relative ml-[19px] pl-3 border-l border-border/80 dark:border-border/60 space-y-0.5 py-0.5">
                  {visibleChildren.map((child) => {
                    const isActive = isChildPathActive(
                      location.pathname,
                      child.path,
                      visibleChildren
                    );
                    const IconComp = child.icon;
                    const itemKey = `item-${child.path}`;

                    return (
                      <div
                        key={child.path}
                        className="relative"
                        onMouseEnter={() => setHoveredItemKey(itemKey)}
                      >
                        {/* Tree Branch Node Indicator on the vertical line */}
                        <span
                          className={`absolute -left-[15px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                            isActive
                              ? 'bg-emerald-500 ring-3 ring-emerald-500/20 scale-110'
                              : hoveredItemKey === itemKey
                                ? 'bg-ink-muted scale-100'
                                : 'bg-border scale-75 opacity-60'
                          }`}
                        />

                        <Link
                          to={child.path}
                          onClick={onMobileItemClick}
                          className={`group relative flex items-center gap-x-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors z-10 ${
                            isActive
                              ? 'text-emerald-800 dark:text-emerald-300 font-semibold'
                              : 'text-ink-muted hover:text-ink'
                          }`}
                          title={child.name}
                        >
                          {/* Gliding Active Pill */}
                          {isActive && (
                            <>
                              <motion.div
                                layoutId={`${layoutPrefix}-active-pill`}
                                transition={MOTION_SPRINGS.snappy}
                                className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/18 via-emerald-500/10 to-transparent border border-emerald-500/25 shadow-2xs -z-10"
                              />
                              <motion.div
                                layoutId={`${layoutPrefix}-active-bar`}
                                transition={MOTION_SPRINGS.snappy}
                                className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-gradient-to-b from-emerald-500 to-teal-600"
                              />
                            </>
                          )}

                          {/* Gliding Hover Highlight */}
                          {hoveredItemKey === itemKey && !isActive && (
                            <motion.div
                              layoutId={`${layoutPrefix}-hover-pill`}
                              transition={MOTION_SPRINGS.snappy}
                              className="absolute inset-0 rounded-xl bg-surface-2/85 dark:bg-surface-2/55 -z-10"
                            />
                          )}

                          <IconComp
                            className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                              isActive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-ink-muted group-hover:text-ink'
                            }`}
                          />

                          <span className="flex-1 truncate">{child.name}</span>

                          {child.isAlerts && hasAlerts && (
                            <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500 text-white shrink-0 shadow-xs animate-pulse tabular-nums">
                              {alertCount}
                            </span>
                          )}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </AnimatedCollapsible>
            </div>
          );
        })}
      </div>

      {/* ============ SIDEBAR FOOTER (AI COPILOT + COLLAPSE CONTROL + LOGOUT) ============ */}
      <div className="p-2.5 border-t border-border/80 bg-surface/40 backdrop-blur-xs space-y-1.5 shrink-0">
        {/* AI Copilot Trigger */}
        <div
          className="relative"
          onMouseEnter={() => {
            if (effectiveCollapsed) setHoveredRailGroupId('ai-copilot');
          }}
          onMouseLeave={() => {
            if (effectiveCollapsed) setHoveredRailGroupId(null);
          }}
        >
          <button
            type="button"
            onClick={() => {
              onMobileItemClick?.();
              useAIChatHostStore.getState().openChat();
            }}
            className={`w-full group flex items-center rounded-xl text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 hover:from-emerald-500/20 hover:to-teal-500/15 border border-emerald-500/25 hover:border-emerald-500/45 transition-all shadow-2xs hover:shadow-xs cursor-pointer ${
              effectiveCollapsed
                ? 'w-10 h-10 mx-auto justify-center'
                : 'gap-x-2.5 px-3 py-2 text-left'
            }`}
            aria-label="Trợ lý AI Copilot"
          >
            <SparklesIcon className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 group-hover:rotate-12 transition-transform" />
            {!effectiveCollapsed && (
              <div className="flex items-center justify-between flex-1 min-w-0">
                <span className="truncate font-semibold">Trợ lý AI Copilot</span>
                <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                  AI
                </span>
              </div>
            )}
          </button>

          <AnimatePresence>
            {effectiveCollapsed && hoveredRailGroupId === 'ai-copilot' && (
              <motion.div
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -6, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -4, scale: 0.96 }}
                transition={MOTION_SPRINGS.snappy}
                className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 px-3 py-1.5 rounded-xl bg-surface/95 backdrop-blur-xl border border-emerald-500/30 shadow-xl whitespace-nowrap pointer-events-none"
              >
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Trợ lý AI Copilot
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Action Row: Collapse Toggle & Logout */}
        <div
          className={`flex items-center gap-1.5 ${
            effectiveCollapsed ? 'flex-col' : 'justify-between'
          }`}
        >
          {!isMobile && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`group flex items-center gap-2 rounded-xl text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-2 border border-transparent hover:border-border/80 transition-all cursor-pointer ${
                effectiveCollapsed
                  ? 'w-10 h-9 justify-center'
                  : 'flex-1 px-2.5 py-1.5 justify-between'
              }`}
              title={effectiveCollapsed ? 'Mở rộng menu (Ctrl+B)' : 'Thu gọn menu (Ctrl+B)'}
              aria-label={effectiveCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            >
              <span className="flex items-center gap-2">
                <motion.span
                  initial={false}
                  animate={{ rotate: effectiveCollapsed ? 180 : 0 }}
                  transition={MOTION_SPRINGS.snappy}
                  className="inline-flex items-center justify-center"
                >
                  <ChevronLeftIcon className="w-4 h-4 shrink-0" />
                </motion.span>
                {!effectiveCollapsed && <span>Thu gọn</span>}
              </span>
              {!effectiveCollapsed && (
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface-2 border border-border rounded text-ink-faint group-hover:text-ink-muted">
                  Ctrl B
                </kbd>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            className={`group flex items-center gap-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer ${
              effectiveCollapsed
                ? 'w-10 h-9 justify-center'
                : isMobile
                  ? 'w-full px-3 py-2'
                  : 'px-2.5 py-1.5'
            }`}
            title="Đăng xuất"
            aria-label="Đăng xuất"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4 shrink-0 text-rose-500 group-hover:translate-x-0.5 transition-transform" />
            {(isMobile || !effectiveCollapsed) && <span className="truncate">Đăng xuất</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
