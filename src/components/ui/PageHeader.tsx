import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ArrowLeft } from 'lucide-react';

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
 * PageHeader - Tiêu đề 2 tầng chuẩn mực Workbench
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
    return <IconComp className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
  };

  return (
    <div className={`space-y-2.5 pb-4 mb-4 border-b border-slate-200/70 dark:border-slate-800/70 ${className}`}>
      {/* Tầng 1: Breadcrumbs & Nút quay lại */}
      {(effectiveBreadcrumbs.length > 0 || backPath) && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {backPath && (
            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="p-1 -ml-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Quay lại"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {effectiveBreadcrumbs.map((item, index) => {
            const isLast = index === effectiveBreadcrumbs.length - 1;
            return (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />}
                {item.onClick && !isLast ? (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ) : item.path && !isLast ? (
                  <Link
                    to={item.path}
                    className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? 'font-medium text-slate-800 dark:text-slate-200' : ''}>
                    {item.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Tầng 2: Title, StatusBadge & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          {icon && <div className="p-1.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 shrink-0">{renderIcon()}</div>}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
            {title}
          </h1>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>

        {effectiveActions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {effectiveActions}
          </div>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
};
