import React from 'react';

export interface SurfaceProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: 'default' | 'flat' | 'subtle' | 'inset' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: 'lg' | 'xl' | '2xl' | 'none';
  bordered?: boolean;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
}

/**
 * Surface - Bề mặt chuẩn phẳng cho QMS Workbench
 * Thay thế cho các pattern Card nổi lồng ghép, tạo chiều sâu giao diện tinh tế bằng viền mảnh và nền trung tính.
 */
export const Surface: React.FC<SurfaceProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  rounded = 'xl',
  bordered = true,
  className = '',
  title,
  subtitle,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-white dark:bg-slate-900 shadow-xs',
    flat: 'bg-white dark:bg-slate-900 shadow-2xs',
    subtle: 'bg-slate-50/70 dark:bg-slate-900/60 shadow-none',
    inset: 'bg-slate-100/60 dark:bg-slate-950/60 shadow-inner',
    elevated: 'bg-white dark:bg-slate-900 shadow-sm'
  };

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-5',
    lg: 'p-6 sm:p-8'
  };

  const roundedStyles = {
    none: 'rounded-none',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl'
  };

  const borderStyle = bordered
    ? 'border border-slate-200/80 dark:border-slate-800/80'
    : 'border-0';

  return (
    <div
      className={`transition-colors duration-150 ${variantStyles[variant]} ${paddingStyles[padding]} ${roundedStyles[rounded]} ${borderStyle} ${className}`}
      {...props}
    >
      {(title || subtitle) && (
        <div className="mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          {title && <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>}
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
};
