import React from 'react';
import { LucideIcon } from 'lucide-react';

// ============================================
// BUTTON COMPONENT - Enhanced with gradients and animations
// ============================================

export interface DSButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export const DSButton: React.FC<DSButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClass = 'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100';
  
  const variantClass = {
    primary: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50',
    secondary: 'bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 text-slate-700 dark:text-slate-200 hover:from-slate-200 hover:to-slate-300 dark:hover:from-slate-600 dark:hover:to-slate-500',
    danger: 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/30 hover:shadow-red-500/50',
    ghost: 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-gradient-to-r hover:from-slate-100 hover:to-transparent dark:hover:from-slate-700 dark:hover:to-transparent',
  };

  const sizeClass = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };

  return (
    <button 
      className={`${baseClass} ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} className="transition-transform hover:rotate-12" />}
          {children}
          {Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} className="transition-transform hover:-rotate-12" />}
        </>
      )}
    </button>
  );
};

export default DSButton;

