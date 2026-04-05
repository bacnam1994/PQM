import React, { memo, forwardRef } from 'react';
import { Search, X, LucideIcon, FileSearch } from 'lucide-react';

// 1. Container cho thanh công cụ (Filter Bar)
// Tối ưu: Bỏ memo vì component nhận children (luôn tạo tham chiếu mới mỗi lần render, làm memo trở nên vô dụng và tốn CPU)
export const DSFilterBar: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center ${className}`}>
    {children}
  </div>
);

// 2. Ô tìm kiếm chuẩn (Soft UI)
// Tối ưu: Thêm forwardRef để hỗ trợ focus và các thư viện form
export const DSSearchInput = memo(forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { onClear?: () => void }>((props, ref) => (
  <div className="relative flex-1 w-full group">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
    <input 
      ref={ref}
      {...props}
      className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border-none rounded-xl font-bold outline-none shadow-inner text-sm placeholder:font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-100 transition-all ${props.className || ''}`}
    />
    {props.value && props.onClear && (
       <button type="button" onClick={props.onClear} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-1 rounded-full transition-colors">
          <X size={14} />
       </button>
    )}
  </div>
)));

// 3. Select Box chuẩn (Có hỗ trợ Icon)
interface DSSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: LucideIcon;
  containerClassName?: string;
}

// Tối ưu: Bỏ memo do chứa children, thêm forwardRef
export const DSSelect = forwardRef<HTMLSelectElement, DSSelectProps>(({ icon: Icon, containerClassName = '', className = '', children, ...props }, ref) => (
  <div className={`flex items-center gap-2 bg-slate-50 rounded-xl px-3 border border-slate-100 hover:border-slate-200 transition-colors ${containerClassName}`}>
    {Icon && <Icon size={16} className="text-slate-400 shrink-0" />}
    <select 
      ref={ref}
      {...props}
      className={`py-2.5 bg-transparent border-none font-bold outline-none text-xs text-slate-600 cursor-pointer w-full ${className}`}
    >
      {children}
    </select>
  </div>
));

// 4. Nút chuyển đổi chế độ xem (Grid/List)
export const DSViewToggle: React.FC<{ 
  viewMode: 'grid' | 'list'; 
  setViewMode: (mode: 'grid' | 'list') => void;
  gridIcon: LucideIcon;
  listIcon: LucideIcon;
}> = memo(({ viewMode, setViewMode, gridIcon: GridIcon, listIcon: ListIcon }) => (
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
));

// 5. Card chuẩn cho Grid View
// Tối ưu: Bỏ memo vì component nhận children
export const DSCard: React.FC<{ children: React.ReactNode; className?: string; isExpanded?: boolean }> = ({ children, className = '', isExpanded = false }) => (
  <div className={`bg-white rounded-2xl border transition-all overflow-hidden ${isExpanded ? 'border-indigo-200 shadow-xl' : 'border-slate-100 shadow-sm hover:shadow-md'} ${className}`}>
    {children}
  </div>
);

// 6. Table Container chuẩn
// Tối ưu: Bỏ memo vì component nhận children
export const DSTable: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
    <table className="w-full text-left">
      {children}
    </table>
  </div>
);

// 7. Input Form chuẩn (Dùng trong Modal)
// Tối ưu: Thêm forwardRef
export const DSFormInput = memo(forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: string }>(({ label, className = '', ...props }, ref) => (
  <div className="space-y-1">
    {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">{label}</label>}
    <input 
      ref={ref}
      {...props}
      className={`w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none shadow-inner text-sm focus:ring-2 focus:ring-indigo-100 transition-all ${className}`}
    />
  </div>
)));

// 8. Trạng thái rỗng chuẩn (Empty State)
// Tối ưu UX: Hiển thị khi không có dữ liệu để người dùng không bị bối rối
export const DSEmptyState: React.FC<{ title: string; message: string; icon?: LucideIcon; className?: string }> = ({ title, message, icon: Icon = FileSearch, className = '' }) => (
  <div className={`col-span-full p-12 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-2xl border-2 border-slate-100 border-dashed animate-in fade-in duration-500 ${className}`}>
     <div className="p-4 bg-white rounded-full mb-4 text-slate-300 shadow-sm border border-slate-100">
       <Icon size={32} />
     </div>
     <h3 className="text-slate-700 font-black text-base uppercase tracking-widest mb-2">{title}</h3>
     <p className="text-slate-500 text-sm font-medium max-w-md">{message}</p>
  </div>
);