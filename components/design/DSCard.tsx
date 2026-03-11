import React from 'react';

// ============================================
// CARD COMPONENT - Glassmorphism & Enhanced hover effects
// ============================================

export interface DSCardProps {
  children: React.ReactNode;
  className?: string;
  isExpanded?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

export const DSCard: React.FC<DSCardProps> = ({ 
  children, 
  className = '', 
  isExpanded = false, 
  interactive = false,
  onClick
}) => (
  <div 
    onClick={onClick}
    className={`glass rounded-2xl border border-white/20 dark:border-slate-600/30 transition-all duration-500 overflow-hidden hover:shadow-2xl hover:shadow-emerald-500/10 dark:hover:shadow-emerald-900/20 ${isExpanded ? 'ring-2 ring-emerald-400 dark:ring-emerald-600 shadow-xl' : 'shadow-lg hover:shadow-xl'} ${interactive ? 'hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-500/15 dark:hover:shadow-emerald-900/25 cursor-pointer group' : ''} ${className}`}
  >
    {children}
  </div>
);

export default DSCard;

