import React, { memo, useMemo } from 'react';

// ============================================
// MEMOIZED TABLE COMPONENTS
// ============================================

interface TableProps {
  children: React.ReactNode;
  className?: string;
  stickyHeader?: boolean;
}

export const MemoizedTable = memo<TableProps>(({ children, className = '', stickyHeader = true }) => (
  <div className={`glass rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-lg overflow-x-auto transition-all duration-300 hover:shadow-xl ${className}`}>
    <table className="w-full text-left min-w-[600px]">
      {children}
    </table>
  </div>
));

MemoizedTable.displayName = 'MemoizedTable';

interface TableHeadProps {
  children: React.ReactNode;
}

export const MemoizedTableHead = memo<TableHeadProps>(({ children }) => (
  <thead className="bg-gradient-to-r from-slate-50/80 to-slate-100/80 dark:from-slate-700/50 dark:to-slate-800/50 border-b border-slate-200 dark:border-slate-600">
    {children}
  </thead>
));

MemoizedTableHead.displayName = 'MemoizedTableHead';

interface TableBodyProps {
  children: React.ReactNode;
}

export const MemoizedTableBody = memo<TableBodyProps>(({ children }) => (
  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
    {children}
  </tbody>
));

MemoizedTableBody.displayName = 'MemoizedTableBody';

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const MemoizedTableRow = memo<TableRowProps>(({ children, className = '', onClick }) => (
  <tr 
    className={`hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-transparent dark:hover:from-emerald-900/20 dark:hover:to-transparent transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-[1.01]' : ''} ${className}`}
    onClick={onClick}
  >
    {children}
  </tr>
));

MemoizedTableRow.displayName = 'MemoizedTableRow';

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
}

export const MemoizedTableCell = memo<TableCellProps>(({ children, className = '' }) => (
  <td className={`px-5 py-4 text-sm text-slate-600 dark:text-slate-300 transition-colors ${className}`}>
    {children}
  </td>
));

MemoizedTableCell.displayName = 'MemoizedTableCell';

interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
}

export const MemoizedTableHeader = memo<TableHeaderProps>(({ children, className = '', sticky = true }) => (
  <th className={`px-5 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ${sticky ? 'sticky top-0 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 z-10 backdrop-blur-sm' : ''} ${className}`}>
    {children}
  </th>
));

MemoizedTableHeader.displayName = 'MemoizedTableHeader';

// ============================================
// MEMOIZED CARD COMPONENT
// ============================================

interface CardProps {
  children: React.ReactNode;
  className?: string;
  isExpanded?: boolean;
  interactive?: boolean;
}

export const MemoizedCard = memo<CardProps>(({ children, className = '', isExpanded = false, interactive = false }) => (
  <div className={`glass rounded-2xl border border-white/20 dark:border-slate-600/30 transition-all duration-500 overflow-hidden hover:shadow-2xl hover:shadow-emerald-500/10 dark:hover:shadow-emerald-900/20 ${isExpanded ? 'ring-2 ring-emerald-400 dark:ring-emerald-600 shadow-xl' : 'shadow-lg hover:shadow-xl'} ${interactive ? 'hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-500/15 dark:hover:shadow-emerald-900/25 cursor-pointer group' : ''} ${className}`}>
    {children}
  </div>
));

MemoizedCard.displayName = 'MemoizedCard';

// ============================================
// MEMOIZED BADGE COMPONENT
// ============================================

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const badgeStyles = {
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
};

export const MemoizedBadge = memo<BadgeProps>(({ children, variant = 'default', className = '' }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeStyles[variant]} ${className}`}>
    {children}
  </span>
));

MemoizedBadge.displayName = 'MemoizedBadge';

// ============================================
// MEMOIZED SEARCH INPUT
// ============================================

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
}

export const MemoizedSearchInput = memo<SearchInputProps>(({ onSearch, className = '', ...props }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch?.(e.target.value);
  };

  return (
    <div className="relative flex-1 w-full group">
      <svg 
        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-[#009639] dark:group-focus-within:text-emerald-400 transition-colors" 
        width="20" 
        height="20" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input 
        {...props}
        onChange={handleChange}
        className={`w-full pl-12 pr-4 py-3 bg-slate-50/80 dark:bg-slate-700/80 backdrop-blur-sm border border-transparent focus:bg-white dark:focus:bg-slate-600 rounded-xl font-medium outline-none shadow-inner text-base placeholder:font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-4 focus:ring-emerald-100/50 dark:focus:ring-emerald-900/30 focus:border-emerald-200 dark:focus:border-emerald-700 transition-all duration-300 text-slate-700 dark:text-slate-200 ${className || ''}`}
      />
    </div>
  );
});

MemoizedSearchInput.displayName = 'MemoizedSearchInput';

// ============================================
// EXPORTS
// ============================================

export {
  MemoizedTable as Table,
  MemoizedTableHead as TableHead,
  MemoizedTableBody as TableBody,
  MemoizedTableRow as TableRow,
  MemoizedTableCell as TableCell,
  MemoizedTableHeader as TableHeader,
  MemoizedCard as Card,
  MemoizedBadge as Badge,
  MemoizedSearchInput as SearchInput
};

export default {
  Table: MemoizedTable,
  TableHead: MemoizedTableHead,
  TableBody: MemoizedTableBody,
  TableRow: MemoizedTableRow,
  TableCell: MemoizedTableCell,
  TableHeader: MemoizedTableHeader,
  Card: MemoizedCard,
  Badge: MemoizedBadge,
  SearchInput: MemoizedSearchInput
};
