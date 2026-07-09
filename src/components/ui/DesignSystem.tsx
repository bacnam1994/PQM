import React, { memo, forwardRef } from 'react';
import { Search, X, LucideIcon, FileSearch } from 'lucide-react';

// 1. Container cho thanh công cụ (Filter Bar)
export const DSFilterBar: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-zinc-950 p-3.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 shadow-[0_1px_4px_rgba(0,0,0,0.04)] flex flex-col md:flex-row gap-3 items-center ${className}`}>
    {children}
  </div>
);

// 2. Ô tìm kiếm chuẩn (Apple Minimalist style)
export const DSSearchInput = memo(forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { onClear?: () => void }>((props, ref) => (
  <div className="relative flex-1 w-full group">
    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-700 dark:group-focus-within:text-zinc-200 transition-colors" size={16} />
    <input 
      ref={ref}
      {...props}
      className={`w-full pl-10 pr-10 py-2.5 bg-zinc-100/70 dark:bg-zinc-900/70 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 focus:bg-white dark:focus:bg-zinc-950 rounded-xl font-medium text-sm text-zinc-800 dark:text-zinc-100 outline-none focus:ring-0 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500 ${props.className || ''}`}
    />
    {props.value && props.onClear && (
       <button type="button" onClick={props.onClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 p-0.5 rounded-full transition-colors">
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

export const DSSelect = forwardRef<HTMLSelectElement, DSSelectProps>(({ icon: Icon, containerClassName = '', className = '', children, ...props }, ref) => (
  <div className={`flex items-center gap-2 bg-zinc-100/70 dark:bg-zinc-900/70 rounded-xl px-3 border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus-within:border-zinc-300 dark:focus-within:border-zinc-700 focus-within:bg-white dark:focus-within:bg-zinc-950 transition-all ${containerClassName}`}>
    {Icon && <Icon size={15} className="text-zinc-400 shrink-0" />}
    <select 
      ref={ref}
      {...props}
      className={`py-2.5 bg-transparent border-none font-medium outline-none text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer w-full ${className}`}
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
  <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl shrink-0 gap-0.5">
    <button 
      onClick={() => setViewMode('grid')} 
      className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
    >
      <GridIcon size={18} />
    </button>
    <button 
      onClick={() => setViewMode('list')} 
      className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
    >
      <ListIcon size={18} />
    </button>
  </div>
));

// 5. Card chuẩn — Apple-style: ultra-thin border, flat shadow
export const DSCard: React.FC<{ children: React.ReactNode; className?: string; isExpanded?: boolean }> = ({ children, className = '', isExpanded = false }) => (
  <div className={`bg-white dark:bg-zinc-950 rounded-2xl border transition-all overflow-hidden ${isExpanded ? 'border-emerald-200/80 dark:border-emerald-900/50 shadow-md' : 'border-zinc-200/60 dark:border-zinc-800/60 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]'} ${className}`}>
    {children}
  </div>
);

// 6. Table Container chuẩn
export const DSTable: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
    <table className="w-full text-left">
      {children}
    </table>
  </div>
);

// 7. Input Form chuẩn (Dùng trong Modal)
export const DSFormInput = memo(forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: string }>(({ label, className = '', ...props }, ref) => (
  <div className="space-y-1.5">
    {label && <label className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pl-1">{label}</label>}
    <input 
      ref={ref}
      {...props}
      className={`w-full px-3.5 py-2.5 bg-zinc-100/70 dark:bg-zinc-900/70 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 focus:bg-white dark:focus:bg-zinc-950 rounded-xl font-medium outline-none text-sm text-zinc-800 dark:text-zinc-100 transition-all placeholder:text-zinc-400 ${className}`}
    />
  </div>
)));

// 8. Trạng thái rỗng chuẩn (Empty State)
export const DSEmptyState: React.FC<{ title: string; message: string; icon?: LucideIcon; className?: string }> = ({ title, message, icon: Icon = FileSearch, className = '' }) => (
  <div className={`col-span-full p-16 flex flex-col items-center justify-center text-center bg-zinc-50/50 dark:bg-zinc-950/30 rounded-2xl border-2 border-dashed border-zinc-200/60 dark:border-zinc-800/60 animate-in fade-in duration-500 ${className}`}>
     <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl mb-5 text-zinc-300 dark:text-zinc-600 shadow-[0_1px_4px_rgba(0,0,0,0.04)] border border-zinc-200/50 dark:border-zinc-800/60">
       <Icon size={28} />
     </div>
     <h3 className="text-zinc-700 dark:text-zinc-200 font-display font-semibold text-sm uppercase tracking-wider mb-2">{title}</h3>
     <p className="text-zinc-400 dark:text-zinc-500 text-sm font-medium max-w-md leading-relaxed">{message}</p>
  </div>
);

// 9. Input Date chuẩn hóa theo cấu hình dd/mm/yyyy
import { useUIStore } from '../../store/useUIStore';
import { parseDateToISO } from '../../utils';
import { Calendar } from 'lucide-react';

interface DSDateInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  name?: string;
}

export const DSDateInput: React.FC<DSDateInputProps> = ({
  label,
  value,
  onChange,
  required,
  className = '',
  name
}) => {
  const dateFormat = useUIStore(s => s.dateFormat) || 'DD/MM/YYYY';
  const hiddenInputRef = React.useRef<HTMLInputElement>(null);
  const [displayText, setDisplayText] = React.useState('');

  React.useEffect(() => {
    if (!value) {
      setDisplayText('');
      return;
    }
    try {
      const parts = value.split('-');
      if (parts.length === 3) {
        const yyyy = parts[0];
        const mm = parts[1];
        const dd = parts[2];
        if (dateFormat === 'DD/MM/YYYY') {
          setDisplayText(`${dd}/${mm}/${yyyy}`);
        } else if (dateFormat === 'MM/DD/YYYY') {
          setDisplayText(`${mm}/${dd}/${yyyy}`);
        } else {
          setDisplayText(`${yyyy}-${mm}-${dd}`);
        }
      } else {
        setDisplayText(value);
      }
    } catch {
      setDisplayText(value);
    }
  }, [value, dateFormat]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayText(e.target.value);
  };

  const handleBlur = () => {
    if (!displayText) {
      onChange('');
      return;
    }
    const isoDate = parseDateToISO(displayText);
    onChange(isoDate);
  };

  const handleIconClick = () => {
    if (hiddenInputRef.current) {
      try {
        hiddenInputRef.current.showPicker();
      } catch (err) {
        hiddenInputRef.current.focus();
        hiddenInputRef.current.click();
      }
    }
  };

  return (
    <div className="space-y-1.5 w-full">
      {label && <label className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pl-1">{label}</label>}
      <div className="relative flex items-center w-full">
        <input
          type="text"
          value={displayText}
          onChange={handleTextChange}
          onBlur={handleBlur}
          placeholder={dateFormat.toLowerCase()}
          required={required}
          className={`w-full pl-3.5 pr-10 py-2.5 bg-zinc-100/70 dark:bg-zinc-900/70 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 focus:bg-white dark:focus:bg-zinc-950 rounded-xl font-medium outline-none text-sm text-zinc-800 dark:text-zinc-100 transition-all placeholder:text-zinc-400 ${className}`}
        />
        <button
          type="button"
          onClick={handleIconClick}
          className="absolute right-3 text-zinc-400 hover:text-indigo-500 transition-colors p-1"
        >
          <Calendar size={16} />
        </button>
        <input
          type="date"
          ref={hiddenInputRef}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          name={name}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
        />
      </div>
    </div>
  );
};