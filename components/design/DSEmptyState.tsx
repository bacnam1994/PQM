import React from 'react';
import { LucideIcon, FolderOpen } from 'lucide-react';

// ============================================
// EMPTY STATE COMPONENT - Enhanced with animations
// ============================================

export interface DSEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const DSEmptyState: React.FC<DSEmptyStateProps> = ({ 
  icon: Icon = FolderOpen, 
  title, 
  description, 
  action 
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-8 text-center animate-fade-in-up">
    <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
      <Icon size={36} className="text-slate-300 dark:text-slate-500 animate-float" />
    </div>
    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">{title}</h3>
    {description && (
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">{description}</p>
    )}
    {action && <div className="mt-2 animate-fade-in-up delay-200">{action}</div>}
  </div>
);

export default DSEmptyState;

