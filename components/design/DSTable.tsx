import React from 'react';

// ============================================
// TABLE COMPONENTS - Glassmorphism & enhanced styling
// ============================================

export interface DSTableProps {
  children: React.ReactNode;
  className?: string;
  stickyHeader?: boolean;
}

export const DSTable: React.FC<DSTableProps> = ({ children, className = '', stickyHeader = true }) => (
  <div className={`glass rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-lg overflow-x-auto transition-all duration-300 hover:shadow-xl ${className}`}>
    <table className="w-full text-left min-w-[600px]">
      {children}
    </table>
  </div>
);

export const DSTableHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead className="bg-gradient-to-r from-slate-50/80 to-slate-100/80 dark:from-slate-700/50 dark:to-slate-800/50 border-b border-slate-200 dark:border-slate-600">
    {children}
  </thead>
);

export const DSTableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
    {children}
  </tbody>
);

export const DSTableRow: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <tr 
    className={`hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-transparent dark:hover:from-emerald-900/20 dark:hover:to-transparent transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-[1.01]' : ''} ${className}`}
    onClick={onClick}
  >
    {children}
  </tr>
);

export const DSTableCell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <td className={`px-5 py-4 text-sm text-slate-600 dark:text-slate-300 transition-colors ${className}`}>
    {children}
  </td>
);

export interface DSTableHeaderProps {
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
}

export const DSTableHeader: React.FC<DSTableHeaderProps> = ({ children, className = '', sticky = true }) => (
  <th className={`px-5 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ${sticky ? 'sticky top-0 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 z-10 backdrop-blur-sm' : ''} ${className}`}>
    {children}
  </th>
);

export default DSTable;

