import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRightIcon, ArrowLeftIcon } from '@heroicons/react/20/solid';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  onClick?: () => void;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  breadcrumb?: BreadcrumbItem[];
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  action?: React.ReactNode;
  icon?: any;
  backPath?: string;
  className?: string;
}

/**
 * PageHeader - Tailwind UI Page Headings with Breadcrumbs & Actions
 * Tầng 1: Breadcrumb & Điều hướng ngữ cảnh
 * Tầng 2: Tiêu đề trang + Huy hiệu trạng thái + Cụm hành động nhanh
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs = [],
  breadcrumb,
  badge,
  actions,
  action,
  icon,
  backPath,
  className = ''
}) => {
  const navigate = useNavigate();
  const effectiveActions = actions || action;
  const effectiveBreadcrumbs = breadcrumbs.length > 0 ? breadcrumbs : (breadcrumb || []);

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    const IconComp = icon;
    return <IconComp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
  };

  return (
    <div className={`space-y-2 pb-5 mb-5 border-b border-border/80 ${className}`}>
      {/* Tầng 1: Breadcrumbs & Nút quay lại */}
      {(effectiveBreadcrumbs.length > 0 || backPath) && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-ink-faint">
          {backPath && (
            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="p-1 -ml-1 text-ink-faint hover:text-ink hover:bg-surface-2 rounded-lg transition-colors"
              title="Quay lại"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
          )}

          {effectiveBreadcrumbs.map((item, index) => {
            const isLast = index === effectiveBreadcrumbs.length - 1;
            return (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRightIcon className="w-3.5 h-3.5 text-ink-faint/60 shrink-0" />}
                {item.onClick && !isLast ? (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="hover:text-ink transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ) : item.path && !isLast ? (
                  <Link
                    to={item.path}
                    className="hover:text-ink transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? 'font-semibold text-ink' : ''}>
                    {item.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* Tầng 2: Title, StatusBadge & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          {icon && (
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/20 shrink-0">
              {renderIcon()}
            </div>
          )}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink truncate">
            {title}
          </h1>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>

        {effectiveActions && (
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {effectiveActions}
          </div>
        )}
      </div>

      {subtitle && (
        <p className="text-xs sm:text-sm text-ink-faint max-w-3xl leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
};

