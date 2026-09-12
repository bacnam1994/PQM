import React from 'react';

export interface SurfaceProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: 'default' | 'flat' | 'subtle' | 'inset' | 'elevated';
  /** @alias intensity maps 'flat'|'raised'|'glass' -> variant for backward compat with workbench components */
  intensity?: 'flat' | 'raised' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: 'lg' | 'xl' | '2xl' | 'none';
  bordered?: boolean;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
}

/**
 * Surface - Tailwind UI Card & Panel Container
 * Đảm bảo hỗ trợ Dark Mode hoàn hảo với bg-surface, text-ink, border-border.
 */
export const Surface: React.FC<SurfaceProps> = ({
  children,
  variant,
  intensity,
  padding = 'md',
  rounded = 'xl',
  bordered = true,
  className = '',
  title,
  subtitle,
  ...props
}) => {
  // Map intensity -> variant for backward compat (intensity takes lower priority than explicit variant)
  const intensityToVariant: Record<string, 'flat' | 'default' | 'subtle'> = {
    flat: 'flat',
    raised: 'default',
    glass: 'subtle'
  };
  const resolvedVariant = variant || (intensity ? intensityToVariant[intensity] : 'default') || 'default';
  
  const variantStyles = {
    default: 'bg-surface text-ink shadow-xs',
    flat: 'bg-surface text-ink shadow-none',
    subtle: 'bg-surface-2 text-ink shadow-none',
    inset: 'bg-surface-2/60 text-ink shadow-inner',
    elevated: 'bg-surface text-ink shadow-md'
  };

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-6',
    lg: 'p-6 sm:p-8'
  };

  const roundedStyles = {
    none: 'rounded-none',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl'
  };

  const borderStyle = bordered
    ? 'border border-border'
    : 'border-0';

  return (
    <div
      className={`transition-colors duration-150 overflow-hidden ${variantStyles[resolvedVariant as keyof typeof variantStyles] || variantStyles.default} ${paddingStyles[padding]} ${roundedStyles[rounded]} ${borderStyle} ${className}`}
      {...props}
    >
      {(title || subtitle) && (
        <div className="mb-4 pb-3 border-b border-border">
          {title && <h3 className="text-sm sm:text-base font-semibold text-ink tracking-tight">{title}</h3>}
          {subtitle && <p className="text-xs text-ink-muted mt-0.5 leading-normal">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
};

