import React from 'react';
import { Search, LucideIcon } from 'lucide-react';

// 1. Container cho thanh công cụ (Filter Bar)
export const DSFilterBar: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center ${className}`}>
    {children}
  </div>
);

// 2. Ô tìm kiếm chuẩn (Soft UI)
export const DSSearchInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <div className="relative flex-1 w-full">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
    <input 
      {...props}
      className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl font-bold outline-none shadow-inner text-sm placeholder:font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-100 transition-all ${props.className || ''}`}
    />
  </div>
);

// 3. Select Box chuẩn (Có hỗ trợ Icon)
interface DSSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: LucideIcon;
  containerClassName?: string;
}

export const DSSelect: React.FC<DSSelectProps> = ({ icon: Icon, containerClassName = '', className = '', children, ...props }) => (
  <div className={`flex items-center gap-2 bg-slate-50 rounded-xl px-3 border border-slate-100 hover:border-slate-200 transition-colors ${containerClassName}`}>
    {Icon && <Icon size={16} className="text-slate-400 shrink-0" />}
    <select 
      {...props}
      className={`py-2.5 bg-transparent border-none font-bold outline-none text-xs text-slate-600 cursor-pointer w-full ${className}`}
    >
      {children}
    </select>
  </div>
);

// 4. Nút chuyển đổi chế độ xem (Grid/List)
export const DSViewToggle: React.FC<{ 
  viewMode: 'grid' | 'list'; 
  setViewMode: (mode: 'grid' | 'list') => void;
  gridIcon: LucideIcon;
  listIcon: LucideIcon;
}> = ({ viewMode, setViewMode, gridIcon: GridIcon, listIcon: ListIcon }) => (
  <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
    <button 
      onClick={() => setViewMode('grid')} 
      className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
    >
      <GridIcon size={20} />
    </button>
    <button 
      onClick={() => setViewMode('list')} 
      className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
    >
      <ListIcon size={20} />
    </button>
  </div>
);

// 5. Card chuẩn cho Grid View
export const DSCard: React.FC<{ children: React.ReactNode; className?: string; isExpanded?: boolean }> = ({ children, className = '', isExpanded = false }) => (
  <div className={`bg-white rounded-2xl border transition-all overflow-hidden ${isExpanded ? 'border-indigo-200 shadow-xl' : 'border-slate-100 shadow-sm hover:shadow-md'} ${className}`}>
    {children}
  </div>
);

// 6. Table Container chuẩn
export const DSTable: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
    <table className="w-full text-left">
      {children}
    </table>
  </div>
);

// 7. Input Form chuẩn (Dùng trong Modal)
export const DSFormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => (
  <div className="space-y-1">
    {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">{label}</label>}
    <input 
      {...props}
      className={`w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none shadow-inner text-sm focus:ring-2 focus:ring-indigo-100 transition-all ${className}`}
    />
  </div>
);